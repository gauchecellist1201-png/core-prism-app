#!/usr/bin/env node
/**
 * generateReleaseNotes.mjs — git log を Claude で要約してリリースノート生成
 *
 * オーナー指示 (2026-06-04 第 26 波 OOOO):
 *   ~/Desktop/release_notes/v1.0.md として保存。
 *
 * 使い方:
 *   node scripts/generateReleaseNotes.mjs                 # 直近 200 コミット
 *   node scripts/generateReleaseNotes.mjs --since 2026-05-01
 *   node scripts/generateReleaseNotes.mjs --version v1.1
 *   API_BASE=http://localhost:3000 node scripts/generateReleaseNotes.mjs
 *
 * 動作:
 *   1) git log でフォーマット済の行を取得
 *   2) /api/ai に投げて Markdown 形式の リリースノートを生成
 *      (callAiWithFallback 経由 — Edge runtime も同様の挙動)
 *   3) ~/Desktop/release_notes/<version>.md に保存
 *
 * AI 呼出が失敗した場合は素のコミット一覧 (構造化) で保存する。
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
function argOf(name, defVal) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return defVal;
}

const VERSION = argOf('version', 'v1.0');
const SINCE = argOf('since', null);
const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const COMMIT_LIMIT = Number(argOf('limit', '200'));

const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'release_notes');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${VERSION}.md`);

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m' };

console.log(`${C.bold}リリースノート 生成 — ${VERSION}${C.reset}`);
console.log(`commit 範囲: ${SINCE ? `since ${SINCE}` : `直近 ${COMMIT_LIMIT}`}`);
console.log(`AI base: ${API_BASE}\n`);

// ─── git log 取得 ─────────────────────────────
const gitArgs = ['log', '--pretty=format:%h|%ad|%s', '--date=short'];
if (SINCE) gitArgs.push(`--since=${SINCE}`);
else gitArgs.push(`-n`, String(COMMIT_LIMIT));

let raw;
try {
  raw = execSync(`git ${gitArgs.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, { encoding: 'utf-8' });
} catch (e) {
  console.error(`${C.red}git log 失敗: ${e.message}${C.reset}`);
  process.exit(2);
}

const lines = raw.split('\n').filter(Boolean);
console.log(`${C.dim}取得: ${lines.length} commits${C.reset}`);

// 機能カテゴリの素朴ヒューリスティクス分類 (AI 失敗時の fallback として使う)
function categorize(msg) {
  const m = msg.toLowerCase();
  if (m.startsWith('feat')) return '✨ 新機能';
  if (m.startsWith('fix') || m.startsWith('bug')) return '🐛 修正';
  if (m.startsWith('docs')) return '📝 ドキュメント';
  if (m.startsWith('refactor') || m.startsWith('chore') || m.startsWith('style')) return '🔧 内部改善';
  if (m.startsWith('perf')) return '⚡ パフォーマンス';
  if (m.startsWith('test')) return '✅ テスト';
  return '🌀 その他';
}

const byCat = {};
for (const line of lines) {
  const [hash, date, ...rest] = line.split('|');
  const msg = rest.join('|');
  const cat = categorize(msg);
  (byCat[cat] ||= []).push({ hash, date, msg });
}

// AI 用のプロンプト (短く要約してもらう)
const SYSTEM_AI = `あなたはソフトウェア リリース ノート ライターです。
以下の Git コミット 一覧から、ユーザー向けの Markdown リリース ノートを書いてください。

ルール:
1. 見出し: # CORE Prism / Iris ${VERSION} リリース ノート
2. 「ハイライト」3-5 個を最上部に
3. 続いて「新機能 / 改善 / 修正 / 内部」のセクション
4. 各項目は 1-2 行 (専門用語は最小限。ユーザーが分かる言葉で)
5. 同種の変更は 1 行 にまとめる (例: 「AI フォールバック強化」)
6. 末尾に「謝辞」を 1 行`;

const flat = lines.slice(0, 250).join('\n');

async function aiSummarize() {
  try {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2500,
        system: SYSTEM_AI,
        messages: [{ role: 'user', content: `次の Git コミット (新しい順) からリリースノートを生成してください:\n\n${flat}` }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const text = j.content?.[0]?.text;
    if (!text) throw new Error('empty');
    return text;
  } catch (e) {
    console.log(`${C.red}AI 要約 失敗 (${e.message}) — 素のリストで出力します${C.reset}`);
    return null;
  }
}

const ai = await aiSummarize();

let md;
if (ai) {
  md = ai + '\n\n---\n\n' + renderRaw();
} else {
  md = renderRaw();
}

function renderRaw() {
  const lines2 = [];
  lines2.push(`# CORE Prism / Iris ${VERSION} — 全 ${lines.length} commits`);
  lines2.push('');
  lines2.push(`生成日時: ${new Date().toISOString()}`);
  lines2.push('');
  for (const [cat, items] of Object.entries(byCat)) {
    lines2.push(`## ${cat} (${items.length})`);
    lines2.push('');
    for (const it of items.slice(0, 60)) {
      lines2.push(`- \`${it.hash}\` ${it.date} — ${it.msg}`);
    }
    if (items.length > 60) lines2.push(`- ... 他 ${items.length - 60} 件`);
    lines2.push('');
  }
  return lines2.join('\n');
}

writeFileSync(outPath, md, 'utf-8');
console.log('');
console.log(`${C.green}✓ 保存: ${outPath}${C.reset}`);
console.log(`${C.dim}サイズ: ${(Buffer.byteLength(md) / 1024).toFixed(1)} KB${C.reset}`);
