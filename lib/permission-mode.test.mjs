import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { applyMode, isPermissionMode, permissionBackupPath, permissionConfigPath, readMode, readPermissionMode, readSavedDefault } =
  await jiti.import("./permission-mode.ts");

const CONFIG = `{
  "yoloMode": true,
  "permission": {
    "*": "allow",
    "bash": {
      "rm -rf *": "deny",
      "sudo *": "ask"
    },
    "external_directory": "ask"
  }
}
`;

const RULES = {
  bash: { "rm -rf *": "deny", "sudo *": "ask" },
  external_directory: "ask",
};

test("reads each mode from the config", () => {
  assert.equal(readMode(CONFIG), "yolo");
  assert.equal(readMode('{"yoloMode": false, "permission": {"*": "ask"}}'), "strict");
  assert.equal(readMode('{"yoloMode": false, "permission": {"*": "allow"}}'), "ask");
  assert.equal(readMode('{"yoloMode": false}'), "ask");
});

test("reports no mode for junk or a missing switch", () => {
  for (const junk of ["", "{", "[]", "null", '{"yoloMode": "yes"}', '{"permission": {}}']) {
    assert.equal(readMode(junk), null, `junk: ${junk}`);
  }
});

test("only accepts the three known modes", () => {
  assert.ok(isPermissionMode("strict") && isPermissionMode("ask") && isPermissionMode("yolo"));
  for (const bad of ["", "ASK", "yoloMode", null, 1, {}]) assert.equal(isPermissionMode(bad), false, String(bad));
});

test("strict remembers the default rule and leaving strict restores it", () => {
  const strict = applyMode(CONFIG, "strict", null);
  const strictConfig = JSON.parse(strict.config);
  assert.equal(strictConfig.yoloMode, false);
  assert.equal(strictConfig.permission["*"], "ask");
  assert.equal(strict.savedDefault, "allow");
  assert.deepEqual(strictConfig.permission.bash, RULES.bash);

  const back = applyMode(strict.config, "ask", strict.savedDefault);
  const backConfig = JSON.parse(back.config);
  assert.equal(backConfig.permission["*"], "allow");
  assert.equal(back.savedDefault, null);
  assert.deepEqual(backConfig.permission, { "*": "allow", ...RULES });
});

test("a second strict pass keeps the first remembered value", () => {
  const first = applyMode(CONFIG, "strict", null);
  const second = applyMode(first.config, "strict", first.savedDefault);
  assert.equal(second.savedDefault, "allow");
  assert.equal(JSON.parse(second.config).permission["*"], "ask");
});

test("yolo and ask only touch the switch", () => {
  const yolo = JSON.parse(applyMode(CONFIG, "yolo", null).config);
  assert.equal(yolo.yoloMode, true);
  assert.deepEqual(yolo.permission, { "*": "allow", ...RULES });
  const ask = JSON.parse(applyMode(CONFIG, "ask", "allow").config);
  assert.equal(ask.yoloMode, false);
  assert.deepEqual(ask.permission, { "*": "allow", ...RULES });
});

test("reads the remembered default and survives junk", () => {
  assert.equal(readSavedDefault('{"savedDefault": "allow"}'), "allow");
  for (const junk of ["", "{", "[]", '{"savedDefault": 1}']) assert.equal(readSavedDefault(junk), null, junk);
});

test("round-trips a real file and reports an uninstalled extension", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-perm-"));
  const config = path.join(dir, "config.json");
  const backup = path.join(dir, "backup.json");
  assert.deepEqual(readPermissionMode(config), { available: false, mode: "ask" });

  fs.writeFileSync(config, CONFIG);
  assert.deepEqual(readPermissionMode(config), { available: true, mode: "yolo" });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("points at the extension config and pi-web's own state file", () => {
  const config = permissionConfigPath("/home/me").replace(/\\/g, "/");
  const backup = permissionBackupPath("/home/me").replace(/\\/g, "/");
  assert.ok(config.endsWith(".pi/agent/extensions/pi-permission-system/config.json"), config);
  assert.ok(backup.endsWith(".pi/agent/pi-web-permission-mode.json"), backup);
  assert.notEqual(config, backup);
});
