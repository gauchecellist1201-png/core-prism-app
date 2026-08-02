// ログイン後の「毎日使う画面」を機械監査する。a11y-audit.mjs は公開ページ用で、
// 入室してタブを切り替えないと出てこない画面（Iris / Prism 本体）は測れなかった。
//
// 使い方:  node scripts/a11y-audit-app.mjs <URL> <画面幅>
//   例:    node scripts/a11y-audit-app.mjs https://core-prism-app.vercel.app/iris 375
//
// 判定ロジックは a11y-audit.mjs から実行時に取り出して共有する（コピーすると
// 片方だけ直して数字がずれるため）。罠の解説はそちらのコメントを読むこと。
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(HERE, 'a11y-audit.mjs'), 'utf8');
const start = src.indexOf('const report = await page.evaluate(');
if (start < 0) throw new Error('a11y-audit.mjs の判定関数が見つからない（改名された？）');
// IIFE にして渡す。`() => {...}` の文字列のままだと evaluate が呼んでくれず
// 結果が undefined になり「違反ゼロ」に見えてしまう（＝嘘の緑）。
const AUDIT_FN = '(() => ' + src.slice(src.indexOf('{', start), src.lastIndexOf('});')).trim() + '\n})()';

const BASE = process.argv[2] || 'https://core-prism-app.vercel.app/iris';
const W = Number(process.argv[3] || 375);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: 812 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));

// master キーで入室（LP ではなく本体を測るため）
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  localStorage.setItem('core_master_key_v1', 'GAUCHE2026');
  // 初回ツアーが開いたままだと、下の本体ではなくツアーを測ってしまう
  localStorage.setItem('core_iris_firstrun_tour_v1', 'done');
  localStorage.setItem('core_tutorial_seen_iris_v1', '1');
});
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);

// 初回ツアー等のオーバーレイを閉じる（開いたままだと下の画面が測れない）
for (const label of ['あとで', 'スキップ', '閉じる']) {
  const b = page.locator(`button:has-text("${label}")`).first();
  if (await b.count() && await b.isVisible().catch(() => false)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(700);
  }
}
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(900);

// 下部ドックのタブを集める（画面下 120px 以内のボタン＝タブ）
const tabs = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button,[role="tab"]')) {
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 130 && r.width > 30 && r.height > 20) {
      const t = (el.textContent || '').trim();
      if (t && t.length < 12 && !out.includes(t)) out.push(t);
    }
  }
  return out;
});

const results = [];
for (const tab of (tabs.length ? tabs : [null])) {
  if (tab) {
    await page.locator(`button:has-text("${tab}")`).last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2200);
  }
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
  results.push({ tab: tab || '(初期)', ...(await page.evaluate(AUDIT_FN)) });
}

console.log(JSON.stringify({ base: BASE, w: W, tabs, results, consoleErrors: errs }, null, 1));
await browser.close();
