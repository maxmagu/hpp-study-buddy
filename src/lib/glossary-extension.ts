import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Glossary } from "@/lib/glossary";

type GlossaryOptions = {
  getGlossary: () => Glossary | null;
};

export const glossaryPluginKey = new PluginKey<DecorationSet>(
  "glossaryDecorations",
);

export const GlossaryDecorations = Extension.create<GlossaryOptions>({
  name: "glossaryDecorations",

  addOptions() {
    return {
      getGlossary: () => null,
    };
  },

  addProseMirrorPlugins() {
    const getGlossary = () => this.options.getGlossary();
    return [
      new Plugin<DecorationSet>({
        key: glossaryPluginKey,
        state: {
          init: (_, { doc }) => buildDecorations(doc, getGlossary()),
          apply(tr, oldSet) {
            const invalidate = tr.getMeta(glossaryPluginKey);
            if (!tr.docChanged && !invalidate) return oldSet;
            return buildDecorations(tr.doc, getGlossary());
          },
        },
        props: {
          decorations(state) {
            return glossaryPluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

function buildDecorations(
  doc: ProseMirrorNode,
  glossary: Glossary | null,
): DecorationSet {
  if (!glossary?.regex) return DecorationSet.empty;
  const regex = glossary.regex;
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const text = node.text ?? "";
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      const entry = glossary.lookup.get(match[0].toLowerCase());
      if (!entry) continue;
      const start = pos + match.index;
      const end = start + match[0].length;
      decorations.push(
        Decoration.inline(start, end, {
          class: "glossary-term",
          title: entry.definitionPreview || entry.canonical,
          "data-term": entry.canonical,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
