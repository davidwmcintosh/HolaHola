import { getHistoricalAttributionOverlayForCaptures } from './historical-attribution-overlay';
import { CHAT_CAPTURE_PATH, parseChatCaptureFromOffset } from './transcript-parser';
import type { EpisodeMirrorOutboxItem } from './episode-mirror-outbox';

export function projectHistoricalEpisodeMirror(
  item: Pick<EpisodeMirrorOutboxItem, 'startCursor' | 'endOffset' | 'captureIds' | 'formattedContent'>,
  capturePath = CHAT_CAPTURE_PATH,
): string {
  const overlay = getHistoricalAttributionOverlayForCaptures(item.captureIds);
  if (!overlay?.hasApprovedCaptures(item.captureIds)) return item.formattedContent;
  // Queue text is not a delimiter-safe source. Recover the actual boundaries
  // independently from the immutable length-delimited source capture range.
  const source = parseChatCaptureFromOffset(capturePath, item.startCursor);
  const lastTurn = source.turnByteOffsets.indexOf(item.endOffset);
  if (lastTurn < 0) {
    throw new Error('Historical mirror original capture range is unavailable; acknowledgement remains pending');
  }
  return overlay.projectPendingMirror(
    item.formattedContent, item.captureIds, source.turns.slice(0, lastTurn + 1),
  );
}