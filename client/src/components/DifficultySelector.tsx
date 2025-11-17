import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export function DifficultySelector() {
  const { difficulty, setDifficulty } = useLanguage();

  const handleSelect = (level: DifficultyLevel) => {
    setDifficulty(level);
  };

  const levels: { value: DifficultyLevel; label: string }[] = [
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
  ];

  return (
    <div className="flex gap-2">
      {levels.map((level) => (
        <Button
          key={level.value}
          variant={difficulty === level.value ? "default" : "outline"}
          onClick={() => handleSelect(level.value)}
          data-testid={`button-difficulty-${level.value}`}
        >
          {level.label}
        </Button>
      ))}
    </div>
  );
}
