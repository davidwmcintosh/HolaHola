import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const languages = [
  { value: "spanish", label: "Spanish", flag: "🇪🇸" },
  { value: "french", label: "French", flag: "🇫🇷" },
  { value: "german", label: "German", flag: "🇩🇪" },
  { value: "italian", label: "Italian", flag: "🇮🇹" },
  { value: "portuguese", label: "Portuguese", flag: "🇵🇹" },
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "mandarin", label: "Mandarin", flag: "🇨🇳" },
  { value: "korean", label: "Korean", flag: "🇰🇷" },
];

interface LanguageSelectorProps {
  value?: string;
  onChange?: (language: string) => void;
  compact?: boolean;
}

export function LanguageSelector({ value, onChange, compact = false }: LanguageSelectorProps) {
  const [selected, setSelected] = useState(value || "spanish");

  const handleChange = (newValue: string) => {
    setSelected(newValue);
    onChange?.(newValue);
    console.log(`Language changed to: ${newValue}`);
  };

  const selectedLanguage = languages.find((lang) => lang.value === selected);

  if (compact && selectedLanguage) {
    return (
      <Badge variant="secondary" className="text-sm" data-testid="badge-current-language">
        <span className="mr-2">{selectedLanguage.flag}</span>
        {selectedLanguage.label}
      </Badge>
    );
  }

  return (
    <Select value={selected} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]" data-testid="select-language">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.value} value={lang.value} data-testid={`option-language-${lang.value}`}>
            <span className="mr-2">{lang.flag}</span>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
