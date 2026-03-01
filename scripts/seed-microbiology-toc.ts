import { db } from '../server/db';
import { subjectSyllabi, teacherClasses } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { getTOCForSubject } from '../server/data/subject-tocs';

async function main() {
  const toc = getTOCForSubject('microbiology');
  if (!toc) { console.log('No TOC found'); return; }

  const result = await db.update(subjectSyllabi)
    .set({ units: toc })
    .where(eq(subjectSyllabi.subject, 'microbiology'))
    .returning({ subject: subjectSyllabi.subject });
  console.log('Syllabus updated:', JSON.stringify(result));

  const classResult = await db.update(teacherClasses)
    .set({ isPublicCatalogue: true })
    .where(eq(teacherClasses.subjectSyllabusId, 'microbiology'))
    .returning({ id: teacherClasses.id, name: teacherClasses.name });
  console.log('Classes updated:', JSON.stringify(classResult));
}

main().catch(console.error).finally(() => process.exit(0));
