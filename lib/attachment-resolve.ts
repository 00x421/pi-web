import fs from "fs";
import path from "path";
import { getProjectFileListing } from "./project-files";

/** Minimal descriptor of a dropped file, as the browser reports it. */
export interface DroppedFileDescriptor {
  name: string;
  size: number;
}

/** A project file that could be the one a drop refers to. */
export interface IndexedProjectFile {
  /** Project-relative POSIX path */
  path: string;
  size: number;
}

function baseName(relativePath: string): string {
  const cut = relativePath.lastIndexOf("/");
  return cut === -1 ? relativePath : relativePath.slice(cut + 1);
}

/**
 * Picks the project file a dropped file refers to: same name, same byte size,
 * and exactly one candidate. Anything ambiguous returns null so the caller
 * copies the dropped bytes instead of pointing at the wrong file.
 */
export function pickProjectFile(
  dropped: DroppedFileDescriptor,
  candidates: readonly IndexedProjectFile[],
  caseInsensitive = process.platform === "win32",
): string | null {
  const wanted = caseInsensitive ? dropped.name.toLowerCase() : dropped.name;
  const matches = candidates.filter((candidate) => {
    const candidateName = baseName(candidate.path);
    const name = caseInsensitive ? candidateName.toLowerCase() : candidateName;
    return name === wanted && candidate.size === dropped.size;
  });
  return matches.length === 1 ? matches[0].path : null;
}

/**
 * Project files whose base name is one of `names`, with sizes read from disk.
 * The name filter is deliberately case-insensitive — pickProjectFile() applies
 * the platform-correct comparison afterwards.
 */
export async function indexProjectFiles(
  cwd: string,
  names: readonly string[],
): Promise<IndexedProjectFile[]> {
  if (names.length === 0) return [];
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const { files } = await getProjectFileListing(cwd);

  const indexed: IndexedProjectFile[] = [];
  for (const relativePath of files) {
    if (!wanted.has(baseName(relativePath).toLowerCase())) continue;
    try {
      const stat = fs.statSync(path.join(cwd, relativePath));
      if (stat.isFile()) indexed.push({ path: relativePath, size: stat.size });
    } catch {
      // Listed but unreadable or already gone — treat as absent.
    }
  }
  return indexed;
}
