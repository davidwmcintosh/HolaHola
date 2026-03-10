import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Languages, HelpCircle, MessageSquare } from "lucide-react";

interface TextbookContent {
  lesson_id:                   string;
  language:                    string;
  actfl_level:                 string;
  introduction:                string;
  grammar_explanation:         string;
  grammar_examples:            Array<{ target: string; translation: string }>;
  vocabulary_list:             Array<{ word: string; translation: string; partOfSpeech?: string; exampleSentence?: string; exampleTranslation?: string }>;
  cultural_note:               string;
  reading_passage:             string;
  reading_passage_translation: string;
  comprehension_questions:     Array<{ question: string; hint?: string }>;
  key_phrases_for_chat:        Array<{ phrase: string; meaning: string }>;
}

interface TextbookLessonReaderProps {
  lessonId:   string;
  lessonName: string;
  open:       boolean;
  onClose:    () => void;
}

export function TextbookLessonReader({ lessonId, lessonName, open, onClose }: TextbookLessonReaderProps) {
  const [showTranslation, setShowTranslation] = useState(false);

  const { data, isLoading, error } = useQuery<{ content: TextbookContent | null }>({
    queryKey: ["/api/textbook-content", lessonId],
    enabled: open && !!lessonId,
  });

  const content = data?.content;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-textbook-reader">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {lessonName}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">Failed to load textbook content.</div>
        )}

        {!isLoading && !error && !content && (
          <div className="text-center py-10 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No textbook content available for this lesson yet.</p>
          </div>
        )}

        {content && (
          <div className="space-y-6 py-2">
            {/* ACTFL level badge */}
            <Badge variant="outline" className="text-xs capitalize">{content.actfl_level?.replace(/_/g, " ")}</Badge>

            {/* Introduction */}
            {content.introduction && (
              <section>
                <p className="text-sm leading-relaxed">{content.introduction}</p>
              </section>
            )}

            {/* Grammar explanation */}
            {content.grammar_explanation && (
              <section className="space-y-3">
                <h3 className="font-semibold text-sm">Grammar Focus</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{content.grammar_explanation}</p>
                {content.grammar_examples?.length > 0 && (
                  <div className="space-y-2">
                    {content.grammar_examples.map((ex, i) => (
                      <div key={i} className="bg-muted/40 rounded-md p-3 space-y-0.5" data-testid={`grammar-example-${i}`}>
                        <p className="text-sm font-medium">{ex.target}</p>
                        <p className="text-xs text-muted-foreground">{ex.translation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Vocabulary */}
            {content.vocabulary_list?.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold text-sm">Vocabulary</h3>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-xs">Word</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Meaning</th>
                        <th className="text-left px-3 py-2 font-medium text-xs hidden sm:table-cell">Example</th>
                      </tr>
                    </thead>
                    <tbody>
                      {content.vocabulary_list.map((item, i) => (
                        <tr key={i} className="border-t" data-testid={`vocab-row-${i}`}>
                          <td className="px-3 py-2 font-medium">{item.word}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.translation}</td>
                          <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{item.exampleSentence ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Cultural note */}
            {content.cultural_note && (
              <section className="space-y-2">
                <h3 className="font-semibold text-sm">Cultural Note</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{content.cultural_note}</p>
              </section>
            )}

            {/* Reading passage */}
            {content.reading_passage && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">Reading Passage</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTranslation(v => !v)}
                    data-testid="button-toggle-translation"
                  >
                    <Languages className="h-3 w-3 mr-1" />
                    {showTranslation ? "Hide" : "Show"} Translation
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-md p-4 space-y-3">
                  <p className="text-sm leading-relaxed">{content.reading_passage}</p>
                  {showTranslation && content.reading_passage_translation && (
                    <p className="text-sm text-muted-foreground leading-relaxed border-t pt-3" data-testid="text-passage-translation">
                      {content.reading_passage_translation}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Comprehension questions */}
            {content.comprehension_questions?.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4" />
                  Comprehension Questions
                </h3>
                <ol className="space-y-2 list-decimal list-inside">
                  {content.comprehension_questions.map((q, i) => (
                    <li key={i} className="text-sm" data-testid={`question-${i}`}>
                      {q.question}
                      {q.hint && <span className="text-xs text-muted-foreground ml-2">({q.hint})</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Key phrases */}
            {content.key_phrases_for_chat?.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Key Phrases for Conversation
                </h3>
                <div className="grid gap-2">
                  {content.key_phrases_for_chat.map((kp, i) => (
                    <div key={i} className="flex items-start gap-3 bg-muted/30 rounded-md p-3" data-testid={`key-phrase-${i}`}>
                      <span className="font-medium text-sm min-w-fit">{kp.phrase}</span>
                      <span className="text-sm text-muted-foreground">{kp.meaning}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
