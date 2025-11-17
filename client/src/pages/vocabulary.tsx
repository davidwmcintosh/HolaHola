import { VocabularyFlashcard } from "@/components/VocabularyFlashcard";
import { LanguageSelector } from "@/components/LanguageSelector";
import { Card } from "@/components/ui/card";

export default function Vocabulary() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Vocabulary Practice</h1>
          <p className="text-muted-foreground">Build your vocabulary with interactive flashcards</p>
        </div>
        <LanguageSelector compact />
      </div>

      <div className="max-w-2xl mx-auto">
        <VocabularyFlashcard />
      </div>

      <Card className="p-6 max-w-2xl mx-auto">
        <h3 className="font-semibold mb-3">How it works</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Click on the card to flip and see the translation</li>
          <li>• Use arrow buttons or keyboard arrows to navigate</li>
          <li>• Practice regularly for better retention</li>
          <li>• Words are selected based on your difficulty level</li>
        </ul>
      </Card>
    </div>
  );
}
