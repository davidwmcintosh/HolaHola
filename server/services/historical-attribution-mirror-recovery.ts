import { getHistoricalAttributionOverlayForCaptures } from './historical-attribution-overlay';
import { CHAT_CAPTURE_PATH, parseChatCaptureFromOffset } from './transcript-parser';
import type { EpisodeMirrorOutboxItem } from './episode-mirror-outbox';

export function projectHistoricalEpisodeMirror(
  item: Pick<EpisodeMirrorOutboxItem, 'startCursor' | 'endOffset' | 'captureIds' | 'formattedContent'>,
  capturePath = CHAT_CAPTURE_PATH,
): string {
  const overlay = getHistoricalAttributionOverlayForCaptures(item.captureIds);
  if (!overlay?.hasApprovedCaptures(item.captureIds)) return item.formattedContent;
  if (item.captureIds.length !== 1) {
    overlay.pause('mixed-capture-mirror', item.captureIds,
      'Historical attribution mirror mixes capture identities; recovery requires an isolated turn');
  }
  // Queue text is not a delimiter-safe source. Recover the actual boundaries
  // independently from the immutable length-delimited source capture range.
  const source = parseChatCaptureFromOffset(capturePath, item.startCursor);
  const lastTurn = source.turnByteOffsets.indexOf(item.endOffset);
  if (lastTurn < 0) {
    overlay.pause('source-capture-unavailable', item.captureIds,
      'Historical mirror original capture range is unavailable; acknowledgement remains pending');
  }
  return overlay.projectPendingMirror(
    item.formattedContent, item.captureIds, source.turns.slice(0, lastTurn + 1),
  );
}