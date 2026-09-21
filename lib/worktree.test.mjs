import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

async function loadSubject() {
  const { createJiti } = await import("jiti");
  return createJiti(import.meta.url).import("./worktree.ts");
}

async function loadPaths() {
  const { createJiti } = await import("jiti");
  return createJiti(import.meta.url).import("./paths.ts");
}

async function git(cwd, args) {
  await execFileAsync("git", ["-C", cwd, ...args]);
}

/**
 * 8.3 short form of an existing path (`C:\Users\LINLIN~1\...`), or null when
 * short name generation is disabled on that volume.
 */
async function windowsShortForm(target) {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${target.replace(/'/g, "''")}').ShortPath`,
    ],
    { windowsHide: true },
  );
  return stdout.trim() || null;
}

test("main and linked worktrees share one canonical project root", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pi-web-worktree-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const repo = path.join(tempRoot, "repo");
  const linked = path.join(tempRoot, "linked");
  await execFileAsync("git", ["init", repo]);
  await git(repo, ["config", "user.name", "Pi Web Test"]);
  await git(repo, ["config", "user.email", "pi-web-test@example.invalid"]);
  await git(repo, ["config", "commit.gpgsign", "false"]);
  await writeFile(path.join(repo, "README.md"), "# test\n");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["commit", "-m", "initial"]);
  await git(repo, ["worktree", "add", "-b", "feature/test", linked]);

  const { findCurrentWorktreePath, listWorktrees, resolveProject } = await loadSubject();
  const mainProject = await resolveProject(`${repo}${path.sep}`);
  const linkedProject = await resolveProject(linked);

  assert.equal(mainProject.isTopLevel, true);
  assert.equal(mainProject.isWorktree, false);
  assert.equal(linkedProject.isTopLevel, true);
  assert.equal(linkedProject.isWorktree, true);
  assert.equal(linkedProject.branch, "feature/test");
  assert.equal(mainProject.projectRoot, linkedProject.projectRoot);

  const worktrees = await listWorktrees(linked);
  const listedLinked = worktrees.find((worktree) => worktree.branch === "feature/test");
  assert.ok(listedLinked);
  assert.equal(findCurrentWorktreePath(worktrees, `${linked}${path.sep}`), listedLinked.path);
});

test("a Windows 8.3 short cwd resolves to the same project root as its long form", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only: 8.3 short names");
    return;
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "pi-web-shortname-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const repo = path.join(tempRoot, "repo");
  await execFileAsync("git", ["init", repo]);
  await git(repo, ["config", "user.name", "Pi Web Test"]);
  await git(repo, ["config", "user.email", "pi-web-test@example.invalid"]);
  await git(repo, ["config", "commit.gpgsign", "false"]);
  await writeFile(path.join(repo, "README.md"), "# test\n");
  await git(repo, ["add", "README.md"]);
  await git(repo, ["commit", "-m", "initial"]);

  // The long form is what git reports; the short form is what a cwd inherited
  // from %TEMP%-style environment values can look like.
  const longRepo = realpathSync.native(repo);
  const shortRepo = await windowsShortForm(longRepo);
  const { samePath } = await loadPaths();
  if (!shortRepo || samePath(shortRepo, longRepo)) {
    t.skip("no 8.3 short name available for this volume");
    return;
  }

  const { resolveProject } = await loadSubject();
  const fromShort = await resolveProject(shortRepo);
  const fromLong = await resolveProject(longRepo);

  assert.equal(fromShort.isTopLevel, true);
  assert.equal(fromLong.isTopLevel, true);
  assert.ok(samePath(fromShort.projectRoot, fromLong.projectRoot));
});
