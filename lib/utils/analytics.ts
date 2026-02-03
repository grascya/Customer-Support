// lib/utils/analytics.ts
import { supabaseAdmin } from '@/lib/supabase/server';

export async function trackEvent(
  conversationId: string,
  eventType: string,
  eventData?: any
) {
  await supabaseAdmin.from('chat_analytics').insert({
    conversation_id: conversationId,
    event_type: eventType,
    event_data: eventData || {},
  });
}

export async function updateConversationMetrics(
  conversationId: string,
  metrics: {
    responseTimeMs?: number;
    tokensUsed?: number;
    sentiment?: string;
  }
) {
  await trackEvent(conversationId, 'metrics_updated', metrics);
}
