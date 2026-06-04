#!/usr/bin/env node
/**
 * installAutoReport.mjs — macOS LaunchAgent で dailyAiReport を 自動化
 *
 * オーナー指示 (2026-06-04 第 45 波 UUUUUU):
 *   毎朝 7:00 JST に scripts/dailyAiReport.mjs を 自動 起動。
 *   ~/Library/LaunchAgents/com.core.daily-ai-report.plist を 設置 + launchctl load。
 *
 * 使い方:
 *   node scripts/installAutoReport.mjs               # plist 設置 + load
 *   node scripts/installAutoReport.mjs --uninstall   # unload + 削除
 *   node scripts/installAutoReport.mjs --print       # plist 内容 のみ stdout
 *
 * 動作:
 *   - StartCalendarInterval: Hour=7, Minute=0 (local time = JST)
 *   - Working dir = この リポジトリ
 *   - Stdout/Stderr → ~/Library/Logs/core-daily-ai-report.{log,err}
 *   - 「お金が絡む」 操作なし — 純粋に AI 要約 / .md 出力 のみ
 */

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

const LABEL = 'com.core.daily-ai-report';
const REPO = process.cwd();
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, `${LABEL}.plist`);
const LOG_DIR = join(homedir(), 'Library', 'Logs');
mkdirSync(LOG_DIR, { recursive: true });
const STDOUT_LOG = join(LOG_DIR, 'core-daily-ai-report.log');
const STDERR_LOG = join(LOG_DIR, 'core-daily-ai-report.err');

// ─── node の フルパス を which で取得 ─────────────────────────
let NODE_BIN = '/usr/local/bin/node';
try {
  const out = execSync('which node', { encoding: 'utf-8' }).trim();
  if (out) NODE_BIN = out;
} catch { /* 既定 fallback */ }

const SCRIPT_PATH = join(REPO, 'scripts', 'dailyAiReport.mjs');

function plist(masterKey) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${SCRIPT_PATH}</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${REPO}</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>MASTER_KEY</key>
    <string>${masterKey}</string>
  </dict>

  <!-- 毎朝 7:00 (system 時刻 — macOS は デフォルトで JST) -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>StandardOutPath</key>
  <string>${STDOUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${STDERR_LOG}</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

// ─── 引数 ─────────────────────────
const args = process.argv.slice(2);
const isUninstall = args.includes('--uninstall');
const isPrint = args.includes('--print');
const MASTER_KEY = process.env.MASTER_KEY || 'GAUCHE2026';

// ─── print only ─────────────────────────
if (isPrint) {
  console.log(plist(MASTER_KEY));
  process.exit(0);
}

// ─── uninstall ─────────────────────────
if (isUninstall) {
  console.log(`${C.bold}LaunchAgent ${LABEL} を 削除${C.reset}`);
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`${C.green}✓ launchctl unload 成功${C.reset}`);
  } catch (e) {
    console.log(`${C.yellow}⚠ unload 失敗 (load されていないかも): ${e.message?.slice(0, 80)}${C.reset}`);
  }
  if (existsSync(PLIST_PATH)) {
    try {
      unlinkSync(PLIST_PATH);
      console.log(`${C.green}✓ plist 削除: ${PLIST_PATH}${C.reset}`);
    } catch (e) {
      console.error(`${C.red}✗ plist 削除失敗: ${e.message}${C.reset}`);
    }
  }
  process.exit(0);
}

// ─── install ─────────────────────────
console.log(`${C.bold}LaunchAgent 自動 dailyAiReport (毎朝 7:00) を セットアップ${C.reset}`);
console.log('');
console.log(`Repository: ${REPO}`);
console.log(`Node:       ${NODE_BIN}`);
console.log(`Script:     ${SCRIPT_PATH}`);
console.log(`Plist:      ${PLIST_PATH}`);
console.log(`Log:        ${STDOUT_LOG}`);
console.log(`Master key: ${'*'.repeat(Math.max(4, MASTER_KEY.length - 2)) + MASTER_KEY.slice(-2)}`);
console.log('');

if (!existsSync(SCRIPT_PATH)) {
  console.error(`${C.red}✗ scripts/dailyAiReport.mjs が見つかりません。${C.reset}`);
  console.error(`   先に第 38 波 ZZZZZ を 確認してください。`);
  process.exit(1);
}

mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });

// 既存 plist があれば unload (上書き 前提)
if (existsSync(PLIST_PATH)) {
  try {
    execSync(`launchctl unload "${PLIST_PATH}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(`${C.dim}既存 plist を unload${C.reset}`);
  } catch { /* */ }
}

writeFileSync(PLIST_PATH, plist(MASTER_KEY), 'utf-8');
console.log(`${C.green}✓ plist 書き出し${C.reset}: ${PLIST_PATH}`);

try {
  execSync(`launchctl load "${PLIST_PATH}"`, { stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`${C.green}✓ launchctl load 成功${C.reset}`);
} catch (e) {
  console.error(`${C.red}✗ launchctl load 失敗: ${e.message?.slice(0, 200)}${C.reset}`);
  console.error(`   手動: launchctl load "${PLIST_PATH}"`);
  process.exit(1);
}

console.log('');
console.log(`${C.bold}✅ セットアップ完了 — 翌朝 7:00 から 自動実行${C.reset}`);
console.log('');
console.log('動作確認:');
console.log(`  launchctl list | grep ${LABEL}`);
console.log(`  tail -f ${STDOUT_LOG}`);
console.log('');
console.log('手動 起動 (test):');
console.log(`  launchctl start ${LABEL}`);
console.log('');
console.log('停止 / 削除:');
console.log(`  node scripts/installAutoReport.mjs --uninstall`);
console.log('');
console.log(`${C.dim}※ macOS の システム環境設定 → セキュリティ → フルディスクアクセス で${C.reset}`);
console.log(`${C.dim}  /usr/local/bin/node (or 該当 node パス) を 許可 する 必要 がある場合があります${C.reset}`);
