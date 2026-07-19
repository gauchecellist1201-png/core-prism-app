# CORE Studio スターターキット

制作案件を **1時間で1サイト** 出すための Next.js 15 雛形。
色・フォントは `app/theme.css` の CSS 変数、文言・価格・FAQ は `config/site.ts` に全部集約してあるので、**この2ファイルだけ書き換えれば別ブランドのサイトになる**。

構成: Hero / Features / Pricing / FAQ / CTA / Contact / Footer (すべて `components/`、JS ゼロのサーバーコンポーネント)

---

## 新規案件の作り方 (1時間で1サイト)

### ① コピー (2分)

```bash
cp -R starter-kit ~/マイル/<案件名>
cd ~/マイル/<案件名>
```

### ② config/site.ts を書き換え (20分)

サイトに出る文言はここに全部ある。上から順に:

| キー | 書くこと |
|---|---|
| `name` / `tagline` / `description` | 店名・一言・紹介文 (OGP にもそのまま入る) |
| `hero` | キャッチコピー (`\n` で改行可)・CTA の文言とリンク先 |
| `features` | 特長3つ (タイトル + 2〜3行) |
| `pricing.plans` | プラン名・価格・箇条書き。推しプランに `highlighted: true` |
| `faq` | 4問前後。実際に聞かれそうな順 |
| `contact` | メール必須。`tel` / `address` は空文字 `""` で非表示 |
| `footer` / `cta` | コピーライト・法務リンク・最終CTA |

### ③ theme.css の変数差し替え (10分)

`app/theme.css` の `:root` だけ触る。コンポーネントは一切触らない。

| 変数 | 役割 | 初期値 (Studio 標準) |
|---|---|---|
| `--bg` | ページ背景 | `#f7f5f0` |
| `--ink` | 本文色 | `#23261f` |
| `--primary` | 主色 (ヒーロー/主ボタン) | `#1e3a2e` |
| `--accent` | 差し色 (価格/リンク) | `#a8823c` |
| `--sage` | 小見出し・タグ | `#6f8074` |
| `--font-serif` / `--font-sans` | 見出し/本文フォント | 明朝 / ゴシック |

守ること: **淡背景=濃文字** (コントラスト必須)、OS 標準カラー絵文字は UI に使わない。

### ④ 動作確認 (10分)

```bash
npm i && npm run dev
```

http://localhost:3000 を **375px 幅** (DevTools iPhone SE) で必ず確認:

- 横スクロールが出ない / 見切れゼロ
- ボタンが親指で押せる (44px 以上)
- 淡い背景に淡い文字が無い

### ⑤ デプロイ (10分)

```bash
npx vercel deploy --prod --yes
```

出た URL を実機 iPhone で開いて最終確認 → 納品。

---

## 納品前チェックリスト

### Spark プラン (LP 1枚)

- [ ] `site.ts` にサンプル文言 (コーヒー豆) が残っていない
- [ ] OGP タイトル・description が案件名になっている (`layout.tsx` は自動反映)
- [ ] 375px で横はみ出しゼロ
- [ ] 全リンク・mailto が実在の宛先
- [ ] 特商法/プライバシーのリンク先ページを用意 (不要なら `footer.links` を空配列に)
- [ ] Lighthouse (モバイル) Performance 90 以上

### Core プラン (複数ページ・フォーム等)

- Spark の全項目に加えて:
- [ ] 追加ページは `app/<slug>/page.tsx` を増やし、文言は `site.ts` に追記 (ハードコード禁止)
- [ ] フォーム送信が必要なら Route Handler (`app/api/`) + メール通知、送信中は必ずローディング + タイムアウト
- [ ] 独自ドメイン設定・SSL 確認
- [ ] 404 ページ (`app/not-found.tsx`) をブランドトーンで用意
- [ ] お客様に「site.ts の場所」を伝える引き継ぎメモ

---

## 設計ルール (このキットを育てるとき)

- 文言・価格のハードコード禁止 — 必ず `config/site.ts` 経由
- 色・フォントのハードコード禁止 — 必ず `theme.css` の変数経由
- 新コンポーネントも props ではなく `site.ts` の新キーを読む形に統一
- クライアント JS は本当に必要になるまで足さない (現状 0)
