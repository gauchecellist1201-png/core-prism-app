// 画面の「読めない・押しにくい」を目でなく数字で見つける機械監査。
//   文字コントラスト(WCAG AA) / タップ44px / 横はみ出し / console error
//
// 使い方:  node scripts/a11y-audit.mjs <URL> <画面幅>
//   例:    node scripts/a11y-audit.mjs https://core-prism-app.vercel.app/corp 375
//
// 【なぜ目視ではダメか】薄い文字は、作っている本人の画面（明るい部屋・新しいMac）では
// 読めてしまう。読めなくなるのは外・夜・省電力モード・目が疲れている時。
// 実際 /corp では目で見て気づけなかった落第が 6件 + 34px のタップ対象 8個 出た(2026-08-02)。
//
// 【この道具自体が踏んだ罠 — 消さないこと】
//  1) 背景をたどる時、ページ全体にかかっている「飾りのグラデ膜」まで数えると、
//     画面中の文字が全部「判定不能」になって本物の読みにくさが隠れる。
//     → グラデ扱いは自分〜2つ上まで(depth<=2)。
//  2) 逆にグラデを一切見ないと、金のグラデ帯に濃い文字を乗せている正しいボタンが
//     「1.1:1」と誤検出される。→ gradSkip に分けて目視に回す。
//  3) 文章の中に埋まっている語リンク(例「よくある質問」)は行の高さ＝文字の高さなので
//     44px にはできない。WCAG 2.5.8 でも対象外。→ inlineLinks に分けて数えない。
//  4) Playwright のブラウザが未インストールでも channel:'chrome' で動く。
import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://core-prism-app.vercel.app/corp';
const W = Number(process.argv[3] || 375);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: 812 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3500);
await page.evaluate(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1200);

const report = await page.evaluate(() => {
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const parse = (s) => { const m = String(s).match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const over = (fg, bg) => { const a = fg[3] ?? 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); };

  // グラデ扱いは「自分〜2つ上」まで。ページ全体の飾りグラデ膜まで数えると
  // 画面中の文字が全部「判定不能」になり、本物の読みにくさが隠れる。
  const bgOf = (el) => {
    let n = el, acc = null, grad = false, depth = 0;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (depth++ <= 2 && cs.backgroundImage && cs.backgroundImage !== 'none') grad = true;
      const c = parse(cs.backgroundColor);
      if (c && (c[3] ?? 1) > 0.999) return { rgb: c.slice(0, 3), grad };
      if (c && (c[3] ?? 1) > 0) acc = acc ? over(c, acc) : c.slice(0, 3);
      n = n.parentElement;
    }
    return { rgb: acc || [0, 0, 0], grad };
  };

  const lowContrast = [], smallTap = [], gradSkip = [], inlineLinks = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent || '').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
    const fg = parse(cs.color); if (!fg) continue;
    const { rgb: bg, grad } = bgOf(el);
    const eff = over([fg[0], fg[1], fg[2], fg[3] ?? 1], bg);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    const cr = ratio(eff, bg);
    if (cr < need) (grad ? gradSkip : lowContrast).push({ text: t.slice(0, 34), px: +px.toFixed(1), bold, ratio: +cr.toFixed(2), need, color: cs.color, bg: `rgb(${bg.map(Math.round)})`, tag: el.tagName, cls: (el.className || '').toString().slice(0, 40) });
  }

  for (const el of document.querySelectorAll('a,button,input,select,textarea,[role="button"],[onclick]')) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.querySelector('a,button')) continue;
    if (r.height >= 44 && r.width >= 44) continue;
    // 文章の中に埋まっている語リンクは WCAG 2.5.8 の対象外（行の高さ＝文字の高さのため）
    const inline = cs.display === 'inline' && !!el.closest('p,li');
    const row = { text: (el.textContent || '').trim().slice(0, 28), w: +r.width.toFixed(1), h: +r.height.toFixed(1), tag: el.tagName, cls: (el.className || '').toString().slice(0, 40) };
    (inline ? inlineLinks : smallTap).push(row);
  }

  const de = document.documentElement;
  return { lowContrast, gradSkip, smallTap, inlineLinks, overflow: de.scrollWidth - de.clientWidth, height: de.scrollHeight };
});

console.log(JSON.stringify({ url: URL, w: W, ...report, consoleErrors: errs }, null, 1));
await browser.close();
