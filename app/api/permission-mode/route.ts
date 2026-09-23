import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { isPermissionMode, readPermissionMode, writePermissionMode } from "@/lib/permission-mode";

export const runtime = "nodejs";

// GET  /api/permission-mode                   → { available, mode }
// POST /api/permission-mode { mode }          → { available, mode }
// Three modes: strict (every step asks), ask (only "ask" rules ask), yolo
// (auto-approve). The rules themselves are preserved; strict remembers the
// top-level default in pi-web's own file and restores it on the way out.
export async function GET() {
  return NextResponse.json(readPermissionMode());
}

export async function POST(request: Request) {
  // This flips a global security switch, so it takes the same gate as the other
  // mutating endpoints: same-origin (or a non-browser client, which sends no
  // Origin) and a JSON body — a text/plain form POST from another site would
  // otherwise skip the CORS preflight and still parse as JSON here.
  if (!isApiRequestAllowed(request) || !hasJsonContentType(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as { mode?: unknown } | null;
  if (!isPermissionMode(body?.mode)) {
    return NextResponse.json({ error: "mode must be strict, ask or yolo" }, { status: 400 });
  }
  try {
    return NextResponse.json(writePermissionMode(body.mode));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
