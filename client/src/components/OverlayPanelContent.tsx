import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { SentenceColumnGenerator } from "@/components/SentenceColumnGenerator";
import type { SentenceColumn } from "@/components/SentenceColumnGenerator";
import type { OverlayPanel, OverlayPanelVocabWord } from "@shared/whiteboard-types";
import {
  getBookVerbContent,
  getPreteriteContent,
  getSerContent,
  getHayContent,
  getGustContent,
} from "@/data/madrigal-unit-content";

// ── Vocab image card ──────────────────────────────────────────────────────────

function VocabWordCard({ word, language }: { word: OverlayPanelVocabWord; language: string }) {
  const { data, isLoading } = useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word.text, language, word.imageQuery],
    queryFn: () => {
      const params = new URLSearchParams({ word: word.text, language });
      if (word.imageQuery) params.set("description", word.imageQuery);
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: !word.imageUrl,
    staleTime: 10 * 60 * 1000,
  });

  const imageUrl = word.imageUrl || data?.url;
  const loading = word.isLoading || (!word.imageUrl && isLoading);

  return (
    <div
      className="flex flex-col rounded-lg overflow-hidden border border-white/15 bg-black/30 backdrop-blur-sm"
      data-testid={`vocab-card-${word.text}`}
    >
      <div className="relative w-full aspect-square bg-white/5 flex items-center justify-center">
        {loading ? (
          <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        ) : imageUrl ? (
          <img src={imageUrl} alt={word.text} className="w-full h-full object-contain p-1.5" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/10" />
        )}
      </div>
      <div className="px-2 py-1.5 text-center">
        <p className="text-white text-[11px] font-semibold leading-snug truncate">{word.text}</p>
        <p className="text-white/50 text-[10px] leading-tight truncate">{word.translation}</p>
      </div>
    </div>
  );
}

// ── Vocab grid panel ──────────────────────────────────────────────────────────

function VocabGridPanel({ panel }: { panel: Extract<OverlayPanel, { type: "vocab-grid" }> }) {
  const { language } = useLanguage();
  const cols = panel.words.length <= 4 ? 2 : 3;

  return (
    <div className="flex flex-col h-full">
      {panel.title && (
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2 px-0.5">
          {panel.title}
        </p>
      )}
      <div
        className="grid gap-2 overflow-y-auto flex-1"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        data-testid="vocab-grid-content"
      >
        {panel.words.map((word) => (
          <VocabWordCard key={word.text} word={word} language={language} />
        ))}
      </div>
    </div>
  );
}

// ── Sentence builder panel ────────────────────────────────────────────────────

function SentenceBuilderPanel({
  panel,
}: {
  panel: Extract<OverlayPanel, { type: "sentence-builder" }>;
}) {
  const { language } = useLanguage();

  const columns: SentenceColumn[] = panel.columns.map((col) => ({
    label: col.label,
    items: col.items.map((item) => ({ text: item.text, translation: item.translation })),
  }));

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {panel.patternLabel && (
        <p className="text-white/55 text-[11px] font-mono mb-2 px-0.5 truncate">
          {panel.patternLabel}
        </p>
      )}
      <div className="bg-white/5 rounded-lg p-2.5">
        <SentenceColumnGenerator columns={columns} language={language} />
      </div>
    </div>
  );
}

// ── Textbook section panel ────────────────────────────────────────────────────

function TextbookWordRow({
  word,
  description,
  language,
}: {
  word: string;
  description: string;
  language: string;
}) {
  const { data, isLoading } = useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word, language, description],
    queryFn: () => {
      const params = new URLSearchParams({ word, language });
      if (description) params.set("description", description);
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then(
        (r) => r.json()
      );
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/8 last:border-b-0">
      <div className="w-9 h-9 rounded-md overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="w-3 h-3 text-white/30 animate-spin" />
        ) : data?.url ? (
          <img src={data.url} alt={word} className="w-full h-full object-contain p-0.5" />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-medium leading-tight truncate">{word}</p>
        <p className="text-white/50 text-[11px] leading-tight truncate">{description}</p>
      </div>
    </div>
  );
}

interface VocabEntry {
  word: string;
  description: string;
}

const GUST_CHAPTER_MAP: Record<string, string> = {
  "gustar-me-gusta":        "gustar:",
  "gustaria":               "me gustaría:",
  "fui-i-went":             "fui:",
  "voy-a-infinitive":       "voy a:",
  "va-a-third-person":      "va a:",
  "que-hizo":               "qué hizo",
  "tuvo-he-had":            "tuvo:",
  "le-indirect-object":     "le:",
  "esta-he-is":             "está:",
  "estudie-i-studied":      "estudié:",
  "recibi-i-received":      "recibí:",
  "compraba-imperfect":     "compraba",
  "tengo-catarro":          "tengo catarro",
  "a-que-hora":             "a qué hora",
  "como-esta":              "cómo está",
  "que-esta-haciendo":      "qué está haciendo",
  "me-levanto":             "me levanto",
  "he-comprado":            "he comprado",
  "lo-veo":                 "lo veo",
  "me-lo":                  "me lo",
  "hable-formal-commands":  "hable:",
};

function extractGustVocab(lookupKey: string): VocabEntry[] {
  const c = getGustContent(lookupKey) as any;
  if (!c) return [];
  const entries: VocabEntry[] = [];
  (c.clusters as any[]).forEach((cl: any) => {
    const pairs: any[] = cl.pairs || [];
    pairs.forEach((p: any) => {
      if (p.imageWord) {
        entries.push({ word: p.imageWord, description: p.answerTranslation || p.answer || "" });
      }
    });
  });
  return entries.filter(e => Boolean(e.word));
}

function getTextbookVocab(chapterKey: string): VocabEntry[] {
  const entries: VocabEntry[] = [];

  if (chapterKey === "ir-going-places") {
    const c = getBookVerbContent("ir");
    if (c) c.positiveItems.forEach((i) => entries.push({ word: i.word, description: i.translation }));
  } else if (chapterKey === "tomar-i-took") {
    const c = getPreteriteContent("tomar");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "comprar-i-bought") {
    const c = getPreteriteContent("comprar");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "near-future-voy-a") {
    const c = getPreteriteContent("near future");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "tener-i-have") {
    const c = getPreteriteContent("tener");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "quiero-i-want") {
    const c = getPreteriteContent("quiero");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "ser-plurals-gender") {
    const c = getSerContent("ser");
    if (c) {
      (c.clusters as any[]).forEach((cl: any) => {
        if (Array.isArray(cl.pairs)) {
          cl.pairs.forEach((p: any) =>
            entries.push({ word: p.singular || p.word || "", description: p.singularTranslation || p.translation || "" })
          );
        } else if (Array.isArray(cl.items)) {
          cl.items.forEach((item: any) =>
            entries.push({ word: item.spanish || item.word || "", description: item.english || item.translation || "" })
          );
        }
      });
    }
  } else if (chapterKey === "hay") {
    const c = getHayContent("hay") as any;
    if (c) {
      const clusters: any[] = c.vocabClusters || c.clusters || [];
      clusters.forEach((cl: any) => {
        const items: any[] = cl.items || cl.pairs || [];
        items.forEach((item: any) =>
          entries.push({
            word: item.spanish || item.word || item.text || "",
            description: item.english || item.translation || item.description || "",
          })
        );
      });
    }
  }

  // Gust chapter family — covers all Madrigal chapters not handled above
  const gustLookup = GUST_CHAPTER_MAP[chapterKey];
  if (gustLookup) {
    return extractGustVocab(gustLookup);
  }

  return entries.filter((e) => Boolean(e.word));
}

function TextbookSectionPanel({
  panel,
}: {
  panel: Extract<OverlayPanel, { type: "textbook-section" }>;
}) {
  const { language } = useLanguage();
  const vocab = getTextbookVocab(panel.chapterKey);

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="textbook-section-panel">
      {panel.title && (
        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider mb-2 px-0.5">
          {panel.title}
        </p>
      )}
      {vocab.length === 0 ? (
        <p className="text-white/40 text-xs text-center mt-8">Chapter not available in preview.</p>
      ) : (
        <div>
          {vocab.map((entry, i) => (
            <TextbookWordRow
              key={`${entry.word}-${i}`}
              word={entry.word}
              description={entry.description}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

interface OverlayPanelContentProps {
  panel: OverlayPanel;
  onDismiss: () => void;
}

export function OverlayPanelContent({ panel, onDismiss }: OverlayPanelContentProps) {
  const title = (() => {
    if (panel.type === "vocab-grid") return panel.title || "Vocabulary";
    if (panel.type === "sentence-builder") return panel.title || "Sentence Builder";
    if (panel.type === "textbook-section") return panel.title || panel.chapterKey.replace(/-/g, " ");
    return "Panel";
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute top-0 right-0 bottom-0 z-20 flex flex-col"
      style={{ width: "min(46%, 300px)" }}
      data-testid="overlay-panel"
    >
      <div className="flex flex-col h-full rounded-l-xl bg-black/65 backdrop-blur-md border-l border-t border-b border-white/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 flex-shrink-0">
          <span className="text-white text-xs font-semibold truncate">{title}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 text-white/60 hover:text-white ml-2 flex-shrink-0"
            data-testid="button-dismiss-overlay-panel"
            aria-label="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden px-2.5 py-2.5">
          {panel.type === "vocab-grid" && <VocabGridPanel panel={panel} />}
          {panel.type === "sentence-builder" && <SentenceBuilderPanel panel={panel} />}
          {panel.type === "textbook-section" && <TextbookSectionPanel panel={panel} />}
        </div>
      </div>
    </motion.div>
  );
}
