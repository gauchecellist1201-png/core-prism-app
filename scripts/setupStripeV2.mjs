#!/usr/bin/env node
// ============================================================
// setupStripeV2.mjs — Stripe v2 Product/Price/PaymentLink を 1 コマンドで作成
//
// オーナー指示 (2026-06-03):
//   「Stripe ダッシュボードで自分で作らなきゃいけないですか? あなたが作れますか?」
//   → このスクリプトで作れます。
//
// 使い方:
//   1) Stripe Dashboard → Developers → API keys から Secret key (sk_live_...) を取得
//   2) ターミナルで以下を実行:
//        STRIPE_SECRET_KEY=sk_live_xxxx node scripts/setupStripeV2.mjs
//   3) 出力された 12 行の env を Vercel に貼る
//
// やっていること:
//   - "CORE Prism (v2)" Product を 1 つ作成 (既存があれば再利用)
//   - BtoC ライト/標準/プロ + BtoB エントリ/標準/プロ の 6 プラン × 月額/年額 = 12 Price
//   - 各 Price から Payment Link を発行 (7 日トライアル, カード登録なし)
//   - 結果を .env.stripe-v2 に出力 + コンソールに表示
//
// 副作用:
//   - Stripe Dashboard に Product / Price / Payment Link が作成される
//   - 既存の v1 Product/Price は触りません
//   - DRY_RUN=1 を付けると作成せず計画のみ表示
// ============================================================
import Stripe from 'stripe';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error('❌ STRIPE_SECRET_KEY が設定されていません');
  console.error('   使い方: STRIPE_SECRET_KEY=sk_live_xxxx node scripts/setupStripeV2.mjs');
  console.error('   テスト用: STRIPE_SECRET_KEY=sk_test_xxxx node scripts/setupStripeV2.mjs');
  process.exit(1);
}
const dryRun = process.env.DRY_RUN === '1';
const successUrl = process.env.STRIPE_SUCCESS_URL || 'https://core-prism-app.vercel.app/billing/success';
const cancelUrl  = process.env.STRIPE_CANCEL_URL  || 'https://core-prism-app.vercel.app/pricing';

const stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' });

// ── v2 プラン定義 (src/lib/billing.ts と完全に合わせる) ──
const PLANS = [
  // BtoC
  { id: 'btoC-light',    name: 'PRISM v2 ライト',     monthly: 3000,  yearly: 30000,  envKey: 'BTOC_LIGHT',    family: 'BtoC' },
  { id: 'btoC-standard', name: 'PRISM v2 スタンダード', monthly: 5000,  yearly: 50000,  envKey: 'BTOC_STANDARD', family: 'BtoC' },
  { id: 'btoC-pro',      name: 'PRISM v2 プロ',        monthly: 15000, yearly: 150000, envKey: 'BTOC_PRO',      family: 'BtoC' },
  // BtoB
  { id: 'btoB-entry',    name: 'PRISM v2 エントリー (法人)', monthly: 20000, yearly: 200000, envKey: 'BTOB_ENTRY',    family: 'BtoB' },
  { id: 'btoB-standard', name: 'PRISM v2 スタンダード (法人)', monthly: 30000, yearly: 300000, envKey: 'BTOB_STANDARD', family: 'BtoB' },
  { id: 'btoB-pro',      name: 'PRISM v2 プロ (法人)',     monthly: 50000, yearly: 500000, envKey: 'BTOB_PRO',      family: 'BtoB' },
];

const PRODUCT_NAME = 'CORE Prism (v2)';
const PRODUCT_DESCRIPTION = 'AI 役員 13 名であなたの会社の意思決定を支える経営パートナー (BtoC/BtoB 6 階層)';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('CORE Prism v2 Stripe セットアップ');
console.log(`  API キー: ${apiKey.slice(0, 12)}...${apiKey.slice(-4)}`);
console.log(`  モード: ${apiKey.includes('test') ? 'TEST' : 'LIVE'} ${dryRun ? '+ DRY RUN' : ''}`);
console.log(`  プラン数: ${PLANS.length} × 2 (月/年) = ${PLANS.length * 2} Price`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── ① Product の作成 or 取得 ──────────────────
async function ensureProduct() {
  const search = await stripe.products.search({
    query: `name:"${PRODUCT_NAME}" AND active:"true"`,
    limit: 1,
  }).catch(() => ({ data: [] }));
  if (search.data?.[0]) {
    console.log(`✔ Product 既存: ${search.data[0].id} (${PRODUCT_NAME})`);
    return search.data[0];
  }
  if (dryRun) {
    console.log(`[DRY] Product 作成予定: ${PRODUCT_NAME}`);
    return { id: 'prod_dryrun', name: PRODUCT_NAME };
  }
  const p = await stripe.products.create({
    name: PRODUCT_NAME,
    description: PRODUCT_DESCRIPTION,
    metadata: { version: 'v2', createdBy: 'setupStripeV2.mjs' },
  });
  console.log(`✔ Product 作成: ${p.id}`);
  return p;
}

// ── ② Price の作成 (idempotent: metadata.planSlug で照合) ─
async function ensurePrice(product, plan, cycle) {
  const amount = cycle === 'monthly' ? plan.monthly : plan.yearly;
  const interval = cycle === 'monthly' ? 'month' : 'year';
  const planSlug = `${plan.id}-${cycle}`;
  const lookupKey = `core-prism-v2-${planSlug}`;

  // 既存 Price を lookup_key で検索
  const search = await stripe.prices.search({
    query: `lookup_key:"${lookupKey}" AND active:"true"`,
    limit: 1,
  }).catch(() => ({ data: [] }));
  if (search.data?.[0]) {
    console.log(`  ✔ Price 既存: ${search.data[0].id} (${planSlug} ¥${amount})`);
    return search.data[0];
  }
  if (dryRun) {
    console.log(`  [DRY] Price 作成予定: ${planSlug} ¥${amount}/${interval}`);
    return { id: `price_dryrun_${planSlug}`, lookup_key: lookupKey };
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'jpy',
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    nickname: `${plan.name} (${cycle === 'monthly' ? '月額' : '年額'})`,
    tax_behavior: 'exclusive',
    metadata: { planSlug, family: plan.family, cycle, version: 'v2' },
  });
  console.log(`  ✔ Price 作成: ${price.id} (${planSlug} ¥${amount}/${interval})`);
  return price;
}

// ── ③ Payment Link の作成 (7 日トライアル, カード登録なし) ──
async function ensurePaymentLink(plan, cycle, price) {
  if (dryRun) {
    console.log(`  [DRY] PaymentLink 作成予定: ${plan.id}-${cycle}`);
    return `https://buy.stripe.com/DRYRUN_${plan.id}_${cycle}`;
  }
  const planSlug = `${plan.id}-${cycle}`;
  // 既存 Payment Link を検索 (metadata.planSlug で)
  const existing = await stripe.paymentLinks.list({ limit: 100 }).catch(() => ({ data: [] }));
  const hit = existing.data?.find(pl =>
    pl.active &&
    pl.metadata?.planSlug === planSlug &&
    pl.metadata?.version === 'v2'
  );
  if (hit) {
    console.log(`  ✔ PaymentLink 既存: ${hit.url}`);
    return hit.url;
  }
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      // カード登録なしトライアル (Stripe の Trial requires payment method を OFF)
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      description: `${plan.name} 7 日間 無料トライアル付き`,
    },
    // 7 日無料トライアル中は支払い方法収集をスキップ
    payment_method_collection: 'if_required',
    after_completion: {
      type: 'redirect',
      redirect: { url: `${successUrl}?plan=v2-${plan.id}` },
    },
    allow_promotion_codes: true,
    automatic_tax: { enabled: false }, // インボイス制度対応は別途
    metadata: {
      planSlug,
      family: plan.family,
      cycle,
      version: 'v2',
      envKey: `VITE_STRIPE_PRISM_V2_${plan.envKey}_${cycle === 'monthly' ? 'URL' : 'YEARLY_URL'}`,
    },
  });
  console.log(`  ✔ PaymentLink 作成: ${link.url}`);
  return link.url;
}

// ── メイン ───────────────────────────────────
async function main() {
  const product = await ensureProduct();
  console.log('');

  const envLines = [
    '# Vercel に貼り付けてください (Production + Preview)',
    `# 生成日時: ${new Date().toISOString()}`,
    `# Stripe ${apiKey.includes('test') ? 'TEST' : 'LIVE'} モード`,
    `# Product: ${product.id}`,
    '',
  ];

  for (const plan of PLANS) {
    console.log(`▶ ${plan.name}  (${plan.family})`);
    for (const cycle of ['monthly', 'yearly']) {
      const price = await ensurePrice(product, plan, cycle);
      const url = await ensurePaymentLink(plan, cycle, price);
      const envKey = `VITE_STRIPE_PRISM_V2_${plan.envKey}_${cycle === 'monthly' ? 'URL' : 'YEARLY_URL'}`;
      envLines.push(`${envKey}=${url}`);
    }
    console.log('');
  }

  envLines.push('');
  envLines.push('# v2 を有効化するフラグ (true に設定すると新規 sign up が v2 へ)');
  envLines.push('VITE_PLAN_V2_ENABLED=false');

  const envPath = resolve(process.cwd(), '.env.stripe-v2');
  writeFileSync(envPath, envLines.join('\n') + '\n', 'utf8');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 完了! 結果は ${envPath} に保存しました\n`);
  console.log('次のステップ:');
  console.log('  1) cat .env.stripe-v2 で結果を確認');
  console.log('  2) Vercel → Settings → Environment Variables に貼り付け');
  console.log('  3) Vercel が自動で再デプロイ');
  console.log('  4) 動作確認後、VITE_PLAN_V2_ENABLED=true に切替で v2 公開');
  if (apiKey.includes('test')) {
    console.log('\n⚠ TEST モードで実行しました。本番反映時は LIVE キーで再実行してください。');
  }
}

main().catch(e => {
  console.error('\n❌ エラー:', e?.message || e);
  if (e?.raw?.message) console.error('   Stripe:', e.raw.message);
  process.exit(1);
});
