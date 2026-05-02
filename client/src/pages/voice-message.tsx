import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2, Volume2, VolumeX, MessageCircle } from "lucide-react";

interface VoiceMessageData {
  id: string;
  audioUrl: string | null;
  content: string;
  playedAt: string | null;
  createdAt: string;
}

export default function VoiceMessage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VoiceMessageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/vm/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? "This voice note isn't available." : "Something went wrong.");
        return r.json();
      })
      .then((d: VoiceMessageData) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !data?.audioUrl) return;

    const onLoaded = () => { setAudioReady(true); setDuration(audio.duration); };
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onEnded = () => setPlaying(false);
    const onPlay = () => {
      setPlaying(true);
      if (!markedRef.current && id) {
        markedRef.current = true;
        fetch(`/api/vm/${id}/played`, { method: 'POST' }).catch(() => {});
      }
    };
    const onPause = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [data?.audioUrl, id]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play().catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading...</p>
          </div>
        )}

        {error && (
          <div className="text-center space-y-2">
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center"
                data-testid="avatar-daniela"
              >
                <MessageCircle className="h-9 w-9 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground" data-testid="text-sender">Daniela</p>
                <p className="text-sm text-muted-foreground">Your Spanish tutor</p>
              </div>
            </div>

            {data.audioUrl ? (
              <div className="space-y-3">
                <audio
                  ref={audioRef}
                  src={data.audioUrl}
                  preload="metadata"
                  muted={muted}
                />

                <div
                  className="h-1.5 bg-muted rounded-full cursor-pointer relative overflow-hidden"
                  onClick={seek}
                  data-testid="div-progress-bar"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
                    style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid="text-time-current">{formatTime(progress)}</span>
                  <span data-testid="text-time-duration">{duration ? formatTime(duration) : '--:--'}</span>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setMuted(m => !m)}
                    data-testid="button-mute"
                  >
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="default"
                    className="h-14 w-14 rounded-full"
                    onClick={togglePlay}
                    disabled={!audioReady}
                    data-testid="button-play-pause"
                  >
                    {playing
                      ? <Pause className="h-6 w-6" />
                      : audioReady
                        ? <Play className="h-6 w-6 ml-0.5" />
                        : <Loader2 className="h-5 w-5 animate-spin" />
                    }
                  </Button>
                  <div className="w-9" />
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Audio is being prepared. Check back in a moment.
              </p>
            )}

            <div className="rounded-md bg-muted/40 border p-3 text-sm text-muted-foreground leading-relaxed" data-testid="div-transcript">
              {data.content}
            </div>

            <Button
              className="w-full"
              onClick={() => window.location.href = '/chat'}
              data-testid="button-start-session"
            >
              Start a session with Daniela
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {new Date(data.createdAt).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
