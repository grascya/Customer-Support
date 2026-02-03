import { retrieveRelevantDocs } from '../lib/utils/rag';

const testQueries = [
  'What is the wake word for voice commands?',
  'What integrations does the hub support?',
  'What are the temperature limits?',
  'How do I reset my hub?',
  'What does Sentinel Plus cost?',
];

async function testRetrieval() {
  console.log('🔍 Testing Retrieval with different thresholds\n');

  for (const threshold of [0.3, 0.35, 0.4, 0.5]) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Threshold: ${threshold}`);
    console.log('='.repeat(60));

    for (const query of testQueries) {
      const docs = await retrieveRelevantDocs(query, 3, threshold);
      console.log(`\nQ: ${query}`);
      console.log(`Found: ${docs.length} docs`);
      
      if (docs.length > 0) {
        docs.forEach(d => {
          console.log(`  - ${d.source_file} (${(d.similarity * 100).toFixed(1)}%)`);
        });
      } else {
        console.log(`  ❌ NO DOCUMENTS FOUND`);
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

testRetrieval();