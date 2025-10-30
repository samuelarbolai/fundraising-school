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
  requireAuthUser,
  updateConversationMeta,
  getNextMessageSequence,
  getLatestPrompt,
  recordAgentOutput,
} from '@/lib/friendlyVc/service';
import { streamChatCompletion, OpenAIRequestError } from '@/lib/friendlyVc/openaiClient';

const DEFAULT_MODEL = process.env.OPENAI_FRIENDLY_VC_MODEL || 'gpt-4o-mini';
const DEFAULT_PROMPT_VERSION = process.env.FRIENDLY_VC_PROMPT_VERSION || 'v1';
const DEFAULT_AGENT_SLUG = 'sales-coach';

const FALLBACK_PROMPTS = {
  'sales-coach': friendlyVcSystemPrompt,
  'friendly-vc-analyst': `You are the Friendly VC Analyst for the 30x Venture Capital fund. Evaluate startups, assign a fit label (Strong fit | Promising | Monitor | Not a fit), surface key traction metrics, risks, and recommend warm intros to VCs or portfolio operators. Respond in crisp markdown with sections: Fit, Why it matters, Metrics & proof, Risks, 30x next steps, Warm intros. Keep it factual and actionable.`,
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
  let user = null;
  let conversationId;
  let agentSlug = DEFAULT_AGENT_SLUG;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { conversationId: incomingConversationId, content, agentSlug: rawAgentSlug } = payload || {};

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
    user = await requireAuthUser();
    await enforceRateLimit({ userId: user.id });

    agentSlug = (rawAgentSlug || DEFAULT_AGENT_SLUG).toLowerCase();

    const latestPrompt = await getLatestPrompt(agentSlug);
    const fallbackPrompt = FALLBACK_PROMPTS[agentSlug] || friendlyVcSystemPrompt;
    const promptVersion = latestPrompt?.version || DEFAULT_PROMPT_VERSION;
    const systemPrompt = latestPrompt?.content || fallbackPrompt;

    let conversation = null;
    if (incomingConversationId) {
      conversation = await getConversationById(user.id, incomingConversationId);
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
        userId: user.id,
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
      userId: user.id,
      conversationId,
      eventType: 'friendly_vc_stream',
      status: 'open',
      model: DEFAULT_MODEL,
      metadata: {
        promptVersion,
        messageLength: trimmedContent.length,
        agentSlug,
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
        });

        await updateConversationMeta(conversationId, {
          lastInteractedAt: new Date(),
        });

        await logAiEvent({
          requestId: completion.requestId,
          userId: user.id,
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
          },
        });

        if (agentSlug === 'friendly-vc-analyst') {
          const fitMatch = /fit\s*[:\-]\s*(.+)/i.exec(result.content);
          const fitLabel = fitMatch ? fitMatch[1].split('\n')[0].trim() : null;
          await recordAgentOutput({
            conversationId,
            agentSlug,
            summary: result.content,
            fitLabel,
            metadata: result.usage ?? null,
          });
        }
      })
      .catch(async error => {
        await logAiEvent({
          requestId: completion.requestId,
          userId: user.id,
          conversationId,
          eventType: 'friendly_vc_completion',
          status: 'error',
          model: DEFAULT_MODEL,
          metadata: {
            message: error?.message || 'Stream cancelled',
            agentSlug,
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
      if (user?.id && conversationId) {
        await logAiEvent({
          requestId: error.body?.id || `error-${Date.now()}`,
          userId: user.id,
          conversationId,
          eventType: 'friendly_vc_completion',
          status: 'error',
          model: DEFAULT_MODEL,
          metadata: {
            message: error.message,
            providerStatus: error.status,
            agentSlug,
          },
        });
      }
      return NextResponse.json(
        { error: error.message, providerStatus: error.status },
        { status: error.status || 502 }
      );
    }

    if (user?.id && conversationId) {
      await logAiEvent({
        requestId: `unexpected-${Date.now()}`,
        userId: user.id,
        conversationId,
        eventType: 'friendly_vc_completion',
        status: 'error',
        model: DEFAULT_MODEL,
        metadata: {
          message: error?.message || 'Unexpected error',
          agentSlug,
        },
      });
    }

    console.error('[Friendly VC] Unexpected error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
