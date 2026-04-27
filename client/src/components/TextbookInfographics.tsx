import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TextAudioPlayButton } from "@/components/AudioPlayButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getTutorName } from "@/lib/tutor-avatars";
import { getRomanization } from "@shared/romanization-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Repeat2, Lightbulb, AlertTriangle, Users, Zap } from "lucide-react";

interface SunArcGreetingsProps {
  className?: string;
  morning?: string;
  afternoon?: string;
  evening?: string;
  language?: string;
}

export function SunArcGreetings({ className = '', morning = 'Buenos días', afternoon = 'Buenas tardes', evening = 'Buenas noches', language = 'spanish' }: SunArcGreetingsProps) {
  const morningRoma = getRomanization(morning, language);
  const afternoonRoma = getRomanization(afternoon, language);
  const eveningRoma = getRomanization(evening, language);
  return (
    <div className={`relative w-full ${className}`}>
      <svg 
        viewBox="0 0 400 180" 
        className="w-full h-auto"
        aria-label="Time of day greetings infographic"
      >
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.15)" />
            <stop offset="50%" stopColor="hsl(var(--primary) / 0.25)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0.1)" />
          </linearGradient>
          <linearGradient id="sunriseGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#FCD34D" stopOpacity="1" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="noonGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="1" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="moonGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="#E5E7EB" stopOpacity="1" />
            <stop offset="100%" stopColor="#9CA3AF" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width="400" height="180" fill="url(#skyGradient)" rx="12" />
        
        <path 
          d="M 40 140 Q 200 20 360 140" 
          fill="none" 
          stroke="hsl(var(--muted-foreground) / 0.3)" 
          strokeWidth="2" 
          strokeDasharray="6,4"
        />
        
        <circle cx="60" cy="115" r="22" fill="url(#sunriseGlow)" />
        <g transform="translate(60, 115)">
          {[...Array(8)].map((_, i) => (
            <line 
              key={i}
              x1={28 * Math.cos((i * Math.PI) / 4)}
              y1={28 * Math.sin((i * Math.PI) / 4)}
              x2={35 * Math.cos((i * Math.PI) / 4)}
              y2={35 * Math.sin((i * Math.PI) / 4)}
              stroke="#FCD34D"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>
        
        <circle cx="200" cy="45" r="26" fill="url(#noonGlow)" />
        <g transform="translate(200, 45)">
          {[...Array(12)].map((_, i) => (
            <line 
              key={i}
              x1={32 * Math.cos((i * Math.PI) / 6)}
              y1={32 * Math.sin((i * Math.PI) / 6)}
              x2={40 * Math.cos((i * Math.PI) / 6)}
              y2={40 * Math.sin((i * Math.PI) / 6)}
              stroke="#FBBF24"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        </g>
        
        <circle cx="340" cy="115" r="20" fill="url(#moonGlow)" />
        <circle cx="332" cy="108" r="16" fill="url(#skyGradient)" />
        
        <g className="text-xs">
          <text x="60" y="160" textAnchor="middle" className="fill-foreground font-semibold text-sm">
            {morning}
          </text>
          <text x="60" y="173" textAnchor="middle" className="fill-muted-foreground text-xs">
            morning
          </text>
        </g>
        
        <g className="text-xs">
          <text x="200" y="100" textAnchor="middle" className="fill-foreground font-semibold text-sm">
            {afternoon}
          </text>
          <text x="200" y="113" textAnchor="middle" className="fill-muted-foreground text-xs">
            afternoon
          </text>
        </g>
        
        <g className="text-xs">
          <text x="340" y="160" textAnchor="middle" className="fill-foreground font-semibold text-sm">
            {evening}
          </text>
          <text x="340" y="173" textAnchor="middle" className="fill-muted-foreground text-xs">
            evening/night
          </text>
        </g>
      </svg>
      <div className="grid grid-cols-3 mt-0.5 px-1">
        <div className="flex flex-col items-start">
          <TextAudioPlayButton text={morning} language={language} size="sm" variant="ghost" />
          {morningRoma && <p className="text-xs text-muted-foreground/70 italic pl-1">{morningRoma}</p>}
        </div>
        <div className="flex flex-col items-center">
          <TextAudioPlayButton text={afternoon} language={language} size="sm" variant="ghost" />
          {afternoonRoma && <p className="text-xs text-muted-foreground/70 italic">{afternoonRoma}</p>}
        </div>
        <div className="flex flex-col items-end">
          <TextAudioPlayButton text={evening} language={language} size="sm" variant="ghost" />
          {eveningRoma && <p className="text-xs text-muted-foreground/70 italic pr-1">{eveningRoma}</p>}
        </div>
      </div>
    </div>
  );
}

interface ComparisonItem {
  formal: string;
  informal: string;
  context: string;
}

interface FormalInformalComparisonProps {
  title?: string;
  items: ComparisonItem[];
  className?: string;
  language?: string;
}

export function FormalInformalComparison({ 
  title = "Formal vs. Informal", 
  items,
  className = '',
  language,
}: FormalInformalComparisonProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <h4 className="text-sm font-semibold mb-3 text-center">{title}</h4>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="text-center">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
            Formal
          </span>
        </div>
        <div className="text-center">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            Informal
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => {
          const formalRoma = language ? getRomanization(item.formal, language) : null;
          const informalRoma = language ? getRomanization(item.informal, language) : null;
          return (
            <div key={index} className="grid grid-cols-2 gap-2">
              <div className="bg-primary/5 rounded-md p-2 flex items-center justify-center gap-1">
                {language && (
                  <TextAudioPlayButton text={item.formal} language={language} size="sm" variant="ghost" className="shrink-0" />
                )}
                <div className="text-center">
                  <p className="font-medium text-sm">{item.formal}</p>
                  {formalRoma && <p className="text-xs text-muted-foreground/70 italic">{formalRoma}</p>}
                </div>
              </div>
              <div className="bg-amber-500/5 rounded-md p-2 flex items-center justify-center gap-1">
                {language && (
                  <TextAudioPlayButton text={item.informal} language={language} size="sm" variant="ghost" className="shrink-0" />
                )}
                <div className="text-center">
                  <p className="font-medium text-sm">{item.informal}</p>
                  {informalRoma && <p className="text-xs text-muted-foreground/70 italic">{informalRoma}</p>}
                </div>
              </div>
              {item.context && (
                <p className="col-span-2 text-xs text-muted-foreground text-center -mt-1">
                  {item.context}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ConversationFlowProps {
  exchanges: {
    speaker: 'A' | 'B';
    text: string;
    translation?: string;
  }[];
  speakerALabel?: string;
  speakerBLabel?: string;
  className?: string;
}

export function ConversationFlow({ 
  exchanges, 
  speakerALabel = "Person A",
  speakerBLabel = "Person B",
  className = '' 
}: ConversationFlowProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      <div className="flex justify-between gap-4 mb-3 text-xs text-muted-foreground">
        <span>{speakerALabel}</span>
        <span>{speakerBLabel}</span>
      </div>
      <div className="space-y-2">
        {exchanges.map((exchange, index) => (
          <div 
            key={index} 
            className={`flex ${exchange.speaker === 'B' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[75%] rounded-lg p-2 ${
                exchange.speaker === 'A' 
                  ? 'bg-primary/10 rounded-tl-none' 
                  : 'bg-muted rounded-tr-none'
              }`}
            >
              <p className="font-medium text-sm">{exchange.text}</p>
              {exchange.translation && (
                <p className="text-xs text-muted-foreground mt-0.5">{exchange.translation}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface QuickPhraseGridProps {
  phrases: {
    phrase: string;
    meaning: string;
  }[];
  columns?: 2 | 3;
  className?: string;
  language?: string;
}

export function QuickPhraseGrid({ 
  phrases, 
  columns = 2,
  className = '',
  language,
}: QuickPhraseGridProps) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${className}`}>
      {phrases.map((item, index) => (
        <div 
          key={index} 
          className="rounded-md border bg-card p-3 text-center hover-elevate"
          data-testid={`phrase-card-${index}`}
        >
          <div className="flex items-center justify-center gap-1 mb-0.5">
            {language && (
              <TextAudioPlayButton
                text={item.phrase}
                language={language}
                size="sm"
                variant="ghost"
                className="shrink-0"
              />
            )}
            <p className="font-semibold text-sm">{item.phrase}</p>
          </div>
          <p className="text-xs text-muted-foreground">{item.meaning}</p>
        </div>
      ))}
    </div>
  );
}

interface VisualVocabCardProps {
  word: string;
  translation: string;
  imageUrl?: string;
  backgroundColor?: string;
  className?: string;
}

export function VisualVocabCard({ 
  word, 
  translation, 
  imageUrl,
  backgroundColor = 'bg-gradient-to-br from-primary/10 to-primary/5',
  className = '' 
}: VisualVocabCardProps) {
  return (
    <div className={`rounded-lg overflow-hidden border ${className}`}>
      <div className={`aspect-square ${backgroundColor} flex items-center justify-center`}>
        {imageUrl ? (
          <img src={imageUrl} alt={word} className="w-full h-full object-cover object-top" />
        ) : (
          <span className="text-4xl font-bold text-primary/30">{word.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="p-3 bg-card text-center">
        <p className="font-semibold">{word}</p>
        <p className="text-sm text-muted-foreground">{translation}</p>
      </div>
    </div>
  );
}


interface DrillItem {
  id: string;
  itemType: string;
  prompt: string;
  targetText: string;
  difficulty: number;
  mastered: boolean;
  attempts: number;
}

const DRILL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  listen_repeat: { label: 'Listen & Repeat', color: 'bg-blue-500', icon: 'headphones' },
  number_dictation: { label: 'Number Dictation', color: 'bg-purple-500', icon: 'hash' },
  translate_speak: { label: 'Translate & Speak', color: 'bg-green-500', icon: 'languages' },
  fill_blank: { label: 'Fill in the Blank', color: 'bg-amber-500', icon: 'text-cursor' },
  matching: { label: 'Matching', color: 'bg-pink-500', icon: 'shuffle' },
};

interface DrillDistributionChartProps {
  drills: DrillItem[];
  className?: string;
}

export function DrillDistributionChart({ drills, className = '' }: DrillDistributionChartProps) {
  const distribution = drills.reduce((acc, drill) => {
    acc[drill.itemType] = (acc[drill.itemType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = drills.length;
  const types = Object.entries(distribution).sort((a, b) => b[1] - a[1]);

  if (total === 0) return null;

  return (
    <div className={`rounded-lg bg-muted/30 p-4 ${className}`} data-testid="drill-distribution-chart">
      <p className="text-xs font-medium text-muted-foreground mb-3">Practice Activities</p>
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        {types.map(([type, count]) => {
          const config = DRILL_TYPE_CONFIG[type] || { color: 'bg-gray-400', label: type };
          const percentage = (count / total) * 100;
          return (
            <div
              key={type}
              className={`${config.color}`}
              style={{ width: `${percentage}%` }}
              title={`${config.label}: ${count} (${Math.round(percentage)}%)`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {types.map(([type, count]) => {
          const config = DRILL_TYPE_CONFIG[type] || { color: 'bg-gray-400', label: type };
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${config.color}`} />
              <span className="text-muted-foreground">{config.label}</span>
              <span className="font-medium">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VocabularyPreviewProps {
  drills: DrillItem[];
  maxItems?: number;
  className?: string;
}

export function VocabularyPreview({ drills, maxItems = 6, className = '' }: VocabularyPreviewProps) {
  const vocabDrills = drills
    .filter(d => d.itemType === 'translate_speak' || d.itemType === 'matching' || d.itemType === 'listen_repeat')
    .filter(d => d.targetText && d.targetText.length < 50)
    .slice(0, maxItems);

  if (vocabDrills.length === 0) return null;

  return (
    <div className={`rounded-lg bg-muted/30 p-4 ${className}`} data-testid="vocabulary-preview">
      <p className="text-xs font-medium text-muted-foreground mb-3">Key Vocabulary</p>
      <div className="grid grid-cols-2 gap-2">
        {vocabDrills.map((drill, i) => (
          <div 
            key={drill.id || i} 
            className="bg-background rounded-md p-2 border border-border/50"
          >
            <p className="font-medium text-sm truncate">{drill.targetText}</p>
            {drill.prompt && (
              <p className="text-xs text-muted-foreground truncate">{drill.prompt}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ConversationPreviewProps {
  topic: string;
  prompts?: string[];
  className?: string;
}

export function ConversationPreview({ topic, prompts = [], className = '' }: ConversationPreviewProps) {
  return (
    <div className={`rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 p-4 border border-primary/20 ${className}`} data-testid="conversation-preview">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Conversation Topic</p>
          <p className="font-semibold text-sm mt-0.5">{topic}</p>
          {prompts.length > 0 && (
            <div className="mt-2 space-y-1">
              {prompts.slice(0, 2).map((prompt, i) => (
                <p key={i} className="text-xs text-muted-foreground line-clamp-2">
                  {prompt}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GrammarFocusProps {
  drills: DrillItem[];
  className?: string;
}

export function GrammarFocus({ drills, className = '' }: GrammarFocusProps) {
  const grammarDrills = drills
    .filter(d => d.itemType === 'fill_blank')
    .slice(0, 3);

  if (grammarDrills.length === 0) return null;

  return (
    <div className={`rounded-lg bg-muted/30 p-4 ${className}`} data-testid="grammar-focus">
      <p className="text-xs font-medium text-muted-foreground mb-3">Grammar Practice</p>
      <div className="space-y-2">
        {grammarDrills.map((drill, i) => (
          <div key={drill.id || i} className="bg-background rounded-md p-3 border border-border/50">
            <p className="text-sm line-clamp-2">{drill.prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VocabularyStudyGuideProps {
  drills: DrillItem[];
  title?: string;
  className?: string;
}

export function VocabularyStudyGuide({ 
  drills, 
  title = "Key Vocabulary to Study",
  className = '' 
}: VocabularyStudyGuideProps) {
  const vocabDrills = drills
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .slice(0, 8);

  if (vocabDrills.length === 0) return null;

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`} data-testid="vocabulary-study-guide">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {vocabDrills.map((drill, i) => (
          <div 
            key={drill.id || i} 
            className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
            data-testid={`vocab-item-${i}`}
          >
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{drill.targetText}</p>
              <p className="text-xs text-muted-foreground truncate">{drill.prompt}</p>
            </div>
          </div>
        ))}
      </div>
      {drills.filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak').length > 8 && (
        <p className="text-xs text-muted-foreground mt-3 text-center">
          +{drills.filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak').length - 8} more vocabulary items
        </p>
      )}
    </div>
  );
}

interface UsefulPhrasesProps {
  drills: DrillItem[];
  topic?: string;
  className?: string;
}

export function UsefulPhrases({ 
  drills, 
  topic,
  className = '' 
}: UsefulPhrasesProps) {
  const phraseDrills = drills
    .filter(d => d.targetText && d.targetText.split(' ').length >= 2)
    .slice(0, 6);

  if (phraseDrills.length === 0) return null;

  return (
    <div className={`rounded-lg border bg-gradient-to-br from-green-500/5 to-transparent p-4 ${className}`} data-testid="useful-phrases">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold">Useful Phrases for This Conversation</h4>
      </div>
      {topic && (
        <p className="text-xs text-muted-foreground mb-3">
          Practice these before chatting about: <span className="font-medium text-foreground">{topic}</span>
        </p>
      )}
      <div className="space-y-2">
        {phraseDrills.map((drill, i) => (
          <div 
            key={drill.id || i} 
            className="p-3 rounded-md bg-background border border-green-500/20 hover:border-green-500/40 transition-colors"
            data-testid={`phrase-item-${i}`}
          >
            <p className="font-medium text-sm">{drill.targetText}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{drill.prompt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PreparationTipsProps {
  lessonType: string;
  conversationTopic?: string;
  objectives?: string[];
  language?: string;
  className?: string;
}

export function PreparationTips({ 
  lessonType, 
  conversationTopic, 
  objectives,
  language,
  className = '' 
}: PreparationTipsProps) {
  const tips: string[] = [];
  const langDisplay = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'the target language';
  const { tutorGender } = useLanguage();
  const prepTutorName = getTutorName(language, tutorGender);
  
  if (lessonType === 'conversation' && conversationTopic) {
    tips.push(`Think about your own experience with: ${conversationTopic}`);
    tips.push(`${prepTutorName} will guide you \u2014 just try to respond in ${langDisplay}!`);
  } else if (lessonType === 'drill') {
    tips.push("Practice saying each word out loud before starting");
    tips.push("Focus on pronunciation, not just understanding");
  }
  
  if (objectives && objectives.length > 0) {
    objectives.forEach(obj => {
      const lowerObj = obj.toLowerCase();
      if (lowerObj.includes('describe')) {
        tips.push("Think of specific examples you want to describe");
      }
      if (lowerObj.includes('compare')) {
        tips.push("Prepare two things to compare and contrast");
      }
      if (lowerObj.includes('explain')) {
        tips.push("Organize your thoughts on how you'd explain this topic");
      }
      if (lowerObj.includes('routine') || lowerObj.includes('daily')) {
        tips.push("Review time-of-day vocabulary for this language before starting");
      }
      if (lowerObj.includes('culture') || lowerObj.includes('custom')) {
        tips.push("Think about cultural differences you've noticed or read about");
      }
    });
  }

  // Deduplicate tips
  const uniqueTips = Array.from(new Set(tips)).slice(0, 4);

  if (uniqueTips.length === 0) return null;

  return (
    <div className={`rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 ${className}`} data-testid="preparation-tips">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">How to Prepare</p>
          <ul className="space-y-1.5">
            {uniqueTips.map((tip, i) => (
              <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <span className="text-amber-500 mt-1 shrink-0">-</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface LessonSnapshotProps {
  lessonType: string;
  drills: DrillItem[];
  conversationTopic?: string;
  objectives?: string[];
  className?: string;
}

export function LessonSnapshot({ 
  lessonType, 
  drills, 
  conversationTopic, 
  objectives,
  className = '' 
}: LessonSnapshotProps) {
  const hasConversation = lessonType === 'conversation' && conversationTopic;
  const hasVocab = drills.some(d => d.itemType === 'translate_speak' || d.itemType === 'matching' || d.itemType === 'listen_repeat');
  const hasGrammar = drills.some(d => d.itemType === 'fill_blank');
  const hasDrills = drills.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {hasConversation && (
        <ConversationPreview 
          topic={conversationTopic} 
          prompts={drills.filter(d => d.prompt).slice(0, 2).map(d => d.prompt)}
        />
      )}
      
      {hasDrills && <DrillDistributionChart drills={drills} />}
      
      {hasVocab && <VocabularyPreview drills={drills} />}
      
      {hasGrammar && !hasVocab && <GrammarFocus drills={drills} />}
      
      {!hasConversation && !hasDrills && objectives && objectives.length > 0 && (
        <ObjectivesHighlight objectives={objectives} />
      )}
    </div>
  );
}

interface ObjectivesHighlightProps {
  objectives: string[];
  title?: string;
  className?: string;
}

export function ObjectivesHighlight({ 
  objectives, 
  title = "I can...",
  className = '' 
}: ObjectivesHighlightProps) {
  const icons = ['target', 'check', 'star', 'zap', 'award'];
  
  return (
    <div className={`rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <ul className="space-y-2">
        {objectives.slice(0, 4).map((obj, i) => (
          <li 
            key={i} 
            className="flex items-start gap-3 p-2 rounded-md bg-background/50 border border-transparent hover:border-primary/20 transition-colors"
            data-testid={`objective-item-${i}`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
              i === 0 ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
              i === 1 ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
              i === 2 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              'bg-purple-500/20 text-purple-600 dark:text-purple-400'
            }`}>
              {i + 1}
            </div>
            <span className="text-sm leading-relaxed">{obj}</span>
          </li>
        ))}
      </ul>
      {objectives.length > 4 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          +{objectives.length - 4} more objectives
        </p>
      )}
    </div>
  );
}

interface VisualVocabGridProps {
  lessonId: string;
  drills: DrillItem[];
  language: string;
}

// Max image cards shown per lesson section — 15 ensures both listen_repeat AND
// key translate_speak items (like ¿cómo está?) get slots, not just the first 10 items.
const MAX_VISUAL_PER_SECTION = 15;

// English translations that signal a discourse marker, connector, or abstract phrase.
// These don't have one clear picture — skip them.
const ABSTRACT_TRANSLATIONS = new Set([
  // Personal pronouns — grammatical role, no visual concept
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'you (formal)', 'you (informal)', 'i / me', 'you / your',
  // Question words — relational/grammatical, nothing meaningful to show
  'what', 'where', 'who', 'how', 'when', 'why', 'which', 'whose', 'whom',
  'what?', 'where?', 'who?', 'how?', 'when?', 'why?',
  // Yes / no / basic particles
  'yes', 'no', 'ok', 'okay', 'yes / no',
  // Articles and bare determiners alone
  'a', 'an', 'the',
  // Short copula / grammar phrases (2–3 words, grammatical not concrete)
  'i am', 'you are', 'he is', 'she is', 'it is', 'we are', 'they are',
  'i was', 'i will', 'i can', 'i do', 'i go', 'i have', 'is it', 'is this', 'is that',
  'to be', 'to have', 'to do', 'to go', 'to say', 'to see', 'to know', 'to get',
  'am i', 'are you', 'is he', 'is she',
  // Classroom management / meta-communication phrases
  'i understand', 'i dont understand', "i don't understand", 'i do not understand',
  'excuse me', 'never mind', 'pardon me',
  // "Slower / more slowly" — common classroom instruction, no clear image
  'slower', 'slower please', 'more slowly', 'more slowly please',
  'speak slower', 'speak more slowly', 'go slower', 'talk slower',
  // "What does X mean?" — meta-linguistic question words
  'what does mean', 'what does it mean', 'what does that mean', 'what does this mean',
  'what mean', 'how do you say', 'how do i say', 'how do we say',
  // Repetition requests
  'please repeat', 'can you repeat', 'repeat please', 'say it again', 'one more time',
  'again please', 'repeat that',
  // Discourse markers / connectors
  'however', 'although', 'therefore', 'moreover', 'furthermore', 'meanwhile',
  'consequently', 'nonetheless', 'nevertheless', 'whereas', 'despite', 'thus',
  'hence', 'accordingly', 'subsequently', 'conversely', 'alternatively',
  'in addition', 'on the other hand', 'in contrast', 'as a result',
  'for example', 'for instance', 'in other words', 'in conclusion',
  'to summarize', 'in summary', 'first of all', 'in my opinion',
  'it is important', 'it is necessary', 'there is', 'there are',
  'to have to', 'to be able to', 'one must', 'one can',
  'it seems', 'i think', 'in order to', 'so that', 'in fact',
  'on the contrary', 'in spite of', 'even though', 'as well as',
  'not only', 'both', 'neither', 'either', 'whether', 'on condition that',
  'provided that', 'as long as', 'in case', 'so long as', 'as soon as',
]);

// Single abstract English nouns that don't produce useful vocab images
const ABSTRACT_SINGLE_NOUNS = new Set([
  'leadership', 'democracy', 'ideology', 'nationalism', 'globalization',
  'capitalism', 'socialism', 'communism', 'imperialism', 'colonialism',
  'consciousness', 'existence', 'reality', 'knowledge', 'understanding',
  'intelligence', 'wisdom', 'truth', 'morality', 'ethics', 'justice',
  'freedom', 'liberty', 'equality', 'solidarity', 'humanity',
  'identity', 'personality', 'mentality', 'philosophy', 'theory',
  'policy', 'politics', 'economy', 'society', 'culture',
  'heritage', 'civilization', 'modernization', 'progress',
  'development', 'achievement', 'influence', 'importance', 'significance',
  'relationship', 'communication', 'collaboration', 'cooperation',
  'motivation', 'creativity', 'imagination', 'inspiration', 'innovation',
  'sustainability', 'responsibility', 'accountability', 'transparency',
  'diversity', 'inclusion', 'discrimination', 'prejudice', 'tolerance',
  'perception', 'emotion', 'thought', 'attitude', 'behavior', 'tendency',
  'strategy', 'method', 'technique', 'process', 'procedure', 'approach',
  'phenomenon', 'concept', 'notion', 'principle', 'tradition', 'convention',
]);

// English word prefixes that almost always yield confusing abstract images
const ABSTRACT_PREFIXES = [
  'the development', 'the impact', 'the context', 'the process',
  'the relationship', 'the influence', 'the importance', 'the significance',
  'the establishment', 'the implementation', 'the achievement',
  'the concept of', 'the phenomenon', 'the situation', 'the consequences',
];

/**
 * Returns true if a vocab item is visually concrete enough to show an image card.
 * Greetings, numbers, and time words (listen_repeat) always pass.
 * For translate_speak items we check the English translation for signals of abstraction.
 */
function isVisuallyMeaningful(targetText: string, prompt: string | undefined, itemType: string): boolean {
  // listen_repeat = curated items (greetings, days, numbers) — always show
  if (itemType === 'listen_repeat') return true;

  // Strip terminal/internal punctuation and ellipsis so "I don't understand."
  // correctly matches "i don't understand" in ABSTRACT_TRANSLATIONS.
  const eng = (prompt ?? '').toLowerCase().trim()
    .replace(/\.\.\./g, ' ')             // ellipsis → space ("does..." → "does")
    .replace(/['''`]/g, '')              // remove apostrophes: "don't" → "dont"
    .replace(/[.,!?;:"¡¿…]+/g, ' ')     // other punctuation → space
    .replace(/\s+/g, ' ')
    .trim();

  // No English translation available — allow it through
  if (!eng || eng === targetText.toLowerCase().trim()) return true;

  // Strip parenthetical register annotations like "(formal)", "(informal)", "(polite)" before
  // counting words — they are usage hints, not part of the core translation.
  const engCore = eng.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // 4+ English words = almost certainly an abstract or multi-part phrase
  if (engCore.split(/\s+/).length >= 4) return false;

  // Exact match to known discourse/connector words
  if (ABSTRACT_TRANSLATIONS.has(eng)) return false;

  // Single abstract nouns (leadership, democracy, ideology, etc.)
  if (eng.split(/\s+/).length === 1 && ABSTRACT_SINGLE_NOUNS.has(eng)) return false;

  // Starts with an abstract-noun pattern
  if (ABSTRACT_PREFIXES.some(p => eng.startsWith(p))) return false;

  return true;
}

export function VisualVocabGrid({ lessonId, drills, language }: VisualVocabGridProps) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ images: Record<string, { url: string; source: string; speakerGender?: 'male' | 'female' }>; romanizations?: Record<string, string> }>({
    queryKey: ['/api/textbook/vocab-images', lessonId, language],
    queryFn: async () => {
      const res = await fetch(`/api/textbook/vocab-images/${lessonId}?language=${language}`);
      if (!res.ok) throw new Error('Failed to fetch vocab images');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  // Normalize a targetText for dedup comparison — strips punctuation & accents
  function dedupKey(t: string) {
    return t.toLowerCase().replace(/[¿¡!?,;:.…]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  const seenVisual = new Set<string>();
  const vocabDrills = drills
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .filter(d => {
      const t = d.targetText?.trim();
      if (!t || t.length > 40) return false;
      if (/^\d/.test(t)) return false;
      if (t.split(/\s+/).length > 5) return false;
      const k = dedupKey(t);
      if (seenVisual.has(k)) return false;
      seenVisual.add(k);
      return true;
    })
    .filter(d => isVisuallyMeaningful(d.targetText, d.prompt, d.itemType))
    .slice(0, MAX_VISUAL_PER_SECTION);

  // Text-only grid: translate_speak items filtered OUT of the image grid
  // (function/grammar words that are better as a plain word list)
  const seenText = new Set<string>();
  const textOnlyDrills = drills
    .filter(d => d.itemType === 'translate_speak')
    .filter(d => {
      const t = d.targetText?.trim();
      if (!t || t.length > 50) return false;
      if (/^\d/.test(t)) return false;
      if (t.split(/\s+/).length > 6) return false;
      return true;
    })
    .filter(d => !isVisuallyMeaningful(d.targetText, d.prompt, d.itemType))
    .filter(d => {
      if (!d.prompt || d.prompt === d.targetText) return false;
      const k = dedupKey(d.targetText ?? '');
      if (seenText.has(k)) return false;
      seenText.add(k);
      return true;
    })
    .slice(0, 18);

  if (vocabDrills.length === 0 && textOnlyDrills.length === 0) return null;

  const images = data?.images || {};
  const romanizations = data?.romanizations || {};

  return (
    <div data-testid="visual-vocab-grid">
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        Visual Vocabulary
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {vocabDrills.map((drill, i) => {
          const imgData = images[drill.id];
          const hasImage = imgData?.url && !failedImages.has(drill.id);
          const imageLoaded = loadedImages.has(drill.id);
          const hasTranslation = drill.prompt && drill.prompt !== drill.targetText;

          return (
            <div
              key={drill.id || i}
              className="rounded-md border bg-card overflow-hidden"
              data-testid={`visual-vocab-item-${i}`}
            >
              <div className="relative aspect-square bg-muted/30 overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
                {hasImage && (
                  <img
                    src={imgData.url}
                    alt={drill.targetText}
                    className={`w-full h-full object-cover object-top transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    loading="lazy"
                    onLoad={() => setLoadedImages(prev => new Set(prev).add(drill.id))}
                    onError={() => setFailedImages(prev => new Set(prev).add(drill.id))}
                  />
                )}
                {!isLoading && !hasImage && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
                    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <path d="M21 15l-5-5L5 21"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-2 flex items-center gap-1.5">
                <TextAudioPlayButton
                  text={drill.targetText}
                  language={language}
                  gender={imgData?.speakerGender}
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{drill.targetText}</p>
                  {romanizations[drill.id] && (
                    <p className="text-xs text-muted-foreground/70 italic truncate">{romanizations[drill.id]}</p>
                  )}
                  {hasTranslation && (
                    <p className="text-xs text-muted-foreground truncate">{drill.prompt}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {textOnlyDrills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h10"/>
            </svg>
            Vocabulary
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {textOnlyDrills.map((drill, i) => (
              <div
                key={drill.id || `text-${i}`}
                className="rounded-md bg-muted/40 px-2.5 py-2 flex items-center gap-1.5"
                data-testid={`text-vocab-item-${i}`}
              >
                <TextAudioPlayButton
                  text={drill.targetText}
                  language={language}
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{drill.targetText}</p>
                  {romanizations[drill.id] && (
                    <p className="text-xs text-muted-foreground/70 italic truncate">{romanizations[drill.id]}</p>
                  )}
                  <p className="text-xs text-muted-foreground truncate">{drill.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface LessonPrepCardProps {
  objectives?: string[];
  drills?: DrillItem[];
  conversationTopic?: string;
  lessonType: string;
  language?: string;
  lessonId?: string;
  className?: string;
  suppressVocabGrid?: boolean;
}

export function LessonPrepCard({
  objectives,
  drills = [],
  conversationTopic,
  lessonType,
  language,
  lessonId,
  className = '',
  suppressVocabGrid = false,
}: LessonPrepCardProps) {
  const langDisplay = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'the target language';
  const { tutorGender } = useLanguage();
  const tutorName = getTutorName(language, tutorGender);
  
  function cleanPromptToEnglish(prompt: string): string {
    return prompt
      .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.\s*Context:\s*/i, '$1 — ')
      .replace(/^Say\s+"([^"]+)"\s+in\s+\w+\.?\s*/i, '$1')
      .replace(/^Translate[:\s]+/i, '')
      .trim();
  }

  // Vocabulary: single-word items only (prevents overlap with phraseDrills)
  const vocabDrills = drills
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .filter(d => d.targetText && d.targetText.trim().split(/\s+/).length === 1)
    .slice(0, 6);
  
  // Useful Phrases: multi-word items only (mutually exclusive with vocabDrills)
  const phraseDrills = drills
    .filter(d => (d.itemType === 'listen_repeat' || d.itemType === 'translate_speak'))
    .filter(d => d.targetText && d.targetText.trim().split(/\s+/).length >= 2 && d.targetText.length < 80)
    .slice(0, 4);

  const conversationScriptLines = conversationTopic ? drills
    .filter(d => d.targetText && d.prompt && d.targetText.length < 80)
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .slice(0, 3)
    .map((d, i) => ({
      speaker: i % 2 === 0 ? 'Daniela' as const : 'You' as const,
      line: d.targetText,
      translation: cleanPromptToEnglish(d.prompt),
    })) : [];

  const hasObjectives = objectives && objectives.length > 0;
  const hasVocab = vocabDrills.length > 0;
  const hasPhrases = phraseDrills.length > 0;
  const hasConversation = !!conversationTopic;
  const hasScript = conversationScriptLines.length > 0;
  
  if (!hasObjectives && !hasVocab && !hasPhrases && !hasConversation) return null;

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="lesson-prep-card">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Lesson Prep</h4>
            <p className="text-xs text-muted-foreground">What you'll learn and practice</p>
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {hasObjectives && (
          <div data-testid="prep-can-do-goals">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
              After this lesson, I can...
            </p>
            <ul className="space-y-1.5">
              {objectives!.slice(0, 4).map((obj, i) => (
                <li 
                  key={i} 
                  className="flex items-start gap-2.5 p-2 rounded-md bg-muted/30"
                  data-testid={`prep-objective-${i}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    i === 0 ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                    i === 1 ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                    i === 2 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                  }`}>
                    {i + 1}
                  </div>
                  <span className="text-sm leading-relaxed">{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {hasConversation && (
          <div className="rounded-md bg-primary/5 border border-primary/15 p-3" data-testid="prep-conversation-preview">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Conversation Preview
            </p>
            <p className="text-sm font-medium mb-1">{conversationTopic}</p>
            {hasScript && (
              <div className="mt-2 space-y-1.5 border-t border-primary/10 pt-2">
                {conversationScriptLines.map((line, i) => (
                  <div key={i} className="flex items-start gap-2" data-testid={`prep-script-line-${i}`}>
                    <span className={`text-xs font-semibold shrink-0 mt-0.5 ${
                      line.speaker === 'Daniela' 
                        ? 'text-violet-600 dark:text-violet-400' 
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {line.speaker === 'Daniela' ? 'T:' : 'S:'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">{line.line}</p>
                      <p className="text-xs text-muted-foreground">{line.translation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {tutorName} will guide you. Just try to respond in {langDisplay}!
            </p>
          </div>
        )}
        
        {hasVocab && !suppressVocabGrid && (lessonId && language ? (
          <VisualVocabGrid lessonId={lessonId} drills={drills} language={language} />
        ) : (
          <div data-testid="prep-vocabulary">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Vocabulary
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {vocabDrills.map((drill, i) => {
                const cleanedPrompt = drill.prompt ? cleanPromptToEnglish(drill.prompt) : '';
                const hasTranslation = cleanedPrompt && cleanedPrompt !== drill.targetText;
                return (
                  <div 
                    key={drill.id || i} 
                    className="flex items-center gap-1.5 p-2 rounded-md bg-muted/30 border border-transparent"
                    data-testid={`prep-vocab-${i}`}
                  >
                    {language && (
                      <TextAudioPlayButton
                        text={drill.targetText}
                        language={language}
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{drill.targetText}</p>
                      {hasTranslation && (
                        <p className="text-xs text-muted-foreground truncate">{cleanedPrompt}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {hasPhrases && (
          <div data-testid="prep-phrases">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Useful Phrases
            </p>
            <div className="space-y-1.5">
              {phraseDrills.map((drill, i) => {
                const cleanedPrompt = drill.prompt ? cleanPromptToEnglish(drill.prompt) : '';
                const hasTranslation = cleanedPrompt && cleanedPrompt !== drill.targetText;
                return (
                  <div 
                    key={drill.id || i} 
                    className="flex items-center gap-1.5 p-2 rounded-md bg-green-500/5 border border-green-500/15"
                    data-testid={`prep-phrase-${i}`}
                  >
                    {language && (
                      <TextAudioPlayButton
                        text={drill.targetText}
                        language={language}
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{drill.targetText}</p>
                      {hasTranslation && (
                        <p className="text-xs text-muted-foreground">{cleanedPrompt}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grammar Reference Cards ────────────────────────────────────────────────

export function SerEstarCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-ser-estar">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-500/10 via-amber-500/5 to-transparent">
        <p className="text-sm font-semibold text-center">SER vs ESTAR — both mean "to be"</p>
        <p className="text-xs text-muted-foreground text-center">but they have very different jobs</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">SER</span>
            <span className="text-xs text-muted-foreground">permanent / identity</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Identity', ex: 'Soy Pedro.' },
              { label: 'Origin', ex: 'Soy de México.' },
              { label: 'Profession', ex: 'Es médica.' },
              { label: 'Time', ex: 'Son las tres.' },
              { label: 'Trait', ex: 'Es inteligente.' },
              { label: 'Material', ex: 'Es de madera.' },
            ].map(({ label, ex }) => (
              <div key={label} className="text-xs">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{label}</span>
                <span className="text-muted-foreground ml-1">— {ex}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">ESTAR</span>
            <span className="text-xs text-muted-foreground">temporary / state</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Location', ex: 'Estoy en casa.' },
              { label: 'Health', ex: 'Está enfermo.' },
              { label: 'Emotion', ex: 'Estás contento.' },
              { label: 'Condition', ex: 'Está abierto.' },
              { label: 'In progress', ex: 'Estoy comiendo.' },
              { label: 'Result', ex: 'Está cansada.' },
            ].map(({ label, ex }) => (
              <div key={label} className="text-xs">
                <span className="font-semibold text-amber-600 dark:text-amber-400">{label}</span>
                <span className="text-muted-foreground ml-1">— {ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-center text-muted-foreground">
          <span className="text-blue-600 dark:text-blue-400 font-medium">SER</span> = who/what something <em>is</em> &nbsp;·&nbsp;
          <span className="text-amber-600 dark:text-amber-400 font-medium">ESTAR</span> = how something <em>feels or is right now</em>
        </p>
      </div>
    </div>
  );
}

export function PretImperfectCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-pret-imp">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">Pretérito vs Imperfecto</p>
        <p className="text-xs text-muted-foreground text-center">two ways to talk about the past</p>
      </div>
      <svg viewBox="0 0 400 110" className="w-full h-auto" aria-hidden="true">
        <defs>
          <marker id="arrow-pret-imp" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground) / 0.5)" />
          </marker>
        </defs>
        <line x1="30" y1="55" x2="370" y2="55" stroke="hsl(var(--border))" strokeWidth="1.5" markerEnd="url(#arrow-pret-imp)" />
        {[75, 150, 225, 300].map((x, i) => (
          <g key={i}>
            <circle cx={x} cy="35" r="7" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <line x1={x} y1="42" x2={x} y2="54" stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="2,2" />
          </g>
        ))}
        <path
          d="M 45 72 Q 65 64 85 72 Q 105 80 125 72 Q 145 64 165 72 Q 185 80 205 72 Q 225 64 245 72 Q 265 80 285 72 Q 305 64 325 72 Q 345 80 362 72"
          fill="none" stroke="hsl(var(--chart-3) / 0.8)" strokeWidth="2.5" strokeLinecap="round"
        />
        <text x="190" y="18" textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--primary))">Preterite — completed</text>
        <text x="190" y="100" textAnchor="middle" fontSize="10" fontWeight="600" fill="hsl(var(--chart-3))">Imperfect — ongoing / habitual</text>
      </svg>
      <div className="grid grid-cols-2 divide-x border-t">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
            <span className="text-xs font-semibold text-primary">Preterite</span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground mb-3">
            <li>• completed, single action</li>
            <li>• specific time is mentioned</li>
            <li>• clear beginning or end</li>
          </ul>
          <p className="text-xs font-medium text-foreground mb-1">Trigger words</p>
          <p className="text-xs text-muted-foreground">ayer, anoche, el lunes,<br />de repente, una vez</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-0.5 bg-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Imperfect</span>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground mb-3">
            <li>• ongoing or habitual action</li>
            <li>• background / description</li>
            <li>• age, weather, feelings in past</li>
          </ul>
          <p className="text-xs font-medium text-foreground mb-1">Trigger words</p>
          <p className="text-xs text-muted-foreground">siempre, todos los días,<br />cuando era niño, antes</p>
        </div>
      </div>
    </div>
  );
}

export function PorParaCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-por-para">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-transparent">
        <p className="text-sm font-semibold text-center">POR vs PARA — both translate as "for"</p>
        <p className="text-xs text-muted-foreground text-center">but they express very different relationships</p>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <div className="p-4">
          <span className="text-base font-bold text-green-600 dark:text-green-400">POR</span>
          <div className="mt-2 space-y-2.5">
            {[
              { use: 'Cause / reason', ex: 'Gracias por ayudar.' },
              { use: 'Exchange', ex: 'Lo compré por €5.' },
              { use: 'Duration', ex: 'Estudié por dos horas.' },
              { use: 'Through / along', ex: 'Caminé por el parque.' },
              { use: 'On behalf of', ex: 'Habla por mí.' },
              { use: 'Per', ex: 'Gana €20 por hora.' },
            ].map(({ use, ex }) => (
              <div key={use} className="text-xs">
                <span className="font-semibold text-green-600 dark:text-green-400">{use}</span>
                <span className="text-muted-foreground block">{ex}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <span className="text-base font-bold text-rose-600 dark:text-rose-400">PARA</span>
          <div className="mt-2 space-y-2.5">
            {[
              { use: 'Purpose / goal', ex: 'Estudio para aprender.' },
              { use: 'Recipient', ex: 'Este regalo es para ti.' },
              { use: 'Destination', ex: 'Salgo para México.' },
              { use: 'Deadline', ex: 'Lo necesito para el lunes.' },
              { use: 'Opinion', ex: 'Para mí, es difícil.' },
              { use: 'Employment', ex: 'Trabajo para Apple.' },
            ].map(({ use, ex }) => (
              <div key={use} className="text-xs">
                <span className="font-semibold text-rose-600 dark:text-rose-400">{use}</span>
                <span className="text-muted-foreground block">{ex}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <p className="text-xs text-center text-muted-foreground">
          <span className="text-green-600 dark:text-green-400 font-medium">POR</span> = cause, means, exchange &nbsp;·&nbsp;
          <span className="text-rose-600 dark:text-rose-400 font-medium">PARA</span> = purpose, recipient, direction
        </p>
      </div>
    </div>
  );
}

// ─── False Cognate Cards ─────────────────────────────────────────────────────

const FALSE_COGNATES_DATA = [
  { english: 'embarrassed', correct: 'avergonzado/a', lookAlike: 'embarazada', lookAlikeMeans: 'pregnant' },
  { english: 'sensible', correct: 'sensato/a', lookAlike: 'sensible', lookAlikeMeans: 'sensitive' },
  { english: 'to realize', correct: 'darse cuenta de', lookAlike: 'realizar', lookAlikeMeans: 'to accomplish' },
  { english: 'actual', correct: 'real / verdadero', lookAlike: 'actual', lookAlikeMeans: 'current, present-day' },
  { english: 'exit', correct: 'salida', lookAlike: 'éxito', lookAlikeMeans: 'success' },
  { english: 'library', correct: 'biblioteca', lookAlike: 'librería', lookAlikeMeans: 'bookstore' },
  { english: 'to assist', correct: 'ayudar', lookAlike: 'asistir', lookAlikeMeans: 'to attend' },
  { english: 'carpet', correct: 'alfombra', lookAlike: 'carpeta', lookAlikeMeans: 'folder/binder' },
  { english: 'constipated', correct: 'estreñido', lookAlike: 'constipado', lookAlikeMeans: 'having a cold' },
  { english: 'parents', correct: 'padres', lookAlike: 'parientes', lookAlikeMeans: 'relatives' },
  { english: 'to introduce', correct: 'presentar', lookAlike: 'introducir', lookAlikeMeans: 'to insert' },
  { english: 'to molest', correct: 'acosar', lookAlike: 'molestar', lookAlikeMeans: 'to bother/annoy' },
];

interface FalseCognateCardProps {
  english: string;
  correct: string;
  lookAlike: string;
  lookAlikeMeans: string;
  className?: string;
}

export function FalseCognateCard({ english, correct, lookAlike, lookAlikeMeans, className = '' }: FalseCognateCardProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`} data-testid={`false-cognate-${english.replace(/\s/g, '-')}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center mt-0.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-semibold">{english}</span>
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{correct}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="text-red-500 line-through mr-1">{lookAlike}</span>
            means <em>{lookAlikeMeans}</em> — not what you want!
          </p>
        </div>
      </div>
    </div>
  );
}

export function FalseCognatesGrid({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="false-cognates-grid">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-red-500/10 to-transparent">
        <p className="text-sm font-semibold">False Cognates — Words That Trick English Speakers</p>
        <p className="text-xs text-muted-foreground">These Spanish words look like English words — but they mean something completely different</p>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {FALSE_COGNATES_DATA.map((item) => (
          <FalseCognateCard key={item.english} {...item} />
        ))}
      </div>
    </div>
  );
}

interface LessonNarrativeProps {
  lessonName: string;
  description?: string;
  objectives?: string[];
  tip?: string;
  className?: string;
}

export function LessonNarrative({ 
  lessonName,
  description,
  objectives,
  tip,
  className = '' 
}: LessonNarrativeProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
      
      {objectives && objectives.length > 0 && (
        <ObjectivesHighlight objectives={objectives} />
      )}
      
      {tip && (
        <div className="flex gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <span className="font-medium">Tip: </span>{tip}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sentence Frame Grid ───────────────────────────────────────────────────────
// Inspired by Margarita Madrigal's "See It and Say It in Spanish" (1962).
// Displays a single structural sentence frame (e.g. "Tengo que ir al ___")
// alongside a grid of vocabulary fillers — each card shows the full completed
// sentence so the learner internalises both the frame and the word at once.

export interface SentenceFrameItem {
  filler: string;
  fullSentence: string;
  translation: string;
  imageKey?: string;
}

export interface SentenceFrame {
  frame: string;
  frameTranslation: string;
  items: SentenceFrameItem[];
}

interface SentenceFrameGridProps {
  frames: SentenceFrame[];
  language: string;
  className?: string;
}

function highlightFiller(sentence: string, filler: string) {
  const idx = sentence.toLowerCase().indexOf(filler.toLowerCase());
  if (idx === -1) {
    return <span>{sentence}</span>;
  }
  return (
    <>
      {sentence.slice(0, idx)}
      <span className="text-primary font-bold">{sentence.slice(idx, idx + filler.length)}</span>
      {sentence.slice(idx + filler.length)}
    </>
  );
}

function renderFrameTemplate(frame: string) {
  const parts = frame.split('___');
  if (parts.length === 1) return <span>{frame}</span>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-block px-2 mx-1 rounded-md bg-primary/15 text-primary border border-primary/30 text-base font-bold tracking-wider">
              ___
            </span>
          )}
        </span>
      ))}
    </>
  );
}

// ── Cognate Recognition Grid ─────────────────────────────────────────────────

interface CognateEntry {
  english: string;
  spanish: string;
  category: string;
  isFalseCognate?: boolean;
  falseCognateNote?: string;
}

interface CognateRecognitionGridProps {
  cognates: CognateEntry[];
  language?: string;
  className?: string;
}

export function CognateRecognitionGrid({ cognates, language = 'spanish', className = '' }: CognateRecognitionGridProps) {
  if (!cognates || cognates.length === 0) return null;

  const trueCognates = cognates.filter(c => !c.isFalseCognate);
  const falseCognates = cognates.filter(c => c.isFalseCognate);

  const grouped = trueCognates.reduce<Record<string, CognateEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {});

  const categoryOrder = ['Identical in both languages', 'Nearly the same', '-tion → -ción', '-ist → -ista'];
  const sortedCategories = [
    ...categoryOrder.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)),
  ];

  return (
    <div className={`space-y-5 ${className}`} data-testid="cognate-recognition-grid">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-semibold text-base" data-testid="text-cognate-headline">
            You already speak some Spanish
          </h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          English and Spanish share thousands of words from their common Latin roots. Many are identical or near-identical. You are not starting from zero.
        </p>
      </div>

      {sortedCategories.map(category => (
        <div key={category} className="space-y-2" data-testid={`cognate-group-${category}`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {grouped[category].map((entry, i) => (
              <Card
                key={i}
                className="hover-elevate"
                data-testid={`cognate-card-${category}-${i}`}
              >
                <CardContent className="p-3 flex flex-col gap-1.5">
                  <div className="text-lg font-bold text-primary leading-tight" data-testid={`text-target-${i}`}>
                    {entry.target ?? entry.spanish}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-english-${i}`}>
                    {entry.english}
                  </div>
                  <TextAudioPlayButton
                    text={entry.target ?? entry.spanish}
                    language={language}
                    size="sm"
                    data-testid={`button-play-cognate-${i}`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {falseCognates.length > 0 && (
        <div className="space-y-2" data-testid="false-cognates-section">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Watch out — false friends
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {falseCognates.map((entry, i) => (
              <Card
                key={i}
                className="border-amber-500/25 bg-amber-500/5"
                data-testid={`false-cognate-card-${i}`}
              >
                <CardContent className="p-3 flex flex-col gap-1.5">
                  <div className="text-base font-bold text-amber-700 dark:text-amber-300 leading-tight">
                    {entry.target ?? entry.spanish}
                  </div>
                  <div className="text-xs text-muted-foreground line-through">
                    {entry.english}
                  </div>
                  {entry.falseCognateNote && (
                    <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                      {entry.falseCognateNote}
                    </div>
                  )}
                  <TextAudioPlayButton
                    text={entry.target ?? entry.spanish}
                    language={language}
                    size="sm"
                    data-testid={`button-play-false-cognate-${i}`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SentenceFrameGrid({ frames, language, className = '' }: SentenceFrameGridProps) {
  if (!frames || frames.length === 0) return null;

  // Collect all unique imageKeys across all frames
  const allImageKeys = Array.from(
    new Set(frames.flatMap(f => f.items.map(i => i.imageKey).filter(Boolean) as string[]))
  );

  const { data: imageData, isLoading: imagesLoading } = useQuery<{ images: Record<string, { url: string; source: string }> }>({
    queryKey: ['/api/textbook/vocab-images-by-keys', allImageKeys.sort().join(',')],
    queryFn: async () => {
      if (allImageKeys.length === 0) return { images: {} };
      const res = await fetch(`/api/textbook/vocab-images-by-keys?keys=${allImageKeys.join(',')}`);
      if (!res.ok) throw new Error('Failed to fetch sentence frame images');
      return res.json();
    },
    enabled: allImageKeys.length > 0,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
    retry: 1,
  });

  const resolvedImages = imageData?.images ?? {};

  return (
    <div className={`space-y-8 ${className}`} data-testid="sentence-frame-grid">
      {frames.map((frame, frameIdx) => (
        <div key={frameIdx} className="space-y-3">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid={`sentence-frame-header-${frameIdx}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Repeat2 className="h-3.5 w-3.5 text-primary" />
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                  Pattern Drill
                </Badge>
              </div>
              <div className="text-lg font-semibold tracking-wide">
                {renderFrameTemplate(frame.frame)}
              </div>
              <p className="text-sm text-muted-foreground mt-1 italic">{frame.frameTranslation}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {frame.items.map((item, itemIdx) => {
              const imgRecord = item.imageKey ? resolvedImages[item.imageKey] : undefined;
              const imgUrl = imgRecord?.url;
              const showImageSlot = !!item.imageKey;

              return (
                <Card
                  key={itemIdx}
                  className="overflow-hidden hover-elevate"
                  data-testid={`sentence-frame-card-${frameIdx}-${itemIdx}`}
                >
                  {showImageSlot && (
                    <div className="relative w-full h-24 bg-muted/30 overflow-hidden" data-testid={`img-frame-${frameIdx}-${itemIdx}`}>
                      {imagesLoading ? (
                        <div className="absolute inset-0 bg-muted/40 animate-pulse" />
                      ) : imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={item.filler}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold text-primary/20 select-none">{item.filler.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className="p-3 flex flex-col gap-2 h-full">
                    <div
                      className={showImageSlot ? "text-base font-bold text-primary leading-tight" : "text-xl font-bold text-primary leading-tight"}
                      data-testid={`text-filler-${frameIdx}-${itemIdx}`}
                    >
                      {item.filler}
                    </div>
                    <p className="text-sm font-medium leading-snug flex-1" data-testid={`text-full-sentence-${frameIdx}-${itemIdx}`}>
                      {highlightFiller(item.fullSentence, item.filler)}
                    </p>
                    <p className="text-xs text-muted-foreground" data-testid={`text-translation-${frameIdx}-${itemIdx}`}>
                      {item.translation}
                    </p>
                    <TextAudioPlayButton
                      text={item.fullSentence}
                      language={language}
                      size="sm"
                      data-testid={`button-play-sentence-${frameIdx}-${itemIdx}`}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Vocab Q&A Grid (M1) ───────────────────────────────────────────────────────

interface VocabQAItem {
  word: string;
  translation: string;
  question: string;
  answer: string;
}

interface VocabQAGridProps {
  items: VocabQAItem[];
  language?: string;
  className?: string;
}

export function VocabQAGrid({ items, language = 'spanish', className = '' }: VocabQAGridProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className={`space-y-3 ${className}`} data-testid="vocab-qa-grid">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <h3 className="font-semibold text-base">Production Drill</h3>
        <Badge variant="outline" className="text-xs border-sky-500/30 text-sky-600 dark:text-sky-400">
          full sentences
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">Practice answering in complete sentences, not just single words.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, i) => (
          <Card key={i} className="hover-elevate" data-testid={`qa-card-${i}`}>
            <CardContent className="p-4 space-y-2">
              <div className="text-xs text-muted-foreground italic" data-testid={`text-question-${i}`}>
                {item.question}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm leading-snug flex-1" data-testid={`text-answer-${i}`}>
                  {item.answer}
                </div>
                <TextAudioPlayButton text={item.answer} language={language} size="sm" data-testid={`button-play-qa-${i}`} />
              </div>
              {(item.translation || item.answerTranslation) && (
                <div className="text-xs text-muted-foreground border-t pt-2 mt-1" data-testid={`text-qa-translation-${i}`}>
                  {item.translation || item.answerTranslation}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Gender Agreement Grid (M2) ────────────────────────────────────────────────

interface GenderPair {
  masculine: string;
  feminine: string;
  translation: string;
}

interface GenderAgreementGridProps {
  pairs: GenderPair[];
  masculineFrame?: string;
  feminineFrame?: string;
  language?: string;
  className?: string;
}

export function GenderAgreementGrid({
  pairs,
  masculineFrame = 'Él está ___.',
  feminineFrame = 'Ella está ___.',
  language = 'spanish',
  className = '',
}: GenderAgreementGridProps) {
  if (!pairs || pairs.length === 0) return null;
  return (
    <div className={`space-y-3 ${className}`} data-testid="gender-agreement-grid">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-base">Gender Agreement</h3>
        <Badge variant="outline" className="text-xs border-violet-500/30 text-violet-600 dark:text-violet-400">
          masculine / feminine
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">Spanish adjectives change their ending to match the person they describe.</p>
      <div className="grid grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border">
        <div className="bg-card px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {masculineFrame}
        </div>
        <div className="bg-card px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {feminineFrame}
        </div>
        {pairs.map((pair, i) => (
          <>
            <div key={`m-${i}`} className="bg-card px-3 py-2.5 flex items-center justify-between gap-2 border-t" data-testid={`gender-masc-${i}`}>
              <span className="font-semibold text-sm">{pair.masculine}</span>
              <TextAudioPlayButton text={pair.masculine} language={language} size="sm" data-testid={`button-play-masc-${i}`} />
            </div>
            <div key={`f-${i}`} className="bg-muted/20 px-3 py-2.5 flex items-center justify-between gap-2 border-t" data-testid={`gender-fem-${i}`}>
              <span className="font-semibold text-sm">{pair.feminine}</span>
              <TextAudioPlayButton text={pair.feminine} language={language} size="sm" data-testid={`button-play-fem-${i}`} />
            </div>
          </>
        ))}
        <div className="bg-card/50 px-3 py-1.5 col-span-2 border-t">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {pairs.map((pair, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                {pair.masculine} / {pair.feminine} = {pair.translation}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The Infinitive Pattern Card (M3 — trigger verb + infinitive) ─────────────

const MODAL_VERBS_DATA = [
  {
    verb: 'VOY A',
    meaning: 'going to (near future)',
    colorClass: 'text-rose-600 dark:text-rose-400',
    bgClass: 'from-rose-500/10',
    conjugations: ['voy a', 'vas a', 'va a', 'vamos a', 'van a'],
    example: 'Voy a estudiar esta noche.',
    translation: 'I am going to study tonight.',
    note: 'ir (irregular) + a',
  },
  {
    verb: 'QUERER',
    meaning: 'to want',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'from-emerald-500/10',
    conjugations: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'],
    example: 'Quiero aprender español.',
    translation: 'I want to learn Spanish.',
    note: 'e → ie  stem change',
  },
  {
    verb: 'PODER',
    meaning: 'can / to be able to',
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'from-blue-500/10',
    conjugations: ['puedo', 'puedes', 'puede', 'podemos', 'pueden'],
    example: 'Puedo hablar un poco.',
    translation: 'I can speak a little.',
    note: 'o → ue  stem change',
  },
  {
    verb: 'DEBER',
    meaning: 'should / must (obligation)',
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'from-amber-500/10',
    conjugations: ['debo', 'debes', 'debe', 'debemos', 'deben'],
    example: 'Debes practicar cada día.',
    translation: 'You should practice every day.',
    note: 'regular –ER verb',
  },
  {
    verb: 'TENER QUE',
    meaning: 'to have to / must (necessity)',
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'from-violet-500/10',
    conjugations: ['tengo que', 'tienes que', 'tiene que', 'tenemos que', 'tienen que'],
    example: 'Tengo que irme ahora.',
    translation: 'I have to go now.',
    note: 'tener (irregular) + que',
  },
];

export function ModalVerbsCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${className}`} data-testid="grammar-card-modal-verbs">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
        <p className="text-sm font-semibold text-center">The Infinitive Pattern</p>
        <p className="text-xs text-muted-foreground text-center">voy a · quiero · puedo · debo · tengo que</p>
      </div>

      {/* Formula bar */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-muted/20 border-b">
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-xs font-bold text-primary">trigger verb</span>
          <span className="text-xs font-bold text-muted-foreground">+</span>
          <span className="px-2 py-1 rounded bg-muted border text-xs font-semibold text-foreground/70">infinitive</span>
          <span className="text-xs text-muted-foreground mx-1">→</span>
          <span className="text-xs text-muted-foreground italic">Voy a <span className="font-semibold text-foreground/80">comer</span>.</span>
        </div>
      </div>

      {/* Verb rows */}
      <div className="divide-y">
        {MODAL_VERBS_DATA.map((m) => (
          <div key={m.verb} className={`px-4 py-3 bg-gradient-to-r ${m.bgClass} to-transparent`} data-testid={`modal-row-${m.verb.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
              <span className={`text-sm font-bold ${m.colorClass}`}>{m.verb}</span>
              <span className="text-xs text-muted-foreground">— {m.meaning}</span>
              <span className="text-xs text-muted-foreground/60 ml-auto">{m.note}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-2">
              {m.conjugations.map((c, i) => (
                <span key={i} className={`text-xs font-medium ${i === 0 ? m.colorClass : 'text-foreground/70'}`}>{c}</span>
              ))}
            </div>
            <div className="text-xs">
              <span className="font-semibold text-foreground">{m.example}</span>
              <span className="text-muted-foreground ml-2 italic">{m.translation}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-xs text-center text-muted-foreground">
          The <span className="font-medium text-foreground/80">trigger verb</span> is conjugated · the <span className="font-medium text-foreground/80">infinitive stays unchanged</span>
        </p>
      </div>
    </div>
  );
}

// ── Verb Anchor Grid (M4) ─────────────────────────────────────────────────────

interface VerbExample {
  object: string;
  fullPhrase: string;
  translation: string;
}

interface VerbGroup {
  verb: string;
  verbTranslation: string;
  examples: VerbExample[];
}

interface VerbAnchorGridProps {
  groups: VerbGroup[];
  language?: string;
  className?: string;
}

export function VerbAnchorGrid({ groups, language = 'spanish', className = '' }: VerbAnchorGridProps) {
  if (!groups || groups.length === 0) return null;
  return (
    <div className={`space-y-6 ${className}`} data-testid="verb-anchor-grid">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-3" data-testid={`verb-group-${gi}`}>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat2 className="h-3.5 w-3.5 text-primary" />
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">Verb Anchor</Badge>
                </div>
                <div className="text-2xl font-bold text-primary" data-testid={`text-verb-${gi}`}>{group.verb}</div>
                <div className="text-sm text-muted-foreground italic">{group.verbTranslation}</div>
              </div>
              <TextAudioPlayButton text={group.verb} language={language} size="sm" data-testid={`button-play-verb-${gi}`} />
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {group.examples.map((ex, ei) => (
              <Card key={ei} className="hover-elevate" data-testid={`verb-example-${gi}-${ei}`}>
                <CardContent className="p-3 flex flex-col gap-1.5">
                  <div className="text-base font-bold text-primary leading-tight" data-testid={`text-object-${gi}-${ei}`}>
                    {ex.object}
                  </div>
                  <div className="text-xs font-medium leading-snug text-foreground/80" data-testid={`text-full-phrase-${gi}-${ei}`}>
                    {ex.fullPhrase}
                  </div>
                  <div className="text-xs text-muted-foreground">{ex.translation}</div>
                  <TextAudioPlayButton text={ex.fullPhrase} language={language} size="sm" data-testid={`button-play-example-${gi}-${ei}`} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
