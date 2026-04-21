"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { FileTree } from "@/components/file-tree";
import { Editor } from "@/components/editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const LAST_PATH_KEY = "studybuddy:lastPath";
const FONT_SCALE_KEY = "studybuddy:fontScale";
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.round(n * 10) / 10;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, rounded));
}

export default function Home() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [recallMode, setRecallMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const restoredRef = useRef(false);

  useEffect(() => {
    const savedPath = window.localStorage.getItem(LAST_PATH_KEY);
    if (savedPath) setSelectedPath(savedPath);
    const savedScale = window.localStorage.getItem(FONT_SCALE_KEY);
    if (savedScale) setFontScale(clampScale(parseFloat(savedScale)));
    restoredRef.current = true;
  }, []);

  useEffect(() => {
    if (!restoredRef.current) return;
    if (selectedPath) window.localStorage.setItem(LAST_PATH_KEY, selectedPath);
    else window.localStorage.removeItem(LAST_PATH_KEY);
  }, [selectedPath]);

  useEffect(() => {
    if (!restoredRef.current) return;
    window.localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        setRecallMode((v) => !v);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const atMin = fontScale <= MIN_SCALE + 1e-6;
  const atMax = fontScale >= MAX_SCALE - 1e-6;

  return (
    <div
      className="flex flex-col h-screen w-full overflow-hidden"
      style={{ "--editor-scale": String(fontScale) } as CSSProperties}
    >
      <header className="shrink-0 h-10 flex items-center justify-between px-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <span className="text-sm font-semibold">HPP Study Buddy</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setFontScale((s) => clampScale(s - SCALE_STEP))}
              disabled={atMin}
              className="text-xs px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Decrease font size"
              aria-label="Decrease font size"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => setFontScale((s) => clampScale(s + SCALE_STEP))}
              disabled={atMax}
              className="text-xs px-2 py-1 border-l border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-transparent"
              title="Increase font size"
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRecallMode((v) => !v)}
            className={cn(
              "text-xs px-2 py-1 rounded border transition-colors",
              recallMode
                ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500"
                : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            aria-pressed={recallMode}
            title="Toggle recall (⌘/Ctrl + .)"
          >
            {recallMode ? "Recall: on" : "Recall"}
          </button>
          <ThemeToggle />
        </div>
      </header>
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
          <FileTree selectedPath={selectedPath} onSelect={setSelectedPath} />
        </aside>
        <main className="flex-1 flex flex-col min-w-0">
          <Editor path={selectedPath} recallMode={recallMode} />
        </main>
      </div>
    </div>
  );
}
