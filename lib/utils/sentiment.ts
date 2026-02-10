// lib/utils/sentiment.ts

import { openai } from '@/lib/openrouter/client';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export async function analyzeSentiment(message: string, retries = 3): Promise<Sentiment> {
  try {
    console.log(`🔍 Analyzing sentiment for: "${message.substring(0, 50)}..."`);
    
    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-haiku', 
      messages: [
        {
          role: 'system',
          content: `Analyze sentiment. Respond with ONE WORD only: positive, neutral, or negative

POSITIVE (gratitude, satisfaction, appreciation):
- "This is great, thank you!"
- "I really appreciate this"
- "Perfect!"
- "Love it!"
- "Thank you so much"

NEUTRAL (questions, requests):
- "How do I reset?"
- "I need help"
- "What are the specs?"

NEGATIVE (frustration, disappointment, anger):
- "This is frustrating"
- "Doesn't work"
- "I'm disappointed"
- "This sucks"

Gratitude and appreciation = POSITIVE, not neutral.`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.1,
      max_tokens: 10,
    });

    const rawSentiment = response.choices[0].message.content?.trim().toLowerCase();
    console.log(`📊 Raw sentiment response: "${rawSentiment}"`);
    
    let sentiment: Sentiment;
    
    if (rawSentiment?.includes('positive')) {
      sentiment = 'positive';
    } else if (rawSentiment?.includes('negative')) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }
    
    console.log(`✅ Final sentiment: ${sentiment}`);
    return sentiment;
    
  } catch (error: any) {
    if (error.message?.includes('429') && retries > 0) {
      const delay = (4 - retries) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return analyzeSentiment(message, retries - 1);
    }
    
    console.error('❌ Error analyzing sentiment:', error.message);
    return 'neutral';
  }
}

export function isUserFrustrated(recentSentiments: Sentiment[]): boolean {
  // Only escalate if the user has been negative for the last 2+ messages
  if (recentSentiments.length < 2) return false;
  
  const lastThree = recentSentiments.slice(-3);
  const negativeCount = lastThree.filter(s => s === 'negative').length;
  
  // Require at least 2 negative sentiments in the last 3 messages
  return negativeCount >= 2; 
}