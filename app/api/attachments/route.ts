import fs from "fs/promises";
import { homedir } from "os";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { allowFileRoot } from "@/lib/allowed-roots";
import {
  ATTACHMENTS_FORM_FIELD,
  MAX_ATTACHMENT_BYTES,
  isSafeAttachmentName,
  uniqueAttachmentName,
} from "@/lib/attachments";

export const runtime = "nodejs";

/**
 * Dropped files are stored outside every session cwd so a drag never writes
 * into the project. Set PI_WEB_ATTACHMENTS_DIR to keep them somewhere else.
 */
export function getAttachmentsDirectory(): string {
  const override = process.env.PI_WEB_ATTACHMENTS_DIR?.trim();
  return override ? path.resolve(override) : path.join(homedir(), ".pi", "attachments");
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected a multipart form" }, { status: 400 });
  }

  const files = form.getAll(ATTACHMENTS_FORM_FIELD).filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files in the request" }, { status: 400 });
  }

  const unsafe = files.find((file) => !isSafeAttachmentName(file.name));
  if (unsafe) {
    return NextResponse.json({ error: `Invalid file name: ${unsafe.name}` }, { status: 400 });
  }

  const oversized = files.find((file) => file.size > MAX_ATTACHMENT_BYTES);
  if (oversized) {
    return NextResponse.json({ error: `File is too large: ${oversized.name}` }, { status: 413 });
  }

  const directory = getAttachmentsDirectory();
  await fs.mkdir(directory, { recursive: true });
  // Attachments live outside every session cwd, so the directory has to be
  // registered before the file APIs may preview the dropped file.
  allowFileRoot(directory);

  const taken = new Set(await fs.readdir(directory));
  const saved: { name: string; path: string; size: number }[] = [];
  for (const file of files) {
    const name = uniqueAttachmentName(file.name, taken);
    taken.add(name);
    const target = path.join(directory, name);
    await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
    saved.push({ name, path: target, size: file.size });
  }

  return NextResponse.json({ directory, files: saved });
}
