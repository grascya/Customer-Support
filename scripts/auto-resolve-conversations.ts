// scripts/auto-resolve-conversations.ts

import { supabaseAdmin } from "@/lib/supabase/server";

export async function autoResolveOldConversations() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Resolve active conversations with no recent activity
  await supabaseAdmin
    .from('conversations')
    .update({ status: 'resolved', metadata: { auto_resolved: true } })
    .eq('status', 'active')
    .lt('updated_at', sevenDaysAgo.toISOString());

  console.log('✅ Auto-resolved stale conversations');
}