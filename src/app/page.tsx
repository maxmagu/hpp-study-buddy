"use client";

import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileTree } from "@/components/file-tree";
import { Editor } from "@/components/editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSearch } from "@/lib/use-search";
import { cn } from "@/lib/utils";

const LAST_PATH_KEY = "studybuddy:lastPath";
const FONT_SCALE_KEY = "studybuddy:fontScale";
const TREE_WIDTH_KEY = "studybuddy:treeWidth";
const MIN_SCALE = 0.8;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;
const MIN_TREE_WIDTH = 160;
const MAX_TREE_WIDTH = 600;
const DEFAULT_TREE_WIDTH = 256;

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.round(n * 10) / 10;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, rounded));
}

function clampWidth(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_TREE_WIDTH;
  return Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, Math.round(n)));
}

export default function Home() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [recallMode, setRecallMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [treeWidth, setTreeWidth] = useState(DEFAULT_TREE_WIDTH);
  const restoredRef = useRef(false);
  const { search } = useSearch();

  useEffect(() => {
    // localStorage is unavailable during SSR, so we hydrate from it
    // post-mount. Lazy-initialising useState would either crash on the
    // server or cause a hydration mismatch — accept one extra render.
    /* eslint-disable react-hooks/set-state-in-effect */
    const savedPath = window.localStorage.getItem(LAST_PATH_KEY);
    if (savedPath) setSelectedPath(savedPath);
    const savedScale = window.localStorage.getItem(FONT_SCALE_KEY);
    if (savedScale) setFontScale(clampScale(parseFloat(savedScale)));
    const savedWidth = window.localStorage.getItem(TREE_WIDTH_KEY);
    if (savedWidth) setTreeWidth(clampWidth(parseInt(savedWidth, 10)));
    /* eslint-enable react-hooks/set-state-in-effect */
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
    if (!restoredRef.current) return;
    window.localStorage.setItem(TREE_WIDTH_KEY, String(treeWidth));
  }, [treeWidth]);

  function startTreeResize(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = treeWidth;
    function move(ev: PointerEvent) {
      setTreeWidth(clampWidth(startW + (ev.clientX - startX)));
    }
    function end() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }

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

  const hits = useMemo(
    () => (searchQuery.trim() ? search(searchQuery) : []),
    [searchQuery, search],
  );

  const highlightPaths = useMemo(
    () => new Set(hits.map((h) => h.path)),
    [hits],
  );

  const searchTerms = useMemo(() => {
    if (!selectedPath) return [];
    const hit = hits.find((h) => h.path === selectedPath);
    return hit?.matchedTerms ?? [];
  }, [hits, selectedPath]);

  const onPathMissing = useCallback((p: string) => {
    setSelectedPath((cur) => (cur === p ? null : cur));
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
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search"
            className="text-xs px-2 py-1 w-56 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
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
        <aside
          style={{ width: treeWidth }}
          className="shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40"
        >
          <FileTree
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            highlightPaths={highlightPaths}
          />
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize file tree"
          onPointerDown={startTreeResize}
          className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-indigo-400/40 active:bg-indigo-500/60"
        />
        <main className="flex-1 flex flex-col min-w-0">
          <Editor
            path={selectedPath}
            recallMode={recallMode}
            searchTerms={searchTerms}
            onPathMissing={onPathMissing}
          />
        </main>
      </div>
    </div>
  );
}
