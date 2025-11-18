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
        <h3 className="font-semibold mb-3">Spaced Repetition System</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Click on the card to flip and see the translation</li>
          <li>• Mark each card as "Correct" or "Incorrect" after reviewing</li>
          <li>• Cards you get right will appear less frequently</li>
          <li>• Cards you struggle with will be reviewed more often</li>
          <li>• Use "Show Due Only" to focus on cards that need review</li>
          <li>• The system optimizes your learning schedule automatically</li>
        </ul>
      </Card>
    </div>
  );
}
