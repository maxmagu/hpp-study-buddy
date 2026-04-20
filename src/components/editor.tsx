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

function isListElement(el: Element | null): el is HTMLUListElement | HTMLOListElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag !== "UL" && tag !== "OL") return false;
  if ((el as HTMLElement).dataset.type === "taskList") return false;
  return true;
}

function isHeadingElement(el: Element | null): el is HTMLHeadingElement {
  return !!el && /^H[1-3]$/.test(el.tagName);
}

function pairedHeading(list: Element): HTMLHeadingElement | null {
  const prev = list.previousElementSibling;
  return isHeadingElement(prev) ? prev : null;
}

function listAfterHeading(heading: Element): HTMLElement | null {
  const next = heading.nextElementSibling;
  return isListElement(next) ? (next as HTMLElement) : null;
}

function getDirectListItems(list: Element): HTMLElement[] {
  return Array.from(list.children).filter(
    (el) => el.tagName === "LI",
  ) as HTMLElement[];
}

function coverAllLists(root: HTMLElement) {
  const lists = root.querySelectorAll<HTMLElement>("ul, ol");
  lists.forEach((list) => {
    if (list.dataset.type === "taskList") return;
    getDirectListItems(list).forEach((li) => li.classList.add("recall-covered"));
  });
}

function uncoverAll(root: HTMLElement) {
  root
    .querySelectorAll<HTMLElement>(".recall-covered")
    .forEach((li) => li.classList.remove("recall-covered"));
  root
    .querySelectorAll<HTMLElement>(".recall-active")
    .forEach((el) => el.classList.remove("recall-active"));
}

export function Editor({
  path,
  recallMode,
}: {
  path: string | null;
  recallMode: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const saveTimerRef = useRef<number | null>(null);
  const pendingRef = useRef<JSONContent | null>(null);
  const currentPathRef = useRef<string | null>(null);

  const flushRef = useRef<() => Promise<void>>(async () => {});
  const lastSavedJsonRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeListRef = useRef<HTMLElement | null>(null);
  const recallModeRef = useRef(recallMode);
  const applyingContentRef = useRef(false);
  const [revealed, setRevealed] = useState(0);
  const [activeListKey, setActiveListKey] = useState(0);
  const [prevPath, setPrevPath] = useState<string | null>(path);
  const [prevRecallMode, setPrevRecallMode] = useState(recallMode);

  if (prevPath !== path) {
    setPrevPath(path);
    setRevealed(0);
    setActiveListKey((k) => k + 1);
    setStatus(path ? "loading" : "idle");
  }

  if (prevRecallMode !== recallMode) {
    setPrevRecallMode(recallMode);
    if (!recallMode) setRevealed(0);
  }

  useEffect(() => {
    recallModeRef.current = recallMode;
  }, [recallMode]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
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
      if (applyingContentRef.current) return;
      if (recallModeRef.current) return;
      if (!currentPathRef.current) return;
      const json = editor.getJSON();
      const str = JSON.stringify(json);
      if (str === lastSavedJsonRef.current) return;
      pendingRef.current = json;
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
    const json = JSON.stringify(content);
    if (json === lastSavedJsonRef.current) {
      pendingRef.current = null;
      setStatus("saved");
      return;
    }
    setStatus("saving");
    const ok = await saveFile(p, content);
    if (ok) lastSavedJsonRef.current = json;
    if (pendingRef.current === content) pendingRef.current = null;
    setStatus(ok ? "saved" : "error");
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => {
    if (!editor) return;
    const loading = status === "loading";
    editor.setEditable(!(recallMode || loading));
  }, [editor, recallMode, status]);

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
    activeListRef.current = null;

    editor.setEditable(false);

    if (!path) {
      applyingContentRef.current = true;
      editor.commands.setContent(EMPTY_DOC, { emitUpdate: false });
      applyingContentRef.current = false;
      lastSavedJsonRef.current = JSON.stringify(EMPTY_DOC);
      return;
    }

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
        const loaded = content ?? EMPTY_DOC;
        applyingContentRef.current = true;
        editor.commands.setContent(loaded, { emitUpdate: false });
        applyingContentRef.current = false;
        lastSavedJsonRef.current = JSON.stringify(loaded);
        setStatus("saved");
        if (recallModeRef.current && containerRef.current) {
          coverAllLists(containerRef.current);
        }
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

  // Cover or uncover all lists when recall mode toggles.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    if (recallMode) {
      coverAllLists(root);
    } else {
      uncoverAll(root);
      activeListRef.current = null;
    }
  }, [recallMode]);

  // Apply reveals to the active list only.
  useEffect(() => {
    if (!recallMode) return;
    const list = activeListRef.current;
    if (!list) return;
    const items = getDirectListItems(list);
    items.forEach((li, i) => {
      if (i < revealed) li.classList.remove("recall-covered");
      else li.classList.add("recall-covered");
    });
  }, [revealed, activeListKey, recallMode]);

  const selectList = useCallback(
    (list: HTMLElement, opts: { scroll?: boolean } = {}) => {
      const prev = activeListRef.current;
      if (prev && prev !== list) {
        prev.classList.remove("recall-active");
        pairedHeading(prev)?.classList.remove("recall-active");
        getDirectListItems(prev).forEach((li) =>
          li.classList.add("recall-covered"),
        );
      }
      list.classList.add("recall-active");
      const heading = pairedHeading(list);
      heading?.classList.add("recall-active");
      activeListRef.current = list;
      setRevealed(0);
      setActiveListKey((k) => k + 1);
      if (opts.scroll) {
        (heading ?? list).scrollIntoView({ block: "nearest" });
      }
    },
    [],
  );

  // Click on a list in recall mode selects it as the active list.
  useEffect(() => {
    if (!recallMode) return;
    const root = containerRef.current;
    if (!root) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || !root) return;

      let list: Element | null = null;
      const heading = target.closest("h1, h2, h3");
      if (heading && root.contains(heading)) {
        list = listAfterHeading(heading);
      } else {
        list = target.closest("ul, ol");
      }
      if (!isListElement(list)) return;
      if (!root.contains(list)) return;
      selectList(list);
      e.preventDefault();
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [recallMode, selectList]);

  // Keyboard shortcuts in recall mode: Space reveals, X resets, ↑/↓ switch lists.
  useEffect(() => {
    if (!recallMode) return;

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const root = containerRef.current;
        if (!root) return;
        const lists = Array.from(
          root.querySelectorAll<HTMLElement>("ul, ol"),
        ).filter(
          (l) =>
            l.dataset.type !== "taskList" &&
            (l.parentElement?.tagName ?? "") !== "LI",
        );
        if (lists.length === 0) return;
        const current = activeListRef.current;
        const currentIdx = current ? lists.indexOf(current) : -1;
        let nextIdx: number;
        if (e.key === "ArrowDown") {
          nextIdx = currentIdx < 0 ? 0 : Math.min(currentIdx + 1, lists.length - 1);
        } else {
          nextIdx = currentIdx < 0 ? lists.length - 1 : Math.max(currentIdx - 1, 0);
        }
        if (nextIdx !== currentIdx) selectList(lists[nextIdx], { scroll: true });
        e.preventDefault();
        return;
      }

      const list = activeListRef.current;
      if (!list) return;

      if (e.key === " ") {
        const items = getDirectListItems(list);
        setRevealed((r) => Math.min(r + 1, items.length));
        e.preventDefault();
      } else if (e.key === "x" || e.key === "X") {
        setRevealed(0);
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recallMode, selectList]);

  if (!path) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 dark:text-zinc-500 text-sm">
        Select or create a file to start writing.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="shrink-0 h-10 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="truncate font-mono">{path}</div>
        <div className="flex items-center gap-3">
          {!recallMode && (
            <>
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={cn(
                    "px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
                    editor?.isActive("heading", { level }) &&
                      "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50",
                  )}
                  onClick={() =>
                    editor?.chain().focus().toggleHeading({ level }).run()
                  }
                  title={`Heading ${level} (⌘/Ctrl + Alt + ${level})`}
                >
                  H{level}
                </button>
              ))}
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  editor?.isActive("bulletList") &&
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50",
                )}
                onClick={() =>
                  editor?.chain().focus().toggleBulletList().run()
                }
                title="Bulleted list (⌘/Ctrl + Shift + 8)"
              >
                • List
              </button>
              <button
                type="button"
                className={cn(
                  "px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  editor?.isActive("orderedList") &&
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50",
                )}
                onClick={() =>
                  editor?.chain().focus().toggleOrderedList().run()
                }
                title="Numbered list (⌘/Ctrl + Shift + 7)"
              >
                1. List
              </button>
            </>
          )}
          {recallMode && (
            <span className="text-indigo-600 dark:text-indigo-400">
              Recall · ↑↓ pick list · Space reveal · X reset
            </span>
          )}
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
      <div
        ref={containerRef}
        className={cn("flex-1 overflow-auto", recallMode && "recall-mode")}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
