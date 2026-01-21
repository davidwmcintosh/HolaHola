import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Globe, Users, BookOpen, Lightbulb } from "lucide-react";

import familyGatheringImg from "@assets/stock_images/family_gathering_aro_0f321ed1.jpg";
import coffeeShopImg from "@assets/stock_images/coffee_shop_friends__69e794a8.jpg";
import danielaTutorImg from "@assets/generated_images/daniela_tutor_welcome_illustration.png";
import greetingsInfographicImg from "@assets/generated_images/spanish_greetings_time_infographic.png";
import numbersVocabImg from "@assets/generated_images/spanish_numbers_vocabulary_card.png";
import familyTreeImg from "@assets/generated_images/spanish_family_vocabulary_tree.png";

interface ChapterIntroductionProps {
  chapterNumber: number;
  language: string;
  className?: string;
}

const chapterContent: Record<number, {
  welcomeText: string;
  narrativeSections: {
    title: string;
    content: string;
    image?: string;
    imageAlt?: string;
    tip?: string;
  }[];
  culturalSpotlight?: {
    title: string;
    content: string;
    image?: string;
  };
}> = {
  1: {
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
        image: greetingsInfographicImg,
        imageAlt: "Spanish greetings throughout the day infographic"
      },
      {
        title: "Formal vs. Informal",
        content: "Spanish distinguishes between formal and informal speech through 'usted' and 'tú'. Think of 'usted' as the respectful distance you'd keep with your boss or an elder, while 'tú' is the comfortable closeness of friends and family.",
        tip: "When in doubt, start formal! It's always better to be too polite than too casual."
      }
    ],
    culturalSpotlight: {
      title: "¡Sobremesa!",
      content: "One of the most beautiful Spanish traditions is 'sobremesa' - the time spent lingering at the table after a meal, just talking and enjoying company. This is where real conversations happen, where bonds are strengthened. No rushing, no checking phones - just connection.",
      image: familyGatheringImg
    }
  },
  2: {
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
        title: "Numbers That Connect",
        content: "From sharing phone numbers to celebrating birthdays, numbers are everywhere in family life. You'll learn to count in Spanish and use numbers naturally in conversation.",
        image: numbersVocabImg,
        imageAlt: "Spanish numbers vocabulary card"
      }
    ],
    culturalSpotlight: {
      title: "Los Apellidos",
      content: "Spanish naming conventions are unique - most people carry two last names: their father's surname followed by their mother's. This tradition honors both sides of the family and helps trace lineage. So 'García López' tells a story of two families joined together.",
      image: familyGatheringImg
    }
  }
};

export function ChapterIntroduction({ chapterNumber, language, className = "" }: ChapterIntroductionProps) {
  const content = chapterContent[chapterNumber];
  
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
      
      {content.narrativeSections.map((section, index) => (
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
              <div className={`flex-1 p-4 md:p-6 ${!section.image ? 'md:max-w-none' : ''}`}>
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
      ))}
      
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
