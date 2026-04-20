import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafe } from "@/lib/content-paths";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { path: parts } = await ctx.params;
    const abs = resolveSafe(parts);
    const raw = await fs.readFile(abs, "utf8");
    return NextResponse.json({ content: JSON.parse(raw) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return bad(msg, 404);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { path: parts } = await ctx.params;
    const abs = resolveSafe(parts);
    const body = await req.json();
    if (!("content" in body)) return bad("missing content");
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, JSON.stringify(body.content, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "unknown", 500);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  // Create new empty file. Fails if exists.
  try {
    const { path: parts } = await ctx.params;
    const abs = resolveSafe(parts);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const exists = await fs.stat(abs).then(
      () => true,
      () => false,
    );
    if (exists) return bad("file exists", 409);
    const url = new URL(req.url);
    const isDir = url.searchParams.get("dir") === "1";
    if (isDir) {
      await fs.mkdir(abs, { recursive: false });
    } else {
      const empty = {
        type: "doc",
        content: [{ type: "paragraph" }],
      };
      await fs.writeFile(abs, JSON.stringify(empty, null, 2), "utf8");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "unknown", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { path: parts } = await ctx.params;
    const abs = resolveSafe(parts);
    const stat = await fs.stat(abs);
    if (stat.isDirectory()) {
      await fs.rm(abs, { recursive: true, force: true });
    } else {
      await fs.unlink(abs);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "unknown", 500);
  }
}
