import path from "node:path";
import fs from "node:fs/promises";

const configured = process.env.CONTENT_DIR ?? "./content";
export const CONTENT_ROOT = path.resolve(process.cwd(), configured);

export async function ensureRoot(): Promise<void> {
  await fs.mkdir(CONTENT_ROOT, { recursive: true });
}

export function resolveSafe(relParts: string[]): string {
  const joined = path.join(...relParts);
  const resolved = path.resolve(CONTENT_ROOT, joined);
  const rel = path.relative(CONTENT_ROOT, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes content root: ${joined}`);
  }
  return resolved;
}

export type TreeNode =
  | { type: "file"; name: string; path: string }
  | { type: "dir"; name: string; path: string; children: TreeNode[] };

export async function readTree(dir = CONTENT_ROOT, rel = ""): Promise<TreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const childAbs = path.join(dir, e.name);
    if (e.isDirectory()) {
      nodes.push({
        type: "dir",
        name: e.name,
        path: childRel,
        children: await readTree(childAbs, childRel),
      });
    } else if (e.isFile() && e.name.endsWith(".json")) {
      nodes.push({ type: "file", name: e.name, path: childRel });
    }
  }
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return collator.compare(a.name, b.name);
  });
  return nodes;
}
