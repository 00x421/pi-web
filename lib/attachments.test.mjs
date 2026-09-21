import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { isSafeAttachmentName, uniqueAttachmentName } = await jiti.import("./attachments.ts");

test("rejects attachment names that could escape the upload directory", () => {
  for (const name of ["", ".", "..", "a/b.txt", "a\\b.txt", "x\0y"]) {
    assert.equal(isSafeAttachmentName(name), false, `expected ${JSON.stringify(name)} to be rejected`);
  }
});

test("accepts ordinary dropped file names", () => {
  for (const name of ["report.pdf", "with space.txt", "中文说明.md", "archive.tar.gz", ".env"]) {
    assert.equal(isSafeAttachmentName(name), true, `expected ${JSON.stringify(name)} to be accepted`);
  }
});

test("keeps a free name and only suffixes a taken one", () => {
  assert.equal(uniqueAttachmentName("report.pdf", []), "report.pdf");
  assert.equal(uniqueAttachmentName("report.pdf", ["report.pdf"]), "report-1.pdf");
  assert.equal(uniqueAttachmentName("report.pdf", ["report.pdf", "report-1.pdf"]), "report-2.pdf");
});

test("suffixes names without an extension without inventing one", () => {
  assert.equal(uniqueAttachmentName("notes", ["notes"]), "notes-1");
  assert.equal(uniqueAttachmentName(".env", [".env"]), ".env-1");
  assert.equal(uniqueAttachmentName("archive.tar.gz", ["archive.tar.gz"]), "archive.tar-1.gz");
});
