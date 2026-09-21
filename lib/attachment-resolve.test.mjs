import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { pickProjectFile } = await jiti.import("./attachment-resolve.ts");

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
