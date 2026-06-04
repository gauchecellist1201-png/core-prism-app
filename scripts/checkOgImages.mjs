#!/usr/bin/env node
/**
 * checkOgImages.mjs — 公開 OG カード 自動チェック
 *
 * オーナー指示 (2026-06-04 第 31 波 EEEEE):
 *   本番 URL の og:image を curl で取得し、以下を検査:
 *     1. HTTP 200 で返るか
 *     2. サイズが 5KB 以上 (真っ白でない)
 *     3. PNG/JPG/WebP の dimensions が 1200x630 近い (許容 ±15%)
 *     4. Content-Type が image/*
 *   → ~/Desktop/og_audit/<date>/report.md  に レポート
 *
 * 使い方:
 *   node scripts/checkOgImages.mjs
 *   SITE_BASE=https://core-prism-app.vercel.app node scripts/checkOgImages.mjs
 *
 * 出力:
 *   ~/Desktop/og_audit/<date>/
 *     report.md
 *     fetched/<slug>.png (取得画像)
 */

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SITE_BASE = (process.env.SITE_BASE || 'https://core-prism-app.vercel.app').replace(/\/$/, '');
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'og_audit', today);
const fetchedDir = join(outDir, 'fetched');
mkdirSync(fetchedDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

const SIZE_MIN_BYTES = 5_000;
const TARGET_W = 1200;
const TARGET_H = 630;
const SIZE_TOL = 0.15;          // ±15%

// 検査対象 ページ
const PAGES = [
  { name: 'home',           path: '/' },
  { name: 'pricing',        path: '/pricing' },
  { name: 'iris',           path: '/iris' },
  { name: 'trust',          path: '/trust' },
  { name: 'status',         path: '/status' },
  { name: 'contact',        path: '/contact' },
  { name: 'lp-sme',         path: '/lp/sme' },
  { name: 'lp-realestate',  path: '/lp/realestate-finance' },
  { name: 'lp-consulting',  path: '/lp/consulting' },
  { name: 'lp-solo',        path: '/lp/solo' },
  { name: 'lp-creator',     path: '/lp/creator' },
  { name: 'lp-freelance',   path: '/lp/freelance-pro' },
  { name: 'lp-saas-startup', path: '/lp/saas-startup' },
];

function curlHtml(url) {
  return execSync(`curl -sL -A "Mozilla/5.0 (compatible; CORE-OG-Audit/1.0)" --max-time 15 "${url}"`, {
    encoding: 'utf-8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function extractOgImage(html) {
  // <meta property="og:image" content="...">  と name= も拾う
  const re = /<meta\s+(?:[^>]*\s)?(?:property|name)\s*=\s*["']og:image["']\s+[^>]*content\s*=\s*["']([^"']+)["']/i;
  const m = html.match(re);
  if (m) return m[1];
  // 順序逆も
  const re2 = /<meta\s+(?:[^>]*\s)?content\s*=\s*["']([^"']+)["']\s+[^>]*(?:property|name)\s*=\s*["']og:image["']/i;
  const m2 = html.match(re2);
  return m2 ? m2[1] : null;
}

function absolutize(href, base) {
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return base + href;
  return base + '/' + href;
}

/** PNG / JPEG / WebP の幅 高さ を バイナリヘッダから読む (ImageMagick 不要) */
function readImageDimensions(buf) {
  // PNG: signature 0x89 50 4E 47 0D 0A 1A 0A, IHDR at offset 16, width/height as 4byte BE
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return { type: 'png', w, h };
  }
  // JPEG: 0xFF 0xD8 ... SOF (C0/C1/C2) frame
  if (buf.length >= 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0/1/2 = 0xC0/0xC1/0xC2 (avoid 0xC4 DHT, 0xC8 JPG)
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return { type: 'jpeg', w, h };
      }
      i += 2 + len;
    }
  }
  // WebP: RIFF .... WEBP VP8X|VP8|VP8L
  if (buf.length >= 30 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const fourcc = buf.slice(12, 16).toString();
    if (fourcc === 'VP8X') {
      // canvas size at 24..29 little-endian 24-bit
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { type: 'webp', w, h };
    }
    if (fourcc === 'VP8 ') {
      // VP8 bitstream
      const w = buf.readUInt16LE(26) & 0x3FFF;
      const h = buf.readUInt16LE(28) & 0x3FFF;
      return { type: 'webp', w, h };
    }
    if (fourcc === 'VP8L') {
      const sig = buf[20];
      if (sig === 0x2F) {
        const b1 = buf[21], b2 = buf[22], b3 = buf[23], b4 = buf[24];
        const w = 1 + (((b2 & 0x3F) << 8) | b1);
        const h = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
        return { type: 'webp', w, h };
      }
    }
  }
  return { type: 'unknown', w: 0, h: 0 };
}

console.log(`${C.bold}OG カード 監査 — ${PAGES.length} ページ @ ${SITE_BASE}${C.reset}\n`);

const results = [];
for (const p of PAGES) {
  const pageUrl = `${SITE_BASE}${p.path}`;
  process.stdout.write(`${C.dim}→ ${p.name.padEnd(18)} ${pageUrl.padEnd(60)}${C.reset} `);
  let html = '';
  try {
    html = curlHtml(pageUrl);
  } catch (e) {
    console.log(`${C.red}✗ HTML 取得失敗${C.reset}`);
    results.push({ ...p, pageUrl, error: 'html_fetch_failed', ok: false });
    continue;
  }
  const ogPath = extractOgImage(html);
  if (!ogPath) {
    console.log(`${C.red}✗ og:image なし${C.reset}`);
    results.push({ ...p, pageUrl, error: 'no_og_image', ok: false });
    continue;
  }
  const ogUrl = absolutize(ogPath, SITE_BASE);
  // 画像取得
  const localFile = join(fetchedDir, `${p.name}.bin`);
  let httpStatus = 0;
  let contentType = '';
  try {
    // -o ファイル / -w '%{http_code} %{content_type}'
    const wOut = execSync(`curl -sL -A "Mozilla/5.0" --max-time 15 -o "${localFile}" -w "%{http_code}|%{content_type}" "${ogUrl}"`, {
      encoding: 'utf-8',
    });
    const [code, ct] = wOut.split('|');
    httpStatus = Number(code) || 0;
    contentType = (ct || '').trim();
  } catch (e) {
    console.log(`${C.red}✗ 画像取得失敗 (${e.message.slice(0, 30)})${C.reset}`);
    results.push({ ...p, pageUrl, ogUrl, error: 'image_fetch_failed', ok: false });
    continue;
  }
  const size = existsSync(localFile) ? statSync(localFile).size : 0;
  let dim = { type: 'unknown', w: 0, h: 0 };
  if (size > 0) {
    try {
      const buf = readFileSync(localFile);
      dim = readImageDimensions(buf);
    } catch { /* */ }
  }
  // 拡張子付の正式名でリネーム
  if (dim.type !== 'unknown') {
    const ext = dim.type === 'jpeg' ? 'jpg' : dim.type;
    const newFile = join(fetchedDir, `${p.name}.${ext}`);
    try { execSync(`mv "${localFile}" "${newFile}"`); } catch { /* */ }
  }
  // 評価
  const ok200 = httpStatus === 200;
  const okSize = size >= SIZE_MIN_BYTES;
  const okCT = /^image\//.test(contentType);
  const okW = Math.abs(dim.w - TARGET_W) <= TARGET_W * SIZE_TOL;
  const okH = Math.abs(dim.h - TARGET_H) <= TARGET_H * SIZE_TOL;
  const overall = ok200 && okSize && okCT && (dim.type !== 'unknown' ? (okW && okH) : true);
  const tag = overall ? `${C.green}✓${C.reset}` : `${C.yellow}△${C.reset}`;
  console.log(`${tag} ${httpStatus} ${(size / 1024).toFixed(1)} KB ${dim.w}×${dim.h}`);
  results.push({
    ...p, pageUrl, ogUrl,
    httpStatus, contentType, sizeBytes: size,
    width: dim.w, height: dim.h, mime: dim.type,
    ok200, okSize, okCT, okW, okH, ok: overall,
  });
}

// ─── レポート ─────────────────────────
const okCount = results.filter((r) => r.ok).length;
const warnCount = results.filter((r) => !r.ok && !r.error).length;
const errCount = results.filter((r) => r.error).length;

const md = [];
md.push('# OG カード 監査 レポート');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${SITE_BASE}`);
md.push(`合計 ${PAGES.length} ページ`);
md.push('');
md.push('## サマリー');
md.push('');
md.push(`- 🟢 OK: ${okCount}`);
md.push(`- 🟡 警告: ${warnCount}`);
md.push(`- 🔴 エラー: ${errCount}`);
md.push('');
md.push('## 一覧');
md.push('');
md.push('| ページ | 状態 | HTTP | サイズ | 寸法 | MIME | og:image |');
md.push('|---|---|---|---|---|---|---|');
for (const r of results) {
  const badge = r.error ? '🔴' : (r.ok ? '🟢' : '🟡');
  const sz = r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(1)} KB` : '—';
  const dim = r.width && r.height ? `${r.width}×${r.height}` : '—';
  const og = r.ogUrl ? `[\`${r.ogUrl.replace(SITE_BASE, '')}\`](${r.ogUrl})` : (r.error || '—');
  md.push(`| **${r.name}** | ${badge} | ${r.httpStatus || '—'} | ${sz} | ${dim} | ${r.mime || '—'} | ${og} |`);
}
md.push('');
md.push('## 警告 / エラー 詳細');
md.push('');
const ng = results.filter((r) => !r.ok);
if (ng.length === 0) {
  md.push('🎉 すべて 1200×630 ± 15% / 5 KB 以上 / HTTP 200 / image/* です。');
} else {
  for (const r of ng) {
    md.push(`### ${r.name} — ${r.pageUrl}`);
    md.push('');
    if (r.error) {
      md.push(`- 失敗理由: \`${r.error}\``);
    } else {
      const checks = [];
      if (!r.ok200) checks.push(`HTTP ${r.httpStatus} (200 期待)`);
      if (!r.okSize) checks.push(`サイズ ${(r.sizeBytes / 1024).toFixed(1)} KB < 5 KB`);
      if (!r.okCT) checks.push(`Content-Type "${r.contentType}" が image/* でない`);
      if (r.mime !== 'unknown' && !r.okW) checks.push(`横幅 ${r.width}px (期待 ${TARGET_W} ± ${TARGET_W * SIZE_TOL})`);
      if (r.mime !== 'unknown' && !r.okH) checks.push(`高さ ${r.height}px (期待 ${TARGET_H} ± ${TARGET_H * SIZE_TOL})`);
      if (r.mime === 'unknown') checks.push('画像形式 を判別できませんでした (PNG/JPEG/WebP のみ対応)');
      for (const c of checks) md.push(`- ${c}`);
    }
    md.push('');
  }
}
md.push('## 改善案');
md.push('');
md.push('- 画像 真っ白 / 5KB 未満 → `node scripts/generateIndustryOg.mjs` で 再生成');
md.push('- 寸法ズレ → CSS の `html, body { width: 1200px; height: 630px; }` を確認');
md.push('- og:image meta が見当たらない → IndustryLanding / KKKK の metaOgImage 反映を確認');
md.push('- HTTP 404 / 503 → Vercel デプロイ完了 を確認 (デプロイ中はキャッシュが古い可能性)');

writeFileSync(join(outDir, 'report.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}結果${C.reset}: 🟢 ${okCount} / 🟡 ${warnCount} / 🔴 ${errCount}`);
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`${C.dim}レポート: ${join(outDir, 'report.md')}${C.reset}`);
process.exit(warnCount + errCount > 0 ? 1 : 0);
