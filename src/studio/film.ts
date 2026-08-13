// ============================================================
// CORE Studio — 映像制作 (AI SHORT DRAMA / BRAND MOVIE / VIDEO CREATIVE)
// 価格・コピー・作品データの一元管理。金額の変更はこのファイルだけを編集する。
// 一人称は「私たち/当社」・顧客は「貴社」。誇大表現と架空実績は書かない。
// ============================================================

export const FILM = {
  label: 'Film & Motion',
  // 375px で1行に収まる長さで改行位置を固定する (自動折返しに任せると「ものか/ら。」で割れる)
  hero: '映像は、\n撮影するものから。\n創造するものへ。',
  heroSub: 'CORE Studioは、AIと人間の企画力を組み合わせ、ブランド・人物・商品の世界観を、ショートドラマ、SNS動画、ブランドムービーとして映像化します。撮影できなかった世界まで、つくる。',
  heroCta: '制作を相談する',
  heroCtaSub: '制作プランを見る',
  /** 実映像の掲載状況を正直に添える一文 (架空の実績を作らないため) */
  showcaseNote: '「実写」バッジのあるものは、被写体の掲載許諾を得たうえで公開している実写の参考映像です。それ以外は当社が制作する映像フォーマットのタイトルカードで、実際の制作映像は許諾をいただいたものから順次掲載します。',
} as const;

// ------------------------------------------------------------
// ショーケース
//   実映像が用意でき次第 videoUrl / poster を足すだけで再生に切り替わる。
//   videoUrl も poster も無い間は、タイトルフレーム表示になる (壊れたリンクを作らない)。
// ------------------------------------------------------------
export type StudioProjectCategory = 'SHORT DRAMA' | 'BRAND FILM' | 'PRODUCT' | 'ARTIST' | 'SOCIAL';

export type StudioProject = {
  id: string;
  no: string;
  title: string;
  category: StudioProjectCategory;
  description: string;
  /** 9:16 が既定。16:9 の案件は '16 / 9' を指定 */
  aspectRatio: string;
  /** 静止画 (public/studio/film/ に置く。例: '/studio/film/short-drama.jpg') */
  poster?: string;
  /** 実映像 (mp4 推奨・音声なしループ用。指定すると自動でループ再生に切り替わる) */
  videoUrl?: string;
  /** true の場合「実写」バッジを表示する。AI生成物と誤認されないための表示区分 (被写体の掲載許諾は取得済み) */
  isReal?: boolean;
};

export const studioProjects: StudioProject[] = [
  {
    id: 'short-drama',
    no: '01',
    title: 'ショートドラマ',
    category: 'SHORT DRAMA',
    description: '経営者や専門家を主人公にした、続きが見たくなる連続もの。広告ではなく物語として届けます。',
    aspectRatio: '9 / 16',
  },
  {
    id: 'brand-film',
    no: '02',
    title: 'ブランドフィルム',
    category: 'BRAND FILM',
    description: '会社の思想と、そこにたどり着くまでの時間。言葉にしづらいものを、映像の温度に置き換えます。実写インタビューの参考例です。',
    aspectRatio: '9 / 16',
    poster: '/studio/film/brand-film.jpg',
    videoUrl: '/studio/film/brand-film.mp4',
    isReal: true,
  },
  {
    id: 'product',
    no: '03',
    title: 'プロダクト',
    category: 'PRODUCT',
    description: '商品を主役に、質感・使う瞬間・置かれる場所まで。現実には組めない画づくりも成立します。',
    aspectRatio: '9 / 16',
  },
  {
    id: 'artist',
    no: '04',
    title: 'アーティスト',
    category: 'ARTIST',
    description: '音楽・作品世界の視覚化。演奏や制作の現場を、その人の世界観のまま映像に伸ばします。実写映像の参考例です。',
    aspectRatio: '9 / 16',
    poster: '/studio/film/artist.jpg',
    videoUrl: '/studio/film/artist.mp4',
    isReal: true,
  },
  {
    id: 'social',
    no: '05',
    title: 'ソーシャル',
    category: 'SOCIAL',
    description: 'TikTok / Reels / Shorts に最適化した縦型。毎月続けられる本数と設計で発信を止めません。実写映像の参考例です。',
    aspectRatio: '9 / 16',
    poster: '/studio/film/social-backstage.jpg',
    videoUrl: '/studio/film/social-backstage.mp4',
    isReal: true,
  },
];

// ------------------------------------------------------------
// 主力商品 — AI SHORT DRAMA
// ------------------------------------------------------------
export const FEATURED = {
  en: 'Featured — Short Drama',
  title: 'あなた自身が、\nブランドの主人公になる。',
  body: [
    '経営者、医師、士業、アーティスト、店舗オーナー、講師。その人自身を主人公に据えたショートドラマを制作します。',
    '目指すのは「広告を見てもらうこと」ではなく、「続きが見たくなること」です。単発のPR動画で終わらせず、シリーズとして積み上げます。',
  ],
  episodes: [
    { no: 'EPISODE 01', title: 'その人を知る', body: '主人公の背景と、抱えているものが立ち上がる回。売り込みは一切しません。' },
    { no: 'EPISODE 02', title: 'その人を好きになる', body: '仕事への向き合い方や葛藤が見える回。人柄が伝わり、視聴者の距離が縮まります。' },
    { no: 'EPISODE 03', title: 'その仕事を知りたくなる', body: '事業やサービスの輪郭が自然に見えてくる回。ここで初めて「相談したい」が生まれます。' },
  ],
  ladder: ['人物への興味', '好感', 'ブランド理解', 'サービスへの関心'],
  closing: '露骨な広告感を出さないことを、設計の前提に置いています。売り込む映像は最後まで見てもらえません。',
} as const;

// ------------------------------------------------------------
// 制作するもの
// ------------------------------------------------------------
export type Creation = { id: string; en: string; title: string; body: string };

export const WHAT_WE_CREATE: Creation[] = [
  { id: 'drama', en: 'AI Short Drama', title: 'ショートドラマ', body: '人物やブランドを主人公にした縦型の連続ドラマ。シリーズ設計から担当します。' },
  { id: 'brand', en: 'Brand Movie', title: 'ブランドムービー', body: '会社や商品の思想・世界観を映像化。採用・展示会・サイトの顔として使えます。' },
  { id: 'social', en: 'Social Creative', title: 'ソーシャルクリエイティブ', body: 'TikTok / Instagram Reels / YouTube Shorts 向けの縦型。継続発信を前提に設計します。' },
  { id: 'product', en: 'Product Film', title: 'プロダクトフィルム', body: '商品を主役にした広告・プロモーション映像。撮影が難しい構図も成立します。' },
  { id: 'artist', en: 'Artist Visual', title: 'アーティストビジュアル', body: '音楽家・アーティスト・クリエイターのための映像。作品世界をそのまま拡張します。' },
  { id: 'commercial', en: 'AI Commercial', title: 'コマーシャル', body: '広告配信を前提とした15〜30秒のCM。配信面ごとの尺・比率で書き出します。' },
];

// ------------------------------------------------------------
// 制作工程
// ------------------------------------------------------------
export type FilmStep = { no: string; en: string; title: string; body: string };

export const FILM_PROCESS: FilmStep[] = [
  { no: '01', en: 'Discovery', title: '理解する', body: 'ブランド・人物・商品を伺います。何を売るかより先に、何が魅力なのかを定めます。' },
  { no: '02', en: 'Concept', title: '企画する', body: '世界観とシリーズ構成を設計します。1本で終わらせない前提で組み立てます。' },
  { no: '03', en: 'Script', title: '書く', body: 'ストーリーと台本を制作します。台詞・間・引きの作り方まで詰めます。' },
  { no: '04', en: 'Generate', title: '生成する', body: '人物・シーン・カットを制作。同じ人物が同じ顔で登場し続けるよう作り込みます。' },
  { no: '05', en: 'Edit', title: '仕上げる', body: '編集・音楽・字幕・カラー。ここが映像の印象の大半を決める工程です。' },
  { no: '06', en: 'Deliver', title: '納品する', body: 'SNS・広告の配信形式に合わせて書き出し、そのまま投稿できる状態でお渡しします。' },
];

export const PROCESS_STATEMENT = {
  title: 'プロンプトを渡して終わる会社ではありません。',
  body: '生成の技術そのものは、いずれ誰でも使えるようになります。私たちが担うのは、何を語るかを決め、完成した映像として世に出るところまで責任を持つことです。企画・脚本・ディレクション・仕上げまで、当社が一貫して手を動かします。',
} as const;

// ------------------------------------------------------------
// 料金 (単発)
// ------------------------------------------------------------
export type FilmPlan = {
  id: 'trial' | 'standard' | 'premium';
  name: string;
  price: string;
  unit: string;
  /** 価格の下に置く条件 (初回限定・修正回数など。曖昧にすると後で揉める) */
  terms: string;
  lead: string;
  includes: string[];
  cta: string;
  featured?: boolean;
};

export const FILM_PLANS: FilmPlan[] = [
  {
    id: 'trial',
    name: 'TRIAL',
    price: '¥29,800',
    unit: '1本',
    terms: '初めての方の1本かぎり / 修正2回',
    lead: 'まず1本、実物を見てから決めていただくための価格です。',
    includes: ['15〜30秒のショート映像', '企画', 'AI映像制作', '基本編集', 'SNS縦型 (9:16) 対応'],
    cta: 'まず1本試す',
  },
  {
    id: 'standard',
    name: 'STANDARD',
    price: '¥98,000',
    unit: '1本',
    terms: '修正無制限 / 広告への二次利用込み',
    lead: '台本から仕上げまで通した、当社の標準構成です。',
    includes: ['企画', '台本', 'AI映像生成', '複数シーン構成', '編集', 'BGM', '字幕', 'SNS最適化', '修正無制限', '広告二次利用 (期間・回数の制限なし)'],
    cta: 'この構成で相談する',
    featured: true,
  },
  {
    id: 'premium',
    name: 'PREMIUM',
    price: '¥198,000〜',
    unit: '1本',
    terms: '修正無制限 / 広告への二次利用込み',
    lead: '広告として世に出す前提の、シネマティックな1本を。',
    includes: ['シネマティック映像', 'キャラクター設計', '高度な人物固定', '複数ロケーション', 'ブランド世界観設計', '広告品質の仕上げ', '修正無制限', '広告二次利用 (期間・回数の制限なし)'],
    cta: '広告用に相談する',
  },
];

// ------------------------------------------------------------
// 料金 (月額 — 継続制作)
// ------------------------------------------------------------
export type MonthlyPlan = { id: string; volume: string; price: string; unitPrice: string; body: string; featured?: boolean };

export const MONTHLY_LEAD = {
  en: 'Monthly Creative',
  title: '毎月、SNSの中身に悩まなくなる。',
  body: '単発の制作ではなく、貴社の映像制作部門として毎月動きます。企画のストックを持ち、反応を見ながら次の本数に反映するため、続けるほど精度が上がります。',
} as const;

export const MONTHLY_PLANS: MonthlyPlan[] = [
  { id: 'm4', volume: '4 VIDEOS', price: '¥198,000', unitPrice: '1本 ¥49,500', body: '週1本。発信を止めずに続ける最小構成です。' },
  { id: 'm8', volume: '8 VIDEOS', price: '¥328,000', unitPrice: '1本 ¥41,000', body: '週2本。企画の当たり外れを見ながら方向を寄せられます。', featured: true },
  { id: 'm12', volume: '12 VIDEOS', price: '¥448,000', unitPrice: '1本 ¥37,334', body: '週3本。複数チャネル・複数テーマを並行して回せます。' },
];

// 継続契約で当社が引き受けている条件。
// 同業では 3〜6ヶ月の契約期間と初期費用8〜15万円が一般的なので、そこを明示的に外している。
export const MONTHLY_TERMS = [
  '初期費用 0円',
  '最低契約期間なし (1ヶ月ごとの更新)',
  '修正無制限',
  '広告への二次利用込み (期間・回数の制限なし)',
  '担当が固定 (窓口・企画・仕上げまで同じ人間が担当します)',
];

export const PRICE_NOTE = '表示価格は目安です。確定金額はヒアリングの上でお見積りとしてご提示し、以後の追加費用はいただきません。';

// ------------------------------------------------------------
// 象徴商品 — AI SHORT DRAMA BRANDING
// ------------------------------------------------------------
export const SIGNATURE = {
  en: 'Signature',
  name: 'AI SHORT DRAMA BRANDING',
  lead: '会社と経営者そのものを、メディアにする。',
  body: '広告枠を買い続けるのではなく、貴社自身が見られ続ける場所になるための契約です。主人公の設計から全12話の企画、毎月の制作までを一体で担当します。',
  initial: {
    label: 'INITIAL DESIGN',
    price: '¥300,000〜',
    includes: [
      'ブランドヒアリング',
      '主人公キャラクター設計',
      'Character Bible (人物設定の正本)',
      'Visual Bible (画づくりの正本)',
      '世界観設計',
      'シリーズコンセプト',
      '全12話の企画',
      'SNSコンテンツ設計',
    ],
  },
  monthly: {
    label: 'MONTHLY PRODUCTION',
    price: '¥498,000〜',
    volume: '8本 / 月',
    body: '設計した世界観のまま、毎月8本を制作・納品します。反応の良かった回は次の企画に反映します。',
  },
} as const;

// ------------------------------------------------------------
// 想定顧客
// ------------------------------------------------------------
export type Target = { en: string; ja: string; body: string };

export const TARGETS: Target[] = [
  { en: 'Founder / CEO', ja: '経営者', body: '会社の顔として、自分の言葉と存在を届けたい' },
  { en: 'Doctor / Clinic', ja: '医師・クリニック', body: '安心して任せられる人だと、来院前に伝えたい' },
  { en: 'Artist', ja: 'アーティスト', body: '作品世界を、そのままの温度で見せたい' },
  { en: 'Professional', ja: '士業・専門家', body: '難しい仕事の中身を、伝わる形に翻訳したい' },
  { en: 'Restaurant', ja: '飲食店', body: '店の空気と料理の力を、写真以上に伝えたい' },
  { en: 'Hotel', ja: 'ホテル・旅館', body: '滞在の時間そのものを、体験として見せたい' },
  { en: 'Real Estate', ja: '不動産', body: '物件ではなく、そこで始まる暮らしを見せたい' },
  { en: 'School', ja: 'スクール・教室', body: '通ったあとの自分を、想像してもらいたい' },
  { en: 'Beauty', ja: 'ビューティー', body: '仕上がりと世界観を、毎週途切れずに発信したい' },
  { en: 'Luxury Brand', ja: 'ラグジュアリー', body: 'ブランドの格を落とさずに、SNSへ出ていきたい' },
];

// ------------------------------------------------------------
// 従来の制作との違い (他社を貶さない)
// ------------------------------------------------------------
export const COMPARISON = {
  en: 'Before / After',
  title: '工程が減るのではなく、\n制約が外れる。',
  traditional: {
    label: 'Traditional Production',
    steps: ['企画', 'ロケハン', 'スタジオ', 'キャスティング', '撮影', '編集'],
    body: '確かな手法です。実写にしか出せない説得力があり、私たちも必要な場面では撮影をおすすめします。ただし、天候・場所・人・日程がそろって初めて成立します。',
  },
  core: {
    label: 'CORE Studio',
    steps: ['IDEA', 'CREATE', 'DELIVER'],
    body: '撮影という条件を外すことで、季節も場所も、現実には組めない画も選べるようになります。シリーズとして続けやすく、毎月の発信に乗せられます。',
  },
  caution: {
    title: 'ただし、AIなら何でも簡単、ではありません。',
    body: '生成そのものは誰でも触れる時代になりました。差が出るのは、何を語るかを決める企画と、最後まで見られる形に整えるディレクションです。価値の中心は今も人間側にあります。',
  },
} as const;

// ------------------------------------------------------------
// 思想
// ------------------------------------------------------------
export const PHILOSOPHY = {
  en: 'Core Philosophy',
  headline: 'Technology changes.\nWhat moves people does not.',
  body: [
    '技術が変わっても、人を惹きつける物語、美しさ、ユーモア、驚き、感情は変わりません。',
    'CORE Studioは、新しい技術を使って、人の心に残るものをつくります。手段が新しいことは、価値ではありません。',
  ],
  closing: 'いつの時代も、変わらない核を。',
} as const;

// ------------------------------------------------------------
// 最終CTA
// ------------------------------------------------------------
export const FILM_CTA = {
  title: 'まだ存在しない映像を、\n一緒につくろう。',
  body: '「こんな映像は作れますか」という段階からご相談いただけます。用途が決まっていなくても構いません。',
  tags: ['AI Short Drama', 'Brand Film', 'SNS Creative', 'Commercial'],
  button: '制作について相談する',
} as const;

// ------------------------------------------------------------
// 相談フォームの選択肢 (4問・短く保つ)
// ------------------------------------------------------------
export type InquiryField = { id: 'purpose' | 'volume' | 'budget' | 'timeline'; question: string; options: string[] };

export const INQUIRY_FIELDS: InquiryField[] = [
  { id: 'purpose', question: '何のための映像ですか', options: ['ショートドラマ (人物ブランディング)', 'ブランドムービー', 'SNSの継続発信', '商品・サービスの広告', 'まだ決まっていない'] },
  { id: 'volume', question: 'ご希望の本数', options: ['まず1本', '数本まとめて', '毎月継続したい', '相談したい'] },
  { id: 'budget', question: 'ご予算の目安', options: ['〜10万円', '〜30万円', '〜50万円', '月額で50万円以上', '未定'] },
  { id: 'timeline', question: 'ご希望の納期', options: ['2週間以内', '1ヶ月以内', '急がない', '未定'] },
];
