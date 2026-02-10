// app/api/admin/dashboard/route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Get total conversations
    const { count: totalConversations } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    // Get active conversations
    const { count: activeConversations } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get resolved conversations
    const { count: resolvedConversations } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'resolved');

    // Get escalated conversations
const { data: escalatedData, count: escalatedConversations } = await supabaseAdmin
  .from('conversations')
  .select('*', { count: 'exact' })
  .eq('status', 'escalated');

console.log('🚨 Escalated conversations:', escalatedConversations);
console.log('🚨 Sample escalated:', escalatedData?.[0]);

    // Get average response time
    const { data: analyticsData } = await supabaseAdmin
      .from('chat_analytics')
      .select('event_data')
      .eq('event_type', 'message_sent')
      .not('event_data->>response_time_ms', 'is', null);

    const avgResponseTime = analyticsData && analyticsData.length > 0
      ? analyticsData.reduce((acc, row) => acc + (row.event_data.response_time_ms || 0), 0) / analyticsData.length
      : 0;

    // Get sentiment distribution from conversations table (not messages)
    const { data: sentimentData } = await supabaseAdmin
      .from('conversations')
      .select('sentiment')
      .not('sentiment', 'is', null);

    const sentimentCounts = {
      positive: sentimentData?.filter(s => s.sentiment === 'positive').length || 0,
      neutral: sentimentData?.filter(s => s.sentiment === 'neutral').length || 0,
      negative: sentimentData?.filter(s => s.sentiment === 'negative').length || 0,
    };

    const totalSentiment = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
    const sentimentDistribution = {
      positive: totalSentiment ? Math.round((sentimentCounts.positive / totalSentiment) * 100) : 0,
      neutral: totalSentiment ? Math.round((sentimentCounts.neutral / totalSentiment) * 100) : 0,
      negative: totalSentiment ? Math.round((sentimentCounts.negative / totalSentiment) * 100) : 0,
    };

    console.log('📊 Sentiment counts:', sentimentCounts);
    console.log('📊 Sentiment distribution:', sentimentDistribution);

    // Get feedback stats
    const { data: feedbackData } = await supabaseAdmin
      .from('message_feedback')
      .select('rating');

    const thumbsUp = feedbackData?.filter(f => f.rating === 1).length || 0;
    const thumbsDown = feedbackData?.filter(f => f.rating === -1).length || 0;

    // Get recent conversations with proper message count and last message
    // First, get the conversations
    const { data: recentConversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('id, session_id, created_at, status, sentiment, metadata')
      .order('created_at', { ascending: false })
      .limit(10);

    if (convError) {
      console.error('Error fetching conversations:', convError);
      throw convError;
    }

    // Then, for each conversation, get the message count and last message
    const conversations = await Promise.all(
      (recentConversations || []).map(async (conv) => {
        // Get message count
        const { count: messageCount } = await supabaseAdmin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        // Get last message
        const { data: lastMessageData } = await supabaseAdmin
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          id: conv.id,
          session_id: conv.session_id,
          created_at: conv.created_at,
          status: conv.status,
          sentiment: conv.sentiment || 'neutral', // Default to neutral if null
          message_count: messageCount || 0,
          last_message: lastMessageData?.content || 'No messages',
        };
      })
    );

    console.log('📋 Recent conversations:', conversations.length);
    console.log('📋 Sample conversation:', conversations[0]);

    return NextResponse.json({
      stats: {
        totalConversations: totalConversations || 0,
        activeConversations: activeConversations || 0,
        resolvedConversations: resolvedConversations || 0,
        escalatedConversations: escalatedConversations || 0,
        avgResponseTime,
        sentimentDistribution,
        feedbackStats: {
          thumbsUp,
          thumbsDown,
          total: thumbsUp + thumbsDown,
        },
      },
      conversations,
    });
  } catch (error: any) {
    console.error('❌ Dashboard API error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}