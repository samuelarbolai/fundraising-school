import { NextResponse } from 'next/server';
import { FriendlyVcError, listConversations, requireAuthUser } from '@/lib/friendlyVc/service';

export async function GET(request) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(request.url);
    const agentSlug = searchParams.get('agent');
    const rows = await listConversations(user.id, agentSlug || undefined);
    const conversations = rows.map(conversation => ({
      id: conversation.id,
      title: conversation.title,
      promptVersion: conversation.promptVersion,
      agentSlug: conversation.agentSlug,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastInteractedAt: conversation.lastInteractedAt,
    }));
    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 500 });
    }
    console.error('[Friendly VC] conversations list error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
