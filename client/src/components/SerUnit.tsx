/**
 * SerUnit.tsx
 * Renderer for Madrigal's gender & plurals chapter (ser, el/la/los/las).
 * Source: Madrigal pp. 64–71.
 *
 * Cluster types:
 *   article-pairs       — el/los and la/las image cards with singular/plural labels
 *   es-son-sentences    — two-column sentence cards (singular | plural)
 *   ser-qa              — Q&A image cards (¿Son bonitos…? / Sí, son bonitos.)
 *   consonant-plural    — image pairs + word list + -al vocabulary
 *   adjective-expressions — adjective pairs + ¡Eso es! expressions
 */

import { useRef, useLayoutEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Volume2, Loader2, MessageCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { MadrigalAnchorBlock, MadrigalNote } from "@/components/MadrigalPageComponents";
import type {
  SerUnitContent,
  SerCluster,
  DualFormPair,
} from "@/data/madrigal-unit-content";
import type { PreteriteQACard } from "@/data/madrigal-unit-content";

// ── Local hooks ───────────────────────────────────────────────────────────────

function useWordImage(word: string | undefined, language: string, description?: string) {
  return useQuery<{ url: string | null }>({
    queryKey: ["/api/vocab-image/by-word", word ?? "", language, description ?? ""],
    queryFn: () => {
      const params = new URLSearchParams({ word: word ?? "", language });
      if (description) params.set("description", description);
      return fetch(`/api/vocab-image/by-word?${params.toString()}`, { credentials: "include" }).then((r) => r.json());
    },
    enabled: !!word,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

function useTTSButton(language: string, gender: string) {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(async (text: string, key: string) => {
    if (playingKey === key) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingKey(key);
    try {
      const res = await apiRequest("POST", "/api/tts/pronunciation", { text, language, gender });
      const { audioUrl } = await res.json();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlayingKey(null); audioRef.current = null; };
      audio.onerror = () => { setPlayingKey(null); audioRef.current = null; };
      audio.play();
    } catch {
      setPlayingKey(null);
    }
  }, [language, gender, playingKey]);

  return { playingKey, play };
}

// ── PageRule ──────────────────────────────────────────────────────────────────

function PageRule() {
  return <hr className="border-dashed border-border/50 my-1" />;
}

// ── DualFormCard ──────────────────────────────────────────────────────────────
// One image card with singular form on left and plural form on right.

function DualFormCard({
  pair,
  language,
  tutorGender,
}: {
  pair: DualFormPair;
  language: string;
  tutorGender: string;
}) {
  const { data: imageData } = useWordImage(pair.imageWord, language, pair.imageDescription);
  const { playingKey, play } = useTTSButton(language, tutorGender);
  const lKey = `L-${pair.imageWord}`;
  const rKey = `R-${pair.imageWord}`;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`dual-form-card-${pair.imageWord}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden">
        {imageData?.url ? (
          <img
            src={imageData.url}
            alt={pair.imageWord}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Two-column labels */}
      <div className="grid grid-cols-2 divide-x border-t">
        {/* Left: singular */}
        <div className="flex flex-col items-center px-2 pt-1.5 pb-2 text-center gap-0.5">
          <p
            className="text-sm font-semibold leading-snug"
            data-testid={`text-singular-${pair.imageWord}`}
          >
            {pair.leftLabel}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {pair.leftTranslation}
          </p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => play(pair.leftLabel, lKey)}
            disabled={playingKey === lKey}
            data-testid={`button-tts-singular-${pair.imageWord}`}
            title={`Hear "${pair.leftLabel}"`}
          >
            {playingKey === lKey
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Right: plural */}
        <div className="flex flex-col items-center px-2 pt-1.5 pb-2 text-center gap-0.5">
          <p
            className="text-sm font-semibold leading-snug"
            data-testid={`text-plural-${pair.imageWord}`}
          >
            {pair.rightLabel}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {pair.rightTranslation}
          </p>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => play(pair.rightLabel, rKey)}
            disabled={playingKey === rKey}
            data-testid={`button-tts-plural-${pair.imageWord}`}
            title={`Hear "${pair.rightLabel}"`}
          >
            {playingKey === rKey
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── DualFormGrid ──────────────────────────────────────────────────────────────

function DualFormGrid({ pairs, language, tutorGender }: { pairs: DualFormPair[]; language: string; tutorGender: string }) {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="dual-form-grid">
      {pairs.map((pair, i) => (
        <DualFormCard key={`${pair.imageWord}-${i}`} pair={pair} language={language} tutorGender={tutorGender} />
      ))}
    </div>
  );
}

// ── SerQACardItem ─────────────────────────────────────────────────────────────
// Individual Q&A card for ser (¿Son bonitos? / Sí, son bonitos.)

function SerQACardItem({
  card,
  cardIndex,
  language,
  tutorGender,
}: {
  card: PreteriteQACard;
  cardIndex: number;
  language: string;
  tutorGender: string;
}) {
  const { data: imageData } = useWordImage(card.imageWord, language, card.imageDescription);
  const { playingKey, play } = useTTSButton(language, tutorGender);
  const testId = `${card.imageWord}-${cardIndex}`;
  const qKey = `q-${testId}`;
  const aKey = `a-${testId}`;

  return (
    <div
      className="rounded-md border bg-card flex flex-col overflow-hidden"
      data-testid={`ser-qa-card-${testId}`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden">
        {imageData?.url ? (
          <img
            src={imageData.url}
            alt={card.imageWord}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Question */}
      <div className="flex flex-col items-center px-2 pt-2 pb-1 text-center gap-0.5 border-b border-border/30">
        <p
          className="text-sm font-medium leading-snug"
          data-testid={`text-question-${testId}`}
        >
          {card.question}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">
          {card.questionTranslation}
        </p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.question, qKey)}
          disabled={playingKey === qKey}
          data-testid={`button-play-question-${testId}`}
          title={`Hear "${card.question}"`}
        >
          {playingKey === qKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Answer */}
      <div className="flex flex-col items-center px-2 pt-1.5 pb-2 text-center gap-0.5">
        <p
          className="text-sm font-medium leading-snug"
          data-testid={`text-answer-${testId}`}
        >
          {card.answer}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">
          {card.answerTranslation}
        </p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.answer, aKey)}
          disabled={playingKey === aKey}
          data-testid={`button-play-answer-${testId}`}
          title={`Hear "${card.answer}"`}
        >
          {playingKey === aKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ── SerQAGrid ─────────────────────────────────────────────────────────────────

function SerQAGrid({ cards, language }: { cards: PreteriteQACard[]; language: string }) {
  const { tutorGender } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="ser-qa-grid">
      {cards.map((card, i) => (
        <SerQACardItem
          key={`${card.imageWord}-${i}`}
          card={card}
          cardIndex={i}
          language={language}
          tutorGender={tutorGender}
        />
      ))}
    </div>
  );
}

// ── Cluster renderers ─────────────────────────────────────────────────────────

function ArticlePairsCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'article-pairs' }>;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Article header pill */}
      <div className="flex items-center gap-3">
        <span className="text-5xl font-bold tracking-tight">
          {cluster.articleSingular} / {cluster.articlePlural}
        </span>
      </div>

      <MadrigalNote text={cluster.pluralRule} />
      <DualFormGrid pairs={cluster.pairs} language={language} tutorGender={tutorGender} />
      <MadrigalNote text={cluster.footerNote} />
    </div>
  );
}

function EsSonSentencesCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'es-son-sentences' }>;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {cluster.anchorItems && cluster.anchorItems.length > 0 && (
        <MadrigalAnchorBlock items={cluster.anchorItems} />
      )}
      <DualFormGrid pairs={cluster.pairs} language={language} tutorGender={tutorGender} />
    </div>
  );
}

function SerQACluster({
  cluster,
  language,
}: {
  cluster: Extract<SerCluster, { type: 'ser-qa' }>;
  language: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {cluster.anchorItems && cluster.anchorItems.length > 0 && (
        <MadrigalAnchorBlock items={cluster.anchorItems} />
      )}
      <SerQAGrid cards={cluster.cards} language={language} />
      {cluster.noteAfter && <MadrigalNote text={cluster.noteAfter} />}
    </div>
  );
}

function ConsonantPluralCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'consonant-plural' }>;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <MadrigalNote text={cluster.pluralRule} />

      {/* Image pairs for doctor / flor */}
      <DualFormGrid pairs={cluster.imagePairs} language={language} tutorGender={tutorGender} />

      {/* Word list table */}
      <div className="rounded-md border bg-card overflow-hidden" data-testid="consonant-word-table">
        {cluster.wordList.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-2 divide-x text-sm ${i < cluster.wordList.length - 1 ? 'border-b' : ''}`}
          >
            <div className="px-4 py-2 font-medium">{row.singular}</div>
            <div className="px-4 py-2 font-medium">{row.plural}</div>
          </div>
        ))}
      </div>

      <MadrigalNote text={cluster.wordListNote} />

      {/* -al word list */}
      {cluster.alWords && cluster.alWords.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          data-testid="al-word-list"
        >
          {cluster.alWords.map((word, i) => (
            <span
              key={i}
              className="rounded-md border bg-muted/30 px-2.5 py-1 text-sm font-medium"
              data-testid={`al-word-${i}`}
            >
              {word}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AdjectiveExpressionsCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'adjective-expressions' }>;
  language: string;
  tutorGender: string;
}) {
  const { playingKey, play } = useTTSButton(language, tutorGender);

  return (
    <div className="flex flex-col gap-4">
      {cluster.anchorItems && cluster.anchorItems.length > 0 && (
        <MadrigalAnchorBlock items={cluster.anchorItems} />
      )}

      {/* Adjective pairs: Es X / Son Xs */}
      <div
        className="rounded-md border bg-card overflow-hidden"
        data-testid="adjective-pair-table"
      >
        {/* Header */}
        <div className="grid grid-cols-3 divide-x border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="px-3 py-2">Es…</div>
          <div className="px-3 py-2">Son…</div>
          <div className="px-3 py-2">English</div>
        </div>
        {cluster.adjectives.map((adj, i) => (
          <div
            key={i}
            className={`grid grid-cols-3 divide-x text-sm ${i < cluster.adjectives.length - 1 ? 'border-b' : ''}`}
          >
            <div className="px-3 py-2 font-medium">{adj.singular}</div>
            <div className="px-3 py-2 font-medium">{adj.plural}</div>
            <div className="px-3 py-2 text-muted-foreground">{adj.english}</div>
          </div>
        ))}
      </div>

      {/* Expressions */}
      <div className="flex flex-col gap-2" data-testid="expression-list">
        {cluster.expressions.map((expr, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border bg-card px-4 py-2"
            data-testid={`expression-${i}`}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={() => play(expr.spanish, `expr-${i}`)}
              disabled={playingKey === `expr-${i}`}
              data-testid={`button-tts-expression-${i}`}
              title={`Hear "${expr.spanish}"`}
            >
              {playingKey === `expr-${i}`
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
            <span className="text-lg font-bold tracking-tight">{expr.spanish}</span>
            <span className="text-sm text-muted-foreground">{expr.english}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SerUnit ───────────────────────────────────────────────────────────────────

interface SerUnitProps {
  content: SerUnitContent;
  language: string;
  chapter: {
    id: string;
    number: number;
    title: string;
    sections: { id: string; hasDrills: boolean; drillCount: number; lessonType: string }[];
  };
  onBack: () => void;
  onStartConversation: (lessonId?: string) => void;
  onStartDrill: (lessonId: string) => void;
}

export function SerUnit({
  content,
  language,
  chapter,
  onBack,
  onStartConversation,
  onStartDrill,
}: SerUnitProps) {
  const { tutorGender } = useLanguage();
  const topRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    topRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [chapter.id]);

  const sections = chapter.sections ?? [];
  const firstDrillSectionId = sections.find(s => s.hasDrills && s.drillCount > 0)?.id;
  const firstVocabSection = sections.find(s => s.lessonType === "vocabulary") ?? sections[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="ser-unit">
      <div ref={topRef} />

      {/* Sticky back bar */}
      <div className="sticky top-0 z-50 flex items-center gap-2 border-b bg-background/95 backdrop-blur px-4 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          data-testid="button-back"
          title="Back to chapters"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight">{chapter.title}</span>
          <span className="text-xs text-muted-foreground">Chapter {chapter.number}</span>
        </div>
      </div>

      {/* Cluster content */}
      <div className="flex flex-col gap-6 px-4 py-6">
        {content.clusters.map((cluster, idx) => (
          <div key={idx} className="flex flex-col gap-4">
            {idx > 0 && <PageRule />}

            {cluster.type === 'article-pairs' && (
              <ArticlePairsCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
            {cluster.type === 'es-son-sentences' && (
              <EsSonSentencesCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
            {cluster.type === 'ser-qa' && (
              <SerQACluster
                cluster={cluster}
                language={language}
              />
            )}
            {cluster.type === 'consonant-plural' && (
              <ConsonantPluralCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
            {cluster.type === 'adjective-expressions' && (
              <AdjectiveExpressionsCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom action buttons */}
      <div className="flex flex-col gap-3 px-4 pb-6 pt-2">
        <PageRule />
        <Button
          className="w-full"
          onClick={() => onStartConversation(firstVocabSection?.id)}
          data-testid="button-start-conversation"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Practice with Daniela
        </Button>
        {firstDrillSectionId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onStartDrill(firstDrillSectionId)}
            data-testid="button-start-drill"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Start Drills
          </Button>
        )}
      </div>
    </div>
  );
}
