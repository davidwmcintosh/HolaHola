import { useState } from "react";
import { Button } from "@/components/ui/button";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface DifficultySelectorProps {
  value?: DifficultyLevel;
  onChange?: (level: DifficultyLevel) => void;
}

export function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  const [selected, setSelected] = useState<DifficultyLevel>(value || "beginner");

  const handleSelect = (level: DifficultyLevel) => {
    setSelected(level);
    onChange?.(level);
    console.log(`Difficulty changed to: ${level}`);
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
          variant={selected === level.value ? "default" : "outline"}
          onClick={() => handleSelect(level.value)}
          data-testid={`button-difficulty-${level.value}`}
        >
          {level.label}
        </Button>
      ))}
    </div>
  );
}
