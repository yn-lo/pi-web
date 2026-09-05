import { mkdir, lstat, rename, rm, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { normalizeDirectory, resolveDirectory } from "@/lib/directory-browser";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

type DirectoryOperation = "create" | "rename" | "delete";

function isDirectoryOperation(value: unknown): value is DirectoryOperation {
  return value === "create" || value === "rename" || value === "delete";
}

function getDirectoryName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name === "." || name === ".." || /[\\/\0]/.test(name)) return null;
  return name;
}

async function resolveRegularDirectory(value: unknown): Promise<string> {
  if (typeof value !== "string" || !value.trim()) throw new Error("Directory path is required");
  const input = normalizeDirectory(value.trim());
  const inputStat = await lstat(input);
  if (inputStat.isSymbolicLink() || !inputStat.isDirectory()) throw new Error("Path is not a directory");

  const directory = await resolveDirectory(input);
  if (!(await stat(directory)).isDirectory()) throw new Error("Path is not a directory");
  return directory;
}

function errorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return 404;
  if (code === "EEXIST") return 409;
  return error.message === "Directory path is required" || error.message === "Path is not a directory" ? 400 : 500;
}

// POST /api/cwd/operations body: { operation, path, name? }
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) {
    return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  }
  if (!hasJsonContentType(request)) {
    return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  try {
    const body = await request.json() as { operation?: unknown; path?: unknown; name?: unknown };
    if (!isDirectoryOperation(body.operation)) {
      return NextResponse.json({ error: "operation must be create, rename, or delete" }, { status: 400 });
    }

    if (body.operation === "create") {
      const name = getDirectoryName(body.name);
      if (!name) return NextResponse.json({ error: "Directory name is invalid" }, { status: 400 });
      const parent = await resolveRegularDirectory(body.path);
      const createdPath = path.join(parent, name);
      await mkdir(createdPath);
      return NextResponse.json({ path: createdPath });
    }

    const directory = await resolveRegularDirectory(body.path);
    if (body.operation === "rename") {
      const name = getDirectoryName(body.name);
      if (!name) return NextResponse.json({ error: "Directory name is invalid" }, { status: 400 });
      const renamedPath = path.join(path.dirname(directory), name);
      await rename(directory, renamedPath);
      return NextResponse.json({ path: renamedPath });
    }

    await rm(directory, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: errorStatus(error) },
    );
  }
}
