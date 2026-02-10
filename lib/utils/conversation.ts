// app/lib/utils/conversation.ts

import { supabaseAdmin } from '../supabase/server';

/**
 * Determine if a message should trigger human escalation.
 * Simple logic: negative sentiment OR keywords like "refund", "angry", "bad".
 */
export async function shouldEscalateToHuman(
  conversationId: string,
  message: string
): Promise<{ shouldEscalate: boolean; reason?: string }> {
  const lower = message.toLowerCase();
  
  // Only trigger on "angry" keywords or explicit demands
  const urgentKeywords = [
    'refund', 'lawsuit', 'legal', 'scam', 
    'talk to a manager', 'human representative', 'speak to a person'
  ];

  const shouldEscalate = urgentKeywords.some(k => lower.includes(k));
  
  if (shouldEscalate) {
    return { shouldEscalate: true, reason: 'Urgent keyword or human agent request detected' };
  }
  
  return { shouldEscalate: false };
}

/**
 * Mark the conversation as escalated.
 */
export async function escalateConversation(conversationId: string, reason?: string) {
  await supabaseAdmin
    .from('conversations')
    .update({ status: 'escalated', escalation_reason: reason })
    .eq('id', conversationId);
}
