import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Records are separated by 0x1e and fields by 0x1f, so a commit subject can
 *  contain anything except those two control characters. */
const RECORD_SEPARATOR = "\u001e";
const FIELD_SEPARATOR = "\u001f";

export interface GitCommit {
  hash: string;
  short: string;
  author: string;
  date: string;
  subject: string;
}

export const GIT_LOG_DEFAULT_LIMIT = 50;
export const GIT_LOG_MAX_LIMIT = 200;

/** Keeps a hand-written ?limit= from asking for an unbounded history. An
 *  absent limit means "the default", which is not the same as 0. */
export function clampGitLogLimit(limit: unknown): number {
  if (limit === null || limit === undefined) return GIT_LOG_DEFAULT_LIMIT;
  const value = typeof limit === "string"
    ? (limit.trim() === "" ? Number.NaN : Number(limit.trim()))
    : limit;
  if (typeof value !== "number" || !Number.isFinite(value)) return GIT_LOG_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), GIT_LOG_MAX_LIMIT);
}

export function parseGitLog(stdout: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const raw of stdout.split(RECORD_SEPARATOR)) {
    const record = raw.trim();
    if (!record) continue;
    const [hash = "", short = "", author = "", date = "", subject = ""] = record.split(FIELD_SEPARATOR);
    if (hash) commits.push({ hash, short, author, date, subject });
  }
  return commits;
}

/** Commit history of a repository. Read-only: nothing here rewrites history. */
export async function readGitLog(cwd: string, limit: number = GIT_LOG_DEFAULT_LIMIT): Promise<GitCommit[]> {
  const format = ["%H", "%h", "%an", "%aI", "%s"].join("%x1f") + "%x1e";
  const { stdout } = await execFileAsync(
    "git",
    ["log", `-n${clampGitLogLimit(limit)}`, `--pretty=format:${format}`],
    { cwd, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
  );
  return parseGitLog(stdout);
}
