import { NextResponse } from "next/server";
import { getAllowedFileRoots, isExistingFilePathAllowed, isFilePathAllowed, isWindowsAbsolutePath } from "@/lib/file-access";
import { clampGitLogLimit, readGitLog } from "@/lib/git-log";

export const runtime = "nodejs";

// GET /api/git/log?cwd=<path>&limit=<n>  →  { commits: [...] }
// Read-only on purpose: history is shown here, never rewritten from the browser.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const cwd = url.searchParams.get("cwd");
  if (!cwd || (!cwd.startsWith("/") && !isWindowsAbsolutePath(cwd))) {
    return NextResponse.json({ error: "cwd must be an absolute path" }, { status: 400 });
  }

  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(cwd, allowedRoots) || !isExistingFilePathAllowed(cwd, allowedRoots)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const limit = clampGitLogLimit(url.searchParams.get("limit"));
  try {
    return NextResponse.json({ commits: await readGitLog(cwd, limit) });
  } catch (error) {
    // A folder that is not a repository (or has no commits yet) is an answer,
    // not a failure: the panel shows it as "no history here".
    return NextResponse.json({
      commits: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
