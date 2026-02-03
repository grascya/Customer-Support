// lib/utils/escalation.ts

import { supabaseAdmin } from '@/lib/supabase/server';

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

    const isNegative = negativeCounts >= 2;
    
    if (isNegative) {
      console.log(`🔍 Negative sentiment pattern detected: ${negativeCounts}/3 messages are negative`);
    }

    // If 2 or more of last 3 messages are negative, user is frustrated
    return isNegative;
  } catch (error) {
    console.error('Error in checkNegativeSentiment:', error);
    return false;
  }
}

/**
 * Check if user is asking similar questions repeatedly (bot failing)
 */
async function checkRepeatedQuery(conversationId: string, currentMessage: string): Promise<boolean> {
  try {
    const { data: recentMessages, error } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching messages for repeated query check:', error);
      return false;
    }

    if (!recentMessages || recentMessages.length < 3) {
      console.log(`⚠️ Not enough messages (${recentMessages?.length || 0}) to check for repetition`);
      return false;
    }

    // Simple similarity check (you could use embeddings for better accuracy)
    const currentWords = currentMessage.toLowerCase().split(' ').filter(w => w.length > 3);
    let similarCount = 0;

    for (const msg of recentMessages.slice(0, 4)) {
      const msgWords = msg.content.toLowerCase().split(' ');
      const commonWords = currentWords.filter(word => 
        word.length > 3 && msgWords.includes(word)
      );

      // If more than 40% of words overlap, consider it similar
      if (commonWords.length / currentWords.length > 0.4) {
        similarCount++;
        console.log(`🔍 Similar query detected: "${msg.content.substring(0, 40)}..." matches current message`);
      }
    }

    const isRepeated = similarCount >= 2;
    
    if (isRepeated) {
      console.log(`🔍 Repeated query pattern detected: ${similarCount} similar messages found`);
    }

    // If 2+ similar queries in last 5 messages, user is stuck
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

  // 3. Check for repeated queries (bot failing)
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
 * Mark conversation as escalated
 */
export async function escalateConversation(
  conversationId: string,
  reason: EscalationReason
): Promise<void> {
  try {
    // Update conversation status
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        status: 'escalated',
        metadata: { escalation_reason: reason },
      })
      .eq('id', conversationId);

    if (updateError) {
      console.error('Error updating conversation status:', updateError);
      throw updateError;
    }

    // Track escalation event
    const { error: analyticsError } = await supabaseAdmin
      .from('chat_analytics')
      .insert({
        conversation_id: conversationId,
        event_type: 'escalated',
        event_data: { reason },
      });

    if (analyticsError) {
      console.error('Error tracking escalation event:', analyticsError);
      // Don't throw - analytics failure shouldn't prevent escalation
    }

    console.log(`🚨 Conversation ${conversationId} escalated: ${reason}`);
  } catch (error) {
    console.error('Error in escalateConversation:', error);
    throw error;
  }
}