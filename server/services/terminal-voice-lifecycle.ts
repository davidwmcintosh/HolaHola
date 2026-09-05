export async function runTerminalVoiceLifecycle<T>(steps: {
  metrics?: () => Promise<unknown>;
  end: () => Promise<T>;
  cleanup: () => Promise<unknown>;
}): Promise<T> {
  let primaryError: unknown;
  let result!: T;
  try {
    if (steps.metrics) {
      try { await steps.metrics(); } catch (error) { primaryError = error; }
    }
    try { result = await steps.end(); } catch (error) { primaryError ??= error; }
  } finally {
    try { await steps.cleanup(); } catch (error) { primaryError ??= error; }
  }
  if (primaryError) throw primaryError;
  return result;
}