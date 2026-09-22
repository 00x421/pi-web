import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Directories that never hold files worth matching or listing: dependency
// trees, build output, and the Windows profile caches that make a walk of the
// home directory pathologically slow (a home-rooted session is common).
const IGNORED_NAMES = new Set([
  "node_modules", ".git", ".next", "dist", "build", "__pycache__",
  ".turbo", ".cache", "coverage", ".pytest_cache", ".mypy_cache",
  "target", "vendor", ".DS_Store",
  "AppData", "Application Data", "Local Settings", "Cookies", "NetHood",
  "PrintHood", "Recent", "SendTo", "Templates", "Start Menu",
  "$RECYCLE.BIN", "System Volume Information",
  ".npm", ".yarn", ".pnpm-store", ".gradle", ".m2", ".cargo", ".rustup", ".conda",
]);

const IGNORED_SUFFIXES = [".pyc"];

/** Hard caps on the full in-memory listing that searches run against */
export const GIT_HARD_CAP = 200_000;
export const WALK_HARD_CAP = 50_000;
const MAX_WALK_DEPTH = 8;
/** Wall-clock budget so a pathological tree cannot stall a request. */
const WALK_BUDGET_MS = 8_000;
/** A dropped file and an @-menu open right after it reuse the same walk. */
const WALK_CACHE_TTL_MS = 10_000;
const WALK_CACHE_MAX_ENTRIES = 8;

export interface FileListing {
  /** Full listing up to the hard cap (not the client cap) */
  files: string[];
  /** True when even the hard cap was exceeded */
  hardTruncated: boolean;
}

// Cache on globalThis so it survives Next.js hot-reload, matching the file-index
// route's own cache.
declare global {
  var __piWalkListingCache: Map<string, { listing: FileListing; expiresAt: number }> | undefined;
}

function getWalkCache(): Map<string, { listing: FileListing; expiresAt: number }> {
  if (!globalThis.__piWalkListingCache) globalThis.__piWalkListingCache = new Map();
  return globalThis.__piWalkListingCache;
}

/** Project-relative POSIX paths from git, or null when cwd is not a git repo. */
export async function listWithGit(cwd: string): Promise<FileListing | null> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { timeout: 10_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } },
    );
    const all = stdout.split("\0").filter(Boolean);
    if (all.length > GIT_HARD_CAP) {
      return { files: all.slice(0, GIT_HARD_CAP), hardTruncated: true };
    }
    return { files: all, hardTruncated: false };
  } catch {
    // Not a git repo (or git unavailable) — caller falls back to readdir walk.
    return null;
  }
}

function walkDirectories(cwd: string): FileListing {
  const files: string[] = [];
  const deadline = Date.now() + WALK_BUDGET_MS;
  // BFS so shallow files win when the cap or the budget truncates the listing.
  const queue: Array<{ abs: string; rel: string; depth: number }> = [{ abs: cwd, rel: "", depth: 0 }];
  while (queue.length > 0) {
    if (files.length >= WALK_HARD_CAP || Date.now() > deadline) {
      return { files, hardTruncated: true };
    }
    const { abs, rel, depth } = queue.shift()!;
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of dirents) {
      if (IGNORED_NAMES.has(d.name) || IGNORED_SUFFIXES.some((s) => d.name.endsWith(s))) continue;
      const childRel = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) {
        if (depth + 1 <= MAX_WALK_DEPTH) {
          queue.push({ abs: path.join(abs, d.name), rel: childRel, depth: depth + 1 });
        }
      } else if (d.isFile()) {
        files.push(childRel);
      }
    }
  }
  return { files, hardTruncated: false };
}

/** Project-relative POSIX paths from a bounded, cached breadth-first walk. */
export function listWithWalk(cwd: string): FileListing {
  const cache = getWalkCache();
  const now = Date.now();
  const cached = cache.get(cwd);
  if (cached && cached.expiresAt > now) return cached.listing;

  const listing = walkDirectories(cwd);
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size >= WALK_CACHE_MAX_ENTRIES) cache.clear();
  cache.set(cwd, { listing, expiresAt: now + WALK_CACHE_TTL_MS });
  return listing;
}

/** Git listing when possible, readdir walk otherwise. */
export async function getProjectFileListing(cwd: string): Promise<FileListing> {
  return (await listWithGit(cwd)) ?? listWithWalk(cwd);
}

/**
 * Files whose base name is in `wanted`, skipping the same heavy directories as
 * the walk. Used to reach files the git listing never reports, because they are
 * ignored (`.env`, logs, build output).
 */
export function findFilesByName(cwd: string, wanted: ReadonlySet<string>): string[] {
  if (wanted.size === 0) return [];
  return listWithWalk(cwd).files.filter((relativePath) => {
    const cut = relativePath.lastIndexOf("/");
    const name = cut === -1 ? relativePath : relativePath.slice(cut + 1);
    return wanted.has(name.toLowerCase());
  });
}
