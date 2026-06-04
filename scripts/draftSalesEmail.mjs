#!/usr/bin/env node
/**
 * draftSalesEmail.mjs — AI 営業 メール 自動作成 (1 社 1 通)
 *
 * オーナー指示 (2026-06-04 第 33 波 IIIII):
 *   enrichLeadList.mjs (FFFFF) の出力 CSV を読み、
 *   各社向けに「件名 / 本文 250 字」 を AI で 書き出し。
 *   署名は「CORE 代表 井出直毅 (gauche.cellist1201@gmail.com)」固定。
 *
 * 使い方:
 *   node scripts/draftSalesEmail.mjs
 *   SRC=~/Desktop/sales_lists_enriched/2026-06-04 node scripts/draftSalesEmail.mjs
 *   LIMIT=5 ONLY=sme node scripts/draftSalesEmail.mjs
 *   API_BASE=http://localhost:3000 node scripts/draftSalesEmail.mjs
 *
 * 出力:
 *   ~/Desktop/sales_emails/<date>/<industry>/<N>_<contact>.txt
 *   ~/Desktop/sales_emails/<date>/README.md (集計)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const LIMIT = process.env.LIMIT ? Math.max(1, Number(process.env.LIMIT)) : Infinity;
const ONLY = process.env.ONLY ? String(process.env.ONLY) : '';
const today = new Date().toISOString().slice(0, 10);

// SRC: 直前 (今日) の enriched ディレクトリ を 自動探索
function pickSrcDir() {
  if (process.env.SRC) return process.env.SRC;
  const base = join(homedir(), 'Desktop', 'sales_lists_enriched');
  if (!existsSync(base)) return '';
  const subs = readdirSync(base)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const s of subs) {
    const p = join(base, s);
    if (statSync(p).isDirectory() && readdirSync(p).some((f) => f.endsWith('.csv'))) return p;
  }
  return '';
}
const SRC = pickSrcDir();
const OUT_DIR = join(homedir(), 'Desktop', 'sales_emails', today);
mkdirSync(OUT_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

if (!SRC || !existsSync(SRC)) {
  console.error(`${C.red}✗ enriched CSV ディレクトリが見つかりません。${C.reset}`);
  console.error(`   先に: node scripts/enrichLeadList.mjs を実行するか、 SRC=<path> で指定してください。`);
  process.exit(1);
}

let csvFiles = readdirSync(SRC).filter((f) => f.endsWith('.csv'));
if (ONLY) csvFiles = csvFiles.filter((f) => f.includes(ONLY));
if (!csvFiles.length) {
  console.error(`${C.red}✗ 対象 CSV が 0 件です。${C.reset}`);
  process.exit(1);
}

// ─── CSV パーサ (簡易) ─────────────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
function csvLines(text) {
  const lines = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += c; }
    } else if (c === '\n' && !inQ) {
      lines.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) lines.push(cur);
  return lines.filter((l) => l.trim());
}
function readCsv(path) {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const lines = csvLines(text);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((l) => {
    const cells = parseCsvLine(l);
    const o = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ''; });
    return o;
  });
  return { headers, rows };
}

// ─── AI 1 通 生成 ─────────────────────────
const SYSTEM = `あなたは BtoB SaaS 「CORE Prism / Iris」 の代表が書く 営業メール の専門家です。
以下の条件で 1 通 メール 下書き を JSON で返します。

ルール:
1. 出力は 純 JSON のみ。\`\`\`json は禁止。形式:
   {
     "subject": "件名 (30 字以内)",
     "body": "本文 (250 字以内、敬体、改行可、署名 は別なので含めない)"
   }
2. 件名は 数字 1 つ + 受け手の状況 を 含める (例: 「事務時間 月 28h → 6h に — 1 分でご相談」)
3. 本文 構成:
   - 1 行目: 相手の名前 + 業種 を 言い当てる (拝啓 / 突然のご連絡 等は禁止)
   - 2 - 3 行: 仮説 (悩み) を 自分の言葉で 提示
   - 4 - 5 行: 解決の一手を 1 つだけ (CORE Prism / Iris)
   - 6 行目: 「5 分 だけ お話する時間」 など 軽い CTA
4. 嘘の数字 / 誇張表現 (世界 No.1 等) は 禁止。
5. 横文字 過多 禁止 (代わりに 和訳を 併記)。
6. 押し売り感 を 出さない、相手の課題に 寄り添う 姿勢。`;

const SIGNATURE = [
  '',
  '----',
  '株式会社CORE 代表取締役 井出直毅 (Naoki Ide)',
  'CORE Prism / Iris',
  'https://core-prism-app.vercel.app',
  'gauche.cellist1201@gmail.com',
  '----',
].join('\n');

async function callOnce(row, industry) {
  const userPrompt = [
    `業界: ${industry}`,
    `案件タイトル: ${row.title}`,
    `担当者名: ${row.contactName}`,
    `会社名: ${row.company || '(不明)'}`,
    `既知メモ: ${row.notes || '(なし)'}`,
    `接触経路: ${row.source || '(不明)'}`,
    row.ai_feature ? `AI 推定 特徴: ${row.ai_feature}` : '',
    row.ai_hypothesis ? `AI 推定 悩み: ${row.ai_hypothesis}` : '',
    row.ai_approach ? `AI 案 アプローチ文: ${row.ai_approach}` : '',
  ].filter(Boolean).join('\n');
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
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
  const raw = (j.content?.[0]?.text || '').trim();
  const cleaned = raw.replace(/```(?:json)?\s*\n?|```/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON 抽出失敗');
  return JSON.parse(m[0]);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function draft(row, industry) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await callOnce(row, industry); }
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
  throw new Error('上限到達');
}

function safeName(s) {
  return String(s || 'lead').replace(/[\s\/\\:\*\?"<>\|]/g, '_').slice(0, 40);
}

// ─── 実行 ─────────────────────────
console.log(`${C.bold}営業 メール 自動作成${C.reset}`);
console.log(`入力 CSV: ${SRC} (${csvFiles.length} ファイル)`);
console.log(`出力: ${OUT_DIR}\n`);

const summary = [];
for (const file of csvFiles) {
  const industry = file.replace(/\.csv$/, '');
  const sub = join(OUT_DIR, industry);
  mkdirSync(sub, { recursive: true });
  const { rows } = readCsv(join(SRC, file));
  const totalToWrite = Math.min(rows.length, LIMIT);
  console.log(`${C.bold}→ ${file}${C.reset} (${totalToWrite}/${rows.length} 社)`);
  let ok = 0, ng = 0;
  for (let i = 0; i < rows.length; i++) {
    if (i >= LIMIT) break;
    const r = rows[i];
    const n = String(i + 1).padStart(3, '0');
    const tag = `${n}_${safeName(r.contactName || r.company || 'lead')}.txt`;
    process.stdout.write(`  ${C.dim}[${n}/${totalToWrite}] ${(r.title || r.contactName || '').slice(0, 36).padEnd(38)}${C.reset} `);
    try {
      const ai = await draft(r, industry);
      const lines = [];
      lines.push(`件名: ${ai.subject || ''}`);
      lines.push('');
      lines.push(`宛先: ${r.contactName || ''}${r.company ? ` (${r.company})` : ''}`);
      lines.push(`業種: ${industry}`);
      lines.push('');
      lines.push((ai.body || '').replace(/\r/g, ''));
      lines.push(SIGNATURE);
      lines.push('');
      lines.push(`-- 内部メモ (送信時は削除) --`);
      lines.push(`案件: ${r.title || ''}`);
      lines.push(`接触経路: ${r.source || ''}`);
      lines.push(`既知メモ: ${r.notes || ''}`);
      writeFileSync(join(sub, tag), lines.join('\n'), 'utf-8');
      console.log(`${C.green}✓${C.reset}`);
      ok++;
    } catch (e) {
      console.log(`${C.red}✗ ${e.message?.slice(0, 30)}${C.reset}`);
      ng++;
      if (ng > 5 && ng > ok) {
        console.log(`  ${C.yellow}↻ 失敗が続くため 中断 (${ok} 件まで成功)${C.reset}`);
        break;
      }
    }
  }
  summary.push({ industry, ok, ng, total: totalToWrite });
  console.log(`  ${C.green}✓ ${ok}${C.reset} / ${C.red}${ng}${C.reset} → ${sub}\n`);
}

// README
const md = [];
md.push('# AI 営業 メール 下書き 集');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`入力: ${SRC}`);
md.push(`出力: ${OUT_DIR}`);
md.push('');
md.push('## 集計');
md.push('');
md.push('| 業界 | 成功 | 失敗 | 合計 |');
md.push('|---|---|---|---|');
for (const s of summary) {
  md.push(`| ${s.industry} | 🟢 ${s.ok} | 🔴 ${s.ng} | ${s.total} |`);
}
md.push('');
md.push('## 送信前 チェックリスト');
md.push('');
md.push('- [ ] 件名 に 数字 が入っているか');
md.push('- [ ] 本文 1 行目で 相手を 名指しできているか');
md.push('- [ ] 内部メモ 行を 削除したか');
md.push('- [ ] 署名のメール / URL が 正しいか');
md.push('- [ ] 送信前に AI 文章 を 自分の言葉に 微調整 (機械感 撲滅)');
md.push('');
md.push('## 再実行');
md.push('');
md.push('```bash');
md.push('node scripts/draftSalesEmail.mjs                  # 全業界');
md.push('LIMIT=5 ONLY=sme node scripts/draftSalesEmail.mjs # sme.csv の先頭 5 件');
md.push('```');

writeFileSync(join(OUT_DIR, 'README.md'), md.join('\n'), 'utf-8');
console.log(`${C.bold}保存先${C.reset}: ${OUT_DIR}`);
const totalOk = summary.reduce((a, s) => a + s.ok, 0);
const totalNg = summary.reduce((a, s) => a + s.ng, 0);
console.log(`${C.bold}サマリ${C.reset}: 🟢 ${totalOk} / 🔴 ${totalNg}`);
