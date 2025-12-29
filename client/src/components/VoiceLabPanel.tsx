import { useState, useEffect } from "react";
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
import { Loader2, Volume2, Save, RotateCcw, Play, Sparkles, GraduationCap } from "lucide-react";

type PersonalityType = 'warm' | 'calm' | 'energetic' | 'professional';
type PedagogicalFocusType = 'grammar' | 'fluency' | 'pronunciation' | 'culture' | 'vocabulary' | 'mixed';
type TeachingStyleType = 'structured' | 'conversational' | 'drill_focused' | 'adaptive' | 'socratic';
type ErrorToleranceType = 'high' | 'medium' | 'low';

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
  pedagogicalFocus?: PedagogicalFocusType;
  teachingStyle?: TeachingStyleType;
  errorTolerance?: ErrorToleranceType;
  personalityTraits?: string;
  teachingPhilosophy?: string;
}

export interface VoiceOverride {
  speakingRate?: number;
  personality?: PersonalityType;
  expressiveness?: number;
  emotion?: string;
  voiceId?: string;
  pedagogicalFocus?: PedagogicalFocusType;
  teachingStyle?: TeachingStyleType;
  errorTolerance?: ErrorToleranceType;
}

interface VoiceLabPanelProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  tutorGender: 'male' | 'female';
  onOverrideChange: (override: VoiceOverride | null) => void;
  currentOverride: VoiceOverride | null;
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
};

export function VoiceLabPanel({
  isOpen,
  onClose,
  language,
  tutorGender,
  onOverrideChange,
  currentOverride,
}: VoiceLabPanelProps) {
  const { toast } = useToast();
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [audioElement] = useState(() => new Audio());
  
  // Local state for sliders (initialized from current voice or override)
  const [speakingRate, setSpeakingRate] = useState(0.9);
  const [personality, setPersonality] = useState<PersonalityType>('warm');
  const [expressiveness, setExpressiveness] = useState(3);
  const [emotion, setEmotion] = useState('friendly');
  const [hasChanges, setHasChanges] = useState(false);
  
  // Pedagogical persona state
  const [pedagogicalFocus, setPedagogicalFocus] = useState<PedagogicalFocusType>('mixed');
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyleType>('conversational');
  const [errorTolerance, setErrorTolerance] = useState<ErrorToleranceType>('medium');

  // Fetch current tutor voice
  const { data: currentVoice, isLoading: isLoadingVoice } = useQuery<TutorVoice>({
    queryKey: ['/api/admin/voices/current', language, tutorGender],
    queryFn: async () => {
      const res = await fetch(`/api/admin/voices/current?language=${language}&gender=${tutorGender}`);
      if (!res.ok) throw new Error('Failed to fetch voice');
      return res.json();
    },
    enabled: isOpen,
  });

  // Fetch TTS metadata (personalities, emotions, etc.)
  const { data: ttsMetadata } = useQuery<TTSMetadata>({
    queryKey: ['/api/admin/tts-metadata'],
    enabled: isOpen,
  });

  // Initialize local state from current voice or override
  useEffect(() => {
    if (currentVoice) {
      setSpeakingRate(currentOverride?.speakingRate ?? currentVoice.speakingRate);
      setPersonality((currentOverride?.personality ?? currentVoice.personality) as PersonalityType);
      setExpressiveness(currentOverride?.expressiveness ?? currentVoice.expressiveness);
      setEmotion(currentOverride?.emotion ?? currentVoice.emotion);
      setPedagogicalFocus((currentOverride?.pedagogicalFocus ?? currentVoice.pedagogicalFocus ?? 'mixed') as PedagogicalFocusType);
      setTeachingStyle((currentOverride?.teachingStyle ?? currentVoice.teachingStyle ?? 'conversational') as TeachingStyleType);
      setErrorTolerance((currentOverride?.errorTolerance ?? currentVoice.errorTolerance ?? 'medium') as ErrorToleranceType);
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
      pedagogicalFocus,
      teachingStyle,
      errorTolerance,
    };
    onOverrideChange(override);
    setHasChanges(true);
    toast({
      title: "Voice & teaching style applied",
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
      setPedagogicalFocus((currentVoice.pedagogicalFocus ?? 'mixed') as PedagogicalFocusType);
      setTeachingStyle((currentVoice.teachingStyle ?? 'conversational') as TeachingStyleType);
      setErrorTolerance((currentVoice.errorTolerance ?? 'medium') as ErrorToleranceType);
    }
    onOverrideChange(null);
    setHasChanges(false);
    toast({
      title: "Settings reset",
      description: "Reverted to saved voice and teaching configuration.",
    });
  };

  // Save changes permanently to database
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentVoice) throw new Error('No voice to update');
      const res = await apiRequest('PATCH', `/api/admin/voices/${currentVoice.id}`, {
        speakingRate,
        personality,
        expressiveness,
        emotion,
        pedagogicalFocus,
        teachingStyle,
        errorTolerance,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/voices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/voices/current'] });
      onOverrideChange(null); // Clear override since it's now saved
      setHasChanges(false);
      toast({
        title: "Voice saved",
        description: "Settings permanently saved to database.",
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
    
    setIsAuditioning(true);
    try {
      const phrase = SAMPLE_PHRASES[language] || SAMPLE_PHRASES.english;
      const res = await fetch('/api/admin/voice-audition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: currentVoice.voiceId,
          text: phrase,
          languageCode: currentVoice.languageCode,
          speakingRate,
          emotion,
        }),
      });
      
      if (!res.ok) throw new Error('Audition failed');
      
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
              <div>
                <p className="font-medium">{currentVoice.voiceName}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {currentVoice.language} · {currentVoice.gender}
                </p>
              </div>
            </div>

            <Separator />

            {/* Speaking Speed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Speaking Speed</Label>
                <span className="text-sm font-medium">
                  {speakingRate === 0.7 ? 'Slow' : 
                   speakingRate === 0.9 ? 'Natural' : 
                   speakingRate === 1.0 ? 'Normal' :
                   speakingRate >= 1.2 ? 'Fast' : 
                   speakingRate.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[speakingRate]}
                onValueChange={([value]) => setSpeakingRate(value)}
                min={0.7}
                max={1.3}
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

            {/* Personality */}
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

            {/* Expressiveness */}
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

            <Separator />

            {/* Teaching Persona Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Teaching Persona</Label>
              </div>
              
              {/* Pedagogical Focus */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Teaching Focus</Label>
                <Select 
                  value={pedagogicalFocus} 
                  onValueChange={(v) => setPedagogicalFocus(v as PedagogicalFocusType)}
                >
                  <SelectTrigger data-testid="select-voice-lab-pedagogical-focus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grammar">Grammar & Structure</SelectItem>
                    <SelectItem value="fluency">Natural Fluency</SelectItem>
                    <SelectItem value="pronunciation">Pronunciation</SelectItem>
                    <SelectItem value="culture">Cultural Context</SelectItem>
                    <SelectItem value="vocabulary">Vocabulary Building</SelectItem>
                    <SelectItem value="mixed">Balanced Approach</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Teaching Style */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Teaching Style</Label>
                <Select 
                  value={teachingStyle} 
                  onValueChange={(v) => setTeachingStyle(v as TeachingStyleType)}
                >
                  <SelectTrigger data-testid="select-voice-lab-teaching-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="structured">Organized & Structured</SelectItem>
                    <SelectItem value="conversational">Natural & Conversational</SelectItem>
                    <SelectItem value="drill_focused">Practice-Heavy Drills</SelectItem>
                    <SelectItem value="adaptive">Adaptive to Student</SelectItem>
                    <SelectItem value="socratic">Question-Based Discovery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error Tolerance */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Error Correction</Label>
                <Select 
                  value={errorTolerance} 
                  onValueChange={(v) => setErrorTolerance(v as ErrorToleranceType)}
                >
                  <SelectTrigger data-testid="select-voice-lab-error-tolerance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Gentle (prioritize flow)</SelectItem>
                    <SelectItem value="medium">Balanced</SelectItem>
                    <SelectItem value="low">Thorough (immediate corrections)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show current tutor's philosophy if available */}
              {currentVoice?.teachingPhilosophy && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm">
                  <p className="text-muted-foreground italic">"{currentVoice.teachingPhilosophy}"</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Audition Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleAudition}
                disabled={isAuditioning}
                data-testid="button-voice-lab-audition"
              >
                {isAuditioning ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {isAuditioning ? 'Playing...' : 'Audition'}
              </Button>

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
