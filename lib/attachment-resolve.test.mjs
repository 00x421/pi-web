import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { pickProjectFile } = await jiti.import("./attachment-resolve.ts");
const { findFilesByName } = await jiti.import("./project-files.ts");

const dropped = { name: "report.pdf", size: 1024 };

test("matches a unique project file by name and size", () => {
  const candidates = [
    { path: "docs/report.pdf", size: 1024 },
    { path: "docs/other.pdf", size: 1024 },
  ];
  assert.equal(pickProjectFile(dropped, candidates), "docs/report.pdf");
});

test("refuses to guess when two project files share the name and size", () => {
  const candidates = [
    { path: "docs/report.pdf", size: 1024 },
    { path: "archive/report.pdf", size: 1024 },
  ];
  assert.equal(pickProjectFile(dropped, candidates), null);
});

test("rejects a same-named file with different contents", () => {
  const candidates = [{ path: "docs/report.pdf", size: 2048 }];
  assert.equal(pickProjectFile(dropped, candidates), null);
});

test("rejects unrelated files", () => {
  const candidates = [{ path: "docs/other.pdf", size: 1024 }];
  assert.equal(pickProjectFile(dropped, candidates), null);
});

test("compares case-insensitively only when asked", () => {
  const candidates = [{ path: "Docs/Report.PDF", size: 1024 }];
  assert.equal(pickProjectFile(dropped, candidates, true), "Docs/Report.PDF");
  assert.equal(pickProjectFile(dropped, candidates, false), null);
});

test("matches files without a directory prefix", () => {
  const candidates = [{ path: "report.pdf", size: 1024 }];
  assert.equal(pickProjectFile(dropped, candidates), "report.pdf");
});

test("findFilesByName finds ignored files but skips heavy directories", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-web-find-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(path.join(root, "sub"), { recursive: true });
  await mkdir(path.join(root, "node_modules"), { recursive: true });
  await writeFile(path.join(root, ".env"), "A=1\n");
  await writeFile(path.join(root, "sub", ".env"), "A=2\n");
  await writeFile(path.join(root, "node_modules", ".env"), "A=3\n");

  const found = findFilesByName(root, new Set([".env"]));
  assert.deepEqual(found.sort(), [".env", "sub/.env"]);
});

test("findFilesByName returns nothing for an unknown name", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "pi-web-find-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await writeFile(path.join(root, "known.txt"), "x");
  assert.deepEqual(findFilesByName(root, new Set(["missing.txt"])), []);
});
