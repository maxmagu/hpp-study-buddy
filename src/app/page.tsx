"use client";

import { useState } from "react";
import { FileTree } from "@/components/file-tree";
import { Editor } from "@/components/editor";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function Home() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [recallMode, setRecallMode] = useState(false);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <span className="text-sm font-semibold">StuyBuddy</span>
        <div className="flex items-center gap-2">
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
