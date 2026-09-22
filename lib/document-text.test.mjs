import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { MAX_DOCUMENT_CHARS, documentKind, documentLabel, truncateDocumentText } =
  await jiti.import("./document-text.ts");

test("recognizes documents that need conversion", () => {
  assert.equal(documentKind("C:/docs/report.docx"), "docx");
  assert.equal(documentKind("C:\\docs\\笔记.DOCX"), "docx");
  assert.equal(documentKind("/home/me/notes.md"), "text");
  assert.equal(documentKind("/home/me/data.csv"), "text");
});

test("leaves files the agent can already read alone", () => {
  for (const filePath of ["/a/photo.png", "/a/archive.zip", "/a/report.pdf", "/a/binary.exe", "/a/noext"]) {
    assert.equal(documentKind(filePath), null, filePath);
  }
});

test("keeps short text untouched and truncates long text", () => {
  assert.deepEqual(truncateDocumentText("hello", 10), { text: "hello", truncated: false });
  assert.deepEqual(truncateDocumentText("hello world", 5), { text: "hello", truncated: true });
});

test("uses a sane default limit", () => {
  const long = "x".repeat(MAX_DOCUMENT_CHARS + 1);
  const result = truncateDocumentText(long);
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, MAX_DOCUMENT_CHARS);
});

test("derives a label from either separator", () => {
  assert.equal(documentLabel("C:\\docs\\报告.docx"), "报告.docx");
  assert.equal(documentLabel("/home/me/notes.md"), "notes.md");
  assert.equal(documentLabel("C:\\"), "C:");
});
