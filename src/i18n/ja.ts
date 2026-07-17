// ============================================================
// CORE Prism — 日本語 (デフォルト)
// LP 全文 (Hero / 機能紹介 / 料金 / FAQ / Footer) を網羅
// ============================================================

type PlanT = {
  name: string;
  tag: string;
  price: string;
  features: string[];
};
type AgentItem = { name: string; role: string; desc: string };
type ExecItem = { label: string; desc: string };
type FaqItem = { q: string; a: string };

export type Dictionary = {
  banner: string;
  nav: { agents: string; exec: string; pricing: string; faq: string; cta: string };
  hero: { eyebrow: string; h1Line1: string; h1Line2: string; sub1: string; sub2: string; cta: string; cta2: string; free: string; sample: string; sampleNote: string };
  agents: {
    eyebrow: string;
    h2Line1: string;
    h2Line2: string;
    sub: string;
    execHighlight: string;
    suffix: string;
    items: { red: AgentItem; orange: AgentItem; yellow: AgentItem; green: AgentItem; blue: AgentItem; indigo: AgentItem; violet: AgentItem };
  };
  exec: {
    eyebrow: string;
    h2Line1: string;
    h2Line2: string;
    sub: string;
    workHighlight: string;
    items: { minutes: ExecItem; slides: ExecItem; contract: ExecItem; deal: ExecItem; email: ExecItem; invoice: ExecItem; image: ExecItem; voice: ExecItem };
  };
  prism: { eyebrow: string; h2Line1: string; h2Line2: string; body: string; bodyEm: string; bodyTail: string; sub: string; briefLabel: string; briefBody: string; todoItems: string[] };
  pricing: {
    eyebrow: string;
    h2Lead: string;
    h2Accent: string;
    sub: string;
    popular: string;
    ctaTrial: string;
    ctaApply: string;
    annual: string;
    suffixMonth: string;
    plans: { starter: PlanT; standard: PlanT; exclusive: PlanT };
  };
  faq: { eyebrow: string; h2: string; sub: string; items: FaqItem[] };
  final: { h2Lead: string; h2Accent: string; h2Tail: string; sub: string; cta: string };
  fan: { hint: string; complete: string; completeSub: string };
  sampleBoot: { title: string; joined: string; skip: string };
  sticky: { title: string; sub: string; cta: string };
  footer: {
    tagline: string;
    product: string;
    company: string;
    contact: string;
    agents: string;
    exec: string;
    pricing: string;
    iris: string;
    terms: string;
    privacy: string;
    tokushou: string;
    contactText: string;
    copyright: string;
  };
};

export const ja: Dictionary = {
  banner: '✦ ベータ公開中 — 3 日間無料 / クレカ不要 / 解約は 1 タップ',

  nav: {
    agents:  '7つの仕事',
    exec:    '実行する AI',
    pricing: '料金',
    faq:     'よくある質問',
    cta:     '無料で試す →',
  },

  hero: {
    eyebrow: 'CORE PRISM — AI 役員 14 名があなたの会社になる',
    h1Line1: '14 人の AI 役員 が、',
    h1Line2: 'あなたの会社を 24 時間動かす。',
    sub1: 'ユーザーは 承認するだけ。',
    sub2: '議事録 / 営業 / 財務 / コンテンツ ── 全部、勝手に進む。',
    cta:  '3 日間 無料で試す',
    cta2: '価格を見る',
    sample: 'サンプルで触ってみる',
    sampleNote: '(架空カフェ経営者のデータで体験)',
    free: '3 日間ぜんぶ無料 · クレカ登録不要 · 解約は 1 タップ',
  },

  agents: {
    eyebrow: '7 AGENTS, 1 OS',
    h2Line1: '経営から、暮らしまで。',
    h2Line2: '7 つの仕事を、まるごと。',
    sub: '経営・営業・財務・創造・学び・人材・暮らし——それぞれに専属の AI がついて、考えて、書いて、調べて、整える。提案だけで終わらせず、実行まで担います。',
    execHighlight: '実行まで担います',
    suffix: '',
    items: {
      red:    { name: '経営', role: 'CEO Agent',       desc: '戦略立案・KPI 自動モニタリング・意思決定メモ生成' },
      orange: { name: '営業', role: 'Sales Agent',     desc: 'リード探索・商談スクリプト・提案書ドラフト・反論対応' },
      yellow: { name: '財務', role: 'CFO Agent',       desc: 'P&L 自動生成・経費OCR・予算配分・キャッシュ予測' },
      green:  { name: '創造', role: 'Creative Agent',  desc: '画像生成・キャプション・ブランド設計・スライド自動化' },
      blue:   { name: '学び', role: 'Knowledge Agent', desc: 'YouTube 要約・読書ノート・知識グラフ・横断検索' },
      indigo: { name: '人材', role: 'People Agent',    desc: '1on1 履歴・センチメント分析・採用面接・チームケア' },
      violet: { name: '生活', role: 'Life Agent',      desc: '健康・スケジュール・家族の予定・心の整え' },
    },
  },

  exec: {
    eyebrow: 'EXECUTION, NOT JUST SUGGESTIONS',
    h2Line1: '提案で終わらない。',
    h2Line2: '書く、整える、提出する。',
    sub: '議事録・スライド・契約書・営業メール・商談ロールプレイ ── エージェントが 仕事そのもの をやってくれる。',
    workHighlight: '仕事そのもの',
    items: {
      minutes:  { label: '議事録 AI',  desc: '会話を録音 → 要約・タスク抽出・送付メール' },
      slides:   { label: 'スライド AI', desc: '構成・原稿・デザインまでワンコマンドで' },
      contract: { label: '契約書 AI',   desc: 'NDA・業務委託・購貸 — 雛形+リスク確認' },
      deal:     { label: '商談 AI',     desc: '反論ロープレ・刺さるトーク・次の一手' },
      email:    { label: 'メール AI',   desc: '受信トレイを 30 分間隔で巡回・下書き済' },
      invoice:  { label: '請求 AI',     desc: '見積→発注→納品→請求の一気通貫' },
      image:    { label: '画像 AI',     desc: 'ブランドに沿った投稿・サムネ・OG画像' },
      voice:    { label: '音声入力',     desc: '思考をしゃべるだけで自動分類・整理' },
    },
  },

  prism: {
    eyebrow: 'ONE PRISM, ALL LIGHT',
    h2Line1: 'SaaS を切替える時代は、',
    h2Line2: 'もう終わった。',
    body: 'CRM、議事録、画像生成、スライド、メール、健康記録 ── ぜんぶ、',
    bodyEm: 'ひとつの PRISM の中',
    bodyTail: ' に。',
    sub: '⌘+K で 7 つの仕事を横断検索、人格を切替えれば文脈ごと一新。入力は文字でも、音声でも、画像でも。',
    briefLabel: '今日のブリーフ',
    briefBody: '午前は新規開拓、午後は提案書をエージェントが下書き済みです。',
    todoItems: ['＋ 株式会社○○ への提案書', '＋ 経費 OCR (3件)', '＋ Gmail 返信下書き 5件', '＋ 来週の P&L レビュー'],
  },

  pricing: {
    eyebrow:   'PRICING',
    h2Lead:    '使うだけ広がる、',
    h2Accent:  'あなたの可能性',
    sub:       'すべてのプランで Claude / Gemini / Stable Diffusion を内蔵。API キー不要。',
    popular:   '人気',
    ctaTrial:  '3 日無料で試す',
    ctaApply:  '今すぐ申し込む',
    annual:    '年払いで 2 ヶ月分割引 · 法人は別途お問い合わせください',
    suffixMonth: '/ 月',
    plans: {
      starter: {
        name: 'Starter',
        tag:  '個人事業 / ひとり社長',
        price: '¥2,980',
        features: [
          '3 つの人格 (経営/営業/+1)',
          '商談・議事録・スライド AI',
          'Cmd+K 横断検索',
          'PWA / オフライン対応',
        ],
      },
      standard: {
        name: 'Standard',
        tag:  'フリーランス / 小規模',
        price: '¥9,800',
        features: [
          '7 つの人格 (全エージェント)',
          '提案書・契約書・財務AI',
          'Gmail シャドー秘書 (返信下書き)',
          'YouTube 取込 → ナレッジ',
          'CRM 案件・見積→請求一気通貫',
        ],
      },
      exclusive: {
        name: 'Exclusive',
        tag:  '経営者 / チーム',
        price: '¥29,800',
        features: [
          'Standard 全機能',
          '人物ケア (1on1 + センチメント)',
          'API アクセス + Webhook',
          'チーム共有 (5名まで)',
          '優先サポート + 戦略コーチ',
        ],
      },
    },
  },

  faq: {
    eyebrow: 'FAQ',
    h2: 'よくあるご質問',
    sub: '迷ったら、まずここをご覧ください。',
    items: [
      {
        q: 'API キーの登録は必要ですか？',
        a: 'いいえ。Claude / Gemini / Stable Diffusion は CORE Prism 側で内蔵しています。サインアップしたその日から、追加設定なしで全エージェントが動きます。',
      },
      {
        q: '無料トライアル後、自動で課金されますか？',
        a: 'いいえ。トライアル登録時にクレジットカードは不要です。7 日が過ぎても自動で課金されることはありません。続けるかどうかは、あなたが判断してから決めて頂けます。',
      },
      {
        q: '私の業界・業種にも合いますか？',
        a: 'はい。CORE Prism は職種別ではなく「役割別」のエージェントなので、経営・営業・財務など事業活動を持つ方なら業界問わずご利用頂けます。実際、士業からクリエイター、医療系まで幅広く導入されています。',
      },
      {
        q: '入力したデータは安全ですか？',
        a: 'はい。全データは暗号化された上で、お客様ごとに分離して保管されます。AI 学習にも転用されません。詳細はプライバシーポリシーをご覧ください。',
      },
      {
        q: 'チームで共有できますか？',
        a: 'Exclusive プランで 5 名までチーム共有が可能です。さらに大きな組織での導入は、別途お問い合わせください。',
      },
      {
        q: '解約はかんたんですか？',
        a: 'はい。いつでも設定画面から 1 クリックで解約できます。違約金や引き止めはありません。',
      },
    ],
  },

  final: {
    h2Lead:   '「ひとりで全部」を、',
    h2Accent: '卒業する。',
    h2Tail:   '',
    sub: '3 日間、すべての AI 役員を無料でお試しできます。クレジットカードの登録は不要です。',
    cta: '無料で Prism を試す',
  },

  fan: {
    hint: '横にスワイプして、7人全員に会う',
    complete: '7人、全員そろいました',
    completeSub: 'この7つの仕事すべてが、登録した瞬間からあなたのものになります。',
  },

  sampleBoot: {
    title: '架空のカフェのサンプルデータを準備しています',
    joined: '着任',
    skip: 'タップでスキップ',
  },

  sticky: {
    title: 'Prismを、無料で試す',
    sub: '3日間無料・クレカ不要・いつでも解約',
    cta: '無料で始める →',
  },

  footer: {
    tagline:     'すべての事業家に、エージェント AI を。',
    product:     'PRODUCT',
    company:     'COMPANY',
    contact:     'CONTACT',
    agents:      '7 つの仕事',
    exec:        '実行する AI',
    pricing:     '料金',
    iris:        '姉妹ブランド · CORE Iris',
    terms:       '利用規約',
    privacy:     'プライバシーポリシー',
    tokushou:    '特定商取引法表記',
    contactText: '法人契約・カスタム導入のご相談は',
    copyright:   '© {year} CORE Prism · Built with care',
  },
};
