import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    namedList: {
      insertNamedList: () => ReturnType;
    };
  }
}

export const NamedListTitle = Node.create({
  name: "namedListTitle",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-node='named-list-title']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-node": "named-list-title" }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "namedListTitle") return false;
        if ($from.parentOffset !== 0) return false;
        const listDepth = $from.depth - 1;
        if ($from.node(listDepth).type.name !== "namedList") return false;
        const paragraphType = state.schema.nodes.paragraph;
        if (!paragraphType) return false;
        const insertPos = $from.before(listDepth);
        view.dispatch(state.tr.insert(insertPos, paragraphType.create()));
        return true;
      },
      Backspace: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "namedListTitle") return false;
        if ($from.parentOffset !== 0) return false;
        const listDepth = $from.depth - 1;
        if ($from.node(listDepth).type.name !== "namedList") return false;
        const beforeList = $from.before(listDepth);
        if (beforeList === 0) return false;
        const $beforeList = state.doc.resolve(beforeList);
        const nodeBefore = $beforeList.nodeBefore;
        if (!nodeBefore) return false;
        if (nodeBefore.type.name !== "paragraph") return false;
        if (nodeBefore.content.size !== 0) return false;
        view.dispatch(
          state.tr.delete(beforeList - nodeBefore.nodeSize, beforeList),
        );
        return true;
      },
    };
  },
});

export const NamedList = Node.create({
  name: "namedList",
  group: "block",
  content: "namedListTitle bulletList",
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-node='named-list']" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-node": "named-list" }),
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor;
        const { $from, empty } = state.selection;
        if (!empty) return false;
        if ($from.parentOffset !== 0) return false;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== "namedList") continue;
          if (node.textContent !== "") return false;
          const pos = $from.before(d);
          view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
          return true;
        }
        return false;
      },
    };
  },
  addCommands() {
    return {
      insertNamedList:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: "namedList",
              content: [
                { type: "namedListTitle" },
                {
                  type: "bulletList",
                  content: [
                    { type: "listItem", content: [{ type: "paragraph" }] },
                  ],
                },
              ],
            })
            .command(({ tr, dispatch }) => {
              if (!dispatch) return true;
              const cursor = tr.selection.from;
              let titlePos: number | null = null;
              tr.doc.descendants((node, pos) => {
                if (node.type.name === "namedListTitle" && pos < cursor) {
                  titlePos = pos + 1;
                }
              });
              if (titlePos !== null) {
                tr.setSelection(TextSelection.create(tr.doc, titlePos));
              }
              return true;
            })
            .focus()
            .run(),
    };
  },
});
