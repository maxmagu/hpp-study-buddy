import type { JSONContent } from "@tiptap/react";

export const GLOSSARY_PATH = "_glossary.json";

export type GlossaryEntry = {
  canonical: string;
  aliases: string[];
  definition: JSONContent[];
  definitionPreview: string;
};

export type Glossary = {
  entries: GlossaryEntry[];
  lookup: Map<string, GlossaryEntry>;
  regex: RegExp | null;
};

export const EMPTY_GLOSSARY: Glossary = {
  entries: [],
  lookup: new Map(),
  regex: null,
};

const PREVIEW_LIMIT = 240;

export function parseGlossary(doc: JSONContent | null | undefined): Glossary {
  if (!doc?.content?.length) return EMPTY_GLOSSARY;

  const entries: GlossaryEntry[] = [];
  let current: GlossaryEntry | null = null;

  for (const node of doc.content) {
    const isTermHeading =
      node.type === "heading" && node.attrs?.level === 3;
    if (isTermHeading) {
      const headingText = nodeText(node).trim();
      const aliases = headingText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (aliases.length === 0) {
        current = null;
        continue;
      }
      current = {
        canonical: aliases[0],
        aliases,
        definition: [],
        definitionPreview: "",
      };
      entries.push(current);
    } else if (current) {
      current.definition.push(node);
    }
  }

  for (const e of entries) {
    e.definitionPreview = previewText(e.definition).slice(0, PREVIEW_LIMIT);
  }

  const lookup = new Map<string, GlossaryEntry>();
  for (const e of entries) {
    for (const alias of e.aliases) {
      const key = alias.toLowerCase();
      if (!lookup.has(key)) lookup.set(key, e);
    }
  }

  const aliasKeys = [...lookup.keys()].sort((a, b) => b.length - a.length);
  const regex = aliasKeys.length
    ? new RegExp(
        // Unicode-aware word boundary via property-escape lookarounds —
        // \b is ASCII-only, which would mishandle umlauts and ß.
        `(?<![\\p{L}\\p{N}_])(?:${aliasKeys
          .map(escapeRegex)
          .join("|")})(?![\\p{L}\\p{N}_])`,
        "giu",
      )
    : null;

  return { entries, lookup, regex };
}

function nodeText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join("");
}

function previewText(nodes: JSONContent[]): string {
  return nodes
    .map(nodeText)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
