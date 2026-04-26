import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { CONTENT_ROOT, ensureRoot } from "@/lib/content-paths";
import type { JSONContent } from "@tiptap/react";

export const dynamic = "force-dynamic";

type Doc = { path: string; text: string };

function nodeText(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  if (!node.content) return "";
  return node.content.map(nodeText).join(" ");
}

function docText(doc: JSONContent | null | undefined): string {
  if (!doc?.content) return "";
  return doc.content.map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

async function walk(dir: string, rel: string, out: Doc[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const childAbs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(childAbs, childRel, out);
    } else if (e.isFile() && e.name.endsWith(".json")) {
      try {
        const raw = await fs.readFile(childAbs, "utf8");
        const json = JSON.parse(raw) as JSONContent;
        out.push({ path: childRel, text: docText(json) });
      } catch {
        out.push({ path: childRel, text: "" });
      }
    }
  }
}

export async function GET() {
  try {
    await ensureRoot();
    const docs: Doc[] = [];
    await walk(CONTENT_ROOT, "", docs);
    return NextResponse.json({ docs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
