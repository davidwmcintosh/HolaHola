/**
 * SerUnit.tsx
 * Renderer for Madrigal's ser/estar chapters.
 *
 * Cluster types:
 *   article-pairs        — el/los and la/las image cards with singular/plural labels
 *   es-son-sentences     — two-column sentence cards (singular | plural)
 *   ser-qa               — Q&A image cards; optional roomHeader for room sections
 *   consonant-plural     — image pairs + word list + -al vocabulary
 *   adjective-expressions— adjective pairs + ¡Eso es! expressions
 *   estar-statements     — statement image cards (El café está en la mesa.)
 *   estar-conj           — estar conjugation table + sentence combinator
 *   word-chips           — cognate / vocabulary word chip list
 *   estar-expressions    — M/F adjective columns + additional expressions
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="dual-form-grid">
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
      {/* Image — fixed height so it doesn't overwhelm the card */}
      <div className="relative w-full h-36 bg-muted/30 overflow-hidden flex-shrink-0">
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

      {/* Question — speaker + text + translation inline */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-border/30">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.question, qKey)}
          disabled={playingKey === qKey}
          data-testid={`button-play-question-${testId}`}
          title={`Hear "${card.question}"`}
          className="flex-shrink-0"
        >
          {playingKey === qKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
        <div className="flex flex-col min-w-0">
          <p
            className="text-sm font-medium leading-snug text-blue-600 dark:text-blue-400"
            data-testid={`text-question-${testId}`}
          >
            {card.question}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {card.questionTranslation}
          </p>
        </div>
      </div>

      {/* Answer — speaker + text + translation inline */}
      <div className="flex items-center gap-2 px-2 py-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.answer, aKey)}
          disabled={playingKey === aKey}
          data-testid={`button-play-answer-${testId}`}
          title={`Hear "${card.answer}"`}
          className="flex-shrink-0"
        >
          {playingKey === aKey
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
        <div className="flex flex-col min-w-0">
          <p
            className="text-sm font-medium leading-snug text-red-600 dark:text-red-400"
            data-testid={`text-answer-${testId}`}
          >
            {card.answer}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {card.answerTranslation}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── SerQAGrid ─────────────────────────────────────────────────────────────────

function SerQAGrid({ cards, language }: { cards: PreteriteQACard[]; language: string }) {
  const { tutorGender } = useLanguage();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="ser-qa-grid">
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
      {/* Room header + anchor items on the same line, same font size */}
      {cluster.roomHeader && (
        <div
          className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1"
          data-testid="room-header-block"
        >
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight leading-none">
              {cluster.roomHeader.spanish}
            </span>
            <span className="text-base text-muted-foreground font-normal">
              {cluster.roomHeader.english}
            </span>
          </div>
          {cluster.anchorItems?.map((item, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight leading-none">{item.spanish}</span>
              <span className="text-base text-muted-foreground font-normal">{item.english}</span>
            </div>
          ))}
        </div>
      )}
      {/* Anchor items only (no room header) */}
      {!cluster.roomHeader && cluster.anchorItems && cluster.anchorItems.length > 0 && (
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

// ── Estar statement cards ─────────────────────────────────────────────────────

function EstarStatementCard({
  card,
  cardIndex,
  language,
  tutorGender,
}: {
  card: { imageWord: string; imageDescription?: string; statement: string; translation: string };
  cardIndex: number;
  language: string;
  tutorGender: string;
}) {
  const { data } = useWordImage(card.imageWord, language, card.imageDescription);
  const { playingKey, play } = useTTSButton(language, tutorGender);
  const testId = `${card.imageWord}-${cardIndex}`;
  const key = `stmt-${testId}`;

  return (
    <div
      className="flex flex-col rounded-md border bg-card overflow-hidden"
      data-testid={`estar-statement-card-${testId}`}
    >
      {/* Image — fixed height to stay compact */}
      <div className="relative w-full h-36 bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {data?.url ? (
          <img
            src={data.url}
            alt={card.imageDescription ?? card.imageWord}
            className="w-full h-full object-cover"
          />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
        )}
      </div>

      {/* Statement */}
      <div className="flex flex-col items-center px-2 pt-2 pb-2 text-center gap-0.5">
        <p className="text-sm font-medium leading-snug" data-testid={`text-statement-${testId}`}>
          {card.statement}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight">{card.translation}</p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => play(card.statement, key)}
          disabled={playingKey === key}
          data-testid={`button-play-statement-${testId}`}
          title={`Hear "${card.statement}"`}
        >
          {playingKey === key
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Volume2 className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function EstarStatementsCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'estar-statements' }>;
  language: string;
  tutorGender: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {cluster.introNote && <MadrigalNote text={cluster.introNote} />}
      {cluster.anchorItems && cluster.anchorItems.length > 0 && (
        <MadrigalAnchorBlock items={cluster.anchorItems} />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="estar-statement-grid">
        {cluster.cards.map((card, i) => (
          <EstarStatementCard
            key={`${card.imageWord}-${i}`}
            card={card}
            cardIndex={i}
            language={language}
            tutorGender={tutorGender}
          />
        ))}
      </div>
    </div>
  );
}

// ── Estar conjugation + combinator ────────────────────────────────────────────

function EstarConjCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'estar-conj' }>;
  language: string;
  tutorGender: string;
}) {
  const { playingKey, play } = useTTSButton(language, tutorGender);

  // All conjugation forms (rows + question) in one flat array for the 3-col grid
  const allForms = [
    ...cluster.rows.map(r => ({ text: r.conjugated, translation: r.translation, key: r.conjugated })),
    { text: cluster.questionForm, translation: cluster.questionTranslation, key: 'qform' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Conjugation — 3-column grid to keep it compact */}
      <div
        className="grid grid-cols-3 gap-2"
        data-testid="estar-conj-table"
      >
        {allForms.map((form, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 rounded-md border bg-card px-2 py-3 text-center"
          >
            <span className="text-base font-bold leading-tight">{form.text}</span>
            <span className="text-[11px] text-muted-foreground leading-snug">{form.translation}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => play(form.text, form.key)}
              disabled={playingKey === form.key}
              data-testid={`button-play-conj-${i}`}
              title={`Hear "${form.text}"`}
            >
              {playingKey === form.key
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ))}
      </div>

      {/* Sentence practice — list of complete sentences */}
      <div className="flex flex-col gap-2" data-testid="estar-combinator">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Practice sentences
        </p>
        <div className="rounded-md border bg-card overflow-hidden">
          {cluster.combinatorWords.map((word, i) => {
            const full = `${cluster.combinatorLeft} ${word.spanish}`;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < cluster.combinatorWords.length - 1 ? 'border-b' : ''}`}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => play(full, `comb-${i}`)}
                  disabled={playingKey === `comb-${i}`}
                  data-testid={`button-play-combinator-${i}`}
                  title={`Hear "${full}"`}
                >
                  {playingKey === `comb-${i}`
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Volume2 className="h-3.5 w-3.5" />}
                </Button>
                <span className="text-sm font-medium">
                  <span className="text-muted-foreground">{cluster.combinatorLeft} </span>
                  {word.spanish}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">{word.english}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Word chips (cognate list) ─────────────────────────────────────────────────

function WordChipsCluster({
  cluster,
}: {
  cluster: Extract<SerCluster, { type: 'word-chips' }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <MadrigalNote text={cluster.note} />
      <div className="flex flex-wrap gap-2" data-testid="word-chips-list">
        {cluster.words.map((word, i) => (
          <span
            key={i}
            className="rounded-md border bg-muted/30 px-2.5 py-1 text-sm font-medium"
            data-testid={`word-chip-${i}`}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Estar expressions (M/F table + additionals) ───────────────────────────────

function EstarExpressionsCluster({
  cluster,
  language,
  tutorGender,
}: {
  cluster: Extract<SerCluster, { type: 'estar-expressions' }>;
  language: string;
  tutorGender: string;
}) {
  const { playingKey, play } = useTTSButton(language, tutorGender);

  return (
    <div className="flex flex-col gap-5">
      {/* M/F two-column table */}
      <div className="rounded-md border bg-card overflow-hidden" data-testid="estar-expressions-table">
        {/* Header */}
        <div className="grid grid-cols-2 divide-x border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="px-3 py-2">Masculine</div>
          <div className="px-3 py-2">Feminine</div>
        </div>
        {cluster.genderPairs.map((pair, i) => (
          <div
            key={i}
            className={`grid grid-cols-2 divide-x ${i < cluster.genderPairs.length - 1 ? 'border-b' : ''}`}
          >
            {/* Masculine cell */}
            <div className="flex flex-col px-3 py-2 gap-0.5">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => play(pair.masculine.spanish, `m-${i}`)}
                  disabled={playingKey === `m-${i}`}
                  data-testid={`button-play-masc-${i}`}
                  title={`Hear "${pair.masculine.spanish}"`}
                >
                  {playingKey === `m-${i}`
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Volume2 className="h-3 w-3" />}
                </Button>
                <span className="text-sm font-medium">{pair.masculine.spanish}</span>
              </div>
              <span className="text-[11px] text-muted-foreground pl-9">{pair.masculine.english}</span>
            </div>
            {/* Feminine cell */}
            <div className="flex flex-col px-3 py-2 gap-0.5">
              {pair.feminine ? (
                <>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => play(pair.feminine!.spanish, `f-${i}`)}
                      disabled={playingKey === `f-${i}`}
                      data-testid={`button-play-fem-${i}`}
                      title={`Hear "${pair.feminine.spanish}"`}
                    >
                      {playingKey === `f-${i}`
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Volume2 className="h-3 w-3" />}
                    </Button>
                    <span className="text-sm font-medium">{pair.feminine.spanish}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground pl-9">{pair.feminine.english}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground/40 italic px-9 py-0.5">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Additional / neutral items */}
      <div className="flex flex-col gap-1" data-testid="estar-additional-items">
        {cluster.additionalItems.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border bg-card px-4 py-2"
            data-testid={`estar-additional-${i}`}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={() => play(item.spanish, `add-${i}`)}
              disabled={playingKey === `add-${i}`}
              data-testid={`button-play-additional-${i}`}
              title={`Hear "${item.spanish}"`}
            >
              {playingKey === `add-${i}`
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Volume2 className="h-3.5 w-3.5" />}
            </Button>
            <span className="text-base font-bold tracking-tight">{item.spanish}</span>
            <span className="text-sm text-muted-foreground ml-auto">{item.english}</span>
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
            {cluster.type === 'estar-statements' && (
              <EstarStatementsCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
            {cluster.type === 'estar-conj' && (
              <EstarConjCluster
                cluster={cluster}
                language={language}
                tutorGender={tutorGender}
              />
            )}
            {cluster.type === 'word-chips' && (
              <WordChipsCluster
                cluster={cluster}
              />
            )}
            {cluster.type === 'estar-expressions' && (
              <EstarExpressionsCluster
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
