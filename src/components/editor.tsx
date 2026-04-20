"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Toggle,
  ToggleSummary,
  ToggleContent,
} from "@/lib/tiptap/toggle";
import { RecallList, RecallItem } from "@/lib/tiptap/recall-list";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "dirty" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const lowlight = createLowlight(common);

function statusLabel(s: Status): string {
  switch (s) {
    case "idle":
      return "";
    case "loading":
      return "Loading…";
    case "dirty":
      return "Unsaved";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
  }
}

async function saveFile(p: string, content: JSONContent): Promise<boolean> {
  const parts = p.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const res = await fetch(`/api/file/${parts}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  return res.ok;
}

export function Editor({
  path,
  onInsertToggle,
  onInsertRecall,
}: {
  path: string | null;
  onInsertToggle?: () => void;
  onInsertRecall?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<JSONContent | null>(null);
  const currentPathRef = useRef<string | null>(null);

  const flushRef = useRef<() => Promise<void>>(async () => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Toggle,
      ToggleSummary,
      ToggleContent,
      RecallList,
      RecallItem,
    ],
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-zinc dark:prose-invert max-w-none",
          "focus:outline-none py-10 px-12 min-h-full",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      pendingRef.current = editor.getJSON();
      setStatus("dirty");
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void flushRef.current();
      }, DEBOUNCE_MS);
    },
    onBlur: () => {
      if (pendingRef.current) void flushRef.current();
    },
  });

  const flush = useCallback(async () => {
    const p = currentPathRef.current;
    const content = pendingRef.current;
    if (!p || !content) return;
    setStatus("saving");
    const ok = await saveFile(p, content);
    if (pendingRef.current === content) pendingRef.current = null;
    setStatus(ok ? "saved" : "error");
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!editor) return;

    const prevPath = currentPathRef.current;
    const prevPending = pendingRef.current;

    if (prevPath && prevPending && prevPath !== path) {
      void saveFile(prevPath, prevPending);
      pendingRef.current = null;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    currentPathRef.current = path;

    if (!path) {
      editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });
      setStatus("idle");
      return;
    }

    setStatus("loading");
    let cancelled = false;
    const parts = path
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    fetch(`/api/file/${parts}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(({ content }) => {
        if (cancelled) return;
        editor.commands.setContent(content ?? EMPTY_DOC, { emitUpdate: false });
        setStatus("saved");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [path, editor]);

  useEffect(() => {
    function onBeforeUnload() {
      const p = currentPathRef.current;
      const content = pendingRef.current;
      if (!p || !content) return;
      // sendBeacon for best-effort flush on close
      const parts = p
        .split("/")
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/");
      const blob = new Blob([JSON.stringify({ content })], {
        type: "application/json",
      });
      navigator.sendBeacon?.(`/api/file/${parts}`, blob);
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!path) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 dark:text-zinc-500 text-sm">
        Select or create a file to start writing.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="truncate font-mono">{path}</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              editor?.commands.insertToggle();
              onInsertToggle?.();
            }}
          >
            + Toggle
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              editor?.commands.insertRecallList();
              onInsertRecall?.();
            }}
          >
            + Recall
          </button>
          <span
            className={cn(
              "tabular-nums",
              status === "error" && "text-red-500",
              status === "saved" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {statusLabel(status)}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
