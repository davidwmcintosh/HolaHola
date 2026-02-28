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

      const missing = chapters.filter(
        ch => !existingTopics.has(ch.topic.toLowerCase())
      );

      if (missing.length === 0) {
        console.info(`[Prefetch] ${subject}: all ${chapters.length} chapters already cached`);
        continue;
      }

      console.info(`[Prefetch] ${subject}: ${existing.length} cached, ${missing.length} to generate`);

      for (const chapter of missing) {
        try {
          await getOrGenerateModule(chapter.topic, subject);
          console.info(`[Prefetch] Generated: "${chapter.topic}" (${subject})`);
          // Pause between generations to avoid rate limiting external APIs
          await new Promise(r => setTimeout(r, 800));
        } catch (err: any) {
          console.warn(`[Prefetch] Failed for "${chapter.topic}" (${subject}): ${err.message}`);
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
