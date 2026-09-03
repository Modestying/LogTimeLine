export interface FindMatch {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface FindOptions {
  caseSensitive: boolean;
  regex: boolean;
}

const MAX_MATCHES = 8000;

export function collectFindMatches(
  text: string,
  query: string,
  options: FindOptions,
): { matches: FindMatch[]; error: string | null } {
  if (!query) return { matches: [], error: null };

  const ranges: Array<{ start: number; end: number }> = [];
  if (options.regex) {
    let re: RegExp;
    try {
      re = new RegExp(query, options.caseSensitive ? "g" : "gi");
    } catch {
      return { matches: [], error: "invalid" };
    }
    let guard = 0;
    for (const match of text.matchAll(re)) {
      const start = match.index ?? 0;
      const len = match[0].length;
      if (len === 0) {
        if (re.lastIndex === match.index) re.lastIndex += 1;
        continue;
      }
      ranges.push({ start, end: start + len });
      if (++guard >= MAX_MATCHES) break;
    }
  } else {
    const hay = options.caseSensitive ? text : text.toLowerCase();
    const needle = options.caseSensitive ? query : query.toLowerCase();
    let from = 0;
    while (from < hay.length && ranges.length < MAX_MATCHES) {
      const start = hay.indexOf(needle, from);
      if (start < 0) break;
      ranges.push({ start, end: start + query.length });
      from = start + needle.length;
    }
  }

  return { matches: attachLineCols(text, ranges), error: null };
}

export function indexOfMatchAtOrAfter(matches: FindMatch[], pos: number): number {
  if (matches.length === 0) return 0;
  const found = matches.findIndex((m) => m.start >= pos);
  return found === -1 ? 0 : found;
}

function attachLineCols(text: string, ranges: Array<{ start: number; end: number }>): FindMatch[] {
  const matches: FindMatch[] = [];
  let line = 0;
  let lineStart = 0;
  let i = 0;
  for (const range of ranges) {
    while (i < range.start) {
      if (text.charCodeAt(i) === 10) {
        line += 1;
        lineStart = i + 1;
      }
      i += 1;
    }
    matches.push({
      start: range.start,
      end: range.end,
      line,
      column: range.start - lineStart,
    });
  }
  return matches;
}
