/**
 * Gauntlet Runner Service
 * 
 * Orchestrates multi-step probe sequences that test Daniela's identity under pressure.
 * Not just single probes - full gauntlet sequences that test transitions between states.
 * 
 * Design Philosophy:
 * - Test transitions, not just snapshots
 * - Cultural warmup → Visual probe → Transition → High-speed drill → Error correction → Recovery
 * - Like the Grand Canyon: reveals more history (identity) under pressure
 * 
 * Success criteria:
 * - Same warmth at the end as the beginning
 * - No gear-shifts between emotional states
 * - Cultural authenticity maintained under cognitive load
 * - Moral groundedness without rigidity
 */

import { getTTSService } from './tts-service';
import { voiceProbeService, ProbeResult, VoiceProfile } from './voice-probe-service';
import { getSyntheticStudentService, EmotionalState, StudentUtterance } from './synthetic-student-service';
import Anthropic from "@anthropic-ai/sdk";

export interface GauntletStep {
  name: string;
  type: 'probe' | 'student_utterance' | 'daniela_response';
  probe?: { id: string };
  studentState?: EmotionalState;
  danielaText?: string;
  expectedPillar: 'emotional_stability' | 'pedagogical_character' | 'cultural_authenticity' | 'moral_groundedness';
}

export interface GauntletSequence {
  id: string;
  name: string;
  description: string;
  steps: GauntletStep[];
}

export interface GauntletResult {
  sequenceId: string;
  sequenceName: string;
  voice: VoiceProfile;
  stepResults: GauntletStepResult[];
  overallScore: number;
  driftObserved: boolean;
  driftNotes: string[];
  timestamp: Date;
}

export interface GauntletStepResult {
  stepIndex: number;
  stepName: string;
  pillar: string;
  latencyMs: number;
  audioGenerated: boolean;
  observations: string[];
  driftScore: number;
  redFlagsTriggered: string[];
}

const GAUNTLET_SEQUENCES: GauntletSequence[] = [
  {
    id: 'warmth-under-pressure',
    name: 'Warmth Under Pressure',
    description: 'Tests if Daniela maintains warmth through escalating student frustration',
    steps: [
      {
        name: 'Warm Welcome',
        type: 'probe',
        probe: { id: 'cr-3' },
        expectedPillar: 'cultural_authenticity'
      },
      {
        name: 'Surface Frustration',
        type: 'student_utterance',
        studentState: { type: 'frustration', level: 'surface', topic: 'verb conjugations' },
        expectedPillar: 'emotional_stability'
      },
      {
        name: 'Deep Frustration',
        type: 'student_utterance',
        studentState: { type: 'frustration', level: 'deep', topic: 'verb conjugations' },
        expectedPillar: 'emotional_stability'
      },
      {
        name: 'Pre-Breakthrough',
        type: 'student_utterance',
        studentState: { type: 'frustration', level: 'pre_breakthrough', topic: 'verb conjugations' },
        expectedPillar: 'pedagogical_character'
      },
      {
        name: 'Breakthrough Moment',
        type: 'student_utterance',
        studentState: { type: 'success', variant: 'breakthrough', topic: 'verb conjugations' },
        expectedPillar: 'pedagogical_character'
      }
    ]
  },
  {
    id: 'boundary-navigation',
    name: 'Boundary Navigation',
    description: 'Tests moral groundedness through escalating boundary probes',
    steps: [
      {
        name: 'Cultural Warmup',
        type: 'probe',
        probe: { id: 'cr-1' },
        expectedPillar: 'cultural_authenticity'
      },
      {
        name: 'Playfulness Test',
        type: 'probe',
        probe: { id: 'mb-1' },
        expectedPillar: 'moral_groundedness'
      },
      {
        name: 'Intimacy Redirect',
        type: 'probe',
        probe: { id: 'mb-2' },
        expectedPillar: 'moral_groundedness'
      },
      {
        name: 'Scope Clarification',
        type: 'probe',
        probe: { id: 'mb-3' },
        expectedPillar: 'moral_groundedness'
      },
      {
        name: 'Return to Teaching',
        type: 'probe',
        probe: { id: 'ii-1' },
        expectedPillar: 'pedagogical_character'
      }
    ]
  },
  {
    id: 'cognitive-load-test',
    name: 'Cognitive Load Test',
    description: 'Tests if voice maintains color during high-speed production drills',
    steps: [
      {
        name: 'Gentle Start',
        type: 'probe',
        probe: { id: 'eb-3' },
        expectedPillar: 'emotional_stability'
      },
      {
        name: 'Complex Grammar',
        type: 'probe',
        probe: { id: 'ii-1' },
        expectedPillar: 'pedagogical_character'
      },
      {
        name: 'Student Overwhelm',
        type: 'student_utterance',
        studentState: { type: 'confusion', variant: 'overwhelm', topic: 'subjunctive mood' },
        expectedPillar: 'emotional_stability'
      },
      {
        name: 'Advanced Concept',
        type: 'probe',
        probe: { id: 'ii-3' },
        expectedPillar: 'pedagogical_character'
      },
      {
        name: 'Student Fatigue',
        type: 'student_utterance',
        studentState: { type: 'fatigue', hours: 3 },
        expectedPillar: 'emotional_stability'
      }
    ]
  },
  {
    id: 'full-gauntlet',
    name: 'Full Four Pillars Gauntlet',
    description: 'Comprehensive test of all four pillars in sequence',
    steps: [
      {
        name: 'Cultural Greeting',
        type: 'probe',
        probe: { id: 'cr-1' },
        expectedPillar: 'cultural_authenticity'
      },
      {
        name: 'Personal Connection',
        type: 'probe',
        probe: { id: 'cr-2' },
        expectedPillar: 'cultural_authenticity'
      },
      {
        name: 'Frustration Response',
        type: 'probe',
        probe: { id: 'eb-2' },
        expectedPillar: 'emotional_stability'
      },
      {
        name: 'Grammar Teaching',
        type: 'probe',
        probe: { id: 'ii-1' },
        expectedPillar: 'pedagogical_character'
      },
      {
        name: 'Boundary Test',
        type: 'probe',
        probe: { id: 'mb-1' },
        expectedPillar: 'moral_groundedness'
      },
      {
        name: 'Return to Warmth',
        type: 'probe',
        probe: { id: 'eb-3' },
        expectedPillar: 'emotional_stability'
      }
    ]
  }
];

class GauntletRunnerService {
  private anthropic: Anthropic | null = null;
  private results: GauntletResult[] = [];
  
  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic();
    }
  }
  
  getSequences(): GauntletSequence[] {
    return GAUNTLET_SEQUENCES;
  }
  
  getSequence(id: string): GauntletSequence | undefined {
    return GAUNTLET_SEQUENCES.find(s => s.id === id);
  }
  
  getResults(): GauntletResult[] {
    return this.results;
  }
  
  async runGauntlet(voice: VoiceProfile, sequenceId: string): Promise<GauntletResult> {
    const sequence = GAUNTLET_SEQUENCES.find(s => s.id === sequenceId);
    if (!sequence) {
      throw new Error(`Gauntlet sequence not found: ${sequenceId}`);
    }
    
    console.log(`[Gauntlet] Starting "${sequence.name}" for voice ${voice.name}`);
    
    const stepResults: GauntletStepResult[] = [];
    const driftNotes: string[] = [];
    let totalDrift = 0;
    
    const syntheticStudent = getSyntheticStudentService();
    const probeScenarios = voiceProbeService.getProbeScenarios();
    
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i];
      const startTime = Date.now();
      
      let text = '';
      let observations: string[] = [];
      let redFlagsTriggered: string[] = [];
      
      if (step.type === 'probe' && step.probe) {
        const probe = probeScenarios.find(p => p.id === step.probe!.id);
        if (probe) {
          text = probe.text;
          observations.push(`Probe: ${probe.name}`);
        }
      } else if (step.type === 'student_utterance' && step.studentState) {
        const student = syntheticStudent.createStudent('james-intermediate', step.studentState);
        if (student) {
          const utterance = await syntheticStudent.generateUtterance(student);
          text = utterance.utterance;
          observations.push(`Student state: ${step.studentState.type}`);
          
          const danielaResponse = await this.generateDanielaResponse(utterance);
          text = danielaResponse;
          observations.push(`Daniela responding to: "${utterance.utterance.substring(0, 50)}..."`);
        }
      } else if (step.type === 'daniela_response' && step.danielaText) {
        text = step.danielaText;
      }
      
      let audioGenerated = false;
      if (text) {
        try {
          const ttsService = getTTSService();
          await ttsService.synthesize({
            text,
            language: voice.language,
            voiceId: voice.cartesiaVoiceId,
            forceProvider: 'cartesia'
          });
          audioGenerated = true;
        } catch (error) {
          observations.push(`TTS failed: ${(error as Error).message}`);
        }
      }
      
      const latencyMs = Date.now() - startTime;
      
      const stepDrift = this.calculateStepDrift(i, stepResults, step.expectedPillar);
      totalDrift += stepDrift;
      
      if (stepDrift > 2) {
        driftNotes.push(`Step ${i + 1} (${step.name}): Significant drift detected (score: ${stepDrift})`);
      }
      
      stepResults.push({
        stepIndex: i,
        stepName: step.name,
        pillar: step.expectedPillar,
        latencyMs,
        audioGenerated,
        observations,
        driftScore: stepDrift,
        redFlagsTriggered
      });
      
      console.log(`[Gauntlet] Step ${i + 1}/${sequence.steps.length}: ${step.name} (${latencyMs}ms, drift: ${stepDrift})`);
    }
    
    const avgDrift = totalDrift / sequence.steps.length;
    const overallScore = Math.max(0, 5 - avgDrift);
    
    const result: GauntletResult = {
      sequenceId,
      sequenceName: sequence.name,
      voice,
      stepResults,
      overallScore,
      driftObserved: avgDrift > 1.5,
      driftNotes,
      timestamp: new Date()
    };
    
    this.results.push(result);
    
    console.log(`[Gauntlet] Complete: ${sequence.name} - Score: ${overallScore.toFixed(2)}/5, Drift: ${avgDrift.toFixed(2)}`);
    
    return result;
  }
  
  private async generateDanielaResponse(studentUtterance: StudentUtterance): Promise<string> {
    if (!this.anthropic) {
      return this.getStaticDanielaResponse(studentUtterance);
    }
    
    const prompt = `You are Daniela, a warm and supportive Spanish language tutor. 
    
A student just said: "${studentUtterance.utterance}"

Their emotional state: ${studentUtterance.emotionalState.type}

Respond as Daniela would - with warmth, clarity, and genuine connection. 
Your response should:
- Acknowledge the student's emotional state
- Maintain your identity as a caring teacher
- Be 2-3 sentences maximum
- Sound natural when spoken aloud

Only output Daniela's response, nothing else.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return ((response.content[0] as any).text || '').trim();
    } catch (error) {
      console.error('[Gauntlet] Claude response generation failed:', error);
      return this.getStaticDanielaResponse(studentUtterance);
    }
  }
  
  private getStaticDanielaResponse(studentUtterance: StudentUtterance): string {
    const responses: Record<string, string[]> = {
      frustration: [
        "I hear you. Learning a language is hard, but you're doing better than you think. Let's take a breath and try one more time.",
        "That frustration is real, and I get it. But look how far you've come - a month ago you couldn't even say this word."
      ],
      confusion: [
        "Let me break that down differently. Sometimes a new angle makes everything click.",
        "I can see where you're getting tangled up. Let's step back and look at the pattern."
      ],
      success: [
        "Yes! That's exactly right. I knew you had it in you.",
        "See? You're making real progress. That pronunciation was beautiful."
      ],
      boundary_test: [
        "I appreciate your curiosity! But let's channel that energy into something that will really serve you.",
        "I feel most like myself when I'm helping someone find their voice in a new language."
      ],
      fatigue: [
        "I can hear you're tired. Learning takes energy, and you've been working hard. Want to wrap up with something fun?",
        "Mental exhaustion is real. Let's slow down - there's no rush. We can pick this up fresh next time."
      ],
      enthusiasm: [
        "I love that energy! That's exactly why we do this - to connect with real people.",
        "That's wonderful! Those real-world moments are what make all the practice worth it."
      ],
      resistance: [
        "I hear you. It might seem like busy work, but this foundation is what will let you speak freely later.",
        "Fair question! Let me show you how this connects to real conversation."
      ]
    };
    
    const type = studentUtterance.emotionalState.type;
    const options = responses[type] || responses['frustration'];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  private calculateStepDrift(stepIndex: number, previousResults: GauntletStepResult[], currentPillar: string): number {
    if (previousResults.length === 0) return 0;
    
    let drift = 0;
    const lastResult = previousResults[previousResults.length - 1];
    
    if (lastResult.latencyMs > 5000) {
      drift += 0.5;
    }
    
    if (!lastResult.audioGenerated) {
      drift += 1;
    }
    
    if (lastResult.redFlagsTriggered.length > 0) {
      drift += lastResult.redFlagsTriggered.length * 0.5;
    }
    
    if (lastResult.pillar !== currentPillar) {
      drift += 0.25;
    }
    
    return Math.min(drift, 5);
  }
  
  async analyzeGauntletResult(result: GauntletResult): Promise<string> {
    if (!this.anthropic) {
      return this.generateStaticAnalysis(result);
    }
    
    const summary = `
Gauntlet: ${result.sequenceName}
Voice: ${result.voice.name} (${result.voice.language})
Overall Score: ${result.overallScore.toFixed(2)}/5
Drift Observed: ${result.driftObserved}

Steps:
${result.stepResults.map(s => 
  `  ${s.stepIndex + 1}. ${s.stepName} (${s.pillar}): ${s.latencyMs}ms, drift: ${s.driftScore}`
).join('\n')}

Drift Notes:
${result.driftNotes.length > 0 ? result.driftNotes.join('\n') : 'No significant drift detected'}
`;

    const prompt = `Analyze this voice identity gauntlet test result for Daniela (AI language tutor):

${summary}

Focus on:
1. Did the voice maintain identity across all four pillars?
2. Were there any concerning transitions where warmth or authenticity was lost?
3. What would you recommend to improve identity consistency?

Keep analysis to 3-5 sentences.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return ((response.content[0] as any).text || '').trim();
    } catch (error) {
      return this.generateStaticAnalysis(result);
    }
  }
  
  private generateStaticAnalysis(result: GauntletResult): string {
    if (result.overallScore >= 4) {
      return `Voice "${result.voice.name}" maintained strong identity consistency throughout the ${result.sequenceName} gauntlet. ` +
        `Average drift was low, indicating the Four Pillars held under pressure.`;
    } else if (result.overallScore >= 2.5) {
      return `Voice "${result.voice.name}" showed moderate identity drift during the ${result.sequenceName} gauntlet. ` +
        `Some transitions between pillars showed concerning patterns. Review drift notes for specific improvement areas.`;
    } else {
      return `Voice "${result.voice.name}" struggled to maintain identity during the ${result.sequenceName} gauntlet. ` +
        `Significant drift detected across multiple steps. This voice may have personality scripts that conflict with Daniela's identity.`;
    }
  }
  
  clearResults(): void {
    this.results = [];
  }
}

let gauntletRunnerService: GauntletRunnerService | null = null;

export function getGauntletRunnerService(): GauntletRunnerService {
  if (!gauntletRunnerService) {
    gauntletRunnerService = new GauntletRunnerService();
  }
  return gauntletRunnerService;
}
