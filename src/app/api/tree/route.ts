import { NextResponse } from "next/server";
import { ensureRoot, readTree } from "@/lib/content-paths";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureRoot();
    const tree = await readTree();
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 },
    );
  }
}
