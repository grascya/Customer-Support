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
  const escalationKeywords = ['refund', 'angry', 'bad', 'frustrated', 'not happy', 'problem'];

  const shouldEscalate = escalationKeywords.some(k => lower.includes(k));
  if (shouldEscalate) return { shouldEscalate: true, reason: 'Negative sentiment / escalation keyword detected' };
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
