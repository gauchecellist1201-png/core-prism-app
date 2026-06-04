#!/usr/bin/env node
/**
 * syncChangelog.mjs — リリースノート (.md) を public/changelog.json に整形
 *
 * オーナー指示 (2026-06-04 第 37 波 VVVVV):
 *   公開 /changelog ページ が fetch する JSON を 生成する。
 *   ソースは ~/Desktop/release_notes/v1.0.md (OOOO で生成)。
 *
 * 使い方:
 *   node scripts/syncChangelog.mjs
 *   SRC=~/Desktop/release_notes/v1.0.md node scripts/syncChangelog.mjs
 *
 * 出力:
 *   public/changelog.json  { generatedAt, sourceFile, totalCommits, sections: [{ category, items: [{hash, date, message}] }] }
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
mkdirSync(PUBLIC_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

function pickSrc() {
  if (process.env.SRC) return process.env.SRC;
  // ~/Desktop/release_notes/ 内 から 最新を選ぶ
  const dir = join(homedir(), 'Desktop', 'release_notes');
  if (!existsSync(dir)) return '';
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  if (!files.length) return '';
  // 最終更新 が一番新しい もの
  const sorted = files
    .map((f) => ({ f, mt: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mt - a.mt);
  return join(dir, sorted[0].f);
}

const SRC = pickSrc();
if (!SRC || !existsSync(SRC)) {
  console.error(`${C.red}✗ リリースノート が見つかりません。${C.reset}`);
  console.error(`   先に: node scripts/generateReleaseNotes.mjs を実行するか、 SRC=<path> で 指定してください。`);
  process.exit(1);
}

const text = readFileSync(SRC, 'utf-8');
console.log(`${C.bold}変更履歴 JSON 化${C.reset}`);
console.log(`ソース: ${SRC} (${(text.length / 1024).toFixed(1)} KB)\n`);

// セクション (## の見出し) を抽出
// 例: ## ✨ 新機能 (59)
const lines = text.split('\n');
const sections = [];
let current = null;
const TOTAL_RE = /^- `([a-f0-9]{6,})` (\d{4}-\d{2}-\d{2}) — (.+)$/;
const SECTION_RE = /^##\s+(.+)$/;

for (const line of lines) {
  const sm = line.match(SECTION_RE);
  if (sm) {
    if (current) sections.push(current);
    current = {
      category: sm[1].trim(),
      items: [],
    };
    continue;
  }
  if (!current) continue;
  const lm = line.match(TOTAL_RE);
  if (lm) {
    current.items.push({
      hash: lm[1],
      date: lm[2],
      message: lm[3].trim(),
    });
  }
}
if (current) sections.push(current);

// total commits = 全 アイテム数
const totalCommits = sections.reduce((a, s) => a + s.items.length, 0);

// 最初の (タイトル "# CORE Prism / Iris vX") は h1 — 切る
const out = {
  generatedAt: new Date().toISOString(),
  sourceFile: SRC.replace(homedir(), '~'),
  totalCommits,
  sections: sections.filter((s) => s.items.length > 0),
};

const outPath = join(PUBLIC_DIR, 'changelog.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

console.log(`${C.green}✓ ${outPath}${C.reset} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`);
console.log(`${C.bold}集計${C.reset}: ${sections.length} セクション / ${totalCommits} commits`);
for (const s of out.sections) {
  console.log(`  · ${s.category.padEnd(28)} ${s.items.length}`);
}
