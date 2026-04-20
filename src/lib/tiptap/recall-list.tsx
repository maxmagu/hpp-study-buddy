"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    recallList: {
      insertRecallList: () => ReturnType;
    };
  }
}

export const RecallItem = Node.create({
  name: "recallItem",
  content: "paragraph block*",
  defining: true,
  parseHTML() {
    return [{ tag: 'li[data-node="recall-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "li",
      mergeAttributes(HTMLAttributes, {
        "data-node": "recall-item",
        class: "recall-item",
      }),
      0,
    ];
  },
});

type Mode = "edit" | "study";

function RecallListView({ node }: NodeViewProps) {
  const [mode, setMode] = useState<Mode>("edit");
  const [revealed, setRevealed] = useState(0);
  const itemsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemCount = node.childCount;

  useEffect(() => {
    const root = itemsRef.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>(".recall-item");
    items.forEach((el, idx) => {
      const visible = mode === "edit" || idx < revealed;
      el.classList.toggle("recall-revealed", visible);
    });
  }, [mode, revealed, itemCount]);

  useEffect(() => {
    if (mode !== "study") return;
    wrapRef.current?.focus();
  }, [mode]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (mode !== "study") return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setRevealed((r) => Math.min(r + 1, itemCount));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setRevealed((r) => Math.max(r - 1, 0));
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      setRevealed(0);
    }
  }

  function enterStudy() {
    setRevealed(0);
    setMode("study");
  }

  return (
    <NodeViewWrapper
      className="recall-list"
      data-mode={mode}
      tabIndex={mode === "study" ? 0 : -1}
      onKeyDown={onKeyDown}
      {...{ ref: wrapRef }}
    >
      <div className="recall-toolbar" contentEditable={false}>
        <div className="recall-tabs">
          <button
            type="button"
            data-active={mode === "edit"}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            data-active={mode === "study"}
            onClick={enterStudy}
          >
            Study
          </button>
        </div>
        {mode === "study" && (
          <div className="recall-progress">
            <span>
              {revealed} / {itemCount}
            </span>
            <button type="button" onClick={() => setRevealed(0)}>
              Reset
            </button>
            <span className="recall-hint">
              Space/→ next · ← back · R reset
            </span>
          </div>
        )}
      </div>
      <div ref={itemsRef} className="recall-items-wrap">
        <NodeViewContent
          as={"ol" as unknown as "div"}
          className="recall-items"
        />
      </div>
    </NodeViewWrapper>
  );
}

export const RecallList = Node.create({
  name: "recallList",
  group: "block",
  content: "recallItem+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'ol[data-node="recall-list"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ol",
      mergeAttributes(HTMLAttributes, {
        "data-node": "recall-list",
        class: "recall-list",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(RecallListView);
  },

  addCommands() {
    return {
      insertRecallList:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              {
                type: "recallItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "First item" }],
                  },
                ],
              },
              {
                type: "recallItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Second item" }],
                  },
                ],
              },
            ],
          }),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Alt-r": () => this.editor.commands.insertRecallList(),
    };
  },
});
