import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { prompts, agents } from '@/lib/db/schema';
import { getAdminContext } from '@/lib/admin/auth';
import { logAiEvent } from '@/lib/friendlyVc/service';

const DEFAULT_AGENT_SLUG = 'sales-coach';

const AGENT_DEFAULTS = {
  'sales-coach': {
    name: 'Sales Coach',
    description: 'Brutally honest sales coach (Sebas) who diagnoses founder sales fundamentals.',
  },
  'friendly-vc-analyst': {
    name: 'Friendly VC Analyst',
    description: 'Friendly VC analyst who screens startups for 30x Venture Capital due diligence.',
  },
};

async function ensureAgentExists(slug) {
  const defaults = AGENT_DEFAULTS[slug] || { name: slug, description: null };
  await db
    .insert(agents)
    .values({ slug, name: defaults.name, description: defaults.description })
    .onConflictDoNothing();
}

export async function GET(request) {
  const context = await getAdminContext();
  if (context.error) {
    return NextResponse.json({ error: context.error.message }, { status: context.error.status });
  }

  const { searchParams } = new URL(request.url);
  const requestedAgent = (searchParams.get('agent') || DEFAULT_AGENT_SLUG).toLowerCase();

  await Promise.all(Object.keys(AGENT_DEFAULTS).map(ensureAgentExists));

  const agentList = await db.select().from(agents).orderBy(desc(agents.createdAt));
  const activeAgent = agentList.find(item => item.slug === requestedAgent) ? requestedAgent : DEFAULT_AGENT_SLUG;

  const records = await db
    .select()
    .from(prompts)
    .where(eq(prompts.agentSlug, activeAgent))
    .orderBy(desc(prompts.createdAt));

  return NextResponse.json({
    prompts: records,
    currentPrompt: records[0] || null,
    isSuperAdmin: context.isSuperAdmin,
    agents: agentList,
    agentSlug: activeAgent,
  });
}

export async function POST(request) {
  const context = await getAdminContext();
  if (context.error) {
    return NextResponse.json({ error: context.error.message }, { status: context.error.status });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const agentSlug = (payload?.agentSlug || DEFAULT_AGENT_SLUG).toLowerCase();
  const version = (payload?.version || '').trim();
  const content = (payload?.content || '').trim();

  await ensureAgentExists(agentSlug);

  if (!version) {
    return NextResponse.json({ error: 'Version is required.' }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: 'Prompt content is required.' }, { status: 400 });
  }

  const existing = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.agentSlug, agentSlug), eq(prompts.version, version)))
    .limit(1);

  if (existing.length) {
    return NextResponse.json({ error: 'A prompt with that version already exists.' }, { status: 409 });
  }

  const [row] = await db
    .insert(prompts)
    .values({
      agentSlug,
      version,
      content,
      createdBy: context.user.id,
      createdByEmail: context.email,
    })
    .returning();

  await logAiEvent({
    requestId: randomUUID(),
    userId: context.user.id,
    conversationId: null,
    eventType: 'prompt_created',
    status: 'success',
    model: null,
    tokenUsage: null,
    latencyMs: null,
    metadata: {
      version,
      agentSlug,
    },
  });

  return NextResponse.json({ prompt: row }, { status: 201 });
}
