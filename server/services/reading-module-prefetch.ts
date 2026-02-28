import { getSharedDb } from "../db";
import { subjectSyllabi, readingModules } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getOrGenerateModule } from "./reading-module-generator";

interface SyllabusChapter {
  chapterNumber: number;
  chapterTitle: string;
  topic: string;
}

interface SyllabusUnit {
  unitNumber: number;
  unitTitle: string;
  chapters: SyllabusChapter[];
}

let prefetchRunning = false;

export async function prefetchAllSyllabusModules(): Promise<void> {
  if (prefetchRunning) {
    console.info("[Prefetch] Already running, skipping duplicate call");
    return;
  }
  prefetchRunning = true;

  try {
    const db = getSharedDb();
    const allSyllabi = await db.select({
      subject: subjectSyllabi.subject,
      units: subjectSyllabi.units,
    }).from(subjectSyllabi);

    if (allSyllabi.length === 0) {
      console.info("[Prefetch] No syllabi found, skipping");
      return;
    }

    for (const syllabus of allSyllabi) {
      const units = syllabus.units as SyllabusUnit[];
      const chapters = units.flatMap(u => u.chapters);
      const subject = syllabus.subject;

      // Find which chapters already have modules
      const existing = await db
        .select({ topic: readingModules.topic })
        .from(readingModules)
        .where(eq(readingModules.subjectDomain, subject));
      const existingTopics = new Set(existing.map(r => r.topic.toLowerCase()));

      // Collect all topics to prefetch: standard + any alternativeTopics
      type ChapterWithAlt = SyllabusChapter & { alternativeTopic?: string };
      const allTopics: Array<{ topic: string; label: string }> = [];
      for (const ch of chapters as ChapterWithAlt[]) {
        allTopics.push({ topic: ch.topic, label: ch.topic });
        if (ch.alternativeTopic) {
          allTopics.push({ topic: ch.alternativeTopic, label: `${ch.alternativeTopic} [alt]` });
        }
      }

      const missing = allTopics.filter(
        t => !existingTopics.has(t.topic.toLowerCase())
      );

      if (missing.length === 0) {
        console.info(`[Prefetch] ${subject}: all ${allTopics.length} topics already cached`);
        continue;
      }

      console.info(`[Prefetch] ${subject}: ${existingTopics.size} cached, ${missing.length} to generate`);

      for (const item of missing) {
        try {
          await getOrGenerateModule(item.topic, subject);
          console.info(`[Prefetch] Generated: "${item.label}" (${subject})`);
          // Pause between generations to avoid rate limiting external APIs
          await new Promise(r => setTimeout(r, 800));
        } catch (err: any) {
          console.warn(`[Prefetch] Failed for "${item.label}" (${subject}): ${err.message}`);
          // Continue with next chapter even if one fails
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      console.info(`[Prefetch] ${subject} complete`);
    }

    console.info("[Prefetch] All syllabus modules are now cached");
  } catch (err: any) {
    console.error("[Prefetch] Fatal error:", err.message);
  } finally {
    prefetchRunning = false;
  }
}

export function startBackgroundPrefetch(): void {
  console.info("[Prefetch] Starting background syllabus pre-generation...");
  prefetchAllSyllabusModules().catch(err =>
    console.error("[Prefetch] Background prefetch crashed:", err)
  );
}
