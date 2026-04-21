"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TreeNode =
  | { type: "file"; name: string; path: string }
  | { type: "dir"; name: string; path: string; children: TreeNode[] };

type MenuState = {
  x: number;
  y: number;
  target:
    | { kind: "empty" }
    | { kind: "node"; node: TreeNode };
};

function encodePath(p: string) {
  return p.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

async function apiCreate(path: string, isDir: boolean) {
  const res = await fetch(
    `/api/file/${encodePath(path)}${isDir ? "?dir=1" : ""}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error((await res.json()).error ?? "create failed");
}

async function apiDelete(path: string) {
  const res = await fetch(`/api/file/${encodePath(path)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "delete failed");
}

async function apiMove(from: string, to: string) {
  const res = await fetch("/api/move", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "move failed");
}

function promptName(kind: "file" | "folder", initial = ""): string | null {
  const raw = window.prompt(
    `New ${kind} name${kind === "file" ? " (without .json)" : ""}:`,
    initial,
  );
  if (!raw) return null;
  const name = raw.trim();
  if (!name || name.includes("/") || name.startsWith(".")) {
    window.alert("Invalid name");
    return null;
  }
  return kind === "file" ? `${name}.json` : name;
}

function findParent(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

function basename(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx === -1 ? p : p.slice(idx + 1);
}

type DragState = { from: string; isDir: boolean };

function canDrop(d: DragState, targetFolder: string): boolean {
  if (d.from === targetFolder) return false;
  const parent = findParent(d.from);
  if (parent === targetFolder) return false;
  if (d.isDir && (targetFolder === d.from || targetFolder.startsWith(d.from + "/"))) {
    return false;
  }
  return true;
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.type === "dir") {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

function childrenAt(nodes: TreeNode[], folder: string): TreeNode[] {
  if (!folder) return nodes;
  const n = findNode(nodes, folder);
  return n && n.type === "dir" ? n.children : [];
}

type DragHandlers = {
  drag: DragState | null;
  dragOver: string | null;
  onDragStartNode: (path: string, isDir: boolean) => void;
  onDragEndNode: () => void;
  onDragOverFolder: (e: React.DragEvent, path: string) => void;
  onDragLeaveFolder: (path: string) => void;
  onDropFolder: (e: React.DragEvent, path: string) => void;
};

function TreeNodeView({
  node,
  depth,
  selectedPath,
  onSelect,
  onContextMenu,
  openDirs,
  toggleDir,
  drag,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, target: MenuState["target"]) => void;
  openDirs: Set<string>;
  toggleDir: (path: string) => void;
  drag: DragHandlers;
}) {
  const isDragging = drag.drag?.from === node.path;
  if (node.type === "dir") {
    const isOpen = openDirs.has(node.path);
    const isDropTarget = drag.dragOver === node.path;
    return (
      <div>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", node.path);
            drag.onDragStartNode(node.path, true);
          }}
          onDragEnd={drag.onDragEndNode}
          onDragOver={(e) => drag.onDragOverFolder(e, node.path)}
          onDragLeave={() => drag.onDragLeaveFolder(node.path)}
          onDrop={(e) => drag.onDropFolder(e, node.path)}
          className={cn(
            "group flex items-center gap-1 px-2 py-1 text-sm cursor-pointer rounded",
            "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
            isDragging && "opacity-40",
            isDropTarget &&
              "bg-indigo-100 dark:bg-indigo-900/30 outline outline-1 outline-indigo-400",
          )}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => toggleDir(node.path)}
          onContextMenu={(e) =>
            onContextMenu(e, { kind: "node", node })
          }
        >
          <span className="w-3 text-zinc-400 text-xs">
            {isOpen ? "▾" : "▸"}
          </span>
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                openDirs={openDirs}
                toggleDir={toggleDir}
                drag={drag}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  const isSelected = selectedPath === node.path;
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.path);
        drag.onDragStartNode(node.path, false);
      }}
      onDragEnd={drag.onDragEndNode}
      className={cn(
        "flex items-center gap-1 px-2 py-1 text-sm cursor-pointer rounded",
        isSelected
          ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
        isDragging && "opacity-40",
      )}
      style={{ paddingLeft: 8 + depth * 12 + 12 }}
      onClick={() => onSelect(node.path)}
      onContextMenu={(e) => onContextMenu(e, { kind: "node", node })}
    >
      <span className="truncate">
        {node.name.replace(/\.json$/, "")}
      </span>
    </div>
  );
}

export function FileTree({
  selectedPath,
  onSelect,
}: {
  selectedPath: string | null;
  onSelect: (path: string | null) => void;
}) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tree?t=${Date.now()}`);
      if (!res.ok) throw new Error("tree fetch failed");
      const { tree } = await res.json();
      setTree(tree);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!menu) return;
    function close(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setMenu(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function openMenu(e: React.MouseEvent, target: MenuState["target"]) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, target });
  }

  function toggleDir(path: string) {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function handleNew(kind: "file" | "folder", parent: string) {
    const name = promptName(kind);
    if (!name) return;
    const target = parent ? `${parent}/${name}` : name;
    try {
      await apiCreate(target, kind === "folder");
      if (parent) {
        setOpenDirs((s) => new Set(s).add(parent));
      }
      await refresh();
      if (kind === "file") onSelect(target);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "create failed");
    }
  }

  async function handleDelete(node: TreeNode) {
    const label = node.type === "dir" ? "folder (and all contents)" : "file";
    if (!window.confirm(`Delete ${label} "${node.name}"?`)) return;
    try {
      await apiDelete(node.path);
      if (selectedPath === node.path || selectedPath?.startsWith(node.path + "/")) {
        onSelect(null);
      }
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "delete failed");
    }
  }

  async function performMove(from: string, targetFolder: string) {
    const name = basename(from);
    const to = targetFolder ? `${targetFolder}/${name}` : name;
    const siblings = childrenAt(tree, targetFolder);
    if (siblings.some((s) => s.name === name && s.path !== from)) {
      window.alert(`"${name}" already exists in the target folder.`);
      return;
    }
    try {
      await apiMove(from, to);
      if (selectedPath === from) onSelect(to);
      else if (selectedPath?.startsWith(from + "/")) {
        onSelect(to + selectedPath.slice(from.length));
      }
      if (targetFolder) setOpenDirs((s) => new Set(s).add(targetFolder));
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "move failed");
    }
  }

  const dragHandlers: DragHandlers = {
    drag,
    dragOver,
    onDragStartNode(path, isDir) {
      setDrag({ from: path, isDir });
    },
    onDragEndNode() {
      setDrag(null);
      setDragOver(null);
    },
    onDragOverFolder(e, target) {
      if (!drag) return;
      e.stopPropagation();
      if (!canDrop(drag, target)) {
        if (dragOver !== null) setDragOver(null);
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOver !== target) setDragOver(target);
    },
    onDragLeaveFolder(target) {
      if (dragOver === target) setDragOver(null);
    },
    async onDropFolder(e, target) {
      e.preventDefault();
      e.stopPropagation();
      const current = drag;
      setDrag(null);
      setDragOver(null);
      if (!current) return;
      if (!canDrop(current, target)) return;
      await performMove(current.from, target);
    },
  };

  async function handleRename(node: TreeNode) {
    const initial =
      node.type === "file" ? node.name.replace(/\.json$/, "") : node.name;
    const raw = window.prompt("New name:", initial);
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.includes("/") || trimmed.startsWith(".")) {
      window.alert("Invalid name");
      return;
    }
    const parent = findParent(node.path);
    const newName =
      node.type === "file" ? `${trimmed}.json` : trimmed;
    const newPath = parent ? `${parent}/${newName}` : newName;
    if (newPath === node.path) return;
    try {
      await apiMove(node.path, newPath);
      if (selectedPath === node.path) onSelect(newPath);
      await refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "rename failed");
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) openMenu(e, { kind: "empty" });
      }}
    >
      <div className="shrink-0 h-10 flex items-center justify-between px-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="New file"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm px-1"
            onClick={() => handleNew("file", "")}
          >
            +
          </button>
          <button
            type="button"
            title="Refresh"
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm px-1"
            onClick={() => void refresh()}
          >
            ↻
          </button>
        </div>
      </div>
      <div
        className={cn(
          "flex-1 overflow-auto py-1 px-1",
          dragOver === "" &&
            "outline outline-1 outline-indigo-400 bg-indigo-50/40 dark:bg-indigo-900/10",
        )}
        onDragOver={(e) => dragHandlers.onDragOverFolder(e, "")}
        onDragLeave={() => dragHandlers.onDragLeaveFolder("")}
        onDrop={(e) => dragHandlers.onDropFolder(e, "")}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) openMenu(e, { kind: "empty" });
        }}
      >
        {loading && (
          <div className="text-xs text-zinc-500 px-3 py-2">Loading…</div>
        )}
        {error && (
          <div className="text-xs text-red-500 px-3 py-2">{error}</div>
        )}
        {!loading && !error && tree.length === 0 && (
          <div className="text-xs text-zinc-500 px-3 py-4 leading-relaxed">
            No files yet. Click <b>+</b> or right-click to create one.
          </div>
        )}
        {tree.map((node) => (
          <TreeNodeView
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
            onContextMenu={openMenu}
            openDirs={openDirs}
            toggleDir={toggleDir}
            drag={dragHandlers}
          />
        ))}
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg py-1 text-sm"
          style={{ top: menu.y, left: menu.x }}
        >
          {menu.target.kind === "empty" && (
            <>
              <MenuItem onClick={() => { setMenu(null); void handleNew("file", ""); }}>
                New file
              </MenuItem>
              <MenuItem onClick={() => { setMenu(null); void handleNew("folder", ""); }}>
                New folder
              </MenuItem>
            </>
          )}
          {menu.target.kind === "node" && menu.target.node.type === "dir" && (
            <>
              <MenuItem
                onClick={() => {
                  const dir = menu.target.kind === "node" ? menu.target.node.path : "";
                  setMenu(null);
                  void handleNew("file", dir);
                }}
              >
                New file inside
              </MenuItem>
              <MenuItem
                onClick={() => {
                  const dir = menu.target.kind === "node" ? menu.target.node.path : "";
                  setMenu(null);
                  void handleNew("folder", dir);
                }}
              >
                New folder inside
              </MenuItem>
              <Separator />
              <MenuItem
                onClick={() => {
                  const node = menu.target.kind === "node" ? menu.target.node : null;
                  setMenu(null);
                  if (node) void handleRename(node);
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  const node = menu.target.kind === "node" ? menu.target.node : null;
                  setMenu(null);
                  if (node) void handleDelete(node);
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
          {menu.target.kind === "node" && menu.target.node.type === "file" && (
            <>
              <MenuItem
                onClick={() => {
                  const node = menu.target.kind === "node" ? menu.target.node : null;
                  setMenu(null);
                  if (node) void handleRename(node);
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  const node = menu.target.kind === "node" ? menu.target.node : null;
                  setMenu(null);
                  if (node) void handleDelete(node);
                }}
              >
                Delete
              </MenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800",
        danger && "text-red-600 dark:text-red-400",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="h-px my-1 bg-zinc-200 dark:bg-zinc-800" />;
}
