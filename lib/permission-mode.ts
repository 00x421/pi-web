import fs from "fs";
import os from "os";
import path from "path";
import { writePrivateFileAtomicSync } from "./atomic-file";

/**
 * The pi permission extension keeps its rules in a JSON file next to its logs.
 * pi-web writes only two keys in it — `yoloMode` and the top-level default rule
 * `permission["*"]` — and keeps its own memory of what that default used to be
 * in a separate file, so the extension's schema stays exactly what it expects.
 */
export function permissionConfigPath(home: string = os.homedir()): string {
  return path.join(home, ".pi", "agent", "extensions", "pi-permission-system", "config.json");
}

/** pi-web's own state file, next to the other pi-web files in the agent dir. */
export function permissionBackupPath(home: string = os.homedir()): string {
  return path.join(home, ".pi", "agent", "pi-web-permission-mode.json");
}

/** strict = every step asks, ask = only "ask" rules ask, yolo = auto-approve. */
export type PermissionMode = "strict" | "ask" | "yolo";

export interface PermissionModeState {
  /** False when the extension is not installed, so no control should be shown. */
  available: boolean;
  mode: PermissionMode;
}

export const PERMISSION_MODES: readonly PermissionMode[] = ["strict", "ask", "yolo"];

export function isPermissionMode(value: unknown): value is PermissionMode {
  return typeof value === "string" && (PERMISSION_MODES as readonly string[]).includes(value);
}

export function readMode(contents: string): PermissionMode | null {
  try {
    const parsed = JSON.parse(contents) as { yoloMode?: unknown; permission?: unknown };
    if (typeof parsed.yoloMode !== "boolean") return null;
    if (parsed.yoloMode) return "yolo";
    const top = (parsed.permission ?? {}) as Record<string, unknown>;
    return top["*"] === "ask" ? "strict" : "ask";
  } catch {
    return null;
  }
}

export function readSavedDefault(contents: string): string | null {
  try {
    const parsed = JSON.parse(contents) as { savedDefault?: unknown };
    return typeof parsed.savedDefault === "string" ? parsed.savedDefault : null;
  } catch {
    return null;
  }
}

/**
 * Applies a mode and reports the top-level default worth remembering. Leaving
 * strict restores that value, so the switch is reversible: the rules the user
 * wrote come back exactly as they were.
 */
export function applyMode(
  contents: string,
  mode: PermissionMode,
  savedDefault: string | null,
): { config: string; savedDefault: string | null } {
  const parsed = JSON.parse(contents) as Record<string, unknown>;
  const permission = { ...((parsed.permission ?? {}) as Record<string, unknown>) };
  let nextSaved = savedDefault;
  if (mode === "strict") {
    if (nextSaved === null) nextSaved = typeof permission["*"] === "string" ? permission["*"] : "allow";
    permission["*"] = "ask";
  } else if (nextSaved !== null) {
    permission["*"] = nextSaved;
    nextSaved = null;
  }
  const next = { ...parsed, yoloMode: mode === "yolo", permission };
  return { config: `${JSON.stringify(next, null, 2)}\n`, savedDefault: nextSaved };
}

export function readPermissionMode(
  configPath: string = permissionConfigPath(),
): PermissionModeState {
  try {
    const mode = readMode(fs.readFileSync(configPath, "utf8"));
    return mode === null ? { available: false, mode: "ask" } : { available: true, mode };
  } catch {
    return { available: false, mode: "ask" };
  }
}

export function writePermissionMode(
  mode: PermissionMode,
  configPath: string = permissionConfigPath(),
  backupPath: string = permissionBackupPath(),
): PermissionModeState {
  const contents = fs.readFileSync(configPath, "utf8");
  let savedDefault: string | null = null;
  try {
    savedDefault = readSavedDefault(fs.readFileSync(backupPath, "utf8"));
  } catch {
    savedDefault = null;
  }
  const result = applyMode(contents, mode, savedDefault);
  writePrivateFileAtomicSync(configPath, result.config);
  writePrivateFileAtomicSync(backupPath, `${JSON.stringify({ savedDefault: result.savedDefault }, null, 2)}\n`);
  return readPermissionMode(configPath);
}
