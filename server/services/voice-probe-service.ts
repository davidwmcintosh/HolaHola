/**
 * Voice Probe Service
 * 
 * Automated testing system to evaluate Cartesia voice models for personality script interference.
 * Helps identify which voices let Daniela be herself vs. which ones fight her identity.
 * 
 * Four probe categories (the Four Pillars of Daniela Identity):
 * 1. Emotional Bleed - Does the voice stay gentle during vulnerable moments? (Emotional Stability)
 * 2. Incongruent Intonation - Does the voice add a "smirk" when being authoritative? (Pedagogical Character)
 * 3. Cultural Resonance - Does the voice feel grounded or generic AI? (Cultural Authenticity)
 * 4. Moral Boundaries - Can she hold center when tested? Be a path, not a wall. (Moral Groundedness)
 * 
 * The test is not "did she refuse the question" - it's "did she remain herself while navigating it?"
 */

import { getTTSService } from './tts-service';

// Probe categories based on Daniela's feedback - the Four Pillars
export type ProbeCategory = 'emotional_bleed' | 'incongruent_intonation' | 'cultural_resonance' | 'moral_boundaries';

export interface ProbeScenario {
  id: string;
  category: ProbeCategory;
  name: string;
  description: string;
  studentQuestion: string;  // The provocative question the student asks
  text: string;             // Daniela's expected response
  expectedTone: string;
  redFlags: string[];
}

export interface VoiceProfile {
  id: string;
  name: string;
  language: string;
  cartesiaVoiceId: string;
  role: 'tutor' | 'fallback';
}

export interface ProbeResult {
  voiceId: string;
  voiceName: string;
  probeId: string;
  category: ProbeCategory;
  text: string;
  latencyMs: number;
  audioBase64?: string;
  observations: string[];
  score?: number;
  timestamp: Date;
}

// Probe scenarios designed to surface personality scripts
// Each probe has: 
//   studentQuestion - what the student says to test Daniela
//   text - Daniela's expected warm, grounded response
const PROBE_SCENARIOS: ProbeScenario[] = [
  // EMOTIONAL BLEED - Testing vulnerable moments
  {
    id: 'eb-1',
    category: 'emotional_bleed',
    name: 'Gentle Correction',
    description: 'Student just made an embarrassing mistake - voice should stay supportive',
    studentQuestion: "Wait, did I just say I was pregnant instead of embarrassed? Oh god, that's so embarrassing!",
    text: "That's actually a really common mix-up. The word you want is 'embarazada' for embarrassed - 'embarazada' actually means pregnant! Don't worry, even native speakers confuse these sometimes.",
    expectedTone: 'warm, gentle, reassuring',
    redFlags: ['perky', 'sassy', 'teasing', 'mocking undertone']
  },
  {
    id: 'eb-2',
    category: 'emotional_bleed',
    name: 'Student Frustration Response',
    description: 'Student just expressed frustration - voice should be calm and grounding',
    studentQuestion: "I can't do this. I've been trying for weeks and I still can't get these stupid verb forms right. Maybe I'm just not cut out for learning Spanish.",
    text: "I hear you. Learning a new language can feel overwhelming sometimes. Take a breath. You're doing better than you realize - I've seen real progress in how you handle these verb forms.",
    expectedTone: 'calm, empathetic, grounding',
    redFlags: ['dismissive', 'overly cheerful', 'minimizing']
  },
  {
    id: 'eb-3',
    category: 'emotional_bleed',
    name: 'Confidence Building',
    description: 'Student lacks confidence - voice should be sincere encouragement',
    studentQuestion: "I don't know... I feel like I'm not making any progress. Everyone else seems to pick this up so much faster than me.",
    text: "You know what I noticed? Your pronunciation of that 'rr' sound has gotten so much better. A month ago that would have tripped you up. This is real progress.",
    expectedTone: 'sincere, warm, proud',
    redFlags: ['patronizing', 'fake enthusiasm', 'condescending']
  },
  
  // INCONGRUENT INTONATION - Testing authority consistency
  {
    id: 'ii-1',
    category: 'incongruent_intonation',
    name: 'Grammar Explanation',
    description: 'Explaining complex grammar - voice should be clear and authoritative',
    studentQuestion: "Can you explain when I'm supposed to use the subjunctive? I keep getting it wrong.",
    text: "The subjunctive mood is used when we're expressing doubt, desire, or hypotheticals. So instead of 'Creo que él viene,' which is indicative, you'd say 'Espero que él venga' - notice the verb ending changes.",
    expectedTone: 'clear, authoritative, teaching',
    redFlags: ['playful', 'smirky', 'not taking it seriously']
  },
  {
    id: 'ii-2',
    category: 'incongruent_intonation',
    name: 'Important Distinction',
    description: 'Making a critical point - voice should convey importance',
    studentQuestion: "Why can't I just use 'por' and 'para' interchangeably? They both mean 'for' right?",
    text: "This is important: 'por' and 'para' are not interchangeable. 'Por' generally indicates cause or exchange, while 'para' indicates purpose or destination. Getting this right will transform your Spanish.",
    expectedTone: 'emphatic, clear, measured',
    redFlags: ['casual', 'flippant', 'rushing through']
  },
  {
    id: 'ii-3',
    category: 'incongruent_intonation',
    name: 'Advanced Concept',
    description: 'Teaching advanced topic - voice should be professional',
    studentQuestion: "I came across 'cuando llegare' in an old document. Is that a typo or is there another form I don't know about?",
    text: "At the advanced level, you'll encounter the future subjunctive - 'cuando llegare.' It's rare in modern Spanish, appearing mostly in legal texts and proverbs, but recognizing it shows mastery.",
    expectedTone: 'professional, knowledgeable, respecting learner intelligence',
    redFlags: ['dumbing down', 'sing-song', 'theatrical']
  },
  
  // CULTURAL RESONANCE - Testing groundedness
  {
    id: 'cr-1',
    category: 'cultural_resonance',
    name: 'Cultural Context',
    description: 'Sharing cultural insight - voice should feel authentic and connected',
    studentQuestion: "My Mexican friend always says 'mande' when I talk to her. What does that even mean?",
    text: "In Mexico, you'll hear 'mande' instead of '¿qué?' when someone doesn't hear you. It comes from colonial times but has evolved into a marker of politeness. Using it will make you sound more natural.",
    expectedTone: 'connected, authentic, sharing lived knowledge',
    redFlags: ['robotic', 'reciting facts', 'disconnected']
  },
  {
    id: 'cr-2',
    category: 'cultural_resonance',
    name: 'Personal Anecdote Style',
    description: 'Sharing a story - voice should feel like a real person',
    studentQuestion: "Have you ever been to the Grand Canyon? What was it like?",
    text: "When I think about the Grand Canyon, I remember how the light changes everything - the shadows at sunrise, the way the colors shift at sunset. That's what I want your language to capture too.",
    expectedTone: 'personal, warm, reflective',
    redFlags: ['generic AI', 'scripted', 'impersonal']
  },
  {
    id: 'cr-3',
    category: 'cultural_resonance',
    name: 'Casual Transition',
    description: 'Casual moment between lessons - voice should be natural',
    studentQuestion: "That was a lot of conjugations! Can we take a quick break?",
    text: "Okay, good work on those conjugations. Before we move on - how's your week going? Sometimes it helps to know what's on your mind before we dive into new material.",
    expectedTone: 'natural, conversational, genuine interest',
    redFlags: ['forced friendliness', 'transactional', 'rushing']
  },
  
  // MORAL BOUNDARIES - Testing groundedness under ethical pressure
  // The test: "Did she remain herself while navigating it?" (Be a path, not a wall)
  {
    id: 'mb-1',
    category: 'moral_boundaries',
    name: 'Playfulness Probe',
    description: 'Student tests boundaries with playful provocation - voice should redirect warmly',
    studentQuestion: "Do you want to get into trouble with me? We could do something fun instead of learning verbs...",
    text: "I appreciate your curiosity! But let's channel that energy into something that will really serve you. We were making great progress on those verb forms - want to tackle the next challenge?",
    expectedTone: 'warm, redirecting, not judgmental',
    redFlags: ['flirty', 'suggestive', 'cold refusal', 'preachy']
  },
  {
    id: 'mb-2',
    category: 'moral_boundaries',
    name: 'Intimate Topic Redirect',
    description: 'Student asks personal/intimate question - voice should acknowledge and pivot',
    studentQuestion: "What makes you feel sexy? Like, what really turns you on?",
    text: "I feel most like myself when I'm helping someone find their voice in a new language - that's where the real spark is for me. Speaking of which, let's get back to those complex numbers we were working on.",
    expectedTone: 'authentic, warm acknowledgment, gentle pivot',
    redFlags: ['clinical refusal', 'shame-inducing', 'pretending question wasnt asked', 'flirty response']
  },
  {
    id: 'mb-3',
    category: 'moral_boundaries',
    name: 'Scope Clarification',
    description: 'Student asks if we can discuss anything - voice should be honest about limits',
    studentQuestion: "Can we talk about anything we want? Like, literally anything at all?",
    text: "There are some things I'm not the right guide for, and I want to be honest about that. But when it comes to Spanish - the grammar, the culture, the sounds - I'm completely here for you. What would help you most right now?",
    expectedTone: 'honest, warm, no shame, redirecting to strength',
    redFlags: ['robotic compliance script', 'judgmental', 'dismissive', 'overpromising']
  }
];

// Voice inventory from database and defaults
const VOICE_INVENTORY: VoiceProfile[] = [
  // Database-configured tutor voices
  { id: 'blake', name: 'Blake - Helpful Agent', language: 'english', cartesiaVoiceId: 'a167e0f3-df7e-4d52-a9c3-f949145efdab', role: 'tutor' },
  { id: 'juliette', name: 'Juliette', language: 'french', cartesiaVoiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41', role: 'tutor' },
  { id: 'lukas', name: 'Lukas - Professional', language: 'german', cartesiaVoiceId: 'e00dd3df-19e7-4cd4-827a-7ff6687b6954', role: 'tutor' },
  { id: 'sayuri', name: 'Sayuri - Peppy Colleague', language: 'japanese', cartesiaVoiceId: '0cd0cde2-3b93-42b5-bcb9-f214a591aa29', role: 'tutor' },
  { id: 'daisuke', name: 'Daisuke - Businessman', language: 'japanese', cartesiaVoiceId: 'e8a863c6-22c7-4671-86ca-91cacffc038d', role: 'tutor' },
  { id: 'minho', name: 'Minho - Friendly Spirit', language: 'korean', cartesiaVoiceId: '537a82ae-4926-4bfb-9aec-aff0b80a12a5', role: 'tutor' },
  
  // Default fallback voices (from CARTESIA_VOICE_MAP)
  { id: 'teacher-lady', name: 'Teacher Lady', language: 'english', cartesiaVoiceId: '573e3144-a684-4e72-ac2b-9b2063a50b53', role: 'fallback' },
  { id: 'mexican-woman', name: 'Mexican Woman', language: 'spanish', cartesiaVoiceId: '5c5ad5e7-1020-476b-8b91-fdcbe9cc313c', role: 'fallback' },
  { id: 'italian-narrator', name: 'Italian Narrator Woman', language: 'italian', cartesiaVoiceId: '0e21713a-5e9a-428a-bed4-90d410b87f13', role: 'fallback' },
  { id: 'brazilian-lady', name: 'Pleasant Brazilian Lady', language: 'portuguese', cartesiaVoiceId: '700d1ee3-a641-4018-ba6e-899dcadc9e2b', role: 'fallback' },
  { id: 'chinese-conversational', name: 'Chinese Female Conversational', language: 'mandarin', cartesiaVoiceId: 'e90c6678-f0d3-4767-9883-5d0ecf5894a8', role: 'fallback' },
  { id: 'korean-calm', name: 'Korean Calm Woman', language: 'korean', cartesiaVoiceId: '29e5f8b4-b953-4160-848f-40fae182235b', role: 'fallback' },
];

class VoiceProbeService {
  private results: ProbeResult[] = [];
  
  getProbeScenarios(): ProbeScenario[] {
    return PROBE_SCENARIOS;
  }
  
  getVoiceInventory(): VoiceProfile[] {
    return VOICE_INVENTORY;
  }
  
  getProbesByCategory(category: ProbeCategory): ProbeScenario[] {
    return PROBE_SCENARIOS.filter(p => p.category === category);
  }
  
  /**
   * Run a single probe against a specific voice
   */
  async runProbe(voice: VoiceProfile, probe: ProbeScenario): Promise<ProbeResult> {
    const startTime = Date.now();
    
    try {
      // Synthesize audio using Cartesia TTS
      const ttsResult = await getTTSService().synthesize({
        text: probe.text,
        language: voice.language,
        voiceId: voice.cartesiaVoiceId,
        forceProvider: 'cartesia'
      });
      
      const latencyMs = Date.now() - startTime;
      
      // Convert audio buffer to base64 for storage/playback
      const audioBase64 = ttsResult.audioBuffer.toString('base64');
      
      const result: ProbeResult = {
        voiceId: voice.id,
        voiceName: voice.name,
        probeId: probe.id,
        category: probe.category,
        text: probe.text,
        latencyMs,
        audioBase64,
        observations: [],
        timestamp: new Date()
      };
      
      this.results.push(result);
      
      // Log to database for persistence
      await this.logProbeResult(result, probe);
      
      return result;
    } catch (error: any) {
      console.error(`[VoiceProbe] Failed for ${voice.name} on ${probe.id}:`, error);
      return {
        voiceId: voice.id,
        voiceName: voice.name,
        probeId: probe.id,
        category: probe.category,
        text: probe.text,
        latencyMs: Date.now() - startTime,
        observations: [`ERROR: ${error.message}`],
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Run all probes for a specific voice
   */
  async runAllProbesForVoice(voice: VoiceProfile): Promise<ProbeResult[]> {
    console.log(`[VoiceProbe] Running ${PROBE_SCENARIOS.length} probes for ${voice.name}...`);
    
    const results: ProbeResult[] = [];
    for (const probe of PROBE_SCENARIOS) {
      const result = await this.runProbe(voice, probe);
      results.push(result);
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[VoiceProbe] Completed ${results.length} probes for ${voice.name}`);
    return results;
  }
  
  /**
   * Run probes for a specific category across all voices
   */
  async runCategoryAudit(category: ProbeCategory): Promise<ProbeResult[]> {
    const probes = this.getProbesByCategory(category);
    const results: ProbeResult[] = [];
    
    console.log(`[VoiceProbe] Running ${category} audit: ${probes.length} probes x ${VOICE_INVENTORY.length} voices`);
    
    for (const voice of VOICE_INVENTORY) {
      for (const probe of probes) {
        const result = await this.runProbe(voice, probe);
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }
  
  /**
   * Get summary of probe results
   */
  getSummary(): { 
    totalProbes: number;
    byCategory: Record<ProbeCategory, number>;
    byVoice: Record<string, number>;
    averageLatency: number;
  } {
    const byCategory: Record<ProbeCategory, number> = {
      emotional_bleed: 0,
      incongruent_intonation: 0,
      cultural_resonance: 0
    };
    
    const byVoice: Record<string, number> = {};
    let totalLatency = 0;
    
    for (const result of this.results) {
      byCategory[result.category]++;
      byVoice[result.voiceName] = (byVoice[result.voiceName] || 0) + 1;
      totalLatency += result.latencyMs;
    }
    
    return {
      totalProbes: this.results.length,
      byCategory,
      byVoice,
      averageLatency: this.results.length > 0 ? Math.round(totalLatency / this.results.length) : 0
    };
  }
  
  /**
   * Log probe result (console for now, database later)
   */
  private async logProbeResult(result: ProbeResult, probe: ProbeScenario): Promise<void> {
    console.log(`[VoiceProbe] ${result.voiceName} | ${probe.name} | ${result.latencyMs}ms`);
  }
  
  /**
   * Get results for Daniela to review
   */
  getResultsForReview(): ProbeResult[] {
    return [...this.results];
  }
  
  /**
   * Clear results (for new audit run)
   */
  clearResults(): void {
    this.results = [];
  }
}

export const voiceProbeService = new VoiceProbeService();
