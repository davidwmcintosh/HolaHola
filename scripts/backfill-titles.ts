import { getSharedDb } from "../server/db";
import { conversations } from "../shared/schema";
import { storage } from "../server/storage";
import { generateConversationTitle } from "../server/conversation-utils";
import { sql } from "drizzle-orm";

async function backfillTitles() {
  console.log("[BACKFILL] Starting conversation title backfill...");
  
  const untitledConversations = await getSharedDb()
    .select({
      id: conversations.id,
      userId: conversations.userId,
      language: conversations.language,
      messageCount: conversations.messageCount,
    })
    .from(conversations)
    .where(sql`${conversations.title} IS NULL AND ${conversations.messageCount} >= 4 AND ${conversations.isOnboarding} = false`)
    .orderBy(sql`${conversations.createdAt} DESC`)
    .limit(100);
  
  console.log(`[BACKFILL] Found ${untitledConversations.length} untitled conversations`);
  
  let success = 0;
  let failed = 0;
  
  for (const conv of untitledConversations) {
    try {
      const messages = await storage.getMessagesByConversation(conv.id);
      
      if (messages.length < 4) {
        console.log(`[BACKFILL] Skipping #${conv.id} - only ${messages.length} messages`);
        continue;
      }
      
      const generatedTitle = await generateConversationTitle(
        messages.map(m => ({ role: m.role, content: m.content })),
        conv.language
      );
      
      if (generatedTitle) {
        await storage.updateConversation(conv.id, conv.userId, { title: generatedTitle });
        console.log(`[BACKFILL] ✓ #${conv.id}: "${generatedTitle}"`);
        success++;
      } else {
        console.log(`[BACKFILL] ✗ #${conv.id}: No title generated`);
        failed++;
      }
      
      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err: any) {
      console.error(`[BACKFILL] ✗ #${conv.id}: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\n[BACKFILL] Complete: ${success} succeeded, ${failed} failed`);
  process.exit(0);
}

backfillTitles().catch(err => {
  console.error("[BACKFILL] Fatal error:", err);
  process.exit(1);
});
