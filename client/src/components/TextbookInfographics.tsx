import { TextAudioPlayButton } from "@/components/AudioPlayButton";

interface SunArcGreetingsProps {
  className?: string;
  morning?: string;
  afternoon?: string;
  evening?: string;
}

export function SunArcGreetings({ className = '', morning = 'Buenos días', afternoon = 'Buenas tardes', evening = 'Buenas noches' }: SunArcGreetingsProps) {
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
}

export function FormalInformalComparison({ 
  title = "Formal vs. Informal", 
  items,
  className = '' 
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
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-2 gap-2">
            <div className="bg-primary/5 rounded-md p-2 text-center">
              <p className="font-medium text-sm">{item.formal}</p>
            </div>
            <div className="bg-amber-500/5 rounded-md p-2 text-center">
              <p className="font-medium text-sm">{item.informal}</p>
            </div>
            {item.context && (
              <p className="col-span-2 text-xs text-muted-foreground text-center -mt-1">
                {item.context}
              </p>
            )}
          </div>
        ))}
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
}

export function QuickPhraseGrid({ 
  phrases, 
  columns = 2,
  className = '' 
}: QuickPhraseGridProps) {
  return (
    <div className={`grid gap-2 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} ${className}`}>
      {phrases.map((item, index) => (
        <div 
          key={index} 
          className="rounded-md border bg-card p-3 text-center hover-elevate cursor-pointer"
          data-testid={`phrase-card-${index}`}
        >
          <p className="font-semibold text-sm">{item.phrase}</p>
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
      <div className={`aspect-[4/3] ${backgroundColor} flex items-center justify-center`}>
        {imageUrl ? (
          <img src={imageUrl} alt={word} className="w-full h-full object-cover" />
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
  
  if (lessonType === 'conversation' && conversationTopic) {
    tips.push(`Think about your own experience with: ${conversationTopic}`);
    tips.push(`Daniela will guide you \u2014 just try to respond in ${langDisplay}!`);
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

interface LessonPrepCardProps {
  objectives?: string[];
  drills?: DrillItem[];
  conversationTopic?: string;
  lessonType: string;
  language?: string;
  className?: string;
}

export function LessonPrepCard({
  objectives,
  drills = [],
  conversationTopic,
  lessonType,
  language,
  className = ''
}: LessonPrepCardProps) {
  const langDisplay = language ? language.charAt(0).toUpperCase() + language.slice(1) : 'the target language';
  
  const vocabDrills = drills
    .filter(d => d.itemType === 'listen_repeat' || d.itemType === 'translate_speak')
    .filter(d => d.targetText && d.targetText.length < 50)
    .slice(0, 6);
  
  const phraseDrills = drills
    .filter(d => d.targetText && d.targetText.split(' ').length >= 2)
    .slice(0, 4);

  const conversationScriptLines = conversationTopic ? drills
    .filter(d => d.targetText && d.prompt)
    .slice(0, 3)
    .map((d, i) => ({
      speaker: i % 2 === 0 ? 'Daniela' as const : 'You' as const,
      line: d.targetText,
      translation: d.prompt,
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
              Daniela will guide you. Just try to respond in {langDisplay}!
            </p>
          </div>
        )}
        
        {hasVocab && (
          <div data-testid="prep-vocabulary">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Key Vocabulary
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {vocabDrills.map((drill, i) => {
                const hasTranslation = drill.prompt && drill.prompt !== drill.targetText;
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
                        <p className="text-xs text-muted-foreground truncate">{drill.prompt}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
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
                const hasTranslation = drill.prompt && drill.prompt !== drill.targetText;
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
                        <p className="text-xs text-muted-foreground">{drill.prompt}</p>
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
