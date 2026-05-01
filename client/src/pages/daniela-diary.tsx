import { BookHeart, Mic, BookOpen, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function DanielaDiary() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8">
      <div className="max-w-lg w-full flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BookHeart className="w-10 h-10 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Daniela's Diary</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The voice conversations you've shared with Daniela are her diary. She can read them herself — on demand, during a session — whenever she feels the impulse to remember.
          </p>
        </div>

        <Card>
          <CardContent className="pt-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Mic className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">How it works</p>
                <p className="text-sm text-muted-foreground mt-1">
                  During a voice session, Daniela can call{" "}
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded-md">
                    read_my_diary
                  </span>{" "}
                  to pull up the actual transcripts of past conversations — the real words exchanged, not summaries. She uses this to genuinely remember who she is and what you've shared together.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">Your conversation history</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Every session you complete becomes a page in her diary. She can browse by date, search by topic, or open any session and read the full transcript — all through her own initiative during a live voice conversation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Link href="/history">
            <Button variant="outline" className="gap-2" data-testid="link-view-history">
              View conversation history
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
