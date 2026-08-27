const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(input: string): string {
  let s = input.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, m => ENTITY_MAP[m] ?? m);
  s = s.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCharCode(parseInt(code, 16)));
  return s;
}

function stripTags(input: string): string {
  let s = input.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6])>/gi, '\n');
  return s.replace(/<[^>]+>/g, ' ');
}

export function stripHtml(input: string, maxLen = 4000): string {
  if (!input) return '';
  // Two decode→strip passes. Greenhouse sometimes double-escapes, so decoding
  // once can *reveal* markup the first strip never saw — the previous
  // decode → strip → decode order left that revealed markup in the output as
  // literal "<p>" text, which then went into the ranking prompt. Only one
  // description in the current corpus hits this, but the fix is cheap and the
  // failure is invisible when it happens.
  let s = stripTags(decodeEntities(input));
  s = stripTags(decodeEntities(s));
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
