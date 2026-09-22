import { NextResponse } from "next/server";
import { readPermissionMode, writePermissionMode } from "@/lib/permission-mode";

export const runtime = "nodejs";

// GET  /api/permission-mode                → { available, yolo }
// POST /api/permission-mode { yolo: bool } → { available, yolo }
// Only the permission extension's global switch is touched — its rules are read
// and written back unchanged, so a mis-click cannot wipe them.
export async function GET() {
  return NextResponse.json(readPermissionMode());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { yolo?: unknown } | null;
  if (typeof body?.yolo !== "boolean") {
    return NextResponse.json({ error: "yolo must be a boolean" }, { status: 400 });
  }
  try {
    return NextResponse.json(writePermissionMode(body.yolo));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
