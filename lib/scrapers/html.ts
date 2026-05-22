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

export function stripHtml(input: string, maxLen = 4000): string {
  if (!input) return '';
  // Decode entities first — Greenhouse returns double-escaped content.
  let s = decodeEntities(input);
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div|h[1-6])>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
