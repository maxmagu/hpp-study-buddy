import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

type SearchHighlightOptions = {
  getTerms: () => string[];
};

export const searchHighlightPluginKey = new PluginKey<DecorationSet>(
  "searchHighlight",
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(terms: string[]): RegExp | null {
  const cleaned = terms
    .map((t) => t.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (cleaned.length === 0) return null;
  // Unicode-aware word boundary via property-escape lookarounds.
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${cleaned.map(escapeRegex).join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
}

export const SearchHighlight = Extension.create<SearchHighlightOptions>({
  name: "searchHighlight",

  addOptions() {
    return { getTerms: () => [] };
  },

  addProseMirrorPlugins() {
    const getTerms = () => this.options.getTerms();
    return [
      new Plugin<DecorationSet>({
        key: searchHighlightPluginKey,
        state: {
          init: (_, { doc }) => buildDecorations(doc, getTerms()),
          apply(tr, oldSet) {
            const invalidate = tr.getMeta(searchHighlightPluginKey);
            if (!tr.docChanged && !invalidate) return oldSet;
            return buildDecorations(tr.doc, getTerms());
          },
        },
        props: {
          decorations(state) {
            return (
              searchHighlightPluginKey.getState(state) ?? DecorationSet.empty
            );
          },
        },
      }),
    ];
  },
});

function buildDecorations(
  doc: ProseMirrorNode,
  terms: string[],
): DecorationSet {
  const regex = buildRegex(terms);
  if (!regex) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text ?? "";
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      const start = pos + match.index;
      const end = start + match[0].length;
      decorations.push(
        Decoration.inline(start, end, { class: "search-highlight" }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}
