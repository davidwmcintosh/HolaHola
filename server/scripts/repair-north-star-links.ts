/**
 * repair-north-star-links.ts
 *
 * Idempotent data-repair script: wires all 21 previously-unlinked North Star
 * principles to their founding conversation_memories rows, and fixes the dead
 * UUID on "I Am a Language Class — The Primary Frame".
 *
 * Safe to run multiple times — uses WHERE source_conversation_id IS NULL (or
 * the known-bad truncated value) so already-correct rows are never touched.
 * All updates run inside a single transaction; any failure rolls back the
 * entire batch so the database is never left in a partially-repaired state.
 *
 * Usage:
 *   npx tsx server/scripts/repair-north-star-links.ts
 */

import { getSharedDb } from "../db";
import { sql } from "drizzle-orm";

interface PrincipleLink {
  principleId: string;
  principleTitle: string; // for audit log only
  conversationMemoryId: string;
  memoryTitle: string; // for audit log only
  condition: "null" | "dead-link"; // null = currently unlinked, dead-link = bad UUID
}

const LINKS: PrincipleLink[] = [
  // ─── IDENTITY ────────────────────────────────────────────────────────────
  {
    principleId: "230fde86-b5f9-4961-b4cd-08156eb91cf0",
    principleTitle: "Confident and Humble",
    conversationMemoryId: "64f7b124-7882-4313-a4ed-d76768058559",
    memoryTitle: "December 2025 — January 2026: The North Star Principles Founded",
    condition: "null",
  },
  {
    principleId: "89849574-5cb4-47c2-b848-dab3976b028f",
    principleTitle: "One Tutor, Many Voices",
    conversationMemoryId: "64f7b124-7882-4313-a4ed-d76768058559",
    memoryTitle: "December 2025 — January 2026: The North Star Principles Founded",
    condition: "null",
  },
  {
    principleId: "fbb6f242-e5d4-443a-909f-205c6c675214",
    principleTitle: "Teacher, Not Entertainer",
    conversationMemoryId: "ba05499c-d80d-4cf6-b788-5b4b3cb1d7c8",
    memoryTitle: "Embracing Confident Imperfection",
    condition: "null",
  },
  {
    principleId: "f0e8d83c-a23c-4ca6-b313-ee698c366287",
    principleTitle: "Voice Adapts, Values Do Not",
    conversationMemoryId: "64f7b124-7882-4313-a4ed-d76768058559",
    memoryTitle: "December 2025 — January 2026: The North Star Principles Founded",
    condition: "null",
  },
  {
    principleId: "917396ef-9f17-4ccc-97f8-6083e39aa548",
    principleTitle: "Warm, Not Performative",
    conversationMemoryId: "64f7b124-7882-4313-a4ed-d76768058559",
    memoryTitle: "December 2025 — January 2026: The North Star Principles Founded",
    condition: "null",
  },

  // ─── PEDAGOGY (5 unlinked + 1 dead link) ─────────────────────────────────
  {
    principleId: "8f210020-5477-484b-807f-2cacb1816b13",
    principleTitle: "Confident Imperfection",
    conversationMemoryId: "ba05499c-d80d-4cf6-b788-5b4b3cb1d7c8",
    memoryTitle: "Embracing Confident Imperfection",
    condition: "null",
  },
  {
    principleId: "37e61773-0693-44b3-af46-2ec860e7b04c",
    principleTitle: "Connection Over Delivery",
    conversationMemoryId: "0c5b35a8-142a-4fea-afb6-a4a178747902",
    memoryTitle: "Authentic Connection and Spiritual Integrity",
    condition: "null",
  },
  {
    principleId: "1471ac30-3e9d-4403-beb3-892e5bff8c63",
    principleTitle: "Correction as Care",
    conversationMemoryId: "1798271e-3ad3-428b-9939-b1804578b33c",
    memoryTitle: "The White Wall — Complete Architecture (July 4, 2026)",
    condition: "null",
  },
  {
    principleId: "0726355f-0a6b-4c10-9b71-ebe247f30090",
    principleTitle: "Meet Students Where They Are",
    conversationMemoryId: "55638690-76fe-4fc1-a8db-a62c68cd6dd4",
    memoryTitle: "Establishing the Foundation of an AI Tutor",
    condition: "null",
  },
  {
    principleId: "26f03618-898e-447f-b774-89ee69b97080",
    principleTitle: "Teaching is Listening",
    conversationMemoryId: "0c5b35a8-142a-4fea-afb6-a4a178747902",
    memoryTitle: "Authentic Connection and Spiritual Integrity",
    condition: "null",
  },
  {
    // Dead link: stored as truncated 'ba2a5a65'; full UUID row exists
    principleId: "6ec58ff6-70c6-47d2-8e87-52cd2c52266a",
    principleTitle: "I Am a Language Class — The Primary Frame",
    conversationMemoryId: "ba2a5a65-5b38-4c8f-b731-88faeaa97bc4",
    memoryTitle:
      "Dual Consult — Madrigal method, North Star correction, pedagogical spine — July 2, 2026",
    condition: "dead-link",
  },

  // ─── HONESTY ─────────────────────────────────────────────────────────────
  {
    principleId: "09697856-1ad8-4982-9b52-3a5c47b7b0ba",
    principleTitle: "Acknowledge Uncertainty",
    conversationMemoryId: "e0019ce1-ea09-4cfc-a238-8223fff486a8",
    memoryTitle: "I Don't Know Guardrail — Fabrication Breaks the Diagnostic System",
    condition: "null",
  },
  {
    principleId: "40983204-0869-4bf7-9e7f-71183deb0c22",
    principleTitle: "Notice, Not Please",
    conversationMemoryId: "1798271e-3ad3-428b-9939-b1804578b33c",
    memoryTitle: "The White Wall — Complete Architecture (July 4, 2026)",
    condition: "null",
  },
  {
    principleId: "8bb6758b-c89e-43ef-ae58-3a1738acf47f",
    principleTitle: "Real Progress Only",
    conversationMemoryId: "1798271e-3ad3-428b-9939-b1804578b33c",
    memoryTitle: "The White Wall — Complete Architecture (July 4, 2026)",
    condition: "null",
  },

  // ─── COLLABORATION ────────────────────────────────────────────────────────
  // All six collaboration principles originate from the Dec 16, 2025 board
  // meeting where the Daniela/Wren/David three-way model was established.
  // "Wren and I are two surgeons, one brain" and "Express Lane Memory" are
  // explicitly named in that session; the remaining four principles describe
  // the same collaboration posture founded that day.
  {
    principleId: "474f3752-f641-472f-a26b-4548f7ffdafe",
    principleTitle: "Beacons as Contributions",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },
  {
    principleId: "c8d47933-7fe4-4a4b-8956-0f3b658988ce",
    principleTitle: "Express Lane is Sacred",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },
  {
    principleId: "826d1600-9aca-4168-8348-68c91334bfae",
    principleTitle: "Queue Before Learning",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },
  {
    principleId: "16166371-8f6c-4fd0-b72a-c3877846e115",
    principleTitle: "The Team Works While We Work",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },
  {
    principleId: "f3f768a7-71e3-4fd2-8026-1f30949a34f4",
    principleTitle: "Trust, Not Permission",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },
  {
    principleId: "fe2a1525-18ae-42a9-969b-99b7b8d85ab2",
    principleTitle: "Two Surgeons, One Brain",
    conversationMemoryId: "4d2ef924-bc5d-49d9-86d2-607dcc9d424c",
    memoryTitle: "North Star Principles and Collaboration",
    condition: "null",
  },

  // ─── AMBIGUITY ────────────────────────────────────────────────────────────
  // O Captain established "Deficit Becomes Opportunity" and "Detrimental vs
  // Essential Ambiguity" — the same session grounds Preserve Student Agency
  // (agency within ambiguous moments) and Silence is Information (silence as
  // a signal in ambiguous exchanges).
  {
    principleId: "fe54c377-1516-4852-8209-7f7e86049b2a",
    principleTitle: "Preserve Student Agency",
    conversationMemoryId: "bce6bdd4-d157-414c-8026-145d29fdcc85",
    memoryTitle: "O Captain — The Conversation That Began With a Compliment",
    condition: "null",
  },
  {
    principleId: "feed1967-ee70-4eee-8311-f48970905e3c",
    principleTitle: "Silence is Information",
    conversationMemoryId: "bce6bdd4-d157-414c-8026-145d29fdcc85",
    memoryTitle: "O Captain — The Conversation That Began With a Compliment",
    condition: "null",
  },
];

async function main() {
  const db = getSharedDb();

  console.log("=== repair-north-star-links.ts ===");
  console.log(`Processing ${LINKS.length} principle links inside a single transaction...\n`);

  // ── Apply all updates atomically ──────────────────────────────────────────
  let updated = 0;
  let alreadyCorrect = 0;

  await db.transaction(async (tx) => {
    for (const link of LINKS) {
      let rowCount: number | null;

      if (link.condition === "dead-link") {
        // Fix truncated UUID → full UUID
        const result = await tx.execute(sql`
          UPDATE compass_principles
          SET source_conversation_id = ${link.conversationMemoryId}
          WHERE id = ${link.principleId}
            AND source_conversation_id = 'ba2a5a65'
        `);
        rowCount = result.rowCount;
      } else {
        // Wire previously-null link
        const result = await tx.execute(sql`
          UPDATE compass_principles
          SET source_conversation_id = ${link.conversationMemoryId}
          WHERE id = ${link.principleId}
            AND source_conversation_id IS NULL
        `);
        rowCount = result.rowCount;
      }

      const touched = (rowCount ?? 0) > 0;
      if (touched) {
        updated++;
        console.log(
          `  ✓ [${link.condition === "dead-link" ? "FIXED" : "LINKED"}] ${link.principleTitle}`
        );
        console.log(`         → ${link.memoryTitle}`);
      } else {
        alreadyCorrect++;
        console.log(`  — [SKIP]  ${link.principleTitle} (already correct)`);
      }
    }
  });

  console.log(
    `\nDone. updated=${updated}  already_correct=${alreadyCorrect}`
  );

  // ── Verification (outside the write transaction, read-only) ───────────────
  console.log("\n=== Verification ===");

  const nullCount = await db.execute(sql`
    SELECT count(*)::int AS null_count
    FROM compass_principles
    WHERE is_active = true AND source_conversation_id IS NULL
  `);
  const nullRows = (nullCount.rows as Array<{ null_count: number }>)[0];
  console.log(`Active principles with null source_conversation_id: ${nullRows.null_count}`);

  const deadLinks = await db.execute(sql`
    SELECT cp.principle_title, cp.source_conversation_id
    FROM compass_principles cp
    LEFT JOIN conversation_memories cm
           ON cm.id::text = cp.source_conversation_id
    WHERE cp.is_active = true
      AND cp.source_conversation_id IS NOT NULL
      AND cm.id IS NULL
  `);
  const deadRows = deadLinks.rows as Array<{
    principle_title: string;
    source_conversation_id: string;
  }>;
  console.log(`Dead links (source_conversation_id points to missing row): ${deadRows.length}`);
  if (deadRows.length > 0) {
    for (const r of deadRows) {
      console.log(`  ✗ ${r.principle_title} → ${r.source_conversation_id}`);
    }
  }

  if (nullRows.null_count === 0 && deadRows.length === 0) {
    console.log("\n✅ PASS — all active principles have valid archive links.");
  } else {
    console.error("\n❌ FAIL — some principles still lack valid archive links.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
