// app/api/cron/auto-resolve/route.ts

import { autoResolveOldConversations } from "@/scripts/auto-resolve-conversations";

export async function GET() {
  await autoResolveOldConversations();
  return new Response('OK');
}