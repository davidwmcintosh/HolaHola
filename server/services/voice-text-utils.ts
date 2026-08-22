export function ensureTrailingPunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (/[.!?\u2026\u3002\uff01\uff1f]["'\u201c\u201d\u2019\u2018)\]]*$/.test(trimmed)) return trimmed;
  return trimmed + '.';
}
