import { sql, and, asc, desc, eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { aiEvents, conversations, messages, prompts, agentOutputs } from '@/lib/db/schema';

const USER_HOURLY_LIMIT = 100;
const USER_BURST_LIMIT = 25;
const GLOBAL_HOURLY_LIMIT = 1250;

export class FriendlyVcError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'FriendlyVcError';
    if (options.status) this.status = options.status;
    if (options.code) this.code = options.code;
    if (options.retryAfter) this.retryAfter = options.retryAfter;
    if (options.bucket) this.bucket = options.bucket;
  }
}

export async function requireAuthUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new FriendlyVcError('Unauthorized', { status: 401, code: 'unauthorized' });
  }
  return data.user;
}

export async function listConversations(userId, agentSlug) {
  let condition = eq(conversations.userId, userId);
  if (agentSlug) {
    condition = and(condition, eq(conversations.agentSlug, agentSlug));
  }

  return db
    .select()
    .from(conversations)
    .where(condition)
    .orderBy(
      desc(conversations.lastInteractedAt),
      desc(conversations.updatedAt),
      desc(conversations.createdAt)
    );
}

export async function getConversationById(userId, conversationId) {
  const condition = userId
    ? and(eq(conversations.id, conversationId), eq(conversations.userId, userId))
    : eq(conversations.id, conversationId);

  const rows = await db
    .select()
    .from(conversations)
    .where(condition)
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteConversationById(userId, conversationId) {
  await db.transaction(async tx => {
    await tx.delete(messages).where(eq(messages.conversationId, conversationId));
    await tx.delete(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  });
}

export async function createConversation({ userId, promptVersion = 'v1', title, agentSlug }) {
  const [row] = await db
    .insert(conversations)
    .values({ userId, promptVersion, title, agentSlug })
    .returning();
  return row;
}

export async function updateConversationMeta(conversationId, patch) {
  await db
    .update(conversations)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(conversations.id, conversationId));
}

export async function getMessagesForConversation(conversationId) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sequence), asc(messages.createdAt));
}

export async function getNextMessageSequence(conversationId) {
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(sequence), 0) AS max_sequence
    FROM messages
    WHERE conversation_id = ${conversationId}
  `);
  const value = result?.rows?.[0]?.max_sequence ?? 0;
  return Number(value) + 1;
}

export async function insertMessage(entry) {
  const record = {
    conversationId: entry.conversationId,
    role: entry.role,
    content: entry.content,
    sequence: entry.sequence,
    model: entry.model ?? null,
    tokenUsage: entry.tokenUsage ?? null,
    latencyMs: entry.latencyMs ?? null,
    metadata: entry.metadata ?? null,
  };
  await db.insert(messages).values(record);
}

export async function logAiEvent(event) {
  await db.insert(aiEvents).values({
    requestId: event.requestId,
    userId: event.userId ?? null,
    conversationId: event.conversationId ?? null,
    eventType: event.eventType,
    status: event.status,
    model: event.model ?? null,
    latencyMs: event.latencyMs ?? null,
    tokenUsage: event.tokenUsage ?? null,
    metadata: event.metadata ?? null,
  });
}

export async function enforceRateLimit({ userId }) {
  if (userId) {
    const hourlyResult = await db.execute(sql`
      SELECT COUNT(*) AS count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
        AND m.role = 'assistant'
        AND m.created_at >= now() - interval '1 hour'
    `);

    const hourCount = Number(hourlyResult?.rows?.[0]?.count ?? 0);
    if (hourCount >= USER_HOURLY_LIMIT) {
      throw new FriendlyVcError('Hourly limit reached', {
        status: 429,
        code: 'rate_limit_hourly',
        retryAfter: 3600,
        bucket: 'user_hourly',
      });
    }

    const burstResult = await db.execute(sql`
      SELECT COUNT(*) AS count
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
        AND m.role = 'assistant'
        AND m.created_at >= now() - interval '2 minutes'
    `);

    const burstCount = Number(burstResult?.rows?.[0]?.count ?? 0);
    if (burstCount >= USER_BURST_LIMIT) {
      throw new FriendlyVcError('Too many requests', {
        status: 429,
        code: 'rate_limit_burst',
        retryAfter: 120,
        bucket: 'user_burst',
      });
    }
  }

  const globalResult = await db.execute(sql`
    SELECT COUNT(*) AS count
    FROM messages
    WHERE role = 'assistant'
      AND created_at >= now() - interval '1 hour'
  `);

  const globalCount = Number(globalResult?.rows?.[0]?.count ?? 0);
  if (globalCount >= GLOBAL_HOURLY_LIMIT) {
    throw new FriendlyVcError('Sebas is at capacity', {
      status: 429,
      code: 'rate_limit_global',
      retryAfter: 3600,
      bucket: 'global_hourly',
    });
  }
}

export function deriveConversationTitle(content) {
  if (!content) return null;
  const candidate = content.trim().replace(/\s+/g, ' ');
  return candidate.slice(0, 80);
}

export async function getLatestPrompt(agentSlug) {
  const rows = await db
    .select()
    .from(prompts)
    .where(eq(prompts.agentSlug, agentSlug))
    .orderBy(desc(prompts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function recordAgentOutput({ conversationId, agentSlug, summary, fitLabel, companyName, founderName, founderEmail, founderPhone, connectors, metadata }) {
  if (!conversationId) return;
  await db.delete(agentOutputs).where(eq(agentOutputs.conversationId, conversationId));
  await db.insert(agentOutputs).values({
    conversationId,
    agentSlug,
    summary,
    fitLabel,
    companyName: companyName ?? null,
    founderName: founderName ?? null,
    founderEmail: founderEmail ?? null,
    founderPhone: founderPhone ?? null,
    connectors: connectors ?? null,
    metadata: metadata ?? null,
  });
}
