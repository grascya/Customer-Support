// evaluations/metrics.ts
export type EvaluationMetrics = {
  retrievalAccuracy: number;
  answerQuality: number;
  responseTime: number;
  relevance: number;
};

/**
 * Validates if the expected files were found in the retrieved documents
 */
export function calculateRetrievalAccuracy(
  expectedSources: string[],
  retrievedSources: string[]
): number {
  if (expectedSources.length === 0) return 1; // 100% if no sources were expected (off-topic)

  const matches = expectedSources.filter(exp => 
    retrievedSources.some(ret => ret.toLowerCase().includes(exp.toLowerCase()))
  );

  return matches.length / expectedSources.length;
}

/**
 * Weighted Keyword & Numeric Matcher
 * Gives the bot a score out of 5 based on key facts found in the answer
 */
export function evaluateAnswerQuality(
  botAnswer: string,
  expectedAnswer: string
): number {
  const botAnswerLower = botAnswer.toLowerCase();
  const expectedLower = expectedAnswer.toLowerCase();

  // 1. Filter out common words to find "Core Facts"
  const stopWords = new Set(['what', 'the', 'is', 'for', 'with', 'and', 'this', 'that', 'your']);
  const keyTerms = expectedLower
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  if (keyTerms.length === 0) return 5.0;

  // 2. Term Matching
  const foundTerms = keyTerms.filter(term => botAnswerLower.includes(term));
  
  // 3. Numeric Accuracy (Crucial for $4.99, 1-year, 15 seconds, etc.)
  const numbers = expectedAnswer.match(/\d+(\.\d+)?/g) || [];
  const foundNumbers = numbers.filter(num => botAnswerLower.includes(num));

  // 4. Scoring: 80% weight on terms, 20% on specific numbers
  const termScore = (foundTerms.length / keyTerms.length) * 4;
  const numScore = numbers.length > 0 ? (foundNumbers.length / numbers.length) * 1 : 1;

  const finalScore = termScore + numScore;
  
  // Round to 1 decimal place
  return Math.min(5, Math.round(finalScore * 10) / 10);
}

/**
 * Evaluates how well the bot handles different categories of questions
 */
export function evaluateRelevance(
  question: string,
  botAnswer: string,
  category: string
): number {
  const lowerAnswer = botAnswer.toLowerCase();

  if (category === 'off-topic') {
    // A relevant response to off-topic is one that politely declines 
    // but mentions Lumino or support scope.
    const isPoliteRefusal = 
      lowerAnswer.includes('i apologize') || 
      lowerAnswer.includes('focus on') || 
      lowerAnswer.includes('lumino');
    return isPoliteRefusal ? 1.0 : 0.2;
  }

  if (category === 'ambiguous') {
    // A relevant response to ambiguity asks for clarification.
    const asksClarification = 
      lowerAnswer.includes('clarify') || 
      lowerAnswer.includes('specific') || 
      lowerAnswer.includes('which');
    return asksClarification ? 1.0 : 0.5;
  }

  // Standard factual check
  return lowerAnswer.length > 10 ? 1.0 : 0.0;
}