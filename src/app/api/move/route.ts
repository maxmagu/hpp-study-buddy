import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveSafe } from "@/lib/content-paths";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { from, to } = await req.json();
    if (typeof from !== "string" || typeof to !== "string") {
      return NextResponse.json({ error: "from/to required" }, { status: 400 });
    }
    const src = resolveSafe(from.split("/").filter(Boolean));
    const dst = resolveSafe(to.split("/").filter(Boolean));
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
