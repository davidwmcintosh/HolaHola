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
import { Globe } from "lucide-react";

const publicLanguages = [
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "japanese", label: "Japanese" },
  { value: "mandarin", label: "Mandarin" },
  { value: "korean", label: "Korean" },
  { value: "english", label: "English" },
];

const hiddenLanguages = [
  { value: "hebrew", label: "Hebrew" },
];

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();
  const { isDeveloper, isAdmin, isLoading, user } = useUser();
  
  // Show hidden languages if user is developer or admin (wait for auth to load)
  const hasPrivilegedAccess = !isLoading && (isDeveloper || isAdmin);
  
  // Debug logging for Hebrew visibility issue (dev only)
  if (user && import.meta.env.DEV) {
    console.log('[LanguageSelector] User role:', user.role, '| isAdmin:', isAdmin, '| isDeveloper:', isDeveloper, '| hasPrivilegedAccess:', hasPrivilegedAccess);
  }
  
  const languages = hasPrivilegedAccess
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
        <Globe className="w-3 h-3 mr-1.5" />
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
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
