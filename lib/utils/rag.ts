// lib/utils/rag.ts
import { openai } from '@/lib/openrouter/client';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * Generate embeddings using OpenRouter
 * Uses text-embedding-3-small as defined in your schema
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const sanitizedText = text.replace(/\s+/g, ' ').trim();
    const response = await openai.embeddings.create({
      model: 'openai/text-embedding-3-small',
      input: sanitizedText.substring(0, 8000),
    });

    return response.data[0].embedding;
  } catch (error: any) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Retrieves relevant documents from the knowledge_base table.
 * Lower threshold for better retrieval
 */
export async function retrieveRelevantDocs(
  query: string,
  limit = 5,
  threshold = 0.3 // Lowered from 0.5 for better recall
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  category: string;
  source_file: string;
  similarity: number;
}>> {
  try {
    const embedding = await generateEmbedding(query);

    // Call the match_documents function defined in your schema
    const { data, error } = await supabaseAdmin.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('❌ Supabase RPC Error:', error.message);
      return [];
    }

    console.log(`🔍 Retrieved ${data?.length || 0} docs for: "${query.substring(0, 30)}..."`);
    
    // Log which files were retrieved
    if (data && data.length > 0) {
      const files = [...new Set(data.map((d: any) => d.source_file))];
      console.log(`📚 Sources: ${files.join(', ')}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error in retrieveRelevantDocs:', error);
    return [];
  }
}

/**
 * Formats retrieved documents into a clear, structured context
 * This is critical - the format affects how well the LLM uses the context
 */
export function formatContextForPrompt(docs: any[]): string {
  if (docs.length === 0) {
    return 'NO_KNOWLEDGE_BASE_CONTEXT_AVAILABLE';
  }

  // Group documents by source file for better organization
  const docsBySource: Record<string, any[]> = {};
  
  for (const doc of docs) {
    if (!docsBySource[doc.source_file]) {
      docsBySource[doc.source_file] = [];
    }
    docsBySource[doc.source_file].push(doc);
  }

  let context = '';
  
  // Format each source file's content
  Object.entries(docsBySource).forEach(([sourceFile, fileDocs], index) => {
    context += `\n=== DOCUMENT ${index + 1}: ${sourceFile.replace('.txt', '').toUpperCase()} ===\n\n`;
    
    fileDocs.forEach((doc) => {
      context += `${doc.content}\n\n`;
    });
  });

  return context.trim();
}