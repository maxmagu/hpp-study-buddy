import { Node, mergeAttributes } from "@tiptap/core";

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
  addCommands() {
    return {
      insertNamedList:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: "namedList",
            content: [
              {
                type: "namedListTitle",
                content: [{ type: "text", text: "Untitled" }],
              },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph" }] },
                ],
              },
            ],
          }),
    };
  },
});
