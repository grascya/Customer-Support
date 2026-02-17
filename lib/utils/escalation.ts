// lib/utils/escalation.ts
import { supabaseAdmin } from '@/lib/supabase/server';
import { Resend } from 'resend';
import { createFreshdeskTicket } from '@/lib/integrations/freshdesk';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type EscalationReason = 
  | 'explicit_request' 
  | 'negative_sentiment' 
  | 'repeated_query'
  | 'bot_failure';

export interface EscalationTrigger {
  shouldEscalate: boolean;
  reason?: EscalationReason;
  confidence: number;
}

function checkExplicitRequest(message: string): boolean {
  const keywords = [
    'human', 'agent', 'person', 'representative', 'support',
    'speak to someone', 'talk to someone', 'real person',
    'customer service', 'escalate', 'manager', 'supervisor',
    'connect me', 'transfer me', 'live agent', 'live person'
  ];
  const lowerMessage = message.toLowerCase();
  const found = keywords.some(keyword => lowerMessage.includes(keyword));
  if (found) console.log(`🔍 Explicit escalation request detected`);
  return found;
}

async function checkNegativeSentiment(conversationId: string): Promise<boolean> {
  try {
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(3);

    if (!recentMessages || recentMessages.length < 2) return false;

    const negativeCounts = recentMessages.filter(
      msg => msg.metadata?.sentiment === 'negative'
    ).length;

    const isNegative = negativeCounts >= 3;
    if (isNegative) console.log(`🔍 Negative sentiment pattern: ${negativeCounts}/3`);
    return isNegative;
  } catch {
    return false;
  }
}

async function checkRepeatedQuery(conversationId: string, currentMessage: string): Promise<boolean> {
  try {
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(6);

    if (!recentMessages || recentMessages.length < 4) return false;

    const currentNormalized = currentMessage.toLowerCase().replace(/[?.!,]/g, '').trim();
    const currentWords = currentNormalized.split(/\s+/).filter(w => w.length > 3);
    if (currentWords.length < 3) return false;

    let exactMatchCount = 0;
    let highSimilarityCount = 0;

    for (const msg of recentMessages.slice(1)) {
      const msgNormalized = msg.content.toLowerCase().replace(/[?.!,]/g, '').trim();
      if (msgNormalized === currentNormalized) { exactMatchCount++; continue; }

      const msgWords = msgNormalized.split(/\s+/).filter(w => w.length > 3);
      const commonWords = currentWords.filter(word => msgWords.includes(word));
      const similarity = commonWords.length / Math.max(currentWords.length, msgWords.length);
      if (similarity > 0.8) highSimilarityCount++;
    }

    const isRepeated = exactMatchCount >= 2 || highSimilarityCount >= 3;
    if (!isRepeated) console.log(`✅ No repetition: ${exactMatchCount} exact, ${highSimilarityCount} similar`);
    return isRepeated;
  } catch {
    return false;
  }
}

/**
 * Checks if a conversation should be escalated to a human support agent.
 * It checks for three triggers: explicit request, negative sentiment, and repeated query.
 * If any of the triggers are true, it returns a promise with the trigger details.
 * If no triggers are true, it returns a promise with a false shouldEscalate value.
 * @param {string} conversationId - The ID of the conversation to check.
 * @param {string} userMessage - The user's message to check for triggers.
 * @returns {Promise<EscalationTrigger>} - A promise that resolves with the escalation trigger details.
 */
export async function shouldEscalateToHuman(
  conversationId: string,
  userMessage: string
): Promise<EscalationTrigger> {
  console.log(`🔍 Checking escalation for conversation ${conversationId}`);

  if (checkExplicitRequest(userMessage)) {
    return { shouldEscalate: true, reason: 'explicit_request', confidence: 1.0 };
  }

  const hasNegativeSentiment = await checkNegativeSentiment(conversationId);
  if (hasNegativeSentiment) {
    return { shouldEscalate: true, reason: 'negative_sentiment', confidence: 0.9 };
  }

  const hasRepeatedQuery = await checkRepeatedQuery(conversationId, userMessage);
  if (hasRepeatedQuery) {
    return { shouldEscalate: true, reason: 'repeated_query', confidence: 0.85 };
  }

  console.log('✅ No escalation triggers');
  return { shouldEscalate: false, confidence: 0 };
}


/**
 * Sends an internal notification to the support team via Resend.
 * This function is used when a conversation is escalated to a human support agent.
 * It sends a notification email with the conversation details and a link to the Freshdesk ticket.
 * @param {string} conversationId - The ID of the conversation to send a notification for.
 * @param {string} sessionId - The ID of the session to send a notification for.
 * @param {EscalationReason} reason - The reason why the conversation was escalated.
 * @param {number} freshdeskTicketId - The ID of the Freshdesk ticket associated with the conversation.
 * @returns {Promise<void>} - A promise that resolves when the notification is sent successfully.
 */
async function sendInternalNotification(
  conversationId: string,
  sessionId: string,
  reason: EscalationReason,
  freshdeskTicketId?: number
): Promise<void> {
  if (!resend || !process.env.SUPPORT_EMAIL) return;

  try {
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentMessages = messages?.reverse() || [];
    const ticketLink = freshdeskTicketId
      ? `https://${process.env.FRESHDESK_DOMAIN}/a/tickets/${freshdeskTicketId}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/admin/conversation/${conversationId}`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Lumino Bot <onboarding@resend.dev>',
      to: [process.env.SUPPORT_EMAIL],
      subject: `🚨 New Escalation${freshdeskTicketId ? ` - Ticket #${freshdeskTicketId}` : ''}: ${reason.replace('_', ' ')}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9fafb; }
            .notice { background: #dbeafe; border: 1px solid #3b82f6; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #1e40af; }
            .message { background: white; padding: 12px; margin: 8px 0; border-left: 3px solid #e5e7eb; border-radius: 4px; }
            .message.user { border-left-color: #f97316; }
            .message.assistant { border-left-color: #6b7280; }
            .metadata { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .cta { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 5px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">🚨 New Escalation - Support Needed</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">A customer needs your help via live chat</p>
          </div>
          <div class="content">
            <div class="notice">
              💬 <strong>Important:</strong> Your reply in Freshdesk will appear <strong>live in the customer's chatbot</strong> within seconds. The customer is NOT receiving emails - all communication happens in the chatbot.
            </div>
            <div class="metadata">
              <p><strong>Reason:</strong> ${reason.replace(/_/g, ' ').toUpperCase()}</p>
              ${freshdeskTicketId ? `<p><strong>Freshdesk Ticket:</strong> #${freshdeskTicketId}</p>` : ''}
              <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
              <p><strong>Conversation ID:</strong> <code>${conversationId}</code></p>
              <p><strong>Escalated:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <h3>Recent Conversation:</h3>
            ${recentMessages.map(msg => `
              <div class="message ${msg.role}">
                <strong style="color: ${msg.role === 'user' ? '#f97316' : '#6b7280'};">
                  ${msg.role === 'user' ? '👤 Customer' : '🤖 Bot'}:
                </strong>
                <p style="margin: 5px 0 0 0;">${msg.content}</p>
                <small style="color: #9ca3af;">${new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            `).join('')}
            <a href="${ticketLink}" class="cta">
              ${freshdeskTicketId ? 'Reply in Freshdesk (appears in chatbot) →' : 'View in Admin Dashboard →'}
            </a>
          </div>
          <div class="footer">
            <p>Lumino Support • Internal Notification • Customer sees replies in chatbot only</p>
          </div>
        </body>
        </html>
      `,
    });
    console.log(`📧 Internal notification sent to support team`);
  } catch (error) {
    console.error('❌ Failed to send internal notification:', error);
  }
}

export async function escalateConversation(
  conversationId: string,
  reason: EscalationReason
): Promise<void> {
  try {
    // Guard: don't escalate if already escalated
    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('status, session_id, metadata')
      .eq('id', conversationId)
      .single();

    if (existing?.status === 'escalated') {
      console.log('⚠️ Already escalated — skipping duplicate');
      return;
    }

    // Get recent messages for ticket
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10);

    const conversationText = recentMessages
      ?.map(m => `${m.role === 'user' ? '👤 Customer' : '🤖 Bot'}: ${m.content}`)
      .join('\n\n') || 'No messages';

    // Create Freshdesk ticket
    let freshdeskTicketId: number | undefined;
    let freshdeskTicketUrl: string | undefined;

    if (process.env.FRESHDESK_DOMAIN && process.env.FRESHDESK_API_KEY) {
      try {
        const ticket = await createFreshdeskTicket({
          subject: `[Live Chat] ${reason.replace(/_/g, ' ')}`,
          description: `
<h3>⚡ Live Chat Escalation</h3>
<p><strong>⚠️ IMPORTANT:</strong> Customer is chatting live. Your reply will appear in their chatbot within seconds.</p>
<p><strong>Customer Email:</strong> Anonymous (chatbot-only communication)</p>

<h3>Escalation Details</h3>
<p><strong>Reason:</strong> ${reason.replace(/_/g, ' ')}</p>
<p><strong>Conversation ID:</strong> ${conversationId}</p>
<p><strong>Time:</strong> ${new Date().toLocaleString()}</p>

<h3>Conversation History</h3>
<pre>${conversationText}</pre>

<h3>Admin Dashboard</h3>
<a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/conversation/${conversationId}">View Full Conversation</a>

<hr>
<p style="color: #3b82f6;"><strong>💡 How to respond:</strong></p>
<ol>
  <li>Reply to this ticket normally</li>
  <li>Your message appears in the customer's chatbot automatically</li>
  <li>Customer can reply back through the chatbot</li>
  <li>Mark ticket as Resolved when done</li>
</ol>
          `.trim(),
          email: process.env.FRESHDESK_EMAIL!, // Your email (mantinetidatoa@gmail.com)
          priority: reason === 'explicit_request' ? 3 : 2,
          status: 2, // Open
          tags: ['chatbot', 'live-chat', 'escalation', reason],
        });
        
        freshdeskTicketId = ticket.id;
        freshdeskTicketUrl = `https://${process.env.FRESHDESK_DOMAIN}/a/tickets/${ticket.id}`;
        console.log(`🎫 Freshdesk ticket #${freshdeskTicketId} created (assigned to ${process.env.FRESHDESK_EMAIL})`);
      } catch (err) {
        console.error('⚠️ Freshdesk ticket creation failed:', err);
      }
    }

    // Update conversation
    await supabaseAdmin
      .from('conversations')
      .update({
        status: 'escalated',
        metadata: {
          ...(existing?.metadata || {}),
          escalation_reason: reason,
          escalated_at: new Date().toISOString(),
          freshdesk_ticket_id: freshdeskTicketId,
          freshdesk_ticket_url: freshdeskTicketUrl,
          communication_channel: 'chatbot_only', // Mark as chatbot-only
        },
      })
      .eq('id', conversationId);

    // Track analytics
    await supabaseAdmin
      .from('chat_analytics')
      .insert({
        conversation_id: conversationId,
        event_type: 'escalated',
        event_data: { reason, freshdesk_ticket_id: freshdeskTicketId },
      })
      .then(({ error }) => { if (error) console.error('Analytics error:', error); });

    // Send internal notification only (no customer email)
    if (existing) {
      await sendInternalNotification(
        conversationId, 
        existing.session_id, 
        reason, 
        freshdeskTicketId
      );
    }

    console.log(`🚨 Conversation ${conversationId} escalated: ${reason}`);
  } catch (error) {
    console.error('Error in escalateConversation:', error);
    throw error;
  }
}