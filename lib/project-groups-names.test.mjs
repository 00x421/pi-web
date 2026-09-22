import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { projectDisplayName, projectDisplayNames } = await jiti.import("./project-groups.ts");

test("uses the last path segment for either separator", () => {
  assert.equal(projectDisplayName("D:/vibe coding/guangxi-agent"), "guangxi-agent");
  assert.equal(projectDisplayName("D:\\vibe coding\\guangxi-agent"), "guangxi-agent");
  assert.equal(projectDisplayName("D:/vibe coding/guangxi-agent/"), "guangxi-agent");
  assert.equal(projectDisplayName("/home/me/project"), "project");
});

test("falls back when a root has no folder name", () => {
  assert.equal(projectDisplayName("C:\\"), "C:");
  assert.equal(projectDisplayName("/"), "/");
});

test("keeps unique folder names bare", () => {
  const labels = projectDisplayNames(["D:/a/alpha", "D:/b/beta"]);
  assert.equal(labels.get("D:/a/alpha"), "alpha");
  assert.equal(labels.get("D:/b/beta"), "beta");
});

test("disambiguates equal folder names with the parent folder", () => {
  const labels = projectDisplayNames(["D:/a/pi-web", "D:/b/pi-web", "D:/c/other"]);
  assert.equal(labels.get("D:/a/pi-web"), "a/pi-web");
  assert.equal(labels.get("D:/b/pi-web"), "b/pi-web");
  assert.equal(labels.get("D:/c/other"), "other");
});

test("handles an empty project list", () => {
  assert.equal(projectDisplayNames([]).size, 0);
});
