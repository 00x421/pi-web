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
