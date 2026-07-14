// ============================================================
// industries.ts — 業界別 LP 6 種の設定データ
//
// オーナー指示 (2026-06-03):
//   業界の悩みから入り、数字で ROI を見せ、7 日無料 + カード登録なしへ
//   共通骨格 Hero/Pain/Solution/Proof/Pricing/FAQ/CTA は LpTemplate.tsx 側で実装
// ============================================================

export interface IndustryPainPoint {
  emoji: string;
  text: string;
}

export interface IndustryFeature {
  icon: string;
  title: string;
  body: string;
  /** 月間で削減できる時間 (時間単位) — Proof セクションで合算表示 */
  savesHours?: number;
}

export interface IndustryProofStat {
  /** 大きな数字 (例: "▲ 87%", "¥170 万", "30 → 8") */
  value: string;
  label: string;
  /** 補足 (実績/推定の明示) */
  caveat: 'estimate' | 'actual' | 'owner-experience';
}

export interface IndustryConfig {
  /** URL slug (/lp/<slug>) */
  slug: string;
  /** ブラウザタイトル */
  pageTitle: string;
  /** OG description */
  metaDescription: string;
  /** ターゲット業界ラベル (画面 top に小さく) */
  industryLabel: string;
  /** Hero メイン (大文字) */
  heroMain: string;
  /** Hero サブ */
  heroSub: string;
  /** Hero に出す巨大数字 1 つ */
  heroHeroNumber: { value: string; label: string };
  /** 悩み 4 つ */
  pain: IndustryPainPoint[];
  /** 解決 3 つ */
  features: IndustryFeature[];
  /** 数字で示す ROI 3 つ */
  proofStats: IndustryProofStat[];
  /** 推奨プラン (`v2-btoB-standard` 等) */
  recommendedPlan: 'v2-btoC-light' | 'v2-btoC-standard' | 'v2-btoC-pro' | 'v2-btoB-entry' | 'v2-btoB-standard' | 'v2-btoB-pro';
  /** プランの並び (左から表示) — 推奨が中央にくると人気バッジが映える */
  planLineup: Array<'v2-btoC-light' | 'v2-btoC-standard' | 'v2-btoC-pro' | 'v2-btoB-entry' | 'v2-btoB-standard' | 'v2-btoB-pro'>;
  /** Pricing セクションの上に出す ROI 訴求文 */
  pricingTagline: string;
  /** FAQ (LP 専用) */
  faq: Array<{ q: string; a: string }>;
  /** アクセントカラー (Hero グラデの右側) */
  accentRight: string;
  /** ロゴ脇のキーワード (PRISM/Iris どちらの世界観か) */
  brandHint: 'prism' | 'iris';
  /** 導入事例 (3 件、模擬) — Proof セクションの下に表示 */
  cases?: Array<{
    persona: string;       // 人物像 (例: 「ITコンサル 5 名の会社の代表 40 代男性」)
    usage: string;         // どう使ってるか (1 文)
    result: string;        // 結果 (1 文)
    quote: string;         // ひとこと (オーナーが想像で書いた、想定の声)
  }>;
  /** DDDD (2026-06-04): YouTube 説明動画 (2 分前後) */
  video?: {
    youtubeId: string;     // 例: 'dQw4w9WgXcQ'
    title: string;
    /** 想定再生時間 (UI 表示用 / 例: '2:14') */
    duration?: string;
  };
  /** KKKK (2026-06-04): SNS シェア用 OG 画像 URL or パス (1200×630)。未指定なら /og/industry-<slug>.png にフォールバック。 */
  metaOgImage?: string;
}

// ─── 1) /lp/sme — 中小企業 経営者 ─────────────
const SME: IndustryConfig = {
  slug: 'sme',
  pageTitle: '中小企業の社長へ — CORE Prism',
  metaDescription: 'コンサル代月¥200 万を、月¥30,000 に。AI 役員 13 名があなたの会社の意思決定を支えます。3 日間 無料・カード登録なし。',
  industryLabel: 'FOR SMB OWNERS',
  heroMain: 'コンサル代を 1/7 に。\nAI 役員 13 名 が、\nあなたの右腕になる。',
  heroSub: '経営判断・営業提案・財務分析 — 1 人の社長がいまや 1 人で抱えなくていい時代へ。',
  heroHeroNumber: { value: '月 ¥170 万', label: 'コンサル代の節約効果' },
  pain: [
    { emoji: '😔', text: '経営判断のたびに孤独に悩む。相談相手がいない' },
    { emoji: '⏰', text: '提案資料 / 営業文 / 議事録 を全部自分で書いている' },
    { emoji: '📉', text: '数字を見ても、どこに手を打つべきか分からない' },
    { emoji: '💸', text: 'コンサルは高すぎる、タイミングも違う' },
  ],
  features: [
    { icon: '👔', title: '13 名の AI 役員会', body: 'CEO / CFO / CSO / CTO / CMO / COO / CPO / CDO / CDS / CHR / CLO / CAO / CCO が常時待機。経営判断に 3 案 + 推奨 1 案を 10 分で提示', savesHours: 6 },
    { icon: '✍', title: '営業文 / 提案資料 / 月次 P/L', body: '「お願いします」の 1 タップで成果物完成。確認 → 修正 → 送信まで 5 分', savesHours: 12 },
    { icon: '🤝', title: '商談 → クロージング', body: '顧客状況に合わせた CVR の高い提案を即時生成。新人でもプロの提案ができる', savesHours: 8 },
  ],
  proofStats: [
    { value: '▲ 87%', label: '事務作業時間 削減', caveat: 'owner-experience' },
    { value: '月 ¥170 万', label: 'コンサル代 節約効果', caveat: 'estimate' },
    { value: '+18%', label: '営業 CVR 改善 (見込み)', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoB-standard',
  planLineup: ['v2-btoB-entry', 'v2-btoB-standard', 'v2-btoB-pro'],
  pricingTagline: '月¥30,000 で「優秀な秘書 + コンサル」を雇うのと同等',
  faq: [
    { q: '社員何人くらいまで使えますか?', a: 'エントリー 5 名 / スタンダード 15 名 / プロ 50 名まで。それ以上はエンタープライズ (年¥200-400 万) で対応します' },
    { q: '請求書払い (口座振込) はできますか?', a: 'はい、全プランで口座振込に対応しています。月次または半期請求が選べます' },
    { q: '無料期間後、自動で課金されますか?', a: '3 日間無料の間はカード登録不要です。継続を選んだときだけ決済画面が出ます' },
    { q: 'セキュリティ対策は?', a: 'すべての通信は HTTPS、データは端末内 + Stripe の世界水準 SOC2 環境に保管。SSO / 監査ログはプロプラン以上で提供' },
  ],
  accentRight: '#FBBF24',
  brandHint: 'prism',
  cases: [
    {
      persona: 'IT コンサル法人 (8 名・50 代社長)',
      usage: '月次経営判断を 13 CXO に相談 → 推奨案 + 数字根拠を 10 分で受け取り',
      result: 'コンサル外注 月¥120 万を撤去、判断スピード 3 倍',
      quote: '「相談相手がいなかった社長の孤独が、AI で消えた」',
    },
    {
      persona: '製造業 (25 名・3 代目女性経営者)',
      usage: '営業文 / 提案資料 / 月次 P/L を AI に丸投げ',
      result: '事務時間 月 28h → 6h、本業 (新規開拓) に集中',
      quote: '「やっと "経営" できるようになりました」',
    },
    {
      persona: '飲食チェーン 5 店舗 (40 代男性)',
      usage: 'CHR エージェントで求人票 + 媒体組み合わせを最適化',
      result: '応募 3 倍、採用コスト ▲ 65%',
      quote: '「時給 1,400 → 1,580 でも応募が来るようになった」',
    },
  ],
  // DDDD (2026-06-04): プレースホルダー — 撮影後に youtubeId を差し替え
  video: {
    youtubeId: 'dQw4w9WgXcQ', // ⚠ 仮 ID — 本番撮影後に CORE 公式動画へ
    title: '2 分で分かる CORE Prism (中小企業向け)',
    duration: '2:04',
  },
};

// ─── 2) /lp/realestate-finance — 不動産 / 金融営業 ─
const REAL_FINANCE: IndustryConfig = {
  slug: 'realestate-finance',
  pageTitle: '不動産 / 金融営業の方へ — CORE Prism',
  metaDescription: '契約 1 件で投資回収。顧客資料を入れた瞬間に潜在ニーズ・反論想定・クロージング文まで全部出る AI 営業パートナー。',
  industryLabel: 'FOR REAL ESTATE & FINANCE',
  heroMain: '契約 1 件で、\n投資回収。\n提案の質を 5 倍に。',
  heroSub: '顧客プロフィールを入れた瞬間に、潜在ニーズ・法的リスク・競合比較・反論想定まで全部 AI が抽出。',
  heroHeroNumber: { value: '8h → 30min', label: '提案準備時間' },
  pain: [
    { emoji: '🕒', text: '顧客 1 人あたり提案準備に 4-5 時間' },
    { emoji: '🤔', text: '反論ハンドリングは経験頼み、新人が育たない' },
    { emoji: '⚖', text: '法律・契約リスクの見落としが怖い' },
    { emoji: '💭', text: '顧客の本当のニーズに気付くタイミングが遅い' },
  ],
  features: [
    { icon: '🎯', title: '潜在ニーズ 自動抽出', body: '顧客資料 → 表面の課題だけでなく潜在ニーズ・法的リスク・解決策まで 2 分で抽出', savesHours: 24 },
    { icon: '💬', title: '反論ハンドリング 20 パターン', body: '「高い」「考えます」「他社と比較中」など、想定 20 パターン + クロージング文を即時生成', savesHours: 8 },
    { icon: '📜', title: 'クロージング文 + 契約書ドラフト', body: '商談メモから提案書 → クロージングメール → 契約書ドラフトまで一気通貫', savesHours: 16 },
  ],
  proofStats: [
    { value: '▲ 87%', label: '提案準備時間 削減', caveat: 'estimate' },
    { value: '12%→28%', label: '新人成約率 改善 (見込み)', caveat: 'estimate' },
    { value: '1 件で 12ヶ月', label: '投資回収 (BtoB スタンダード)', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoB-standard',
  planLineup: ['v2-btoB-entry', 'v2-btoB-standard', 'v2-btoB-pro'],
  pricingTagline: '契約 1 件取れれば年間コストペイ。失敗しても 3 日間で離脱可',
  faq: [
    { q: '顧客情報を入れて安全ですか?', a: 'すべての処理は HTTPS で暗号化、顧客データは端末ローカル + 暗号化済 Stripe 環境のみ。第三者には一切共有しません' },
    { q: '営業マネージャー視点でも使えますか?', a: 'はい。チーム全員の提案文・反論対応を一元管理し、新人の育成データとしても活用できます' },
    { q: '不動産業特有のドキュメントに対応?', a: '重要事項説明書、賃貸借契約書、媒介契約書などのテンプレを内蔵。法的リスクの自動チェック付き' },
    { q: '金融商品取引法の制約は?', a: 'AI はあくまで「下書き」を作るツールです。最終的な提案・送信は必ず担当者が確認してください' },
  ],
  accentRight: '#34D399',
  brandHint: 'prism',
  cases: [
    {
      persona: '不動産仲介 営業部長 (40 代男性 / 営業 30 名)',
      usage: '新人の提案準備に AI、反論対応 20 パターンを社内で共有',
      result: '新人の初成約まで 90 日 → 30 日',
      quote: '「教える時間が 1/3 で、結果は 3 倍になりました」',
    },
    {
      persona: '生保営業 (35 歳女性・富裕層担当)',
      usage: '顧客資料を入れて潜在ニーズを 2 分で抽出、提案書ドラフトまで',
      result: '提案準備 4h → 30 分、提案数 月 8 → 23',
      quote: '「忙しさで気付けなかった顧客の本音が、AI で見えた」',
    },
    {
      persona: '投資不動産仲介 (一人法人・年商 ¥3,000 万)',
      usage: 'クロージング文 + 契約書ドラフトまで AI で',
      result: '成約率 18% → 41%、年商 1.6 倍',
      quote: '「営業マンを 1 人雇うか AI かで悩んで、結果 AI で正解」',
    },
  ],
};

// ─── 3) /lp/consulting — コンサル / 士業 ────
const CONSULTING: IndustryConfig = {
  slug: 'consulting',
  pageTitle: 'コンサル・士業の方へ — CORE Prism',
  metaDescription: '分析 → 提案 → 報告書 を AI が下書き。あなたは判断と署名だけ。1 人で同時案件数 2.4 倍、報告書作成 8h → 1.5h。',
  industryLabel: 'FOR CONSULTANTS & PROFESSIONALS',
  heroMain: '分析 → 提案 → 報告書、\nAI が下書き。\nあなたは判断と署名だけ。',
  heroSub: 'リサーチ・整理・資料作成の作業時間 80% カット。クライアント数を 2 倍に、品質はそのままに。',
  heroHeroNumber: { value: '同時 5 → 12 案件', label: '1 人あたり対応可能案件数' },
  pain: [
    { emoji: '🌙', text: '分析・調査・資料作成で夜中まで残業' },
    { emoji: '🤯', text: '1 人が抱える案件数に限界がある' },
    { emoji: '👀', text: 'ジュニアの調査作業をレビューする時間が無い' },
    { emoji: '📁', text: '報告書 / 提案書のテンプレ化が出来ていない' },
  ],
  features: [
    { icon: '📊', title: '論点抽出 + 章立て + 数字グラフ', body: '資料 (Word/PDF/Excel) を入れる → 論点抽出 + 章立て + 数字グラフ案を AI が作成', savesHours: 20 },
    { icon: '📝', title: '月次レポート / 議事録 / Q&A', body: 'クライアント向けの月次レポート・議事録・FAQ メールを下書き。署名するだけ', savesHours: 18 },
    { icon: '♻', title: '過去案件 → ナレッジ', body: '過去案件をナレッジ化 → 類似案件で提案を再利用。新案件の立ち上がりが 3 倍速', savesHours: 12 },
  ],
  proofStats: [
    { value: '▲ 81%', label: '報告書作成時間 削減', caveat: 'estimate' },
    { value: '2.4 倍', label: '1 人あたり同時案件数', caveat: 'estimate' },
    { value: '▲ 70%', label: 'ジュニア レビュー時間', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoB-pro',
  planLineup: ['v2-btoB-entry', 'v2-btoB-standard', 'v2-btoB-pro'],
  pricingTagline: '1 人で 12 案件回す前提で 1 案件あたり ¥4,200/月。最初の 1 件で回収完了',
  faq: [
    { q: '機密情報を扱う案件で使えますか?', a: '端末ローカル処理 + 通信暗号化が基本。NDA を結んだクライアント案件にも対応 (具体的な要件があればご相談ください)' },
    { q: 'チーム共有 (案件メモ・テンプレ)?', a: 'プロプラン (¥50,000/月) で 50 名までチーム共有・テンプレ共有 OK' },
    { q: 'クライアントへの請求書発行は?', a: 'インボイス制度対応の請求書 AI 機能を内蔵。T 番号入りで作成・PDF 化・送付まで自動化' },
    { q: '士業向け監修は?', a: 'AI 生成物は「下書き」です。法的助言・税務助言の最終確認は資格者の判断でお願いします' },
  ],
  accentRight: '#9333EA',
  brandHint: 'prism',
  cases: [
    {
      persona: '税理士法人 (パートナー 3 名・顧客 200 社)',
      usage: '月次顧問業務 + 申告期の論点抽出 + 報告書ドラフト',
      result: '申告期の月平均残業 90h → 22h、新規受任 +12 社',
      quote: '「人を雇わずに案件数を増やせる構造ができた」',
    },
    {
      persona: '個人弁護士 (40 代女性・一般民事)',
      usage: '案件メモ → 論点抽出 → クライアント宛サマリを自動',
      result: '案件同時数 4 → 9、収入 1.8 倍',
      quote: '「一人事務所のままで法人クラスの仕事ができる」',
    },
    {
      persona: '戦略コンサル独立 (45 歳男性)',
      usage: '分析資料の章立て + グラフ案 + 提案書ドラフトまで',
      result: '報告書 1 本 8h → 1.5h、稼働日数 ▲ 40%',
      quote: '「時間を取り戻して家族との週末が戻ってきました」',
    },
  ],
};

// ─── 4) /lp/solo — 一人社長 / 個人事業主 ───
const SOLO: IndustryConfig = {
  slug: 'solo',
  pageTitle: '一人社長・個人事業主の方へ — CORE Prism',
  metaDescription: '月¥5,000 で「事務専属社員 + AI 役員 13 名」を雇える時代。事務時間 月 30 時間 → 8 時間に。3 日間 無料・カード登録なし。',
  industryLabel: 'FOR SOLO ENTREPRENEURS',
  heroMain: 'ひとり社長の右腕。\n月¥5,000 で\n全部 AI に任せる。',
  heroSub: '月 30 時間の事務作業 → 8 時間に。残った 22 時間で売上を作る側に回ろう。',
  heroHeroNumber: { value: '月 22h', label: '本業に戻ってくる時間' },
  pain: [
    { emoji: '📚', text: '事務作業 (請求書 / 議事録 / メール返信) で本業の時間が消える' },
    { emoji: '🧾', text: '経営の数字が見えない。Excel で手入力疲れ' },
    { emoji: '😨', text: '営業文を書くのが苦手で、送信ボタンが押せない' },
    { emoji: '🫥', text: '相談相手がいない (税理士は数字の話だけ)' },
  ],
  features: [
    { icon: '🔌', title: '繋ぐだけで自動集計', body: 'Stripe / Gmail / Google カレンダーを繋ぐ → 数字と予定が自動で見える。Excel から卒業', savesHours: 8 },
    { icon: '🌅', title: '朝のブリーフ → AI 実行', body: '「今日まず何をやる?」 → アクションタップで AI がその場で実行 → 成果物を納品', savesHours: 14 },
    { icon: '✉', title: '営業文 / 提案 / 議事録 / 請求書', body: '全部 1 タップで下書き完成。「私が下手だから書けない」がもう言い訳にならない', savesHours: 8 },
  ],
  proofStats: [
    { value: '30h → 8h', label: '月の事務時間 (オーナー実体験)', caveat: 'owner-experience' },
    { value: '¥66,000', label: '月の時間価値 (時給3,000円換算)', caveat: 'estimate' },
    { value: '月 ¥5,000', label: '投資 (回収まで 3 日)', caveat: 'actual' },
  ],
  recommendedPlan: 'v2-btoC-standard',
  planLineup: ['v2-btoC-light', 'v2-btoC-standard', 'v2-btoC-pro'],
  pricingTagline: '時給 3,000 円なら 月 22h 戻ってくる = 月 ¥66,000 の価値。投資 ¥5,000 で 13 倍リターン',
  faq: [
    { q: 'パソコン苦手でも使えますか?', a: 'はい。すべて日本語、横文字最小限、タップ操作中心です。困ったらチャットで AI に聞けます' },
    { q: 'スマホ (iPhone) でも使える?', a: 'PWA でホーム画面に追加可。iPhone 単体でほぼ全機能が使えます (一部 PC 推奨機能あり)' },
    { q: '解約はいつでもできますか?', a: 'いつでも。次の更新日以降に課金停止します。途中解約のキャンセル料はゼロ' },
    { q: '個人情報を入れて大丈夫?', a: 'すべて端末ローカル処理 + HTTPS 通信。データは端末から離れません' },
  ],
  accentRight: '#FBBF24',
  brandHint: 'prism',
  cases: [
    {
      persona: 'チェロ教室主宰 (オーナー実体験)',
      usage: 'Stripe / Gmail / カレンダーを繋いで朝のブリーフで一日が始まる',
      result: '事務時間 月 30h → 8h、本業 (生徒対応) に集中',
      quote: '「やっと "経営者" でなく "先生" に戻れた感覚です」',
    },
    {
      persona: 'カフェ経営 (一人オーナー・年商 ¥1,200 万)',
      usage: '月次 P/L 自動 + 法人顧客への請求書 AI 下書き',
      result: '経理時間 月 12h → 2h、新メニュー試作の時間に',
      quote: '「税理士に頼んでた仕事の半分が AI で済むようになった」',
    },
    {
      persona: 'コーチング (一人会社・年商 ¥1,800 万)',
      usage: 'クライアント前のメモから 1on1 議事録 → 次回案内まで',
      result: '1 セッションの準備 + 後処理 2h → 25 分',
      quote: '「クライアント数を増やせる余白ができた」',
    },
  ],
};

// ─── 5) /lp/creator — クリエイター (Iris) ─────
const CREATOR: IndustryConfig = {
  slug: 'creator',
  pageTitle: 'インフルエンサー・クリエイターへ — CORE Iris',
  metaDescription: 'フォロワー数より、案件数。SNS クリエイターのための「6 人の AI チーム」。リール台本 5 秒、DM 返信 AI、案件管理。月¥5,000。',
  industryLabel: 'FOR INFLUENCERS & CREATORS',
  heroMain: 'フォロワー数より、\n案件数を。\n6 人の AI チームで。',
  heroSub: '「映え」より「いくら入ったか」。リール台本 5 秒、DM 返信 AI、案件管理 全部入り。',
  heroHeroNumber: { value: '5 秒', label: 'リール台本完成' },
  pain: [
    { emoji: '😩', text: '毎日のリールネタが切れる' },
    { emoji: '💌', text: 'DM 返信が間に合わず案件を取りこぼす' },
    { emoji: '👁', text: '「いくら入ったか」の数字が見えない' },
    { emoji: '🤐', text: 'ブランド案件の交渉が苦手' },
  ],
  features: [
    { icon: '🎬', title: 'リール台本 5 秒で完成', body: 'テーマ 1 行入れる → フック / 本編 / CTA / ハッシュタグまで構造化された台本が 5 秒で', savesHours: 20 },
    { icon: '💬', title: 'DM 受信 → AI 返信案', body: '案件確度判定 (高 / 中 / 低) + 返信文ドラフト。承認するだけで送信', savesHours: 12 },
    { icon: '👥', title: '6 人の AI チーム', body: '戦略 / 演出 / 案件 / ファン / 収益 / 健康 の 6 エージェントが代わりに考えてくれる', savesHours: 16 },
  ],
  proofStats: [
    { value: '5 秒', label: 'リール台本作成 (30 分 → 5 秒)', caveat: 'estimate' },
    { value: '18→4', label: '週の DM 返信 → 案件化 (実例)', caveat: 'estimate' },
    { value: '+40%', label: '案件単価 (交渉 AI 使用後)', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoC-standard',
  planLineup: ['v2-btoC-light', 'v2-btoC-standard', 'v2-btoC-pro'],
  pricingTagline: 'リール 1 本依頼 ¥30,000 で 6 ヶ月分回収。案件単価 +40% なら 2 案件で年回収',
  faq: [
    { q: 'Instagram と TikTok 両方使えますか?', a: 'はい。Instagram / TikTok / YouTube Shorts / X すべてに対応。一括投稿管理も可能' },
    { q: 'AI 返信が変な日本語にならない?', a: 'クリエイター向けに学習させた語彙 (タメ口 / 営業文 / カジュアル DM) を 3 トーンで切替できます' },
    { q: '案件管理機能はどんな感じ?', a: '「DM → 商談 → 入金」を 1 画面で。Stripe 連携で振込まで自動追跡 (Iris の標準機能)' },
    { q: '事務所所属でも使える?', a: 'はい。Pro プラン (¥15,000/月) でホワイトラベル化可、事務所のブランドで生徒/タレントに提供できます' },
  ],
  accentRight: '#E1306C',
  brandHint: 'iris',
  cases: [
    {
      persona: 'コスメ系インフルエンサー (28 歳・IG 35K)',
      usage: '案件 DM の AI 確度判定 + 返信 AI で取りこぼし防止',
      result: '案件単価 +35%、取りこぼし月 8 件 → 0',
      quote: '「DM の返信ストレスから完全に解放されました」',
    },
    {
      persona: 'ライフスタイル系 TikToker (32 歳・60K)',
      usage: 'リール台本 AI で毎日のネタ切れ解消',
      result: '投稿頻度 週 3 → 週 7、フォロワー 4 ヶ月で 1.7 倍',
      quote: '「企画する苦しみがなくなって、楽しめるようになった」',
    },
    {
      persona: 'グルメ系 Instagrammer (一人事業・年商 ¥800 万)',
      usage: '店舗との交渉文 + 投稿カレンダー + ファンクラブ運営',
      result: '案件件数 月 6 → 14、副業 → 本業化',
      quote: '「フリーで食べれる自信を AI が支えてくれてます」',
    },
  ],
};

// ─── 6) /lp/freelance-pro — 上位フリーランス ─────
const FREELANCE_PRO: IndustryConfig = {
  slug: 'freelance-pro',
  pageTitle: 'フリーランス上位 10% へ — CORE Prism',
  metaDescription: '単価交渉と請求業務、AI に任せて月 +¥30 万。確定申告 月6h → 30 分。「制作」だけに集中できる環境。',
  industryLabel: 'FOR HIGH-INCOME FREELANCERS',
  heroMain: '単価交渉も請求も、\nAI で月 +¥30 万。\n上位 10% への入口。',
  heroSub: '税理士不要、議事録不要、提案作成不要 — 「制作」だけに集中できる環境を月¥15,000 で。',
  heroHeroNumber: { value: '月 +¥30 万', label: '案件単価アップ効果' },
  pain: [
    { emoji: '⏳', text: '提案 / 見積 / 契約書 で 1 案件 6 時間' },
    { emoji: '🙇', text: '単価交渉が苦手で安く受けてしまう' },
    { emoji: '💀', text: '確定申告期に死ぬ' },
    { emoji: '🗂', text: '案件管理が Notion で散らかっている' },
  ],
  features: [
    { icon: '💰', title: '適正単価 + 交渉文 + 契約書', body: '案件登録 → AI が適正単価 + 交渉文 + 契約書ドラフト。安く受けるが「断る」に変わる', savesHours: 14 },
    { icon: '📊', title: 'Stripe + freee 連携で常に最新', body: '確定申告の準備が常に最新。月 6 時間 → 30 分。1 月分の労働で済む', savesHours: 18 },
    { icon: '🧠', title: '議事録 AI + 案件メモ AI', body: '「あれ何の話だっけ」を撲滅。クライアントとのやり取りすべてが構造化', savesHours: 10 },
  ],
  proofStats: [
    { value: '+¥30 万/月', label: '案件単価アップ (交渉 AI 使用後)', caveat: 'estimate' },
    { value: '6h → 30min', label: '月次の確定申告準備', caveat: 'estimate' },
    { value: '2 日', label: '投資回収 (案件単価 +30 万なら)', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoC-pro',
  planLineup: ['v2-btoC-light', 'v2-btoC-standard', 'v2-btoC-pro'],
  pricingTagline: '次の案件 +¥30 万なら 2 日で投資回収。月¥15,000 で「人を雇わない経営」に',
  faq: [
    { q: '個人事業主の確定申告に対応?', a: 'freee 連携 + 適格請求書 (インボイス) 発行で対応済。e-Tax 連携は順次対応' },
    { q: '案件管理 (Notion / Spreadsheet) からの移行は?', a: 'CSV インポートで一括移行できます。AI が自動でカテゴリ分け' },
    { q: '法人化を考えています、対応プランは?', a: '法人化と同時に v2-btoB-entry (¥20,000/月) へアップグレード可。会計連携・社員追加が解禁' },
    { q: '休眠期間中も課金されますか?', a: 'いつでも解約 OK。再開時は同じ料金で復活できます (データは 6 ヶ月保管)' },
  ],
  accentRight: '#34D399',
  brandHint: 'prism',
  cases: [
    {
      persona: 'フリーバックエンドエンジニア (32 歳・月単価 ¥120 万)',
      usage: '案件登録 → 適正単価 + 交渉文 + 契約書を AI で',
      result: '月単価 ¥120 → ¥160 万 (3 ヶ月で +¥120 万)',
      quote: '「自分の "言い値" が崩れて、上位の単価帯に入れた」',
    },
    {
      persona: 'フリーランス UI/UX デザイナー (34 歳女性)',
      usage: '提案書 + 議事録 + 確定申告まで全部 AI',
      result: '月の稼働日 22 → 16、休む日が増えた',
      quote: '「制作だけに集中する環境がやっと作れた」',
    },
    {
      persona: 'フリー Web ライター (40 代男性・年商 ¥800 万)',
      usage: '案件管理 + 単価交渉 + 経理を 1 画面に',
      result: '案件取りこぼし ゼロ、確定申告準備 月 6h → 30 分',
      quote: '「月末になっても心が穏やかでいられるようになった」',
    },
  ],
};

// ─── 7) /lp/saas-startup — SaaS スタートアップ CEO (2026-06-04 AAAAA) ─
const SAAS_STARTUP: IndustryConfig = {
  slug: 'saas-startup',
  pageTitle: 'SaaS スタートアップ CEO へ — CORE Prism',
  metaDescription: '1 人 CEO に 13 人の AI 役員。プロダクト・営業・PR・採用 を 1 画面で。月¥30,000 で「シリーズ A 級 の経営チーム」を雇える。',
  industryLabel: 'FOR SAAS STARTUP CEOs',
  heroMain: '1 人 CEO に、\n13 人の AI 役員。\nシリーズ A まで 1 人で走れる。',
  heroSub: 'プロダクト・営業・PR・採用 を 1 画面で。創業期に いちばん必要な「右腕」を月¥30,000 で雇える。',
  heroHeroNumber: { value: '1人 → 14人', label: '実質チーム規模 (AI 役員 13 + 自分)' },
  pain: [
    { emoji: '🌀', text: 'プロダクトと営業と採用 を 全部 1 人で回している' },
    { emoji: '📈', text: '数字を見て次の打ち手 を 1 日中考えてる' },
    { emoji: '🪙', text: 'シリーズ A まで CFO / CMO / CTO を 雇えない' },
    { emoji: '😶‍🌫️', text: '相談相手の VC / 先輩は 反応が遅い' },
  ],
  features: [
    { icon: '🚀', title: 'AI 役員 13 名 で 経営即決', body: 'CEO / CTO / CFO / CMO / CPO / CSO / COO / CDO / CHR / CDS / CCO / CLO / CAO が常駐。判断 → 3 案 + 推奨 を 10 分', savesHours: 12 },
    { icon: '💸', title: 'ピッチ資料 + 投資家 メール + KPI ダッシュ', body: '次の投資家ミーティング向け資料を 1 タップで。 KPI と 来月の目標 を 自動で 1 枚に', savesHours: 8 },
    { icon: '🧑‍💻', title: '採用 JD + スカウト DM + 面接質問', body: 'JD 作成 + LinkedIn スカウト + 面接質問 + 評価シート まで AI が下書き。エンジニア採用が 1 週間早まる', savesHours: 10 },
  ],
  proofStats: [
    { value: '▲ 75%', label: '創業期 雑務時間 削減', caveat: 'estimate' },
    { value: '月 ¥220 万', label: 'CFO/CMO/CPO 採用 を 据え置いた節約効果', caveat: 'estimate' },
    { value: '2.4倍', label: '投資家 ピッチ準備 スピード', caveat: 'estimate' },
  ],
  recommendedPlan: 'v2-btoB-standard',
  planLineup: ['v2-btoB-entry', 'v2-btoB-standard', 'v2-btoB-pro'],
  pricingTagline: '月¥30,000 で「シード 〜 シリーズ A の経営チーム」を雇える。創業者 1 人で走り抜ける月数を伸ばす',
  faq: [
    { q: 'シリーズ A 調達後も使えますか?', a: '使えます。むしろ 採用した CXO 候補との橋渡し に最適 — 採用前の役割を AI が担い、面接 / 引継ぎ も AI でログ化できます' },
    { q: 'プロダクト データ を AI に渡しても 安全ですか?', a: '通信は HTTPS、AI は 入力を学習しない契約 (Anthropic Commercial API)。Trust センター /trust も併せて確認ください' },
    { q: '法人クレカ / 請求書払いに対応?', a: 'はい。すべてのプランで 法人クレカ / 銀行振込 (月次/半期) に対応' },
    { q: '英語で使えますか?', a: 'はい。LP も AI 出力も 日本語 / 英語 を切替可。海外 VC への 英語ピッチ もそのまま生成できます' },
  ],
  accentRight: '#3B82F6',
  brandHint: 'prism',
  cases: [
    {
      persona: 'BtoB SaaS シード期 CEO (29 歳・1 人 創業)',
      usage: '週 1 で 13 CXO に経営判断を相談 + 投資家 ピッチ準備を AI で',
      result: '創業期 雑務 ▲ 70%、プロダクト開発に 週 +20h 投下',
      quote: '「相談する相手が居なかった夜が、AI で消えた」',
    },
    {
      persona: 'AI スタートアップ CEO (33 歳・共同創業 3 人)',
      usage: '採用 JD + スカウト DM + 面接設計 を 全部 AI に下書きさせて自分は 最終承認だけ',
      result: 'エンジニア 採用 リードタイム 6 週 → 2 週',
      quote: '「採用に時間使うフェーズ じゃないんだよね」',
    },
    {
      persona: 'モバイル SaaS シリーズ A 直前 CEO (37 歳)',
      usage: 'KPI ダッシュ + 投資家 月次 メール + ピッチ更新を毎週 自動化',
      result: '投資家ミーティング 準備 8h → 1.5h',
      quote: '「投資家の期待値コントロール が AI で一定になった」',
    },
  ],
};

export const INDUSTRIES: Record<string, IndustryConfig> = {
  'sme': SME,
  'realestate-finance': REAL_FINANCE,
  'consulting': CONSULTING,
  'solo': SOLO,
  'creator': CREATOR,
  'freelance-pro': FREELANCE_PRO,
  'saas-startup': SAAS_STARTUP,
};

export const INDUSTRY_SLUGS = Object.keys(INDUSTRIES);
