import { ATTACHMENTS_FORM_FIELD } from "./attachments";

/**
 * Copies dropped files to the server and returns the absolute paths it stored
 * them under, which is what the chat input can then reference.
 */
export async function uploadDroppedFiles(files: File[]): Promise<string[]> {
  const form = new FormData();
  for (const file of files) form.append(ATTACHMENTS_FORM_FIELD, file);

  const response = await fetch("/api/attachments", { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Upload failed (${response.status})`);
  }

  const body = await response.json() as { files?: { path?: string }[] };
  return (body.files ?? [])
    .map((file) => file.path)
    .filter((value): value is string => Boolean(value));
}

/**
 * Asks the server which dropped files already live inside the project, so they
 * can be referenced by their real path instead of being copied. Best effort: if
 * the lookup fails, every dropped file is copied as usual.
 */
export async function resolveProjectDrops(cwd: string, files: File[]): Promise<Map<string, string>> {
  const response = await fetch("/api/attachments/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd, files: files.map((file) => ({ name: file.name, size: file.size })) }),
  });
  if (!response.ok) return new Map();

  const body = await response.json() as { resolved?: { name?: string; path?: string }[] };
  const resolved = (body.resolved ?? []).filter(
    (entry): entry is { name: string; path: string } => Boolean(entry?.name && entry?.path),
  );
  return new Map(resolved.map((entry) => [entry.name, entry.path]));
}
