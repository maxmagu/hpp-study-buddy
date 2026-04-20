"use client";

import { useState } from "react";
import { FileTree } from "@/components/file-tree";
import { Editor } from "@/components/editor";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  return (
    <div className="flex flex-1 h-screen w-full overflow-hidden">
      <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-sm font-semibold">StuyBuddy</span>
          <ThemeToggle />
        </div>
        <FileTree selectedPath={selectedPath} onSelect={setSelectedPath} />
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <Editor path={selectedPath} />
      </main>
    </div>
  );
}
