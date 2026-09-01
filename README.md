# CORE — Identity OS

いつの時代も、変わらない核を。AI エージェント OS を提供する **株式会社コア (CORE Inc.)** のプロダクトモノレポ。

## 🌅 ベータ公開 — 2026/05/12

CORE Prism / CORE Iris のベータ版を **2026 年 5 月 12 日** に同時公開します。

| プロダクト | 対象 | 月額 | ベータ特典 |
| --- | --- | --- | --- |
| **CORE Prism** | 事業家 / 経営者 / 営業 | ¥4,980〜 | 14 日間無料 · クレカ不要 · 先着 30 日延長 |
| **CORE Iris** | インフルエンサー / クリエイター | ¥1,980〜 | 14 日間無料 · クレカ不要 · 先着 30 日延長 |

- Prism LP: https://core-prism-app.vercel.app/
- Iris LP: https://core-prism-app.vercel.app/iris
- Corp サイト: https://core-prism-app.vercel.app/corp

## スタック

React 18 + TypeScript + Vite。本番は Vercel にデプロイ。

```bash
npm install
npm run dev      # ローカル開発 (http://localhost:5173)
npm run build    # 本番ビルド
npx vercel --prod --yes   # 本番デプロイ
```

## エントリ

- `index.html` → CORE Prism LP / アプリ (`/`)
- `iris.html`  → CORE Iris LP / アプリ (`/iris`)
- `corp.html`  → 株式会社コア コーポレートサイト (`/corp`)

## OG / SNS シェア

各ページで OG 画像は v2 シリーズを配信:

- `/og-prism-v2.png`
- `/og-iris-v2.png`
- `/og-core-v2.png`

## Stripe 決済セットアップ (15 分)

決済を有効化するには Stripe の設定 → Vercel env vars 投入の 2 ステップが必要です。

### 1. Stripe Dashboard で 7 商品 + 14 Price を作成

[Stripe Dashboard → 商品](https://dashboard.stripe.com/products) から:

| 商品名 | プラン | 月額 | 年額 |
| --- | --- | --- | --- |
| CORE Iris Lite | iris_lite | ¥1,980 | ¥19,800 |
| CORE Iris Standard | iris_standard | ¥4,980 | ¥49,800 |
| CORE Iris Pro | iris_pro | ¥9,800 | ¥98,000 |
| CORE Iris Studio | iris_studio | ¥29,800 | ¥298,000 |
| CORE Prism Starter | prism_starter | ¥4,980 | ¥49,800 |
| CORE Prism Standard | prism_standard | ¥9,800 | ¥98,000 |
| CORE Prism Exclusive | prism_exclusive | ¥29,800 | ¥298,000 |

各 Price 作成時:
- 「定期」を選択 · 「月次」または「年次」
- 通貨: JPY
- 14 個の Price ID (`price_xxx`) をコピー

#### CORE Studio 映像制作 (/studio/film) — 任意・上記とは別枠

| 商品名 | plan | 種別 | 金額 |
| --- | --- | --- | --- |
| Film TRIAL | film_trial | 単発 (one-time) | ¥49,800 |
| Film STANDARD | film_standard | 単発 (one-time) | ¥128,000 |
| Film 月4本 | film_m4 | 定期・月次 | ¥228,000 |
| Film 月8本 | film_m8 | 定期・月次 | ¥398,000 |
| Film 月12本 | film_m12 | 定期・月次 | ¥548,000 |

TRIAL/STANDARDは「継続利用なし」、月額3種は「継続利用あり・月次」で作成し、`STRIPE_PRICE_FILM_*`（`.env.example`参照）に投入する。PREMIUM(¥298,000〜)は金額が案件ごとに変わるためPriceを作らずLINE相談のみ。

### 2. Webhook 登録

[Stripe Dashboard → 開発者 → Webhook](https://dashboard.stripe.com/webhooks) で:
- エンドポイント: `https://core-prism-app.vercel.app/api/stripe/webhook`
- 送信イベント: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- 署名 secret (`whsec_xxx`) をコピー

### 3. Vercel env vars に投入

`.env.example` の `STRIPE_*` を Vercel Dashboard → Settings → Environment Variables に貼り付け:

- `STRIPE_SECRET_KEY` (sk_live_xxx)
- `STRIPE_WEBHOOK_SECRET` (whsec_xxx)
- 14 個の `STRIPE_PRICE_*` 環境変数

### 4. 診断ページで確認

オーナー認証後 [`/master/stripe-status`](https://core-prism-app.vercel.app/master/stripe-status) を開き、全てのチェックが緑になれば完了です。
