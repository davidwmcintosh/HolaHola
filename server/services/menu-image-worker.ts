/**
 * Menu Image Background Worker
 *
 * Generates watercolor-style food images for visual_assets with no image_url.
 * Designed to be started at server boot (auto-resumes after restarts) and
 * also controllable via admin API endpoints.
 *
 * State is in-memory only — status resets on restart, but work already
 * saved to the DB is never re-done (query filters WHERE image_url IS NULL).
 */

import { GoogleGenAI, Modality } from "@google/genai";

// ─── Gemini client ─────────────────────────────────────────────────────────────
function getGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
    httpOptions: {
      apiVersion: "",
      baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
    },
  });
}

async function generateImageWithGemini(prompt: string): Promise<string> {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) throw new Error("No content parts in Gemini response");

  const imagePart = candidate.content.parts.find((part: any) => part.inlineData);
  if (!imagePart?.inlineData?.data) throw new Error("No image data in Gemini response");

  const mimeType = imagePart.inlineData.mimeType || "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

// ─── Worker state ──────────────────────────────────────────────────────────────
export const menuWorker = {
  running: false,
  processed: 0,
  errors: 0,
  currentItem: null as string | null,
  lastError: null as string | null,
  startedAt: null as Date | null,
  totalPending: 0,
};

export function getMenuWorkerStatus() {
  return { ...menuWorker };
}

export function stopMenuImageWorker() {
  menuWorker.running = false;
}

export interface MenuWorkerOptions {
  batchLimit?: number;
  delayBetween?: number;
  silent?: boolean; // suppress "Starting" log when auto-started at boot
}

export async function startMenuImageWorker(opts: MenuWorkerOptions = {}): Promise<{ ok: boolean; message: string; pending?: number }> {
  if (menuWorker.running) {
    return { ok: false, message: 'Worker already running' };
  }

  const batchLimit = Math.min(opts.batchLimit ?? 500, 1000);
  const delayBetween = Math.max(opts.delayBetween ?? 2000, 1000);

  // Check how many items are pending before starting
  const { getUserDb } = await import('../db');
  const { sql: rawSql } = await import('drizzle-orm');
  const userDb = getUserDb();

  const countRow = await userDb.execute(rawSql`
    SELECT COUNT(*) as cnt FROM visual_assets
    WHERE object_type = 'food' AND (image_url IS NULL OR image_url = '')
  `);
  const pending = Number((countRow.rows[0] as any)?.cnt ?? 0);

  if (pending === 0) {
    if (!opts.silent) console.log('[MenuWorker] No pending items — nothing to do');
    return { ok: false, message: 'No pending items', pending: 0 };
  }

  menuWorker.running = true;
  menuWorker.processed = 0;
  menuWorker.errors = 0;
  menuWorker.currentItem = null;
  menuWorker.lastError = null;
  menuWorker.startedAt = new Date();
  menuWorker.totalPending = pending;

  // Fire-and-forget async loop
  (async () => {
    try {
      const { uploadPublicBuffer } = await import('./image-storage');
      const { getUserDb: getDb } = await import('../db');
      const { sql: sqlTag } = await import('drizzle-orm');
      const db = getDb();

      const rows = await db.execute(sqlTag`
        SELECT name, display_name
        FROM visual_assets
        WHERE object_type = 'food' AND (image_url IS NULL OR image_url = '')
        ORDER BY name
        LIMIT ${batchLimit}
      `);
      const items = rows.rows as { name: string; display_name: string }[];

      console.log(`[MenuWorker] Starting — ${items.length} items to generate`);

      for (const item of items) {
        if (!menuWorker.running) break;

        const displayName = item.display_name || item.name.replace(/_/g, ' ');
        menuWorker.currentItem = displayName;

        try {
          const prompt = `Appetizing illustration of ${displayName}, warm watercolor style, soft natural tones, isolated on clean white background, artisan restaurant menu aesthetic, suitable for all ages`;
          const dataUrl = await generateImageWithGemini(prompt);
          const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) throw new Error('Bad data URL');

          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const ext = mimeType.includes('png') ? 'png' : 'jpg';
          const slug = item.name.replace(/[^a-z0-9]+/g, '-').slice(0, 40);
          const filename = `menu-item-${slug}-${Date.now()}.${ext}`;
          const permanentUrl = await uploadPublicBuffer(filename, buffer, mimeType);

          await db.execute(sqlTag`
            UPDATE visual_assets SET image_url = ${permanentUrl} WHERE name = ${item.name}
          `);

          menuWorker.processed++;
          if (menuWorker.processed % 10 === 0) {
            console.log(`[MenuWorker] ${menuWorker.processed}/${items.length} complete`);
          }
        } catch (err: any) {
          menuWorker.errors++;
          menuWorker.lastError = err.message;
          console.warn(`[MenuWorker] Error on ${displayName}:`, err.message);
        }

        if (menuWorker.running) {
          await new Promise(r => setTimeout(r, delayBetween));
        }
      }
    } catch (e: any) {
      console.error('[MenuWorker] Fatal error:', e.message);
      menuWorker.lastError = e.message;
    } finally {
      menuWorker.running = false;
      menuWorker.currentItem = null;
      console.log(`[MenuWorker] Done — ${menuWorker.processed} generated, ${menuWorker.errors} errors`);
    }
  })();

  return { ok: true, message: `Worker started — processing up to ${batchLimit} items (${pending} pending)`, pending };
}
