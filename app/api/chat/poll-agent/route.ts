// app/api/chat/poll-agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';


/**
 * Poll for new agent messages in an escalated conversation.
 * Returns the latest agent messages after the given 'after' timestamp.
 * If 'after' is not provided, returns all agent messages.
 *
 * @param {NextRequest} req
 * @returns {NextResponse} JSON response with the following fields:
 *  hasNewMessages: boolean indicating if there are new messages
 *  isResolved: boolean indicating if the conversation is resolved
 *  conversationId: string - the ID of the escalated conversation
 *  messages: array of objects containing the agent message data
 * @throws {Error} with a 500 status code if there is a database error
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const after = searchParams.get('after'); // ISO timestamp - only return messages after this

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Find the escalated conversation for this session
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, status, metadata')
      .eq('session_id', sessionId)
      .in('status', ['escalated', 'resolved'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (convError || !conversation) {
      return NextResponse.json({ 
        hasNewMessages: false,
        isResolved: false,
        messages: [] 
      });
    }

    // Query for agent messages newer than 'after'
    let query = supabaseAdmin
      .from('messages')
      .select('id, role, content, created_at, metadata')
      .eq('conversation_id', conversation.id)
      .eq('role', 'agent')
      .order('created_at', { ascending: true });

    if (after) {
      query = query.gt('created_at', after);
    }

    const { data: agentMessages, error: msgError } = await query;

    if (msgError) {
      console.error('Error polling for messages:', msgError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      hasNewMessages: (agentMessages?.length || 0) > 0,
      isResolved: conversation.status === 'resolved',
      conversationId: conversation.id,
      messages: agentMessages || [],
    });

  } catch (error: any) {
    console.error('Poll agent error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}