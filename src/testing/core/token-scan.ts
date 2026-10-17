// Finds `${...}` tokens and splits them on `|`, skipping quoted text, so a quoted argument value
// can hold `}` or `|`: `${now:date(format='DD | MM')}`. A backslash inside quotes escapes the next
// character. When a token's quotes never close, the first `}` ends it, as the plain regex this
// replaces did, so malformed input resolves exactly as before.

export interface FoundToken {
  /** Index of the `$`. */
  start: number;
  /** Index just past the closing `}`. */
  end: number;
  /** What is between `${` and `}`. */
  inner: string;
}

/** The index of `target` in `text` from `from`, outside quotes; -1 if absent or the quotes never close. */
function indexOutsideQuotes(text: string, target: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === target) return i;
  }
  return -1;
}

export function findTokens(text: string): FoundToken[] {
  const tokens: FoundToken[] = [];
  let from = 0;
  for (;;) {
    const start = text.indexOf("${", from);
    if (start === -1) break;
    let close = indexOutsideQuotes(text, "}", start + 2);
    if (close === -1) close = text.indexOf("}", start + 2);
    if (close === -1) break;
    const inner = text.slice(start + 2, close);
    if (!inner) {
      from = start + 2;
      continue;
    }
    tokens.push({ start, end: close + 1, inner });
    from = close + 1;
  }
  return tokens;
}

/** Splits on `separator` outside quotes. With unbalanced quotes it splits everywhere, as before. */
export function splitOutsideQuotes(text: string, separator: string): string[] {
  const parts: string[] = [];
  let quote: string | null = null;
  let last = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') quote = c;
    else if (c === separator) {
      parts.push(text.slice(last, i));
      last = i + 1;
    }
  }
  if (quote) return text.split(separator);
  parts.push(text.slice(last));
  return parts;
}
