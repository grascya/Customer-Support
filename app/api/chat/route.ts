// app/api/chat/route.ts

{/*

import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openrouter/client';
import { retrieveRelevantDocs, formatContextForPrompt } from '@/lib/utils/rag';
import {
  getOrCreateConversation,
  saveMessage,
  getConversationHistory,
} from '@/lib/utils/escalation';
import { trackEvent, updateConversationMetrics } from '@/lib/utils/analytics';
import { SYSTEM_PROMPT, RAG_PROMPT } from '@/lib/constants/prompts';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const { message, sessionId } = await req.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'Message and sessionId are required' },
        { status: 400 }
      );
    }

    // 1. Get or create conversation
    const conversation = await getOrCreateConversation(sessionId);

    // 2. Save user message
    await saveMessage(conversation.id, 'user', message);

    // 3. Retrieve relevant documentation (RAG)
    const relevantDocs = await retrieveRelevantDocs(message, 3, 0.7);
    const context = formatContextForPrompt(relevantDocs);

    // 4. Get conversation history
    const history = await getConversationHistory(conversation.id, 8);

    // 5. Build messages for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
    ];

    // Add conversation history
    history.forEach((msg) => {
      if (msg.role !== 'system') {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    });

    // Add current user message with RAG context
    messages.push({
      role: 'user',
      content: RAG_PROMPT(context, message),
    });

    // 6. Generate response
    const response = await openai.chat.completions.create({
  model: 'anthropic/claude-3.5-sonnet', // or any OpenRouter model
  // Other popular options:
  // 'openai/gpt-4-turbo'
  // 'google/gemini-pro-1.5'
  // 'meta-llama/llama-3.1-70b-instruct'
  // 'anthropic/claude-3-opus'
  
  messages,
  temperature: 0.7,
  max_tokens: 500,
});

    const assistantMessage = response.choices[0].message.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    // 7. Save assistant response
    await saveMessage(conversation.id, 'assistant', assistantMessage, {
      sources: relevantDocs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        category: doc.category,
      })),
      model: 'gpt-4o-mini',
      tokens_used: tokensUsed,
    });

    // 8. Track metrics
    const responseTime = Date.now() - startTime;
    await updateConversationMetrics(conversation.id, {
      responseTimeMs: responseTime,
      tokensUsed,
    });

    await trackEvent(conversation.id, 'message_sent', {
      response_time_ms: responseTime,
      tokens_used: tokensUsed,
      sources_used: relevantDocs.length,
    });

    // 9. Return response
    return NextResponse.json({
      message: assistantMessage,
      sources: relevantDocs.map((doc) => ({
        title: doc.title,
        category: doc.category,
      })),
      conversationId: conversation.id,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
*/}