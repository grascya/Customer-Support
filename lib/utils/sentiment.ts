// lib/utils/sentiment.ts

import { openai } from '@/lib/openrouter/client';

export type Sentiment = 'positive' | 'neutral' | 'negative';

/**
 * Analyze sentiment of a message using LLM
 */
export async function analyzeSentiment(message: string): Promise<Sentiment> {
  try {
    console.log(`🔍 Analyzing sentiment for: "${message.substring(0, 50)}..."`);
    
    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-haiku', // Cheaper/faster for sentiment
      messages: [
        {
          role: 'system',
          content: `Analyze the sentiment of the user's message. 
          Respond with only one word: positive, neutral, or negative.
          
          Examples:
          - "This is great, thank you!" → positive
          - "How do I reset my hub?" → neutral
          - "This is frustrating and doesn't work!" → negative
          - "I've tried everything and nothing works" → negative
          - "I need help" → neutral
          - "This sucks" → negative
          - "Perfect! Exactly what I needed" → positive
          
          Be strict: only mark as negative if there's clear frustration, anger, or dissatisfaction.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.2,
      max_tokens: 10,
    });

    const rawSentiment = response.choices[0].message.content?.trim().toLowerCase();
    console.log(`📊 Raw sentiment response: "${rawSentiment}"`);
    
    let sentiment: Sentiment;
    
    if (rawSentiment === 'positive') {
      sentiment = 'positive';
    } else if (rawSentiment === 'negative') {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral'; // Default for anything else including 'neutral'
    }
    
    console.log(`✅ Final sentiment: ${sentiment}`);
    return sentiment;
    
  } catch (error: any) {
    console.error('❌ Error analyzing sentiment:', error.message);
    return 'neutral'; // Safe default on error
  }
}

/**
 * Check if recent conversation sentiment indicates user frustration
 */
export function isUserFrustrated(recentSentiments: Sentiment[]): boolean {
  if (recentSentiments.length < 2) return false;
  
  // If last 2-3 messages are negative, user is frustrated
  const lastThree = recentSentiments.slice(-3);
  const negativeCount = lastThree.filter(s => s === 'negative').length;
  
  const isFrustrated = negativeCount >= 2;
  
  if (isFrustrated) {
    console.log(`🚨 User frustration detected: ${negativeCount}/3 recent messages are negative`);
  }
  
  return isFrustrated;
}