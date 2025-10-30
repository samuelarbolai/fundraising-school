import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { agentOutputs, messages } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { FriendlyVcError, logAiEvent } from '@/lib/friendlyVc/service';
import { evaluateFriendlyAnalystSummary } from '@/lib/friendlyVc/evaluator';
import { normalizeEvaluationResult } from '@/lib/friendlyVc/evaluationUtils';

async function getConversationMessages(conversationId) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
  return rows.map(row => ({ role: row.role, content: row.content }));
}

export async function PATCH(request, { params }) {
  try {
    const { connectors, fitLabel, founderEmail, founderPhone, founderName, companyName } = await request.json();

    await db
      .update(agentOutputs)
      .set({
        connectors: connectors ?? null,
        fitLabel: fitLabel ?? null,
        founderEmail: founderEmail ?? null,
        founderPhone: founderPhone ?? null,
        founderName: founderName ?? null,
        companyName: companyName ?? null,
      })
      .where(eq(agentOutputs.id, params.outputId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
    console.error('[Agent Outputs] patch error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const promptOverride = typeof body?.promptOverride === 'string' ? body.promptOverride : '';

    const [output] = await db
      .select()
      .from(agentOutputs)
      .where(eq(agentOutputs.id, params.outputId))
      .limit(1);

    if (!output) {
      return NextResponse.json({ error: 'Output not found.' }, { status: 404 });
    }

    if (!output.conversationId) {
      return NextResponse.json({ error: 'Conversation missing for this output.' }, { status: 400 });
    }

    const conversationMessages = await getConversationMessages(output.conversationId);
    const evaluation = await evaluateFriendlyAnalystSummary({ conversationMessages, promptOverride });
    const normalized = normalizeEvaluationResult(evaluation, { fallbackSummary: output.summary });

    await db
      .update(agentOutputs)
      .set({
        summary: normalized.summary || output.summary,
        fitLabel: normalized.fitLabel || output.fitLabel,
        companyName: normalized.companyName || output.companyName,
        founderName: normalized.founderName || output.founderName,
        founderEmail: normalized.founderEmail || output.founderEmail,
        founderPhone: normalized.founderPhone || output.founderPhone,
        connectors: normalized.connectorsText || output.connectors,
        metadata: {
          ...(output.metadata || {}),
          lastRebuild: new Date().toISOString(),
          evaluation,
          normalized,
        },
      })
      .where(eq(agentOutputs.id, params.outputId));

    await logAiEvent({
      requestId: params.outputId,
      userId: null,
      conversationId: output.conversationId,
      eventType: 'friendly_vc_evaluation',
      status: 'success',
      model: 'rebuild',
      metadata: {
        agentSlug: output.agentSlug,
        mode: 'manual-sidebar',
      },
    });

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 500 });
    }
    console.error('[Agent Outputs] reevaluate error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
