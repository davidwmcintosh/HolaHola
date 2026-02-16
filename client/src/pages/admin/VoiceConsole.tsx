import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Play, Pause, Plus, Edit2, Trash2, Volume2, User, Languages, Loader2, Sparkles, Heart, Headphones, MessageSquare, GraduationCap, Scale, Ear, Globe, Bot } from "lucide-react";

// Personality preset types matching backend
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
  role: 'tutor' | 'assistant' | 'support' | 'alden';
  provider: string;
  voiceId: string;
  voiceName: string;
  languageCode: string;
  speakingRate: number;
  personality: PersonalityType;
  expressiveness: number;
  emotion: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  elStability?: number;
  elSimilarityBoost?: number;
  elStyle?: number;
  elSpeakerBoost?: boolean;
  googlePitch?: number;
  googleVolumeGainDb?: number;
  geminiLanguageCode?: string | null;
}

interface CartesiaVoice {
  id: string;
  name: string;
  description: string;
  language: string;
  gender: 'male' | 'female' | string;
  isPublic: boolean;
  previewUrl?: string;
  source?: string;
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

interface GeminiVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  provider: string;
}

interface GoogleVoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

const DEFAULT_TUTOR_NAMES: Record<string, Record<string, string>> = {
  'Aoede': {
    'english': 'Cindy', 'spanish': 'Daniela', 'french': 'Juliette',
    'italian': 'Liv', 'japanese': 'Sayuri', 'mandarin chinese': 'Hua',
    'korean': 'Jihyun', 'german': 'Aoede', 'portuguese': 'Aoede', 'hebrew': 'Yael',
  },
  'Puck': {
    'spanish': 'Agustin', 'french': 'Vincent', 'portuguese': 'Camilo',
    'korean': 'Minho', 'english': 'Puck', 'german': 'Puck',
    'italian': 'Puck', 'japanese': 'Puck', 'mandarin chinese': 'Puck', 'hebrew': 'Puck',
  },
  'Orus': {
    'english': 'Blake', 'italian': 'Luca', 'german': 'Lukas',
    'mandarin chinese': 'Tao', 'spanish': 'Orus', 'french': 'Orus',
    'portuguese': 'Orus', 'japanese': 'Orus', 'korean': 'Orus', 'hebrew': 'Orus',
  },
  'Leda': {
    'german': 'Greta', 'portuguese': 'Isabel',
    'english': 'Leda', 'spanish': 'Leda', 'french': 'Leda',
    'italian': 'Leda', 'japanese': 'Leda', 'mandarin chinese': 'Leda',
    'korean': 'Leda', 'hebrew': 'Leda',
  },
  'Fenrir': {
    'japanese': 'Daisuke', 'english': 'Augustine',
    'spanish': 'Fenrir', 'french': 'Fenrir', 'german': 'Fenrir',
    'italian': 'Fenrir', 'portuguese': 'Fenrir', 'mandarin chinese': 'Fenrir',
    'korean': 'Fenrir', 'hebrew': 'Fenrir',
  },
  'Kore': {
    'english': 'Kore', 'spanish': 'Kore', 'french': 'Kore',
    'german': 'Kore', 'italian': 'Kore', 'portuguese': 'Kore',
    'japanese': 'Kore', 'mandarin chinese': 'Kore', 'korean': 'Kore', 'hebrew': 'Kore',
  },
  'Charon': {
    'english': 'Charon', 'spanish': 'Charon', 'french': 'Charon',
    'german': 'Charon', 'italian': 'Charon', 'portuguese': 'Charon',
    'japanese': 'Charon', 'mandarin chinese': 'Charon', 'korean': 'Charon', 'hebrew': 'Charon',
  },
  'Zephyr': {
    'english': 'Zephyr', 'spanish': 'Zephyr', 'french': 'Zephyr',
    'german': 'Zephyr', 'italian': 'Zephyr', 'portuguese': 'Zephyr',
    'japanese': 'Zephyr', 'mandarin chinese': 'Zephyr', 'korean': 'Zephyr', 'hebrew': 'Zephyr',
  },
};

function getDefaultTutorName(voiceId: string, language: string): string {
  const baseVoice = voiceId.includes('-') ? voiceId.split('-').pop() || voiceId : voiceId;
  return DEFAULT_TUTOR_NAMES[baseVoice]?.[language] || baseVoice;
}

const SUPPORTED_LANGUAGES = [
  { value: 'english', label: 'English', code: 'en' },
  { value: 'spanish', label: 'Spanish', code: 'es' },
  { value: 'french', label: 'French', code: 'fr' },
  { value: 'german', label: 'German', code: 'de' },
  { value: 'italian', label: 'Italian', code: 'it' },
  { value: 'portuguese', label: 'Portuguese', code: 'pt' },
  { value: 'japanese', label: 'Japanese', code: 'ja' },
  { value: 'mandarin chinese', label: 'Mandarin Chinese', code: 'zh' },
  { value: 'korean', label: 'Korean', code: 'ko' },
  { value: 'hebrew', label: 'Hebrew', code: 'he' },
];

const SAMPLE_PHRASES: Record<string, { target: string; native: string }> = {
  english: { 
    target: "Hello! I'm excited to help you learn English. What would you like to practice today?",
    native: "Hello! I'm excited to help you learn English. What would you like to practice today?"
  },
  spanish: { 
    target: "¡Hola! Estoy emocionado de ayudarte a aprender español. ¿Qué te gustaría practicar hoy?",
    native: "Hello! I'm excited to help you learn Spanish. What would you like to practice today?"
  },
  french: { 
    target: "Bonjour! Je suis ravi de vous aider à apprendre le français. Que souhaitez-vous pratiquer aujourd'hui?",
    native: "Hello! I'm excited to help you learn French. What would you like to practice today?"
  },
  german: { 
    target: "Hallo! Ich freue mich, dir beim Deutsch lernen zu helfen. Was möchtest du heute üben?",
    native: "Hello! I'm excited to help you learn German. What would you like to practice today?"
  },
  italian: { 
    target: "Ciao! Sono entusiasta di aiutarti a imparare l'italiano. Cosa vorresti praticare oggi?",
    native: "Hello! I'm excited to help you learn Italian. What would you like to practice today?"
  },
  portuguese: { 
    target: "Olá! Estou animado para ajudá-lo a aprender português. O que você gostaria de praticar hoje?",
    native: "Hello! I'm excited to help you learn Portuguese. What would you like to practice today?"
  },
  japanese: { 
    target: "こんにちは！日本語を学ぶお手伝いができて嬉しいです。今日は何を練習したいですか？",
    native: "Hello! I'm excited to help you learn Japanese. What would you like to practice today?"
  },
  'mandarin chinese': { 
    target: "你好！很高兴能帮助你学习中文。你今天想练习什么？",
    native: "Hello! I'm excited to help you learn Mandarin Chinese. What would you like to practice today?"
  },
  korean: { 
    target: "안녕하세요! 한국어를 배우는 것을 도와드리게 되어 기쁩니다. 오늘 무엇을 연습하고 싶으세요?",
    native: "Hello! I'm excited to help you learn Korean. What would you like to practice today?"
  },
  hebrew: {
    target: "!שלום! אני שמחה לעזור לך ללמוד עברית. מה תרצה לתרגל היום?",
    native: "Hello! I'm excited to help you learn Hebrew. What would you like to practice today?"
  },
};

export function VoiceConsoleContent() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [auditionPhase, setAuditionPhase] = useState<'idle' | 'target' | 'native'>('idle');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [editingVoice, setEditingVoice] = useState<TutorVoice | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [globalProvider, setGlobalProvider] = useState<string>('cartesia');
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  
  // Emotion audition state
  const [auditionPersonality, setAuditionPersonality] = useState<PersonalityType>('warm');
  const [auditionExpressiveness, setAuditionExpressiveness] = useState(3);
  const [auditionEmotion, setAuditionEmotion] = useState('friendly');
  
  const [formData, setFormData] = useState({
    language: '',
    gender: 'female' as 'male' | 'female',
    provider: 'cartesia',
    voiceId: '',
    voiceName: '',
    languageCode: '',
    speakingRate: 0.9,
    personality: 'warm' as PersonalityType,
    expressiveness: 3,
    emotion: 'friendly',
    isActive: true,
    // ElevenLabs voice settings
    elStability: 0.5,
    elSimilarityBoost: 0.75,
    elStyle: 0.0,
    elSpeakerBoost: true,
    // Gemini TTS accent variant
    geminiLanguageCode: '',
  });

  // Fetch configured voices
  const { data: voices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });
  
  // Fetch TTS emotion metadata
  const { data: ttsMetadata } = useQuery<TTSMetadata>({
    queryKey: ["/api/admin/tts-meta"],
  });

  // Fetch accent variants for Gemini TTS and Google Cloud TTS
  const { data: accentVariants } = useQuery<Record<string, { label: string; code: string; googleSupported: boolean }[]>>({
    queryKey: ['/api/admin/accent-variants'],
    enabled: globalProvider === 'gemini' || globalProvider === 'google',
  });
  const allLanguageAccents = accentVariants?.[formData.language] || [];
  const languageAccents = formData.provider === 'google'
    ? allLanguageAccents.filter(v => v.googleSupported)
    : allLanguageAccents;

  // Fetch available Cartesia voices based on selected language and gender
  const { data: cartesiaVoicesData, isLoading: isLoadingCartesiaVoices } = useQuery<{ voices: CartesiaVoice[]; total: number }>({
    queryKey: ["/api/admin/cartesia-voices", formData.language, formData.gender],
    enabled: isAddDialogOpen && !!formData.language && formData.provider === 'cartesia',
  });

  const cartesiaVoices = cartesiaVoicesData?.voices || [];

  const selectedLangCode = SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.code || '';

  const { data: elevenLabsVoicesData, isLoading: isLoadingElevenLabsVoices } = useQuery<{ voices: ElevenLabsVoice[]; total: number }>({
    queryKey: ["/api/admin/elevenlabs-voices", selectedLangCode, formData.gender],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedLangCode) params.set('language', selectedLangCode);
      if (formData.gender) params.set('gender', formData.gender);
      const res = await fetch(`/api/admin/elevenlabs-voices?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch voices');
      return res.json();
    },
    enabled: isAddDialogOpen && !!formData.language && formData.provider === 'elevenlabs',
  });

  const elevenLabsVoices: CartesiaVoice[] = (elevenLabsVoicesData?.voices || [])
    .filter(v => {
      const voiceLang = v.labels?.language || '';
      const voiceGender = v.labels?.gender || '';
      const langMatch = !selectedLangCode || voiceLang === selectedLangCode || v.source === 'library';
      const genderMatch = !formData.gender || voiceGender === formData.gender;
      return langMatch && genderMatch;
    })
    .map(v => ({
      id: v.id,
      name: `${v.name}${v.source === 'library' ? ' [Library]' : ''}`,
      description: v.description || [v.labels?.accent, v.labels?.descriptive, v.labels?.use_case].filter(Boolean).join(', ') || '',
      language: v.labels?.language || '',
      gender: v.labels?.gender || '',
      isPublic: true,
      previewUrl: v.previewUrl,
      source: v.source,
    }));

  const { data: googleVoicesData, isLoading: isLoadingGoogleVoices } = useQuery<GoogleVoiceOption[]>({
    queryKey: ["/api/admin/google-voices", formData.gender],
    queryFn: async () => {
      const res = await fetch(`/api/admin/google-voices/${encodeURIComponent(formData.language || 'english')}/${formData.gender}`);
      if (!res.ok) throw new Error('Failed to fetch Google voices');
      const data = await res.json();
      return data.voices || [];
    },
    enabled: isAddDialogOpen && formData.provider === 'google',
  });

  const googleVoices: CartesiaVoice[] = (Array.isArray(googleVoicesData) ? googleVoicesData : []).map(v => ({
    id: v.id,
    name: v.name,
    description: 'Google Chirp 3 HD',
    language: '',
    gender: v.gender,
    isPublic: true,
  }));

  const { data: geminiVoices, isLoading: isLoadingGeminiVoices } = useQuery<GeminiVoice[]>({
    queryKey: ['/api/admin/gemini-tts-voices'],
    enabled: globalProvider === 'gemini' || formData.provider === 'gemini',
  });

  const geminiVoicesAsCv: CartesiaVoice[] = (geminiVoices || [])
    .filter(v => !formData.gender || v.gender === formData.gender)
    .map(v => ({
      id: v.id,
      name: v.name,
      description: 'Gemini 2.5 Flash TTS',
      language: '',
      gender: v.gender,
      isPublic: true,
    }));

  const activeVoices = formData.provider === 'google' ? googleVoices : formData.provider === 'elevenlabs' ? elevenLabsVoices : formData.provider === 'gemini' ? geminiVoicesAsCv : cartesiaVoices;
  const isLoadingActiveVoices = formData.provider === 'google' ? isLoadingGoogleVoices : formData.provider === 'elevenlabs' ? isLoadingElevenLabsVoices : formData.provider === 'gemini' ? isLoadingGeminiVoices : isLoadingCartesiaVoices;

  const upsertMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/admin/tutor-voices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Voice configuration saved" });
      setIsAddDialogOpen(false);
      setEditingVoice(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/tutor-voices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Voice deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bulkProviderMutation = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest("POST", "/api/admin/tutor-voices/provider", { provider });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      const providerLabel = globalProvider === 'google' ? 'Google Cloud TTS' : globalProvider === 'elevenlabs' ? 'ElevenLabs' : globalProvider === 'gemini' ? 'Gemini 2.5 Flash TTS' : 'Cartesia';
      toast({ title: "Success", description: `All tutor voices switched to ${providerLabel}` });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (voices && voices.length > 0) {
      const tutors = voices.filter(v => v.role === 'tutor' || !v.role);
      if (tutors.length > 0) {
        setGlobalProvider(tutors[0].provider);
      }
    }
  }, [voices]);

  const resetForm = () => {
    setFormData({
      language: '',
      gender: 'female',
      provider: globalProvider,
      voiceId: '',
      voiceName: '',
      languageCode: '',
      speakingRate: 0.9,
      personality: 'warm',
      expressiveness: 3,
      emotion: 'friendly',
      isActive: true,
      elStability: 0.5,
      elSimilarityBoost: 0.75,
      elStyle: 0.0,
      elSpeakerBoost: true,
      geminiLanguageCode: '',
    });
    // Reset emotion audition to defaults (synced with form)
    setAuditionPersonality('warm');
    setAuditionExpressiveness(3);
    setAuditionEmotion('friendly');
  };
  
  // Get available emotions based on personality and expressiveness
  const availableEmotions = ttsMetadata?.emotionsMap?.[auditionPersonality]?.[auditionExpressiveness] || ['friendly'];
  
  // Update emotion when personality/expressiveness changes and sync to formData
  useEffect(() => {
    if (ttsMetadata) {
      const defaultEmotion = ttsMetadata.getDefaultEmotion[auditionPersonality];
      const allowed = ttsMetadata.emotionsMap[auditionPersonality]?.[auditionExpressiveness] || [];
      // If current emotion is not in allowed list, reset to default
      if (!allowed.includes(auditionEmotion)) {
        const newEmotion = defaultEmotion || 'friendly';
        setAuditionEmotion(newEmotion);
        // Also sync to formData
        setFormData(prev => ({ ...prev, emotion: newEmotion }));
      }
    }
  }, [auditionPersonality, auditionExpressiveness, ttsMetadata]);
  
  // Sync audition controls to formData when they change (so changes get saved)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      personality: auditionPersonality,
      expressiveness: auditionExpressiveness,
      emotion: auditionEmotion,
    }));
  }, [auditionPersonality, auditionExpressiveness, auditionEmotion]);

  // Bilingual audition: plays voice in target language, then native (English)
  // Uses the selected auditionEmotion for previewing different emotional tones
  const handleAudition = async (
    voiceId: string, voiceName: string, language: string, languageCode: string, speakingRate: number = 0.9,
    provider?: string,
    elSettings?: { elStability?: number; elSimilarityBoost?: number; elStyle?: number; elSpeed?: number },
    fallbackPreviewUrl?: string,
    trackingId?: string,
    geminiAccentCode?: string,
  ) => {
    const playId = trackingId || voiceId;
    if (playingVoiceId === playId && audioElement) {
      audioElement.pause();
      setPlayingVoiceId(null);
      setAuditionPhase('idle');
      setAudioElement(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    setPlayingVoiceId(playId);
    setAuditionPhase('target');
    
    const phrases = SAMPLE_PHRASES[language] || SAMPLE_PHRASES.english;
    
    try {
      const targetAudio = await playVoiceSample(voiceId, phrases.target, languageCode, speakingRate, auditionEmotion, provider, elSettings, fallbackPreviewUrl, geminiAccentCode);
      
      targetAudio.onended = async () => {
        if (language !== 'english' && !fallbackPreviewUrl) {
          setAuditionPhase('native');
          try {
            const nativeAudio = await playVoiceSample(voiceId, phrases.native, 'en', speakingRate, auditionEmotion, provider, elSettings, undefined, undefined);
            nativeAudio.onended = () => {
              setPlayingVoiceId(null);
              setAuditionPhase('idle');
              setAudioElement(null);
            };
            nativeAudio.onerror = () => {
              setPlayingVoiceId(null);
              setAuditionPhase('idle');
              setAudioElement(null);
            };
            setAudioElement(nativeAudio);
            nativeAudio.play();
          } catch {
            setPlayingVoiceId(null);
            setAuditionPhase('idle');
          }
        } else {
          setPlayingVoiceId(null);
          setAuditionPhase('idle');
          setAudioElement(null);
        }
      };
      
      targetAudio.onerror = () => {
        setPlayingVoiceId(null);
        setAuditionPhase('idle');
        setAudioElement(null);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };

      setAudioElement(targetAudio);
      targetAudio.play();
    } catch (error) {
      setPlayingVoiceId(null);
      setAuditionPhase('idle');
      toast({ title: "Error", description: "Failed to preview voice", variant: "destructive" });
    }
  };

  const playVoiceSample = async (
    voiceId: string, 
    text: string, 
    languageCode: string, 
    speakingRate: number = 0.9,
    emotion?: string,
    provider?: string,
    elSettings?: { elStability?: number; elSimilarityBoost?: number; elStyle?: number; elSpeed?: number },
    fallbackPreviewUrl?: string,
    accentLanguage?: string,
  ): Promise<HTMLAudioElement> => {
    const body: Record<string, unknown> = {
      voiceId,
      text,
      speakingRate,
      emotion: emotion || auditionEmotion,
    };
    if (languageCode) {
      body.language = languageCode;
    }
    if (accentLanguage) {
      body.accentLanguage = accentLanguage;
    }
    if (provider) {
      body.provider = provider;
    }
    if (provider === 'elevenlabs' && elSettings) {
      body.elStability = elSettings.elStability;
      body.elSimilarityBoost = elSettings.elSimilarityBoost;
      body.elStyle = elSettings.elStyle;
      body.elSpeed = elSettings.elSpeed ?? speakingRate;
    }
    const response = await fetch("/api/admin/voice-audition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (fallbackPreviewUrl) {
        const audio = new Audio(fallbackPreviewUrl);
        return audio;
      }
      throw new Error("Failed to preview voice");
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    const originalOnEnded = audio.onended;
    audio.onended = (e) => {
      URL.revokeObjectURL(audioUrl);
      if (originalOnEnded) {
        (originalOnEnded as (ev: Event) => void)(e);
      }
    };
    
    return audio;
  };

  const handlePreview = async (voice: TutorVoice) => {
    const elSettings = voice.provider === 'elevenlabs' ? {
      elStability: voice.elStability,
      elSimilarityBoost: voice.elSimilarityBoost,
      elStyle: voice.elStyle,
      elSpeed: voice.speakingRate,
    } : undefined;
    await handleAudition(voice.voiceId, voice.voiceName, voice.language, voice.languageCode, voice.speakingRate, voice.provider, elSettings, undefined, voice.id, voice.languageCode);
  };

  const handleEdit = (voice: TutorVoice) => {
    setEditingVoice(voice);
    // Load saved emotion settings into form
    const savedPersonality = (voice.personality || 'warm') as PersonalityType;
    const savedExpressiveness = voice.expressiveness || 3;
    const savedEmotion = voice.emotion || 'friendly';
    
    const voiceProvider = voice.provider || globalProvider;
    const providerMatchesVoice = voiceProvider === globalProvider;
    
    let mappedVoiceId = voice.voiceId;
    let mappedVoiceName = voice.voiceName;
    if (!providerMatchesVoice) {
      if (globalProvider === 'google' && !voice.voiceId.includes('Chirp3-HD')) {
        // Bare Gemini name (e.g. "Aoede") maps directly to Google base speaker
        mappedVoiceId = voice.voiceId;
      } else if (globalProvider === 'gemini' && voice.voiceId.includes('Chirp3-HD')) {
        // Full Chirp name → extract bare speaker name for Gemini
        const match = voice.voiceId.match(/Chirp3-HD-(\w+)$/);
        if (match) mappedVoiceId = match[1];
      } else {
        mappedVoiceId = '';
        mappedVoiceName = '';
      }
    } else if (voiceProvider === 'google' && voice.voiceId.includes('Chirp3-HD')) {
      // Existing Google voice with full Chirp name → extract bare speaker for dropdown
      const match = voice.voiceId.match(/Chirp3-HD-(\w+)$/);
      if (match) mappedVoiceId = match[1];
    }
    setFormData({
      language: voice.language,
      gender: voice.gender,
      provider: globalProvider,
      voiceId: mappedVoiceId,
      voiceName: mappedVoiceName,
      languageCode: voice.languageCode,
      speakingRate: voice.speakingRate || 0.9,
      personality: savedPersonality,
      expressiveness: savedExpressiveness,
      emotion: savedEmotion,
      isActive: voice.isActive,
      // ElevenLabs voice settings
      elStability: voice.elStability ?? 0.5,
      elSimilarityBoost: voice.elSimilarityBoost ?? 0.75,
      elStyle: voice.elStyle ?? 0.0,
      elSpeakerBoost: voice.elSpeakerBoost ?? true,
      // Gemini TTS accent variant
      geminiLanguageCode: voice.geminiLanguageCode || '',
    });
    // Sync audition controls with saved values so preview uses saved emotion
    setAuditionPersonality(savedPersonality);
    setAuditionExpressiveness(savedExpressiveness);
    setAuditionEmotion(savedEmotion);
    setIsAddDialogOpen(true);
  };

  const handleLanguageChange = (value: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.value === value);
    setFormData(prev => ({
      ...prev,
      language: value,
      languageCode: lang?.code || '',
      voiceId: '',
      geminiLanguageCode: '',
    }));
  };

  const handleGenderChange = (value: 'male' | 'female') => {
    setFormData(prev => ({
      ...prev,
      gender: value,
      voiceId: '',
    }));
  };

  const handleVoiceSelect = (voiceId: string) => {
    const selectedVoice = activeVoices.find(v => v.id === voiceId);
    if (selectedVoice) {
      const defaultName = getDefaultTutorName(voiceId, formData.language);
      setFormData(prev => ({
        ...prev,
        voiceId: selectedVoice.id,
        voiceName: prev.voiceName || defaultName,
      }));
    }
  };

  const handleGlobalProviderChange = (value: string) => {
    if (value !== globalProvider) {
      setPendingProvider(value);
    }
  };

  const confirmProviderSwitch = () => {
    if (!pendingProvider) return;
    setGlobalProvider(pendingProvider);
    setFormData(prev => ({
      ...prev,
      provider: pendingProvider,
      voiceId: '',
      elStability: pendingProvider === 'elevenlabs' ? 0.5 : prev.elStability,
      elSimilarityBoost: pendingProvider === 'elevenlabs' ? 0.75 : prev.elSimilarityBoost,
      elStyle: pendingProvider === 'elevenlabs' ? 0.0 : prev.elStyle,
      elSpeakerBoost: pendingProvider === 'elevenlabs' ? true : prev.elSpeakerBoost,
      speakingRate: pendingProvider === 'cartesia' 
        ? Math.max(0.7, Math.min(1.3, prev.speakingRate))
        : pendingProvider === 'gemini'
        ? Math.max(0.25, Math.min(4.0, prev.speakingRate))
        : prev.speakingRate,
    }));
    bulkProviderMutation.mutate(pendingProvider);
    setPendingProvider(null);
  };

  const handleSubmit = () => {
    if (!formData.language || !formData.voiceId || !formData.voiceName) {
      toast({ title: "Error", description: "Please select a language and voice", variant: "destructive" });
      return;
    }
    upsertMutation.mutate(formData);
  };

  const mainTutorVoices = voices?.filter(v => v.role === 'tutor' || !v.role) || [];
  const filteredTutorVoices = mainTutorVoices.filter(v => (v.provider || 'cartesia') === globalProvider);
  
  const groupedVoices = filteredTutorVoices.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = { male: null, female: null };
    }
    acc[voice.language][voice.gender] = voice;
    return acc;
  }, {} as Record<string, { male: TutorVoice | null; female: TutorVoice | null }>);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">Voice Console</h1>
              <p className="text-muted-foreground mt-2">
                Configure tutor voices for each language and gender
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                setIsAddDialogOpen(open);
                if (!open) {
                  setEditingVoice(null);
                  resetForm();
                }
              }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-voice">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Voice
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingVoice ? "Edit Voice" : "Add Voice Configuration"}</DialogTitle>
                    <DialogDescription>
                      Select a language, gender, and voice for the tutor. Using {globalProvider === 'google' ? 'Google Cloud TTS (Chirp 3 HD)' : globalProvider === 'elevenlabs' ? 'ElevenLabs Flash v2.5' : globalProvider === 'gemini' ? 'Gemini 2.5 Flash TTS' : 'Cartesia Sonic-3'}.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select value={formData.language} onValueChange={handleLanguageChange}>
                          <SelectTrigger data-testid="select-language">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_LANGUAGES.map(lang => (
                              <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select value={formData.gender} onValueChange={(v) => handleGenderChange(v as 'male' | 'female')}>
                          <SelectTrigger data-testid="select-gender">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Voice Selection Dropdown */}
                    {formData.language && (
                      <div className="space-y-2">
                        <Label>Voice</Label>
                        {isLoadingActiveVoices ? (
                          <div className="flex items-center gap-2 p-3 border rounded-md">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading {formData.provider === 'google' ? 'Google' : formData.provider === 'elevenlabs' ? 'ElevenLabs' : formData.provider === 'gemini' ? 'Gemini' : 'Cartesia'} voices...</span>
                          </div>
                        ) : activeVoices.length === 0 ? (
                          <div className="p-3 border rounded-md border-dashed">
                            <p className="text-sm text-muted-foreground">
                              No voices found. {formData.provider === 'elevenlabs' ? 'Check ElevenLabs API key.' : formData.provider === 'google' ? 'Check Google Cloud TTS credentials.' : formData.provider === 'gemini' ? 'Check Gemini API key.' : `No ${formData.gender} voices for ${SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label}.`}
                            </p>
                          </div>
                        ) : (
                          <Select key={`${formData.provider}-${activeVoices.length}`} value={formData.voiceId || undefined} onValueChange={handleVoiceSelect}>
                            <SelectTrigger data-testid="select-voice">
                              <SelectValue placeholder={editingVoice ? `Current: ${editingVoice.voiceName} (${editingVoice.provider}) — select new` : "Select a voice"} />
                            </SelectTrigger>
                            <SelectContent>
                              {activeVoices.map(voice => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  <div className="flex flex-col">
                                    <span>{voice.name}</span>
                                    {voice.description && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                        {voice.description}
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {/* Tutor Name */}
                    {formData.voiceId && (
                      <div className="space-y-2">
                        <Label>Tutor Name</Label>
                        <Input
                          placeholder="e.g. Cindy, Sofia, Marco..."
                          value={formData.voiceName}
                          onChange={(e) => setFormData(prev => ({ ...prev, voiceName: e.target.value }))}
                          data-testid="input-tutor-name"
                        />
                        <p className="text-xs text-muted-foreground">
                          Display name for this tutor (voice: {activeVoices.find(v => v.id === formData.voiceId)?.name || formData.voiceId})
                        </p>
                      </div>
                    )}

                    {/* Regional Accent Variant (Gemini + Google Cloud TTS) */}
                    {formData.voiceId && (formData.provider === 'gemini' || formData.provider === 'google') && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <Label>Regional Accent</Label>
                        </div>
                        <Select
                          value={formData.geminiLanguageCode || '__default__'}
                          onValueChange={(v) => setFormData(prev => ({ ...prev, geminiLanguageCode: v === '__default__' ? '' : v }))}
                        >
                          <SelectTrigger data-testid="select-accent-variant">
                            <SelectValue placeholder="Select accent..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">Default (no accent override)</SelectItem>
                            {languageAccents.map(variant => (
                              <SelectItem key={variant.code} value={variant.code}>
                                {variant.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {formData.provider === 'google'
                            ? 'Changes the locale prefix on the voice name (e.g. en-US → en-GB for British accent)'
                            : 'Controls the regional pronunciation accent for Gemini TTS'}
                        </p>
                      </div>
                    )}

                    {/* Speed Control */}
                    {formData.voiceId && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Speaking Speed</Label>
                          <span className="text-sm font-medium">
                            {(() => {
                              const rate = formData.speakingRate;
                              const rateStr = rate.toFixed(2) + 'x';
                              let label = '';
                              if (formData.provider === 'google' || formData.provider === 'gemini') {
                                if (rate < 0.6) label = 'Very Slow';
                                else if (rate < 1.0) label = 'Slow';
                                else if (rate === 1.0) label = 'Normal';
                                else if (rate <= 2.0) label = 'Fast';
                                else label = 'Very Fast';
                              } else if (formData.provider === 'elevenlabs') {
                                if (rate < 0.8) label = 'Very Slow';
                                else if (rate < 1.0) label = 'Slow';
                                else if (rate === 1.0) label = 'Normal';
                                else if (rate <= 1.5) label = 'Fast';
                                else label = 'Very Fast';
                              } else {
                                if (rate <= 0.7) label = 'Slow';
                                else if (rate <= 0.9) label = 'Natural';
                                else if (rate === 1.0) label = 'Normal';
                                else label = 'Fast';
                              }
                              return `${label} (${rateStr})`;
                            })()}
                          </span>
                        </div>
                        <Slider
                          value={[formData.speakingRate]}
                          onValueChange={([value]) => setFormData(prev => ({ ...prev, speakingRate: value }))}
                          min={(formData.provider === 'google' || formData.provider === 'gemini') ? 0.25 : formData.provider === 'elevenlabs' ? 0.5 : 0.7}
                          max={(formData.provider === 'google' || formData.provider === 'gemini') ? 4.0 : formData.provider === 'elevenlabs' ? 2.0 : 1.3}
                          step={(formData.provider === 'google' || formData.provider === 'gemini') ? 0.05 : formData.provider === 'elevenlabs' ? 0.05 : 0.1}
                          className="w-full"
                          data-testid="slider-speed"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          {(formData.provider === 'google' || formData.provider === 'gemini') ? (
                            <>
                              <span>Slow (0.25)</span>
                              <span>Normal (1.0)</span>
                              <span>Fast (4.0)</span>
                            </>
                          ) : formData.provider === 'elevenlabs' ? (
                            <>
                              <span>Slow (0.5)</span>
                              <span>Normal (1.0)</span>
                              <span>Fast (2.0)</span>
                            </>
                          ) : (
                            <>
                              <span>Slow (0.7)</span>
                              <span>Natural (0.9)</span>
                              <span>Fast (1.3)</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ElevenLabs Voice Settings */}
                    {formData.voiceId && formData.provider === 'elevenlabs' && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium">ElevenLabs Voice Settings</Label>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Stability</Label>
                            <span className="text-sm font-medium">{formData.elStability.toFixed(2)}</span>
                          </div>
                          <Slider
                            value={[formData.elStability]}
                            onValueChange={([value]) => setFormData(prev => ({ ...prev, elStability: value }))}
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-full"
                            data-testid="slider-el-stability"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Expressive (0)</span>
                            <span>Consistent (1)</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Similarity Boost</Label>
                            <span className="text-sm font-medium">{formData.elSimilarityBoost.toFixed(2)}</span>
                          </div>
                          <Slider
                            value={[formData.elSimilarityBoost]}
                            onValueChange={([value]) => setFormData(prev => ({ ...prev, elSimilarityBoost: value }))}
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-full"
                            data-testid="slider-el-similarity"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low (0)</span>
                            <span>High (1)</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Style Exaggeration</Label>
                            <span className="text-sm font-medium">{formData.elStyle.toFixed(2)}</span>
                          </div>
                          <Slider
                            value={[formData.elStyle]}
                            onValueChange={([value]) => setFormData(prev => ({ ...prev, elStyle: value }))}
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-full"
                            data-testid="slider-el-style"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>None (0)</span>
                            <span>Exaggerated (1)</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Higher values increase latency. Keep at 0 unless needed.</p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <Label className="text-xs text-muted-foreground">Speaker Boost</Label>
                            <p className="text-xs text-muted-foreground">Subtle voice similarity enhancement</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={formData.elSpeakerBoost ? "default" : "outline"}
                            onClick={() => setFormData(prev => ({ ...prev, elSpeakerBoost: !prev.elSpeakerBoost }))}
                            data-testid="button-el-speaker-boost"
                          >
                            {formData.elSpeakerBoost ? 'On' : 'Off'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Cartesia Emotion Controls for Audition */}
                    {formData.voiceId && formData.provider === 'cartesia' && ttsMetadata && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-medium">Emotion Audition</Label>
                        </div>
                        
                        {/* Personality Selector */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Personality</Label>
                            <Select 
                              value={auditionPersonality} 
                              onValueChange={(v) => setAuditionPersonality(v as PersonalityType)}
                            >
                              <SelectTrigger data-testid="select-personality">
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
                          
                          {/* Emotion Selector */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Emotion</Label>
                            <Select value={auditionEmotion} onValueChange={setAuditionEmotion}>
                              <SelectTrigger data-testid="select-emotion">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEmotions.map(emotion => (
                                  <SelectItem key={emotion} value={emotion}>
                                    <span className="capitalize">{emotion}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Expressiveness Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Expressiveness</Label>
                            <span className="text-sm font-medium">
                              {ttsMetadata.expressivenessLevels[auditionExpressiveness]?.label || `Level ${auditionExpressiveness}`}
                            </span>
                          </div>
                          <Slider
                            value={[auditionExpressiveness]}
                            onValueChange={([value]) => setAuditionExpressiveness(value)}
                            min={1}
                            max={5}
                            step={1}
                            className="w-full"
                            data-testid="slider-expressiveness"
                          />
                          <p className="text-xs text-muted-foreground">
                            {ttsMetadata.expressivenessLevels[auditionExpressiveness]?.description || ''}
                          </p>
                        </div>
                        
                        <p className="text-xs text-muted-foreground border-t pt-2">
                          Preview how different emotions sound with this voice
                        </p>
                      </div>
                    )}

                    {/* Audition Button */}
                    {formData.voiceId && (
                      <div className="space-y-2">
                        <Label>Audition</Label>
                        <div className="flex items-center gap-3 flex-wrap">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const selectedVoice = activeVoices.find(v => v.id === formData.voiceId);
                              handleAudition(
                                formData.voiceId,
                                formData.voiceName,
                                formData.language,
                                formData.languageCode,
                                formData.speakingRate,
                                formData.provider,
                                formData.provider === 'elevenlabs' ? {
                                  elStability: formData.elStability,
                                  elSimilarityBoost: formData.elSimilarityBoost,
                                  elStyle: formData.elStyle,
                                  elSpeed: formData.speakingRate,
                                } : undefined,
                                selectedVoice?.source === 'library' ? selectedVoice.previewUrl : undefined,
                                undefined,
                                (formData.provider === 'gemini' || formData.provider === 'google') ? formData.geminiLanguageCode : undefined,
                              );
                            }}
                            data-testid="button-audition"
                            className="flex-1"
                          >
                            {playingVoiceId === formData.voiceId ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                {auditionPhase === 'target' ? 'Playing Target Language...' : 'Playing English...'}
                              </>
                            ) : (
                              <>
                                <Languages className="h-4 w-4 mr-2" />
                                Audition Voice
                              </>
                            )}
                          </Button>
                          {playingVoiceId === formData.voiceId && (
                            <Badge variant="secondary">
                              {auditionPhase === 'target' 
                                ? SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label 
                                : 'English'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          <span>Using <strong className="capitalize">{auditionEmotion}</strong> emotion ({auditionPersonality} personality)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Plays a sample in {SUPPORTED_LANGUAGES.find(l => l.value === formData.language)?.label || 'the target language'}{formData.language !== 'english' && ', then in English'} at selected speed
                        </p>
                      </div>
                    )}


                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                        data-testid="switch-active"
                      />
                      <Label>Active</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={upsertMutation.isPending || !formData.voiceId} data-testid="button-save-voice">
                      {upsertMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card data-testid="card-global-tts-provider">
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 px-5">
              <div className="flex items-center gap-3">
                <Headphones className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">TTS Provider</p>
                  <p className="text-xs text-muted-foreground">
                    Applies to all tutor voices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={globalProvider} onValueChange={handleGlobalProviderChange} disabled={bulkProviderMutation.isPending}>
                  <SelectTrigger className="w-[220px]" data-testid="select-global-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google Cloud TTS (Chirp 3 HD)</SelectItem>
                    <SelectItem value="cartesia">Cartesia (Sonic-3)</SelectItem>
                    <SelectItem value="elevenlabs">ElevenLabs (Flash v2.5)</SelectItem>
                    <SelectItem value="gemini">Gemini (2.5 Flash TTS)</SelectItem>
                  </SelectContent>
                </Select>
                {bulkProviderMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-teaching-persona">
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-3 mb-3">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Daniela's Teaching Persona</p>
                  <p className="text-xs text-muted-foreground">
                    Universal defaults applied across all languages and voices
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40">
                  <Scale className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Teaching Focus</p>
                    <p className="text-xs text-muted-foreground">Balanced across grammar, vocabulary, pronunciation, and culture</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40">
                  <Sparkles className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Teaching Style</p>
                    <p className="text-xs text-muted-foreground">Adaptive to student energy, blending structure with free conversation</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted/40">
                  <Ear className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Error Correction</p>
                    <p className="text-xs text-muted-foreground">Balanced — corrects important errors without interrupting flow</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                These defaults are defined in the system prompt. To change them, update buildPedagogicalPersonaSection in system-prompt.ts.
              </p>
            </CardContent>
          </Card>

          <Dialog open={!!pendingProvider} onOpenChange={(open) => { if (!open) setPendingProvider(null); }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Switch TTS Provider</DialogTitle>
                <DialogDescription>
                  This will update all tutor voices to use {pendingProvider === 'google' ? 'Google Cloud TTS (Chirp 3 HD)' : pendingProvider === 'elevenlabs' ? 'ElevenLabs Flash v2.5' : pendingProvider === 'gemini' ? 'Gemini 2.5 Flash TTS' : 'Cartesia Sonic-3'}. Each tutor will keep its current voice selection but the provider tag will change. You can reassign individual voices afterward.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setPendingProvider(null)} data-testid="button-cancel-provider-switch">Cancel</Button>
                <Button onClick={confirmProviderSwitch} disabled={bulkProviderMutation.isPending} data-testid="button-confirm-provider-switch">
                  {bulkProviderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Switch All Voices
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {SUPPORTED_LANGUAGES.map(lang => {
                const voicesForLang = groupedVoices?.[lang.value];
                const maleVoice = voicesForLang?.male;
                const femaleVoice = voicesForLang?.female;
                const configuredCount = (femaleVoice ? 1 : 0) + (maleVoice ? 1 : 0);
                
                return (
                  <div key={lang.value} data-testid={`list-voice-${lang.value}`}>
                    {/* Language Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Languages className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{lang.label}</span>
                        <Badge variant="outline" className="text-xs">{lang.code}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {configuredCount}/2 voices
                      </span>
                    </div>
                    
                    {/* Voice Rows */}
                    <div className="divide-y">
                      {(['female', 'male'] as const).map(gender => {
                        const voice = gender === 'female' ? femaleVoice : maleVoice;
                        
                        if (!voice) {
                          return (
                            <div key={gender} className="flex items-center justify-between px-4 py-2 pl-12 bg-background">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="text-sm capitalize">{gender}</span>
                                <span className="text-xs">— Not configured</span>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => {
                                  handleLanguageChange(lang.value);
                                  setFormData(prev => ({ ...prev, gender }));
                                  setIsAddDialogOpen(true);
                                }}
                                data-testid={`button-add-${lang.value}-${gender}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </Button>
                            </div>
                          );
                        }
                        
                        return (
                          <div 
                            key={voice.id} 
                            className="flex items-center justify-between px-4 py-2 pl-12 bg-background"
                            data-testid={`voice-item-${voice.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm capitalize w-14 flex-shrink-0">{gender}</span>
                              <span className="font-medium text-sm truncate">{voice.voiceName}</span>
                              <span className="text-xs text-muted-foreground truncate">({voice.voiceId})</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {voice.speakingRate === 0.7 ? 'Slow' : 
                                 voice.speakingRate === 0.9 ? 'Natural' : 
                                 voice.speakingRate === 1.0 ? 'Normal' :
                                 voice.speakingRate >= 1.2 ? 'Fast' : 
                                 `${voice.speakingRate}x`}
                              </Badge>
                              {voice.geminiLanguageCode && (
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {voice.geminiLanguageCode}
                                </Badge>
                              )}
                              {!voice.isActive && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">Inactive</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handlePreview(voice)}
                                data-testid={`button-preview-${voice.id}`}
                                title={`Audition in ${lang.label}${lang.value !== 'english' ? ' + English' : ''}`}
                              >
                                {playingVoiceId === voice.id ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => handleEdit(voice)}
                                data-testid={`button-edit-${voice.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this voice configuration?")) {
                                    deleteMutation.mutate(voice.id);
                                  }
                                }}
                                data-testid={`button-delete-${voice.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Assistant Tutor Voices (for drill practice) */}
          <AssistantVoiceCard />
          
          {/* Sofia Support Agent Voice */}
          <SofiaVoiceCard />
          
          {/* Alden Co-Founder Voice */}
          <AldenVoiceCard />
        </div>
      </div>
  );
}

/**
 * Google Voice Entry from API
 */
interface GoogleVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

/**
 * Assistant Tutor Voice Configuration Section
 * Displays assistant tutors from the database with full editing capabilities
 * Uses Google Cloud TTS (Neural2/Wavenet) for drill practice
 */
function AssistantVoiceCard() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<TutorVoice | null>(null);
  
  // Form state for editing
  const [formData, setFormData] = useState({
    language: '',
    gender: 'female' as 'male' | 'female',
    voiceId: '',
    voiceName: '',
    languageCode: '',
    speakingRate: 1.0,
  });
  
  // Fetch all tutor voices and filter for assistants
  const { data: allVoices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });
  
  // Filter for assistant voices only
  const assistantVoices = allVoices?.filter(v => v.role === 'assistant') || [];
  
  // Fetch available Google voices for voice selection - use custom queryFn to build URL with params
  const { data: googleVoicesData, isLoading: isLoadingGoogleVoices } = useQuery<{ voices: GoogleVoice[]; total: number }>({
    queryKey: ["/api/admin/google-voices", formData.language, formData.gender],
    queryFn: async () => {
      const url = `/api/admin/google-voices/${encodeURIComponent(formData.language)}/${encodeURIComponent(formData.gender)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch Google voices');
      return response.json();
    },
    enabled: isEditDialogOpen && !!formData.language && !!formData.gender,
  });
  
  const googleVoices = googleVoicesData?.voices || [];
  
  // Mutation to update assistant voice
  const updateMutation = useMutation({
    mutationFn: async (data: { 
      language: string; 
      gender: string; 
      provider: string; 
      voiceId: string; 
      voiceName: string; 
      languageCode: string; 
      speakingRate: number;
      role: string;
    }) => {
      return apiRequest("POST", "/api/admin/tutor-voices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Assistant voice configuration saved" });
      setIsEditDialogOpen(false);
      setEditingVoice(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleEdit = (voice: TutorVoice) => {
    setEditingVoice(voice);
    setFormData({
      language: voice.language,
      gender: voice.gender,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      languageCode: voice.languageCode,
      speakingRate: voice.speakingRate || 1.0,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleVoiceSelect = (voiceId: string) => {
    const selected = googleVoices.find(v => v.id === voiceId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        voiceId: selected.id,
        voiceName: selected.name,
      }));
    }
  };
  
  const handleSave = () => {
    if (!formData.voiceId || !formData.voiceName) {
      toast({ title: "Error", description: "Please select a voice", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      language: formData.language,
      gender: formData.gender,
      provider: 'google',
      voiceId: formData.voiceId,
      voiceName: formData.voiceName,
      languageCode: formData.languageCode,
      speakingRate: formData.speakingRate,
      role: 'assistant',
    });
  };
  
  const handleAudition = async (voice: TutorVoice) => {
    if (playingVoiceId === voice.id && audioElement) {
      audioElement.pause();
      setPlayingVoiceId(null);
      return;
    }
    
    if (audioElement) {
      audioElement.pause();
    }
    
    setPlayingVoiceId(voice.id);
    const phrases = SAMPLE_PHRASES[voice.language] || SAMPLE_PHRASES.english;
    
    try {
      // First play in target language
      const targetResponse = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: voice.voiceId,
          text: phrases.target,
          language: voice.languageCode,
          speakingRate: voice.speakingRate || 1.0,
        }),
      });
      
      if (!targetResponse.ok) {
        throw new Error('Failed to generate audio');
      }
      
      const targetBlob = await targetResponse.blob();
      const targetUrl = URL.createObjectURL(targetBlob);
      
      const targetAudio = new Audio(targetUrl);
      setAudioElement(targetAudio);
      
      targetAudio.onended = async () => {
        URL.revokeObjectURL(targetUrl);
        
        // If not English, also play the English phrase
        if (voice.language !== 'english') {
          try {
            const nativeResponse = await fetch('/api/admin/assistant-voice-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                voiceId: voice.voiceId,
                text: phrases.native,
                language: 'en-US',
                speakingRate: voice.speakingRate || 1.0,
              }),
            });
            
            if (nativeResponse.ok) {
              const nativeBlob = await nativeResponse.blob();
              const nativeUrl = URL.createObjectURL(nativeBlob);
              const nativeAudio = new Audio(nativeUrl);
              setAudioElement(nativeAudio);
              
              nativeAudio.onended = () => {
                setPlayingVoiceId(null);
                URL.revokeObjectURL(nativeUrl);
              };
              nativeAudio.onerror = () => {
                setPlayingVoiceId(null);
                URL.revokeObjectURL(nativeUrl);
              };
              await nativeAudio.play();
            } else {
              setPlayingVoiceId(null);
            }
          } catch {
            setPlayingVoiceId(null);
          }
        } else {
          setPlayingVoiceId(null);
        }
      };
      
      targetAudio.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(targetUrl);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };
      
      await targetAudio.play();
    } catch (error: any) {
      console.error('[VoiceConsole] Assistant voice audition error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setPlayingVoiceId(null);
    }
  };
  
  const handlePreviewInDialog = async () => {
    if (!formData.voiceId) {
      toast({ title: "Error", description: "Please select a voice first", variant: "destructive" });
      return;
    }
    
    try {
      const sampleText = SAMPLE_PHRASES[formData.language]?.target || "Hello! Let's practice together.";
      const response = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: formData.voiceId,
          text: sampleText,
          language: formData.languageCode,
          speakingRate: formData.speakingRate,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      await audio.play();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  // Group voices by language for display
  const voicesByLanguage = assistantVoices.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = [];
    }
    acc[voice.language].push(voice);
    return acc;
  }, {} as Record<string, TutorVoice[]>);
  
  return (
    <Card className="mt-6" data-testid="card-assistant-tutor-voice">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Assistant Tutor Voices
            </CardTitle>
            <CardDescription>
              {assistantVoices.length} assistant tutors for drill practice (2 per language)
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30">
            Google Cloud TTS
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : assistantVoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No assistant tutors configured. Run seed to populate default voices.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(voicesByLanguage).map(([language, voices]) => (
              <div key={language} className="space-y-2">
                <h4 className="text-sm font-medium capitalize flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {language}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {voices.map((voice) => {
                    const isPlaying = playingVoiceId === voice.id;
                    
                    return (
                      <div
                        key={voice.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                        data-testid={`card-assistant-voice-${voice.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${voice.gender === 'female' ? 'bg-pink-500/10 text-pink-600' : 'bg-blue-500/10 text-blue-600'}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{voice.voiceName}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {voice.gender} · {voice.languageCode} · {voice.speakingRate}x
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAudition(voice)}
                            data-testid={`button-play-assistant-${voice.id}`}
                          >
                            {isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(voice)}
                            data-testid={`button-edit-assistant-${voice.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-xs text-muted-foreground text-center pt-2">
          Assistant tutors handle drill practice sessions. Click edit to change voice or speaking rate.
        </p>
      </CardContent>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assistant Voice</DialogTitle>
            <DialogDescription>
              Configure the voice for {editingVoice?.language} ({editingVoice?.gender}) assistant tutor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Voice Selection */}
            <div className="space-y-2">
              <Label>Voice</Label>
              {isLoadingGoogleVoices ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading voices...</span>
                </div>
              ) : (
                <Select value={formData.voiceId} onValueChange={handleVoiceSelect}>
                  <SelectTrigger data-testid="select-assistant-voice">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {googleVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
                          <span className="text-xs text-muted-foreground">{voice.id}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* Speaking Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speaking Rate</Label>
                <span className="text-sm text-muted-foreground">{formData.speakingRate.toFixed(1)}x</span>
              </div>
              <Slider
                value={[formData.speakingRate]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, speakingRate: value }))}
                min={0.5}
                max={2.0}
                step={0.1}
                data-testid="slider-assistant-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow (0.5)</span>
                <span>Normal (1.0)</span>
                <span>Fast (2.0)</span>
              </div>
            </div>
            
            {/* Preview Button */}
            {formData.voiceId && (
              <Button
                variant="outline"
                onClick={handlePreviewInDialog}
                className="w-full"
                data-testid="button-preview-assistant"
              >
                <Play className="h-4 w-4 mr-2" />
                Preview Voice
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending || !formData.voiceId}
              data-testid="button-save-assistant"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Sofia Support Agent Voice Configuration
 * Sofia uses Google Cloud TTS for cost-effective support conversations
 * Speaks in the student's interface language (not target language)
 * Fetches from database with role='support' and allows editing
 */
function SofiaVoiceCard() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<TutorVoice | null>(null);
  
  // Form state for editing
  const [formData, setFormData] = useState({
    language: '',
    gender: 'female' as 'male' | 'female',
    voiceId: '',
    voiceName: '',
    languageCode: '',
    speakingRate: 1.0,
  });
  
  // Fetch all tutor voices and filter for support role
  const { data: allVoices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });
  
  // Filter for support voices only (Sofia)
  const supportVoices = allVoices?.filter(v => v.role === 'support') || [];
  
  // Fetch available Google voices for voice selection
  const { data: googleVoicesData, isLoading: isLoadingGoogleVoices } = useQuery<{ voices: GoogleVoice[]; total: number }>({
    queryKey: ["/api/admin/google-voices", formData.language, formData.gender],
    queryFn: async () => {
      const url = `/api/admin/google-voices/${encodeURIComponent(formData.language)}/${encodeURIComponent(formData.gender)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch Google voices');
      return response.json();
    },
    enabled: isEditDialogOpen && !!formData.language && !!formData.gender,
  });
  
  const googleVoices = googleVoicesData?.voices || [];
  
  // Mutation to update support voice
  const updateMutation = useMutation({
    mutationFn: async (data: { 
      language: string; 
      gender: string; 
      provider: string; 
      voiceId: string; 
      voiceName: string; 
      languageCode: string; 
      speakingRate: number;
      role: string;
    }) => {
      return apiRequest("POST", "/api/admin/tutor-voices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Sofia voice configuration saved" });
      setIsEditDialogOpen(false);
      setEditingVoice(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleEdit = (voice: TutorVoice) => {
    setEditingVoice(voice);
    setFormData({
      language: voice.language,
      gender: voice.gender,
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      languageCode: voice.languageCode,
      speakingRate: voice.speakingRate || 1.0,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleVoiceSelect = (voiceId: string) => {
    const selected = googleVoices.find(v => v.id === voiceId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        voiceId: selected.id,
        voiceName: selected.name,
      }));
    }
  };
  
  const handleSave = () => {
    updateMutation.mutate({
      language: formData.language,
      gender: formData.gender,
      provider: 'google',
      voiceId: formData.voiceId,
      voiceName: formData.voiceName,
      languageCode: formData.languageCode,
      speakingRate: formData.speakingRate,
      role: 'support',
    });
  };
  
  // Sofia speaks in the student's native language - sample phrases per language (native + English)
  const SOFIA_SAMPLE_PHRASES: Record<string, { native: string; english: string }> = {
    'english': {
      native: "Hello! I'm Sofia, your technical support specialist. How can I help you today?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'spanish': {
      native: "¡Hola! Soy Sofia, tu especialista en soporte técnico. ¿Cómo puedo ayudarte hoy?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'french': {
      native: "Bonjour! Je suis Sofia, votre spécialiste du support technique. Comment puis-je vous aider aujourd'hui?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'german': {
      native: "Hallo! Ich bin Sofia, Ihre technische Support-Spezialistin. Wie kann ich Ihnen heute helfen?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'italian': {
      native: "Ciao! Sono Sofia, la tua specialista del supporto tecnico. Come posso aiutarti oggi?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'portuguese': {
      native: "Olá! Eu sou Sofia, sua especialista em suporte técnico. Como posso ajudá-lo hoje?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'japanese': {
      native: "こんにちは！私はソフィア、テクニカルサポートの専門家です。今日はどのようにお手伝いできますか？",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'mandarin chinese': {
      native: "你好！我是索菲亚，您的技术支持专家。今天我能帮您什么忙？",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
    'korean': {
      native: "안녕하세요! 저는 소피아입니다, 기술 지원 전문가예요. 오늘 어떻게 도와드릴까요?",
      english: "Hello! I'm Sofia, your technical support specialist. How can I help you today?"
    },
  };
  
  const getSofiaPhrases = (language: string) => {
    return SOFIA_SAMPLE_PHRASES[language.toLowerCase()] || SOFIA_SAMPLE_PHRASES['english'];
  };
  
  const handleAudition = async (voice: TutorVoice) => {
    setPlayingVoiceId(voice.id);
    const phrases = getSofiaPhrases(voice.language);
    
    try {
      // First play in native language
      const nativeResponse = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: voice.voiceId,
          text: phrases.native,
          language: voice.languageCode,
          speakingRate: voice.speakingRate || 1.0,
        }),
      });
      
      if (!nativeResponse.ok) throw new Error('Failed to generate audio');
      
      const nativeBlob = await nativeResponse.blob();
      const nativeUrl = URL.createObjectURL(nativeBlob);
      const nativeAudio = new Audio(nativeUrl);
      
      nativeAudio.onended = async () => {
        URL.revokeObjectURL(nativeUrl);
        
        // If not English, also play the English phrase
        if (voice.language.toLowerCase() !== 'english') {
          try {
            const englishResponse = await fetch('/api/admin/assistant-voice-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                voiceId: voice.voiceId,
                text: phrases.english,
                language: 'en-US',
                speakingRate: voice.speakingRate || 1.0,
              }),
            });
            
            if (englishResponse.ok) {
              const englishBlob = await englishResponse.blob();
              const englishUrl = URL.createObjectURL(englishBlob);
              const englishAudio = new Audio(englishUrl);
              
              englishAudio.onended = () => {
                setPlayingVoiceId(null);
                URL.revokeObjectURL(englishUrl);
              };
              englishAudio.onerror = () => {
                setPlayingVoiceId(null);
                URL.revokeObjectURL(englishUrl);
              };
              await englishAudio.play();
            } else {
              setPlayingVoiceId(null);
            }
          } catch {
            setPlayingVoiceId(null);
          }
        } else {
          setPlayingVoiceId(null);
        }
      };
      
      nativeAudio.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(nativeUrl);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };
      
      await nativeAudio.play();
    } catch (error: any) {
      setPlayingVoiceId(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handlePreviewInDialog = async () => {
    if (!formData.voiceId) return;
    const phrases = getSofiaPhrases(formData.language);
    
    try {
      // First play in native language
      const nativeResponse = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: formData.voiceId,
          text: phrases.native,
          language: formData.languageCode,
          speakingRate: formData.speakingRate,
        }),
      });
      
      if (!nativeResponse.ok) throw new Error('Failed to generate audio');
      
      const nativeBlob = await nativeResponse.blob();
      const nativeUrl = URL.createObjectURL(nativeBlob);
      const nativeAudio = new Audio(nativeUrl);
      
      nativeAudio.onended = async () => {
        URL.revokeObjectURL(nativeUrl);
        
        // If not English, also play the English phrase
        if (formData.language.toLowerCase() !== 'english') {
          try {
            const englishResponse = await fetch('/api/admin/assistant-voice-preview', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                voiceId: formData.voiceId,
                text: phrases.english,
                language: 'en-US',
                speakingRate: formData.speakingRate,
              }),
            });
            
            if (englishResponse.ok) {
              const englishBlob = await englishResponse.blob();
              const englishUrl = URL.createObjectURL(englishBlob);
              const englishAudio = new Audio(englishUrl);
              englishAudio.onended = () => URL.revokeObjectURL(englishUrl);
              await englishAudio.play();
            }
          } catch {
            // Silently fail on English playback
          }
        }
      };
      
      await nativeAudio.play();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  // Group voices by language for display
  const voicesByLanguage = supportVoices.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = [];
    }
    acc[voice.language].push(voice);
    return acc;
  }, {} as Record<string, TutorVoice[]>);
  
  return (
    <Card className="mt-6" data-testid="card-sofia-voice">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Sofia - Support Agent
            </CardTitle>
            <CardDescription>
              {supportVoices.length} support voices (speaks in student's interface language)
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30">
            Google Chirp3 HD
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : supportVoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No Sofia support voices configured. Run seed to populate default voices.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(voicesByLanguage).map(([language, voices]) => (
              <div key={language} className="space-y-2">
                <h4 className="text-sm font-medium capitalize flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {language}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {voices.map((voice) => {
                    const isPlaying = playingVoiceId === voice.id;
                    
                    return (
                      <div
                        key={voice.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                        data-testid={`card-sofia-voice-${voice.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${voice.gender === 'female' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{voice.voiceName}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {voice.gender} · {voice.languageCode} · {voice.speakingRate}x
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleAudition(voice)}
                            data-testid={`button-play-sofia-${voice.id}`}
                          >
                            {isPlaying ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(voice)}
                            data-testid={`button-edit-sofia-${voice.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <p className="text-xs text-muted-foreground text-center pt-2">
          Sofia speaks in the student's interface language for support conversations. 
          Click edit to change voice or speaking rate.
        </p>
      </CardContent>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Sofia Voice</DialogTitle>
            <DialogDescription>
              Configure the voice for {editingVoice?.language} ({editingVoice?.gender}) support.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Voice Selection */}
            <div className="space-y-2">
              <Label>Voice</Label>
              {isLoadingGoogleVoices ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading voices...</span>
                </div>
              ) : (
                <Select value={formData.voiceId} onValueChange={handleVoiceSelect}>
                  <SelectTrigger data-testid="select-sofia-voice">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {googleVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
                          <span className="text-xs text-muted-foreground">{voice.id}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {/* Speaking Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speaking Rate</Label>
                <span className="text-sm text-muted-foreground">{formData.speakingRate.toFixed(1)}x</span>
              </div>
              <Slider
                value={[formData.speakingRate]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, speakingRate: value }))}
                min={0.5}
                max={2.0}
                step={0.1}
                data-testid="slider-sofia-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow (0.5)</span>
                <span>Normal (1.0)</span>
                <span>Fast (2.0)</span>
              </div>
            </div>
            
            {/* Preview Button */}
            {formData.voiceId && (
              <Button
                variant="outline"
                onClick={handlePreviewInDialog}
                className="w-full"
                data-testid="button-preview-sofia"
              >
                <Play className="h-4 w-4 mr-2" />
                Preview Voice
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={updateMutation.isPending || !formData.voiceId}
              data-testid="button-save-sofia"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Alden Co-Founder Voice Configuration
 * Alden uses Google Cloud TTS (English only) — founder-only AI co-founder persona
 * Powered by Claude (Anthropic) for LLM, Google Chirp3 HD for voice
 */
function AldenVoiceCard() {
  const { toast } = useToast();
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  
  const [formData, setFormData] = useState({
    gender: 'male' as 'male' | 'female',
    voiceId: '',
    voiceName: '',
    languageCode: 'en-US',
    speakingRate: 1.0,
  });
  
  const { data: allVoices, isLoading } = useQuery<TutorVoice[]>({
    queryKey: ["/api/admin/tutor-voices"],
  });
  
  const aldenVoice = allVoices?.find(v => v.role === 'alden') || null;
  
  const { data: googleVoicesData, isLoading: isLoadingGoogleVoices } = useQuery<{ voices: GoogleVoice[]; total: number }>({
    queryKey: ["/api/admin/google-voices", "english", formData.gender],
    queryFn: async () => {
      const url = `/api/admin/google-voices/english/${encodeURIComponent(formData.gender)}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch Google voices');
      return response.json();
    },
    enabled: isEditDialogOpen,
  });
  
  const googleVoices = googleVoicesData?.voices || [];
  
  const saveMutation = useMutation({
    mutationFn: async (data: { 
      language: string; 
      gender: string; 
      provider: string; 
      voiceId: string; 
      voiceName: string; 
      languageCode: string; 
      speakingRate: number;
      role: string;
    }) => {
      return apiRequest("POST", "/api/admin/tutor-voices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tutor-voices"] });
      toast({ title: "Success", description: "Alden voice configuration saved" });
      setIsEditDialogOpen(false);
      setIsCreateMode(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
  
  const handleEdit = (voice: TutorVoice) => {
    setIsCreateMode(false);
    setFormData({
      gender: voice.gender as 'male' | 'female',
      voiceId: voice.voiceId,
      voiceName: voice.voiceName,
      languageCode: voice.languageCode,
      speakingRate: voice.speakingRate || 1.0,
    });
    setIsEditDialogOpen(true);
  };

  const handleCreate = () => {
    setIsCreateMode(true);
    setFormData({
      gender: 'male',
      voiceId: '',
      voiceName: '',
      languageCode: 'en-US',
      speakingRate: 1.0,
    });
    setIsEditDialogOpen(true);
  };
  
  const handleVoiceSelect = (voiceId: string) => {
    const selected = googleVoices.find(v => v.id === voiceId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        voiceId: selected.id,
        voiceName: selected.name,
      }));
    }
  };
  
  const handleSave = () => {
    saveMutation.mutate({
      language: 'english',
      gender: formData.gender,
      provider: 'google',
      voiceId: formData.voiceId,
      voiceName: formData.voiceName,
      languageCode: formData.languageCode,
      speakingRate: formData.speakingRate,
      role: 'alden',
    });
  };

  const ALDEN_SAMPLE = "Hey David. I've been looking at the system metrics — everything looks stable. Voice sessions are running smoothly, and Sofia hasn't flagged any issues in the last 24 hours.";

  const handleAudition = async (voice: TutorVoice) => {
    setPlayingVoiceId(voice.id);
    
    try {
      const response = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: voice.voiceId,
          text: ALDEN_SAMPLE,
          language: voice.languageCode,
          speakingRate: voice.speakingRate || 1.0,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate audio');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      
      audio.onended = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingVoiceId(null);
        URL.revokeObjectURL(url);
        toast({ title: "Error", description: "Failed to play audio", variant: "destructive" });
      };
      
      await audio.play();
    } catch (error: any) {
      setPlayingVoiceId(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handlePreviewInDialog = async () => {
    if (!formData.voiceId) return;
    
    try {
      const response = await fetch('/api/admin/assistant-voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceId: formData.voiceId,
          text: ALDEN_SAMPLE,
          language: formData.languageCode,
          speakingRate: formData.speakingRate,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate audio');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card className="mt-6" data-testid="card-alden-voice">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Alden - Co-Founder
            </CardTitle>
            <CardDescription>
              AI co-founder voice (English only, powered by Claude + Google Chirp3 HD)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
              Claude + Google TTS
            </Badge>
            {!aldenVoice && (
              <Button size="sm" variant="outline" onClick={handleCreate} data-testid="button-add-alden-voice">
                <Plus className="h-4 w-4 mr-1" />
                Configure
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !aldenVoice ? (
          <p className="text-center text-muted-foreground py-4" data-testid="text-alden-no-voice">
            No Alden voice configured. Click "Configure" to set up a Google Cloud TTS voice.
          </p>
        ) : (
          <div
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
            data-testid={`card-alden-voice-${aldenVoice.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10 text-blue-600">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="font-medium text-sm">{aldenVoice.voiceName}</div>
                <div className="text-xs text-muted-foreground">
                  {aldenVoice.gender} · {aldenVoice.languageCode} · {aldenVoice.speakingRate}x · Google Chirp3 HD
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleAudition(aldenVoice)}
                data-testid={`button-play-alden-${aldenVoice.id}`}
              >
                {playingVoiceId === aldenVoice.id ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleEdit(aldenVoice)}
                data-testid={`button-edit-alden-${aldenVoice.id}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground text-center pt-2">
          Alden speaks English only. His voice is used in the founder-only Command Center chat.
        </p>
      </CardContent>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? "Configure" : "Edit"} Alden Voice</DialogTitle>
            <DialogDescription>
              Set the Google Cloud TTS voice for Alden's spoken responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={formData.gender} onValueChange={(v: 'male' | 'female') => setFormData(prev => ({ ...prev, gender: v }))}>
                <SelectTrigger data-testid="select-alden-gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Voice</Label>
              {isLoadingGoogleVoices ? (
                <div className="flex items-center gap-2 p-3 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading voices...</span>
                </div>
              ) : (
                <Select value={formData.voiceId} onValueChange={handleVoiceSelect}>
                  <SelectTrigger data-testid="select-alden-voice">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {googleVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex flex-col">
                          <span>{voice.name}</span>
                          <span className="text-xs text-muted-foreground">{voice.id}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speaking Rate</Label>
                <span className="text-sm text-muted-foreground">{formData.speakingRate.toFixed(1)}x</span>
              </div>
              <Slider
                value={[formData.speakingRate]}
                onValueChange={([value]) => setFormData(prev => ({ ...prev, speakingRate: value }))}
                min={0.5}
                max={2.0}
                step={0.1}
                data-testid="slider-alden-speed"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slow (0.5)</span>
                <span>Normal (1.0)</span>
                <span>Fast (2.0)</span>
              </div>
            </div>
            
            {formData.voiceId && (
              <Button
                variant="outline"
                onClick={handlePreviewInDialog}
                className="w-full"
                data-testid="button-preview-alden"
              >
                <Play className="h-4 w-4 mr-2" />
                Preview Voice
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saveMutation.isPending || !formData.voiceId}
              data-testid="button-save-alden"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default VoiceConsoleContent;
