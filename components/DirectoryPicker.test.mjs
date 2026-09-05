import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./DirectoryPicker.tsx", import.meta.url), "utf8");

test("directory picker exposes touch-friendly directory operation controls", () => {
  assert.match(source, /className="directory-picker-footer"/);
  assert.match(source, /openOperationDialog\("create", currentPath\)/);
  assert.match(source, /directoryPicker\.directoryActions/);
  assert.match(source, /openOperationDialog\("rename", entry\.path\)/);
  assert.match(source, /openOperationDialog\("delete", entry\.path\)/);
  assert.match(source, /directoryPicker\.deleteDirectory/);
  assert.match(source, /marginLeft: "auto"/);

  const driveList = source.slice(source.indexOf("drives.map"), source.indexOf("directories.map"));
  assert.doesNotMatch(driveList, /directoryPicker\.directoryActions/);
});

test("directory picker uses an in-app dialog rather than native prompts", () => {
  assert.match(source, /const \[operationDialog, setOperationDialog\]/);
  assert.match(source, /<form onSubmit=\{submitDirectoryOperation\}/);
  assert.match(source, /setDirectoryName\(event\.target\.value\)/);
  assert.doesNotMatch(source, /window\.(prompt|confirm)/);
  assert.doesNotMatch(source, /onContextMenu/);
  assert.doesNotMatch(source, /debug-point/);
});
