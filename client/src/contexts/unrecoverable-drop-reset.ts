/**
 * Unrecoverable-drop voice-status reset — extracted for testability.
 *
 * DanielaSessionContext registers a stateChange listener on the global
 * StreamingVoiceClient singleton so it can reset voiceStatus to 'idle'
 * when the WebSocket drops unrecoverably while StreamingVoiceChat is
 * not mounted (student is on another page).
 *
 * 'reconnecting' is intentionally left alone — the connection may still
 * recover and we do not want to flash 'idle' mid-reconnect.
 *
 * Exporting this function (rather than inlining it in the useEffect) lets
 * the CI test import the real production logic, so any change to the reset
 * conditions (e.g. removing the 'error' branch) will break the test.
 */

export type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "thinking";

/**
 * Called with the new StreamingConnectionState string each time the client
 * emits a 'stateChange' event.  Sets voiceStatus to 'idle' for unrecoverable
 * terminal states ('error' and 'disconnected'); ignores transient states.
 */
export function applyUnrecoverableDropReset(
  state: string,
  setVoiceStatus: (s: VoiceStatus) => void,
): void {
  if (state === "error" || state === "disconnected") {
    setVoiceStatus("idle");
  }
}
