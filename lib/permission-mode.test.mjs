import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { permissionConfigPath, readPermissionMode, readYoloMode, withYoloMode } = await jiti.import("./permission-mode.ts");

const CONFIG = `{
  "yoloMode": true,
  "permission": {
    "bash": {
      "rm -rf *": "deny",
      "sudo *": "ask"
    },
    "external_directory": "ask"
  }
}
`;

test("reads the global switch", () => {
  assert.equal(readYoloMode(CONFIG), true);
  assert.equal(readYoloMode('{"yoloMode": false}'), false);
});

test("reports no switch for junk or a missing key", () => {
  for (const junk of ["", "{", "[]", "null", '{"yoloMode": "yes"}', '{"permission": {}}']) {
    assert.equal(readYoloMode(junk), null, `junk: ${junk}`);
  }
});

test("flips the switch and keeps every rule", () => {
  const patched = JSON.parse(withYoloMode(CONFIG, false));
  assert.equal(patched.yoloMode, false);
  assert.deepEqual(patched.permission, {
    bash: { "rm -rf *": "deny", "sudo *": "ask" },
    external_directory: "ask",
  });
});

test("round-trips through a real file and survives a missing one", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-perm-"));
  const file = path.join(dir, "config.json");
  assert.deepEqual(readPermissionMode(file), { available: false, yolo: false });
  fs.writeFileSync(file, CONFIG);
  assert.deepEqual(readPermissionMode(file), { available: true, yolo: true });
  assert.deepEqual(readPermissionMode(path.join(dir, "missing.json")), { available: false, yolo: false });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("points at the extension config inside the pi agent directory", () => {
  const resolved = permissionConfigPath("/home/me").replace(/\\/g, "/");
  assert.ok(resolved.endsWith(".pi/agent/extensions/pi-permission-system/config.json"), resolved);
});
