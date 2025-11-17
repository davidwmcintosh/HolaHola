import { LanguageSelector } from "../LanguageSelector";

export default function LanguageSelectorExample() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">Full selector:</p>
        <LanguageSelector />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Compact badge:</p>
        <LanguageSelector compact />
      </div>
    </div>
  );
}
