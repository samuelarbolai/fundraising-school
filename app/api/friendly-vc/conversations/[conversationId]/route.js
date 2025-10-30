import { NextResponse } from 'next/server';
import {
  FriendlyVcError,
  deleteConversationById,
  getConversationById,
  getMessagesForConversation,
  requireAuthUser,
} from '@/lib/friendlyVc/service';

export async function GET(request, { params }) {
  const { conversationId } = params;
  try {
    const user = await requireAuthUser();
    const conversation = await getConversationById(user.id, conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    const records = await getMessagesForConversation(conversationId);
    const messages = records.map(record => ({
      id: record.id,
      role: record.role,
      content: record.content,
      sequence: record.sequence,
      model: record.model,
      tokenUsage: record.tokenUsage,
      latencyMs: record.latencyMs,
      metadata: record.metadata,
      createdAt: record.createdAt,
    }));
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        promptVersion: conversation.promptVersion,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        lastInteractedAt: conversation.lastInteractedAt,
        agentSlug: conversation.agentSlug,
      },
      messages,
    });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 500 });
    }
    console.error('[Friendly VC] conversation fetch error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { conversationId } = params;
  try {
    const user = await requireAuthUser();
    const existing = await getConversationById(user.id, conversationId);
    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    await deleteConversationById(user.id, conversationId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof FriendlyVcError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status || 500 });
    }
    console.error('[Friendly VC] conversation delete error', error);
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
