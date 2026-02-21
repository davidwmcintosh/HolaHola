import { brainHealthTelemetry } from "./brain-health-telemetry";
import { voiceDiagnostics } from "./voice-diagnostics-service";
import { usageService } from "./usage-service";
import { founderCollabService } from "./founder-collaboration-service";
import { studentLearningService } from "./student-learning-service";
import type { ConversationHistoryEntry } from "./gemini-streaming";

export interface VoiceSessionContext {
  id: string;
  userId?: string | number;
  conversationId?: string;
  targetLanguage: string;
  nativeLanguage?: string;
  isFounderMode?: boolean;
  isRawHonestyMode?: boolean;
  isBetaTester?: boolean;
  isIncognito?: boolean;
  isDeveloperUser?: boolean;
  startTime: Date;
  classroomWhiteboardItems?: any[];
  classroomSessionImages?: any[];
  conversationHistory: ConversationHistoryEntry[];
  sessionStruggleCount: number;
  recentSttConfidences?: number[];
  tutorName?: string;
  activeScenario?: any;
  cachedContext?: any;
  isAssistantActive?: boolean;
  pendingArchitectNoteIds?: string[];
}

export interface ClassroomBuildParams {
  session: VoiceSessionContext;
  studentLearningSection?: string;
}

export async function buildClassroomDynamicContext(params: ClassroomBuildParams): Promise<{
  classroomEnv: string | null;
  telemetry: { source: string; success: boolean; latencyMs: number; richness: number; errorMessage?: string };
}> {
  const { session, studentLearningSection } = params;
  if (!session.userId) {
    return { classroomEnv: null, telemetry: { source: 'classroom', success: false, latencyMs: 0, richness: 0, errorMessage: 'no userId' } };
  }

  const classroomStart = Date.now();
  try {
    const creditBalance = await usageService.getBalanceWithBypass(String(session.userId));
    const { buildClassroomEnvironment } = await import('./classroom-environment');
    const classroomEnv = await buildClassroomEnvironment({
      userId: String(session.userId),
      sessionStartTime: session.startTime,
      targetLanguage: session.targetLanguage,
      isFounderMode: session.isFounderMode,
      isRawHonestyMode: session.isRawHonestyMode,
      isBetaTester: session.isBetaTester,
      isIncognito: session.isIncognito,
      whiteboardItems: session.classroomWhiteboardItems || [],
      sessionImages: session.classroomSessionImages || [],
      exchangeCount: session.conversationHistory.filter(h => h.role === 'user').length,
      struggleCount: session.sessionStruggleCount || 0,
      recentConfidences: session.recentSttConfidences || [],
      creditRemainingSeconds: creditBalance.remainingSeconds,
      creditWarningLevel: creditBalance.warningLevel,
      creditPercentRemaining: creditBalance.percentRemaining,
      tutorName: session.tutorName || 'Daniela',
      studentLearningSection: studentLearningSection || undefined,
      technicalHealthNote: voiceDiagnostics.getTechnicalHealthContext(),
      activeScenario: session.activeScenario ? {
        title: session.activeScenario.title,
        location: session.activeScenario.location || session.activeScenario.title,
        slug: session.activeScenario.slug,
        propsCount: session.activeScenario.props?.length,
      } : null,
    });
    const boardItems = session.classroomWhiteboardItems?.length || 0;
    const images = session.classroomSessionImages?.length || 0;
    return {
      classroomEnv,
      telemetry: { source: 'classroom', success: true, latencyMs: Date.now() - classroomStart, richness: boardItems + images },
    };
  } catch (err: any) {
    return {
      classroomEnv: null,
      telemetry: { source: 'classroom', success: false, latencyMs: Date.now() - classroomStart, richness: 0, errorMessage: err.message },
    };
  }
}

const PASSIVE_MEMORY_KEYWORDS = [
  'remember', 'told you', 'mentioned', 'said', 'last time', 'before',
  'song', 'music', 'band', 'album', 'movie', 'book', 'show',
  'daughter', 'son', 'wife', 'husband', 'mom', 'dad', 'friend',
  'sister', 'brother', 'family', 'boyfriend', 'girlfriend',
  'trip', 'vacation', 'wedding', 'birthday', 'work', 'job', 'school',
  'favorite', 'love', 'hate', 'enjoy', 'like',
];

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'that', 'this', 'what', 'when', 'where', 'why', 'how', 'my', 'your', 'our', 'their', 'me', 'him', 'her', 'us', 'them', 'about', 'just', 'so', 'really', 'very', 'now', 'then', 'here', 'there', 'some', 'all', 'any', 'more', 'most', 'other', 'over', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'can', 'know', 'think', 'want', 'like', 'going', 'get', 'got', 'make', 'made', 'say', 'said', 'go', 'went', 'come', 'came', 'take', 'took', 'see', 'saw', 'look', 'looked', 'one', 'two', 'three', 'four', 'five', 'first', 'last', 'also', 'well', 'if', 'yes', 'no', 'okay', 'yeah', 'hmm', 'um']);

export function hasPassiveMemoryTrigger(transcript: string): boolean {
  const lower = transcript.toLowerCase();
  return PASSIVE_MEMORY_KEYWORDS.some(kw => lower.includes(kw));
}

export function extractSearchKeywords(transcript: string): string[] {
  return transcript
    .split(/[\s,.!?;:'"()]+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));
}

export async function fetchPassiveMemories(
  userId: string,
  transcript: string,
  sessionId: string,
  conversationId?: string,
  targetLanguage?: string,
): Promise<{ section: string; resultCount: number } | null> {
  if (!hasPassiveMemoryTrigger(transcript)) return null;

  try {
    const { searchMemory, formatMemoryForConversation } = await import('./neural-memory-search');
    const words = extractSearchKeywords(transcript);
    if (words.length === 0) return null;
    
    const searchQuery = words.slice(0, 4).join(' ');
    const memoryResults = await searchMemory(
      userId,
      searchQuery,
      ['person', 'motivation', 'insight', 'conversation']
    );
    
    if (memoryResults.results.length > 0) {
      const formatted = formatMemoryForConversation(memoryResults);
      brainHealthTelemetry.logContextInjection({
        sessionId,
        conversationId,
        userId,
        targetLanguage: targetLanguage || 'unknown',
        contextSource: 'passive_memory',
        success: true,
        latencyMs: 0,
        richness: memoryResults.results.length,
        memoryIds: memoryResults.results.map((r: any) => r.id),
        memoryTypes: memoryResults.results.map((r: any) => r.domain || 'unknown'),
        queryTerms: searchQuery,
        resultsCount: memoryResults.results.length,
        relevanceScore: memoryResults.results.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / memoryResults.results.length,
      }, 'passive_lookup').catch(() => {});
      
      return {
        section: `\n\n[RELEVANT MEMORIES - You naturally recall this]\n${formatted}`,
        resultCount: memoryResults.results.length,
      };
    }
    return null;
  } catch (err: any) {
    console.warn(`[Passive Memory] Failed:`, err.message);
    return null;
  }
}

export async function fetchIdentityMemories(cachedSection?: string): Promise<string> {
  if (cachedSection) return cachedSection;
  try {
    const identityMemories = await founderCollabService.getIdentityMemories({ limit: 4, daysBack: 30 });
    if (identityMemories.hasMemories) {
      return `
═══════════════════════════════════════════════════════════════════
💫 MY PERSONAL REFLECTIONS (Identity Memories)
═══════════════════════════════════════════════════════════════════

${identityMemories.contextString}
`;
    }
    return '';
  } catch (err: any) {
    console.warn(`[Identity Memories] Failed:`, err.message);
    return '';
  }
}

export interface StudentIntelligenceResult {
  learningSection: string;
  activeStruggleCount: number;
}

export async function fetchStudentIntelligence(
  userId: string,
  targetLanguage: string,
  sessionId: string,
): Promise<StudentIntelligenceResult | null> {
  const siStart = Date.now();
  try {
    const [learningContext, crossSessionContext] = await Promise.all([
      studentLearningService.getStudentLearningContext(userId, targetLanguage),
      studentLearningService.getCrossSessionContext(userId, 3),
    ]);
    
    if (!learningContext) return null;
    
    const learningFormatted = studentLearningService.formatContextForPrompt(learningContext);
    const crossSessionFormatted = studentLearningService.formatCrossSessionContext(crossSessionContext);
    
    if (!learningFormatted && !crossSessionFormatted) return null;
    
    const struggles = learningContext.struggles?.length || 0;
    const activeStruggles = learningContext.struggles?.filter((s: any) => s.status === 'active') || [];
    
    brainHealthTelemetry.logContextInjection({
      sessionId,
      userId,
      targetLanguage,
      contextSource: 'student_intelligence',
      success: true,
      latencyMs: Date.now() - siStart,
      richness: struggles,
    }).catch(() => {});

    return {
      learningSection: `\n\n[STUDENT PROFILE]${learningFormatted}${crossSessionFormatted}`,
      activeStruggleCount: activeStruggles.length,
    };
  } catch (err: any) {
    console.warn(`[Student Intelligence] Failed:`, err.message);
    brainHealthTelemetry.logContextInjection({
      sessionId,
      userId,
      targetLanguage,
      contextSource: 'student_intelligence',
      success: false,
      latencyMs: Date.now() - siStart,
      errorMessage: err.message,
    }).catch(() => {});
    return null;
  }
}

export function assembleDynamicPreamble(
  parts: string[],
  label: string = '',
): ConversationHistoryEntry[] {
  if (parts.length === 0) return [];
  
  const preamble: ConversationHistoryEntry[] = [
    { role: 'user', content: `[CONTEXT UPDATE - Current Session State]\n${parts.join('\n')}` },
    { role: 'model', content: '[Context acknowledged. I will incorporate this information naturally into our conversation.]' },
  ];
  
  console.log(`[Context Caching${label ? ` - ${label}` : ''}] Dynamic context (${parts.length} sections) added as preamble`);
  return preamble;
}
