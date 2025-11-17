import { Button } from "@/components/ui/button";

interface AccentButtonsProps {
  language: string;
  onInsert: (character: string) => void;
}

const ACCENT_CHARACTERS: Record<string, { char: string; label: string }[]> = {
  spanish: [
    { char: 'á', label: 'a with acute accent' },
    { char: 'é', label: 'e with acute accent' },
    { char: 'í', label: 'i with acute accent' },
    { char: 'ó', label: 'o with acute accent' },
    { char: 'ú', label: 'u with acute accent' },
    { char: 'ñ', label: 'n with tilde' },
    { char: 'ü', label: 'u with diaeresis' },
    { char: '¿', label: 'inverted question mark' },
    { char: '¡', label: 'inverted exclamation mark' },
  ],
  french: [
    { char: 'à', label: 'a with grave accent' },
    { char: 'â', label: 'a with circumflex' },
    { char: 'ç', label: 'c with cedilla' },
    { char: 'é', label: 'e with acute accent' },
    { char: 'è', label: 'e with grave accent' },
    { char: 'ê', label: 'e with circumflex' },
    { char: 'ë', label: 'e with diaeresis' },
    { char: 'î', label: 'i with circumflex' },
    { char: 'ï', label: 'i with diaeresis' },
    { char: 'ô', label: 'o with circumflex' },
    { char: 'ù', label: 'u with grave accent' },
    { char: 'û', label: 'u with circumflex' },
    { char: 'ü', label: 'u with diaeresis' },
  ],
  german: [
    { char: 'ä', label: 'a with umlaut' },
    { char: 'ö', label: 'o with umlaut' },
    { char: 'ü', label: 'u with umlaut' },
    { char: 'ß', label: 'sharp s (eszett)' },
    { char: 'Ä', label: 'capital A with umlaut' },
    { char: 'Ö', label: 'capital O with umlaut' },
    { char: 'Ü', label: 'capital U with umlaut' },
  ],
  italian: [
    { char: 'à', label: 'a with grave accent' },
    { char: 'è', label: 'e with grave accent' },
    { char: 'é', label: 'e with acute accent' },
    { char: 'ì', label: 'i with grave accent' },
    { char: 'í', label: 'i with acute accent' },
    { char: 'ò', label: 'o with grave accent' },
    { char: 'ó', label: 'o with acute accent' },
    { char: 'ù', label: 'u with grave accent' },
    { char: 'ú', label: 'u with acute accent' },
  ],
  portuguese: [
    { char: 'á', label: 'a with acute accent' },
    { char: 'â', label: 'a with circumflex' },
    { char: 'ã', label: 'a with tilde' },
    { char: 'à', label: 'a with grave accent' },
    { char: 'ç', label: 'c with cedilla' },
    { char: 'é', label: 'e with acute accent' },
    { char: 'ê', label: 'e with circumflex' },
    { char: 'í', label: 'i with acute accent' },
    { char: 'ó', label: 'o with acute accent' },
    { char: 'ô', label: 'o with circumflex' },
    { char: 'õ', label: 'o with tilde' },
    { char: 'ú', label: 'u with acute accent' },
  ],
  japanese: [
    { char: 'ā', label: 'a with macron (long vowel)' },
    { char: 'ī', label: 'i with macron (long vowel)' },
    { char: 'ū', label: 'u with macron (long vowel)' },
    { char: 'ē', label: 'e with macron (long vowel)' },
    { char: 'ō', label: 'o with macron (long vowel)' },
  ],
  mandarin: [
    { char: 'ā', label: 'a with first tone (flat)' },
    { char: 'á', label: 'a with second tone (rising)' },
    { char: 'ǎ', label: 'a with third tone (falling-rising)' },
    { char: 'à', label: 'a with fourth tone (falling)' },
    { char: 'ē', label: 'e with first tone' },
    { char: 'é', label: 'e with second tone' },
    { char: 'ě', label: 'e with third tone' },
    { char: 'è', label: 'e with fourth tone' },
    { char: 'ī', label: 'i with first tone' },
    { char: 'í', label: 'i with second tone' },
    { char: 'ǐ', label: 'i with third tone' },
    { char: 'ì', label: 'i with fourth tone' },
    { char: 'ō', label: 'o with first tone' },
    { char: 'ó', label: 'o with second tone' },
    { char: 'ǒ', label: 'o with third tone' },
    { char: 'ò', label: 'o with fourth tone' },
    { char: 'ū', label: 'u with first tone' },
    { char: 'ú', label: 'u with second tone' },
    { char: 'ǔ', label: 'u with third tone' },
    { char: 'ù', label: 'u with fourth tone' },
    { char: 'ü', label: 'u with umlaut' },
    { char: 'ǖ', label: 'u with umlaut first tone' },
    { char: 'ǘ', label: 'u with umlaut second tone' },
    { char: 'ǚ', label: 'u with umlaut third tone' },
    { char: 'ǜ', label: 'u with umlaut fourth tone' },
  ],
  korean: [],
};

export function AccentButtons({ language, onInsert }: AccentButtonsProps) {
  const characters = ACCENT_CHARACTERS[language.toLowerCase()] || [];

  if (characters.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {characters.map(({ char, label }) => (
        <Button
          key={char}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onInsert(char)}
          aria-label={`Insert ${label}`}
          title={label}
          data-testid={`button-accent-${char}`}
        >
          {char}
        </Button>
      ))}
    </div>
  );
}
