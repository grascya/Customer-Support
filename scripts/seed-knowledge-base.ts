// scripts/seed-knowledge-base.ts

// npx tsx --env-file=.env scripts/seed-knowledge-base.ts


import { supabaseAdmin } from '../lib/supabase/server';
import { generateEmbedding } from '../lib/utils/rag';
import fs from 'fs';
import path from 'path';

/**
 * Advanced Chunking: Splits text by paragraphs to preserve semantic meaning.
 */
function chunkText(text: string, maxSize: number = 800, overlap: number = 150): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // If a single paragraph is too huge, we force a split by sentences
    if (paragraph.length > maxSize) {
      const sentences = paragraph.match(/[^\.!\?]+[\.!\?]+/g) || [paragraph];
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxSize) {
          currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        }
      }
    } else if ((currentChunk + paragraph).length <= maxSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      chunks.push(currentChunk.trim());
      // Start next chunk with some overlap from the previous if possible
      currentChunk = paragraph;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

const fileMetadata: Record<string, { title: string; category: string }> = {
  'technical-setup.txt': { title: 'Technical Setup', category: 'Technical' },
  'hardware-specs.txt': { title: 'Hardware Specs', category: 'Hardware' },
  'sentinel-plus.txt': { title: 'Sentinel Plus Subscription', category: 'Billing' },
  'troubleshooting.txt': { title: 'Troubleshooting & Warranty', category: 'Support' },
};

async function seed() {
  console.log("🚀 Starting Knowledge Base Seeding...");
  const docsDir = path.join(process.cwd(), 'docs');
  
  if (!fs.existsSync(docsDir)) {
    console.error("❌ Docs directory not found!");
    return;
  }

  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.txt'));

  // 1. Wipe existing data to prevent duplicates and old low-quality chunks
  console.log("🧹 Clearing old knowledge base entries...");
  await supabaseAdmin.from('knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  for (const filename of files) {
    const meta = fileMetadata[filename];
    if (!meta) {
      console.warn(`⚠️ No metadata for ${filename}, skipping.`);
      continue;
    }

    const content = fs.readFileSync(path.join(docsDir, filename), 'utf-8');
    const chunks = chunkText(content);

    console.log(`Processing ${filename}: Generated ${chunks.length} semantic chunks.`);

    for (const [i, chunk] of chunks.entries()) {
      try {
        const embedding = await generateEmbedding(chunk);
        
        const { error } = await supabaseAdmin.from('knowledge_base').insert({
          title: `${meta.title} (Part ${i + 1})`,
          content: chunk,
          category: meta.category,
          source_file: filename,
          embedding
        });

        if (error) throw error;
      } catch (err: any) {
        console.error(`❌ Failed on chunk ${i} of ${filename}:`, err.message);
      }
    }
  }
  console.log("✅ Seeding complete! Try running evals with 0.3 threshold now.");
}

seed();