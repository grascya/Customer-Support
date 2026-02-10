// lib/utils/escalation.ts

import { supabaseAdmin } from '@/lib/supabase/server';
import { Resend } from 'resend';

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

/**
 * Check if user explicitly requested human help
 */
function checkExplicitRequest(message: string): boolean {
  const keywords = [
    'human', 'agent', 'person', 'representative', 'support',
    'speak to someone', 'talk to someone', 'real person',
    'customer service', 'escalate', 'manager', 'supervisor',
    'connect me', 'transfer me', 'live agent', 'live person'
  ];

  const lowerMessage = message.toLowerCase();
  const found = keywords.some(keyword => lowerMessage.includes(keyword));
  
  if (found) {
    console.log(`🔍 Explicit escalation request detected in: "${message.substring(0, 50)}..."`);
  }
  
  return found;
}

/**
 * Check if recent conversation shows frustration
 */
async function checkNegativeSentiment(conversationId: string): Promise<boolean> {
  try {
    const { data: recentMessages, error } = await supabaseAdmin
      .from('messages')
      .select('metadata')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('Error fetching messages for sentiment check:', error);
      return false;
    }

    if (!recentMessages || recentMessages.length < 2) {
      console.log(`⚠️ Not enough messages (${recentMessages?.length || 0}) to check sentiment pattern`);
      return false;
    }

    // Count negative sentiments in last 3 messages
    const negativeCounts = recentMessages.filter(
      msg => msg.metadata?.sentiment === 'negative'
    ).length;

    // eed all 3 to be negative (not just 2)
    const isNegative = negativeCounts >= 3;
    
    if (isNegative) {
      console.log(`🔍 Negative sentiment pattern detected: ${negativeCounts}/3 messages are negative`);
    }

    return isNegative;
  } catch (error) {
    console.error('Error in checkNegativeSentiment:', error);
    return false;
  }
}

/**
 * Check if user is asking THE SAME question repeatedly (bot not helping)
 *  Much stricter - needs high similarity AND multiple attempts
 */
async function checkRepeatedQuery(conversationId: string, currentMessage: string): Promise<boolean> {
  try {
    const { data: recentMessages, error } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(6); // Look at more messages

    if (error) {
      console.error('Error fetching messages for repeated query check:', error);
      return false;
    }

    //  Need at least 4 messages to check for repetition
    if (!recentMessages || recentMessages.length < 4) {
      console.log(`⚠️ Not enough messages (${recentMessages?.length || 0}) to check for repetition`);
      return false;
    }

    // Normalize current message
    const currentNormalized = currentMessage
      .toLowerCase()
      .replace(/[?.!,]/g, '')
      .trim();
    
    const currentWords = currentNormalized.split(/\s+/).filter(w => w.length > 3);
    
    if (currentWords.length < 3) {
      console.log(`⚠️ Message too short to check for repetition`);
      return false;
    }

    let exactMatchCount = 0;
    let highSimilarityCount = 0;

    // Check previous messages (skip first which is current)
    for (const msg of recentMessages.slice(1)) {
      const msgNormalized = msg.content
        .toLowerCase()
        .replace(/[?.!,]/g, '')
        .trim();
      
      // Check for exact match
      if (msgNormalized === currentNormalized) {
        exactMatchCount++;
        console.log(`🔍 EXACT match found: "${msg.content.substring(0, 40)}..."`);
        continue;
      }
      
      // Check for high similarity (>80% word overlap)
      const msgWords = msgNormalized.split(/\s+/).filter(w => w.length > 3);
      const commonWords = currentWords.filter(word => msgWords.includes(word));
      const similarity = commonWords.length / Math.max(currentWords.length, msgWords.length);
      
      if (similarity > 0.8) { // FIXED: Increased from 0.4 to 0.8
        highSimilarityCount++;
        console.log(`🔍 High similarity (${(similarity * 100).toFixed(0)}%) detected: "${msg.content.substring(0, 40)}..."`);
      }
    }

    
    // Need either 2 exact matches OR 3 very similar messages
    const isRepeated = exactMatchCount >= 2 || highSimilarityCount >= 3;
    
    if (isRepeated) {
      console.log(`🔍 Repeated query pattern: ${exactMatchCount} exact matches, ${highSimilarityCount} similar`);
    } else {
      console.log(`✅ No repetition: ${exactMatchCount} exact matches, ${highSimilarityCount} similar (needs 2 exact OR 3 similar)`);
    }

    return isRepeated;
  } catch (error) {
    console.error('Error in checkRepeatedQuery:', error);
    return false;
  }
}

/**
 * Main escalation check function
 */
export async function shouldEscalateToHuman(
  conversationId: string,
  userMessage: string
): Promise<EscalationTrigger> {
  
  console.log(`🔍 Checking escalation triggers for conversation ${conversationId}`);
  
  // 1. Check for explicit request (highest priority)
  if (checkExplicitRequest(userMessage)) {
    console.log('✅ ESCALATION TRIGGERED: Explicit request');
    return {
      shouldEscalate: true,
      reason: 'explicit_request',
      confidence: 1.0,
    };
  }

  // 2. Check for negative sentiment pattern
  const hasNegativeSentiment = await checkNegativeSentiment(conversationId);
  if (hasNegativeSentiment) {
    console.log('✅ ESCALATION TRIGGERED: Negative sentiment pattern');
    return {
      shouldEscalate: true,
      reason: 'negative_sentiment',
      confidence: 0.9,
    };
  }

  // 3. Check for repeated queries
  const hasRepeatedQuery = await checkRepeatedQuery(conversationId, userMessage);
  if (hasRepeatedQuery) {
    console.log('✅ ESCALATION TRIGGERED: Repeated query pattern');
    return {
      shouldEscalate: true,
      reason: 'repeated_query',
      confidence: 0.85,
    };
  }

  console.log('✅ No escalation triggers detected');
  return {
    shouldEscalate: false,
    confidence: 0,
  };
}

/**
 * Send email notification for escalation
 */
async function sendEscalationEmail(
  conversationId: string,
  sessionId: string,
  reason: EscalationReason
): Promise<void> {
  if (!resend || !process.env.SUPPORT_EMAIL) {
    console.warn('⚠️ Resend not configured or SUPPORT_EMAIL not set - skipping email');
    return;
  }

  try {
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentMessages = messages?.reverse() || [];

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || '<onboarding@resend.dev>',
      to: [process.env.SUPPORT_EMAIL],
      subject: `🚨 Escalation Alert: ${reason.replace('_', ' ')}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9fafb; }
            .message { background: white; padding: 12px; margin: 8px 0; border-left: 3px solid #e5e7eb; border-radius: 4px; }
            .message.user { border-left-color: #f97316; }
            .message.bot { border-left-color: #6b7280; }
            .metadata { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
            .cta { display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">🚨 Escalation Alert</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">A customer conversation needs your attention</p>
          </div>
          
          <div class="content">
            <div class="metadata">
              <p><strong>Reason:</strong> ${reason.replace('_', ' ').toUpperCase()}</p>
              <p><strong>Session ID:</strong> <code>${sessionId}</code></p>
              <p><strong>Conversation ID:</strong> <code>${conversationId}</code></p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <h3>Recent Conversation:</h3>
            ${recentMessages.map(msg => `
              <div class="message ${msg.role}">
                <strong style="color: ${msg.role === 'user' ? '#f97316' : '#6b7280'};">
                  ${msg.role === 'user' ? '👤 User' : '🤖 Bot'}:
                </strong>
                <p style="margin: 5px 0 0 0;">${msg.content}</p>
                <small style="color: #9ca3af;">${new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
            `).join('')}

            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/conversation/${conversationId}" class="cta">
              View Full Conversation →
            </a>
          </div>

          <div class="footer">
            <p>Lumino Assistant • Automated Escalation System</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`📧 Escalation email sent to ${process.env.SUPPORT_EMAIL}`);
  } catch (error) {
    console.error('❌ Failed to send escalation email:', error);
  }
}

/**
 * Mark conversation as escalated and send notifications
 */
export async function escalateConversation(
  conversationId: string,
  reason: EscalationReason
): Promise<void> {
  try {
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('session_id')
      .eq('id', conversationId)
      .single();

    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        status: 'escalated',
        metadata: { escalation_reason: reason, escalated_at: new Date().toISOString() },
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation status:', updateError);
      throw updateError;
    }

    const { error: analyticsError } = await supabaseAdmin
      .from('chat_analytics')
      .insert({
        conversation_id: conversationId,
        event_type: 'escalated',
        event_data: { reason },
      });

    if (analyticsError) {
      console.error('Error tracking escalation event:', analyticsError);
    }

    if (conversation) {
      await sendEscalationEmail(conversationId, conversation.session_id, reason);
    }

    console.log(`🚨 Conversation ${conversationId} escalated: ${reason}`);
  } catch (error) {
    console.error('Error in escalateConversation:', error);
    throw error;
  }
}