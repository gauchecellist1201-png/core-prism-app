#!/usr/bin/env node
/**
 * labelInboxFeedback.mjs — 受信 お問い合わせ を AI で 自動仕分け
 *
 * オーナー指示 (2026-06-04 第 42 波 KKKKKK):
 *   /api/feedback (kind=contact) で 届く お問い合わせ を 4 カテゴリ に
 *   AI で分類 → ~/Desktop/inbox_triage/<date>/triage.csv
 *
 * カテゴリ:
 *   - 業務 (発注 / 契約 / 法人提携)
 *   - 提案 (機能要望 / 改善提案 / フィードバック)
 *   - クレーム (バグ / 解約 / 不満)
 *   - その他 (取材 / 採用 / 雑談)
 *
 * 入力:
 *   - SRC=~/Desktop/inbox/contact.csv (なければ 内蔵 架空 30 件 を使う)
 *   - CSV columns: ts,from,subject,body
 *
 * 出力:
 *   ~/Desktop/inbox_triage/<date>/triage.csv  (元 + ai_category + ai_priority + ai_reply_hint)
 *   ~/Desktop/inbox_triage/<date>/README.md   (集計)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const today = new Date().toISOString().slice(0, 10);
const SRC = process.env.SRC || '';
const outDir = join(homedir(), 'Desktop', 'inbox_triage', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// ─── 内蔵 架空 30 件 (実在 名 では ない) ─────────────────────────
const SAMPLE = [
  { ts: '2026-06-04T08:14:00+09:00', from: 'sato@example.com',      subject: '請求書 払い 可能ですか',    body: 'ご担当者様、佐藤と申します。請求書 払い (月次) は可能でしょうか? 中小企業向け プラン を 検討中です。' },
  { ts: '2026-06-04T07:55:00+09:00', from: 'minami@example.com',    subject: 'ログイン できません',          body: '昨日 から ログイン 画面 で エラーが 出ます。Chrome です。スクショ 添付します。早急に お願いします。' },
  { ts: '2026-06-04T06:20:00+09:00', from: 'takahashi@example.jp',  subject: '機能要望: PDF出力',          body: '提案資料を PDF として 一括出力 できるように していただけると 嬉しいです。Word でも可。' },
  { ts: '2026-06-03T22:11:00+09:00', from: 'noborisaka@example.com',subject: '解約 したいです',              body: '思っていたのと違いました。今月 で 解約 でお願いします。 返金 は不要です。' },
  { ts: '2026-06-03T21:40:00+09:00', from: 'pr@news-corp.jp',       subject: '取材 のお願い',                body: 'AI スタートアップ 特集 で 取材 させていただけませんか? 30 分 オンライン で。' },
  { ts: '2026-06-03T19:25:00+09:00', from: 'partner@dx-firm.co.jp', subject: 'パートナー 提携 相談',          body: 'BtoB SaaS 連携 の 提案です。当社 の 顧客 100 社 に 御社 を 案内できる かと。代理店 契約 をご相談したい。' },
  { ts: '2026-06-03T18:45:00+09:00', from: 'creator@example.com',   subject: 'Iris で 投稿 予約 できますか', body: 'Instagram の 投稿 予約 機能 は ありますか? 毎日 同じ時間に 出したい のですが。' },
  { ts: '2026-06-03T17:10:00+09:00', from: 'mike@example.us',       subject: 'English version?',             body: 'Hi, is there an English version of the dashboard? My team is global.' },
  { ts: '2026-06-03T16:30:00+09:00', from: 'shibuya@example.co.jp', subject: '導入事例 を見たい',            body: '中小企業 の 導入事例 が知りたいです。 業種は 製造業 です。' },
  { ts: '2026-06-03T15:00:00+09:00', from: 'angry@example.com',     subject: '料金 が おかしい!!',             body: '解約 したのに 今月分 が引き落とされています。 詐欺ですか? 至急 返金 してください。' },
  { ts: '2026-06-03T13:22:00+09:00', from: 'hr@example.com',        subject: 'CHR 採用 機能 の 詳細',          body: 'CHR (採用) エージェント は どのレベルまで JD 作成 可能ですか? 当社は 月 30 名 採用しています。' },
  { ts: '2026-06-03T11:11:00+09:00', from: 'lawyer@example.com',    subject: '契約書 ドラフト 機能',          body: '法務 業務委託 を しています。 契約書 ドラフト 機能 の精度 を 試したいので Sandbox を 提供 いただけませんか。' },
  { ts: '2026-06-03T10:30:00+09:00', from: 'student@example.ac.jp', subject: '学割 はありますか?',             body: '個人事業主 向け プラン に 学割 ありますか? 24 歳 大学生 です。' },
  { ts: '2026-06-03T09:50:00+09:00', from: 'investor@example.vc',   subject: '投資 相談',                    body: 'シード で 出資 検討させていただきたい。 IR 資料 を 共有いただけますか?' },
  { ts: '2026-06-03T09:11:00+09:00', from: 'bug@example.com',       subject: '保存ボタン が 反応しない',     body: '提案書 を 作成して 保存 を押しても 何も起こりません。 Safari 17 です。' },
  { ts: '2026-06-03T08:30:00+09:00', from: 'ceo@startup.jp',        subject: 'SaaS スタートアップ向け 料金', body: '新しい /lp/saas-startup を見ました。 月 ¥30,000 は 1 名 / 5 名 で 同じですか?' },
  { ts: '2026-06-03T07:40:00+09:00', from: 'sora@example.com',      subject: '解約 されない',                  body: '解約 ボタン を 何度 押しても 「処理中」 で 止まります。 これも バグですか? 早く 解約させてください。' },
  { ts: '2026-06-02T22:55:00+09:00', from: 'thanks@example.com',    subject: '使ってみた 感想',               body: '本当に 助かっています! 14 役員 に 相談すると 寝る時間 が 増えました。 ありがとう。' },
  { ts: '2026-06-02T21:25:00+09:00', from: 'feedback@example.com',  subject: 'モバイル UI 改善 提案',          body: 'iPhone で CXO ボタン が 押しにくい。 もう少し 大きく すると 良いかも。' },
  { ts: '2026-06-02T20:10:00+09:00', from: 'enterprise@example.com',subject: 'エンタープライズ 想定',          body: '社員 200 名 で SSO 必要、 監査ログ + 役割管理 を 求めています。 想定金額 と 提供時期 を 知りたい。' },
  { ts: '2026-06-02T18:00:00+09:00', from: 'restart@example.com',   subject: '再開 したいです',                body: '先月 解約 した者です。 再開 する場合 の 手順を 教えてください。' },
  { ts: '2026-06-02T16:30:00+09:00', from: 'meet@example.com',      subject: 'デモ ミーティング 希望',         body: '社内 5 名 で デモ を見たい です。 来週 火曜 か 木曜 で 30 分 いかがでしょうか。' },
  { ts: '2026-06-02T15:11:00+09:00', from: 'security@example.com',  subject: 'SOC2 / ISO27001 の 取得状況',   body: '弊社 セキュリティ要件 で SOC2 必須 です。 取得 状況 と 監査レポート 提供 可否 を 教えてください。' },
  { ts: '2026-06-02T13:33:00+09:00', from: 'help@example.com',      subject: 'パスワード を 忘れた',           body: 'ログイン できません。 パスワード リセット の 方法 を 教えてください。' },
  { ts: '2026-06-02T11:50:00+09:00', from: 'media@example.com',     subject: 'ニュースサイト 取材',            body: '日経 系の メディア です。 AI 役員 の 取り組み を 取材させてください。 5 月号 に 載せます。' },
  { ts: '2026-06-02T10:00:00+09:00', from: 'product@example.com',   subject: 'API 公開 予定',                  body: 'CRM データ を 自社システム と 連携 したいです。 公開 API は ありますか?' },
  { ts: '2026-06-02T09:15:00+09:00', from: 'churn@example.com',     subject: 'やめます',                       body: 'いまの 競合 SaaS に 戻ります。 価格 がもう少し 安ければ。' },
  { ts: '2026-06-02T08:10:00+09:00', from: 'fan@example.com',       subject: 'CORE Prism 大好き',              body: '毎朝 開いてます。 CXO チャット が 楽しい です! このまま 進化してください。' },
  { ts: '2026-06-01T22:22:00+09:00', from: 'integration@example.com',subject: 'Slack 連携 はいつですか?',       body: 'Slack に CXO の 提案 を 自動投稿 したい。 ロードマップ に ありますか?' },
  { ts: '2026-06-01T19:45:00+09:00', from: 'price@example.com',     subject: '料金 値上げ について',           body: '個人 プラン を 5,000 円 から 3,000 円 に 変えた理由 を 教えてください。 既存ユーザー は どうなりますか?' },
];

// ─── CSV パース (任意の SRC) ─────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
function csvLines(text) {
  const lines = []; let cur = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += c; }
    } else if (c === '\n' && !inQ) { lines.push(cur); cur = ''; }
    else cur += c;
  }
  if (cur) lines.push(cur);
  return lines.filter(l => l.trim());
}
function readCsvRows(path) {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const lines = csvLines(text);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    const o = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ''; });
    return o;
  });
}

// ─── 入力 セット ─────────────────────────
let rows = [];
if (SRC && existsSync(SRC)) {
  rows = readCsvRows(SRC);
  console.log(`${C.dim}入力: ${SRC} (${rows.length} 件)${C.reset}\n`);
} else {
  rows = SAMPLE;
  console.log(`${C.yellow}⚠ SRC 指定なし — 架空 サンプル ${SAMPLE.length} 件 を使用${C.reset}\n`);
}

// ─── AI 1 件 仕分け ─────────────────────────
const SYSTEM = `あなたは BtoB SaaS の カスタマーサポート リード です。
受信 お問い合わせ メール を 純 JSON で 仕分けしてください。

出力 形式 (純 JSON のみ、 \`\`\`json 禁止):
{
  "category": "業務" | "提案" | "クレーム" | "その他",
  "priority": "high" | "mid" | "low",
  "reply_hint": "返信時の 1 文 ヒント (40 字以内)"
}

カテゴリ 判定:
- 業務 = 発注 / 契約 / 法人提携 / 料金問い合わせ / 導入相談 / SSO・SOC2
- 提案 = 機能要望 / 改善提案 / ロードマップ 質問 / API
- クレーム = バグ / 解約申し出 / 不満 / 返金要求 / 罵倒
- その他 = 取材 / 採用 / 投資 / 雑談 / 感謝

優先度:
- high  = 解約 / 返金 / 障害 / 投資 / メディア 取材
- mid   = 機能要望 / 料金問い合わせ / 法人 提携
- low   = 感謝 / 雑談 / 学割 / 一般 質問`;

async function callOnce(row) {
  const prompt = [
    `From: ${row.from}`,
    `Subject: ${row.subject}`,
    `Body: ${row.body}`,
  ].join('\n');
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfterSec = Number(res.headers.get('retry-after')) || 0;
    throw err;
  }
  const j = await res.json();
  const raw = (j.content?.[0]?.text || '').trim();
  const cleaned = raw.replace(/```(?:json)?\s*\n?|```/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON 抽出失敗');
  return JSON.parse(m[0]);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function classify(row) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await callOnce(row); }
    catch (e) {
      if (e.status === 429) {
        const wait = Math.max(6, e.retryAfterSec || 0) + attempt * 4;
        process.stdout.write(`${C.yellow}↻${wait}s ${C.reset}`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
  // fallback: ヒューリスティクス
  const text = (row.subject + ' ' + row.body).toLowerCase();
  if (/解約|やめ|返金|バグ|エラー|不満|詐欺/.test(text)) return { category: 'クレーム', priority: 'high', reply_hint: '謝罪 + 状況 確認 + 24h 以内 対応' };
  if (/発注|契約|提携|請求書|sso|soc2|社員 [0-9]+|料金|プラン/.test(text)) return { category: '業務', priority: 'mid', reply_hint: '担当 1 営業日 以内に 連絡' };
  if (/要望|提案|api|機能|連携|フィードバック|改善/.test(text)) return { category: '提案', priority: 'mid', reply_hint: 'ロードマップ で 検討 → 進捗 共有' };
  return { category: 'その他', priority: 'low', reply_hint: '丁寧 1 行 で 返信' };
}

// ─── 実行 ─────────────────────────
console.log(`${C.bold}受信 お問い合わせ 仕分け${C.reset}\n`);
const enriched = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  process.stdout.write(`  ${C.dim}[${String(i + 1).padStart(2, ' ')}/${rows.length}] ${(r.subject || '').slice(0, 42).padEnd(44)}${C.reset} `);
  try {
    const ai = await classify(r);
    enriched.push({ ...r, ai_category: ai.category, ai_priority: ai.priority, ai_reply_hint: ai.reply_hint });
    const emoji = ai.category === 'クレーム' ? '🚨' : ai.category === '業務' ? '💼' : ai.category === '提案' ? '💡' : '💬';
    console.log(`${C.green}${emoji} ${ai.category} (${ai.priority})${C.reset}`);
  } catch (e) {
    console.log(`${C.red}✗ ${e.message?.slice(0, 30)}${C.reset}`);
    enriched.push({ ...r, ai_category: '?', ai_priority: '?', ai_reply_hint: 'AI 失敗' });
  }
}

// ─── CSV 出力 ─────────────────────────
function esc(s) {
  const v = String(s ?? '');
  if (/["\n,]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
const headers = ['ts', 'from', 'subject', 'body', 'ai_category', 'ai_priority', 'ai_reply_hint'];
const csvText = '﻿' + [
  headers.join(','),
  ...enriched.map((r) => headers.map((h) => esc(r[h])).join(',')),
].join('\n') + '\n';
const outPath = join(outDir, 'triage.csv');
writeFileSync(outPath, csvText, 'utf-8');

// ─── 集計 + README ─────────────────────────
const byCat = enriched.reduce((a, r) => { a[r.ai_category] = (a[r.ai_category] || 0) + 1; return a; }, {});
const byPri = enriched.reduce((a, r) => { a[r.ai_priority] = (a[r.ai_priority] || 0) + 1; return a; }, {});

const md = [];
md.push('# 受信 お問い合わせ 仕分け 結果');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`入力: ${SRC || '(架空サンプル 30 件)'}`);
md.push(`出力: \`${outPath}\``);
md.push('');
md.push('## カテゴリ 別');
md.push('');
md.push('| カテゴリ | 件数 |');
md.push('|---|---|');
for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  md.push(`| ${cat} | ${n} |`);
}
md.push('');
md.push('## 優先度 別');
md.push('');
md.push('| 優先度 | 件数 |');
md.push('|---|---|');
for (const [pri, n] of Object.entries(byPri).sort((a, b) => b[1] - a[1])) {
  md.push(`| ${pri} | ${n} |`);
}
md.push('');
md.push('## 🚨 high 案件 (今日 必ず 触る)');
md.push('');
const highs = enriched.filter((r) => r.ai_priority === 'high');
for (const h of highs) {
  md.push(`- **[${h.ai_category}]** ${h.subject} (${h.from})`);
  md.push(`  - 返信ヒント: ${h.ai_reply_hint}`);
}
md.push('');
md.push('## 使い方');
md.push('');
md.push('1. high のみ 即返信 (24h 以内)');
md.push('2. mid は 当日 / 翌日');
md.push('3. low は バッチで 週次 OK');
md.push('');
md.push('## 再実行');
md.push('');
md.push('```');
md.push('SRC=~/Desktop/inbox/contact.csv node scripts/labelInboxFeedback.mjs');
md.push('```');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存${C.reset}: ${outPath}`);
console.log(`${C.bold}集計${C.reset}: ${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
console.log(`${C.bold}優先度${C.reset}: ${Object.entries(byPri).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
