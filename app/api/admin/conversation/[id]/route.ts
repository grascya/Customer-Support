// app/api/admin/conversation/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Type is a Promise in Next.js 15
) {
  try {
    // 1. Unwrapping params (The fix for your Error)
    const resolvedParams = await params;
    const conversationId = resolvedParams.id;

    // 2. Fetch conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 3. Fetch all messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgError) {
      return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
    }

    // 4. Fetch feedback
    const messageIds = messages?.map(m => m.id) || [];
    const { data: feedbacks } = await supabaseAdmin
      .from('message_feedback')
      .select('*')
      .in('message_id', messageIds);

    const feedbackMap = new Map();
    feedbacks?.forEach(fb => {
      feedbackMap.set(fb.message_id, fb.rating);
    });

    const messagesWithFeedback = messages?.map(msg => ({
      ...msg,
      feedback: feedbackMap.get(msg.id) || null,
    })) || [];

    return NextResponse.json({
      conversation,
      messages: messagesWithFeedback,
    });
  } catch (error: any) {
    console.error('❌ Error in conversation detail:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}