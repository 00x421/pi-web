import type { SessionInfo } from "./types";
import { workspaceKeyOf } from "./workspace-memory";

export interface RecentProject {
  /** Stable server-provided identity used for comparison and Map keys. */
  key: string;
  /** Original project path used for display and filesystem operations. */
  root: string;
}

/** Projects sorted by most recent activity and deduplicated by stable key. */
export function getRecentProjects(sessions: readonly SessionInfo[]): RecentProject[] {
  const latestByProject = new Map<string, { root: string; modified: string }>();
  for (const session of sessions) {
    const root = session.projectRoot ?? session.cwd;
    if (!root) continue;
    const key = workspaceKeyOf(session);
    const previous = latestByProject.get(key);
    if (!previous || session.modified > previous.modified) {
      latestByProject.set(key, { root, modified: session.modified });
    }
  }
  return [...latestByProject.entries()]
    .sort((a, b) => b[1].modified.localeCompare(a[1].modified))
    .map(([key, { root }]) => ({ key, root }));
}

export function getProjectActivity(
  sessions: readonly SessionInfo[],
  runningSessionIds: ReadonlySet<string>,
  unreadSessionIds: ReadonlySet<string>,
): Map<string, { running: number; unread: number }> {
  const counts = new Map<string, { running: number; unread: number }>();
  for (const session of sessions) {
    const key = workspaceKeyOf(session);
    if (!key) continue;
    let entry = counts.get(key);
    if (!entry) {
      entry = { running: 0, unread: 0 };
      counts.set(key, entry);
    }
    if (runningSessionIds.has(session.id)) entry.running++;
    if (unreadSessionIds.has(session.id)) entry.unread++;
  }
  return counts;
}

export function sessionsForProject(
  sessions: readonly SessionInfo[],
  projectKey: string,
): SessionInfo[] {
  return sessions.filter((session) => workspaceKeyOf(session) === projectKey);
}

/** Last path segment of a project root, tolerating either separator. */
export function projectDisplayName(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const name = cut === -1 ? trimmed : trimmed.slice(cut + 1);
  // "C:\\" trims down to "C:"; an empty result falls back to the raw root.
  return name || root;
}

function parentDisplayName(root: string): string {
  const trimmed = root.replace(/[\\/]+$/, "");
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut <= 0) return "";
  return projectDisplayName(trimmed.slice(0, cut));
}

/**
 * Sidebar labels for a set of project roots: the bare folder name, with the
 * parent folder prepended when two projects would otherwise share a name
 * (`D:/a/pi-web` vs `D:/b/pi-web` -> `a/pi-web` vs `b/pi-web`).
 */
export function projectDisplayNames(roots: readonly string[]): Map<string, string> {
  const buckets = new Map<string, string[]>();
  for (const root of roots) {
    const name = projectDisplayName(root);
    const bucket = buckets.get(name);
    if (bucket) bucket.push(root);
    else buckets.set(name, [root]);
  }

  const labels = new Map<string, string>();
  for (const [name, group] of buckets) {
    for (const root of group) {
      if (group.length === 1) {
        labels.set(root, name);
        continue;
      }
      const parent = parentDisplayName(root);
      labels.set(root, parent ? `${parent}/${name}` : name);
    }
  }
  return labels;
}
