// Dropped files are copied to the server before the chat input can reference
// them: a browser never exposes the local path of a dropped file, so the path
// the input receives is the one the server wrote the bytes to.
export const ATTACHMENTS_FORM_FIELD = "files";

/** Matches the image attachment budget closely enough to stay predictable. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/**
 * Dropped names come from the operating system and are treated as untrusted:
 * browsers hand over the base name only, and anything carrying a separator is
 * rejected before it reaches the filesystem.
 */
export function isSafeAttachmentName(fileName: string): boolean {
  if (!fileName || fileName === "." || fileName === "..") return false;
  if (fileName.includes("\0")) return false;
  return !fileName.includes("/") && !fileName.includes("\\");
}

/** `report.pdf` → `report-1.pdf` when the name is already taken. */
export function uniqueAttachmentName(fileName: string, taken: Iterable<string>): string {
  const names = taken instanceof Set ? taken : new Set(taken);
  if (!names.has(fileName)) return fileName;

  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";

  for (let suffix = 1; ; suffix += 1) {
    const candidate = `${base}-${suffix}${extension}`;
    if (!names.has(candidate)) return candidate;
  }
}

/** A copy already in the attachments directory, as read from disk. */
export interface ExistingAttachment {
  name: string;
  size: number;
}

/**
 * Name of an existing copy of the same file, or null. Dropping the same file
 * twice must not pile up `file.pdf`, `file-1.pdf`, `file-2.pdf`…: the same name
 * and byte size is the same file.
 */
export function findExistingAttachment(
  dropped: { name: string; size: number },
  existing: readonly ExistingAttachment[],
): string | null {
  const match = existing.find((entry) => entry.name === dropped.name && entry.size === dropped.size);
  return match ? match.name : null;
}
