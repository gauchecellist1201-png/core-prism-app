#!/usr/bin/env node
// ============================================================
// setupStripeCrystal.mjs — Crystal の Product/Price/PaymentLink を1コマンドで作成
// 使い方: STRIPE_SECRET_KEY=sk_live_xxx node scripts/setupStripeCrystal.mjs
// 作るもの:
//   Product "Crystal — AI コンシェルジュ"
//   Standard: 月額 ¥29,800 (recurring) + 初期費用 ¥98,000 (one-time) → 1つの決済リンク
//   Luxury:   月額 ¥49,800 (recurring) + 初期費用 ¥298,000 (one-time) → 1つの決済リンク
// 冪等: 同名 Product / 同額 Price / 既存リンクがあれば再利用
// ============================================================
import Stripe from 'stripe';
import { writeFileSync } from 'node:fs';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) { console.error('STRIPE_SECRET_KEY が必要です'); process.exit(1); }
const stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' });

const PRODUCT_NAME = 'Crystal — AI コンシェルジュ';
const PLANS = [
  { key: 'STANDARD', label: 'Crystal Standard', monthly: 29800, setup: 98000 },
  { key: 'LUXURY', label: 'Crystal Luxury', monthly: 49800, setup: 298000 },
];

// Product (再利用)
let product = (await stripe.products.search({ query: `name:'${PRODUCT_NAME}' AND active:'true'` })).data[0];
if (!product) {
  product = await stripe.products.create({
    name: PRODUCT_NAME,
    description: '話しかけるだけの AI コンシェルジュ。24時間応対・見込み客の見極め・商談日程の獲得まで。',
  });
  console.log('Product 作成:', product.id);
} else console.log('Product 再利用:', product.id);

const existingPrices = (await stripe.prices.list({ product: product.id, limit: 100, active: true })).data;
const findPrice = (amount, recurring) => existingPrices.find(p =>
  p.unit_amount === amount && p.currency === 'jpy' && (recurring ? p.recurring?.interval === 'month' : !p.recurring));

const out = [];
for (const plan of PLANS) {
  let monthly = findPrice(plan.monthly, true);
  if (!monthly) monthly = await stripe.prices.create({
    product: product.id, currency: 'jpy', unit_amount: plan.monthly,
    recurring: { interval: 'month' }, nickname: `${plan.label} 月額`,
  });
  let setup = findPrice(plan.setup, false);
  if (!setup) setup = await stripe.prices.create({
    product: product.id, currency: 'jpy', unit_amount: plan.setup, nickname: `${plan.label} 初期費用`,
  });

  const link = await stripe.paymentLinks.create({
    line_items: [
      { price: monthly.id, quantity: 1 },
      { price: setup.id, quantity: 1 }, // 初回請求に初期費用を同梱
    ],
    allow_promotion_codes: true,
    after_completion: {
      type: 'redirect',
      redirect: { url: 'https://core-prism-app.vercel.app/crystal?welcome=1' },
    },
    metadata: { service: 'crystal', plan: plan.key.toLowerCase() },
  });
  console.log(`${plan.label}: ${link.url}`);
  out.push(`VITE_STRIPE_CRYSTAL_${plan.key}_URL=${link.url}`);
}

writeFileSync('.env.stripe-crystal', out.join('\n') + '\n');
console.log('\n.env.stripe-crystal に保存しました');
