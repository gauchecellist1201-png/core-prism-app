#!/usr/bin/env node
/**
 * enrichLeadList.mjs — 営業先 CSV を AI で 自動補強
 *
 * オーナー指示 (2026-06-04 第 32 波 FFFFF):
 *   既存の営業先 CSV (~/Desktop/sales_lists/*.csv) を読み、
 *   AI で 各社に「事業の特徴」「悩みの仮説」「アプローチ文 80 字」 を 追加。
 *   結果は ~/Desktop/sales_lists_enriched/<date>/<sheet>.csv に書き出し。
 *
 *   入力 CSV が無ければ src/lib/salesLeadSeed.ts から自動で CSV を生成 して
 *   ~/Desktop/sales_lists/<industry>.csv に保存 → 補強処理 へ。
 *
 * 使い方:
 *   node scripts/enrichLeadList.mjs
 *   LIMIT=10 node scripts/enrichLeadList.mjs        # 1 ファイルあたり 先頭 10 社のみ補強 (テスト用)
 *   ONLY=sme node scripts/enrichLeadList.mjs        # sme.csv のみ補強
 *   API_BASE=http://localhost:3000 node scripts/enrichLeadList.mjs
 *
 * 出力:
 *   ~/Desktop/sales_lists_enriched/<date>/<industry>.csv (UTF-8 BOM 付き)
 *   ~/Desktop/sales_lists_enriched/<date>/README.md
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const LIMIT = process.env.LIMIT ? Math.max(1, Number(process.env.LIMIT)) : Infinity;
const ONLY = process.env.ONLY ? String(process.env.ONLY) : '';
const today = new Date().toISOString().slice(0, 10);

const SRC_DIR = join(homedir(), 'Desktop', 'sales_lists');
const OUT_DIR = join(homedir(), 'Desktop', 'sales_lists_enriched', today);
mkdirSync(SRC_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// ─── 1) CSV が空なら salesLeadSeed.ts から書き出す ─────────────────────────
function bootstrapFromSeed() {
  const seedTs = join(process.cwd(), 'src', 'lib', 'salesLeadSeed.ts');
  if (!existsSync(seedTs)) return [];
  const src = readFileSync(seedTs, 'utf-8');

  // 業界別 配列 を「const <UP>_LEADS: LeadSeed[] = [ ... ];」のブロックで抜き出す
  const blocks = [];
  const re = /const\s+([A-Z_]+)_LEADS\s*:\s*LeadSeed\[\]\s*=\s*\[([\s\S]*?)\n\];/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const industry = m[1].toLowerCase().replace(/_/g, '-'); // SME → sme, REALESTATE_FINANCE → realestate-finance
    const body = m[2];
    const rows = [];
    // 1 行 = { title: '...', contactName: '...', company: '...', notes: '...', source: '...' },
    const rowRe = /\{\s*title:\s*'([^']*)',\s*contactName:\s*'([^']*)',(?:\s*company:\s*'([^']*)',)?\s*notes:\s*'([^']*)',\s*source:\s*'([^']*)'\s*\}/g;
    let r;
    while ((r = rowRe.exec(body)) !== null) {
      rows.push({
        title: r[1],
        contactName: r[2],
        company: r[3] || '',
        notes: r[4],
        source: r[5],
      });
    }
    if (rows.length) blocks.push({ industry, rows });
  }
  return blocks;
}

// ─── 2) CSV 読み書き ─────────────────────────
function escCsv(v) {
  const s = String(v ?? '');
  if (/["\n,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function rowToCsv(headers, row) {
  return headers.map(h => escCsv(row[h])).join(',');
}
function csvToRows(text) {
  // 簡易 CSV パーサ (改行 + ", " 含む値 を考慮)
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
  return lines.filter(l => l.trim());
}
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
function readCsv(path) {
  const text = readFileSync(path, 'utf-8').replace(/^﻿/, '');
  const lines = csvToRows(text);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(l => {
    const cells = parseCsvLine(l);
    const o = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ''; });
    return o;
  });
  return { headers, rows };
}
function writeCsv(path, headers, rows) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(rowToCsv(headers, r));
  writeFileSync(path, '﻿' + lines.join('\n') + '\n', 'utf-8');
}

// ─── 3) bootstrap if needed ─────────────────────────
let csvFiles = readdirSync(SRC_DIR).filter(f => f.endsWith('.csv'));
if (csvFiles.length === 0) {
  console.log(`${C.yellow}⚠ ${SRC_DIR} に CSV が見つかりません。salesLeadSeed.ts から CSV を 自動生成します。${C.reset}`);
  const blocks = bootstrapFromSeed();
  if (!blocks.length) {
    console.error(`${C.red}✗ salesLeadSeed.ts が読めません。中断します。${C.reset}`);
    process.exit(1);
  }
  for (const b of blocks) {
    const out = join(SRC_DIR, `${b.industry}.csv`);
    writeCsv(out, ['title', 'contactName', 'company', 'notes', 'source'], b.rows);
    console.log(`  ${C.dim}seed → ${out} (${b.rows.length} 社)${C.reset}`);
  }
  csvFiles = readdirSync(SRC_DIR).filter(f => f.endsWith('.csv'));
}

if (ONLY) {
  csvFiles = csvFiles.filter(f => f.includes(ONLY));
  if (!csvFiles.length) {
    console.error(`${C.red}✗ ONLY=${ONLY} に一致する CSV が見つかりません。${C.reset}`);
    process.exit(1);
  }
}

// ─── 4) AI 1 件補強 ─────────────────────────
const SYSTEM = `あなたは BtoB 営業 開拓 のプロフェッショナルです。
ユーザーが渡す 1 社の情報 (業種 / 担当者 / 会社名 / メモ / 接触経路) を見て、JSON で 3 つの 短文を返してください。

出力ルール:
1. 必ず 純 JSON のみ。\`\`\`json コードブロックや 説明文 は禁止。
2. 形式:
{
  "feature": "事業の特徴 (40 字以内)",
  "hypothesis": "悩みの仮説 (50 字以内)",
  "approach": "アプローチ文 (80 字以内、ですます調、押し売り禁止、初回 DM や メール の 1 文目に使える)"
}
3. 嘘の数字 / 誇張表現 (世界 No.1, 業界 1 位 等) は使わない。
4. 固有名詞 (会社名・人名) は そのまま、推測した情報は 一般的な 表現にとどめる。
5. アプローチ文 は 最初の 1 行 で「相手の状況 を 言い当てる」+「CORE Prism / Iris で 解決できる 一手」を 含める。`;

async function callOnce(row) {
  const userPrompt = [
    `業種タイトル: ${row.title}`,
    `担当者: ${row.contactName}`,
    `会社名: ${row.company || '(不明)'}`,
    `既知メモ: ${row.notes || '(なし)'}`,
    `接触経路: ${row.source || '(不明)'}`,
  ].join('\n');
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
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
  // JSON 抽出 (``` 付の対策)
  const cleaned = raw.replace(/```(?:json)?\s*\n?|```/g, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON 抽出失敗');
  return JSON.parse(m[0]);
}
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function enrich(row) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callOnce(row);
    } catch (e) {
      if (e.status === 429) {
        const wait = Math.max(6, e.retryAfterSec || 0) + attempt * 4;
        process.stdout.write(`${C.yellow}↻ ${wait}s ${C.reset}`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
  throw new Error('上限到達');
}

// ─── 5) 実行 ─────────────────────────
console.log(`${C.bold}営業先 CSV 自動補強${C.reset}`);
console.log(`入力: ${SRC_DIR} (${csvFiles.length} ファイル)`);
console.log(`出力: ${OUT_DIR}\n`);

const summary = [];
for (const file of csvFiles) {
  const input = join(SRC_DIR, file);
  const { headers, rows } = readCsv(input);
  if (!rows.length) {
    console.log(`${C.dim}→ ${file.padEnd(28)} ${C.yellow}空${C.reset}`);
    continue;
  }
  const totalToProcess = Math.min(rows.length, LIMIT);
  console.log(`${C.bold}→ ${file}${C.reset} (${totalToProcess}/${rows.length} 社 補強)`);

  const enrichedRows = [];
  const newHeaders = [...headers, 'ai_feature', 'ai_hypothesis', 'ai_approach', 'ai_error'];
  let ok = 0, ng = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i >= LIMIT) {
      enrichedRows.push({ ...r, ai_feature: '', ai_hypothesis: '', ai_approach: '', ai_error: 'skipped (LIMIT)' });
      continue;
    }
    process.stdout.write(`  ${C.dim}[${String(i + 1).padStart(3, ' ')}/${totalToProcess}] ${C.reset}${(r.title || r.contactName).slice(0, 40).padEnd(42)} `);
    try {
      const ai = await enrich(r);
      enrichedRows.push({
        ...r,
        ai_feature: ai.feature || '',
        ai_hypothesis: ai.hypothesis || '',
        ai_approach: ai.approach || '',
        ai_error: '',
      });
      console.log(`${C.green}✓${C.reset}`);
      ok++;
    } catch (e) {
      enrichedRows.push({
        ...r,
        ai_feature: '',
        ai_hypothesis: '',
        ai_approach: '',
        ai_error: e.message?.slice(0, 80) || 'unknown',
      });
      console.log(`${C.red}✗ ${e.message?.slice(0, 30)}${C.reset}`);
      ng++;
      // 連続失敗が多い時は 早めに次のファイルへ
      if (ng > 5 && ng > ok) {
        console.log(`  ${C.yellow}↻ 失敗が続くため このファイルは中断 (${ok} 件まで成功)${C.reset}`);
        for (let j = i + 1; j < rows.length; j++) {
          enrichedRows.push({ ...rows[j], ai_feature: '', ai_hypothesis: '', ai_approach: '', ai_error: 'skipped (early-abort)' });
        }
        break;
      }
    }
  }

  const out = join(OUT_DIR, file);
  writeCsv(out, newHeaders, enrichedRows);
  summary.push({ file, ok, ng, total: rows.length, out });
  console.log(`  ${C.green}✓ ${ok} 件 補強 / ${C.red}${ng} 件 失敗${C.reset} → ${out}\n`);
}

// ─── 6) README ─────────────────────────
const md = [];
md.push('# 営業先 CSV 自動補強 結果');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`入力: ${SRC_DIR}`);
md.push(`出力: ${OUT_DIR}`);
md.push('');
md.push('## ファイル別 集計');
md.push('');
md.push('| ファイル | 補強済 | 失敗 | 合計 | 出力 |');
md.push('|---|---|---|---|---|');
for (const s of summary) {
  md.push(`| ${s.file} | 🟢 ${s.ok} | 🔴 ${s.ng} | ${s.total} | \`${s.out}\` |`);
}
md.push('');
md.push('## 追加カラム');
md.push('');
md.push('- `ai_feature` — 事業の特徴 (40 字以内)');
md.push('- `ai_hypothesis` — 悩みの仮説 (50 字以内)');
md.push('- `ai_approach` — アプローチ文 (80 字、初回 DM/メール の 1 文目に使える)');
md.push('- `ai_error` — AI 呼び出し失敗時の理由 (再実行で埋め直しを推奨)');
md.push('');
md.push('## 使い方');
md.push('');
md.push('1. UTF-8 BOM 付き CSV なので Excel / Numbers で日本語 OK');
md.push('2. ai_approach を 確認 → そのまま LinkedIn / メール / DM に貼り付け');
md.push('3. ai_error が入っている行 は 失敗 — `LIMIT=10` 等で再実行 すると埋まる');
md.push('');
md.push('## 再実行');
md.push('');
md.push('```');
md.push('node scripts/enrichLeadList.mjs                     # すべての CSV を補強');
md.push('LIMIT=10 node scripts/enrichLeadList.mjs            # 先頭 10 社のみ (テスト)');
md.push('ONLY=sme node scripts/enrichLeadList.mjs            # sme.csv のみ');
md.push('```');

writeFileSync(join(OUT_DIR, 'README.md'), md.join('\n'), 'utf-8');
console.log(`${C.bold}保存先${C.reset}: ${OUT_DIR}`);
console.log(`${C.bold}サマリ${C.reset}: ${summary.reduce((a, s) => a + s.ok, 0)} 件 補強 / ${summary.reduce((a, s) => a + s.ng, 0)} 件 失敗`);
