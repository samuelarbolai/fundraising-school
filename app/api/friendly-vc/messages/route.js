import { NextResponse } from 'next/server';
import { friendlyVcSystemPrompt } from '../prompt';
import {
  FriendlyVcError,
  createConversation,
  deriveConversationTitle,
  enforceRateLimit,
  getConversationById,
  getMessagesForConversation,
  insertMessage,
  logAiEvent,
  updateConversationMeta,
  getNextMessageSequence,
  getLatestPrompt,
  recordAgentOutput,
} from '@/lib/friendlyVc/service';
import { streamChatCompletion, OpenAIRequestError } from '@/lib/friendlyVc/openaiClient';
import { evaluateFriendlyAnalystSummary } from '@/lib/friendlyVc/evaluator';

const DEFAULT_MODEL = process.env.OPENAI_FRIENDLY_VC_MODEL || 'gpt-4o-mini';
const DEFAULT_PROMPT_VERSION = process.env.FRIENDLY_VC_PROMPT_VERSION || 'v1';
const DEFAULT_AGENT_SLUG = 'sales-coach';

const FALLBACK_PROMPTS = {
  'sales-coach': friendlyVcSystemPrompt,
  'friendly-vc-analyst': `You are the Friendly VC Analyst for the 30x Venture Capital fund. Lead a conversational diligence screen to capture: company name, HQ, product, traction metrics, round status, founder contact details (full name, email, phone), top risks, and potential warm introductions. Ask follow-up questions until you are confident in the data. When you have enough context, deliver a concise analyst response with sections: Summary (2 sentences), Fit (Strong Fit | Promising | Monitor | Not a Fit + why), Metrics & Proof, Risks, 30x Next Step, Warm Intros. Keep it pragmatic. If critical data is missing, ask for it before closing.`,
};

function buildSseResponse({ meta, sourceStream }) {
  const encoder = new TextEncoder();
  const reader = sourceStream.getReader();

  const stream = new ReadableStream({
    start(controller) {
      if (meta) {
        controller.enqueue(
          encoder.encode(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`)
        );
      }

      const pump = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      };

      pump();
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request) {
  const startedAt = Date.now();
  let payload;
  let conversationId;
  let agentSlug = DEFAULT_AGENT_SLUG;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { conversationId: incomingConversationId, content, agentSlug: rawAgentSlug, email: rawEmail } = payload || {};
  const userEmail = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : null;

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'Message content is required.' }, { status: 400 });
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    return NextResponse.json({ error: 'Message content cannot be empty.' }, { status: 400 });
  }

  if (trimmedContent.length > 4000) {
    return NextResponse.json({ error: 'Message content exceeds 4000 characters.' }, { status: 400 });
  }

  try {
    await enforceRateLimit({ userId: null });

    agentSlug = (rawAgentSlug || DEFAULT_AGENT_SLUG).toLowerCase();

    const latestPrompt = await getLatestPrompt(agentSlug);
    const fallbackPrompt = FALLBACK_PROMPTS[agentSlug] || friendlyVcSystemPrompt;
    const promptVersion = latestPrompt?.version || DEFAULT_PROMPT_VERSION;
    const systemPrompt = latestPrompt?.content || fallbackPrompt;

    let conversation = null;
    if (incomingConversationId) {
      conversation = await getConversationById(null, incomingConversationId);
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
      if (conversation.agentSlug && conversation.agentSlug !== agentSlug) {
        return NextResponse.json({ error: 'Conversation belongs to a different agent.' }, { status: 400 });
      }
    }

    if (!conversation) {
      const title = deriveConversationTitle(trimmedContent);
      conversation = await createConversation({
        userId: null,
        promptVersion,
        title,
        agentSlug,
      });
    }

    conversationId = conversation.id;
    const history = await getMessagesForConversation(conversationId);
    const sequence = await getNextMessageSequence(conversationId);

    await insertMessage({
      conversationId,
      role: 'user',
      content: trimmedContent,
      sequence,
      metadata: userEmail ? { senderEmail: userEmail } : null,
    });

    await updateConversationMeta(conversationId, {
      title: conversation.title || deriveConversationTitle(trimmedContent),
      promptVersion,
      lastInteractedAt: new Date(),
      agentSlug,
    });

    const assembledMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(message => ({ role: message.role, content: message.content })),
      { role: 'user', content: trimmedContent },
    ];

    const completion = await streamChatCompletion({
      messages: assembledMessages,
      model: DEFAULT_MODEL,
    });

    await logAiEvent({
      requestId: completion.requestId,
      userId: null,
      conversationId,
      eventType: 'friendly_vc_stream',
      status: 'open',
      model: DEFAULT_MODEL,
      metadata: {
        promptVersion,
        messageLength: trimmedContent.length,
        agentSlug,
        userEmail,
      },
    });

    const response = buildSseResponse({
      meta: {
        conversationId,
        promptVersion,
        agentSlug,
        createdAt: conversation.createdAt,
      },
      sourceStream: completion.stream,
    });

    completion
      .collect()
      .then(async result => {
        const assistantSequence = sequence + 1;
        const latencyMs = Date.now() - startedAt;

        await insertMessage({
          conversationId,
          role: 'assistant',
          content: result.content,
          sequence: assistantSequence,
          model: result.model,
          tokenUsage: result.usage ?? null,
          latencyMs,
          metadata: userEmail ? { recipientEmail: userEmail } : null,
        });

        await updateConversationMeta(conversationId, {
          lastInteractedAt: new Date(),
        });

        await logAiEvent({
          requestId: completion.requestId,
          userId: null,
          conversationId,
          eventType: 'friendly_vc_completion',
          status: 'success',
          model: result.model,
          latencyMs,
          tokenUsage: result.usage ?? null,
          metadata: {
            finishReason: result.finishReason || null,
            promptVersion,
            agentSlug,
            userEmail,
          },
        });

        if (agentSlug === 'friendly-vc-analyst') {
          const conversationMessages = [
            ...history.map(message => ({ role: message.role, content: message.content })),
            { role: 'user', content: trimmedContent },
            { role: 'assistant', content: result.content },
          ];

          try {
            const evaluation = await evaluateFriendlyAnalystSummary({ conversationMessages });
            const connectors = Array.isArray(evaluation?.connectors)
              ? evaluation.connectors
                  .filter(item => item?.name)
                  .map(item => `${item.name}${item.why ? ` — ${item.why}` : ''}`)
                  .join('\n')
              : null;

            await recordAgentOutput({
              conversationId,
              agentSlug,
              summary: evaluation?.summary || result.content,
              fitLabel: evaluation?.fitLabel || null,
              companyName: evaluation?.companyName || null,
              founderName: evaluation?.founderName || null,
              founderEmail: evaluation?.founderEmail || null,
              founderPhone: evaluation?.founderPhone || null,
              connectors,
              metadata: {
                source: 'auto-evaluation',
                usage: result.usage ?? null,
                raw: evaluation,
                requesterEmail: userEmail,
              },
            });

            await logAiEvent({
              requestId: completion.requestId,
              userId: null,
              conversationId,
              eventType: 'friendly_vc_evaluation',
              status: 'success',
              model: result.model,
              metadata: {
                agentSlug,
                fitLabel: evaluation?.fitLabel || null,
                userEmail,
              },
            });
          } catch (evalError) {
            await logAiEvent({
              requestId: completion.requestId,
              userId: null,
              conversationId,
              eventType: 'friendly_vc_evaluation',
              status: 'error',
              model: result.model,
              metadata: {
                agentSlug,
                message: evalError?.message || 'Evaluation failure',
                userEmail,
              },
            });
            const fallbackFit = /fit\s*[:\-]\s*(.+)/i.exec(result.content);
            await recordAgentOutput({
              conversationId,
              agentSlug,
              summary: result.content,
              fitLabel: fallbackFit ? fallbackFit[1].split('\n')[0].trim() : null,
              metadata: {
                source: 'raw-response',
                usage: result.usage ?? null,
                requesterEmail: userEmail,
              },
            });
          }
        }
      })
      .catch(async error => {
        await logAiEvent({
          requestId: completion.requestId,
          userId: null,
          conversationId,
          eventType: 'friendly_vc_completion',
          status: 'error',
          model: DEFAULT_MODEL,
          metadata: {
            message: error?.message || 'Stream cancelled',
            agentSlug,
            userEmail,
          },
        });
      });

    return response;
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      const headers = {};
      if (error.retryAfter) {
        headers['Retry-After'] = String(error.retryAfter);
      }
      return NextResponse.json({ error: error.message, code: error.code, bucket: error.bucket }, {
        status: error.status || 500,
        headers,
      });
    }

    if (error instanceof OpenAIRequestError) {
      if (conversationId) {
        await logAiEvent({
          requestId: error.body?.id || `error-${Date.now()}`,
          userId: null,
          conversationId,
          eventType: 'friendly_vc_completion',
          status: 'error',
          model: DEFAULT_MODEL,
          metadata: {
            message: error.message,
            providerStatus: error.status,
            agentSlug,
            userEmail,
          },
        });
      }
      return NextResponse.json(
        { error: error.message, providerStatus: error.status },
        { status: error.status || 502 }
      );
    }

    if (conversationId) {
      await logAiEvent({
        requestId: `unexpected-${Date.now()}`,
        userId: null,
        conversationId,
        eventType: 'friendly_vc_completion',
        status: 'error',
        model: DEFAULT_MODEL,
        metadata: {
          message: error?.message || 'Unexpected error',
          agentSlug,
          userEmail,
        },
      });
    }

    console.error('[Friendly VC] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
