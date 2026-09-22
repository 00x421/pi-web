import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getAllowedFileRoots, isFilePathAllowed, isWindowsAbsolutePath } from "@/lib/file-access";
import {
  indexProjectFiles,
  pickProjectFile,
  type DroppedFileDescriptor,
} from "@/lib/attachment-resolve";

export const runtime = "nodejs";

function parseDroppedFiles(value: unknown): DroppedFileDescriptor[] {
  if (!Array.isArray(value)) return [];
  const files: DroppedFileDescriptor[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { name, size } = entry as { name?: unknown; size?: unknown };
    if (typeof name !== "string" || !name) continue;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) continue;
    files.push({ name, size });
  }
  return files;
}

// POST /api/attachments/resolve  { cwd, files: [{ name, size }] }
// Files that already live inside the project resolve to their project-relative
// path, so a drag can reference the real file instead of an uploaded copy.
// Anything unresolved is left to the caller, which uploads it.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { cwd?: unknown; files?: unknown } | null;

  const cwd = typeof body?.cwd === "string" ? body.cwd.trim() : "";
  if (!cwd || (!cwd.startsWith("/") && !isWindowsAbsolutePath(cwd))) {
    return NextResponse.json({ error: "cwd must be an absolute path" }, { status: 400 });
  }

  const files = parseDroppedFiles(body?.files);
  if (files.length === 0) return NextResponse.json({ resolved: [] });

  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(cwd, allowedRoots)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const candidates = await indexProjectFiles(cwd, files.map((file) => file.name));
  const resolved = files.flatMap((file) => {
    const match = pickProjectFile(file, candidates);
    // Absolute path is what the input references: a relative one is correct but
    // reads as "not a real path" and breaks when the session cwd changes.
    return match ? [{ name: file.name, path: path.join(cwd, match), relativePath: match }] : [];
  });

  // Temporary diagnostics: shows exactly what a drop asked for and why it did
  // or did not resolve to a project file.
  console.log(
    "[attachments/resolve]",
    JSON.stringify({
      cwd,
      requested: files.map((file) => `${file.name} (${file.size}B)`),
      candidates: candidates.length,
      resolved: resolved.map((entry) => entry.path),
    }),
  );

  return NextResponse.json({ resolved });
}
