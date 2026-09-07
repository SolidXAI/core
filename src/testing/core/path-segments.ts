// Purpose: shared lookup-path parsing for interpolation tokens and the resource store.

/**
 * Split a lookup path into segments, accepting dot and bracket notation interchangeably:
 * `a.b.0.c`, `a.b[0].c` and `a["b"].c` all yield the same segments.
 *
 * Both `${data:...}` and `${res:...}` resolve through this, so the two token families share one
 * path syntax. Previously only `${data:...}` parsed brackets while the resource store split on
 * "." alone, which meant `${res:r.bodyJson.result[0].id}` silently resolved to nothing while the
 * `${data:...}` form right next to it worked — the asymmetry was a standing authoring trap.
 *
 * Bracket contents may be quoted (`["Clean Code"]`) for keys containing spaces or punctuation;
 * backslash escapes inside quotes are honoured. Empty brackets contribute no segment.
 */
export function parsePathSegments(path: string): string[] {
  const segments: string[] = [];
  let buffer = "";
  let i = 0;

  const pushBuffer = () => {
    if (buffer) {
      segments.push(buffer);
      buffer = "";
    }
  };

  while (i < path.length) {
    const ch = path[i];
    if (ch === ".") {
      pushBuffer();
      i += 1;
      continue;
    }
    if (ch === "[") {
      pushBuffer();
      i += 1;
      if (i >= path.length) break;
      let quote = "";
      if (path[i] === '"' || path[i] === "'") {
        quote = path[i];
        i += 1;
      }
      let value = "";
      while (i < path.length) {
        const c = path[i];
        if (quote) {
          if (c === "\\" && i + 1 < path.length) {
            value += path[i + 1];
            i += 2;
            continue;
          }
          if (c === quote) {
            i += 1;
            break;
          }
          value += c;
          i += 1;
          continue;
        }
        if (c === "]") break;
        value += c;
        i += 1;
      }
      while (i < path.length && path[i] !== "]") {
        i += 1;
      }
      if (i < path.length && path[i] === "]") {
        i += 1;
      }
      if (value) {
        segments.push(value);
      }
      continue;
    }
    buffer += ch;
    i += 1;
  }

  pushBuffer();
  return segments;
}
