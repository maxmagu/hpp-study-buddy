import type { JSONContent } from "@tiptap/react";

// Detects pipe-syntax markdown tables in pasted plain text and converts
// them to Tiptap table JSON. Format expected:
//
//   | a | b | c |
//   |---|---|---|
//   | 1 | 2 | 3 |
//
// The separator row needs at least one cell with dashes; alignment colons
// are tolerated but ignored.

export type MarkdownTableParse = {
  table: JSONContent;
  textBefore: string;
  textAfter: string;
};

export type MarkdownSegment =
  | { kind: "text"; value: string }
  | { kind: "table"; node: JSONContent };

const SEPARATOR_RE = /^\s*\|?\s*:?-{3,}:?(\s*\|\s*:?-{3,}:?)*\s*\|?\s*$/;
const TABLE_LINE_RE = /^\s*\|.*\|\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function textCell(text: string, header: boolean): JSONContent {
  return {
    type: header ? "tableHeader" : "tableCell",
    content: [
      text
        ? { type: "paragraph", content: [{ type: "text", text }] }
        : { type: "paragraph" },
    ],
  };
}

function row(cells: string[], header: boolean): JSONContent {
  return {
    type: "tableRow",
    content: cells.map((c) => textCell(c, header)),
  };
}

export function parseMarkdownTable(
  text: string,
): MarkdownTableParse | null {
  const lines = text.split(/\r?\n/);
  // Find first table-shaped line followed by a separator.
  for (let i = 0; i < lines.length - 1; i++) {
    if (!TABLE_LINE_RE.test(lines[i])) continue;
    if (!SEPARATOR_RE.test(lines[i + 1])) continue;

    const header = splitRow(lines[i]);
    const cols = header.length;
    if (cols < 1) continue;

    let end = i + 2;
    while (end < lines.length && TABLE_LINE_RE.test(lines[end])) end++;

    const bodyLines = lines.slice(i + 2, end);
    const bodyRows = bodyLines.map((l) => {
      const cells = splitRow(l);
      while (cells.length < cols) cells.push("");
      return cells.slice(0, cols);
    });

    const table: JSONContent = {
      type: "table",
      content: [
        row(header, true),
        ...bodyRows.map((cells) => row(cells, false)),
      ],
    };

    return {
      table,
      textBefore: lines.slice(0, i).join("\n"),
      textAfter: lines.slice(end).join("\n"),
    };
  }
  return null;
}

// Walk the text, returning text-and-table segments in order. Empty text
// segments (between adjacent tables) are still emitted but harmless.
export function parseMarkdownTables(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const parsed = parseMarkdownTable(remaining);
    if (!parsed) {
      segments.push({ kind: "text", value: remaining });
      break;
    }
    if (parsed.textBefore.length > 0) {
      segments.push({ kind: "text", value: parsed.textBefore });
    }
    segments.push({ kind: "table", node: parsed.table });
    remaining = parsed.textAfter;
  }
  return segments;
}
