import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { readGroupExpanded, readHiddenProjects, setProjectHidden } = await jiti.import("./workspace-memory.ts");

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

test("remembers hidden projects per key", () => {
  const storage = memoryStorage();
  assert.deepEqual(readHiddenProjects(storage), {});

  setProjectHidden("D:/repo-a", true, storage);
  assert.deepEqual(readHiddenProjects(storage), { "D:/repo-a": true });

  setProjectHidden("D:/repo-a", false, storage);
  assert.deepEqual(readHiddenProjects(storage), { "D:/repo-a": false });
});

test("keeps the hidden state separate from the other maps", () => {
  const storage = memoryStorage();
  setProjectHidden("D:/repo-a", true, storage);
  assert.deepEqual(readGroupExpanded(storage), {});
});

test("falls back to an empty state when storage holds junk", () => {
  for (const junk of ["", "{", "[]", "null", '"nope"']) {
    const storage = memoryStorage({ "pi-web:hidden-projects": junk });
    assert.deepEqual(readHiddenProjects(storage), {}, `junk: ${junk}`);
  }
});

test("survives a null storage", () => {
  assert.deepEqual(readHiddenProjects(null), {});
  assert.doesNotThrow(() => setProjectHidden("D:/repo-a", true, null));
});
