import MiniSearch from "minisearch";

export type SearchDoc = {
  path: string;
  text: string;
};

export type SearchHit = {
  path: string;
  score: number;
  matchedTerms: string[];
};

const WORD_REGEX = /[\p{L}\p{N}_]+/giu;

function tokenize(s: string): string[] {
  return s.match(WORD_REGEX) ?? [];
}

export function buildIndex(docs: SearchDoc[]): MiniSearch<SearchDoc> {
  const ms = new MiniSearch<SearchDoc>({
    idField: "path",
    fields: ["path", "text"],
    storeFields: ["path"],
    tokenize,
    processTerm: (t) => t.toLowerCase(),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { path: 2 },
      processTerm: (t) => t.toLowerCase(),
    },
  });
  ms.addAll(docs);
  return ms;
}

export function search(
  index: MiniSearch<SearchDoc>,
  query: string,
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  return index.search(q).map((r) => ({
    path: r.path as string,
    score: r.score,
    matchedTerms: r.terms,
  }));
}

export function replaceDoc(
  index: MiniSearch<SearchDoc>,
  doc: SearchDoc,
): void {
  if (index.has(doc.path)) index.discard(doc.path);
  index.add(doc);
}

export function removeDoc(
  index: MiniSearch<SearchDoc>,
  pathToRemove: string,
): void {
  if (index.has(pathToRemove)) index.discard(pathToRemove);
}

export function snippet(
  text: string,
  terms: string[],
  ctx = 80,
): { before: string; match: string; after: string } | null {
  if (!text || terms.length === 0) return null;
  const lower = text.toLowerCase();
  let bestStart = -1;
  let bestEnd = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx < 0) continue;
    if (bestStart < 0 || idx < bestStart) {
      bestStart = idx;
      bestEnd = idx + term.length;
    }
  }
  if (bestStart < 0) {
    return { before: "", match: "", after: text.slice(0, ctx * 2) };
  }
  const start = Math.max(0, bestStart - ctx);
  const end = Math.min(text.length, bestEnd + ctx);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, bestStart),
    match: text.slice(bestStart, bestEnd),
    after: text.slice(bestEnd, end) + (end < text.length ? "…" : ""),
  };
}
