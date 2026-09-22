import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { readGroupExpanded, readIsolatedProjects, setGroupExpanded, setProjectIsolated } = await jiti.import("./workspace-memory.ts");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

test("remembers expansion per project key", () => {
  const storage = memoryStorage();
  assert.deepEqual(readGroupExpanded(storage), {});

  setGroupExpanded("D:/repo-a", true, storage);
  setGroupExpanded("D:/repo-b", false, storage);

  assert.deepEqual(readGroupExpanded(storage), { "D:/repo-a": true, "D:/repo-b": false });
  assert.equal(storage.getItem("pi-web:group-expanded"), '{"D:/repo-a":true,"D:/repo-b":false}');
});

test("overwrites an existing entry instead of appending", () => {
  const storage = memoryStorage();
  setGroupExpanded("D:/repo-a", true, storage);
  setGroupExpanded("D:/repo-a", false, storage);
  assert.deepEqual(readGroupExpanded(storage), { "D:/repo-a": false });
});

test("falls back to an empty state when storage holds junk", () => {
  for (const junk of ["", "{", "[]", "null", '"nope"']) {
    const storage = memoryStorage({ "pi-web:group-expanded": junk });
    assert.deepEqual(readGroupExpanded(storage), {}, `junk: ${junk}`);
  }
});

test("is a no-op without storage", () => {
  assert.deepEqual(readGroupExpanded(null), {});
  setGroupExpanded("D:/repo-a", true, null);
});

test("remembers the sandbox flag per project", () => {
  const storage = memoryStorage();
  assert.deepEqual(readIsolatedProjects(storage), {});

  setProjectIsolated("D:/repo-a", true, storage);
  assert.deepEqual(readIsolatedProjects(storage), { "D:/repo-a": true });
  assert.equal(storage.getItem("pi-web:isolated-projects"), '{"D:/repo-a":true}');

  setProjectIsolated("D:/repo-a", false, storage);
  assert.deepEqual(readIsolatedProjects(storage), { "D:/repo-a": false });
});

test("group and sandbox state are stored independently", () => {
  const storage = memoryStorage();
  setGroupExpanded("D:/repo-a", true, storage);
  setProjectIsolated("D:/repo-a", true, storage);
  assert.deepEqual(readGroupExpanded(storage), { "D:/repo-a": true });
  assert.deepEqual(readIsolatedProjects(storage), { "D:/repo-a": true });
});
