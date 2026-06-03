#!/usr/bin/env node
// ============================================================
// migrateV1ToV2.mjs — 既存 v1 Subscription を v2 Price に切替
//
// オーナー指示 (2026-06-03):
//   既存 v1 ユーザーも値上げ確定。30 日猶予後に Stripe API で一括移行。
//
// マッピング:
//   v1 starter   (¥4,980)  → v2 btoC-standard (¥5,000)   ほぼ据え置き
//   v1 standard  (¥9,800)  → v2 btoC-pro      (¥15,000)  53% 値上げ
//   v1 exclusive (¥29,800) → v2 btoB-standard (¥30,000)  わずか値上げ + 法人化
//
// 使い方:
//   1) Stripe Dashboard で v2 Price ID を確認 (= setupStripeV2.mjs が作った)
//   2) DRY_RUN=1 STRIPE_SECRET_KEY=sk_live_xxx node scripts/migrateV1ToV2.mjs
//      → 移行対象 Subscription 一覧を表示 (実際の変更なし)
//   3) 問題なければ DRY_RUN を外して実行
//   4) 各 Subscription は次の請求サイクルから新価格に
// ============================================================
import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error('❌ STRIPE_SECRET_KEY が必要です');
  console.error('   使い方: STRIPE_SECRET_KEY=sk_live_xxx node scripts/migrateV1ToV2.mjs');
  process.exit(1);
}
const dryRun = process.env.DRY_RUN === '1';
const stripe = new Stripe(apiKey, { apiVersion: '2024-12-18.acacia' });

// ── v1 → v2 マッピング (lookup_key で Price を解決) ──
const MAPPING = {
  // v1 lookup_key prefix → v2 lookup_key
  'prism-starter':   'core-prism-v2-btoC-standard-monthly',
  'prism-standard':  'core-prism-v2-btoC-pro-monthly',
  'prism-exclusive': 'core-prism-v2-btoB-standard-monthly',
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('v1 → v2 一括移行');
console.log(`  モード: ${apiKey.includes('test') ? 'TEST' : 'LIVE'} ${dryRun ? '+ DRY RUN' : ''}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// v2 Price ID を lookup_key で取得
async function getV2PriceId(lookupKey) {
  const search = await stripe.prices.search({
    query: `lookup_key:"${lookupKey}" AND active:"true"`,
    limit: 1,
  });
  return search.data?.[0]?.id || null;
}

// アクティブな Subscription を全部取得
async function listActiveSubs() {
  const subs = [];
  let starting_after = undefined;
  while (true) {
    const page = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      starting_after,
    });
    subs.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return subs;
}

async function main() {
  // v2 Price ID を先に解決
  const v2PriceIds = {};
  for (const [v1, v2lookup] of Object.entries(MAPPING)) {
    v2PriceIds[v1] = await getV2PriceId(v2lookup);
    if (!v2PriceIds[v1]) {
      console.error(`❌ v2 Price 未作成: lookup_key="${v2lookup}". 先に setupStripeV2.mjs を実行してください`);
      process.exit(1);
    }
  }
  console.log('v2 Price ID 解決:');
  Object.entries(v2PriceIds).forEach(([k, id]) => console.log(`  ${k} → ${id}`));
  console.log('');

  const subs = await listActiveSubs();
  console.log(`📦 Active Subscription: ${subs.length} 件\n`);

  let migrated = 0, skipped = 0, errored = 0;
  for (const sub of subs) {
    const currentPrice = sub.items.data[0]?.price;
    if (!currentPrice) { skipped++; continue; }
    const currentLookup = currentPrice.lookup_key || currentPrice.nickname || '';
    // v1 plan を判定 (lookup_key / nickname / metadata から)
    const v1Match = Object.keys(MAPPING).find(k => currentLookup.toLowerCase().includes(k.replace('prism-', '')));
    if (!v1Match) {
      // 既に v2 か、対象外
      skipped++;
      continue;
    }
    const newPriceId = v2PriceIds[v1Match];
    const customer = sub.customer;

    console.log(`▶ Subscription ${sub.id}`);
    console.log(`  顧客: ${typeof customer === 'string' ? customer : customer.id}`);
    console.log(`  現プラン: ${v1Match} (${currentPrice.id})`);
    console.log(`  新プラン: ${newPriceId}`);

    if (dryRun) {
      console.log(`  [DRY] 移行予定\n`);
      continue;
    }

    try {
      // 次の請求サイクルから新 Price に (現サイクル中は据え置き)
      await stripe.subscriptions.update(sub.id, {
        items: [{
          id: sub.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'none',         // 月の途中で日割りしない
        billing_cycle_anchor: 'unchanged',   // 請求日は変えない
        metadata: { ...sub.metadata, migrated_from: v1Match, migrated_at: new Date().toISOString() },
      });
      migrated++;
      console.log(`  ✔ 移行完了\n`);
    } catch (e) {
      errored++;
      console.log(`  ✗ エラー: ${e?.message || e}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 移行: ${migrated} / スキップ: ${skipped} / エラー: ${errored}`);
  if (dryRun) {
    console.log('\n⚠ DRY RUN モードです。実際の変更は行われていません。');
    console.log('   問題なければ DRY_RUN= を外して再実行してください。');
  }
}

main().catch(e => {
  console.error('\n❌ エラー:', e?.message || e);
  process.exit(1);
});
