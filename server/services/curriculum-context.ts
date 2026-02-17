import { IStorage } from '../storage';
import type { 
  TeacherClass, 
  CurriculumPath, 
  CurriculumUnit, 
  CurriculumLesson,
  SyllabusProgress
} from '@shared/schema';

const MAX_CLASSES_IN_CONTEXT = 3;
const MAX_ASSIGNMENTS_PER_CLASS = 3;

export interface ClassContext {
  classId: string;
  className: string;
  teacherName?: string;
  language: string;
  curriculumPath?: {
    id: string;
    name: string;
    description: string | null;
  };
  units: Array<{
    id: string;
    name: string;
    lessons: Array<{
      id: string;
      name: string;
      description: string | null;
      isCompleted: boolean;
      topicsCovered?: number;
      vocabularyMastered?: number;
      grammarScore?: number | null;
      evidenceType?: string | null;
    }>;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    isSubmitted: boolean;
    grade?: number | null;
  }>;
  progress: {
    lessonsCompleted: number;
    totalLessons: number;
    assignmentsCompleted: number;
    totalAssignments: number;
  };
}

export interface StudentCurriculumContext {
  studentId: string;
  studentName: string;
  enrolledClasses: ClassContext[];
  selfDirectedLanguages: string[];
  summary: string;
}

export async function buildCurriculumContext(
  storage: IStorage,
  studentId: string,
  studentName: string
): Promise<StudentCurriculumContext> {
  try {
    const enrollments = await storage.getStudentEnrollments(studentId);
    const activeEnrollments = enrollments.filter(e => e.isActive);
    
    const classContexts: ClassContext[] = [];
    
    for (const enrollment of activeEnrollments) {
      const teacherClass = enrollment.class;
      if (!teacherClass) continue;
      
      const classContext = await buildClassContext(
        storage,
        studentId,
        teacherClass
      );
      
      if (classContext) {
        classContexts.push(classContext);
      }
    }
    
    const summary = generateContextSummary(classContexts, studentName);
    
    return {
      studentId,
      studentName,
      enrolledClasses: classContexts,
      selfDirectedLanguages: [],
      summary
    };
  } catch (error) {
    console.error(`[CurriculumContext] Error building context for student ${studentId}:`, error);
    return {
      studentId,
      studentName,
      enrolledClasses: [],
      selfDirectedLanguages: [],
      summary: `${studentName} is studying independently.`
    };
  }
}

async function buildClassContext(
  storage: IStorage,
  studentId: string,
  teacherClass: TeacherClass
): Promise<ClassContext | null> {
  try {
    const assignments = await storage.getClassAssignments(teacherClass.id);
    const submissions = await storage.getStudentSubmissions(studentId);
    const syllabusProgress = await storage.getSyllabusProgress(studentId, teacherClass.id);
    
    const teacher = await storage.getUser(teacherClass.teacherId);
    
    let curriculumPath: CurriculumPath | undefined;
    let units: CurriculumUnit[] = [];
    const lessonsMap = new Map<string, CurriculumLesson[]>();
    
    if (teacherClass.curriculumPathId) {
      curriculumPath = await storage.getCurriculumPath(teacherClass.curriculumPathId);
      if (curriculumPath) {
        units = await storage.getCurriculumUnits(curriculumPath.id);
        
        for (const unit of units) {
          const lessons = await storage.getCurriculumLessons(unit.id);
          lessonsMap.set(unit.id, lessons);
        }
      }
    }
    
    const progressMap = new Map<string, SyllabusProgress>();
    for (const p of syllabusProgress) {
      progressMap.set(p.lessonId, p);
    }
    
    const submissionMap = new Map<string, { isSubmitted: boolean; grade?: number | null }>();
    for (const sub of submissions) {
      if (sub.assignment?.classId === teacherClass.id) {
        submissionMap.set(sub.assignmentId, {
          isSubmitted: true,
          grade: sub.teacherScore || sub.aiScore
        });
      }
    }
    
    const unitsWithLessons = units.map(unit => ({
      id: unit.id,
      name: unit.name,
      lessons: (lessonsMap.get(unit.id) || []).map(lesson => {
        const progress = progressMap.get(lesson.id);
        const isCompleted = progress?.status === 'completed_early' || 
                           progress?.status === 'completed_assigned' ||
                           progress?.tutorVerified === true;
        return {
          id: lesson.id,
          name: lesson.name,
          description: lesson.description,
          isCompleted,
          topicsCovered: progress?.topicsCoveredCount || undefined,
          vocabularyMastered: progress?.vocabularyMastered || undefined,
          grammarScore: progress?.grammarScore,
          evidenceType: progress?.evidenceType
        };
      })
    }));
    
    const totalLessons = unitsWithLessons.reduce((acc, u) => acc + u.lessons.length, 0);
    const completedLessons = unitsWithLessons.reduce(
      (acc, u) => acc + u.lessons.filter(l => l.isCompleted).length, 0
    );
    
    const publishedAssignments = assignments.filter(a => a.isPublished);
    const completedAssignments = publishedAssignments.filter(
      a => submissionMap.get(a.id)?.isSubmitted
    );
    
    const teacherName = teacher ? 
      [teacher.firstName, teacher.lastName].filter(Boolean).join(' ') || undefined 
      : undefined;
    
    return {
      classId: teacherClass.id,
      className: teacherClass.name,
      teacherName,
      language: teacherClass.language,
      curriculumPath: curriculumPath ? {
        id: curriculumPath.id,
        name: curriculumPath.name,
        description: curriculumPath.description
      } : undefined,
      units: unitsWithLessons,
      assignments: publishedAssignments.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        isSubmitted: submissionMap.get(a.id)?.isSubmitted || false,
        grade: submissionMap.get(a.id)?.grade
      })),
      progress: {
        lessonsCompleted: completedLessons,
        totalLessons,
        assignmentsCompleted: completedAssignments.length,
        totalAssignments: publishedAssignments.length
      }
    };
  } catch (error) {
    console.error(`[CurriculumContext] Error building context for class ${teacherClass.id}:`, error);
    return null;
  }
}

function generateContextSummary(classes: ClassContext[], studentName: string): string {
  if (classes.length === 0) {
    return `${studentName} is studying independently.`;
  }
  
  const classSummaries = classes.map(cls => {
    const progressPct = cls.progress.totalLessons > 0
      ? Math.round((cls.progress.lessonsCompleted / cls.progress.totalLessons) * 100)
      : 0;
    
    const dueAssignments = cls.assignments.filter(a => 
      a.dueDate && new Date(a.dueDate) > new Date() && !a.isSubmitted
    );
    
    let summary = `${cls.className} (${cls.language}): ${progressPct}% complete`;
    
    if (dueAssignments.length > 0) {
      summary += `, ${dueAssignments.length} assignment${dueAssignments.length > 1 ? 's' : ''} due`;
    }
    
    return summary;
  });
  
  return `${studentName} is enrolled in: ${classSummaries.join('; ')}`;
}

export function formatCurriculumContextForTutor(context: StudentCurriculumContext): string {
  if (context.enrolledClasses.length === 0) {
    return '';
  }
  
  let output = `\n\n📚 STUDENT CLASS CONTEXT:\n`;
  output += context.summary + '\n\n';
  
  const classesToShow = context.enrolledClasses.slice(0, MAX_CLASSES_IN_CONTEXT);
  
  for (const cls of classesToShow) {
    output += `📖 ${cls.className} (${cls.language}):\n`;
    
    if (cls.curriculumPath) {
      output += `   Curriculum: ${cls.curriculumPath.name}\n`;
    }
    
    output += `   Progress: ${cls.progress.lessonsCompleted}/${cls.progress.totalLessons} lessons\n`;
    output += `   Assignments: ${cls.progress.assignmentsCompleted}/${cls.progress.totalAssignments} completed\n`;
    
    const nextLesson = findNextLesson(cls);
    if (nextLesson) {
      output += `   ➡️ NEXT UP: "${nextLesson.name}" in ${nextLesson.unitName}\n`;
    }
    
    const dueAssignments = cls.assignments.filter(a => 
      a.dueDate && new Date(a.dueDate) > new Date() && !a.isSubmitted
    ).sort((a, b) => 
      (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - 
      (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
    );
    
    if (dueAssignments.length > 0) {
      output += `   📋 Due Soon:\n`;
      for (const assignment of dueAssignments.slice(0, MAX_ASSIGNMENTS_PER_CLASS)) {
        const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date';
        output += `      - "${assignment.title}" (due ${dueDate})\n`;
      }
    }
    
    output += '\n';
  }
  
  if (context.enrolledClasses.length > MAX_CLASSES_IN_CONTEXT) {
    output += `   (+ ${context.enrolledClasses.length - MAX_CLASSES_IN_CONTEXT} more classes)\n\n`;
  }
  
  output += `INSTRUCTIONS: If the student asks about their class, syllabus, "what's next", assignments, or progress, use this context to give a helpful, accurate response. Be encouraging!\n`;
  
  return output;
}

function findNextLesson(cls: ClassContext): { name: string; unitName: string } | null {
  for (const unit of cls.units) {
    for (const lesson of unit.lessons) {
      if (!lesson.isCompleted) {
        return { name: lesson.name, unitName: unit.name };
      }
    }
  }
  return null;
}

export function formatTutorSwitchContext(
  currentLanguage: string,
  targetLanguage: string,
  enrolledClasses: ClassContext[]
): string {
  const targetClass = enrolledClasses.find(
    c => c.language.toLowerCase() === targetLanguage.toLowerCase()
  );
  
  if (targetClass) {
    return `\n🔄 TUTOR SWITCH: Student is switching from ${currentLanguage} to ${targetLanguage}. ` +
           `They are enrolled in "${targetClass.className}". ` +
           `Greet them as their ${targetLanguage} tutor and ask how you can help with their ${targetLanguage} learning today.\n`;
  }
  
  return `\n🔄 TUTOR SWITCH: Student is switching from ${currentLanguage} to ${targetLanguage}. ` +
         `They are studying ${targetLanguage} independently. ` +
         `Greet them as their ${targetLanguage} tutor and ask how you can help with their ${targetLanguage} learning today.\n`;
}

function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSyllabusQuery(userMessage: string): {
  isSyllabusQuery: boolean;
  queryType?: 'next_lesson' | 'progress' | 'assignments' | 'class_info' | 'tutor_switch';
  targetLanguage?: string;
  targetClass?: string;
} {
  const normalizedMessage = normalizeMessage(userMessage);
  
  const tutorSwitchPatterns = [
    /(?:talk to|speak (?:to|with)|switch to|let me talk to|get|call)(?: my)? (\w+) tutor/i,
    /(?:can i|i want to|id like to) (?:talk to|speak (?:to|with)|practice|learn) (\w+)/i,
    /(?:switch|change) (?:to|language to) (\w+)/i,
    /(?:let's do|let me do|can we do) (\w+)/i,
    /practice (?:my )?(\w+)/i,
  ];
  
  for (const pattern of tutorSwitchPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      const lang = match[1].toLowerCase();
      const validLanguages = ['spanish', 'french', 'german', 'italian', 'portuguese', 'japanese', 'mandarin', 'chinese', 'korean', 'english', 'hebrew'];
      if (validLanguages.some(l => lang.includes(l))) {
        return { isSyllabusQuery: true, queryType: 'tutor_switch', targetLanguage: lang };
      }
    }
  }
  
  const nextLessonKeywords = [
    'whats next', 'what is next', 'what comes next',
    'next lesson', 'next topic', 'next unit',
    'what should i learn', 'what should i study', 'what should i practice', 'what should i do',
    'whats coming up', 'what is coming up',
    'where am i', 'where are we',
    'whats after this', 'what is after this',
    'when is my next lesson', 'what do i learn next',
    'what to learn', 'what to study', 'what to practice'
  ];
  
  if (nextLessonKeywords.some(kw => normalizedMessage.includes(kw))) {
    return { isSyllabusQuery: true, queryType: 'next_lesson' };
  }
  
  const progressKeywords = [
    'how am i doing', 'hows my', 'how is my',
    'my progress', 'show me my progress', 'check my progress',
    'what have i learned', 'what have i covered', 'what have i completed',
    'how far am i', 'how much have i done', 'am i on track',
    'how am i progressing', 'my performance', 'my stats'
  ];
  
  if (progressKeywords.some(kw => normalizedMessage.includes(kw))) {
    return { isSyllabusQuery: true, queryType: 'progress' };
  }
  
  const assignmentKeywords = [
    'assignment', 'assignments', 'homework', 'homeworks',
    'due date', 'due dates', 'when is it due', 'when are they due',
    'whats due', 'what is due', 'anything due',
    'do i have any', 'do i have homework', 'do i have assignments',
    'what homework do i have', 'any homework', 'pending work',
    'upcoming work', 'upcoming assignments', 'tasks', 'my tasks'
  ];
  
  if (assignmentKeywords.some(kw => normalizedMessage.includes(kw))) {
    return { isSyllabusQuery: true, queryType: 'assignments' };
  }
  
  const classKeywords = [
    'my class', 'my classes', 'about my class',
    'syllabus', 'curriculum', 'course',
    'class schedule', 'class info', 'class information',
    'what class', 'which class', 'enrolled', 'enrollment'
  ];
  
  if (classKeywords.some(kw => normalizedMessage.includes(kw))) {
    return { isSyllabusQuery: true, queryType: 'class_info' };
  }
  
  return { isSyllabusQuery: false };
}
