// Iris 解約フローを 375px で機械計測する。
//
// 無人セッションでは dev サーバーを起動できないので、ビルド済み dist/ を
// page.route でそのまま配る（2026-08-12 に確立した方式）。
// /api/* は好きな応答を返せるので、有料会員の状態を作って解約ダイアログまで到達できる。
//
// 測るもの:
//   1. 44px 未満のタップ対象（ドクトリン: タップ対象は44px以上）
//   2. 「見えているのに押せない」ボタン（disabled な主導線）
//   3. 横スクロール / console エラー
//   4. 各ステップのスクリーンショット

import { chromium } from '/Users/naokiide/マイル/soma/node_modules/playwright/index.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve(process.argv[2] ?? './dist');
const OUT = process.argv[3] ?? '/tmp/iris-cancel';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

const PAID_USER = {
  email: 'test@example.com',
  passwordHash: 'x',
  brand: 'iris',
  plan: 'pro',
  startedAt: new Date(Date.now() - 40 * 864e5).toISOString(),
  stripeCustomerId: 'cus_TEST',
  subscriptionId: 'sub_TEST',
  currentPeriodEnd: Math.floor(Date.now() / 1000) + 12 * 86400,
};

const consoleErrors = [];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  // dist をそのまま配る
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'iris.local') return route.continue();

    if (url.pathname.startsWith('/api/')) {
      // 解約は「本当に止まった」を返す（嘘の成功を測るのが目的ではないため）
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, success: true, cancel_at_period_end: true, status: 'active' }),
      });
    }

    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    let body;
    try {
      body = await readFile(path.join(DIST, file));
    } catch {
      body = await readFile(path.join(DIST, 'index.html')); // SPA fallback
      file = '/index.html';
    }
    return route.fulfill({
      status: 200,
      contentType: MIME[path.extname(file)] ?? 'application/octet-stream',
      body,
    });
  });

  await page.addInitScript(user => {
    localStorage.setItem('core_billing_user_v1', JSON.stringify(user));
    localStorage.setItem('core_settings_brand', 'iris');
    localStorage.setItem('core_tour_done', '1');
  }, PAID_USER);

  await page.goto('https://iris.local/iris', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const report = { steps: [], consoleErrors: [] };

  async function measure(label) {
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const out = { small: [], dead: [], scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };
      const q = document.querySelectorAll('button, a, [role="button"], input, select, textarea');
      for (const el of q) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.bottom < 0 || b.top > window.innerHeight) continue;
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40);
        if (b.width < 44 || b.height < 44) {
          out.small.push({ label, w: Math.round(b.width), h: Math.round(b.height) });
        }
        if (el.disabled) {
          out.dead.push({ label, w: Math.round(b.width), h: Math.round(b.height) });
        }
        // 実際に指が届くか（覆われていないか）を elementFromPoint で判定
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) {
          out.covered = out.covered || [];
          out.covered.push({ label, w: Math.round(b.width), h: Math.round(b.height), by: hit ? (hit.tagName + '.' + String(hit.className).slice(0, 30)) : 'null' });
        }
      }
      return out;
    });
    report.steps.push({ label, ...r });
    await page.screenshot({ path: `${OUT}-${label}.png` });
    return r;
  }

  // 体験ツアーが出るので先に閉じる
  report.tourClosed = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /閉じる|スキップ|あとで自分のアカウントで試す/.test((x.getAttribute('aria-label') || '') + (x.textContent || '')));
    if (b) { b.click(); return (b.getAttribute('aria-label') || b.textContent || '').trim(); }
    return null;
  });
  await page.waitForTimeout(1200);

  // 連携ゲートが出るので「連携せずに」で中へ入る
  report.gateSkipped = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')]
      .find(x => /連携せずに/.test(x.textContent || ''));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1500);

  await measure('01-home');

  // 全機能シート → お支払い・解約
  const opened = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    // 下ナビの「その他」＝全機能シート
    const more = btns.filter(b => /^その他$/.test((b.textContent || '').trim())).pop()
      || btns.find(b => /全機能/.test(b.textContent || ''));
    if (more) { more.click(); return true; }
    return false;
  });
  report.moreOpened = opened;
  await page.waitForTimeout(800);
  await measure('02-more');

  const billing = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /お支払い・解約/.test(x.textContent || ''));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
    return false;
  });
  report.billingOpened = billing;
  await page.waitForTimeout(1200);
  await measure('03-billing');

  const cancelClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /解約する|解約手続き|プランを解約/.test(x.textContent || ''));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return b.textContent.trim(); }
    return null;
  });
  report.cancelClicked = cancelClicked;
  await page.waitForTimeout(900);
  await measure('04-inline-confirm');

  // インラインの「本当に解約しますか?」→「解約する」で CancelFlowDialog が開く
  report.confirmClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^解約する$/.test((x.textContent || '').trim()));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
    return false;
  });
  await page.waitForTimeout(1100);
  await measure('04b-cancel-value');

  const proceeded = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /それでも解約する/.test(x.textContent || ''));
    if (b) { b.click(); return true; }
    return false;
  });
  report.proceededToSurvey = proceeded;
  await page.waitForTimeout(900);
  await measure('05-cancel-survey');

  // 解約ダイアログの主ボタンを実際に押して、最後まで進むことを確かめる
  report.finalPress = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /^(解約する|理由を送って解約する)$/.test((x.textContent || '').trim()));
    if (!b) return 'ボタンが見つからない';
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const reachable = !!hit && (b === hit || b.contains(hit));
    b.click();
    return { label: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), reachable };
  });
  await page.waitForTimeout(2000);
  await measure('06-after-cancel');

  report.consoleErrors = consoleErrors;
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch(e => { console.error('FAILED', e); process.exit(1); });
