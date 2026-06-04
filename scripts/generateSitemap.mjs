#!/usr/bin/env node
/**
 * generateSitemap.mjs — SEO 用 sitemap.xml を public/ に書き出す
 *
 * オーナー指示 (2026-06-04 第 29 波 XXXX):
 *   / /pricing /contact /trust /privacy /terms /lp/<6種> /iris /faq /tokushoho を含む
 *   sitemap.xml を 自動生成。lastmod は git log -1 --format=%cI -- <path> 由来。
 *
 * 使い方:
 *   node scripts/generateSitemap.mjs
 *   SITE_BASE=https://core-prism-app.vercel.app node scripts/generateSitemap.mjs
 *
 * 出力:
 *   public/sitemap.xml
 *   public/robots.txt (sitemap 行追加 / 既存があれば 上書き)
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SITE_BASE = (process.env.SITE_BASE || 'https://core-prism-app.vercel.app').replace(/\/$/, '');
const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
mkdirSync(PUBLIC_DIR, { recursive: true });

// industries.ts から slug 群を抽出 (静的 import せず、シェル grep に頼る)
function extractIndustrySlugs() {
  try {
    const src = readFileSync(join(PROJECT_ROOT, 'src/lp/industries.ts'), 'utf-8');
    const slugs = [];
    const re = /slug:\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(src)) !== null) slugs.push(m[1]);
    return slugs;
  } catch {
    return ['sme', 'realestate-finance', 'consulting', 'solo', 'creator', 'freelance-pro'];
  }
}

// 静的 ファイル の最終コミット日時 (なければ now)
function lastmodOfFile(relPath) {
  try {
    const out = execSync(`git log -1 --format=%cI -- "${relPath}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: PROJECT_ROOT,
    }).toString().trim();
    return out || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const INDUSTRY_SLUGS = extractIndustrySlugs();

// ─── URL リスト 構築 ─────────────────────────
// path: ルート / relativeToProject: lastmod 取得用のファイル / priority / changefreq
const URLS = [
  // PRISM ブランド
  { path: '/',             file: 'src/App.tsx',                         priority: '1.0', changefreq: 'weekly' },
  { path: '/pricing',      file: 'src/corporate/PricingPage.tsx',       priority: '0.9', changefreq: 'monthly' },
  { path: '/contact',      file: 'src/components/ContactPage.tsx',      priority: '0.6', changefreq: 'yearly' },
  { path: '/trust',        file: 'src/components/TrustPage.tsx',        priority: '0.6', changefreq: 'monthly' },
  { path: '/status',       file: 'src/components/StatusPage.tsx',       priority: '0.4', changefreq: 'always' },
  { path: '/privacy',      file: 'src/legal/PrivacyPolicy.tsx',         priority: '0.4', changefreq: 'monthly' },
  { path: '/terms',        file: 'src/legal/TermsOfService.tsx',        priority: '0.4', changefreq: 'monthly' },
  { path: '/tokushoho',    file: 'src/pages/TokushohoPage.tsx',         priority: '0.4', changefreq: 'monthly' },
  { path: '/faq',          file: 'src/pages/FAQPage.tsx',               priority: '0.5', changefreq: 'monthly' },
  // 業界別 LP (industries.ts 由来)
  ...INDUSTRY_SLUGS.map((slug) => ({
    path: `/lp/${slug}`,
    file: 'src/components/IndustryLanding.tsx',
    priority: '0.8',
    changefreq: 'weekly',
  })),
  // Iris ブランド
  { path: '/iris',         file: 'iris.html',                            priority: '0.9', changefreq: 'weekly' },
  { path: '/iris/privacy', file: 'src/iris/IrisPrivacyPolicy.tsx',       priority: '0.4', changefreq: 'monthly' },
  { path: '/iris/terms',   file: 'src/iris/IrisTermsOfService.tsx',      priority: '0.4', changefreq: 'monthly' },
];

// 存在しないファイル は 'src/App.tsx' を フォールバック (lastmod は常に取れる)
function safeLastmod(file) {
  if (!existsSync(join(PROJECT_ROOT, file))) return lastmodOfFile('src/App.tsx');
  return lastmodOfFile(file);
}

// ─── XML 生成 ─────────────────────────
const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
for (const u of URLS) {
  const loc = `${SITE_BASE}${u.path}`;
  const lastmod = safeLastmod(u.file);
  lines.push('  <url>');
  lines.push(`    <loc>${loc}</loc>`);
  lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
  lines.push(`    <priority>${u.priority}</priority>`);
  lines.push('  </url>');
}
lines.push('</urlset>');

const outPath = join(PUBLIC_DIR, 'sitemap.xml');
writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');

// robots.txt — 既存があれば 「Sitemap: …」 行のみ 置換、なければ 新規
const robotsPath = join(PUBLIC_DIR, 'robots.txt');
let robotsBody = '';
if (existsSync(robotsPath)) {
  robotsBody = readFileSync(robotsPath, 'utf-8');
  // Sitemap: 行 を 削除 → 末尾に追加
  robotsBody = robotsBody.replace(/^Sitemap:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trim();
} else {
  robotsBody = 'User-agent: *\nAllow: /';
}
robotsBody += `\n\nSitemap: ${SITE_BASE}/sitemap.xml\n`;
writeFileSync(robotsPath, robotsBody, 'utf-8');

console.log(`✓ ${URLS.length} URLs → ${outPath}`);
console.log(`✓ robots.txt updated → ${robotsPath}`);
console.log('');
console.log(`サイトマップ プレビュー (${SITE_BASE}/sitemap.xml):`);
for (const u of URLS) {
  console.log(`  ${u.priority}  ${u.path}`);
}
