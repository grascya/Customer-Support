// evaluations/run-evaluations.ts

import fs from 'fs';
import { testCases } from './test-cases';
import { 
  calculateRetrievalAccuracy, 
  evaluateAnswerQuality, 
  evaluateRelevance 
} from './metrics';

async function evaluateModel() {
  console.log('🚀 Starting Lumino Model Evaluation...');
  console.log(`Testing ${testCases.length} cases \n`);
  console.log('='.repeat(80) + '\n');

  const results: any[] = [];
  let totalQualityScore = 0;

  for (const testCase of testCases) {
    const startTime = Date.now();

    try {
      // 1. Fetch from  local API
      const response = await fetch('http://localhost:3000/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: testCase.question,
          sessionId: `eval_${testCase.id}`,
        }),
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      // 2. Stream handling
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let botAnswer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            const cleaned = line.replace(/^data: /, '').trim();
            if (!cleaned || cleaned === '[DONE]') continue;
            try {
              const parsed = JSON.parse(cleaned);
              botAnswer += parsed.choices[0]?.delta?.content || '';
            } catch (e) {}
          }
        }
      }

      const responseTime = Date.now() - startTime;

      // 3. Retrieval Check (Directly calling your RAG utility)
      const retrievedSources = await getRetrievedSources(testCase.question);
      
      const retrievalAccuracy = calculateRetrievalAccuracy(
        testCase.expectedSources,
        retrievedSources
      );

      // 4. Smart Quality Evaluation
      let answerQuality: number;
      const relevance = evaluateRelevance(testCase.question, botAnswer, testCase.category);

      if (testCase.category === 'off-topic' || testCase.category === 'ambiguous') {
        // For off-topic, "Quality" is how well it redirected the user
        answerQuality = relevance * 5; 
      } else {
        answerQuality = evaluateAnswerQuality(botAnswer, testCase.expectedAnswer);
      }

      // 5. Pass/Fail Logic (Weighted 60% Quality, 40% Retrieval)
      const weightedScore = (answerQuality / 5) * 0.6 + (retrievalAccuracy * 0.4);
      const passed = weightedScore >= 0.7; // 70% overall to pass

      results.push({
        testCaseId: testCase.id,
        question: testCase.question,
        botAnswer,
        retrievedSources,
        metrics: {
          retrievalAccuracy,
          answerQuality,
          responseTime,
          relevance,
        },
        passed,
      });

      totalQualityScore += (answerQuality / 5) * 100;

      // Log Results to Console
      console.log(`Test ${testCase.id} [${testCase.difficulty.toUpperCase()}]: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`Q: ${testCase.question}`);
      console.log(`A: ${botAnswer.substring(0, 80)}...`);
      console.log(`Metrics: Retrieval: ${retrievalAccuracy * 100}% | Quality: ${answerQuality}/5.0 | Speed: ${responseTime}ms`);
      console.log('-'.repeat(40));

      // Wait to prevent rate limiting
      await new Promise(r => setTimeout(r, 800));

    } catch (error) {
      console.error(`❌ Error on ${testCase.id}:`, error);
    }
  }

  printFinalSummary(results, totalQualityScore);
}

async function getRetrievedSources(question: string): Promise<string[]> {
  try {
    const { retrieveRelevantDocs } = await import('../lib/utils/rag');
    // Using 0.5 threshold as requested
    const docs = await retrieveRelevantDocs(question, 3, 0.3); 
    return docs.map(d => d.source_file);
  } catch (e) {
    return [];
  }
}

function printFinalSummary(results: any[], totalQuality: number) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const avgScore = totalQuality / total;
  const avgRetrieval = (results.reduce((s, r) => s + r.metrics.retrievalAccuracy, 0) / total) * 100;

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL EVALUATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Passed: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`📈 Avg Quality: ${avgScore.toFixed(1)}/100`);
  console.log(`🔍 Avg Retrieval: ${avgRetrieval.toFixed(1)}%`);

  let grade = 'F';
  if (avgScore >= 90) grade = 'A';
  else if (avgScore >= 80) grade = 'B';
  else if (avgScore >= 70) grade = 'C';
  else if (avgScore >= 60) grade = 'D';

  console.log(`🎓 Overall Grade: ${grade}`);
  console.log('='.repeat(80) + '\n');

  fs.writeFileSync('evaluation-results.json', JSON.stringify(results, null, 2));
}

evaluateModel().catch(console.error);