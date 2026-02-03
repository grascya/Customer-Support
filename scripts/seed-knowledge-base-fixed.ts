import { supabaseAdmin } from '../lib/supabase/server';
import { generateEmbedding } from '../lib/utils/rag';
import fs from 'fs';
import path from 'path';

/**
 * IMPROVED CHUNKING:
 * - Larger chunks (1500 chars) preserve more context
 * - Smart splitting by section headers
 * - Minimal overlap to avoid redundancy
 */
function smartChunkText(text: string, filename: string): Array<{content: string, title: string}> {
  // For small files, don't chunk at all!
  if (text.length < 1500) {
    return [{
      content: text,
      title: `Complete ${filename.replace('.txt', '')} Documentation`
    }];
  }

  // Split by major sections (numbered headers like "1. ", "2. ")
  const sections = text.split(/(?=\d+\.\s+[A-Z])/);
  const chunks: Array<{content: string, title: string}> = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length < 50) continue; // Skip tiny sections

    // Extract title from first line
    const firstLine = trimmed.split('\n')[0];
    const title = firstLine.replace(/^\d+\.\s*/, '').substring(0, 60);

    // If section is reasonable size, keep it whole
    if (trimmed.length <= 1500) {
      chunks.push({ content: trimmed, title });
    } else {
      // Only split if absolutely necessary
      const paragraphs = trimmed.split(/\n\s*\n/);
      let currentChunk = '';
      
      for (const para of paragraphs) {
        if ((currentChunk + para).length <= 1500) {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        } else {
          if (currentChunk) {
            chunks.push({ content: currentChunk, title: `${title} (Part)` });
          }
          currentChunk = para;
        }
      }
      
      if (currentChunk) {
        chunks.push({ content: currentChunk, title });
      }
    }
  }

  return chunks.length > 0 ? chunks : [{ content: text, title: 'Full Document' }];
}

const fileMetadata: Record<string, { category: string }> = {
  'technical-setup.txt': { category: 'Technical' },
  'hardware-specs.txt': { category: 'Hardware' },
  'sentinel-plus.txt': { category: 'Billing' },
  'troubleshooting.txt': { category: 'Support' },
};

async function seed() {
  console.log("🚀 Starting IMPROVED Knowledge Base Seeding...\n");
  const docsDir = path.join(process.cwd(), 'docs');
  
  if (!fs.existsSync(docsDir)) {
    console.error("❌ Docs directory not found!");
    return;
  }

  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.txt'));

  // Clear old data
  console.log("🧹 Clearing old knowledge base...");
  await supabaseAdmin.from('knowledge_base').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log("✅ Old data cleared\n");

  let totalChunks = 0;

  for (const filename of files) {
    const meta = fileMetadata[filename];
    if (!meta) {
      console.warn(`⚠️ No metadata for ${filename}, skipping.`);
      continue;
    }

    const content = fs.readFileSync(path.join(docsDir, filename), 'utf-8');
    const chunks = smartChunkText(content, filename);

    console.log(`📄 ${filename}:`);
    console.log(`   Size: ${content.length} chars`);
    console.log(`   Chunks: ${chunks.length}`);

    for (const [i, chunk] of chunks.entries()) {
      try {
        console.log(`   Chunk ${i + 1}: "${chunk.title.substring(0, 40)}..." (${chunk.content.length} chars)`);
        
        const embedding = await generateEmbedding(chunk.content);
        
        const { error } = await supabaseAdmin.from('knowledge_base').insert({
          title: chunk.title,
          content: chunk.content,
          category: meta.category,
          source_file: filename,
          embedding
        });

        if (error) {
          console.error(`   ❌ Failed: ${error.message}`);
        } else {
          totalChunks++;
        }

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`✅ Seeding complete! ${totalChunks} chunks inserted`);
  console.log("🔍 Recommended similarity threshold: 0.3-0.4");
  console.log("=".repeat(60));
}

seed();