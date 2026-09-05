import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./FileExplorer.tsx", import.meta.url), "utf8");

test("commit button requires both a message and staged changes", () => {
  const disabled = /disabled=\{gitBusy \|\| \(!justCommitted && \(!commitMessage\.trim\(\) \|\| !gitFiles\.some\(\(file\) => file\.staged\)\)\)\}/;
  assert.match(source, disabled);
});

test("AI commit-message generation clears the box and alerts when the AI service is unavailable", () => {
  assert.match(source, /aiUnavailable\?: boolean/);
  assert.match(source, /if \(data\.aiUnavailable\) \{\r?\n\s+setCommitMessage\(""\);\r?\n\s+window\.alert\(t\("git\.aiUnavailable"\)\);/);
  assert.match(source, /git\.aiUnavailable/);
});