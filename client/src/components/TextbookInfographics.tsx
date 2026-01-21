interface SunArcGreetingsProps {
  className?: string;
}

export function SunArcGreetings({ className = '' }: SunArcGreetingsProps) {
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
            Buenos días
          </text>
          <text x="60" y="173" textAnchor="middle" className="fill-muted-foreground text-xs">
            morning
          </text>
        </g>
        
        <g className="text-xs">
          <text x="200" y="100" textAnchor="middle" className="fill-foreground font-semibold text-sm">
            Buenas tardes
          </text>
          <text x="200" y="113" textAnchor="middle" className="fill-muted-foreground text-xs">
            afternoon
          </text>
        </g>
        
        <g className="text-xs">
          <text x="340" y="160" textAnchor="middle" className="fill-foreground font-semibold text-sm">
            Buenas noches
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

export const SAMPLE_GREETINGS_DATA = {
  formalInformal: [
    { formal: "Usted", informal: "Tú", context: '"you" - addressing someone' },
    { formal: "¿Cómo está?", informal: "¿Cómo estás?", context: '"How are you?"' },
    { formal: "Mucho gusto", informal: "¡Hola!", context: "meeting someone" },
  ],
  nameExchange: [
    { speaker: 'A' as const, text: "¡Hola! ¿Cómo te llamas?", translation: "Hi! What's your name?" },
    { speaker: 'B' as const, text: "Me llamo María. ¿Y tú?", translation: "My name is María. And you?" },
    { speaker: 'A' as const, text: "Soy Carlos. ¡Mucho gusto!", translation: "I'm Carlos. Nice to meet you!" },
    { speaker: 'B' as const, text: "¡Igualmente!", translation: "Likewise!" },
  ],
  quickPhrases: [
    { phrase: "¡Hola!", meaning: "Hello!" },
    { phrase: "¡Adiós!", meaning: "Goodbye!" },
    { phrase: "Por favor", meaning: "Please" },
    { phrase: "Gracias", meaning: "Thank you" },
    { phrase: "De nada", meaning: "You're welcome" },
    { phrase: "Perdón", meaning: "Excuse me/Sorry" },
  ]
};
