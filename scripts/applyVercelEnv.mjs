#!/usr/bin/env node
// ============================================================
// applyVercelEnv.mjs — .env.stripe-v2 の env を Vercel に一括投入
//
// オーナー指示 (2026-06-03):
//   Live URL が出来たら 1 コマンドで本番反映できるようにしたい
//
// 使い方:
//   1) Vercel CLI に一度だけ login: npx vercel login
//   2) このリポジトリで一度だけ link: npx vercel link
//   3) このスクリプトを実行: node scripts/applyVercelEnv.mjs
//
//   既存の同名 env があれば自動で削除して上書きします (idempotent)
//
// オプション:
//   ENV_FILE=.env.stripe-v2          (デフォルト)
//   TARGET=production                (production / preview / development)
//   ENABLE_V2=true                   (true なら VITE_PLAN_V2_ENABLED も true で登録)
//   DRY_RUN=1                        (実際には投入せず計画のみ表示)
// ============================================================
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), process.env.ENV_FILE || '.env.stripe-v2');
const target = process.env.TARGET || 'production';
const enableV2 = process.env.ENABLE_V2 === 'true';
const dryRun = process.env.DRY_RUN === '1';

if (!existsSync(envFile)) {
  console.error(`❌ ${envFile} が見つかりません。先に setupStripeV2.mjs を実行してください。`);
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Vercel env 一括投入');
console.log(`  env file: ${envFile}`);
console.log(`  target  : ${target}`);
console.log(`  v2 ON   : ${enableV2 ? 'はい' : 'いいえ (フラグそのまま)'} ${dryRun ? '+ DRY RUN' : ''}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── parse .env file ─────────────────────────
const lines = readFileSync(envFile, 'utf8').split('\n');
const pairs = [];
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const m = t.match(/^([A-Z0-9_]+)=(.+)$/);
  if (!m) continue;
  pairs.push({ key: m[1], value: m[2].trim() });
}

// 上書きフラグ
if (enableV2) {
  const i = pairs.findIndex(p => p.key === 'VITE_PLAN_V2_ENABLED');
  if (i >= 0) pairs[i].value = 'true';
  else pairs.push({ key: 'VITE_PLAN_V2_ENABLED', value: 'true' });
}

console.log(`📦 ${pairs.length} 個の env を ${target} に投入します:\n`);

// ── Vercel CLI チェック ─────────────────────
function vercelCmd(...args) {
  try {
    return execFileSync('npx', ['vercel', ...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: '',  // stdin 空にしておく (vercel が対話モードに入るのを防ぐ)
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    return { error: e?.stderr?.toString() || e?.message || String(e) };
  }
}

const linkCheck = vercelCmd('whoami');
if (typeof linkCheck === 'object' && linkCheck.error) {
  console.error('❌ Vercel CLI にログインされていません。先に `npx vercel login` を実行してください。');
  console.error(`   詳細: ${linkCheck.error.slice(0, 200)}`);
  process.exit(1);
}

// ── 投入ループ ──────────────────────────────
let okCount = 0;
let skipCount = 0;
let errCount = 0;

for (const { key, value } of pairs) {
  process.stdout.write(`  ${key.padEnd(50)} `);
  if (dryRun) {
    console.log(`[DRY] = ${truncateValue(value)}`);
    continue;
  }
  // 1) 既存削除 (失敗しても無視)
  execFileSync('npx', ['vercel', 'env', 'rm', key, target, '--yes'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'ignore'],
  }).toString?.() ?? null;

  // 2) 新規追加 (echo で value を stdin に流す)
  try {
    execFileSync('npx', ['vercel', 'env', 'add', key, target], {
      cwd: process.cwd(),
      input: value + '\n',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 20_000,
    });
    okCount++;
    console.log(`✔ = ${truncateValue(value)}`);
  } catch (e) {
    errCount++;
    const errStr = (e?.stderr?.toString() || e?.message || '').slice(0, 200);
    console.log(`✗ エラー: ${errStr}`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ 投入: ${okCount} / スキップ: ${skipCount} / エラー: ${errCount}`);
if (errCount === 0 && !dryRun) {
  console.log('\n次のステップ:');
  console.log('  1) Vercel が自動で再デプロイを始めます (数分後に反映)');
  console.log('  2) https://core-prism-app.vercel.app/pricing で v2 価格表示を確認');
  if (!enableV2) {
    console.log('  3) v2 を全ユーザーに公開するなら ENABLE_V2=true で再実行');
  }
}

function truncateValue(v) {
  if (v.length <= 60) return v;
  return v.slice(0, 30) + '…' + v.slice(-15);
}
