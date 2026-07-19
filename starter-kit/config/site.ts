/* ================================================================
   config/site.ts — 案件ごとに「ここだけ」書き換えるコンテンツ定義
   ----------------------------------------------------------------
   サイトに表示される文言・価格・FAQ は全部このファイルに集約。
   コンポーネント側へのハードコードは禁止。
   ================================================================ */

export type NavItem = { label: string; href: string };
export type Feature = { title: string; body: string };
export type Plan = {
  name: string;
  price: string;        // 表示用の文字列 (例: "¥98,000")
  priceNote: string;    // 例: "税込・一式" / "月額"
  points: string[];
  highlighted?: boolean; // true のプランを強調表示
};
export type FaqItem = { q: string; a: string };

export const site = {
  /* ---- 基本情報 ---- */
  name: "SAMPLE COFFEE ROASTERY",
  tagline: "一杯の静けさを、焙煎から。",
  description:
    "小さな焙煎所から、季節の豆を最良の状態でお届けします。店頭・オンラインどちらでもご購入いただけます。",
  url: "https://example.com",
  ogLocale: "ja_JP",

  /* ---- ナビゲーション ---- */
  nav: [
    { label: "特長", href: "#features" },
    { label: "価格", href: "#pricing" },
    { label: "よくある質問", href: "#faq" },
    { label: "お問い合わせ", href: "#contact" },
  ] satisfies NavItem[],

  /* ---- ヒーロー ---- */
  hero: {
    kicker: "SINCE 2020 — TOKYO",
    title: "一杯の静けさを、\n焙煎から。",
    lead: "浅煎りから深煎りまで、季節ごとに最良の豆を少量ずつ。毎週金曜に焙煎し、48時間以内に発送します。",
    ctaLabel: "豆を選ぶ",
    ctaHref: "#pricing",
    subCtaLabel: "焙煎所について",
    subCtaHref: "#features",
  },

  /* ---- 特長 (3つ推奨) ---- */
  features: [
    {
      title: "焙煎から48時間で発送",
      body: "毎週金曜に焙煎し、鮮度が最も高い状態でお届け。焙煎日はすべてのパッケージに記載しています。",
    },
    {
      title: "季節の豆を少量仕入れ",
      body: "産地の収穫期に合わせて豆を入れ替えます。定番を持たないことで、常に旬の味に出会えます。",
    },
    {
      title: "抽出レシピ同梱",
      body: "豆ごとに最適な湯温・比率・時間を記したカードを同梱。初めての方でも安定した一杯を再現できます。",
    },
  ] satisfies Feature[],

  /* ---- 価格 ---- */
  pricing: {
    note: "表示価格はすべて税込です。送料は全国一律 ¥520(¥5,000 以上で無料)。",
    plans: [
      {
        name: "シングル",
        price: "¥1,480",
        priceNote: "200g・単品",
        points: ["季節の豆 1 種", "抽出レシピカード付き", "焙煎日記載"],
      },
      {
        name: "定期便",
        price: "¥2,680",
        priceNote: "月額・毎月2種",
        points: [
          "毎月あたらしい 2 種 (各200g)",
          "送料無料",
          "スキップ・解約いつでも可",
          "会員限定ロットの案内",
        ],
        highlighted: true,
      },
      {
        name: "ギフト",
        price: "¥3,980",
        priceNote: "化粧箱・のし対応",
        points: ["選りすぐり 2 種 (各200g)", "メッセージカード", "化粧箱入り"],
      },
    ] satisfies Plan[],
  },

  /* ---- FAQ ---- */
  faq: [
    {
      q: "注文からどのくらいで届きますか？",
      a: "毎週金曜の焙煎後、48時間以内に発送します。地域により発送から1〜3日でお届けです。",
    },
    {
      q: "豆のまま・粉どちらで届きますか？",
      a: "ご注文時にお選びいただけます。粉の場合は抽出器具に合わせた挽き目もご指定ください。",
    },
    {
      q: "定期便はいつでも解約できますか？",
      a: "はい。マイページからいつでもスキップ・解約が可能です。回数の縛りはありません。",
    },
    {
      q: "領収書は発行できますか？",
      a: "発送完了メールに記載のリンクから宛名を指定してダウンロードいただけます。",
    },
  ] satisfies FaqItem[],

  /* ---- お問い合わせ ---- */
  contact: {
    lead: "取扱いに関するご相談・卸のご希望など、お気軽にご連絡ください。2営業日以内に返信します。",
    email: "hello@example.com",
    tel: "",              // 空文字なら非表示
    address: "東京都渋谷区0-0-0",
  },

  /* ---- フッター ---- */
  footer: {
    copyright: "SAMPLE COFFEE ROASTERY",
    links: [
      { label: "特定商取引法に基づく表記", href: "/legal" },
      { label: "プライバシーポリシー", href: "/privacy" },
    ] satisfies NavItem[],
  },

  /* ---- 最終CTA ---- */
  cta: {
    title: "今週の豆から、始めませんか。",
    lead: "焙煎したての香りは、届いた瞬間にわかります。",
    label: "豆を選ぶ",
    href: "#pricing",
  },
};

export type Site = typeof site;
