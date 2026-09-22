/**
 * Per-workspace "last open session" memory and sidebar group state.
 *
 * Switching to a workspace (project root or cwd) restores the session the user
 * had open there last, instead of landing on a blank new-session page. Without
 * this, every workspace switch required re-picking the session by hand.
 *
 * The workspace key is the server-provided project identity when known, so
 * Windows path variants and all worktrees of one repo share one memory slot.
 * Transient and legacy session objects fall back to projectRoot/cwd.
 *
 * The sidebar also remembers, per project key, whether its group was expanded.
 *
 * Stored in localStorage; best-effort (silently ignored when unavailable).
 */

const STORAGE_KEY = "pi-web:last-open-by-workspace";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readMap(storage: StorageLike): Record<string, string | undefined> {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string | undefined>
      : {};
  } catch {
    return {};
  }
}

/** The remembered session id for a workspace, or null when none/stale. */
export function getLastOpenSession(
  workspaceKey: string,
  storage: StorageLike | null = getBrowserStorage(),
): string | null {
  if (!storage) return null;
  try {
    const id = readMap(storage)[workspaceKey];
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function setLastOpenSession(
  workspaceKey: string,
  sessionId: string,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    const map = readMap(storage);
    map[workspaceKey] = sessionId;
    storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — memory is best-effort
  }
}

export function clearLastOpen(
  workspaceKey: string,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    const map = readMap(storage);
    if (!(workspaceKey in map)) return;
    delete map[workspaceKey];
    // Keep the store clean: drop the key entirely when nothing is remembered.
    if (Object.keys(map).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Workspace identity for a session: resolved project root when known, else cwd. */
export function workspaceKeyOf(session: {
  cwd: string;
  projectRoot?: string | null;
  projectKey?: string | null;
}): string {
  return session.projectKey ?? session.projectRoot ?? session.cwd;
}

const GROUP_STATE_KEY = "pi-web:group-expanded";
const ISOLATED_PROJECTS_KEY = "pi-web:isolated-projects";

function readBooleanMap(storageKey: string, storage: StorageLike): Record<string, boolean> {
  const raw = storage.getItem(storageKey);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

function readBooleanMapSafe(storageKey: string, storage: StorageLike | null): Record<string, boolean> {
  if (!storage) return {};
  try {
    return readBooleanMap(storageKey, storage);
  } catch {
    return {};
  }
}

function writeBooleanMapEntry(
  storageKey: string,
  name: string,
  value: boolean,
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    const state = readBooleanMap(storageKey, storage);
    state[name] = value;
    storage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // storage unavailable — the UI state still applies for this session
  }
}

/**
 * Every remembered group state, keyed by project key. An absent key means
 * "follow the default" (the group of the open session is expanded, others are
 * collapsed).
 */
export function readGroupExpanded(
  storage: StorageLike | null = getBrowserStorage(),
): Record<string, boolean> {
  return readBooleanMapSafe(GROUP_STATE_KEY, storage);
}

export function setGroupExpanded(
  projectKey: string,
  expanded: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  writeBooleanMapEntry(GROUP_STATE_KEY, projectKey, expanded, storage);
}

/**
 * Projects the user removed from the sidebar list. Hiding is only a view
 * preference: every session of a hidden project is kept.
 */
const HIDDEN_PROJECTS_KEY = "pi-web:hidden-projects";

/**
 * Projects whose new sessions should run in a throwaway git worktree instead of
 * the real directory, so an agent cannot touch the working checkout.
 */
export function readIsolatedProjects(
  storage: StorageLike | null = getBrowserStorage(),
): Record<string, boolean> {
  return readBooleanMapSafe(ISOLATED_PROJECTS_KEY, storage);
}

export function setProjectIsolated(
  projectKey: string,
  isolated: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  writeBooleanMapEntry(ISOLATED_PROJECTS_KEY, projectKey, isolated, storage);
}

/** Projects the user hid from the sidebar, keyed by project key. */
export function readHiddenProjects(
  storage: StorageLike | null = getBrowserStorage(),
): Record<string, boolean> {
  return readBooleanMapSafe(HIDDEN_PROJECTS_KEY, storage);
}

export function setProjectHidden(
  projectKey: string,
  hidden: boolean,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  writeBooleanMapEntry(HIDDEN_PROJECTS_KEY, projectKey, hidden, storage);
}
