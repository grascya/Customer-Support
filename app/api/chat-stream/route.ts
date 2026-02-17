// app/api/chat-stream/route.ts
import { NextRequest } from 'next/server';
import { openai } from '@/lib/openrouter/client';
import { retrieveRelevantDocs, formatContextForPrompt } from '@/lib/utils/rag';
import { SYSTEM_PROMPT, RAG_PROMPT } from '@/lib/constants/prompts';
import { supabaseAdmin } from '@/lib/supabase/server';
import { analyzeSentiment } from '@/lib/utils/sentiment';
import { shouldEscalateToHuman, escalateConversation } from '@/lib/utils/escalation';

export const runtime = 'nodejs';

/**
 * Calculate the overall sentiment of a conversation.
 * It will iterate through all user messages of a conversation and count the sentiment of each message.
 * The overall sentiment will be determined by the majority of sentiment counts.
 * If there is no majority, it will return 'neutral'.
 * @param {string} conversationId - The ID of the conversation to calculate the sentiment for.
 * @returns {Promise<'positive' | 'neutral' | 'negative'>} - A promise that resolves with the overall sentiment of the conversation.
 */
async function calculateOverallSentiment(conversationId: string): Promise<'positive' | 'neutral' | 'negative'> {
  const { data: allMessages } = await supabaseAdmin
    .from('messages')
    .select('metadata')
    .eq('conversation_id', conversationId)
    .eq('role', 'user')
    .not('metadata', 'is', null);

  if (!allMessages || allMessages.length === 0) return 'neutral';

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  allMessages.forEach(msg => {
    const sentiment = msg.metadata?.sentiment;
    if (sentiment && sentiment in sentimentCounts) {
      sentimentCounts[sentiment as keyof typeof sentimentCounts]++;
    }
  });

  const total = sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative;
  if (total === 0) return 'neutral';

  const negativePercent = (sentimentCounts.negative / total) * 100;
  const positivePercent = (sentimentCounts.positive / total) * 100;

  if (negativePercent > 50) return 'negative';
  if (positivePercent > 50) return 'positive';
  return 'neutral';
}

/**
 * Handles POST requests to /api/chat-stream.
 * This endpoint is responsible for:
 * 1. Getting or creating a conversation.
 * 2. Saving the user message.
 * 3. Performing parallel operations to analyze the sentiment of the message, check if the conversation should be escalated, and retrieve relevant documents.
 * 4. Updating the message metadata (async).
 * 5. Updating the overall sentiment (async).
 * 6. Checking escalation.
 * 7. Formatting the context.
 * 8. Streaming the response using OpenRouter (fixed to use Claude Sonnet).
 * @param {NextRequest} req - The request object.
 * @returns {NextResponse} - The response object.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { message, sessionId } = await req.json();

    if (!message || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Message and sessionId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📨 Message received: "${message.substring(0, 50)}..."`);

    // 1. Get or create conversation
    let conversation;
    // Get existing ACTIVE conversation
const { data: existingConv } = await supabaseAdmin
  .from('conversations')
  .select('*')
  .eq('session_id', sessionId)
  .eq('status', 'active') // ✅ Only get active ones!
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (existingConv) {
  conversation = existingConv;
} else {
  // Create new conversation
  const { data: newConv, error } = await supabaseAdmin
    .from('conversations')
    .insert({ session_id: sessionId, status: 'active' })
    .select()
    .single();
  
  if (error) throw error;
  conversation = newConv;
}

    // 2. Save user message
    const { data: savedUserMessage } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    // 3. PARALLEL OPERATIONS
    const [sentiment, escalationResult, relevantDocs] = await Promise.all([
      analyzeSentiment(message),
      shouldEscalateToHuman(conversation.id, message),
      retrieveRelevantDocs(message, 5, 0.3),
    ]);

    // 4. Update message metadata (async)
    supabaseAdmin
      .from('messages')
      .update({ metadata: { sentiment } })
      .eq('id', savedUserMessage?.id)
      .then(() => console.log(`🔍 Sentiment: ${sentiment}`));

    // 5. Update overall sentiment (async)
    calculateOverallSentiment(conversation.id).then(overallSentiment => {
      supabaseAdmin
        .from('conversations')
        .update({ sentiment: overallSentiment })
        .eq('id', conversation.id)
        .then(() => console.log(`📊 Overall sentiment: ${overallSentiment}`));
    });

    // 6. Check escalation
    if (escalationResult.shouldEscalate) {
      await escalateConversation(conversation.id, escalationResult.reason!);
      console.log(`🚨 Escalated: ${escalationResult.reason}`);
      
      return new Response(
        JSON.stringify({ 
          escalated: true, 
          reason: escalationResult.reason,
          message: "Your conversation has been escalated to a human agent. Someone will be with you shortly."
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Format context
    const context = formatContextForPrompt(relevantDocs);
    console.log(`📚 Retrieved ${relevantDocs.length} docs`);

    // 8. Stream response - FIXED: Use Claude Sonnet (you have credits)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Lumino Support Chatbot"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet", // FIXED: Use Claude, not Gemini
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: RAG_PROMPT(context, message) }
        ],
        temperature: 0.3,
        max_tokens: 300,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenRouter error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: "OpenRouter API error" }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('No reader available');

    let fullResponse = '';
    let assistantMessageId: string | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (fullResponse) {
                
                const { data: savedMessage } = await supabaseAdmin
                  .from('messages')
                  .insert({
                    conversation_id: conversation.id,
                    role: 'assistant', 
                    content: fullResponse,
                    metadata: {
                      sources: relevantDocs.map(d => ({
                        id: d.id,
                        title: d.title,
                        source_file: d.source_file,
                        similarity: d.similarity,
                      })),
                    },
                  })
                  .select()
                  .single();

                assistantMessageId = savedMessage?.id || null;

                if (assistantMessageId) {
                  const metaEvent = `data: ${JSON.stringify({ 
                    type: 'message_id', 
                    message_id: assistantMessageId 
                  })}\n\n`;
                  controller.enqueue(encoder.encode(metaEvent));
                }
              }

              const totalTime = Date.now() - startTime;
              console.log(`⏱️ Response time: ${totalTime}ms`);

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const cleaned = line.replace(/^data: /, '').trim();
              if (cleaned && cleaned !== '[DONE]') {
                try {
                  const parsed = JSON.parse(cleaned);
                  const content = parsed.choices[0]?.delta?.content || '';
                  fullResponse += content;
                } catch (e) {}
              }
            }

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: { 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error('❌ Chat-stream error:', error);
    return new Response(
      JSON.stringify({ error: "Streaming failed", details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}