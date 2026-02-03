// app/api/chat-stream/route.ts

import { NextRequest } from 'next/server';
import { openai } from '@/lib/openrouter/client';
import { retrieveRelevantDocs, formatContextForPrompt } from '@/lib/utils/rag';
import { SYSTEM_PROMPT, RAG_PROMPT } from '@/lib/constants/prompts';
import { supabaseAdmin } from '@/lib/supabase/server';
import { analyzeSentiment } from '@/lib/utils/sentiment';
import { shouldEscalateToHuman, escalateConversation } from '@/lib/utils/escalation'; // FIXED: Use escalation.ts instead of conversation.ts

export const runtime = 'nodejs';

/**
 * Handles a POST request to process a message from a user.
 * 
 * @remarks
 * This function is responsible for the following steps:
 * 1. Get or create a conversation for the given session ID.
 * 2. Save the user message to the database.
 * 3. Analyze the sentiment of the message and update its metadata.
 * 4. Check if the conversation should be escalated to a human.
 * 5. Get the context from RAG.
 * 6. Request a streaming completion from OpenRouter.
 * 7. Return the response to the client as an event stream.
 * 
 * @param req - The NextRequest object containing the request body.
 * @returns A Response object containing the event stream response or an error response.
 */
export async function POST(req: NextRequest) {
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
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingConv) {
      conversation = existingConv;
    } else {
      const { data: newConv, error } = await supabaseAdmin
        .from('conversations')
        .insert({ session_id: sessionId, status: 'active' })
        .select()
        .single();
      
      if (error) throw error;
      conversation = newConv;
    }

    // 2. Save user message to database
    const { data: savedUserMessage } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    // 3. Analyze sentiment and update message metadata
    const sentiment = await analyzeSentiment(message);
    await supabaseAdmin
      .from('messages')
      .update({ metadata: { sentiment } })
      .eq('id', savedUserMessage?.id);

    // FIXED: Update conversation-level sentiment so dashboard can display it
    await supabaseAdmin
      .from('conversations')
      .update({ sentiment })
      .eq('id', conversation.id);

    console.log(`🔍 Sentiment for message: ${sentiment}`);

    // 4. Check for escalation - FIXED: Now properly waits for async result
    const escalationResult = await shouldEscalateToHuman(conversation.id, message);
    if (escalationResult.shouldEscalate) {
      await escalateConversation(conversation.id, escalationResult.reason!);
      console.log(`🚨 Conversation ${conversation.id} escalated: ${escalationResult.reason} (confidence: ${escalationResult.confidence})`);
      
      // Return escalation notice to frontend immediately
      return new Response(
        JSON.stringify({ 
          escalated: true, 
          reason: escalationResult.reason,
          message: "Your conversation has been escalated to a human agent. Someone will be with you shortly."
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 5. Get context from RAG
    const relevantDocs = await retrieveRelevantDocs(message, 5, 0.3);
    const context = formatContextForPrompt(relevantDocs);

    console.log(`📚 Retrieved ${relevantDocs.length} relevant documents`);
    console.log(`📄 Context length: ${context.length} chars`);

    // 6. Request streaming completion from OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Lumino Support Chatbot"
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: RAG_PROMPT(context, message) }
        ],
        temperature: 0.3,
        max_tokens: 400,
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
              // Save assistant message after streaming completes
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