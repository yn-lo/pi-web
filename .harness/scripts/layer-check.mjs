#!/usr/bin/env node
// 分层依赖门禁：lib → hooks/components/app-api；hooks → components/app-api 单向禁依赖。
// 只输出错误（见 harness.md 4.3 约束输出原则）。退出码 0 = 通过，1 = 发现违规。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scanDirs = ['app', 'components', 'hooks', 'lib'];

// 禁止依赖矩阵：{ from 层 → [to 层黑名单] }。层级按顶层目录判定（app/api 特判为 api 层）。
const RULES = new Map([
  ['lib', new Set(['hooks', 'components', 'api', 'app'])],
  ['hooks', new Set(['components', 'api'])],
  ['components', new Set(['api'])],
  ['api', new Set(['components', 'hooks'])],
]);

function layerOf(rel) {
  const parts = rel.split(sep);
  if (parts[0] === 'lib') return 'lib';
  if (parts[0] === 'hooks') return 'hooks';
  if (parts[0] === 'components') return 'components';
  if (parts[0] === 'app' && parts[1] === 'api') return 'api';
  if (parts[0] === 'app') return 'app';
  return null;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(name)) {
      yield p;
    }
  }
}

const problems = new Set();

for (const dir of scanDirs) {
  const base = join(root, dir);
  if (!statSync(base).isDirectory()) continue;
  for (const file of walk(base)) {
    const relFile = file.slice(root.length + 1);
    const fromLayer = layerOf(relFile);
    if (!fromLayer || !RULES.has(fromLayer)) continue;
    const banned = RULES.get(fromLayer);
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/['"]((?:\.\.?\/|@\/)[^'"]+)['"]/g);
      if (!m) continue;
      for (const raw of m) {
        const spec = raw.slice(1, -1);
        const target = spec.startsWith('@/')
          ? join(root, spec.slice(2))
          : resolve(dirname(file), spec);
        const relTarget = target.slice(root.length + 1);
        const toLayer = layerOf(relTarget);
        if (toLayer && banned.has(toLayer)) {
          problems.add(
            `${relFile}:${i + 1} — ${fromLayer} 层不得依赖 ${toLayer} 层（import "${spec}"）。` +
              `\n    FIX: 把 ${toLayer} 的依赖下移到 lib 层或改由调用方注入。`
          );
        }
      }
    }
  }
}

if (problems.size > 0) {
  for (const p of problems) console.error(p);
  console.error(`\nFound ${problems.size} layer violation(s).`);
  process.exit(1);
}
console.error('layer-check: All checks passed.');