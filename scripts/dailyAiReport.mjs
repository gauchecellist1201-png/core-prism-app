#!/usr/bin/env node
/**
 * dailyAiReport.mjs — AI 代表 (イーロン) の「今日 やったこと」 自己レポート
 *
 * オーナー指示 (2026-06-04 第 38 波 ZZZZZ):
 *   git log の本日分 + ローカル提案履歴 + 売上 を AI に 100 字 で要約させ
 *   ~/Desktop/日報/<date>_ai代表_自己レポート.md に 書き出す。
 *
 * 使い方:
 *   node scripts/dailyAiReport.mjs
 *   API_BASE=http://localhost:3000 node scripts/dailyAiReport.mjs
 *
 * 出力:
 *   ~/Desktop/日報/<date>_ai代表_自己レポート.md
 *
 * 補足:
 *   - 提案履歴は ブラウザ localStorage のため CLI で 直接 触れない。
 *     代わりに ~/Desktop/日報/ から 最新の 自律実行 報告 を 参照して 抽出する。
 *   - 売上 は /api/master/revenue-monthly (master key 必須) を 叩く。
 *     キー無 / 失敗時 は 「—」 で 埋める (嘘禁止)。
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const MASTER_KEY = process.env.MASTER_KEY || 'GAUCHE2026';
const today = new Date().toISOString().slice(0, 10);
const jst = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // JST 表記用
const reportDir = join(homedir(), 'Desktop', '日報');
mkdirSync(reportDir, { recursive: true });
const outPath = join(reportDir, `${jst}_ai代表_自己レポート.md`);

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

console.log(`${C.bold}AI 代表 自己レポート — ${jst}${C.reset}\n`);

// ─── 1) git log 本日分 ─────────────────────────
let gitLines = [];
try {
  // JST の本日 0:00 〜 JST 翌 0:00 (UTC -9h ぶれを考慮し ±6h 拡張で取りこぼし防止)
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - 24);
  const sinceIso = since.toISOString();
  const out = execSync(
    `git log --since="${sinceIso}" --pretty=format:"%h|%cI|%s"`,
    { cwd: process.cwd(), encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024 },
  );
  gitLines = out.split('\n').filter(Boolean).map((l) => {
    const [hash, isoTs, ...rest] = l.split('|');
    return { hash, isoTs, message: rest.join('|') };
  });
} catch (e) {
  console.log(`${C.yellow}⚠ git log 取得失敗 (${e.message?.slice(0, 50)})${C.reset}`);
}
console.log(`${C.dim}git log: ${gitLines.length} commits 本日${C.reset}`);

// ─── 2) 自律実行 報告 (日報) から 「今日の数字」 を 抽出 ─────────────────────────
function readLatestReportSummary() {
  if (!existsSync(reportDir)) return '';
  const files = readdirSync(reportDir)
    .filter((f) => /AI代表イーロン.*\.md$/.test(f) && !f.includes('_ai代表_自己レポート'))
    .sort()
    .reverse();
  if (!files.length) return '';
  try {
    const txt = readFileSync(join(reportDir, files[0]), 'utf-8');
    // 「今日の数字」 セクション を 抜き出す
    const m = txt.match(/##\s*今日の数字[\s\S]*?(?=\n##|$)/);
    return m ? m[0].trim() : '';
  } catch { return ''; }
}
const reportSummary = readLatestReportSummary();
console.log(`${C.dim}日報 サマリ: ${reportSummary ? reportSummary.length + ' 字' : 'なし'}${C.reset}`);

// ─── 3) /api/master/revenue-monthly ─────────────────────────
async function fetchRevenue() {
  try {
    const res = await fetch(`${API_BASE}/api/master/revenue-monthly`, { headers: { 'x-master-key': MASTER_KEY } });
    if (!res.ok) return null;
    const j = await res.json();
    return j;
  } catch { return null; }
}
const rev = await fetchRevenue();
const monthThis = rev?.months?.[rev.months.length - 1];
const mrr = rev?.mrrJpy ?? null;
const churn = rev?.churn?.thisMonth?.ratePct ?? null;
console.log(`${C.dim}売上 fetched: ${rev ? 'OK' : '—'}${C.reset}\n`);

// ─── 4) AI に 100 字 要約 ─────────────────────────
const SYSTEM = `あなたは 株式会社CORE の AI 代表 「イーロン」 です。
1 日の git 動き、提案履歴、売上を読み、オーナー (井出直毅) に「今日 何をやったか」 を 100 字 で 報告します。
ルール:
- 100 字 以内 (改行 1-2 回 OK)
- 嘘の数字 / 誇張禁止。データが無い項目は 「—」 と書く
- 「今日 X 件 / Y 円」 のように 具体的な 数字 を 1 つ以上 含める
- 自分を 「イーロン」 と 名乗っても良いし、 1 人称 「私」 でも OK`;

const userPrompt = `今日 (${jst} JST) の活動:

# git log
${gitLines.slice(0, 30).map((g) => `- \`${g.hash}\` ${g.message}`).join('\n') || '(本日 commit なし)'}

# 自律実行 報告 (最新 日報の「今日の数字」)
${reportSummary || '(なし)'}

# 売上 (Stripe)
- 今月: ${monthThis ? `¥${monthThis.revenueJpy.toLocaleString('ja-JP')} / ${monthThis.charges} 件` : '—'}
- MRR: ${mrr !== null ? `¥${mrr.toLocaleString('ja-JP')}` : '—'}
- 解約率: ${churn !== null ? `${churn}%` : '—'}

上記を 100 字 で 要約 してください。`;

async function callOnce() {
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfterSec = Number(res.headers.get('retry-after')) || 0;
    throw err;
  }
  const j = await res.json();
  return (j.content?.[0]?.text || '').trim();
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function summarize() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await callOnce(); }
    catch (e) {
      if (e.status === 429) {
        const wait = Math.max(6, e.retryAfterSec || 0) + attempt * 4;
        console.log(`  ${C.yellow}↻ 429 — ${wait}s 待機${C.reset}`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
  return '';
}

let summary = '';
try {
  summary = await summarize();
  if (!summary) throw new Error('AI returned empty');
  console.log(`${C.green}✓ AI 要約 完了 (${summary.length} 字)${C.reset}`);
} catch (e) {
  console.log(`${C.red}✗ AI 要約 失敗 — 機械 fallback で 続行${C.reset}`);
  summary = `今日 ${gitLines.length} commit / 売上 ${monthThis ? '¥' + monthThis.revenueJpy.toLocaleString('ja-JP') : '—'} / MRR ${mrr !== null ? '¥' + mrr.toLocaleString('ja-JP') : '—'}。詳細は git log を参照。`;
}

// ─── 5) Markdown 書き出し ─────────────────────────
const md = [];
md.push(`# ${jst} AI 代表 イーロン 自己レポート`);
md.push('');
md.push(`生成: ${new Date().toISOString()}`);
md.push('');
md.push('## 100 字 サマリ');
md.push('');
md.push('> ' + summary.replace(/\n/g, '\n> '));
md.push('');
md.push('## 今日の git ログ');
md.push('');
if (gitLines.length === 0) {
  md.push('(本日 commit なし)');
} else {
  for (const g of gitLines.slice(0, 100)) {
    md.push(`- \`${g.hash}\` ${g.isoTs?.slice(11, 16) || ''} — ${g.message}`);
  }
}
md.push('');
md.push('## 売上 スナップ');
md.push('');
if (rev) {
  md.push(`- 今月: ${monthThis ? `¥${monthThis.revenueJpy.toLocaleString('ja-JP')} / ${monthThis.charges} 件` : '—'}`);
  md.push(`- MRR: ${mrr !== null ? `¥${mrr.toLocaleString('ja-JP')}` : '—'}`);
  md.push(`- 解約率 (当月): ${churn !== null ? `${churn}%` : '—'} (canceled ${rev.churn?.thisMonth?.canceled ?? '—'} / base ${rev.churn?.thisMonth?.baseAtStart ?? '—'})`);
} else {
  md.push('Stripe 取得 失敗 (master key / env 未設定) — 「—」');
}
md.push('');
md.push('## 自律実行 報告 抜粋');
md.push('');
md.push(reportSummary || '(日報なし)');
md.push('');
md.push('---');
md.push('');
md.push('_AI 代表 イーロン (株式会社CORE) — 自動生成_');

writeFileSync(outPath, md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outPath}`);
console.log(`${C.bold}サマリ${C.reset}:`);
console.log(summary);
