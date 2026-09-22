import path from "path";

/**
 * Documents the agent cannot read by itself (a .docx is a zip archive), so the
 * dropped file is converted to text before it reaches the prompt.
 */
const PLAIN_TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".yaml", ".yml", ".xml", ".html", ".htm",
  ".log", ".ini", ".toml", ".srt", ".vtt", ".sql",
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".h", ".cpp", ".cs",
  ".php", ".rb", ".swift", ".kt", ".sh", ".ps1", ".bat",
]);

/** Cap on extracted text so one huge document cannot blow up the prompt. */
export const MAX_DOCUMENT_CHARS = 30_000;

export type DocumentKind = "docx" | "text";

/** How a path should be converted, or null when the agent can read it as-is. */
export function documentKind(filePath: string): DocumentKind | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".docx") return "docx";
  return PLAIN_TEXT_EXTENSIONS.has(extension) ? "text" : null;
}

export function truncateDocumentText(
  text: string,
  limit: number = MAX_DOCUMENT_CHARS,
): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}

/** Last path segment for labels, tolerating either separator. */
export function documentLabel(filePath: string): string {
  const trimmed = filePath.replace(/[\\/]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return cut === -1 ? trimmed : trimmed.slice(cut + 1);
}
