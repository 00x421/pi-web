import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getAllowedFileRoots, isExistingFilePathAllowed, isFilePathAllowed, isWindowsAbsolutePath } from "@/lib/file-access";
import { documentKind, truncateDocumentText } from "@/lib/document-text";

export const runtime = "nodejs";

/** Documents above this size are refused before we try to parse them. */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

// POST /api/documents/extract  { path }  ->  { kind, text, truncated, chars }
// Turns a dropped document into plain text the agent can read: a .docx is a zip
// archive, so the model would otherwise only see binary noise.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { path?: unknown } | null;
  const filePath = typeof body?.path === "string" ? body.path.trim() : "";
  if (!filePath || (!filePath.startsWith("/") && !isWindowsAbsolutePath(filePath))) {
    return NextResponse.json({ error: "path must be an absolute path" }, { status: 400 });
  }

  const kind = documentKind(filePath);
  if (!kind) {
    return NextResponse.json({ error: "Unsupported document type" }, { status: 415 });
  }

  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(filePath, allowedRoots) || !isExistingFilePathAllowed(filePath, allowedRoots)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (stat.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Document is too large to extract" }, { status: 413 });
  }

  try {
    let text: string;
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else {
      text = await fs.readFile(filePath, "utf8");
    }

    const { text: trimmed, truncated } = truncateDocumentText(text);
    return NextResponse.json({ kind, text: trimmed, truncated, chars: text.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
