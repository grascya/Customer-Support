// test-embeddings.ts
import { generateEmbedding } from './lib/utils/rag';

async function test() {
  try {
    console.log('Testing embeddings...');
    const embedding = await generateEmbedding('Hello world');
    console.log(`✅ Success! Generated ${embedding.length} dimensions`);
    console.log(`First 5 values: ${embedding.slice(0, 5)}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();