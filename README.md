# CORE — Identity OS

すべての時代の、核となるものを。AI エージェント OS を提供する **株式会社コア (CORE Inc.)** のプロダクトモノレポ。

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
