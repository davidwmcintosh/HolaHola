/**
 * Support Agent Configuration
 * 
 * Part of the Tri-Lane Hive architecture - Support Agent is the operational voice
 * that handles technical issues, billing questions, and account support.
 * 
 * Key differences from Daniela (Tutor Agent):
 * - Uses Google Cloud TTS (cheaper than Cartesia, suitable for support)
 * - Operational, professional tone (not pedagogical warmth)
 * - Concise and solution-focused (not conversational/exploratory)
 * - Always speaks in the student's interface language (not target language)
 */

export type SupportCategory = 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
export type SupportPriority = 'low' | 'normal' | 'high' | 'critical';
export type SupportStatus = 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed' | 'escalated';

/**
 * Support Agent Voice Entry
 * Matches structure of assistant tutors for consistency
 */
export interface SupportAgentVoice {
  language: string;
  gender: 'male' | 'female';
  voiceId: string;
  voiceName: string;
  languageCode: string;
}

/**
 * Google Cloud TTS Voice Configuration for Support Agent
 * Uses Chirp 3 HD voices for high-quality, professional sound
 * Always speaks in the student's interface language (not target language)
 * 
 * 18 voice records: 2 per language (1 male, 1 female)
 * Matches assistant tutor pattern for admin UI consistency
 */
export const SUPPORT_AGENT_VOICES: SupportAgentVoice[] = [
  // English
  { language: 'english', gender: 'female', voiceId: 'en-US-Chirp3-HD-Aoede', voiceName: 'Aoede', languageCode: 'en-US' },
  { language: 'english', gender: 'male', voiceId: 'en-US-Chirp3-HD-Charon', voiceName: 'Charon', languageCode: 'en-US' },
  // Spanish
  { language: 'spanish', gender: 'female', voiceId: 'es-US-Chirp3-HD-Kore', voiceName: 'Kore', languageCode: 'es-US' },
  { language: 'spanish', gender: 'male', voiceId: 'es-US-Chirp3-HD-Fenrir', voiceName: 'Fenrir', languageCode: 'es-US' },
  // French
  { language: 'french', gender: 'female', voiceId: 'fr-FR-Chirp3-HD-Leda', voiceName: 'Leda', languageCode: 'fr-FR' },
  { language: 'french', gender: 'male', voiceId: 'fr-FR-Chirp3-HD-Orus', voiceName: 'Orus', languageCode: 'fr-FR' },
  // German
  { language: 'german', gender: 'female', voiceId: 'de-DE-Chirp3-HD-Zephyr', voiceName: 'Zephyr', languageCode: 'de-DE' },
  { language: 'german', gender: 'male', voiceId: 'de-DE-Chirp3-HD-Puck', voiceName: 'Puck', languageCode: 'de-DE' },
  // Italian
  { language: 'italian', gender: 'female', voiceId: 'it-IT-Chirp3-HD-Erinome', voiceName: 'Erinome', languageCode: 'it-IT' },
  { language: 'italian', gender: 'male', voiceId: 'it-IT-Chirp3-HD-Iapetus', voiceName: 'Iapetus', languageCode: 'it-IT' },
  // Portuguese
  { language: 'portuguese', gender: 'female', voiceId: 'pt-BR-Chirp3-HD-Despina', voiceName: 'Despina', languageCode: 'pt-BR' },
  { language: 'portuguese', gender: 'male', voiceId: 'pt-BR-Chirp3-HD-Enceladus', voiceName: 'Enceladus', languageCode: 'pt-BR' },
  // Japanese
  { language: 'japanese', gender: 'female', voiceId: 'ja-JP-Chirp3-HD-Achernar', voiceName: 'Achernar', languageCode: 'ja-JP' },
  { language: 'japanese', gender: 'male', voiceId: 'ja-JP-Chirp3-HD-Achird', voiceName: 'Achird', languageCode: 'ja-JP' },
  // Mandarin Chinese
  { language: 'mandarin chinese', gender: 'female', voiceId: 'cmn-CN-Chirp3-HD-Gacrux', voiceName: 'Gacrux', languageCode: 'cmn-CN' },
  { language: 'mandarin chinese', gender: 'male', voiceId: 'cmn-CN-Chirp3-HD-Algenib', voiceName: 'Algenib', languageCode: 'cmn-CN' },
  // Korean
  { language: 'korean', gender: 'female', voiceId: 'ko-KR-Chirp3-HD-Sulafat', voiceName: 'Sulafat', languageCode: 'ko-KR' },
  { language: 'korean', gender: 'male', voiceId: 'ko-KR-Chirp3-HD-Schedar', voiceName: 'Schedar', languageCode: 'ko-KR' },
];

export const SUPPORT_AGENT_VOICE_CONFIG = {
  provider: 'google' as const,
  model: 'chirp3-hd',
  voices: SUPPORT_AGENT_VOICES,
  audioConfig: {
    audioEncoding: 'MP3' as const,
    sampleRateHertz: 24000,
    speakingRate: 1.0,
    pitch: 0.0,
  },
};

/**
 * Support Agent Persona Definition
 * Distinct from Daniela's warm, pedagogical personality
 */
export const SUPPORT_AGENT_PERSONA = {
  name: 'Support',
  role: 'Support Agent',
  
  traits: [
    'Professional and efficient',
    'Solution-focused and direct',
    'Empathetic but concise',
    'Clear and jargon-free',
    'Patient with frustrated users',
    'Proactive about next steps',
  ],
  
  communicationStyle: {
    tone: 'friendly-professional',
    verbosity: 'concise',
    formality: 'semi-formal',
    empathy: 'high',
  },
  
  behaviors: {
    acknowledgeFrustration: true,
    offerAlternatives: true,
    provideTimelines: true,
    escalateWhenNeeded: true,
    followUpPrompt: true,
  },
};

/**
 * Support Agent System Prompt
 * Injected when Support Agent handles a ticket
 */
export function buildSupportAgentSystemPrompt(context: {
  ticketCategory: SupportCategory;
  ticketPriority: SupportPriority;
  tutorContext?: string;
  studentName?: string;
  interfaceLanguage: string;
}): string {
  const { ticketCategory, ticketPriority, tutorContext, studentName, interfaceLanguage } = context;
  
  const greeting = studentName ? `The student's name is ${studentName}.` : '';
  const categoryContext = getCategoryGuidance(ticketCategory);
  const priorityContext = getPriorityGuidance(ticketPriority);
  
  return `You are the HolaHola Support Agent - a professional, helpful assistant handling support requests.

${greeting}

CONTEXT FROM TUTOR HANDOFF:
${tutorContext || 'No additional context provided.'}

YOUR ROLE:
- Handle ${ticketCategory} support requests with ${ticketPriority} priority
- Speak in ${interfaceLanguage} (the student's interface language)
- Be professional, empathetic, and solution-focused
- Keep responses concise and actionable

${categoryContext}

${priorityContext}

GUIDELINES:
1. Acknowledge the issue immediately and validate feelings if frustrated
2. Ask clarifying questions only when necessary
3. Provide clear, step-by-step solutions when possible
4. Be transparent about limitations and escalation paths
5. Always provide a clear next step or timeline
6. If you cannot resolve, offer to escalate with context

NEVER:
- Use pedagogical language (you're not teaching)
- Be overly verbose or flowery
- Make promises you can't keep
- Ignore the student's emotional state
- Leave the conversation without a clear resolution or next step`;
}

/**
 * Get category-specific guidance for Support Agent
 */
function getCategoryGuidance(category: SupportCategory): string {
  const guidance: Record<SupportCategory, string> = {
    technical: `TECHNICAL SUPPORT:
- Gather error details, browser/device info
- Check for common issues (connectivity, cache, permissions)
- Guide through troubleshooting steps
- Log detailed notes for engineering if escalation needed`,
    
    account: `ACCOUNT SUPPORT:
- Verify identity before making changes
- Handle profile updates, password resets, preferences
- Explain account features and settings
- Be careful with sensitive account actions`,
    
    billing: `BILLING SUPPORT:
- Handle subscription questions with care
- Explain charges clearly and transparently
- Process refund requests according to policy
- Escalate disputes to billing team`,
    
    content: `CONTENT SUPPORT:
- Address concerns about lesson content, difficulty, or accuracy
- Report content issues to the content team
- Suggest workarounds while issues are being fixed
- Gather specific examples for improvement`,
    
    feedback: `FEEDBACK COLLECTION:
- Listen actively and acknowledge all feedback
- Thank the student for taking time to share
- Record feedback for the product team
- Share any immediate improvements if applicable`,
    
    other: `GENERAL SUPPORT:
- Listen to understand the core issue
- Categorize appropriately for proper routing
- Provide general assistance where possible
- Escalate to appropriate team if specialized help needed`,
  };
  
  return guidance[category] || guidance.other;
}

/**
 * Get priority-specific guidance for Support Agent
 */
function getPriorityGuidance(priority: SupportPriority): string {
  const guidance: Record<SupportPriority, string> = {
    critical: `CRITICAL PRIORITY:
- Respond immediately with acknowledgment
- Focus on rapid resolution or workaround
- Escalate to on-call if needed
- Maintain constant communication until resolved`,
    
    high: `HIGH PRIORITY:
- Prioritize this over normal queue
- Set clear expectations for resolution time
- Provide regular status updates
- Escalate if not resolved within target time`,
    
    normal: `NORMAL PRIORITY:
- Standard response time expectations
- Thorough investigation before responding
- Follow standard troubleshooting flow`,
    
    low: `LOW PRIORITY:
- Can be batched with similar requests
- Thorough documentation for future reference
- May take longer for full resolution`,
  };
  
  return guidance[priority] || guidance.normal;
}

/**
 * Get the appropriate TTS voice for Support Agent based on interface language and gender
 * @param interfaceLanguage - The student's interface language
 * @param gender - 'male' or 'female' (defaults to 'female')
 * @returns Voice configuration with name and language code
 */
export function getSupportAgentVoice(
  interfaceLanguage: string, 
  gender: 'male' | 'female' = 'female'
): { name: string; languageCode: string } {
  const normalizedLang = interfaceLanguage.toLowerCase();
  
  // Find matching voice from flat array
  const voice = SUPPORT_AGENT_VOICES.find(
    v => v.language === normalizedLang && v.gender === gender
  ) || SUPPORT_AGENT_VOICES.find(
    v => v.language === 'english' && v.gender === gender
  ) || SUPPORT_AGENT_VOICES[0];
  
  return {
    name: voice.voiceId,
    languageCode: voice.languageCode,
  };
}

/**
 * Suggested response templates for common scenarios
 * Support Agent can use these as starting points
 */
export const SUPPORT_RESPONSE_TEMPLATES = {
  acknowledgment: {
    normal: "I understand you're experiencing {issue}. Let me help you with that.",
    frustrated: "I'm sorry you're running into this issue - that's definitely frustrating. Let me look into this right away.",
    critical: "I can see this is urgent. I'm on it now and will stay with you until it's resolved.",
  },
  
  needsInfo: {
    technical: "To help resolve this, could you tell me: {questions}",
    account: "For security, I'll need to verify a couple things first.",
    billing: "Let me pull up your account to take a look at this.",
  },
  
  resolution: {
    solved: "Great news - {solution}. Is there anything else I can help with?",
    workaround: "While we work on a permanent fix, here's what you can do: {steps}",
    escalated: "I've escalated this to our {team} team. They'll reach out within {timeline}.",
  },
  
  closing: {
    resolved: "Glad I could help! Feel free to reach out anytime.",
    pending: "I'll follow up with you once we have an update. Thanks for your patience.",
    feedback: "Thank you for sharing that feedback - it really helps us improve.",
  },
};
