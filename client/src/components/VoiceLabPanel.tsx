import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Volume2, Save, RotateCcw, Play, Sparkles, Users, ArrowRightLeft, Globe, Mic } from "lucide-react";

type PersonalityType = 'warm' | 'calm' | 'energetic' | 'professional';

interface TTSMetadata {
  personalities: Record<PersonalityType, {
    name: string;
    description: string;
    baseline: string;
    emotions: string[];
  }>;
  expressivenessLevels: Record<number, {
    label: string;
    description: string;
  }>;
  emotionsMap: Record<PersonalityType, Record<number, string[]>>;
  getDefaultEmotion: Record<PersonalityType, string>;
}

interface TutorVoice {
  id: string;
  language: string;
  gender: 'male' | 'female';
  role: 'tutor' | 'assistant';
  provider: string;
  voiceId: string;
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  personality: PersonalityType;
  expressiveness: number;
  emotion: string;
  isActive: boolean;
  elStability?: number;
  elSimilarityBoost?: number;
  elStyle?: number;
  elSpeakerBoost?: boolean;
  googlePitch?: number;
  googleVolumeGainDb?: number;
  modelVariant?: string | null;
}

interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  gender?: string;
}

interface ElevenLabsVoice {
  id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  description: string;
  previewUrl: string;
  provider: string;
  source?: string;
}

export interface VoiceOverride {
  speakingRate?: number;
  personality?: PersonalityType;
  expressiveness?: number;
  emotion?: string;
  voiceId?: string;
  elStability?: number;
  elSimilarityBoost?: number;
  elStyle?: number;
  geminiLanguageCode?: string;
  glModel?: string;
}

const GL_MODELS: { value: string; label: string; badge: string; description: string }[] = [
  {
    value: 'gemini-3.1-flash-live-preview',
    label: 'GL 3.1 Flash',
    badge: '3.1',
    description: 'Current production model — 3rd gen, 65K output tokens',
  },
  {
    value: 'gemini-2.5-flash-native-audio-preview-12-2025',
    label: '2.5 Native Audio',
    badge: '2.5',
    description: '2nd gen (older) · async tools · affective dialog · 8K output limit',
  },
];

interface GoogleVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
  languageCode: string;
}

interface VoiceLabPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  tutorGender: 'male' | 'female';
  onOverrideChange: (override: VoiceOverride | null) => void;
  currentOverride: VoiceOverride | null;
  onTutorGenderChange?: (gender: 'male' | 'female') => void;
  role?: 'tutor' | 'assistant';  // Default is 'tutor' for main tutors (ElevenLabs/Cartesia), 'assistant' for drill tutors (Google TTS)
}

const SAMPLE_PHRASES: Record<string, string> = {
  english: "Hello! I'm excited to help you learn. What would you like to practice today?",
  spanish: "¡Hola! Estoy emocionada de ayudarte a aprender. ¿Qué te gustaría practicar hoy?",
  french: "Bonjour! Je suis ravie de vous aider à apprendre. Que souhaitez-vous pratiquer aujourd'hui?",
  german: "Hallo! Ich freue mich, dir beim Lernen zu helfen. Was möchtest du heute üben?",
  italian: "Ciao! Sono entusiasta di aiutarti a imparare. Cosa vorresti praticare oggi?",
  portuguese: "Olá! Estou animada para ajudá-lo a aprender. O que você gostaria de praticar hoje?",
  japanese: "こんにちは！学習のお手伝いができて嬉しいです。今日は何を練習したいですか？",
  'mandarin chinese': "你好！很高兴能帮助你学习。你今天想练习什么？",
  korean: "안녕하세요! 학습을 도와드리게 되어 기쁩니다. 오늘 무엇을 연습하고 싶으세요?",
  hebrew: "!שלום! אני שמחה לעזור לך ללמוד. מה תרצה לתרגל היום?",
};

export function VoiceLabPanel({
  isOpen,
  onClose,
  language,
  tutorGender,
  onOverrideChange,
  currentOverride,
  onTutorGenderChange,
  role = 'tutor',  // Default to main tutor (Cartesia)
}: VoiceLabPanelProps) {
  const isAssistant = role === 'assistant';
  const { toast } = useToast();
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [audioElement] = useState(() => new Audio());

  // GL Live audition state
  type GlPhase = 'idle' | 'recording' | 'waiting' | 'playing';
  const [glPhase, setGlPhase] = useState<GlPhase>('idle');
  const [glCountdown, setGlCountdown] = useState(3);
  const glCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Local state for sliders (initialized from current voice or override)
  const [speakingRate, setSpeakingRate] = useState(0.9);
  const [personality, setPersonality] = useState<PersonalityType>('warm');
  const [expressiveness, setExpressiveness] = useState(3);
  const [emotion, setEmotion] = useState('friendly');
  const [hasChanges, setHasChanges] = useState(false);
  
  // ElevenLabs-specific voice settings
  const [elStability, setElStability] = useState(0.5);
  const [elSimilarityBoost, setElSimilarityBoost] = useState(0.75);
  const [elStyle, setElStyle] = useState(0.0);
  
  // Voice selection state (for audition)
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  
  // Accent variant state (for Gemini TTS language code)
  const [selectedAccent, setSelectedAccent] = useState<string>('');
  // GL model selection — must be declared here so it can be used in the currentVoice query key
  const [selectedGlModel, setSelectedGlModel] = useState<string>(GL_MODELS[0].value);

  // Fetch accent variants for language
  const { data: accentVariants } = useQuery<Record<string, { label: string; code: string; googleSupported: boolean; geminiLiveSupported: boolean; gl31Status: 'working' | 'broken' | 'untested' }[]>>({
    queryKey: ['/api/admin/accent-variants'],
    enabled: isOpen,
  });
  const languageAccents = accentVariants?.[language] || [];

  // Fetch current tutor voice (main tutor for role='tutor', assistant for role='assistant')
  // Include selectedGlModel in the query key so switching GL models triggers a refetch,
  // picking up per-model voice preferences when they exist.
  const { data: currentVoice, isLoading: isLoadingVoice } = useQuery<TutorVoice>({
    queryKey: ['/api/admin/voices/current', language, tutorGender, role, selectedGlModel],
    queryFn: async () => {
      if (isAssistant) {
        const res = await fetch(`/api/admin/voices/current?language=${language}&gender=${tutorGender}&role=assistant`);
        if (!res.ok) throw new Error('Failed to fetch voice');
        return res.json();
      }
      const params = new URLSearchParams({ language, gender: tutorGender });
      if (selectedGlModel) params.set('modelVariant', selectedGlModel);
      const res = await fetch(`/api/admin/voices/current?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch voice');
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch TTS metadata (personalities, emotions, etc.) - only for Cartesia main tutors
  const { data: ttsMetadata } = useQuery<TTSMetadata>({
    queryKey: ['/api/admin/tts-metadata'],
    enabled: isOpen && !isAssistant && currentVoice?.provider !== 'elevenlabs',
  });
  
  const isElevenLabs = currentVoice?.provider === 'elevenlabs';
  const isGoogle = currentVoice?.provider === 'google';
  const isGemini = currentVoice?.provider === 'gemini';
  const isGeminiLive = currentVoice?.provider === 'gemini-live';

  // Fetch available Cartesia voices for main tutors (only when using Cartesia)
  const { data: cartesiaVoicesData, isLoading: isLoadingCartesiaVoices } = useQuery<{ voices: CartesiaVoice[]; total: number }>({
    queryKey: ['/api/admin/cartesia-voices', language, tutorGender],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cartesia-voices/${language}/${tutorGender}`);
      if (!res.ok) throw new Error('Failed to fetch voices');
      return res.json();
    },
    enabled: isOpen && !!language && !isAssistant && !isElevenLabs && !isGoogle && !isGemini && !isGeminiLive,
  });
  const cartesiaVoices = cartesiaVoicesData?.voices || [];

  interface GeminiVoice { id: string; name: string; gender: string; provider: string; }
  const { data: geminiVoicesData, isLoading: isLoadingGeminiVoices } = useQuery<GeminiVoice[]>({
    queryKey: ['/api/admin/gemini-tts-voices'],
    enabled: isOpen && isGemini,
  });
  const geminiVoices = (geminiVoicesData || [])
    .filter(v => !tutorGender || v.gender === tutorGender)
    .map(v => ({ id: v.id, name: v.name, description: 'Gemini 2.5 Flash TTS', language: '', gender: v.gender }));

  interface GeminiLiveVoice { id: string; name: string; gender: string; provider: string; description: string; }
  // Fetch GL voices always (not gated on isGeminiLive) — needed for the GL Audition picker on any voice card
  const { data: geminiLiveVoicesData, isLoading: isLoadingGeminiLiveVoices } = useQuery<GeminiLiveVoice[]>({
    queryKey: ['/api/admin/gemini-live-voices'],
    enabled: isOpen && !isAssistant,
  });
  const geminiLiveVoices = (geminiLiveVoicesData || [])
    .filter(v => !tutorGender || v.gender === tutorGender)
    .map(v => ({ id: v.id, name: `${v.name} — ${v.description}`, description: 'Gemini Live', language: '', gender: v.gender }));
  // GL voice selection for the audition — separate from the main TTS voice picker
  const [selectedGlVoiceId, setSelectedGlVoiceId] = useState<string>('');

  const langCodeMap: Record<string, string> = {
    english: 'en', spanish: 'es', french: 'fr', german: 'de',
    italian: 'it', portuguese: 'pt', japanese: 'ja',
    'mandarin chinese': 'zh', korean: 'ko', hebrew: 'he',
  };
  const elLangCode = langCodeMap[language] || '';

  const { data: elevenLabsVoicesData, isLoading: isLoadingElevenLabsVoices } = useQuery<{ voices: ElevenLabsVoice[]; total: number }>({
    queryKey: ['/api/admin/elevenlabs-voices', elLangCode, tutorGender],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (elLangCode) params.set('language', elLangCode);
      if (tutorGender) params.set('gender', tutorGender);
      const res = await fetch(`/api/admin/elevenlabs-voices?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch voices');
      return res.json();
    },
    enabled: isOpen && !!language && !isAssistant && isElevenLabs,
  });
  const elevenLabsVoices = (elevenLabsVoicesData?.voices || []).map(v => ({
    id: v.id,
    name: `${v.name}${v.source === 'library' ? ' [Library]' : ''}`,
    description: v.description || '',
    language: v.labels?.accent || '',
    gender: v.labels?.gender || undefined,
  }));

  // Fetch available Google TTS voices for assistants OR main tutors using Google provider
  const { data: googleVoicesData, isLoading: isLoadingGoogleVoices } = useQuery<{ voices: GoogleVoice[]; total: number }>({
    queryKey: ['/api/admin/google-voices', language, tutorGender],
    queryFn: async () => {
      const res = await fetch(`/api/admin/google-voices/${language}/${tutorGender}`);
      if (!res.ok) throw new Error('Failed to fetch voices');
      return res.json();
    },
    enabled: isOpen && !!language && (isAssistant || isGoogle),
  });
  const googleVoices = googleVoicesData?.voices || [];

  // Use appropriate voice list based on role and provider
  const availableVoices = (isAssistant || isGoogle) ? googleVoices : isElevenLabs ? elevenLabsVoices : isGemini ? geminiVoices : isGeminiLive ? geminiLiveVoices : cartesiaVoices;
  const isLoadingVoices = (isAssistant || isGoogle) ? isLoadingGoogleVoices : isElevenLabs ? isLoadingElevenLabsVoices : isGemini ? isLoadingGeminiVoices : isGeminiLive ? isLoadingGeminiLiveVoices : isLoadingCartesiaVoices;

  // Initialize local state from current voice or override
  useEffect(() => {
    if (currentVoice) {
      setSpeakingRate(currentOverride?.speakingRate ?? currentVoice.speakingRate);
      setPersonality((currentOverride?.personality ?? currentVoice.personality) as PersonalityType);
      setExpressiveness(currentOverride?.expressiveness ?? currentVoice.expressiveness);
      setEmotion(currentOverride?.emotion ?? currentVoice.emotion);
      setSelectedVoiceId(currentOverride?.voiceId ?? currentVoice.voiceId);
      setElStability(currentVoice.elStability ?? 0.5);
      setElSimilarityBoost(currentVoice.elSimilarityBoost ?? 0.75);
      setElStyle(currentVoice.elStyle ?? 0.0);
      setSelectedAccent(currentOverride?.geminiLanguageCode ?? '');
      setHasChanges(!!currentOverride);
    }
  }, [currentVoice, currentOverride, isOpen]);

  // Get available emotions for current personality/expressiveness
  const availableEmotions = ttsMetadata?.emotionsMap?.[personality]?.[expressiveness] || 
    ttsMetadata?.personalities?.[personality]?.emotions || 
    ['friendly', 'curious', 'happy'];

  // Update emotion when personality/expressiveness changes
  useEffect(() => {
    if (availableEmotions.length > 0 && !availableEmotions.includes(emotion)) {
      setEmotion(availableEmotions[0]);
    }
  }, [personality, expressiveness, availableEmotions]);

  // Apply changes as session override
  const handleApply = () => {
    const override: VoiceOverride = {
      speakingRate,
      personality,
      expressiveness,
      emotion,
      ...(selectedVoiceId && selectedVoiceId !== currentVoice?.voiceId ? { voiceId: selectedVoiceId } : {}),
      ...(isElevenLabs ? { elStability, elSimilarityBoost, elStyle } : {}),
      ...((isGemini || isGeminiLive) && selectedAccent ? { geminiLanguageCode: selectedAccent } : {}),
      ...(selectedGlModel && selectedGlModel !== GL_MODELS[0].value ? { glModel: selectedGlModel } : {}),
    };
    onOverrideChange(override);
    setHasChanges(true);
    
    const voiceChanged = selectedVoiceId && selectedVoiceId !== currentVoice?.voiceId;
    const selectedVoiceName = availableVoices.find(v => v.id === selectedVoiceId)?.name;
    toast({
      title: voiceChanged ? `Switched to ${selectedVoiceName}` : "Voice settings applied",
      description: "Changes will take effect on the tutor's next response.",
    });
  };

  // Reset to original voice settings
  const handleReset = () => {
    if (currentVoice) {
      setSpeakingRate(currentVoice.speakingRate);
      setPersonality(currentVoice.personality as PersonalityType);
      setExpressiveness(currentVoice.expressiveness);
      setEmotion(currentVoice.emotion);
      setSelectedVoiceId(currentVoice.voiceId);
      setElStability(currentVoice.elStability ?? 0.5);
      setElSimilarityBoost(currentVoice.elSimilarityBoost ?? 0.75);
      setElStyle(currentVoice.elStyle ?? 0.0);
      setSelectedAccent('');
    }
    onOverrideChange(null);
    setHasChanges(false);
    toast({
      title: "Settings reset",
      description: "Reverted to saved voice and teaching configuration.",
    });
  };

  // Save changes permanently to database
  // For gemini-live voices, pass modelVariant so the save creates/updates a model-specific
  // record rather than overwriting the base record — enabling per-model voice preferences.
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentVoice) throw new Error('No voice to update');
      const res = await apiRequest('PATCH', `/api/admin/voices/${currentVoice.id}`, {
        speakingRate,
        personality,
        expressiveness,
        emotion,
        ...(selectedVoiceId && selectedVoiceId !== currentVoice.voiceId ? { voiceId: selectedVoiceId } : {}),
        ...(isElevenLabs ? { elStability, elSimilarityBoost, elStyle } : {}),
        // Per-model voice preference: pass modelVariant for gemini-live voices so the
        // backend saves to a model-specific record instead of the shared base record.
        ...(isGeminiLive && selectedGlModel ? { modelVariant: selectedGlModel } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/voices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/voices/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tutor-voices'] });
      // Apply saved settings as override for current session
      // (Session voiceDefaults are loaded at start and won't update mid-session)
      // This ensures the saved settings apply immediately to current session
      const override: VoiceOverride = {
        speakingRate,
        personality,
        expressiveness,
        emotion,
        ...(selectedVoiceId && selectedVoiceId !== currentVoice?.voiceId ? { voiceId: selectedVoiceId } : {}),
        ...(isElevenLabs ? { elStability, elSimilarityBoost, elStyle } : {}),
        ...((isGemini || isGeminiLive) && selectedAccent ? { geminiLanguageCode: selectedAccent } : {}),
      };
      onOverrideChange(override);
      setHasChanges(false);
      toast({
        title: "Voice saved",
        description: "Settings saved and applied to current session.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Audition current settings
  const handleAudition = async () => {
    if (!currentVoice) return;
    
    const auditVoiceId = selectedVoiceId || currentVoice.voiceId;
    const auditVoiceName = availableVoices.find(v => v.id === auditVoiceId)?.name || auditVoiceId;
    console.log(`[VoiceLab] Auditioning voice: ${auditVoiceId} (${auditVoiceName}), provider: ${currentVoice.provider}`);

    setIsAuditioning(true);
    try {
      const phrase = SAMPLE_PHRASES[language] || SAMPLE_PHRASES.english;
      const bodyData: Record<string, unknown> = {
        voiceId: auditVoiceId,
        text: phrase,
        languageCode: currentVoice.languageCode,
        speakingRate,
        emotion,
        provider: currentVoice.provider || (isAssistant ? 'google' : 'elevenlabs'),
      };
      if (isElevenLabs) {
        bodyData.elStability = elStability;
        bodyData.elSimilarityBoost = elSimilarityBoost;
        bodyData.elStyle = elStyle;
        bodyData.elSpeed = speakingRate;
      }
      if (isGoogle) {
        if (selectedAccent) bodyData.accentLanguage = selectedAccent;
      }
      if (isGemini) {
        if (selectedAccent) bodyData.accentLanguage = selectedAccent;
        bodyData.nativeLanguage = 'english';
      }
      if (isGeminiLive) {
        bodyData.provider = 'gemini';
        if (selectedAccent) bodyData.accentLanguage = selectedAccent;
        bodyData.nativeLanguage = 'english';
      }
      const res = await fetch('/api/admin/voice-audition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Audition failed');
      }
      
      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioElement.src = audioUrl;
      audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsAuditioning(false);
      };
      await audioElement.play();
    } catch (error: any) {
      toast({
        title: "Audition failed",
        description: error.message,
        variant: "destructive",
      });
      setIsAuditioning(false);
    }
  };

  // GL Live audition: record 3 s of mic audio → send to real GL 3.1 session → play WAV response
  const handleGlAudition = async () => {
    if (!currentVoice || glPhase !== 'idle') return;

    // Resolve the GL voice: if on a gemini-live card use the selected TTS voice;
    // otherwise use the dedicated GL audition picker (falling back to Aoede on server).
    const voiceId = isGeminiLive
      ? (selectedVoiceId || currentVoice.voiceId)
      : (selectedGlVoiceId || geminiLiveVoices[0]?.id || 'Aoede');
    const langCode = selectedAccent || languageAccents[0]?.code || 'es-ES';

    try {
      // 1. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });

      // 2. Record 3 s at 16 kHz using ScriptProcessor (raw PCM)
      const RECORD_MS = 3000;
      setGlPhase('recording');
      setGlCountdown(3);
      glCountdownRef.current = setInterval(() => {
        setGlCountdown(c => Math.max(0, c - 1));
      }, 1000);

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      const buffers: Float32Array[] = [];
      processor.onaudioprocess = (e) => {
        buffers.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      await new Promise(resolve => setTimeout(resolve, RECORD_MS));

      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      await audioCtx.close();
      if (glCountdownRef.current) clearInterval(glCountdownRef.current);

      // 3. Encode Float32 → Int16 PCM → base64
      const totalLen = buffers.reduce((n, b) => n + b.length, 0);
      const pcm16 = new Int16Array(totalLen);
      let offset = 0;
      for (const buf of buffers) {
        for (let i = 0; i < buf.length; i++) {
          const s = Math.max(-1, Math.min(1, buf[i]));
          pcm16[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as any));
      }
      const base64Audio = btoa(binary);

      // 4. Send to server → real GL session (model selected in Voice Lab)
      setGlPhase('waiting');
      const res = await fetch('/api/admin/gl-audition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, languageCode: langCode, voiceId, model: selectedGlModel }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'GL audition failed');
      }

      // 5. Play the WAV response
      setGlPhase('playing');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioElement.src = url;
      audioElement.onended = () => {
        URL.revokeObjectURL(url);
        setGlPhase('idle');
      };
      await audioElement.play();
    } catch (error: any) {
      if (glCountdownRef.current) clearInterval(glCountdownRef.current);
      setGlPhase('idle');
      toast({
        title: "GL Audition failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="left" className="w-[340px] sm:w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Voice Lab
            {hasChanges && (
              <Badge variant="secondary" className="ml-2">Modified</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Experiment with {currentVoice?.voiceName || 'tutor'}'s voice settings in real-time
          </SheetDescription>
        </SheetHeader>

        {isLoadingVoice ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : currentVoice ? (
          <div className="space-y-6 py-6">
            {/* Current Voice Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{currentVoice.voiceName}</p>
                  {currentVoice.modelVariant && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {GL_MODELS.find(m => m.value === currentVoice.modelVariant)?.badge ?? currentVoice.modelVariant}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {currentVoice.language} · {currentVoice.gender}
                  {isGeminiLive && !currentVoice.modelVariant && (
                    <span className="ml-1 text-xs opacity-60">· base (all models)</span>
                  )}
                </p>
              </div>
              {selectedVoiceId && selectedVoiceId !== currentVoice.voiceId && (
                <Badge variant="outline" className="text-xs">
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  {availableVoices.find(v => v.id === selectedVoiceId)?.name || 'Custom'}
                </Badge>
              )}
            </div>

            {/* Voice Selection for Audition */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>Voice Selection</Label>
              </div>
              <Select 
                value={selectedVoiceId || currentVoice.voiceId} 
                onValueChange={(v) => setSelectedVoiceId(v)}
              >
                <SelectTrigger data-testid="select-voice-lab-voice">
                  <SelectValue placeholder="Select a voice..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {isLoadingVoices ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading voices...</span>
                    </div>
                  ) : availableVoices.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-2 px-3">
                      No voices available for {language}
                    </div>
                  ) : (
                    availableVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.name}</span>
                          {voice.gender && (
                            <span className="text-xs text-muted-foreground">
                              ({voice.gender === 'feminine' || voice.gender === 'female' ? 'F' : voice.gender === 'masculine' || voice.gender === 'male' ? 'M' : voice.gender})
                            </span>
                          )}
                          {voice.id === currentVoice.voiceId && (
                            <Badge variant="secondary" className="text-xs ml-1">Current</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Try different voices - click Audition to preview
              </p>
            </div>

            {/* Accent Variant - for Gemini TTS or Google Chirp3 HD with multiple regional variants */}
            {(isGemini || isGoogle) && languageAccents.length > 1 && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <Label>Accent Variant</Label>
                  </div>
                  <Select
                    value={selectedAccent || languageAccents[0]?.code || ''}
                    onValueChange={(v) => setSelectedAccent(v)}
                  >
                    <SelectTrigger data-testid="select-accent-variant">
                      <SelectValue placeholder="Select accent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {languageAccents.map(variant => (
                        <SelectItem key={variant.code} value={variant.code}>
                          <span className="flex items-center gap-2">
                            <span>{variant.label}</span>
                            <span className="font-mono text-xs text-muted-foreground">{variant.code}</span>
                            {isGemini && variant.gl31Status === 'working' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-green-600 border-green-400 dark:text-green-400 dark:border-green-600">3.1 ✓</Badge>
                            )}
                            {isGemini && variant.gl31Status === 'broken' && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-red-600 border-red-400 dark:text-red-400 dark:border-red-600">3.1 ✗</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isGoogle
                      ? "Regional accent for Google Chirp3 HD — swaps locale prefix on voice name"
                      : "Regional accent for Gemini TTS — sets language code on speech config"}
                  </p>
                </div>
              </>
            )}

            {/* Gemini Live mode — voice config + accent variant */}
            {isGeminiLive && (
              <>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Real-time Audio Pipeline</p>
                    <p className="text-xs text-muted-foreground">
                      Gemini Live generates speech directly — no separate STT or TTS step.
                      Enable with <span className="font-mono">GEMINI_LIVE_VOICE=true</span>.
                    </p>
                  </div>
                </div>
                {languageAccents.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Label>Accent Variant</Label>
                    </div>
                    <Select
                      value={selectedAccent || languageAccents[0]?.code || ''}
                      onValueChange={(v) => setSelectedAccent(v)}
                    >
                      <SelectTrigger data-testid="select-gemini-live-accent">
                        <SelectValue placeholder="Select accent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {languageAccents.map(variant => (
                          <SelectItem key={variant.code} value={variant.code}>
                            <span className="flex items-center gap-2">
                              <span>{variant.label}</span>
                              <span className="font-mono text-xs text-muted-foreground">{variant.code}</span>
                              {selectedGlModel === GL_MODELS[0].value && variant.gl31Status === 'working' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-green-600 border-green-400 dark:text-green-400 dark:border-green-600">3.1 ✓</Badge>
                              )}
                              {selectedGlModel === GL_MODELS[0].value && variant.gl31Status === 'broken' && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-red-600 border-red-400 dark:text-red-400 dark:border-red-600">3.1 ✗</Badge>
                              )}
                              {selectedGlModel === GL_MODELS[1].value && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-600">3.5 new</Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Regional accent hint — passed to Gemini Live as language code
                    </p>
                  </div>
                )}
              </>
            )}

            <Separator />

            {/* Speaking Speed - all providers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Speaking Speed</Label>
                <span className="text-sm font-medium">
                  {speakingRate.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[speakingRate]}
                onValueChange={([value]) => setSpeakingRate(value)}
                min={isElevenLabs ? 0.5 : isGoogle ? 0.25 : 0.7}
                max={isElevenLabs ? 2.0 : isGoogle || isGemini || isGeminiLive ? 4.0 : 1.3}
                step={0.1}
                className="w-full"
                data-testid="slider-voice-lab-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow</span>
                <span>Natural</span>
                <span>Fast</span>
              </div>
            </div>

            {isGoogle || isGemini || isGeminiLive ? null : isElevenLabs ? (
              <>
                {/* ElevenLabs Voice Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Stability</Label>
                    <span className="text-sm font-medium">{elStability.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[elStability]}
                    onValueChange={([value]) => setElStability(value)}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    data-testid="slider-voice-lab-el-stability"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Expressive</span>
                    <span>Consistent</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Similarity</Label>
                    <span className="text-sm font-medium">{elSimilarityBoost.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[elSimilarityBoost]}
                    onValueChange={([value]) => setElSimilarityBoost(value)}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    data-testid="slider-voice-lab-el-similarity"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Creative</span>
                    <span>Faithful</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Style Exaggeration</Label>
                    <span className="text-sm font-medium">{elStyle.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[elStyle]}
                    onValueChange={([value]) => setElStyle(value)}
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full"
                    data-testid="slider-voice-lab-el-style"
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep at 0 for most natural results
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Cartesia-specific: Personality */}
                {ttsMetadata && (
                  <div className="space-y-2">
                    <Label>Personality</Label>
                    <Select 
                      value={personality} 
                      onValueChange={(v) => setPersonality(v as PersonalityType)}
                    >
                      <SelectTrigger data-testid="select-voice-lab-personality">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ttsMetadata.personalities).map(([key, preset]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <span>{preset.name}</span>
                              <span className="text-xs text-muted-foreground">{preset.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Cartesia-specific: Expressiveness */}
                {ttsMetadata && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Expressiveness</Label>
                      <span className="text-sm font-medium">
                        {ttsMetadata.expressivenessLevels[expressiveness]?.label || `Level ${expressiveness}`}
                      </span>
                    </div>
                    <Slider
                      value={[expressiveness]}
                      onValueChange={([value]) => setExpressiveness(value)}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                      data-testid="slider-voice-lab-expressiveness"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtle</span>
                      <span>Balanced</span>
                      <span>Dramatic</span>
                    </div>
                  </div>
                )}

                {/* Emotion */}
                <div className="space-y-2">
                  <Label>Emotion</Label>
                  <Select value={emotion} onValueChange={setEmotion}>
                    <SelectTrigger data-testid="select-voice-lab-emotion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmotions.map((em) => (
                        <SelectItem key={em} value={em}>
                          <span className="capitalize">{em}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Regular TTS Audition — hidden for gemini-live cards (TTS proxy gives misleading results) */}
              {!isGeminiLive && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleAudition}
                  disabled={isAuditioning || glPhase !== 'idle'}
                  data-testid="button-voice-lab-audition"
                >
                  {isAuditioning ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isAuditioning
                    ? `Playing ${availableVoices.find(v => v.id === (selectedVoiceId || currentVoice?.voiceId))?.name?.split(' —')[0] || (selectedVoiceId || currentVoice?.voiceId)}...`
                    : 'Audition'
                  }
                </Button>
              )}

              {/* GL Live Audition — available on any tutor voice card */}
              {!isAssistant && (
                <div className="space-y-2">
                  {/* GL Model selector */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">GL Model</Label>
                    <div className="grid grid-cols-2 gap-1">
                      {GL_MODELS.map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setSelectedGlModel(m.value)}
                          data-testid={`button-gl-model-${m.badge}`}
                          className={[
                            'rounded-md border px-2 py-1.5 text-left transition-colors',
                            selectedGlModel === m.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted/30 text-muted-foreground hover-elevate',
                          ].join(' ')}
                        >
                          <p className="text-xs font-medium leading-tight">{m.label}</p>
                          <p className="text-[10px] leading-tight mt-0.5 opacity-80">{m.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice picker only when not already on a gemini-live card */}
                  {!isGeminiLive && geminiLiveVoices.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">GL Voice to audition</Label>
                      <Select
                        value={selectedGlVoiceId || geminiLiveVoices[0]?.id || ''}
                        onValueChange={setSelectedGlVoiceId}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid="select-gl-audition-voice">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {geminiLiveVoices.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              {v.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGlAudition}
                    disabled={glPhase !== 'idle' || isAuditioning}
                    data-testid="button-voice-lab-gl-audition"
                  >
                    {glPhase === 'recording' ? (
                      <Mic className="h-4 w-4 mr-2 text-red-500 animate-pulse" />
                    ) : glPhase === 'waiting' || glPhase === 'playing' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mic className="h-4 w-4 mr-2" />
                    )}
                    {glPhase === 'recording'
                      ? `Recording… ${glCountdown}s`
                      : glPhase === 'waiting'
                      ? `Waiting for ${GL_MODELS.find(m => m.value === selectedGlModel)?.label ?? 'GL'} response…`
                      : glPhase === 'playing'
                      ? 'Playing GL response…'
                      : `Audition with ${GL_MODELS.find(m => m.value === selectedGlModel)?.label ?? 'GL'}`
                    }
                  </Button>
                </div>
              )}

              {/* Apply Button - Session Override */}
              <Button
                className="w-full"
                onClick={handleApply}
                data-testid="button-voice-lab-apply"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Apply to Session
              </Button>

              <div className="flex gap-2">
                {/* Reset Button */}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                  disabled={!hasChanges && !currentOverride}
                  data-testid="button-voice-lab-reset"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>

                {/* Save Button - Permanent */}
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  data-testid="button-voice-lab-save"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </div>
            
            <Separator />
            
            {/* Assistant Tutors Reference - Read Only */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium text-muted-foreground">Practice Partners (Assistants)</Label>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2" data-testid="assistant-tutors-list">
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1 font-medium text-muted-foreground border-b pb-1 mb-1">
                  <span>Language</span>
                  <span>Female</span>
                  <span>Male</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Spanish</span>
                  <span>Aris</span>
                  <span>Marco</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">French</span>
                  <span>Colette</span>
                  <span>Henri</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">German</span>
                  <span>Liesel</span>
                  <span>Klaus</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Italian</span>
                  <span>Valentina</span>
                  <span>Enzo</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Japanese</span>
                  <span>Yuki</span>
                  <span>Takeshi</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Mandarin</span>
                  <span>Lian</span>
                  <span>Chen</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Portuguese</span>
                  <span>Beatriz</span>
                  <span>Tiago</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">English</span>
                  <span>Grace</span>
                  <span>Oliver</span>
                </div>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-1">
                  <span className="text-muted-foreground">Korean</span>
                  <span>Eun-ji</span>
                  <span>Min-ho</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Assistants use Google Cloud TTS for practice drills.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No voice configured for this language/gender
          </div>
        )}

        <SheetFooter className="text-xs text-muted-foreground">
          <p>Changes apply to Daniela's next response. Save to persist permanently.</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
