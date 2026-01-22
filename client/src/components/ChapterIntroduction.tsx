import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Globe, Users, BookOpen, Lightbulb } from "lucide-react";
import { SunArcGreetings, FormalInformalComparison, QuickPhraseGrid } from "./TextbookInfographics";

import familyGatheringImg from "@assets/stock_images/family_gathering_aro_0f321ed1.jpg";
import coffeeShopImg from "@assets/stock_images/coffee_shop_friends__69e794a8.jpg";
import danielaTutorImg from "@assets/generated_images/daniela_tutor_welcome_illustration.png";
import numbersVocabImg from "@assets/generated_images/spanish_numbers_vocabulary_card.png";
import familyTreeImg from "@assets/generated_images/spanish_family_vocabulary_tree.png";

interface ChapterIntroductionProps {
  chapterNumber: number;
  chapterTitle?: string;
  language: string;
  className?: string;
}

interface NarrativeSection {
  title: string;
  content: string;
  image?: string;
  imageAlt?: string;
  tip?: string;
  infographic?: 'sunArcGreetings' | 'formalInformal' | 'quickPhrases';
}

interface ChapterContentData {
  welcomeText: string;
  narrativeSections: NarrativeSection[];
  culturalSpotlight?: {
    title: string;
    content: string;
    image?: string;
  };
}

// Match content by title keywords for flexibility
function getContentByTitle(title: string): ChapterContentData | null {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('greet') || lowerTitle.includes('hello') || lowerTitle.includes('introduction')) {
    return greetingsContent;
  }
  if (lowerTitle.includes('number') || lowerTitle.includes('count')) {
    return numbersContent;
  }
  if (lowerTitle.includes('family') || lowerTitle.includes('familia')) {
    return familyContent;
  }
  if (lowerTitle.includes('review') || lowerTitle.includes('routine') || lowerTitle.includes('daily')) {
    return dailyRoutinesContent;
  }
  return null;
}

const dailyRoutinesContent: ChapterContentData = {
  welcomeText: "Every day is an adventure in Spanish! In this chapter, you'll learn to talk about your daily routines, from waking up to going to bed. These phrases will help you describe your life and connect with others through shared experiences.",
  narrativeSections: [
    {
      title: "A Day in the Life",
      content: "Daily routines are the rhythm of life. In Spanish, we use reflexive verbs to describe many personal activities: 'Me despierto' (I wake up), 'Me levanto' (I get up), 'Me ducho' (I shower). Notice how 'me' reflects the action back to yourself.",
      infographic: 'sunArcGreetings',
      tip: "Reflexive verbs always pair with pronouns: me, te, se, nos, os, se. Think of them as 'self' actions!"
    },
    {
      title: "Time and Schedule",
      content: "Talking about when things happen is essential for daily routines. 'Por la mañana' (in the morning), 'por la tarde' (in the afternoon), 'por la noche' (at night). Add specific times with '¿A qué hora?' (At what time?) to make plans and keep schedules.",
      tip: "Spanish often uses 12-hour time in conversation, but 24-hour time for schedules and transportation."
    },
    {
      title: "Common Routine Phrases",
      content: "Master these everyday expressions to describe your day naturally. From 'Desayuno a las ocho' (I have breakfast at eight) to 'Me acuesto temprano' (I go to bed early), these phrases will become second nature.",
      infographic: 'quickPhrases'
    }
  ],
  culturalSpotlight: {
    title: "La Siesta",
    content: "While the traditional midday siesta is becoming less common in modern cities, many Spanish-speaking countries still embrace a slower pace of life. Shops may close between 2-5 PM, and late dinners (9-10 PM) are the norm. Understanding these rhythms helps you adapt to local schedules!",
    image: coffeeShopImg
  }
};

const greetingsContent: ChapterContentData = {
  welcomeText: "Welcome to your Spanish journey! In this chapter, you'll learn the essential building blocks of Spanish conversation - greetings, introductions, and the art of making a great first impression.",
  narrativeSections: [
    {
      title: "The Art of Greeting",
      content: "In Spanish-speaking cultures, greetings are more than just words - they're a warm embrace of connection. Unlike quick 'hi and bye' exchanges, Spanish greetings often come with genuine warmth: a kiss on the cheek among friends, a firm handshake in business, and always, always eye contact.",
      image: coffeeShopImg,
      imageAlt: "Friends having coffee and conversation",
      tip: "Pro tip: In most Latin American countries, a single kiss on the cheek is common. In Spain, it's usually two!"
    },
    {
      title: "Time Matters",
      content: "Spanish has different greetings for different times of day. 'Buenos días' greets the morning sun, 'Buenas tardes' welcomes the afternoon, and 'Buenas noches' embraces the evening. Pay attention to when the sun is in the sky!",
      infographic: 'sunArcGreetings'
    },
    {
      title: "Formal vs. Informal",
      content: "Spanish distinguishes between formal and informal speech through 'usted' and 'tú'. Think of 'usted' as the respectful distance you'd keep with your boss or an elder, while 'tú' is the comfortable closeness of friends and family.",
      infographic: 'formalInformal',
      tip: "When in doubt, start formal! It's always better to be too polite than too casual."
    }
  ],
  culturalSpotlight: {
    title: "¡Sobremesa!",
    content: "One of the most beautiful Spanish traditions is 'sobremesa' - the time spent lingering at the table after a meal, just talking and enjoying company. This is where real conversations happen, where bonds are strengthened. No rushing, no checking phones - just connection.",
    image: familyGatheringImg
  }
};

const numbersContent: ChapterContentData = {
  welcomeText: "Numbers are the universal language! In this chapter, you'll master counting in Spanish from zero to a million. Whether you're shopping, telling time, or sharing your phone number, numbers will become second nature.",
  narrativeSections: [
    {
      title: "Counting from Zero",
      content: "Spanish numbers follow patterns that make them easier to learn than you might think. Start with uno, dos, tres and build from there. The first fifteen numbers are unique, but after that, predictable patterns emerge that will help you count to infinity!",
      image: numbersVocabImg,
      imageAlt: "Spanish numbers vocabulary card",
      tip: "Notice that 'uno' becomes 'un' before masculine nouns: 'un libro' (one book), but stays 'una' for feminine: 'una mesa' (one table)."
    },
    {
      title: "Numbers in Daily Life",
      content: "From asking '¿Cuánto cuesta?' (How much does it cost?) to giving your phone number digit by digit, numbers appear everywhere. Practice by counting everyday objects, reading prices, or doing simple math problems in Spanish.",
      tip: "When giving phone numbers in Spanish, people often say digits in pairs: 55-12-34 instead of 5-5-1-2-3-4."
    }
  ],
  culturalSpotlight: {
    title: "El Regateo (Bargaining)",
    content: "In many Spanish-speaking countries, bargaining is an art form, especially in markets and small shops. Knowing your numbers well gives you confidence to negotiate prices. Start by asking 'Me puede hacer un descuento?' (Can you give me a discount?) and see where the conversation goes!"
  }
};

const familyContent: ChapterContentData = {
  welcomeText: "Family is at the heart of Spanish-speaking culture. In this chapter, you'll learn to talk about your loved ones and understand the beautiful, sometimes complex, family structures that define Latin identity.",
  narrativeSections: [
    {
      title: "La Familia",
      content: "In Spanish-speaking cultures, 'family' often extends far beyond the nuclear unit. Cousins might be as close as siblings, and 'tíos' (aunts and uncles) play significant roles in raising children. The vocabulary reflects this richness.",
      image: familyTreeImg,
      imageAlt: "Spanish family vocabulary tree",
      tip: "Many Spanish speakers use 'tío/tía' affectionately for close friends too - it's like calling someone 'dude' or 'hon'!"
    },
    {
      title: "Extended Family Bonds",
      content: "Spanish has specific words for family relationships that English groups together. 'Suegra' is mother-in-law, 'cuñado' is brother-in-law, and 'compadre' describes a special bond between godparents and parents.",
      image: familyGatheringImg,
      imageAlt: "Family gathering"
    }
  ],
  culturalSpotlight: {
    title: "Los Apellidos",
    content: "Spanish naming conventions are unique - most people carry two last names: their father's surname followed by their mother's. This tradition honors both sides of the family and helps trace lineage. So 'García López' tells a story of two families joined together.",
    image: familyGatheringImg
  }
};

export function ChapterIntroduction({ chapterNumber, chapterTitle, language, className = "" }: ChapterIntroductionProps) {
  // Try to match content by title first (more accurate), fall back to number
  const content = chapterTitle ? getContentByTitle(chapterTitle) : null;
  
  if (!content || language !== "spanish") {
    return null;
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-transparent" data-testid="card-daniela-introduction">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-start gap-4">
            <div className="hidden md:block flex-shrink-0">
              <img 
                src={danielaTutorImg} 
                alt="Daniela, your Spanish tutor" 
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/20"
                data-testid="img-daniela-avatar"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400" data-testid="text-daniela-intro-label">Daniela's Introduction</span>
              </div>
              <p className="text-muted-foreground leading-relaxed" data-testid="text-welcome-message">
                {content.welcomeText}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {content.narrativeSections.map((section, index) => {
        const hasVisual = section.image || section.infographic;
        
        const renderInfographic = () => {
          switch (section.infographic) {
            case 'sunArcGreetings':
              return <SunArcGreetings className="w-full" />;
            case 'formalInformal':
              return (
                <FormalInformalComparison 
                  className="w-full"
                  items={[
                    { formal: "¿Cómo está usted?", informal: "¿Cómo estás?", context: "How are you?" },
                    { formal: "Mucho gusto", informal: "¡Hola!", context: "Nice to meet you / Hi!" },
                    { formal: "Con permiso", informal: "Oye", context: "Excuse me / Hey" },
                  ]}
                />
              );
            case 'quickPhrases':
              return (
                <QuickPhraseGrid 
                  className="w-full"
                  phrases={[
                    { phrase: "Hola", meaning: "Hello" },
                    { phrase: "Adiós", meaning: "Goodbye" },
                    { phrase: "Por favor", meaning: "Please" },
                    { phrase: "Gracias", meaning: "Thank you" },
                  ]}
                />
              );
            default:
              return null;
          }
        };
        
        return (
          <Card key={index} className="overflow-hidden" data-testid={`card-narrative-section-${index}`}>
            <CardContent className="p-0">
              <div className={`flex flex-col ${index % 2 === 1 ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                {section.image && (
                  <div className="md:w-2/5 flex-shrink-0">
                    <img 
                      src={section.image} 
                      alt={section.imageAlt || section.title}
                      className="w-full h-48 md:h-full object-cover"
                      data-testid={`img-narrative-${index}`}
                    />
                  </div>
                )}
                {section.infographic && (
                  <div className="md:w-2/5 flex-shrink-0 p-4 bg-muted/20 flex items-center justify-center" data-testid={`infographic-${index}`}>
                    {renderInfographic()}
                  </div>
                )}
                <div className={`flex-1 p-4 md:p-6 ${!hasVisual ? 'md:max-w-none' : ''}`}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2" data-testid={`text-narrative-title-${index}`}>
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    {section.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    {section.content}
                  </p>
                  {section.tip && (
                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20" data-testid={`tip-section-${index}`}>
                      <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>{section.tip}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {content.culturalSpotlight && (
        <Card className="overflow-hidden border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent" data-testid="card-cultural-spotlight">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="border-purple-500/30 text-purple-600 dark:text-purple-400" data-testid="badge-cultural-spotlight">
                <Globe className="h-3 w-3 mr-1" />
                Cultural Spotlight
              </Badge>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              {content.culturalSpotlight.image && (
                <div className="md:w-1/3 flex-shrink-0">
                  <img 
                    src={content.culturalSpotlight.image} 
                    alt="Cultural context"
                    className="w-full h-48 md:h-40 object-cover rounded-lg"
                    data-testid="img-cultural-spotlight"
                  />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2" data-testid="text-cultural-title">
                  {content.culturalSpotlight.title}
                </h4>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-cultural-content">
                  {content.culturalSpotlight.content}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <Users className="h-4 w-4" />
        <span>Now let's explore the lessons below and start practicing!</span>
      </div>
    </div>
  );
}

export default ChapterIntroduction;
