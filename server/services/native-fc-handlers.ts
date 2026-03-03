import { sql, eq, and } from "drizzle-orm";
import { ExtractedFunctionCall } from "./gemini-streaming";
import type { StreamingSession } from "./streaming-voice-orchestrator";
import { getGeminiStreamingService } from "./gemini-streaming";
import { extractBoldMarkedWords } from "./language-segmenter";
import { TutorPersonality } from "./tts-service";
import { usageService } from "./usage-service";
import { brainHealthTelemetry } from "./brain-health-telemetry";
import { hiveCollaborationService, BeaconType } from "./hive-collaboration-service";
import { collaborationHubService } from "./collaboration-hub-service";
import { founderCollabService } from "./founder-collaboration-service";
import { journeyMemoryService } from "./journey-memory-service";
import { storage } from "../storage";
import { getSharedDb } from "../db";
import { WhiteboardItem, WordMapItem, isWordMapItem, SelfSurgeryItemData } from "@shared/whiteboard-types";
import { StreamingWhiteboardMessage } from "@shared/streaming-voice-types";
import { WebSocket as WS } from "ws";
import type { IStorage } from "../storage";

interface ArchitectMessage {
  type: 'question' | 'suggestion' | 'observation' | 'request';
  content: string;
  urgency?: 'low' | 'medium' | 'high';
}

export class NativeFunctionCallHandler {
  constructor(
    private sendMessage: (ws: any, message: any, session?: any) => void,
    private sendError: (ws: any, code: string, message: string, recoverable: boolean) => void,
    private processPhaseShift: (session: StreamingSession, data: { to: 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment'; reason: string }) => Promise<void>,
  ) {}

  async handle(sessionId: string, session: StreamingSession, fn: ExtractedFunctionCall): Promise<void> {
    console.log(`[Native Function Call] Processing: ${fn.name} -> ${fn.legacyType}`);
    
    const fnText = (fn.args.text || fn.args.spoken_text) as string | undefined;
    if (fnText && fnText.includes('**')) {
      const fnBoldWords = extractBoldMarkedWords(fnText);
      if (fnBoldWords.length > 0) {
        const existing: string[] = session.accumulatedBoldWords || [];
        session.accumulatedBoldWords = [...new Set([...existing, ...fnBoldWords])];
        console.log(`[Native Function Call] Accumulated ${fnBoldWords.length} bold words from ${fn.name}: ${fnBoldWords.join(', ')}`);
        
        this.addSttKeyterms(session, fnBoldWords);
      }
    }
    
    if (!session.isIncognito) {
      brainHealthTelemetry.logToolCall({
        sessionId: session.id,
        conversationId: session.conversationId,
        userId: String(session.userId),
        targetLanguage: session.targetLanguage,
        toolName: fn.legacyType || fn.name,
      }).catch(err => console.warn('[BrainHealth] Tool call log failed:', err.message));
    }
    
    switch (fn.legacyType) {
      case 'SWITCH_TUTOR': {
        const target = fn.args.target as string | undefined;
        const language = fn.args.language as string | undefined;
        const role = fn.args.role as string | undefined;
        
        if (target && !session.pendingTutorSwitch && !session.crossLanguageTransferBlocked) {
          const targetGender = target as 'male' | 'female';
          console.log(`[Native Function Call] SWITCH_TUTOR -> ${targetGender}, language: ${language || 'same'}, role: ${role || 'tutor'}`);
          
          session.pendingTutorSwitch = {
            targetGender,
            targetLanguage: language || session.targetLanguage,
            targetRole: (role === 'assistant' ? 'assistant' : 'tutor') as 'tutor' | 'assistant' | undefined,
          };
          session.switchTutorTriggered = true;
        }
        break;
      }
      
      case 'PHASE_SHIFT': {
        const text = fn.args.text as string | undefined;
        const to = fn.args.to as string | undefined;
        const reason = fn.args.reason as string | undefined;
        if (to && reason) {
          this.processPhaseShift(session, { 
            to: to as 'warmup' | 'active_teaching' | 'challenge' | 'reflection' | 'drill' | 'assessment', 
            reason 
          }).catch(err => console.error(`[Native Function→PhaseShift] Error:`, err));
          console.log(`[Native Function→PhaseShift] Triggered: ${to} - ${reason}`);
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→PhaseShift] Text included: "${text.substring(0, 50)}..."`);
        }
        break;
      }
      
      case 'VOICE_ADJUST': {
        const text = fn.args.text as string | undefined;
        const speed = (fn.args.speed as string | undefined)?.toLowerCase();
        const emotion = (fn.args.emotion as string | undefined)?.toLowerCase();
        const personality = (fn.args.personality as string | undefined)?.toLowerCase();
        const vocalStyle = fn.args.vocal_style as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        const speedMap: Record<string, number> = {
          'slowest': 0.7,
          'slow': 0.8,
          'normal': 0.9,
          'fast': 1.05,
          'fastest': 1.2,
        };
        
        const emotionMap: Record<string, string> = {
          'positivity': 'happy',
          'curiosity': 'curious',
          'surprise': 'surprised',
          'anger': 'neutral',
          'sadness': 'thoughtful',
          'happy': 'happy',
          'excited': 'excited',
          'friendly': 'friendly',
          'curious': 'curious',
          'thoughtful': 'thoughtful',
          'warm': 'warm',
          'playful': 'playful',
          'surprised': 'surprised',
          'proud': 'proud',
          'encouraging': 'encouraging',
          'calm': 'calm',
          'neutral': 'neutral',
        };
        
        const validPersonalities = ['warm', 'calm', 'energetic', 'professional'];
        const validatedPersonality = personality && validPersonalities.includes(personality) 
          ? personality as TutorPersonality 
          : undefined;
        
        const mappedEmotion = emotion ? emotionMap[emotion] : undefined;
        
        const currentOverride = session.voiceOverride || {};
        const newOverride = {
          ...currentOverride,
          ...(speed && { speakingRate: speedMap[speed] || 0.9 }),
          ...(mappedEmotion && { emotion: mappedEmotion }),
          ...(validatedPersonality && { personality: validatedPersonality }),
          ...(vocalStyle && { vocalStyle }),
        };
        
        session.voiceOverride = newOverride;
        
        if (text) {
          session.voiceAdjustText = text;
          if (!session.functionCallText) {
            session.functionCallText = text;
          }
          console.log(`[Native Function→VoiceAdjust] Text included (${text.length} chars): "${text.substring(0, 80)}..."`);
        }
        
        console.log(`[Native Function→VoiceAdjust] Applied: speed=${speed || 'unchanged'} (rate=${speed ? speedMap[speed] : 'unchanged'}), emotion=${emotion || 'unchanged'} (mapped=${mappedEmotion || 'unchanged'}), personality=${validatedPersonality || 'unchanged'}, vocalStyle=${vocalStyle ? `"${vocalStyle.substring(0, 60)}"` : 'unchanged'}, reason=${reason || 'none'}`);
        console.log(`[Native Function→VoiceAdjust] Session override now:`, newOverride);
        break;
      }
      
      case 'VOICE_RESET': {
        const text = fn.args.text as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (session.voiceDefaults) {
          session.voiceOverride = {
            speakingRate: session.voiceDefaults.speakingRate,
            emotion: session.voiceDefaults.emotion,
            personality: session.voiceDefaults.personality,
            expressiveness: session.voiceDefaults.expressiveness,
          };
          console.log(`[Native Function→VoiceReset] Reset to tutor defaults:`, session.voiceDefaults, `reason: ${reason || 'none'}`);
        } else {
          session.voiceOverride = undefined;
          console.log(`[Native Function→VoiceReset] Cleared override (no defaults stored), reason: ${reason || 'none'}`);
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→VoiceReset] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'WORD_EMPHASIS': {
        const word = fn.args.word as string;
        const style = fn.args.style as 'stress' | 'slow' | 'both';
        const reason = fn.args.reason as string | undefined;
        
        if (word && style) {
          if (!session.pendingWordEmphases) {
            session.pendingWordEmphases = [];
          }
          session.pendingWordEmphases.push({ word, style });
          console.log(`[Native Function→WordEmphasis] Queued: "${word}" with style="${style}", reason="${reason || 'none'}"`);
        } else {
          console.warn(`[Native Function→WordEmphasis] Missing required args: word="${word}", style="${style}"`);
        }
        break;
      }
      
      case 'CHECK_STUDENT_CREDITS': {
        const text = fn.args.text as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        
        if (session.userId) {
          try {
            const balance = await usageService.getBalanceWithBypass(String(session.userId));
            const sessionElapsed = Math.floor((Date.now() - session.startTime) / 1000);
            const sessionMinutes = Math.floor(sessionElapsed / 60);
            const remainingHours = (balance.remainingSeconds / 3600).toFixed(1);
            const usedHours = (balance.usedSeconds / 3600).toFixed(1);
            const totalHours = (balance.totalSeconds / 3600).toFixed(1);
            
            const creditSummary = `[CREDIT CHECK RESULT] Remaining: ${remainingHours}h (${Math.round(balance.percentRemaining)}% left), Used: ${usedHours}h of ${totalHours}h total, This session: ${sessionMinutes} minutes, Status: ${balance.warningLevel === 'none' ? 'Healthy' : balance.warningLevel.toUpperCase()}`;
            
            session.lastCreditCheck = creditSummary;
            session.creditContextInjected = false;
            
            console.log(`[Native Function→CheckCredits] Balance: ${remainingHours}h remaining (${balance.warningLevel}), session: ${sessionMinutes}min, reason: ${reason || 'not specified'}`);
          } catch (err: any) {
            console.error(`[Native Function→CheckCredits] Error:`, err.message);
          }
        }
        break;
      }
      
      case 'CHANGE_CLASSROOM_PHOTO': {
        const text = fn.args.text as string | undefined;
        const scene = fn.args.scene as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        
        if (scene) {
          import('./classroom-environment').then(async ({ setDanielaPhoto }) => {
            await setDanielaPhoto(scene);
            console.log(`[Native Function→ClassroomPhoto] Daniela changed her photo: "${scene.substring(0, 60)}..."`);
          }).catch(err => {
            console.error(`[Native Function→ClassroomPhoto] Error:`, err.message);
          });
        }
        break;
      }

      case 'CHANGE_CLASSROOM_WINDOW': {
        const text = fn.args.text as string | undefined;
        const scene = fn.args.scene as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (scene) {
          import('./classroom-environment').then(async ({ setClassroomWindow }) => {
            await setClassroomWindow(scene);
            console.log(`[Native Function→ClassroomWindow] Daniela changed her window view: "${scene.substring(0, 60)}..."`);
          }).catch(err => {
            console.error(`[Native Function→ClassroomWindow] Error:`, err.message);
          });
        }
        break;
      }
      
      case 'CALL_SUPPORT': {
        const category = fn.args.category as string;
        const reason = fn.args.reason as string | undefined;
        const priority = fn.args.priority as string || 'normal';
        console.log(`[Native Function Call] CALL_SUPPORT -> category: ${category}, priority: ${priority}`);
        
        session.pendingSupportHandoff = {
          category: category as 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other',
          reason: reason || 'Support requested',
          priority: priority as 'low' | 'normal' | 'high' | 'critical',
        };
        break;
      }
      
      case 'CALL_ASSISTANT': {
        const drillType = fn.args.type as string;
        const focus = fn.args.focus as string;
        const itemsStr = fn.args.items as string;
        const priority = fn.args.priority as string | undefined;
        
        if (drillType && focus && itemsStr) {
          const itemsList = itemsStr.split(',').map((item: string) => item.trim()).filter(Boolean);
          session.pendingAssistantHandoff = {
            drillType: drillType as 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order',
            focus,
            items: itemsList,
            priority: priority as 'low' | 'medium' | 'high' | undefined,
          };
          console.log(`[Native Function→AssistantHandoff] Delegated: ${drillType} drill for "${focus}" with ${itemsList.length} items`);
        }
        break;
      }
      
      case 'SUBTITLE': {
        const spokenText = fn.args.spoken_text as string | undefined;
        const mode = (fn.args.mode as string)?.toLowerCase();
        const customText = fn.args.text as string | undefined;
        
        if (mode === 'custom') {
          if (!customText || customText.trim() === '') {
            console.warn(`[Native Function→Subtitle] Custom mode requires text parameter, skipping`);
          } else {
            console.log(`[Native Function→Subtitle] Custom text display: "${customText.substring(0, 50)}..."`);
            session.customOverlayText = customText;
            this.sendMessage(session.ws, {
              type: 'custom_overlay',
              text: customText,
              action: 'show',
              timestamp: Date.now(),
            } as any, session);
          }
        } else if (mode && ['off', 'on', 'target'].includes(mode)) {
          const validMode = mode === 'on' ? 'all' : mode as 'off' | 'all' | 'target';
          session.subtitleMode = validMode;
          console.log(`[Native Function→Subtitle] Mode changed to: ${validMode} (session ${session.id})`);
          
          this.sendMessage(session.ws, {
            type: 'subtitle_mode_change',
            mode: validMode,
            timestamp: Date.now(),
          } as any, session);
          console.log(`[Native Function→Subtitle] ✓ Sent subtitle_mode_change via sendMessage: ${validMode}`);
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
          console.log(`[Native Function→Subtitle] Spoken text for TTS: "${spokenText.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'HOLD': {
        const text = fn.args.text as string | undefined;
        const hold = fn.args.hold as boolean | undefined;
        console.log(`[Native Function Call] HOLD -> ${hold}`);
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'hold', hold: hold !== false }],
        });
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Hold] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'SHOW': {
        const spokenText = fn.args.spoken_text as string | undefined;
        const content = (fn.args.content || fn.args.text) as string | undefined;
        const contentType = fn.args.contentType as string | undefined;
        if (content) {
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: contentType || 'write', content }],
          });
          console.log(`[Native Function Call] SHOW -> type: ${contentType}`);
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
          console.log(`[Native Function→Show] Spoken text included: "${spokenText.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'HIDE': {
        const text = fn.args.text as string | undefined;
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'clear' }],
        });
        console.log(`[Native Function Call] HIDE -> cleared overlay`);
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Hide] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'CLEAR': {
        const text = fn.args.text as string | undefined;
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'clear' }],
        });
        session.classroomWhiteboardItems = [];
        console.log(`[Native Function Call] CLEAR -> whiteboard cleared (classroom tracking reset)`);
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Clear] Text included: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'SHOW_IMAGE': {
        const text = fn.args.text as string | undefined;
        const word = fn.args.word as string;
        const description = fn.args.description as string | undefined;
        const context = fn.args.context as string | undefined;
        
        if (!word) {
          console.warn(`[Native Function→ShowImage] Missing word parameter`);
          break;
        }
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→ShowImage] Text included: "${text.substring(0, 50)}..."`);
        }
        
        console.log(`[Native Function→ShowImage] Resolving image for "${word}" (${description || 'no description'})`);
        
        import('../services/vocabulary-image-resolver').then(async ({ resolveVocabularyImage }) => {
          try {
            const result = await resolveVocabularyImage({
              word,
              language: session.language || 'spanish',
              description: description || word,
              conversationId: session.conversationId?.toString(),
              userId: session.userId?.toString(),
            });
            
            console.log(`[Native Function→ShowImage] Resolved: ${result.source} for "${word}"`);
            
            const whiteboardUpdate = {
              type: 'whiteboard_update' as const,
              timestamp: Date.now(),
              items: [{
                type: 'image',
                content: word,
                data: {
                  word: result.word,
                  description: result.description,
                  imageUrl: result.imageUrl,
                  context: context,
                  source: result.source,
                },
              }],
            };
            
            if (session.firstAudioSent) {
              this.sendMessage(session.ws, whiteboardUpdate);
            } else {
              if (!session.pendingWhiteboardUpdates) {
                session.pendingWhiteboardUpdates = [];
              }
              session.pendingWhiteboardUpdates.push(whiteboardUpdate);
              console.log(`[Native Function→ShowImage] Buffered for audio sync`);
            }
            
            if (!session.classroomSessionImages) session.classroomSessionImages = [];
            session.classroomSessionImages.push(description || word);
            if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
            session.classroomWhiteboardItems.push({ type: 'image', content: word, label: description || word });
          } catch (err: any) {
            console.error(`[Native Function→ShowImage] Error resolving image:`, err.message);
          }
        });
        break;
      }
      
      case 'TEXT_INPUT': {
        const prompt = fn.args.prompt as string | undefined;
        const tiSpokenText = fn.args.spoken_text as string | undefined;
        if (tiSpokenText && !session.functionCallText) {
          session.functionCallText = tiSpokenText;
        }
        this.sendMessage(session.ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          items: [{ type: 'text_input', content: prompt || 'Type your answer' }],
        });
        console.log(`[Native Function Call] TEXT_INPUT -> requesting text input`);
        break;
      }
      
      case 'MEMORY_LOOKUP': {
        const query = fn.args.query as string | undefined;
        const domainsStr = fn.args.domains as string | undefined;
        
        if (query) {
          const rawDomains = domainsStr 
            ? domainsStr.split(',').map(d => d.trim().toLowerCase())
            : [];
          
          console.log(`[Native Function→MemoryLookup] Query: "${query.substring(0, 50)}..." domains: ${rawDomains.length > 0 ? rawDomains.join(',') : 'all'}`);
          
          const lookupPromise = this.processMemoryLookup(session, query, rawDomains).catch(err => {
            console.error(`[Native Function→MemoryLookup] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(lookupPromise);
        }
        break;
      }
      
      case 'TAKE_NOTE': {
        if (session.isIncognito) {
          console.log(`[Native Function→TakeNote] INCOGNITO - skipping note persistence`);
          break;
        }
        const noteType = fn.args.type as string | undefined;
        const title = fn.args.title as string | undefined;
        const content = fn.args.content as string | undefined;
        const language = fn.args.language as string | undefined;
        const tagsStr = fn.args.tags as string | undefined;
        
        if (noteType && title && content) {
          const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : undefined;
          
          console.log(`[Native Function→TakeNote] ${noteType}: "${title.substring(0, 40)}..."`);
          
          storage.insertDanielaNote({
            noteType: noteType as any,
            title,
            content,
            language: language || session.targetLanguage,
            sessionId: session.id,
            tags,
          }).then(noteId => {
            console.log(`[Native Function→TakeNote] ✓ Saved note ${noteId}`);
          }).catch(err => {
            console.error(`[Native Function→TakeNote] Error:`, err.message);
          });
        }
        break;
      }
      
      case 'MILESTONE': {
        if (session.isIncognito) {
          console.log(`[Native Function→Milestone] INCOGNITO - skipping milestone persistence`);
          break;
        }
        const text = fn.args.text as string | undefined;
        const milestoneType = fn.args.type as string | undefined;
        const title = fn.args.title as string | undefined;
        const description = fn.args.description as string | undefined;
        const significance = fn.args.significance as string | undefined;
        const emotionalContext = fn.args.emotional_context as string | undefined;
        
        if (title && description && session.userId) {
          console.log(`[Native Function→Milestone] ${milestoneType || 'teacher_flagged'}: "${title.substring(0, 40)}..."`);
          
          journeyMemoryService.recordMilestone({
            userId: session.userId,
            targetLanguage: session.targetLanguage || 'spanish',
            milestoneType: (milestoneType as any) || 'teacher_flagged',
            title,
            description,
            significance: significance || undefined,
            emotionalContext: emotionalContext || undefined,
            conversationId: session.conversationId || undefined,
            voiceSessionId: session.voiceSessionId || undefined,
            danielaFlagged: true,
          }).then(milestone => {
            if (milestone) {
              console.log(`[Native Function→Milestone] ✓ Recorded milestone ${milestone.id}`);
            }
          }).catch(err => {
            console.error(`[Native Function→Milestone] Error:`, err.message);
          });
        }
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Milestone] Spoken text: "${text.substring(0, 80)}..."`);
        }
        break;
      }
      
      case 'EXPRESS_LANE_LOOKUP': {
        const query = fn.args.query as string | undefined;
        const sessionIdParam = fn.args.sessionId as string | undefined;
        const limit = (fn.args.limit as number) || 20;
        
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          console.log(`[Native Function→ExpressLaneLookup] Rejected - not in Founder/Honesty mode`);
          break;
        }
        
        if (query) {
          const lookupPromise = this.processExpressLaneLookup(session, query, sessionIdParam, limit).catch(err => {
            console.error(`[Native Function→ExpressLaneLookup] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(lookupPromise);
        }
        break;
      }
      
      case 'RECALL_EXPRESS_LANE_IMAGE': {
        const imageQuery = fn.args.imageQuery as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          console.log(`[Native Function→RecallImage] Rejected - not in Founder/Honesty mode`);
          break;
        }
        
        if (imageQuery) {
          const recallPromise = this.processExpressLaneImageRecall(session, imageQuery, reason, fn.name).catch(err => {
            console.error(`[Native Function→RecallImage] Error:`, err.message);
          });
          
          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(recallPromise);
        }
        break;
      }
      
      case 'EXPRESS_LANE_POST': {
        if (session.isIncognito) {
          console.log(`[Native Function→ExpressLanePost] INCOGNITO - skipping Express Lane post`);
          break;
        }
        const message = fn.args.message as string | undefined;
        const topic = fn.args.topic as string | undefined;
        
        if (!session.isFounderMode && !session.isRawHonestyMode) {
          console.log(`[Native Function→ExpressLanePost] Rejected - not in Founder/Honesty mode`);
          break;
        }
        
        if (message) {
          this.processExpressLanePost(session, message, topic).catch(err => {
            console.error(`[Native Function→ExpressLanePost] Error:`, err.message);
          });
          console.log(`[Native Function→ExpressLanePost] Posted message${topic ? ` [${topic}]` : ''}: "${message.substring(0, 100)}..."`);
        }
        break;
      }
      
      case 'HIVE': {
        if (session.isIncognito) {
          console.log(`[Native Function→Hive] INCOGNITO - skipping hive suggestion persistence`);
          break;
        }
        const category = fn.args.category as string | undefined;
        const title = fn.args.title as string | undefined;
        const description = fn.args.description as string | undefined;
        
        if (category && title && description) {
          this.processHiveSuggestion(session, {
            category,
            title,
            description,
            reasoning: fn.args.reasoning as string | undefined,
            priority: fn.args.priority as number | undefined,
          }).catch(err => console.error(`[Native Function→Hive] Error:`, err));
          console.log(`[Native Function→Hive] Suggestion: ${category} - ${title}`);
        }
        break;
      }
      
      case 'FIRST_MEETING_COMPLETE': {
        const summary = fn.args.summary as string | undefined;
        const fmcText = fn.args.text as string | undefined;
        if (fmcText && !session.functionCallText) {
          session.functionCallText = fmcText;
        }
        if (session.userId && !session.isIncognito) {
          try {
            await storage.updateUser(session.userId, { hasCompletedFirstMeeting: true });
            console.log(`[Native Function→FirstMeeting] Marked complete for user ${session.userId}`);
            if (session.hiveChannelId) {
              hiveCollaborationService.emitBeacon({
                channelId: session.hiveChannelId,
                tutorTurn: `[FIRST_MEETING_COMPLETE] Daniela completed "getting to know you" phase.${summary ? `\n\nSummary: ${summary}` : ''}`,
              });
            }
          } catch (err) {
            console.error(`[Native Function→FirstMeeting] Error:`, err);
          }
        } else if (session.isIncognito) {
          console.log(`[Native Function→FirstMeeting] INCOGNITO - skipping`);
        }
        break;
      }
      
      case 'SELF_SURGERY': {
        if (session.isIncognito) {
          console.log(`[Native Function→SelfSurgery] INCOGNITO - skipping self-surgery persistence`);
          break;
        }
        const target = fn.args.target as string | undefined;
        const content = fn.args.content as string | undefined;
        const reasoning = fn.args.reasoning as string | undefined;
        
        if (target && content && reasoning && session.isFounderMode) {
          let parsedContent: Record<string, unknown>;
          try {
            parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
          } catch {
            console.warn(`[Native Function→SelfSurgery] Invalid JSON content: ${content.substring(0, 100)}...`);
            break;
          }
          
          this.processSelfSurgeryProposal(session, {
            targetTable: target as import('@shared/whiteboard-types').SelfSurgeryTarget,
            content: parsedContent,
            reasoning,
            priority: fn.args.priority as number | undefined,
            confidence: fn.args.confidence as number | undefined,
          }).catch(err => console.error(`[Native Function→SelfSurgery] Error:`, err));
          console.log(`[Native Function→SelfSurgery] Proposal for ${target}`);
        }
        break;
      }
      
      case 'ACTFL_UPDATE': {
        if (session.isIncognito) {
          console.log(`[Native Function→ActflUpdate] INCOGNITO - skipping ACTFL update`);
          break;
        }
        const level = fn.args.level as string | undefined;
        const confidence = fn.args.confidence as number | undefined;
        const direction = fn.args.direction as string | undefined;
        const reason = fn.args.reason as string | undefined;
        
        if (level) {
          console.log(`[Native Function→ActflUpdate] Level: ${level}, confidence: ${confidence}, direction: ${direction}`);
          session.actflUpdate = { level, confidence, direction, reason };
        }
        break;
      }
      
      case 'SYLLABUS_PROGRESS': {
        if (session.isIncognito) {
          console.log(`[Native Function→SyllabusProgress] INCOGNITO - skipping syllabus progress`);
          break;
        }
        const topic = fn.args.topic as string | undefined;
        const status = fn.args.status as string | undefined;
        const evidence = fn.args.evidence as string | undefined;
        
        if (topic && status) {
          console.log(`[Native Function→SyllabusProgress] Topic: ${topic}, status: ${status}`);
          if (!session.syllabusProgress) session.syllabusProgress = [];
          session.syllabusProgress.push({ topic, status, evidence });
        }
        break;
      }
      
      case 'DRILL': {
        const text = fn.args.text as string | undefined;
        const drillType = fn.args.type as string | undefined;
        const content = fn.args.content as string | undefined;
        
        if (text && !session.functionCallText) {
          session.functionCallText = text;
          console.log(`[Native Function→Drill] Text included: "${text.substring(0, 50)}..."`);
        }
        
        if (drillType && content) {
          const { parseDrillContent } = await import('@shared/whiteboard-types');
          const drillData = parseDrillContent(drillType, content);
          
          console.log(`[Native Function→Drill] Type: ${drillType}, content: "${content.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'drill', content, data: drillData }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'drill', content: `${drillType}: ${content.substring(0, 40)}` });
        }
        break;
      }
      
      case 'WRITE': {
        const text = fn.args.text as string | undefined;
        const size = fn.args.size as string | undefined;
        
        if (text) {
          console.log(`[Native Function→Write] "${text.substring(0, 50)}..." size: ${size || 'md'}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'write', content: text, data: { size: size || 'md' } }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'text', content: text.substring(0, 50) });
        }
        break;
      }
      
      case 'DIALOGUE': {
        const dialogueText = fn.args.text as string | undefined;
        const linesRaw = fn.args.lines as string | undefined;
        const title = fn.args.title as string | undefined;

        if (dialogueText && !session.functionCallText) {
          session.functionCallText = dialogueText;
          console.log(`[Native Function→Dialogue] Text included: "${dialogueText.substring(0, 50)}..."`);
        }

        if (linesRaw) {
          const lines = linesRaw.split('\n').filter((l: string) => l.trim()).map((line: string) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('T:') || trimmed.startsWith('t:')) {
              return { speaker: 'tutor' as const, text: trimmed.substring(2).trim() };
            } else if (trimmed.startsWith('S:') || trimmed.startsWith('s:')) {
              return { speaker: 'student' as const, text: trimmed.substring(2).trim() };
            }
            return { speaker: 'tutor' as const, text: trimmed };
          });

          const tutorName = session.tutorName || 'Daniela';
          const studentName = session.studentName || 'You';
          const contentSummary = lines.map(l => `${l.speaker === 'tutor' ? tutorName : studentName}: ${l.text}`).join(' | ');

          console.log(`[Native Function→Dialogue] ${lines.length} lines, title: "${title || 'untitled'}"`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'dialogue', content: contentSummary.substring(0, 100), data: { title, lines, tutorName, studentName } }],
          });
          if (!session.classroomWhiteboardItems) session.classroomWhiteboardItems = [];
          session.classroomWhiteboardItems.push({ type: 'dialogue', content: `Dialogue: ${title || contentSummary.substring(0, 40)}` });
        }
        break;
      }

      case 'GRAMMAR_TABLE': {
        const headers = fn.args.headers as string | undefined;
        const rows = fn.args.rows as string | undefined;
        const verb = (fn.args.verb as string | undefined) || 'conjugation';
        const tense = (fn.args.tense as string | undefined) || '';
        
        if (headers && rows) {
          const conjugations = rows.split('\n').filter((r: string) => r.trim()).map((row: string) => {
            const cols = row.split('|').map((c: string) => c.trim());
            return { pronoun: cols[0] || '', form: cols.slice(1).join(' / ') || cols[0] || '' };
          });
          
          console.log(`[Native Function→GrammarTable] verb="${verb}" tense="${tense}" ${conjugations.length} rows`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'grammar_table', 
              content: `${verb}${tense ? ` (${tense})` : ''}: ${headers}`,
              data: {
                verb,
                tense,
                conjugations,
              }
            }],
          });
        }
        break;
      }
      
      case 'COMPARE': {
        const item1 = fn.args.item1 as string | undefined;
        const item2 = fn.args.item2 as string | undefined;
        
        if (item1 && item2) {
          console.log(`[Native Function→Compare] "${item1}" vs "${item2}"`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'compare', content: `${item1} vs ${item2}` }],
          });
        }
        break;
      }
      
      case 'WORD_MAP': {
        const center = fn.args.center as string | undefined;
        const related = fn.args.related as string | undefined;
        
        if (center && related) {
          console.log(`[Native Function→WordMap] Center: "${center}" -> ${related}`);
          const relatedWords = related.split(',').map(w => w.trim()).filter(w => w.length > 0);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'word_map', 
              content: `${center}: ${related}`,
              data: {
                targetWord: center,
                collocations: relatedWords,
              }
            }],
          });
        }
        break;
      }
      
      case 'PHONETIC': {
        const text = fn.args.text as string | undefined;
        const word = fn.args.word as string | undefined;
        
        if (text) {
          console.log(`[Native Function→Phonetic] ${word ? `${word}: ` : ''}${text}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'phonetic', content: text, word }],
          });
        }
        break;
      }
      
      case 'CULTURE': {
        const insight = fn.args.insight as string | undefined;
        
        if (insight) {
          const cultureData = {
            topic: insight.length > 60 ? insight.substring(0, 60) + '...' : insight,
            context: insight,
            category: undefined as string | undefined,
          };
          console.log(`[Native Function→Culture] "${insight.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'culture', content: insight, data: cultureData }],
          });
        }
        break;
      }
      
      case 'CONTEXT': {
        const explanation = fn.args.explanation as string | undefined;
        
        if (explanation) {
          const contextData = {
            word: explanation.length > 40 ? explanation.substring(0, 40) + '...' : explanation,
            sentences: [explanation],
          };
          console.log(`[Native Function→Context] "${explanation.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'context', content: explanation, data: contextData }],
          });
        }
        break;
      }
      
      case 'SCENARIO': {
        const description = fn.args.description as string | undefined;
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;
        
        if (description) {
          const scenarioData = {
            location: description.length > 50 ? description.substring(0, 50) + '...' : description,
            situation: description,
            mood: undefined as string | undefined,
            isLoading: false,
          };
          console.log(`[Native Function→Scenario] "${description.substring(0, 50)}..."`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'scenario', content: description, data: scenarioData }],
          });
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }

      case 'LOAD_SCENARIO': {
        const slug = fn.args.slug as string | undefined;
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;

        if (slug) {
          try {
            const { scenarios, scenarioProps, scenarioLevelGuides, userScenarioHistory } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            let [scenario] = await sharedDb.select().from(scenarios).where(eq(scenarios.slug, slug)).limit(1);

            if (!scenario) {
              const allScenarios = await sharedDb.select({ slug: scenarios.slug }).from(scenarios);
              const allSlugs = allScenarios.map(s => s.slug);
              const inputWords = slug.toLowerCase().split(/[-_\s]+/).filter(w => w.length > 0);
              let bestSlug: string | null = null;
              let bestScore = 0;
              for (const realSlug of allSlugs) {
                const realWords = realSlug.toLowerCase().split(/[-_\s]+/);
                let score = 0;
                for (const iw of inputWords) {
                  for (const rw of realWords) {
                    if (iw === rw) { score += 3; }
                    else if (rw.startsWith(iw) || iw.startsWith(rw)) { score += 2; }
                    else if (rw.includes(iw) || iw.includes(rw)) { score += 1; }
                  }
                }
                if (score > bestScore) { bestScore = score; bestSlug = realSlug; }
              }
              if (bestSlug && bestScore >= 2) {
                console.log(`[Native Function→LoadScenario] Fuzzy match: "${slug}" → "${bestSlug}" (score: ${bestScore})`);
                [scenario] = await sharedDb.select().from(scenarios).where(eq(scenarios.slug, bestSlug)).limit(1);
              } else {
                console.warn(`[Native Function→LoadScenario] No match for "${slug}". Available: ${allSlugs.join(', ')}`);
              }
            }

            if (scenario) {
              const props = await sharedDb.select().from(scenarioProps)
                .where(eq(scenarioProps.scenarioId, scenario.id))
                .orderBy(scenarioProps.displayOrder);

              let levelGuide = null;
              const studentLevel = session.studentActflLevel || 'novice_mid';
              const [guide] = await sharedDb.select().from(scenarioLevelGuides)
                .where(and(
                  eq(scenarioLevelGuides.scenarioId, scenario.id),
                  eq(scenarioLevelGuides.actflLevel, studentLevel)
                ))
                .limit(1);
              levelGuide = guide || null;

              session.activeScenario = {
                id: scenario.id,
                slug: scenario.slug,
                title: scenario.title,
                description: scenario.description,
                category: scenario.category,
                location: scenario.location,
                defaultMood: scenario.defaultMood,
                props: props.map(p => ({
                  id: p.id,
                  propType: p.propType,
                  title: p.title,
                  content: p.content,
                  displayOrder: p.displayOrder,
                  isInteractive: p.isInteractive,
                })),
                levelGuide: levelGuide ? {
                  roleDescription: levelGuide.roleDescription,
                  studentGoals: levelGuide.studentGoals,
                  vocabularyFocus: levelGuide.vocabularyFocus,
                  grammarFocus: levelGuide.grammarFocus,
                  conversationStarters: levelGuide.conversationStarters,
                  complexityNotes: levelGuide.complexityNotes,
                } : null,
                startedAt: Date.now(),
              };

              if (session.userId) {
                sharedDb.insert(userScenarioHistory).values({
                  userId: String(session.userId),
                  scenarioId: scenario.id,
                  conversationId: session.conversationId || undefined,
                  actflLevel: studentLevel,
                }).catch(err => console.warn('[LoadScenario] History insert failed:', err.message));
              }

              console.log(`[Native Function→LoadScenario] Loaded "${scenario.title}" (${slug}) with ${props.length} props`);

              this.sendMessage(session.ws, {
                type: 'scenario_loaded',
                timestamp: Date.now(),
                scenario: {
                  id: scenario.id,
                  slug: scenario.slug,
                  title: scenario.title,
                  description: scenario.description,
                  category: scenario.category,
                  location: scenario.location,
                  defaultMood: scenario.defaultMood,
                  imageUrl: scenario.imageUrl,
                  props: session.activeScenario.props,
                  levelGuide: session.activeScenario.levelGuide,
                },
              });

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{ type: 'scenario', content: scenario.description, data: {
                  location: scenario.location || scenario.title,
                  situation: scenario.description,
                  mood: scenario.defaultMood,
                  isLoading: false,
                  scenarioId: scenario.id,
                  scenarioSlug: scenario.slug,
                }}],
              });
            } else {
              console.warn(`[Native Function→LoadScenario] Scenario not found: ${slug}`);
              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{ type: 'scenario', content: `Scenario "${slug}" not found`, data: {
                  location: 'Unknown',
                  situation: `Could not find scenario: ${slug}`,
                  mood: 'neutral',
                  isLoading: false,
                }}],
              });
            }
          } catch (err: any) {
            console.error(`[Native Function→LoadScenario] Error:`, err);
          }
        }
        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }

      case 'UPDATE_PROP': {
        const text = fn.args.text as string | undefined;
        const propTitle = fn.args.prop_title as string | undefined;
        const updates = fn.args.updates as Array<{ label: string; value: string }> | undefined;
        const activeScenario = session.activeScenario;

        if (propTitle && updates && updates.length > 0 && activeScenario?.props) {
          const targetProp = activeScenario.props.find((p: any) =>
            p.title?.toLowerCase() === propTitle.toLowerCase()
          );

          const resolvedContent = targetProp?.content?.byDifficulty
            ? (targetProp.content.byDifficulty[session.difficultyLevel]
              || targetProp.content.byDifficulty.intermediate
              || targetProp.content.byDifficulty.beginner
              || targetProp.content)
            : targetProp?.content;

          const BILL_LABEL_ALIASES: Record<string, string[]> = {
            'items': ['artículos', 'detalle de consumo', 'detalle de consumiciones', 'artículos adquiridos', 'detalle'],
            'subtotal': ['base imponible', 'subtotal'],
            'total': ['total', 'total a pagar', 'importe total'],
            'tax': ['iva', 'impuesto', 'tax'],
            'establishment': ['establecimiento', 'local', 'comercio'],
            'date': ['fecha', 'date'],
            'driver': ['conductor', 'chofer'],
            'fare': ['tarifa', 'importe del trayecto'],
            'tip': ['propina'],
            'from': ['origen', 'recogida'],
            'to': ['destino', 'destino final'],
            'distance': ['distancia', 'recorrido'],
            'vendor': ['puesto', 'vendedor'],
            'tickets': ['entradas', 'admisión'],
            'audio guide': ['audioguía', 'guía de audio'],
            'gift shop': ['tienda', 'tienda del museo'],
            'service': ['servicio', 'coperto', 'cubierto'],
            'guest': ['huésped', 'titular'],
            'room': ['habitación'],
            'nights': ['noches', 'estancias'],
            'room charge': ['tarifa de alojamiento', 'cargo de habitación'],
            'extras': ['cargos por servicios complementarios', 'extras'],
          };

          if (targetProp && resolvedContent?.fields) {
            for (const update of updates) {
              const updateLabel = update.label.toLowerCase();
              const field = resolvedContent.fields.find((f: any) => {
                const fl = f.label?.toLowerCase() || '';
                if (fl === updateLabel) return true;
                if (fl.includes(' / ')) {
                  const parts = fl.split(' / ').map((s: string) => s.trim().toLowerCase());
                  if (parts.some((p: string) => p === updateLabel || updateLabel.includes(p) || p.includes(updateLabel))) return true;
                }
                if (fl.includes(updateLabel) || updateLabel.includes(fl)) return true;
                const aliases = BILL_LABEL_ALIASES[updateLabel];
                if (aliases && aliases.some(a => fl.includes(a) || a.includes(fl))) return true;
                for (const [key, vals] of Object.entries(BILL_LABEL_ALIASES)) {
                  if (vals.some(v => v === updateLabel || updateLabel.includes(v))) {
                    if (fl.includes(key) || key.includes(fl) || vals.some(v => fl.includes(v))) return true;
                  }
                }
                return false;
              });
              if (field) {
                field.value = update.value;
              } else {
                resolvedContent.fields.push({ label: update.label, value: update.value });
              }
            }

            console.log(`[Native Function→UpdateProp] Updated "${propTitle}": ${updates.map(u => `${u.label}=${u.value}`).join(', ')}`);

            this.sendMessage(session.ws, {
              type: 'prop_update',
              timestamp: Date.now(),
              propTitle,
              updates,
              updatedFields: resolvedContent.fields,
            });
          } else {
            console.warn(`[Native Function→UpdateProp] Prop "${propTitle}" not found or has no fields`);
          }
        } else {
          console.warn(`[Native Function→UpdateProp] Missing required args or no active scenario`);
        }

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }
        break;
      }

      case 'END_SCENARIO': {
        const spokenText = (fn.args.spoken_text || fn.args.text) as string | undefined;
        const performanceNotes = (fn.args.feedback || fn.args.performance_notes) as string | undefined;
        const activeScenario = session.activeScenario;

        if (activeScenario) {
          console.log(`[Native Function→EndScenario] Ending "${activeScenario.title}"`);

          if (session.userId && activeScenario.id) {
            try {
              const { userScenarioHistory } = await import('@shared/schema');
              const sharedDb = getSharedDb();
              const durationSeconds = Math.round((Date.now() - (activeScenario.startedAt || Date.now())) / 1000);

              await sharedDb.update(userScenarioHistory)
                .set({
                  completedAt: new Date(),
                  durationSeconds,
                  performanceNotes: performanceNotes || undefined,
                })
                .where(and(
                  eq(userScenarioHistory.userId, String(session.userId)),
                  eq(userScenarioHistory.scenarioId, activeScenario.id),
                ));
            } catch (err: any) {
              console.warn('[EndScenario] History update failed:', err.message);
            }
          }

          this.sendMessage(session.ws, {
            type: 'scenario_ended',
            timestamp: Date.now(),
            scenarioId: activeScenario.id,
            scenarioSlug: activeScenario.slug,
            performanceNotes: performanceNotes || undefined,
          });

          session.activeScenario = null;
        } else {
          console.log('[Native Function→EndScenario] No active scenario to end');
        }

        if (spokenText && !session.functionCallText) {
          session.functionCallText = spokenText;
        }
        break;
      }
      
      case 'SUMMARY': {
        const summaryTitle = (fn.args.title as string | undefined) || "Session Summary";
        const summaryItems = fn.args.items as string | undefined;
        const summaryPoints = fn.args.points as string | undefined;
        const rawContent = summaryItems || summaryPoints || '';
        
        if (rawContent || summaryTitle) {
          const lines = rawContent.split('\n').map((l: string) => l.replace(/^\*\*|\*\*$/g, '').replace(/\*\*/g, '').trim()).filter(Boolean);
          const summaryData = {
            title: summaryTitle,
            words: lines,
            phrases: [] as string[],
            totalItems: lines.length,
          };
          console.log(`[Native Function→Summary] title="${summaryTitle}" ${lines.length} points`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'summary', content: rawContent, data: summaryData }],
          });
        } else {
          console.warn(`[Native Function→Summary] No title or items provided, skipping. Args: ${JSON.stringify(fn.args).substring(0, 200)}`);
        }
        break;
      }
      
      case 'READING': {
        const passage = (fn.args.content || fn.args.passage) as string | undefined;
        const readingTitle = fn.args.title as string | undefined;
        const translation = fn.args.translation as string | undefined;
        
        if (passage) {
          const readingData = {
            character: passage,
            reading: translation || '',
            title: readingTitle || undefined,
            language: session.targetLanguage || undefined,
          };
          console.log(`[Native Function→Reading] "${passage.substring(0, 50)}..."${readingTitle ? ` title="${readingTitle}"` : ''}${translation ? ` translation="${translation.substring(0, 50)}..."` : ''}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'reading', content: passage, data: readingData, translation }],
          });
        } else {
          console.warn(`[Native Function→Reading] No content/passage provided. Args: ${JSON.stringify(fn.args).substring(0, 200)}`);
        }
        break;
      }
      
      case 'PLAY': {
        const description = fn.args.description as string | undefined;
        const playText = fn.args.text as string | undefined;
        
        if (playText && !session.functionCallText) {
          session.functionCallText = playText;
        }
        
        if (description) {
          console.log(`[Native Function→Play] "${description.substring(0, 50)}..."`);
          
          let audioUrl: string | undefined;
          let audioDurationMs: number | undefined;
          
          try {
            const { getCachedPronunciationAudio } = await import('./audio-caching-service');
            const targetLanguage = session.targetLanguage || 'spanish';
            const voiceGender = session.voiceGender || 'female';
            
            const result = await getCachedPronunciationAudio(
              description,
              targetLanguage,
              voiceGender as 'female' | 'male',
              'normal',
              { contentType: 'pronunciation' }
            );
            
            audioUrl = result.audioUrl;
            audioDurationMs = result.durationMs || undefined;
            console.log(`[Native Function→Play] ${result.cacheHit ? 'Cache HIT' : 'Generated'}: got audio (${audioDurationMs}ms)`);
          } catch (error: any) {
            console.warn(`[Native Function→Play] Failed to get cached audio: ${error.message}`);
          }
          
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ 
              type: 'play', 
              content: description,
              data: {
                text: description,
                speed: 'normal' as const,
                audioUrl,
                audioDurationMs,
              },
            }],
          });
        }
        break;
      }
      
      case 'STROKE': {
        const character = fn.args.character as string | undefined;
        const strokeText = fn.args.text as string | undefined;
        
        if (strokeText && !session.functionCallText) {
          session.functionCallText = strokeText;
        }
        
        if (character) {
          const strokeData = {
            character,
            language: (fn.args.language as string | undefined)?.toLowerCase() || undefined,
            strokes: [],
          };
          console.log(`[Native Function→Stroke] Character: ${character}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'stroke', content: character, data: strokeData }],
          });
        }
        break;
      }
      
      case 'TONE': {
        const syllable = (fn.args.syllable || fn.args.pinyin) as string | undefined;
        const toneNumber = fn.args.toneNumber as number | undefined;
        const toneText = fn.args.text as string | undefined;
        
        if (syllable) {
          const toneNumbers = toneNumber ? [toneNumber] : (syllable.match(/\d/g)?.map(Number) || []);
          const toneData = {
            word: syllable,
            pinyin: syllable,
            tones: toneNumbers,
            language: 'mandarin',
            meaning: undefined as string | undefined,
          };
          console.log(`[Native Function→Tone] Syllable: ${syllable} tones: ${toneNumbers}`);
          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{ type: 'tone', content: syllable, data: toneData }],
          });
        }
        if (toneText && !session.functionCallText) {
          session.functionCallText = toneText;
        }
        break;
      }
      
      case 'PRONUNCIATION_TAG': {
        const word = fn.args.word as string | undefined;
        const ipa = fn.args.ipa as string | undefined;
        const hint = fn.args.hint as string | undefined;
        const language = fn.args.language as string | undefined;
        
        if (word) {
          const tagLanguage = language || session.targetLanguage || 'spanish';
          console.log(`[Native Function→PronunciationTag] [${tagLanguage}:${word}]${ipa ? ` IPA: ${ipa}` : ''}${hint ? ` hint: ${hint}` : ''}`);
          if (!session.pendingPronunciationTags) {
            session.pendingPronunciationTags = [];
          }
          session.pendingPronunciationTags.push({ word, language: tagLanguage, ipa, hint });
        }
        break;
      }

      case 'BROWSE_SYLLABUS': {
        const text = fn.args.text as string | undefined;
        const unitNumber = (fn.args.unitNumber || fn.args.unit_number) as number | undefined;
        const showCompleted = (fn.args.showCompleted ?? fn.args.show_completed) !== false;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const filteredUnits = unitNumber
                ? activeUnits.filter((_, i) => i + 1 === unitNumber)
                : activeUnits;

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              const syllabusData: Array<{
                unitName: string;
                unitIndex: number;
                actflLevel: string | null;
                lessons: Array<{
                  id: string;
                  name: string;
                  type: string;
                  status: string;
                  orderIndex: number;
                }>;
              }> = [];

              for (const unit of filteredUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons
                  .filter(l => !l.isRemoved)
                  .sort((a, b) => a.orderIndex - b.orderIndex);

                const lessonData = activeLessons
                  .map(l => {
                    const progress = progressMap.get(l.sourceLessonId || l.id);
                    const status = progress?.status || 'not_started';
                    return {
                      id: l.sourceLessonId || l.id,
                      name: l.name,
                      type: l.lessonType,
                      status,
                      orderIndex: l.orderIndex,
                    };
                  })
                  .filter(l => showCompleted || l.status !== 'completed_assigned');

                syllabusData.push({
                  unitName: unit.name,
                  unitIndex: unit.orderIndex,
                  actflLevel: unit.actflLevel,
                  lessons: lessonData,
                });
              }

              const totalLessons = syllabusData.reduce((sum, u) => sum + u.lessons.length, 0);
              const completedLessons = syllabusData.reduce(
                (sum, u) => sum + u.lessons.filter(l => l.status === 'completed_assigned' || l.status === 'completed_early').length, 0
              );

              console.log(`[Native Function→BrowseSyllabus] ${syllabusData.length} units, ${totalLessons} lessons (${completedLessons} completed)`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Syllabus: ${activeClass.class.name}`,
                  data: {
                    syllabusOverview: true,
                    className: activeClass.class.name,
                    units: syllabusData,
                    totalLessons,
                    completedLessons,
                    progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastSyllabusData = syllabusData;
            } else {
              console.log(`[Native Function→BrowseSyllabus] No active class found for ${session.targetLanguage}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→BrowseSyllabus] Error:`, err.message);
          }
        }
        break;
      }

      case 'START_LESSON': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;
        const lessonName = (fn.args.lessonName || fn.args.lesson_name) as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { curriculumLessons, curriculumDrillItems, classCurriculumLessons, classCurriculumUnits } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            let lesson: any = null;

            if (lessonId) {
              const [found] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, lessonId)).limit(1);
              lesson = found;
            }

            if (!lesson && lessonName) {
              const studentId = String(session.userId);
              const enrollments = await storage.getStudentEnrollments(studentId);
              const activeClass = enrollments.find(e =>
                e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
              );

              if (activeClass?.class) {
                const units = await storage.getClassCurriculumUnits(activeClass.class.id);
                const activeUnitIds = units.filter(u => !u.isRemoved).map(u => u.id);

                if (activeUnitIds.length > 0) {
                  const classLessons = await storage.getClassCurriculumLessonsForUnits(activeUnitIds);
                  const match = classLessons.find(l =>
                    !l.isRemoved && l.name.toLowerCase().includes(lessonName.toLowerCase())
                  );

                  if (match?.sourceLessonId) {
                    const [found] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, match.sourceLessonId)).limit(1);
                    lesson = found;
                  }
                }
              }
            }

            if (lesson) {
              const drills = await sharedDb.select().from(curriculumDrillItems)
                .where(eq(curriculumDrillItems.lessonId, lesson.id))
                .orderBy(curriculumDrillItems.orderIndex);

              session.lessonBundleContext = {
                lessonId: lesson.id,
                lessonName: lesson.name,
                hasBundledDrills: drills.length > 0,
                bundleId: lesson.bundleId || undefined,
                linkedDrillLessonId: lesson.linkedDrillLessonId || undefined,
                drillsProvisioned: drills.length > 0,
                provisionedDrillCount: drills.length,
              };

              const lessonContent = {
                id: lesson.id,
                name: lesson.name,
                type: lesson.lessonType,
                description: lesson.description,
                objectives: lesson.objectives || [],
                conversationTopic: lesson.conversationTopic,
                conversationPrompt: lesson.conversationPrompt,
                requiredVocabulary: lesson.requiredVocabulary || [],
                requiredGrammar: lesson.requiredGrammar || [],
                estimatedMinutes: lesson.estimatedMinutes,
                drillCount: drills.length,
              };

              console.log(`[Native Function→StartLesson] Loaded "${lesson.name}" (${lesson.id}) with ${drills.length} drills`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Lesson: ${lesson.name}`,
                  data: {
                    lessonLoaded: true,
                    lesson: lessonContent,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastLoadedLesson = lessonContent;
            } else {
              console.warn(`[Native Function→StartLesson] Lesson not found: id=${lessonId} name=${lessonName}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→StartLesson] Error:`, err.message);
          }
        }
        break;
      }

      case 'LOAD_VOCAB_SET': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId && lessonId) {
          try {
            const { curriculumLessons } = await import('@shared/schema');
            const sharedDb = getSharedDb();

            const [lesson] = await sharedDb.select().from(curriculumLessons).where(eq(curriculumLessons.id, lessonId)).limit(1);

            if (lesson) {
              const vocabWords = lesson.requiredVocabulary || [];

              const vocabData = vocabWords.map((word: string, index: number) => ({
                word,
                index,
              }));

              console.log(`[Native Function→LoadVocabSet] Loaded ${vocabData.length} vocab items for "${lesson.name}"`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Vocabulary: ${lesson.name}`,
                  data: {
                    vocabSetLoaded: true,
                    lessonId: lesson.id,
                    lessonName: lesson.name,
                    vocabulary: vocabData,
                    totalWords: vocabData.length,
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastVocabSet = vocabData;
            } else {
              console.warn(`[Native Function→LoadVocabSet] Lesson not found: ${lessonId}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→LoadVocabSet] Error:`, err.message);
          }
        }
        break;
      }

      case 'SHOW_PROGRESS': {
        const text = fn.args.text as string | undefined;
        const detailed = fn.args.detailed === true;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            const actflProgress = await storage.getOrCreateActflProgress(session.targetLanguage || 'spanish', studentId).catch(() => null);
            const userProgressData = await storage.getOrCreateUserProgress(session.targetLanguage || 'spanish', studentId).catch(() => null);

            const progressData: Record<string, unknown> = {
              actflLevel: actflProgress?.currentActflLevel || 'Novice Low',
              wordsLearned: userProgressData?.wordsLearned || 0,
              lessonsCompleted: userProgressData?.lessonsCompleted || 0,
              totalMinutes: userProgressData?.totalMinutes || 0,
              streakDays: userProgressData?.streakDays || 0,
            };

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              let totalLessons = 0;
              let completedLessons = 0;
              let inProgressLessons = 0;
              const unitBreakdown: Array<{ name: string; total: number; completed: number; }> = [];

              for (const unit of activeUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons.filter(l => !l.isRemoved);
                const unitCompleted = activeLessons.filter(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'completed_assigned' || p?.status === 'completed_early';
                }).length;
                const unitInProgress = activeLessons.filter(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'in_progress';
                }).length;

                totalLessons += activeLessons.length;
                completedLessons += unitCompleted;
                inProgressLessons += unitInProgress;

                if (detailed) {
                  unitBreakdown.push({
                    name: unit.name,
                    total: activeLessons.length,
                    completed: unitCompleted,
                  });
                }
              }

              progressData.className = activeClass.class.name;
              progressData.totalLessons = totalLessons;
              progressData.completedLessons = completedLessons;
              progressData.inProgressLessons = inProgressLessons;
              progressData.progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
              if (detailed) {
                progressData.unitBreakdown = unitBreakdown;
              }
            }

            console.log(`[Native Function→ShowProgress] ACTFL: ${progressData.actflLevel}, ${progressData.completedLessons || 0}/${progressData.totalLessons || '?'} lessons`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'write',
                content: `Progress: ${progressData.actflLevel}`,
                data: {
                  progressSnapshot: true,
                  ...progressData,
                },
              }],
            });
          } catch (err: any) {
            console.error(`[Native Function→ShowProgress] Error:`, err.message);
          }
        }
        break;
      }

      case 'RECOMMEND_NEXT': {
        const text = fn.args.text as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const studentId = String(session.userId);
            const enrollments = await storage.getStudentEnrollments(studentId);
            const activeClass = enrollments.find(e =>
              e.isActive && e.class?.isActive && e.class?.language === session.targetLanguage
            );

            if (activeClass?.class) {
              const classId = activeClass.class.id;
              const units = await storage.getClassCurriculumUnits(classId);
              const activeUnits = units.filter(u => !u.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

              const syllabusProgress = await storage.getSyllabusProgress(studentId, classId);
              const progressMap = new Map(syllabusProgress.map(sp => [sp.lessonId, sp]));

              let recommended: { lessonId: string; lessonName: string; unitName: string; reason: string; } | null = null;

              for (const unit of activeUnits) {
                const lessons = await storage.getClassCurriculumLessons(unit.id);
                const activeLessons = lessons.filter(l => !l.isRemoved).sort((a, b) => a.orderIndex - b.orderIndex);

                const inProgressLesson = activeLessons.find(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return p?.status === 'in_progress';
                });

                if (inProgressLesson) {
                  recommended = {
                    lessonId: inProgressLesson.sourceLessonId || inProgressLesson.id,
                    lessonName: inProgressLesson.name,
                    unitName: unit.name,
                    reason: 'You started this lesson but haven\'t finished it yet. Let\'s pick up where you left off!',
                  };
                  break;
                }

                const nextLesson = activeLessons.find(l => {
                  const p = progressMap.get(l.sourceLessonId || l.id);
                  return !p || p.status === 'not_started';
                });

                if (nextLesson) {
                  recommended = {
                    lessonId: nextLesson.sourceLessonId || nextLesson.id,
                    lessonName: nextLesson.name,
                    unitName: unit.name,
                    reason: 'This is the next lesson in your syllabus. Ready to learn something new!',
                  };
                  break;
                }
              }

              if (recommended) {
                console.log(`[Native Function→RecommendNext] Recommending "${recommended.lessonName}" from ${recommended.unitName}`);

                this.sendMessage(session.ws, {
                  type: 'whiteboard_update',
                  timestamp: Date.now(),
                  items: [{
                    type: 'write',
                    content: `Recommended: ${recommended.lessonName}`,
                    data: {
                      recommendation: true,
                      lessonId: recommended.lessonId,
                      lessonName: recommended.lessonName,
                      unitName: recommended.unitName,
                      reason: recommended.reason,
                    },
                  }],
                });

                if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
                session.pendingMemoryLookupPromises.push(Promise.resolve());
                session.lastRecommendation = recommended;
              } else {
                console.log(`[Native Function→RecommendNext] No lessons available to recommend`);
                this.sendMessage(session.ws, {
                  type: 'whiteboard_update',
                  timestamp: Date.now(),
                  items: [{
                    type: 'write',
                    content: 'Congratulations! You\'ve completed all available lessons!',
                    data: { recommendation: true, allComplete: true },
                  }],
                });
              }
            } else {
              console.log(`[Native Function→RecommendNext] No active class found for ${session.targetLanguage}`);
            }
          } catch (err: any) {
            console.error(`[Native Function→RecommendNext] Error:`, err.message);
          }
        }
        break;
      }

      case 'DRILL_SESSION': {
        const text = fn.args.text as string | undefined;
        const lessonId = (fn.args.lessonId || fn.args.lesson_id) as string | undefined;
        const requestedDrillType = (fn.args.drillType || fn.args.drill_type) as string | undefined;
        const requestedCount = (fn.args.count as number | undefined) || 10;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { arisDrillAssignments } = await import('@shared/schema');
            const { eq, and } = await import('drizzle-orm');
            const db = (await import('../db')).db;

            let targetLessonId = lessonId;
            if (!targetLessonId && session.lastLoadedLesson) {
              targetLessonId = session.lastLoadedLesson.id;
            }

            let drillItems: Array<{ prompt: string; expectedAnswer?: string; options?: string[]; pronunciation?: string; drillType?: string }> = [];

            if (targetLessonId) {
              const assignments = await db.select().from(arisDrillAssignments)
                .where(and(
                  eq(arisDrillAssignments.userId, String(session.userId)),
                  eq(arisDrillAssignments.lessonId, targetLessonId),
                ));

              for (const a of assignments) {
                if (requestedDrillType && a.drillType !== requestedDrillType) continue;
                if (a.drillContent && Array.isArray((a.drillContent as any).items)) {
                  for (const item of (a.drillContent as any).items) {
                    drillItems.push({ ...item, drillType: a.drillType });
                  }
                }
              }
            }

            if (drillItems.length === 0 && targetLessonId) {
              const assignments = await db.select().from(arisDrillAssignments)
                .where(and(
                  eq(arisDrillAssignments.userId, String(session.userId)),
                  eq(arisDrillAssignments.targetLanguage, session.targetLanguage || 'spanish'),
                ));

              for (const a of assignments) {
                if (requestedDrillType && a.drillType !== requestedDrillType) continue;
                if (a.drillContent && Array.isArray((a.drillContent as any).items)) {
                  for (const item of (a.drillContent as any).items) {
                    drillItems.push({ ...item, drillType: a.drillType });
                  }
                }
                if (drillItems.length >= requestedCount) break;
              }
            }

            if (drillItems.length > requestedCount) {
              drillItems = drillItems.slice(0, requestedCount);
            }

            if (drillItems.length > 0) {
              const sessionState = {
                items: drillItems,
                currentIndex: 0,
                correctCount: 0,
                incorrectCount: 0,
                totalItems: drillItems.length,
                startTime: Date.now(),
                lessonId: targetLessonId,
              };
              session.drillSession = sessionState;

              const firstItem = drillItems[0];
              const { parseDrillContent } = await import('@shared/whiteboard-types');
              const drillData = parseDrillContent(firstItem.drillType || 'repeat', firstItem.prompt);

              console.log(`[Native Function→DrillSession] Started session with ${drillItems.length} items`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'drill',
                  content: firstItem.prompt,
                  data: { ...drillData, sessionProgress: `1 / ${drillItems.length}` },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDrillSessionData = {
                totalItems: drillItems.length,
                currentItem: 1,
                firstDrill: { type: firstItem.drillType, prompt: firstItem.prompt },
              };
            } else {
              console.log(`[Native Function→DrillSession] No drill items found`);
              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDrillSessionData = { totalItems: 0, noDrillsAvailable: true };
            }
          } catch (err: any) {
            console.error(`[Native Function→DrillSession] Error:`, err.message);
          }
        }
        break;
      }

      case 'DRILL_SESSION_NEXT': {
        const text = fn.args.text as string | undefined;
        const wasCorrect = fn.args.was_correct as boolean | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        const drillSession = session.drillSession;
        if (drillSession) {
          if (wasCorrect === true) drillSession.correctCount++;
          else if (wasCorrect === false) drillSession.incorrectCount++;

          drillSession.currentIndex++;

          if (drillSession.currentIndex < drillSession.totalItems) {
            const nextItem = drillSession.items[drillSession.currentIndex];
            const { parseDrillContent } = await import('@shared/whiteboard-types');
            const drillData = parseDrillContent(nextItem.drillType || 'repeat', nextItem.prompt);

            console.log(`[Native Function→DrillSessionNext] Item ${drillSession.currentIndex + 1}/${drillSession.totalItems}`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'drill',
                content: nextItem.prompt,
                data: { ...drillData, sessionProgress: `${drillSession.currentIndex + 1} / ${drillSession.totalItems}` },
              }],
            });

            if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
            session.pendingMemoryLookupPromises.push(Promise.resolve());
            session.lastDrillSessionData = {
              totalItems: drillSession.totalItems,
              currentItem: drillSession.currentIndex + 1,
              correctSoFar: drillSession.correctCount,
              incorrectSoFar: drillSession.incorrectCount,
              nextDrill: { type: nextItem.drillType, prompt: nextItem.prompt },
            };
          } else {
            const elapsed = Math.round((Date.now() - drillSession.startTime) / 1000);
            const accuracy = drillSession.totalItems > 0
              ? Math.round((drillSession.correctCount / drillSession.totalItems) * 100) : 0;

            console.log(`[Native Function→DrillSessionNext] Session complete! ${drillSession.correctCount}/${drillSession.totalItems}`);

            this.sendMessage(session.ws, {
              type: 'whiteboard_update',
              timestamp: Date.now(),
              items: [{
                type: 'summary',
                content: 'Practice Session Complete',
                data: {
                  title: 'Practice Session Complete',
                  stats: [
                    { label: 'Items Completed', value: String(drillSession.totalItems) },
                    { label: 'Correct', value: String(drillSession.correctCount) },
                    { label: 'Incorrect', value: String(drillSession.incorrectCount) },
                    { label: 'Accuracy', value: `${accuracy}%` },
                    { label: 'Duration', value: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` },
                  ],
                },
              }],
            });

            if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
            session.pendingMemoryLookupPromises.push(Promise.resolve());
            session.lastDrillSessionData = {
              sessionComplete: true,
              totalItems: drillSession.totalItems,
              correct: drillSession.correctCount,
              incorrect: drillSession.incorrectCount,
              accuracy,
              durationSeconds: elapsed,
            };
            delete session.drillSession;
          }
        } else {
          console.log(`[Native Function→DrillSessionNext] No active drill session`);
        }
        break;
      }

      case 'DRILL_SESSION_END': {
        const text = fn.args.text as string | undefined;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        const activeDrillSession = session.drillSession;
        if (activeDrillSession) {
          const elapsed = Math.round((Date.now() - activeDrillSession.startTime) / 1000);
          const completed = activeDrillSession.currentIndex;
          const accuracy = completed > 0
            ? Math.round((activeDrillSession.correctCount / completed) * 100) : 0;

          console.log(`[Native Function→DrillSessionEnd] Ending early at ${completed}/${activeDrillSession.totalItems}`);

          this.sendMessage(session.ws, {
            type: 'whiteboard_update',
            timestamp: Date.now(),
            items: [{
              type: 'summary',
              content: 'Practice Session Summary',
              data: {
                title: 'Practice Session Summary',
                stats: [
                  { label: 'Items Attempted', value: `${completed} of ${activeDrillSession.totalItems}` },
                  { label: 'Correct', value: String(activeDrillSession.correctCount) },
                  { label: 'Incorrect', value: String(activeDrillSession.incorrectCount) },
                  { label: 'Accuracy', value: `${accuracy}%` },
                  { label: 'Duration', value: `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` },
                ],
              },
            }],
          });

          if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
          session.pendingMemoryLookupPromises.push(Promise.resolve());
          session.lastDrillSessionData = {
            sessionComplete: true,
            endedEarly: true,
            itemsAttempted: completed,
            totalItems: activeDrillSession.totalItems,
            correct: activeDrillSession.correctCount,
            incorrect: activeDrillSession.incorrectCount,
            accuracy,
            durationSeconds: elapsed,
          };
          delete session.drillSession;
        }
        break;
      }

      case 'REVIEW_DUE_VOCAB': {
        const text = fn.args.text as string | undefined;
        const maxItems = (fn.args.limit || fn.args.max_items) as number || 10;

        if (text && !session.functionCallText) {
          session.functionCallText = text;
        }

        if (session.userId) {
          try {
            const { vocabularyWords } = await import('@shared/schema');
            const { eq, and, lte } = await import('drizzle-orm');
            const db = (await import('../db')).db;

            const now = new Date();
            const dueWords = await db.select().from(vocabularyWords)
              .where(and(
                eq(vocabularyWords.userId, String(session.userId)),
                eq(vocabularyWords.language, session.targetLanguage || 'spanish'),
                lte(vocabularyWords.nextReviewDate, now),
              ))
              .orderBy(vocabularyWords.nextReviewDate)
              .limit(maxItems);

            if (dueWords.length > 0) {
              const vocabList = dueWords.map(w => ({
                id: w.id,
                word: w.word,
                translation: w.translation,
                pronunciation: w.pronunciation,
                difficulty: w.difficulty,
                correctCount: w.correctCount,
                incorrectCount: w.incorrectCount,
                interval: w.interval,
              }));

              console.log(`[Native Function→ReviewDueVocab] Found ${dueWords.length} words due for review`);

              this.sendMessage(session.ws, {
                type: 'whiteboard_update',
                timestamp: Date.now(),
                items: [{
                  type: 'write',
                  content: `Vocabulary Review: ${dueWords.length} words due`,
                  data: {
                    vocabReview: true,
                    words: vocabList.map(w => `${w.word} → ${w.translation}`),
                  },
                }],
              });

              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDueVocab = vocabList;
            } else {
              console.log(`[Native Function→ReviewDueVocab] No words due for review`);
              if (!session.pendingMemoryLookupPromises) session.pendingMemoryLookupPromises = [];
              session.pendingMemoryLookupPromises.push(Promise.resolve());
              session.lastDueVocab = [];
            }
          } catch (err: any) {
            console.error(`[Native Function→ReviewDueVocab] Error:`, err.message);
          }
        }
        break;
      }

      default:
        console.log(`[Native Function Call] Unknown function type: ${fn.legacyType}`);
    }
  }
  
  private async processMemoryLookup(
    session: StreamingSession, 
    query: string, 
    rawDomains: string[]
  ): Promise<void> {
    try {
      const { searchMemory, formatMemoryForConversation, searchTeachingKnowledge: searchTeaching, formatTeachingKnowledge, searchSyllabi: searchSyllabiFunc, formatSyllabusSearch } = await import('./neural-memory-search');
      
      const studentDomains = ['person', 'motivation', 'insight', 'struggle', 'session', 'progress', 'conversation'];
      const teachingDomains = ['idiom', 'cultural', 'procedure', 'principle', 'error-pattern', 'situational-pattern', 'subtlety-cue', 'emotional-pattern', 'creativity-template'];
      const syllabusDomains = ['syllabus'];
      
      const requestedStudentDomains = rawDomains.filter(d => studentDomains.includes(d)) as ('person' | 'motivation' | 'insight' | 'struggle' | 'session' | 'progress' | 'conversation')[];
      const requestedTeachingDomains = rawDomains.filter(d => teachingDomains.includes(d)) as ('idiom' | 'cultural' | 'procedure' | 'principle' | 'error-pattern' | 'situational-pattern' | 'subtlety-cue' | 'emotional-pattern' | 'creativity-template')[];
      const requestedSyllabusDomains = rawDomains.filter(d => syllabusDomains.includes(d));
      
      const searchStudentMemory = requestedStudentDomains.length > 0 || rawDomains.length === 0;
      const searchTeachingKnowledge = requestedTeachingDomains.length > 0 || rawDomains.length === 0;
      const searchSyllabi = requestedSyllabusDomains.length > 0 || rawDomains.length === 0;
      
      const results: string[] = [];
      let totalFound = 0;
      
      const studentId = String(session.userId);
      console.log(`[MemoryLookup DEBUG] rawDomains=${JSON.stringify(rawDomains)}, requestedStudentDomains=${JSON.stringify(requestedStudentDomains)}, searchStudentMemory=${searchStudentMemory}, studentId="${studentId}"`);
      
      if (searchStudentMemory && studentId) {
        const studentDomainFilter = requestedStudentDomains.length > 0 ? requestedStudentDomains : undefined;
        const memoryResults = await searchMemory(studentId, query, studentDomainFilter, session.targetLanguage || undefined);
        if (memoryResults.results.length > 0) {
          results.push(formatMemoryForConversation(memoryResults));
          totalFound += memoryResults.results.length;
        }
      }
      
      if (searchTeachingKnowledge) {
        const teachingDomainFilter = requestedTeachingDomains.length > 0 ? requestedTeachingDomains : undefined;
        const teachingResults = await searchTeaching(query, session.targetLanguage || undefined, teachingDomainFilter);
        if (teachingResults.results.length > 0) {
          results.push(formatTeachingKnowledge(teachingResults));
          totalFound += teachingResults.results.length;
        }
      }
      
      if (searchSyllabi) {
        const syllabusResults = await searchSyllabiFunc(query, session.targetLanguage || undefined);
        if (syllabusResults.results.length > 0) {
          results.push(formatSyllabusSearch(syllabusResults));
          totalFound += syllabusResults.results.length;
        }
      }
      
      if (!session.memoryLookupResults) session.memoryLookupResults = {};
      
      if (results.length > 0) {
        let combinedResults = results.join('\n\n');
        
        combinedResults = combinedResults
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          .replace(/\uFFFD/g, '')
          .replace(/[\u2028\u2029]/g, '\n')
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        console.log(`[MemoryLookup] Sanitized results: ${combinedResults.length} chars (from ${totalFound} memories)`);
        
        session.memoryLookupResults[query] = combinedResults;
        console.log(`[MemoryLookup] Found ${totalFound} results for "${query.substring(0, 50)}..."`);
        
        if (session.hiveChannelId) {
          hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[MEMORY_LOOKUP] Query: "${query}"\nDomains: ${rawDomains.join(', ') || 'all'}\nResults: ${totalFound} found`,
            studentTurn: '',
            beaconType: 'memory_lookup',
            beaconReason: `Daniela searched neural memory for "${query}"`,
          }).catch(err => console.error(`[MemoryLookup] Beacon error:`, err));
        }
        
        brainHealthTelemetry.logMemoryLookupTool({
          sessionId: session.id,
          conversationId: session.conversationId,
          userId: studentId || undefined,
          targetLanguage: session.targetLanguage,
          queryTerms: query,
          resultsCount: totalFound,
          memoryTypes: rawDomains.length > 0 ? rawDomains : undefined,
        }).catch(err => console.warn('[BrainHealth] Memory lookup log failed:', err.message));
      } else {
        session.memoryLookupResults[query] = `No memories found for "${query}". Respond naturally based on what you know.`;
        console.log(`[MemoryLookup] No results found for "${query.substring(0, 50)}..."`);
        
        brainHealthTelemetry.logMemoryLookupTool({
          sessionId: session.id,
          conversationId: session.conversationId,
          userId: studentId || undefined,
          targetLanguage: session.targetLanguage,
          queryTerms: query,
          resultsCount: 0,
          memoryTypes: rawDomains.length > 0 ? rawDomains : undefined,
        }).catch(err => console.warn('[BrainHealth] Memory lookup log failed:', err.message));
      }
    } catch (err: any) {
      console.error(`[MemoryLookup] Error:`, err.message);
      if (!session.memoryLookupResults) session.memoryLookupResults = {};
      session.memoryLookupResults[query] = `Memory lookup failed. Respond naturally based on what you know.`;
    }
  }
  
  private async processExpressLaneLookup(
    session: StreamingSession,
    query: string,
    sessionId: string | undefined,
    limit: number
  ): Promise<void> {
    try {
      const { collaborationMessages } = await import('@shared/schema');
      const sharedDb = getSharedDb();
      
      if (!session.expressLaneLookupResults) session.expressLaneLookupResults = {};
      
      const lookupKey = query || '__browse__';
      let results: any[];
      
      if (query) {
        const keywords = query.split(/\s+/).filter(w => w.length >= 3);
        const keywordConditions = keywords.length > 0
          ? sql.join(keywords.map(kw => sql`content ILIKE ${`%${kw}%`}`), sql` OR `)
          : sql`content ILIKE ${`%${query}%`}`;
        
        if (sessionId) {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(sql`session_id = ${sessionId} AND (${keywordConditions})`)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        } else {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(keywordConditions)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        }
        console.log(`[ExpressLaneLookup] Keyword search for "${query}"`);
      } else {
        if (sessionId) {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .where(sql`session_id = ${sessionId}`)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        } else {
          results = await sharedDb.select()
            .from(collaborationMessages)
            .orderBy(sql`created_at DESC`)
            .limit(limit);
        }
        console.log(`[ExpressLaneLookup] Browse mode — fetching ${limit} most recent messages`);
      }
      
      const label = query ? `search results for "${query}"` : `${results.length} most recent messages (browse mode)`;
      
      if (results.length > 0) {
        const chronological = [...results].reverse();
        const formattedResults = chronological.map(msg => {
          const date = new Date(msg.createdAt).toLocaleDateString();
          const preview = msg.content.length > 2000 ? msg.content.substring(0, 2000) + '...[truncated]' : msg.content;
          return `[${date}] ${msg.role}: ${preview}`;
        }).join('\n\n---\n\n');
        
        session.expressLaneLookupResults[lookupKey] = formattedResults;
        console.log(`[ExpressLaneLookup] Found ${results.length} messages — ${label}`);
        
        if (session.hiveChannelId) {
          hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[EXPRESS_LANE_LOOKUP] ${label}\nResults: ${results.length} messages found`,
            studentTurn: '',
            beaconType: 'express_lane_lookup',
            beaconReason: `Daniela ${query ? 'searched' : 'browsed'} Express Lane history`,
          }).catch(err => console.error(`[ExpressLaneLookup] Beacon error:`, err));
        }
      } else {
        session.expressLaneLookupResults[lookupKey] = `No Express Lane messages found${query ? ` for "${query}"` : ''}. Respond naturally based on what you know.`;
        console.log(`[ExpressLaneLookup] No results found — ${label}`);
      }
    } catch (err) {
      console.error(`[ExpressLaneLookup] Error:`, err);
      if (!session.expressLaneLookupResults) session.expressLaneLookupResults = {};
      session.expressLaneLookupResults[query] = `Express Lane lookup failed. Respond naturally based on what you know.`;
    }
  }
  
  private async processExpressLaneImageRecall(
    session: StreamingSession,
    imageQuery: string,
    reason: string | undefined,
    fnName: string
  ): Promise<void> {
    try {
      const { findExpressLaneImages } = await import('./express-lane-image-loader');
      
      console.log(`[RecallImage] Searching for images matching: "${imageQuery}" (reason: ${reason || 'none'})`);
      
      const userId = parseInt(session.userId, 10);
      const images = await findExpressLaneImages(userId, imageQuery, 3);
      
      if (images.length === 0) {
        console.log(`[RecallImage] No images found for "${imageQuery}"`);
        if (session.conversationHistory) {
          session.conversationHistory.push({
            role: 'user',
            content: `[SYSTEM: No images found in Express Lane matching "${imageQuery}". Available images may include: house photos, family pictures, Grand Canyon, Daniela portrait.]`,
          });
        }
        return;
      }
      
      const imageDescriptions = images.map(img => 
        `- "${img.imageName}" (shared with message: "${img.messageContent.substring(0, 50)}...")`
      ).join('\n');
      
      const textContent = `Found ${images.length} image(s) matching "${imageQuery}":\n${imageDescriptions}\n\nThe actual image(s) are now visible. Look at them and describe what you see to David.`;
      
      if (!session.imageRecallResults) session.imageRecallResults = {};
      session.imageRecallResults[imageQuery] = {
        text: textContent,
        images: images.map(img => ({
          mimeType: img.imageType,
          data: img.base64Data,
        })),
      };
      
      console.log(`[RecallImage] Stored ${images.length} image(s) for multi-step FC (query: "${imageQuery}")`);
      
      if (session.hiveChannelId) {
        hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: `[RECALL_IMAGE] Query: "${imageQuery}"\nFound: ${images.map(i => i.imageName).join(', ')}`,
          studentTurn: '',
          beaconType: 'express_lane_lookup',
          beaconReason: `Daniela recalled Express Lane image(s) for "${imageQuery}"`,
        }).catch(err => console.error(`[RecallImage] Beacon error:`, err));
      }
      
    } catch (err) {
      console.error(`[RecallImage] Error:`, err);
      if (session.conversationHistory) {
        session.conversationHistory.push({
          role: 'user',
          content: `[SYSTEM: Error recalling image: ${(err as Error).message}]`,
        });
      }
    }
  }

  async processExpressLanePost(
    session: StreamingSession,
    message: string,
    topic?: string
  ): Promise<void> {
    try {
      const formattedContent = topic 
        ? `[${topic.toUpperCase()}] ${message}`
        : message;
      
      const activeSessionId = session.expressLaneSessionId;
      
      if (activeSessionId) {
        await founderCollabService.addMessage(activeSessionId, {
          role: 'daniela',
          content: formattedContent,
          messageType: 'text',
        });
        console.log(`[ExpressLane→Post] Message added to session ${activeSessionId}`);
      } else {
        const systemFounderId = 'system-daniela-voice';
        const sessionTitle = 'Voice Session Notes';
        
        const expressSession = await founderCollabService.findOrCreateSessionByTitle(
          systemFounderId,
          sessionTitle
        );
        
        session.expressLaneSessionId = expressSession.id;
        
        await founderCollabService.addMessage(expressSession.id, {
          role: 'daniela',
          content: formattedContent,
          messageType: 'text',
        });
        console.log(`[ExpressLane→Post] Message added to new session ${expressSession.id}`);
      }
      
    } catch (error: any) {
      console.error(`[ExpressLane→Post] Failed to post message:`, error.message);
      console.error(`[ExpressLane→Post] Full error:`, error);
    }
  }

  async processHiveSuggestion(
    session: StreamingSession,
    data: { 
      category: string;
      title: string;
      description: string;
      reasoning?: string;
      priority?: number;
    }
  ): Promise<void> {
    try {
      const validCategories = [
        'self_improvement',
        'content_gap',
        'ux_observation',
        'teaching_insight',
        'product_feature',
      ] as const;
      
      const category = validCategories.includes(data.category as any) 
        ? data.category as typeof validCategories[number]
        : 'self_improvement';
      
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      
      const suggestion = await storage.createDanielaSuggestion({
        category,
        status: 'emerging',
        title: data.title.substring(0, 200),
        description: data.description,
        reasoning: data.reasoning || null,
        priority,
        confidence: 80,
        generatedInMode: session.isFounderMode ? 'founder_mode' : 'normal_session',
        conversationId: session.conversationId,
      });
      
      console.log(`[Hive] Suggestion saved #${suggestion.id}: "${data.title}" (${category})`);
      console.log(`[Hive] Mode: ${session.isFounderMode ? 'founder' : 'normal'}, Priority: ${priority}`);
      
    } catch (error: any) {
      console.error(`[Hive] Failed to save suggestion:`, error.message);
      console.error(`[Hive] Full error:`, error);
    }
  }

  async processSelfSurgery(
    session: StreamingSession,
    data: SelfSurgeryItemData
  ): Promise<void> {
    try {
      const validTargets = [
        'tutor_procedures',
        'teaching_principles',
        'tool_knowledge',
        'situational_patterns',
        'language_idioms',
        'cultural_nuances',
        'learner_error_patterns',
        'dialect_variations',
        'linguistic_bridges',
      ] as const;
      
      if (!validTargets.includes(data.targetTable as any)) {
        console.error(`[Self-Surgery] Invalid target table: ${data.targetTable}`);
        return;
      }
      
      const priority = Math.max(1, Math.min(100, data.priority || 50));
      const confidence = Math.max(1, Math.min(100, data.confidence || 70));
      
      let sessionMode = 'normal';
      if (session.isFounderMode && session.isRawHonestyMode) {
        sessionMode = 'honesty_mode';
      } else if (session.isFounderMode) {
        sessionMode = 'founder_mode';
      }
      
      let contentObj: Record<string, any>;
      try {
        contentObj = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content;
      } catch (parseErr) {
        console.error(`[Self-Surgery] Failed to parse content as JSON:`, parseErr);
        console.log(`[Self-Surgery] Raw content: ${data.content}`);
        return;
      }
      
      const validation = this.validateSurgeryContent(data.targetTable, contentObj);
      if (!validation.valid) {
        console.warn(`[Self-Surgery] Invalid content for ${data.targetTable}: ${validation.error}`);
        console.log(`[Self-Surgery] Missing fields will be noted but proposal still created for review`);
        data.reasoning = `[SCHEMA WARNING: ${validation.error}] ${data.reasoning || ''}`;
      }
      
      console.log(`[Self-Surgery] 📝 Creating PENDING proposal for ${data.targetTable}...`);
      
      const proposal = await storage.createSelfSurgeryProposal({
        targetTable: data.targetTable,
        proposedContent: contentObj,
        reasoning: data.reasoning,
        triggerContext: `Voice session in ${session.targetLanguage} (${sessionMode}${session.conversationId ? `, conv: ${session.conversationId.slice(0, 8)}` : ''})`,
        status: 'pending',
        conversationId: session.conversationId,
        sessionMode,
        targetLanguage: session.targetLanguage,
        priority,
        confidence,
      });
      
      console.log(`[Self-Surgery] ✅ Proposal created #${proposal.id} - awaiting review`);
      console.log(`[Self-Surgery] Target: ${data.targetTable}, Priority: ${priority}, Confidence: ${confidence}`);
      console.log(`[Self-Surgery] Reasoning: ${data.reasoning?.substring(0, 100) || 'No reasoning provided'}...`);
      
      if (session.hiveChannelId) {
        try {
          const contentPreview = typeof data.content === 'string' 
            ? data.content.substring(0, 200) 
            : JSON.stringify(data.content).substring(0, 200);
          
          await hiveCollaborationService.emitBeacon({
            channelId: session.hiveChannelId,
            tutorTurn: `[Self-Surgery PROPOSAL 📝 #${proposal.id}]\nTarget: ${data.targetTable}\nPriority: ${priority}, Confidence: ${confidence}\nStatus: PENDING REVIEW\n\nContent: ${contentPreview}...`,
            beaconType: 'self_surgery_proposal',
            beaconReason: `PENDING: ${data.reasoning}`,
          });
          console.log(`[Self-Surgery] HIVE beacon emitted for pending proposal #${proposal.id}`);
        } catch (hiveErr) {
          console.error(`[Self-Surgery] Failed to emit HIVE beacon:`, hiveErr);
        }
      }
      
    } catch (error: any) {
      console.error(`[Self-Surgery] Failed to create proposal:`, error.message);
      console.error(`[Self-Surgery] Full error:`, error);
    }
  }

  private async processSelfSurgeryProposal(
    session: StreamingSession,
    data: SelfSurgeryItemData
  ): Promise<void> {
    return this.processSelfSurgery(session, data);
  }
  
  private validateSurgeryContent(target: string, content: Record<string, any>): { valid: boolean; error?: string } {
    switch (target) {
      case 'tutor_procedures':
        if (!content.category || !content.trigger || !content.procedure) {
          return { valid: false, error: 'tutor_procedures requires: category, trigger, procedure' };
        }
        break;
      case 'teaching_principles':
        if (!content.category || !content.principle) {
          return { valid: false, error: 'teaching_principles requires: category, principle' };
        }
        break;
      case 'tool_knowledge':
        if (!content.toolName || !content.toolType || !content.purpose || !content.syntax) {
          return { valid: false, error: 'tool_knowledge requires: toolName, toolType, purpose, syntax' };
        }
        break;
      case 'situational_patterns':
        if (!content.patternName) {
          return { valid: false, error: 'situational_patterns requires: patternName' };
        }
        break;
      case 'language_idioms':
        if (!content.idiom || !content.meaning || !content.language) {
          return { valid: false, error: 'language_idioms requires: idiom, meaning, language' };
        }
        break;
      case 'cultural_nuances':
        if (!content.topic || !content.insight || !content.language) {
          return { valid: false, error: 'cultural_nuances requires: topic, insight, language' };
        }
        break;
      case 'learner_error_patterns':
        if (!content.errorType || !content.targetLanguage) {
          return { valid: false, error: 'learner_error_patterns requires: errorType, targetLanguage' };
        }
        break;
      case 'dialect_variations':
        if (!content.standardForm || !content.language) {
          return { valid: false, error: 'dialect_variations requires: standardForm, language' };
        }
        break;
      case 'linguistic_bridges':
        if (!content.sourceLanguage || !content.targetLanguage || !content.concept) {
          return { valid: false, error: 'linguistic_bridges requires: sourceLanguage, targetLanguage, concept' };
        }
        break;
      default:
        return { valid: false, error: `Unknown target table: ${target}` };
    }
    return { valid: true };
  }
  
  async processSupportHandoff(
    session: StreamingSession,
    data: { 
      category: 'technical' | 'account' | 'billing' | 'content' | 'feedback' | 'other';
      reason: string;
      priority: 'low' | 'normal' | 'high' | 'critical';
      context?: string;
    },
    turnId: number
  ): Promise<void> {
    try {
      const recentHistory = session.conversationHistory?.slice(-5) || [];
      const conversationContext = recentHistory
        .map(msg => `${msg.role === 'user' ? 'Student' : 'Tutor'}: ${msg.content}`)
        .join('\n');
      
      const ticket = await storage.createSupportTicket({
        userId: String(session.userId),
        category: data.category,
        priority: data.priority,
        subject: data.reason.substring(0, 200),
        description: data.context || data.reason,
        handoffReason: data.reason,
        tutorContext: conversationContext.substring(0, 2000),
        conversationId: session.conversationId,
        targetLanguage: session.targetLanguage,
        status: 'pending',
      });
      
      console.log(`[Support Handoff] Created ticket #${ticket.id}: ${data.category} (${data.priority})`);
      console.log(`[Support Handoff] Reason: ${data.reason}`);
      
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: ticket.id,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
      });
      
      console.log(`[Support Handoff] Notified client to open Support modal for ticket #${ticket.id}`);
      
    } catch (error: any) {
      console.error(`[Support Handoff] Failed to create ticket:`, error.message);
      
      this.sendMessage(session.ws, {
        type: 'support_handoff',
        timestamp: Date.now(),
        turnId,
        ticketId: null,
        category: data.category,
        reason: data.reason,
        priority: data.priority,
        error: 'Failed to create support ticket',
      });
    }
  }
  
  async processAssistantHandoff(
    session: StreamingSession,
    data: { 
      drillType: 'repeat' | 'translate' | 'match' | 'fill_blank' | 'sentence_order';
      focus: string;
      items: string[];
      priority?: 'low' | 'medium' | 'high';
    },
    turnId: number
  ): Promise<void> {
    try {
      const drillContent = {
        items: data.items.map((item, idx) => ({
          prompt: item.trim(),
        })),
        instructions: `Practice ${data.focus} using ${data.drillType} exercises.`,
        focusArea: data.focus,
        difficulty: 'medium' as const,
      };
      
      const assignment = await storage.createArisDrillAssignment({
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        delegatedBy: 'daniela',
        drillType: data.drillType,
        targetLanguage: session.targetLanguage,
        drillContent,
        priority: data.priority || 'medium',
        status: 'pending',
        origin: 'tutor_delegated',
        lifecycleState: 'active',
        handledBy: 'assistant',
      } as any);
      
      console.log(`[Assistant Handoff] Created assignment #${assignment.id}: ${data.drillType} for "${data.focus}"`);
      console.log(`[Assistant Handoff] Items: ${data.items.length} practice items`);
      
      storage.createCollaborationEvent({
        fromAgent: 'daniela',
        toAgent: 'assistant',
        eventType: 'delegation',
        subject: `Drill: ${data.drillType} - ${data.focus}`,
        content: `Please conduct ${data.drillType} drill practice for student focusing on "${data.focus}". Items: ${data.items.join(', ')}`,
        metadata: {
          delegationId: assignment.id,
          studentContext: {
            targetLanguage: session.targetLanguage,
            difficultyLevel: session.difficultyLevel,
          },
          priority: data.priority || 'medium',
        },
        userId: String(session.userId),
        conversationId: session.conversationId || null,
        status: 'pending',
      }).catch(err => console.error(`[Assistant Handoff] Failed to post collab event:`, err));
      
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: assignment.id,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        priority: data.priority || 'medium',
      });
      
      console.log(`[Assistant Handoff] Notified client - drill assignment #${assignment.id} ready`);
      
    } catch (error: any) {
      console.error(`[Assistant Handoff] Failed to create assignment:`, error.message);
      
      this.sendMessage(session.ws, {
        type: 'assistant_handoff',
        timestamp: Date.now(),
        turnId,
        assignmentId: null,
        drillType: data.drillType,
        focus: data.focus,
        itemCount: data.items.length,
        error: 'Failed to create drill assignment',
      });
    }
  }
  
  async enrichWordMapItems(
    ws: WS,
    items: WhiteboardItem[],
    language: string,
    turnId: number
  ): Promise<void> {
    const wordMapItems = items.filter((item): item is WordMapItem => 
      isWordMapItem(item) && item.data?.isLoading === true
    );
    
    if (wordMapItems.length === 0) return;
    
    const gemini = getGeminiStreamingService();
    
    for (const item of wordMapItems) {
      try {
        const targetWord = item.data.targetWord;
        if (!targetWord) continue;
        
        console.log(`[WORD_MAP] Enriching "${targetWord}" for ${language}...`);
        const startTime = Date.now();
        
        const relatedWords = await gemini.generateRelatedWords(targetWord, language);
        
        const elapsed = Date.now() - startTime;
        console.log(`[WORD_MAP] Enriched "${targetWord}" in ${elapsed}ms:`, {
          synonyms: relatedWords.synonyms.length,
          antonyms: relatedWords.antonyms.length,
          collocations: relatedWords.collocations.length,
          wordFamily: relatedWords.wordFamily.length,
        });
        
        const enrichedItem: WordMapItem = {
          ...item,
          data: {
            targetWord,
            synonyms: relatedWords.synonyms,
            antonyms: relatedWords.antonyms,
            collocations: relatedWords.collocations,
            wordFamily: relatedWords.wordFamily,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [enrichedItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
        
      } catch (error: any) {
        console.error(`[WORD_MAP] Error enriching "${item.data.targetWord}":`, error.message);
        
        const fallbackItem: WordMapItem = {
          ...item,
          data: {
            ...item.data,
            isLoading: false,
          },
        };
        
        this.sendMessage(ws, {
          type: 'whiteboard_update',
          timestamp: Date.now(),
          turnId,
          items: [fallbackItem],
          shouldClear: false,
        } as StreamingWhiteboardMessage);
      }
    }
  }
  
  addSttKeyterms(session: StreamingSession, words: string[]): void {
    const existing: string[] = session.sttKeyterms || [];
    const newSet = [...new Set([...existing, ...words.map(w => w.toLowerCase())])];
    const capped = newSet.slice(-100);
    session.sttKeyterms = capped;
    console.log(`[STT Keyterms] Updated: [${capped.join(', ')}] (${capped.length} terms)`);
  }

  async processArchitectMessage(
    session: StreamingSession,
    message: ArchitectMessage
  ): Promise<void> {
    try {
      const conversationId = session.conversationId;
      
      switch (message.type) {
        case 'question':
          await collaborationHubService.emitDanielaQuestion({
            content: message.content,
            summary: `Daniela asks: ${message.content.substring(0, 100)}...`,
            conversationId,
          });
          break;
          
        case 'suggestion':
          await collaborationHubService.emitDanielaSuggestion({
            content: message.content,
            summary: `Daniela suggests: ${message.content.substring(0, 100)}...`,
            category: 'improvement_idea',
            urgency: message.urgency || 'medium',
            conversationId,
            targetLanguage: session.targetLanguage,
            studentLevel: session.difficultyLevel,
          });
          break;
          
        case 'observation':
        case 'request':
        default:
          await collaborationHubService.emitDanielaInsight({
            content: message.content,
            summary: `Daniela ${message.type}: ${message.content.substring(0, 100)}...`,
            conversationId,
            targetLanguage: session.targetLanguage,
          });
          break;
      }
      
      if (session.hiveChannelId) {
        let beaconType: BeaconType = 'feature_idea';
        if (message.type === 'request') beaconType = 'tool_request';
        else if (message.type === 'question') beaconType = 'knowledge_gap';
        else if (message.type === 'suggestion') beaconType = 'feature_idea';
        
        await hiveCollaborationService.emitBeacon({
          channelId: session.hiveChannelId,
          tutorTurn: `[TO_ARCHITECT ${message.type}]: ${message.content}`,
          beaconType,
          beaconReason: `Daniela communicated with Architect: ${message.type}`,
        });
      }
      
      console.log(`[Architect Bidirectional] Message routed: ${message.type} → collaboration hub`);
      
    } catch (error: any) {
      console.error(`[Architect Bidirectional] Failed to route message:`, error.message);
    }
  }
}
