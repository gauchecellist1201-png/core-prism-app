#!/usr/bin/env node
/**
 * generateApiDocs.mjs — api/ 以下の Edge / Serverless function を スキャン → Markdown
 *
 * オーナー指示 (2026-06-04 第 27 波 QQQQ):
 *   各 endpoint の input / output / auth / レート制限 を 1 つの公開可能な
 *   ドキュメントに集約。
 *
 * 動作:
 *   - api/ を再帰スキャン (.ts のみ / _lib は除外)
 *   - ファイル先頭の ============= コメント ブロックを「説明」として抽出
 *   - HTTP メソッド + パス + auth (x-master-key / Bearer / cron) を grep ヒューリスティクス
 *   - レート制限 (RATE_MAX 等) を grep
 *
 * 使い方:
 *   node scripts/generateApiDocs.mjs
 *
 * 出力:
 *   ~/Desktop/api_docs/v1.md
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ROOT = process.cwd();
const API_ROOT = join(PROJECT_ROOT, 'api');
const outDir = join(homedir(), 'Desktop', 'api_docs');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'v1.md');

function walk(dir, list = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (f === 'node_modules' || f === '.git') continue;
      walk(p, list);
    } else if (f.endsWith('.ts')) {
      list.push(p);
    }
  }
  return list;
}

const files = walk(API_ROOT).sort();

// ファイル先頭の `// =====` ブロックを抜き出す
function extractHeader(src) {
  const lines = src.split('\n');
  let start = -1, end = -1;
  for (let i = 0; i < Math.min(80, lines.length); i++) {
    if (/^\/\/\s*=+/.test(lines[i])) {
      if (start === -1) start = i + 1;
      else { end = i; break; }
    }
  }
  if (start === -1 || end === -1) return '';
  return lines.slice(start, end)
    .map(l => l.replace(/^\/\/\s?/, '').trim())
    .join('\n')
    .trim();
}

function inferUrlPath(absPath) {
  // api/foo/bar.ts → /api/foo/bar
  const rel = relative(API_ROOT, absPath).replace(/\\/g, '/');
  return '/api/' + rel.replace(/\.ts$/, '');
}

function detectRuntime(src) {
  if (/runtime:\s*['"]edge['"]/.test(src)) return 'edge';
  if (/runtime:\s*['"]node['"]/.test(src)) return 'node';
  return 'serverless (既定 / node)';
}

function detectMethods(src) {
  // if (req.method === 'POST') 形式の grep
  const found = new Set();
  for (const m of src.matchAll(/req\.method\s*[!=]==?\s*['"](GET|POST|PUT|DELETE|PATCH|OPTIONS)['"]/g)) {
    found.add(m[1]);
  }
  if (found.size === 0) {
    // 直接 export default handler の場合は不明
    return ['GET', 'POST'];
  }
  return [...found].sort();
}

function detectAuth(src, path) {
  const items = [];
  if (/x-master-key/.test(src)) items.push('🔐 **master key** (`x-master-key: GAUCHE2026`) — オーナー専用');
  if (/CRON_SECRET/.test(src) || /\/api\/cron\//.test(path)) items.push('⏰ **Vercel Cron** (`Authorization: Bearer <CRON_SECRET>`)');
  if (/STRIPE_WEBHOOK_SECRET/.test(src)) items.push('🔏 **Stripe Webhook 署名** (`stripe-signature`)');
  if (/cors|Allow-Origin/.test(src) && !items.length) items.push('🌐 **CORS** で同オリジン許可 (LP / Iris / Localhost)');
  if (!items.length) items.push('🔓 認証なし (公開) — 必要に応じて IP レート制限');
  return items;
}

function detectRate(src) {
  const items = [];
  const m1 = src.match(/RATE_MAX\s*=\s*(\d+)/);
  const m2 = src.match(/RATE_WINDOW_MS\s*=\s*(\d+_?\d*)/);
  if (m1 && m2) {
    const window = Number(m2[1].replace(/_/g, ''));
    items.push(`${m1[1]} req / ${Math.round(window / 1000)} 秒 (IP 単位)`);
  }
  if (/sendBeacon/.test(src)) items.push('beacon (背面送信)');
  if (/keepalive/.test(src)) items.push('keepalive 対応 (端末離脱後も完了)');
  return items.length ? items.join(' · ') : '（明示なし）';
}

function inferBody(src) {
  // body: { ... } を取り出すヒューリスティクス
  const m = src.match(/let\s+body\s*:\s*\{([\s\S]*?)\}\s*;/);
  if (!m) return null;
  return m[1].split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 10);
}

// ─── Markdown 構築 ─────────────────────────
const md = [];
md.push('# CORE Prism / Iris — API ドキュメント (v1)');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`スキャン対象: ${files.length} files (api/**)`);
md.push('');
md.push('## 目次');
md.push('');

const sections = [];
for (const f of files) {
  const src = readFileSync(f, 'utf-8');
  // _lib (テンプレ) は除外
  if (/api\/_lib\//.test(f)) continue;
  const path = inferUrlPath(f);
  const header = extractHeader(src);
  const runtime = detectRuntime(src);
  const methods = detectMethods(src);
  const auth = detectAuth(src, path);
  const rate = detectRate(src);
  const body = inferBody(src);

  sections.push({ path, header, runtime, methods, auth, rate, body });
}

for (const s of sections) {
  const anchor = s.path.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  md.push(`- [\`${s.path}\`](#${anchor}) (${s.methods.join(' / ')})`);
}
md.push('');
md.push('---');
md.push('');

for (const s of sections) {
  const anchor = s.path.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  md.push(`## <a id="${anchor}"></a>\`${s.path}\``);
  md.push('');
  md.push(`- **メソッド**: ${s.methods.join(' / ')}`);
  md.push(`- **ランタイム**: ${s.runtime}`);
  md.push(`- **レート制限**: ${s.rate}`);
  md.push('- **認証**:');
  for (const a of s.auth) md.push(`  - ${a}`);
  if (s.body && s.body.length) {
    md.push('- **リクエスト ボディ** (推定 TypeScript フィールド):');
    md.push('  ```ts');
    md.push('  {');
    for (const f of s.body) md.push(`    ${f};`);
    md.push('  }');
    md.push('  ```');
  }
  if (s.header) {
    md.push('');
    md.push('### 説明');
    md.push('');
    md.push('```');
    md.push(s.header);
    md.push('```');
  }
  md.push('');
  md.push('---');
  md.push('');
}

md.push('## 共通ヘルパー (api/_lib/)');
md.push('');
md.push('- `email-templates.ts` — Resend 送信用 HTML テンプレ');
md.push('- `fxRate.ts` — JPY/USD 為替レート (固定 / 為替 API 連携)');
md.push('- `secretsHealth.ts` — `/master/secrets-health` で疎通テスト');
md.push('');
md.push('## 補足');
md.push('');
md.push('- 多くの Edge endpoint は `Upstash Redis REST` を任意で利用 (未設定でも 200 を返す)');
md.push('- レート制限は edge instance 単位のメモリ map (本番は WAF / Vercel rate limit を別途設定推奨)');
md.push('- 認証 ヘッダの値はサーバ env から読む。`master key` は `GAUCHE2026` (オーナー指定)');

writeFileSync(outPath, md.join('\n'), 'utf-8');

console.log(`✓ ${sections.length} endpoints 解析完了`);
console.log(`保存: ${outPath}`);
console.log(`サイズ: ${(Buffer.byteLength(md.join('\n')) / 1024).toFixed(1)} KB`);
