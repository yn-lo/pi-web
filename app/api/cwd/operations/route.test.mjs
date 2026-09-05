import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { POST } = await jiti.import("./route.ts");

function request(body, headers = { "Content-Type": "application/json", host: "localhost" }) {
  return new Request("http://localhost/api/cwd/operations", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

test("directory operations create, rename, and recursively delete child directories", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-web-cwd-operations-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  let response = await POST(request({ operation: "create", path: root, name: "child" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).path, path.join(root, "child"));
  assert.equal((await lstat(path.join(root, "child"))).isDirectory(), true);

  response = await POST(request({ operation: "rename", path: path.join(root, "child"), name: "renamed" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).path, path.join(root, "renamed"));

  await mkdir(path.join(root, "renamed", "nested"));
  response = await POST(request({ operation: "delete", path: path.join(root, "renamed") }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(await readdir(root), []);
});

test("directory operations reject unsafe names and untrusted requests", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-web-cwd-operations-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  let response = await POST(request({ operation: "create", path: root, name: "../escape" }));
  assert.equal(response.status, 400);

  response = await POST(request(
    { operation: "create", path: root, name: "untrusted" },
    { "Content-Type": "application/json", host: "localhost", origin: "http://attacker.example", "sec-fetch-site": "cross-site" },
  ));
  assert.equal(response.status, 403);
});
