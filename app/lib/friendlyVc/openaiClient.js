import { randomUUID } from 'crypto';

const OPENAI_API_URL = process.env.OPENAI_FRIENDLY_VC_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REQUEST_TIMEOUT_MS = Number(process.env.FRIENDLY_VC_TIMEOUT_MS || 120_000);
const MAX_RETRIES = Number(process.env.FRIENDLY_VC_MAX_RETRIES || 3);

const RETRY_STATUS = new Set([408, 429, 500, 502, 503, 504]);

class OpenAIRequestError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'OpenAIRequestError';
    this.status = status;
    this.body = body;
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computeBackoff(attempt) {
  const base = 500 * 2 ** attempt;
  const jitter = Math.random() * 250;
  return base + jitter;
}

function combineSignals(signalA, signalB) {
  if (!signalA) return signalB;
  if (!signalB) return signalA;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signalA.aborted || signalB.aborted) {
    controller.abort();
  } else {
    signalA.addEventListener('abort', abort, { once: true });
    signalB.addEventListener('abort', abort, { once: true });
  }
  return controller.signal;
}

async function executeRequest({ payload, signal }) {
  if (!OPENAI_API_KEY) {
    throw new OpenAIRequestError('Missing OpenAI API key', 500);
  }

  const requestId = randomUUID();
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(payload),
        signal: combineSignals(signal, abortController.signal),
      });

      if (response.ok) {
        clearTimeout(timeoutId);
        return { response, requestId, attempt };
      }

      if (!RETRY_STATUS.has(response.status) || attempt === MAX_RETRIES - 1) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (error) {
          // ignore parse failures
        }
        throw new OpenAIRequestError(
          errorBody?.error?.message || `OpenAI error (${response.status})`,
          response.status,
          errorBody
        );
      }

      lastError = response;
    } catch (error) {
      if (error.name === 'AbortError' && abortController.signal.aborted && !signal?.aborted) {
        lastError = error;
      } else if (!(error instanceof OpenAIRequestError) && attempt === MAX_RETRIES - 1) {
        throw error;
      } else if (error instanceof OpenAIRequestError && attempt === MAX_RETRIES - 1) {
        throw error;
      } else {
        lastError = error;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    await wait(computeBackoff(attempt));
  }

  if (lastError instanceof OpenAIRequestError) {
    throw lastError;
  }

  throw new OpenAIRequestError('OpenAI request failed after retries', 500);
}

export async function streamChatCompletion({ messages, model, maxTokens = 800, temperature = 0.7, signal }) {
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  };

  const { response, requestId } = await executeRequest({ payload, signal });
  if (!response.body) {
    throw new OpenAIRequestError('OpenAI returned empty body', 502);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = '';
  let resolved = false;
  let fullText = '';
  let usage = null;
  let modelName = model;
  let finishReason = null;

  let resolveCollect;
  let rejectCollect;
  const collectPromise = new Promise((resolve, reject) => {
    resolveCollect = resolve;
    rejectCollect = reject;
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const segments = buffer.split('\n\n');
          buffer = segments.pop() || '';

          for (const segment of segments) {
            const lines = segment.split('\n').filter(Boolean);
            for (const line of lines) {
              if (!line.startsWith('data:')) continue;
              const data = line.replace(/^data:\s*/, '');
              if (data === '[DONE]') {
                continue;
              }
              const parsed = JSON.parse(data);
              if (parsed.model) {
                modelName = parsed.model;
              }
              if (parsed.usage) {
                usage = parsed.usage;
              }
              const choice = parsed.choices?.[0];
              if (choice?.delta?.content) {
                fullText += choice.delta.content;
                controller.enqueue(
                  encoder.encode(`event: token\ndata: ${JSON.stringify({ content: choice.delta.content })}\n\n`)
                );
              }
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }
            }
          }
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ content: fullText, usage, finishReason })}\n\n`
          )
        );
        controller.close();
        resolved = true;
        resolveCollect({ content: fullText, usage, model: modelName, finishReason });
      } catch (error) {
        if (!resolved) {
          resolved = true;
          rejectCollect(error);
        }
        controller.error(error);
      }
    },
    cancel(reason) {
      if (!resolved) {
        resolved = true;
        rejectCollect(reason);
      }
      reader.cancel(reason).catch(() => {});
    },
  });

  return {
    requestId,
    stream,
    collect: () => collectPromise,
  };
}

export { OpenAIRequestError };

export async function chatCompletion({ messages, model, maxTokens = 800, temperature = 0.3, signal }) {
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: false,
  };

  const { response, requestId } = await executeRequest({ payload, signal });
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  const usage = data?.usage ?? null;
  return { requestId, content, usage, model: data?.model ?? model };
}
