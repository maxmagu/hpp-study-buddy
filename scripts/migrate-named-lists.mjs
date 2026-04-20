#!/usr/bin/env node
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = resolve(process.cwd(), process.env.CONTENT_DIR ?? "./content");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function transform(node) {
  if (!node || typeof node !== "object") return { node, changes: 0 };
  if (!Array.isArray(node.content)) return { node, changes: 0 };

  let changes = 0;
  const next = [];
  for (const child of node.content) {
    if (child && child.type === "namedList") {
      changes += 1;
      const title = child.content?.[0];
      const list = child.content?.[1];
      const titleInline =
        title && Array.isArray(title.content) ? title.content : [];
      const hasTitleText = titleInline.some(
        (n) => n && typeof n.text === "string" && n.text.trim().length > 0,
      );
      if (hasTitleText) {
        next.push({
          type: "heading",
          attrs: { level: 3 },
          content: titleInline,
        });
      }
      if (list) {
        const { node: rewritten, changes: sub } = transform(list);
        changes += sub;
        next.push(rewritten);
      }
    } else {
      const { node: rewritten, changes: sub } = transform(child);
      changes += sub;
      next.push(rewritten);
    }
  }
  return { node: { ...node, content: next }, changes };
}

async function main() {
  const files = await walk(ROOT);
  let touched = 0;
  let totalChanges = 0;
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    let doc;
    try {
      doc = JSON.parse(raw);
    } catch {
      console.log(`skip (invalid JSON): ${file}`);
      continue;
    }
    const { node, changes } = transform(doc);
    if (changes === 0) continue;
    touched += 1;
    totalChanges += changes;
    console.log(`${DRY ? "[dry] " : ""}${file}: ${changes} namedList(s)`);
    if (!DRY) {
      await writeFile(file, JSON.stringify(node, null, 2), "utf8");
    }
  }
  console.log(
    `${DRY ? "[dry] " : ""}${touched} file(s), ${totalChanges} namedList(s) ${DRY ? "would be" : ""}migrated`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
