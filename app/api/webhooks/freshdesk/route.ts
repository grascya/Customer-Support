// app/api/webhooks/freshdesk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import axios from 'axios';

/**
 * Freshdesk sends a webhook when an agent replies to a ticket.
 * We save that reply as an 'agent' message in our messages table,
 * so the chatbot can poll and display it to the customer.
 *
 * Setup in Freshdesk:
 *   Admin → Workflows → Automations → New Automation
 *   Trigger: "Reply sent by Agent"
 *   Action: Webhook → POST → https://yourdomain.com/api/webhooks/freshdesk
 *   Body: JSON (see docs in FRESHDESK-LIVE-REPLIES.md)
 */
export async function POST(req: NextRequest) {
  try {
    // Optional: verify secret
    const secret = req.headers.get('x-freshdesk-secret');
    if (process.env.FRESHDESK_WEBHOOK_SECRET && secret !== process.env.FRESHDESK_WEBHOOK_SECRET) {
      console.warn('⚠️ Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('📬 Freshdesk webhook received:', JSON.stringify(body).substring(0, 300));

    const ticketId = body.ticket_id || body.freshdesk_ticket_id;
    let agentReply = body.reply_body || body.note_body || body.content || body.body;
    let agentName = body.agent_name || body.user_name || 'Support Agent';

    // If reply_body is empty, fetch from Freshdesk API
    if (!agentReply && ticketId) {
      console.log('⚠️ Empty reply_body, fetching from Freshdesk API...');
      
      try {
        // Fetch ticket details to get latest note/comment
        const response = await axios.get(
          `https://${process.env.FRESHDESK_DOMAIN}/api/v2/tickets/${ticketId}`,
          {
            auth: {
              username: process.env.FRESHDESK_API_KEY!,
              password: 'X',
            },
          }
        );

        const ticket = response.data;
        
        // Try to get the latest note
        const notesResponse = await axios.get(
          `https://${process.env.FRESHDESK_DOMAIN}/api/v2/tickets/${ticketId}/conversations`,
          {
            auth: {
              username: process.env.FRESHDESK_API_KEY!,
              password: 'X',
            },
          }
        );

        const conversations = notesResponse.data;
        if (conversations && conversations.length > 0) {
          // Get the most recent conversation
          const latestConv = conversations[conversations.length - 1];
          agentReply = latestConv.body_text || latestConv.body;
          agentName = latestConv.user?.name || latestConv.from_email || 'Support Agent';
          
          console.log(`✅ Fetched from API: "${agentReply?.substring(0, 50)}..."`);
        }
      } catch (apiError: any) {
        console.error('❌ Failed to fetch from Freshdesk API:', apiError.message);
      }
    }

    if (!ticketId || !agentReply) {
      console.warn('⚠️ Missing ticket_id or reply body');
      console.log('Body received:', body);
      return NextResponse.json({ 
        error: 'Missing required fields',
        received: { ticketId, agentReply, agentName }
      }, { status: 400 });
    }

    // Strip HTML tags from Freshdesk reply
    const cleanReply = agentReply
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Find the conversation linked to this Freshdesk ticket
    const { data: conversations, error: findError } = await supabaseAdmin
      .from('conversations')
      .select('id, status, session_id, metadata')
      .filter('metadata->>freshdesk_ticket_id', 'eq', String(ticketId));

    if (findError) {
      console.error('❌ Error finding conversation:', findError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      console.warn(`⚠️ No conversation found for Freshdesk ticket #${ticketId}`);
      return NextResponse.json({ 
        error: 'Conversation not found',
        ticket_id: ticketId,
        hint: 'Make sure the ticket was created via escalation and has freshdesk_ticket_id in metadata'
      }, { status: 404 });
    }

    const conversation = conversations[0];
    console.log(`✅ Found conversation ${conversation.id} for ticket #${ticketId}`);

    // Save agent reply as a message
    const { data: savedMessage, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'agent',
        content: cleanReply,
        metadata: {
          agent_name: agentName,
          freshdesk_ticket_id: ticketId,
          source: body.source || 'freshdesk',
          received_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error('❌ Error saving agent message:', msgError);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    console.log(`💬 Agent reply saved as message ${savedMessage.id}`);

    // Check if ticket is being resolved/closed
    const ticketStatus = body.ticket_status || body.status;
    if (ticketStatus === 'Resolved' || ticketStatus === 'Closed' || ticketStatus === '4' || ticketStatus === '5' || body.is_resolved === true) {
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'resolved',
          metadata: {
            ...conversation.metadata,
            resolved_at: new Date().toISOString(),
            resolved_via: 'freshdesk',
          },
        })
        .eq('id', conversation.id);

      console.log(`✅ Conversation ${conversation.id} marked as resolved`);
    }

    return NextResponse.json({
      success: true,
      message_id: savedMessage.id,
      conversation_id: conversation.id,
    });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


























































































