import fs from "fs";
import os from "os";
import path from "path";
import { writePrivateFileAtomicSync } from "./atomic-file";

/**
 * The pi permission extension keeps its rules in a JSON file next to its logs.
 * pi-web only ever flips `yoloMode` in it: the rules themselves are the user's,
 * and rewriting them from a UI control would be a good way to lose them.
 */
export function permissionConfigPath(home: string = os.homedir()): string {
  return path.join(home, ".pi", "agent", "extensions", "pi-permission-system", "config.json");
}

export interface PermissionModeState {
  /** False when the extension is not installed, so no control should be shown. */
  available: boolean;
  /** True = auto-approve everything the rules allow; false = ask on "ask" rules. */
  yolo: boolean;
}

export function readYoloMode(contents: string): boolean | null {
  try {
    const parsed = JSON.parse(contents) as { yoloMode?: unknown };
    return typeof parsed.yoloMode === "boolean" ? parsed.yoloMode : null;
  } catch {
    return null;
  }
}

export function withYoloMode(contents: string, yolo: boolean): string {
  const parsed = JSON.parse(contents) as Record<string, unknown>;
  return `${JSON.stringify({ ...parsed, yoloMode: yolo }, null, 2)}\n`;
}

export function readPermissionMode(filePath: string = permissionConfigPath()): PermissionModeState {
  try {
    const yolo = readYoloMode(fs.readFileSync(filePath, "utf8"));
    return yolo === null ? { available: false, yolo: false } : { available: true, yolo };
  } catch {
    return { available: false, yolo: false };
  }
}

export function writePermissionMode(yolo: boolean, filePath: string = permissionConfigPath()): PermissionModeState {
  const contents = fs.readFileSync(filePath, "utf8");
  writePrivateFileAtomicSync(filePath, withYoloMode(contents, yolo));
  return readPermissionMode(filePath);
}
