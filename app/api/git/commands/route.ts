import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import type { Agent } from "@earendil-works/pi-agent-core";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import {
  getAllowedFileRoots,
  isExistingFilePathAllowed,
  isFilePathAllowed,
  isWindowsAbsolutePath,
} from "@/lib/file-access";
import { buildCommitMessageFallback, generateCommitMessageFromAgent } from "@/lib/commit-message";
import { getGitStatus } from "@/lib/git-changes";
import { git } from "@/lib/worktree";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { resolveSessionPath } from "@/lib/session-reader";

function validateCwd(cwd: string): NextResponse | null {
  if (!cwd || (!cwd.startsWith("/") && !isWindowsAbsolutePath(cwd))) {
    return NextResponse.json({ error: "cwd must be an absolute path" }, { status: 400 });
  }
  return null;
}

async function assertAllowed(cwd: string): Promise<NextResponse | null> {
  const validationError = validateCwd(cwd);
  if (validationError) return validationError;
  const allowedRoots = await getAllowedFileRoots();
  if (!isFilePathAllowed(cwd, allowedRoots)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(cwd);
  } catch {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }
  if (!stat.isDirectory()) {
    return NextResponse.json({ error: "Not a directory" }, { status: 400 });
  }
  if (!isExistingFilePathAllowed(cwd, allowedRoots)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return null;
}

/** Run a git command, returning { stdout } or { error } instead of throwing. */
async function runGitSafe(cwd: string, args: string[]): Promise<{ stdout: string } | { error: string }> {
  try {
    return { stdout: await git(cwd, args) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** Resolve the live Agent for a session id, starting one if needed. */
async function resolveAgent(sessionId: string): Promise<Agent | undefined> {
  let wrapper = sessionId ? getRpcSession(sessionId) : undefined;
  if (!wrapper?.isAlive() && sessionId) {
    try {
      const filePath = await resolveSessionPath(sessionId);
      if (filePath) {
        const started = await startRpcSession(sessionId, filePath, undefined);
        wrapper = started.session;
      }
    } catch {
      wrapper = undefined;
    }
  }
  if (wrapper?.isAlive()) {
    const agentSession = wrapper.inner as unknown as AgentSession;
    return agentSession.agent as unknown as Agent | undefined;
  }
  return undefined;
}

/**
 * Compute the diff to summarize: the staged diff when there are staged files,
 * otherwise a temporary stage-all whose index changes are reverted afterwards
 * (caller must restore when `usedTemporaryStage` is true).
 */
async function collectStagedDiff(cwd: string): Promise<{
  diffText: string;
  hasStaged: boolean;
  haveFiles: boolean;
  usedTemporaryStage: boolean;
}> {
  let status = await getGitStatus(cwd);
  const haveFiles = status.files.length > 0;
  const hasStaged = status.files.some((file) => file.staged);
  let usedTemporaryStage = false;
  if (haveFiles && !hasStaged) {
    const addResult = await runGitSafe(cwd, ["add", "-A"]);
    if ("error" in addResult) throw new Error(addResult.error);
    usedTemporaryStage = true;
    status = await getGitStatus(cwd);
  }
  const diffResult = await runGitSafe(cwd, ["diff", "--staged", "--no-color"]);
  const diffText = "stdout" in diffResult ? diffResult.stdout : "";
  return { diffText, hasStaged, haveFiles, usedTemporaryStage };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          cwd?: string;
          action?: string;
          message?: string;
          filePath?: string;
          sessionId?: string;
          lang?: string;
        }
      | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const cwd = (body.cwd ?? "").trim();
    const action = body.action ?? "";
    const accessError = await assertAllowed(cwd);
    if (accessError) return accessError;

    if (action === "gen") {
      const { diffText, hasStaged, haveFiles, usedTemporaryStage } = await collectStagedDiff(cwd);
      try {
        if (!haveFiles) {
          return NextResponse.json({ message: "", hasStaged: false });
        }
        const status = await getGitStatus(cwd);
        const fallback = buildCommitMessageFallback(status.files, status.repositoryRoot ?? cwd);
        let message = fallback;
        if (diffText.trim()) {
          const sourceAgent = await resolveAgent(body.sessionId ?? "");
          if (sourceAgent) {
            try {
              const aiMessage = await generateCommitMessageFromAgent(sourceAgent, diffText, body.lang);
              if (aiMessage.trim()) message = aiMessage.trim();
            } catch {
              // keep the rule-based fallback
            }
          }
        }
        return NextResponse.json({ message, hasStaged });
      } finally {
        // Undo a temporary stage-all so generating a message never changes the
        // user's actual staging state (avoids accidentally staging everything).
        if (usedTemporaryStage) {
          await runGitSafe(cwd, ["reset"]);
        }
      }
    }

    if (action === "stage-all") {
      const result = await runGitSafe(cwd, ["add", "-A"]);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, output: result.stdout });
    }

    if (action === "stage" || action === "unstage") {
      const filePath = (body.filePath ?? "").trim();
      if (!filePath) {
        return NextResponse.json({ error: "filePath is required" }, { status: 400 });
      }
      const args = action === "stage" ? ["add", "--", filePath] : ["restore", "--staged", "--", filePath];
      const result = await runGitSafe(cwd, args);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, output: result.stdout });
    }

    if (action === "commit") {
      const commitMessage = (body.message ?? "").trim();
      if (!commitMessage) {
        return NextResponse.json({ error: "Commit message is empty" }, { status: 400 });
      }
      const commitResult = await runGitSafe(cwd, ["commit", "-m", commitMessage]);
      if ("error" in commitResult) {
        return NextResponse.json({ error: commitResult.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, output: commitResult.stdout });
    }

    if (action !== "push" && action !== "pull") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    const result = await runGitSafe(cwd, [action]);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, output: result.stdout });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}