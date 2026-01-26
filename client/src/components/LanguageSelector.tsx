import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/lib/auth";

const publicLanguages = [
  { value: "spanish", label: "Spanish", flag: "🇪🇸" },
  { value: "french", label: "French", flag: "🇫🇷" },
  { value: "german", label: "German", flag: "🇩🇪" },
  { value: "italian", label: "Italian", flag: "🇮🇹" },
  { value: "portuguese", label: "Portuguese", flag: "🇵🇹" },
  { value: "japanese", label: "Japanese", flag: "🇯🇵" },
  { value: "mandarin", label: "Mandarin", flag: "🇨🇳" },
  { value: "korean", label: "Korean", flag: "🇰🇷" },
];

const hiddenLanguages = [
  { value: "hebrew", label: "Hebrew", flag: "🇮🇱" },
];

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const { isDeveloper, isAdmin } = useUser();
  
  const languages = isDeveloper || isAdmin 
    ? [...publicLanguages, ...hiddenLanguages]
    : publicLanguages;

  const handleChange = (newValue: string) => {
    setLanguage(newValue);
  };

  const allLanguages = [...publicLanguages, ...hiddenLanguages];
  const selectedLanguage = allLanguages.find((lang) => lang.value === language);

  if (compact && selectedLanguage) {
    return (
      <Badge variant="secondary" className="text-sm" data-testid="badge-current-language">
        <span className="mr-2">{selectedLanguage.flag}</span>
        {selectedLanguage.label}
      </Badge>
    );
  }

  return (
    <Select value={language} onValueChange={handleChange}>
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
