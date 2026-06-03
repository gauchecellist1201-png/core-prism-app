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
}

// ─── 1) /lp/sme — 中小企業 経営者 ─────────────
const SME: IndustryConfig = {
  slug: 'sme',
  pageTitle: '中小企業の社長へ — CORE Prism',
  metaDescription: 'コンサル代月¥200 万を、月¥30,000 に。AI 役員 13 名があなたの会社の意思決定を支えます。7 日間 無料・カード登録なし。',
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
    { q: '無料期間後、自動で課金されますか?', a: '7 日間無料の間はカード登録不要です。継続を選んだときだけ決済画面が出ます' },
    { q: 'セキュリティ対策は?', a: 'すべての通信は HTTPS、データは端末内 + Stripe の世界水準 SOC2 環境に保管。SSO / 監査ログはプロプラン以上で提供' },
  ],
  accentRight: '#FBBF24',
  brandHint: 'prism',
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
  pricingTagline: '契約 1 件取れれば年間コストペイ。失敗しても 7 日間で離脱可',
  faq: [
    { q: '顧客情報を入れて安全ですか?', a: 'すべての処理は HTTPS で暗号化、顧客データは端末ローカル + 暗号化済 Stripe 環境のみ。第三者には一切共有しません' },
    { q: '営業マネージャー視点でも使えますか?', a: 'はい。チーム全員の提案文・反論対応を一元管理し、新人の育成データとしても活用できます' },
    { q: '不動産業特有のドキュメントに対応?', a: '重要事項説明書、賃貸借契約書、媒介契約書などのテンプレを内蔵。法的リスクの自動チェック付き' },
    { q: '金融商品取引法の制約は?', a: 'AI はあくまで「下書き」を作るツールです。最終的な提案・送信は必ず担当者が確認してください' },
  ],
  accentRight: '#34D399',
  brandHint: 'prism',
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
};

// ─── 4) /lp/solo — 一人社長 / 個人事業主 ───
const SOLO: IndustryConfig = {
  slug: 'solo',
  pageTitle: '一人社長・個人事業主の方へ — CORE Prism',
  metaDescription: '月¥5,000 で「事務専属社員 + AI 役員 13 名」を雇える時代。事務時間 月 30 時間 → 8 時間に。7 日間 無料・カード登録なし。',
  industryLabel: 'FOR SOLO ENTREPRENEURS',
  heroMain: 'ひとり社長の右腕、\n月 ¥5,000 で。\n事務・営業・経理 ぜんぶ AI。',
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
};

// ─── 5) /lp/creator — クリエイター (Iris) ─────
const CREATOR: IndustryConfig = {
  slug: 'creator',
  pageTitle: 'インフルエンサー・クリエイターへ — CORE Iris',
  metaDescription: 'フォロワー数より、案件数。SNS クリエイターのための「6 人の AI チーム」。リール台本 5 秒、DM 返信 AI、案件管理。月¥5,000。',
  industryLabel: 'FOR INFLUENCERS & CREATORS',
  heroMain: 'フォロワー数より、\n案件数。\n6 人の AI が月 ¥5,000 で。',
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
};

// ─── 6) /lp/freelance-pro — 上位フリーランス ─────
const FREELANCE_PRO: IndustryConfig = {
  slug: 'freelance-pro',
  pageTitle: 'フリーランス上位 10% へ — CORE Prism',
  metaDescription: '単価交渉と請求業務、AI に任せて月 +¥30 万。確定申告 月6h → 30 分。「制作」だけに集中できる環境。',
  industryLabel: 'FOR HIGH-INCOME FREELANCERS',
  heroMain: '単価交渉と請求業務、\nAI に任せて月 +¥30 万。\n上位 10% への入口。',
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
};

export const INDUSTRIES: Record<string, IndustryConfig> = {
  'sme': SME,
  'realestate-finance': REAL_FINANCE,
  'consulting': CONSULTING,
  'solo': SOLO,
  'creator': CREATOR,
  'freelance-pro': FREELANCE_PRO,
};

export const INDUSTRY_SLUGS = Object.keys(INDUSTRIES);
