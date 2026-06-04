#!/usr/bin/env node
/**
 * draftReleaseTweet.mjs — リリースノートを X (Twitter) 投稿の下書きに変換
 *
 * オーナー指示 (2026-06-04 第 31 波 CCCCC):
 *   直近のリリースノート (~/Desktop/release_notes/v1.0.md) を AI に要約させ、
 *   X (旧 Twitter) 用の投稿下書きを 3 形式で出力:
 *     1. tweet-140.txt    — 1 投稿 140 字 (圧縮版)
 *     2. tweet-280.txt    — 1 投稿 280 字 (拡張版)
 *     3. thread-3.txt     — 3 連続スレッド (フック → 本文 → CTA)
 *   AI 失敗時は機械的な fallback (見出し抜粋) で必ず何か返す。
 *
 * 使い方:
 *   node scripts/draftReleaseTweet.mjs
 *   RELEASE_NOTES=~/Desktop/release_notes/v1.0.md node scripts/draftReleaseTweet.mjs
 *
 * 出力:
 *   ~/Desktop/x_drafts/<date>/
 *     tweet-140.txt
 *     tweet-280.txt
 *     thread-3.txt
 *     README.md (元ソース + 採用フロー)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const RELEASE_NOTES = process.env.RELEASE_NOTES
  || join(homedir(), 'Desktop', 'release_notes', 'v1.0.md');
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'x_drafts', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

if (!existsSync(RELEASE_NOTES)) {
  console.error(`${C.red}✗ リリースノート が見つかりません: ${RELEASE_NOTES}${C.reset}`);
  console.error(`   先に scripts/generateReleaseNotes.mjs を実行するか、 RELEASE_NOTES env で別ファイルを指定してください。`);
  process.exit(1);
}

const notes = readFileSync(RELEASE_NOTES, 'utf-8');
const totalCommits = (notes.match(/^- `[a-f0-9]/gm) || []).length;
const firstLines = notes.split('\n').slice(0, 80).join('\n');

console.log(`${C.bold}X (Twitter) 投稿下書き 生成${C.reset}`);
console.log(`ソース: ${RELEASE_NOTES} (${(notes.length / 1024).toFixed(1)} KB / ${totalCommits} commits)\n`);

// ─── AI に依頼 ─────────────────────────
const SYSTEM = `あなたは ソフトウェア スタートアップ の 広報コピーライターです。
リリースノート (Markdown) を読み取り、X (Twitter) で「読者の指が止まる」 投稿に変換してください。
ルール:
- 数字 を 必ず 1 つ以上 入れる (例: "75 件アップグレード / 3 日 / 14 役員")
- 横文字は最小限、専門用語は和訳を併記
- 絵文字は最大 3 個 まで (盛りすぎ NG)
- ハッシュタグは末尾に 2 個 (#AI / #SaaS など)
- 嘘の数字 / 誇張表現 (世界 No.1 等) は禁止
- リンク: https://core-prism-app.vercel.app
`;

async function callOnce(userPrompt) {
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfterSec = retryAfter;
    throw err;
  }
  const j = await res.json();
  return j.content?.[0]?.text || '';
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function aiOrFallback(label, prompt, fallback) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await callOnce(prompt);
      if (!out) throw new Error('空応答');
      console.log(`  ${C.green}✓ ${label} (${out.length} 字)${C.reset}`);
      return out.trim();
    } catch (e) {
      if (e.status === 429) {
        const wait = Math.max(6, e.retryAfterSec || 0) + attempt * 4;
        console.log(`  ${C.yellow}↻ ${label} 429 — ${wait}s 待機${C.reset}`);
        await sleep(wait * 1000);
        continue;
      }
      console.log(`  ${C.red}✗ ${label} fallback (${e.message})${C.reset}`);
      return fallback;
    }
  }
  return fallback;
}

// ─── 各形式 ─────────────────────────
const sharedContext = `直近のリリースノート (抜粋):

${firstLines}

合計 ${totalCommits} commits の更新です。`;

console.log(`${C.dim}→ AI に 3 種類の下書きを依頼中...${C.reset}`);

// 1) 140 字 (圧縮版)
const tweet140 = await aiOrFallback(
  'tweet-140',
  `${sharedContext}\n\n上記の更新を 140 字以内 の 1 投稿 にまとめてください (改行可)。\nリンクとハッシュタグ 込みで 140 字を厳守。`,
  `🚀 CORE Prism / Iris を ${totalCommits} 件アップグレード — AI 役員 14 名で 経営判断 と 営業 と 採用 を 7 日無料で。\n\nhttps://core-prism-app.vercel.app #AI #SaaS`,
);

// 2) 280 字 (拡張版)
const tweet280 = await aiOrFallback(
  'tweet-280',
  `${sharedContext}\n\n上記の更新を 280 字以内 の 1 投稿 にまとめてください (改行可)。\n3 つの代表的アップデートを「数字」で示し、リンクとハッシュタグ込みで 280 字以内。`,
  `🚀 CORE Prism / Iris に ${totalCommits} 件の更新が入りました。\n\n✨ AI 役員 14 名 が 経営判断・営業・採用 を並列実行\n💴 Stripe 売上 を 毎朝 Slack に自動レポート\n🛡 Trust ページ + Status ページ 公開\n\n7 日 無料 (カード不要)。\n\nhttps://core-prism-app.vercel.app #AI #SaaS`,
);

// 3) 3 連続スレッド
const thread3 = await aiOrFallback(
  'thread-3',
  `${sharedContext}\n\n上記を 3 連続 スレッド に分けてください。\n\n各投稿 280 字以内 / 改行可 / "1/3" "2/3" "3/3" を行頭に付ける / 1 投稿目は フック (注意を引く問いかけ) / 2 投稿目は 主要更新 3 つ を 箇条書き / 3 投稿目は CTA (https://core-prism-app.vercel.app) を含む。`,
  `1/3\n会社の意思決定、まだ 1 人で抱えてませんか?\n月¥30,000 で「AI 役員 14 名」が並列に動く時代になりました。\n\n2/3\n直近の主な更新 (${totalCommits} 件 から 3 つ):\n✨ AI 役員 14 名 + 経営判断 を 10 分で 3 案\n💴 Stripe 売上 を 毎朝 Slack 通知\n🛡 Trust + Status ページ 公開 / GDPR 準拠\n\n3/3\n7 日 無料 (カード不要) — まずは ダッシュボード を 触ってみてください。\nhttps://core-prism-app.vercel.app\n#AI #SaaS`,
);

// ─── 書き出し ─────────────────────────
writeFileSync(join(outDir, 'tweet-140.txt'), tweet140 + '\n', 'utf-8');
writeFileSync(join(outDir, 'tweet-280.txt'), tweet280 + '\n', 'utf-8');
writeFileSync(join(outDir, 'thread-3.txt'), thread3 + '\n', 'utf-8');

// README
const md = [];
md.push('# X (Twitter) 投稿下書き — リリース予告 3 形式');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ソース: ${RELEASE_NOTES}`);
md.push(`元 commits: ${totalCommits}`);
md.push('');
md.push('## 出力');
md.push('');
md.push('- `tweet-140.txt` 1 投稿 140 字 (圧縮)');
md.push('- `tweet-280.txt` 1 投稿 280 字 (拡張)');
md.push('- `thread-3.txt`  3 連続スレッド (フック → 本文 → CTA)');
md.push('');
md.push('## 添付推奨 画像 (1 投稿目向け)');
md.push('');
md.push('- `public/og/og-prism-v3.png` (1200×630)');
md.push('- `public/og/industry-saas-startup.png` (新 LP の OG)');
md.push('- `~/Desktop/onboarding_video/<date>/onboarding.gif` (75 秒オンボ動画 GIF)');
md.push('');
md.push('## 採用フロー');
md.push('');
md.push('1. 3 形式から「投げたい長さ」を選ぶ');
md.push('2. 数字 / リンク / ハッシュタグ を確認 (誤字 / 誇張なし)');
md.push('3. X (Twitter) Web で投稿、または api/cron/daily-x-post と連携');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`  tweet-140.txt (${tweet140.length} 字)`);
console.log(`  tweet-280.txt (${tweet280.length} 字)`);
console.log(`  thread-3.txt (${thread3.length} 字 / 3 投稿)`);
