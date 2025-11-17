import { GrammarExercise } from "@/components/GrammarExercise";
import { LanguageSelector } from "@/components/LanguageSelector";

export default function Grammar() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Grammar Exercises</h1>
          <p className="text-muted-foreground">Master grammar rules with interactive practice</p>
        </div>
        <LanguageSelector compact />
      </div>

      <div className="max-w-2xl mx-auto">
        <GrammarExercise />
      </div>
    </div>
  );
}
