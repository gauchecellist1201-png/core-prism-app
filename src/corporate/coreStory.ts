// ============================================================
// coreStory — CORE WEB 2035（2026-09-06）の言葉の正本。
//
//   ホームの9幕（理念→AIの時代→AI Transformation→ONE CORE→Studio→地域へ→ASHITAKA→ENERGY→
//   つながり→2035→証明→代表→招待）と、/ashitaka・/energy の本編で使う文言をここに置く。
//   理念そのもの（社是・核とは、人・3つの約束）は creedData.ts が正本。ここでは重複させない。
//
//   守ること:
//     ・構想を実績として書かない。status の語（NOW / ENGINE / NEXT / FUTURE、提供中／準備中／長期）は
//       03_FACT_EVIDENCE_MAP（Obsidian CORE_WEB_2035）の判定と必ず一致させる。
//     ・売上目標・自治体名・提携先・効果保証は書かない。
//     ・ASHITAKA はスタジオジブリの公式事業ではない。図像・キャラクター・提携を示唆しない。
//     ・コンポーネントに文言を直書きしない。増やすときはここへ。
// ============================================================

export type LayerStatus = 'NOW' | 'ENGINE' | 'NEXT' | 'FUTURE';

/** 状態ラベルの日本語。構想と実績を混ぜないための語彙。 */
export const STATUS_LABEL: Record<LayerStatus, string> = {
  NOW: '提供中',
  ENGINE: '提供中',
  NEXT: '構想・準備中',
  FUTURE: '長期領域',
};

export const HERO = {
  kicker: 'AI Transformation Company — Kobe, Japan',
  /** 社是の直下に置く「何の会社か」の一行。10秒で社是と両方が残るように。 */
  line: 'AI前提で、企業・地域・社会の仕組みを再設計する。',
  primary: 'ROAIを無料診断する',
  secondary: '未来の仕組みを、一緒につくる',
} as const;

export const CHANGE = {
  kicker: 'The AI Era',
  h2: '技術は変わる。\n本質は変わらない。',
  lead: 'AIは、社会の土台を書き換えます。だからこそ私たちは、変わらないもののために、いちばん新しい技術を使い切ります。',
  changing: ['インターフェース', 'ソフトウェア', '産業の構造', 'エネルギーの仕組み', '働き方'],
  constant: ['人の役に立つこと', '本物の価値を生むこと', '人の心を動かすこと', '地域を強くすること', '次の世代に、より良い未来を残すこと'],
  changingLabel: '変わるもの',
  constantLabel: '変わらないもの',
} as const;

export const PROCESS = {
  kicker: 'AI Transformation',
  h2: 'AIから考えない。\n経営成果から逆算する。',
  lead: 'AI導入は目的ではありません。成果が目的です。COREは技術の前に経営を語り、AIが返した売上・時間・コスト・リスク・新しい価値を、Return on AI として測ります。',
  genericLabel: '一般的なAI導入',
  generic: ['AIツール', '導入', '終了'],
  coreLabel: 'COREの順序',
  core: ['経営目標', '業務の再設計', 'システム設計', 'AI', '実装', '運用', '計測', 'ROAI'],
} as const;

export const ONE_CORE = {
  kicker: 'One CORE — Four Layers',
  h2: '四つの事業ではなく、\n一つの変革。',
  lead: 'COREの事業は、同じ思想を、社会の異なる層で実行したものです。企業から地域へ、地域からエネルギーへ。変革は、境界で止まりません。',
  layers: [
    { no: '01', en: 'AI TRANSFORMATION', ja: '企業を、変える。', status: 'NOW' as LayerStatus, body: 'AI前提で会社を再設計し、投資をROAIで測る。COREの現在の中心です。', href: '#services' },
    { no: '02', en: 'CORE STUDIO', ja: '変革を、伝える。', status: 'ENGINE' as LayerStatus, body: '戦略と変革を、映像・ブランド・物語にする、COREの伝える層です。', href: '#studio' },
    { no: '03', en: 'ASHITAKA PROJECT', ja: '地域を、変える。', status: 'NEXT' as LayerStatus, body: '音楽を入口に、町の未来をつくる。文化主導の地域変革です。', href: '/ashitaka' },
    { no: '04', en: 'CORE ENERGY', ja: '社会を、支える。', status: 'FUTURE' as LayerStatus, body: 'AIの時代はエネルギーの時代。地域の資源と知性をつなぎます。', href: '/energy' },
  ],
} as const;

export const STUDIO = {
  kicker: 'CORE Studio — The Media Engine',
  h2: '変革を、物語にする。',
  lead: '戦略は、伝わって初めて動きます。CORE Studioは、企業の変革、地域の一日、新しい事業を、映像・ブランド・SNS・デジタル体験へ変える、COREの伝える層です。',
  supports: ['企業変革の社内外コミュニケーション', 'ASHITAKA PROJECTの一日を、全国の注目へ', '地域と新規事業のブランド', 'CORE自身（このサイトのブランドフィルム）'],
  cta: 'CORE Studioを見る',
  href: '/studio',
} as const;

export const BRIDGE = {
  kicker: 'Beyond the Company',
  h2: '変革は、会社の境界で\n止まらない。',
  lead: '会社が変わると、そこで働く人の一日が変わります。人の一日が変わると、町が変わり始めます。COREの次の一歩は、地域です。',
} as const;

export const ASHITAKA = {
  kicker: 'ASHITAKA PROJECT — Culture-Led Regional Transformation',
  h2: '音楽を入口に、\n町の未来をつくる。',
  principle: '音楽は、入口。変革が、本業。',
  lead: '一台のチェロが、森で、湖のほとりで、古い村の中で鳴る。その日、町の子どもも、職人も、農家も、宿も、役場も、同じ時間を分け合う。ASHITAKA PROJECTは、その一日を、地域変革の入口にします。',
  /** 音楽から長期の地域価値までの道筋（ホームは8段、本編は13段） */
  chain: ['音楽', '人', '注目', '関係人口', '地域ブランド', 'AI・DX', '産業', 'エネルギー'],
  chainFull: ['音楽', '感情', '人', '動き', '注目', 'メディア', '観光', '関係人口', '地域ブランド', 'AI・DX', '地域産業', 'エネルギー', '長期の地域価値'],
  oneRegion: {
    en: 'ONE REGION, ONE STORY',
    ja: '一つの地域に、|一つの物語。',
    body: '全国一律のツアーにはしません。景色も、人も、歴史も、神話も、産業も、課題も、土地ごとに違う。その土地にすでにある物語を見つけ、大きくする。',
  },
  /** いまの段階（正直に）。文言は 03_FACT_EVIDENCE_MAP と一致させる。 */
  status: {
    label: 'いまの段階',
    body: '構想と準備の段階です。実施地域・自治体・提携先はまだありません。代表がチェリストとして自然の中で演奏し映像にしてきたこと、企業のAI変革を本業にしていることが、この構想の土台です。',
  },
  ctaPrimary: 'ASHITAKA PROJECTを詳しく',
  ctaSecondary: '地域について相談する',
} as const;

export const ASHITAKA_PAGE = {
  title: 'ASHITAKA PROJECT — 音楽を入口に、町の未来をつくる',
  experience: {
    kicker: 'One Day',
    h2: 'その一日を、\n町のすべてが分け合う。',
    scenes: ['森の中のチェロ', '湖のほとりのコンサート', '古い村の中の音楽', '町の子どもたちの参加', '地元の職人・農家・飲食店・宿', '学校・住民・首長・来訪者'],
    then: 'CORE Studioがその一日を映像にし、映像が全国の注目を集める。注目が来訪になり、来訪が関係になり、関係が経済活動になる。そこから、COREは町の構造的な課題——観光、自治体の業務、地元企業、データ、産業、エネルギー——に向き合います。',
  },
  offer: {
    kicker: 'For Municipalities',
    h2: '自治体・地域に、\nいま提供できること。',
    now: [
      { t: '対話と構想設計', b: '地域の物語・資源・課題を代表が直接伺い、ONE REGION, ONE STORY の設計を一緒につくる。' },
      { t: '文化の一日の企画', b: '演奏・映像・地域参加を一体にした「一日」の企画。代表がチェリストとして演奏する。' },
      { t: '映像と発信', b: 'CORE Studioによる映像化と発信設計。' },
      { t: '地域のAI・DX', b: '自治体業務・観光・地元企業のAI変革（本業のAI Transformationをそのまま持ち込む）。' },
    ],
    next: ['関係人口・来訪の計測設計', '地域データの基盤', '地域産業のAI化', 'エネルギー（CORE Energy と接続）'],
  },
  faq: [
    { q: 'スタジオジブリとの関係はありますか。', a: 'ありません。ASHITAKA PROJECTは株式会社COREの独自の構想で、スタジオジブリの公式事業・後援・提携ではありません。作品の図像やキャラクターは使用しません。' },
    { q: 'コンサート事業ですか。', a: '違います。音楽は入口で、本業は地域の変革です。一日の文化的な出来事を起点に、注目・来訪・関係人口をつくり、その先で自治体業務・地元産業・データ・エネルギーの構造課題に取り組みます。' },
    { q: '費用と規模は。', a: '地域の規模と物語によって設計するため、一律の料金はありません。対話から始めます。' },
    { q: 'すでに実施した地域はありますか。', a: 'まだありません。構想と準備の段階であることを、正直にお伝えします。最初の一つの地域を、一緒につくる相手を探しています。' },
  ],
  cta: { h2: '最初の一つの地域を、\n一緒に|つくりませんか。', primary: '地域について相談する' },
} as const;

export const ENERGY = {
  kicker: 'CORE Energy — AI × Energy × Region',
  h2: 'AIの時代は、\nエネルギーの|時代でもある。',
  lead: 'AIは、純粋にデジタルなものではありません。計算資源も、データセンターも、ロボットも、AIが動かす産業も、すべて電力の上に立っています。知性は、最後にはエネルギーに依存する。',
  region: '一方で、日本の地域には、森・川・土地・地熱・太陽・風・バイオマスという、使われていない資源があります。COREは、AI・エネルギー・地域変革の交点を、長期の事業領域として設計します。',
  stages: [
    { when: 'NOW', en: 'ENERGY INTELLIGENCE', ja: '調査・戦略・設計から', body: '地域と企業のエネルギーの現状を、AIで読み、設計する。' },
    { when: 'NEXT', en: 'AI ENERGY OPTIMIZATION', ja: '最適化と地域プロジェクト', body: '需要と供給の最適化。企業・自治体と組むエネルギープロジェクト。' },
    { when: 'FUTURE', en: 'PARTNERSHIP & PARTICIPATION', ja: '提携と、選択的な参画', body: '共同事業・インフラ提携。長期では、選択的なインフラへの参画。' },
  ],
  fields: ['Energy Intelligence', 'AIによるエネルギー最適化', '分散型エネルギーの管理', '蓄電・マイクログリッド', '再生可能エネルギーの統合', '地域データセンター・AI計算基盤', '強靭なインフラ'],
  honest: {
    label: 'いまの段階',
    body: 'COREは現在、電力事業者でも、インフラの所有者でもありません。資産を持たず、知性と設計から始めます。構想と現在の能力を、分けてお伝えします。',
  },
  ctaPrimary: 'CORE Energyを詳しく',
  ctaSecondary: 'Energyについて話す',
} as const;

export const ENERGY_PAGE = {
  title: 'CORE ENERGY — AIの時代は、エネルギーの時代でもある',
  logic: {
    kicker: 'The Thesis',
    h2: '知性は、\nエネルギーに依存する。',
    lines: ['計算には、電力が要る。', 'データセンターには、電力が要る。', 'ロボットには、電力が要る。', 'AIが動かす産業には、電力が要る。'],
    body: 'だからAIの時代の変革は、ソフトウェアの中で完結しません。企業の変革は地域に届き、地域の変革はエネルギーとインフラに届く。COREはその順序を、最初から設計に入れています。',
  },
  intersection: {
    kicker: 'The Intersection',
    h2: 'AI × エネルギー × 地域。',
    body: 'ASHITAKA PROJECTで築く地域との関係と、AI Transformationで培う設計・計測の力が、エネルギーの領域で一つになります。地域の資源を、AIで最も賢く使う。それが、COREが目指す交点です。',
    chain: ['地域', '資源', 'エネルギー', 'インフラ'],
  },
  cta: { h2: 'AI・地域・|エネルギーの交点を、\n一緒に設計しませんか。', primary: 'Energyについて話す' },
} as const;

export const CONNECTION = {
  kicker: 'The CORE Connection',
  lines: ['AIは、知性を変える。', '文化は、人を動かす。', 'エネルギーは、社会を支える。'],
  answer: 'COREは、そのつながりを設計する。',
  lead: 'これらは別々の事業ではありません。同じ変革の、異なる層です。',
  layers: [
    { en: 'ENTERPRISE', ja: '企業' },
    { en: 'REGION', ja: '地域' },
    { en: 'ENERGY', ja: 'エネルギー' },
    { en: 'INFRASTRUCTURE', ja: '社会基盤' },
  ],
} as const;

export const VISION = {
  kicker: 'CORE 2035',
  h2: '社会を支える仕組みの、\nより深い層へ。',
  lead: 'COREはこれからの5〜10年を、企業から地域へ、地域からエネルギーとインフラへと、社会を支える仕組みのより深い層へ進むために使います。野心は大きく、言葉は正確に。',
  timeline: [
    { when: 'NOW', en: 'ENTERPRISE TRANSFORMATION', ja: '企業の変革', body: 'AI Transformation・Return on AI・NERI。いま提供しているもの。' },
    { when: 'NEXT', en: 'REGIONAL TRANSFORMATION', ja: '地域の変革', body: 'ASHITAKA PROJECT・地域のAI/DX。構想と準備の段階。' },
    { when: 'FUTURE', en: 'ENERGY / INFRASTRUCTURE', ja: 'エネルギーと社会基盤', body: 'AI×エネルギー×地域の基盤。長期の事業領域。' },
  ],
  stance: '私たちは、いまどこにいるかを知っています。どこへ行くかも、その順番も。',
} as const;

export const FOUNDER = {
  kicker: 'Founder',
  h2: '論理と、感情。\n技術と、人。',
  intro: '代表の井出直毅は、AI企業の経営者であり、チェリスト GAUCHE として舞台に立ってきました。',
  thesis: '技術だけでは、人は動きません。感情だけでは、仕組みは変わりません。COREは、その両方を一つの会社の中に置いています。',
  /** 軌跡。年齢・年・学歴は書かない（資料間で揺れがあり、卒業ではないため。03_FACT_EVIDENCE_MAP G）。 */
  track: [
    'チェリスト GAUCHE として国内外で演奏し、自然の中での演奏映像を発表してきた。',
    '地域とテクノロジーの接点で働いてきた（地方都市のブロックチェーン都市構想、離島での技術実装）。',
    'メディア事業と貿易会社を起業し、それぞれ売却。',
    '神戸でチェロ教室を運営しながら、株式会社COREを創業。',
  ],
  story: [
    '私は神戸で、チェロを教えています。生徒が一曲を弾き切った日の顔は、どんな技術にも代えられません。けれど、その教室の裏では、予定の調整や請求書や連絡に、弾く時間より長い時間を使っていました。その時間を返してくれたのが、AIでした。',
    '音楽は、人の手でしか届かない。けれど、その手を空けるためにこそ、技術はある。AIが賢くなるほど、人の温度が価値になる。そう信じて、この会社をつくりました。',
    '最新の技術を、いちばん古い理由のために使い切る。それが、私たちの仕事です。',
  ],
} as const;

export const INVITE = {
  kicker: 'Let’s build it together',
  h2: '未来の仕組みを、\n一緒につくる。',
  lead: '初回のご相談に費用はいただきません。まず、あなたが変えたいものを一つ教えてください。',
  intents: [
    { id: 'transform', label: '企業を変えたい', sub: 'AI Transformation・ROAI', interest: 'AI導入' },
    { id: 'region', label: '地域を変えたい', sub: 'ASHITAKA PROJECT・自治体', interest: '地域・自治体（Ashitaka）' },
    { id: 'partner', label: 'COREと協業したい', sub: 'エネルギー・新規事業・提携', interest: 'パートナー提携' },
  ],
  quiet: [
    { id: 'venture', label: '新しい事業をつくりたい', interest: '新規事業' },
    { id: 'ashitaka', label: 'Ashitakaについて相談したい', interest: '地域・自治体（Ashitaka）' },
    { id: 'energy', label: 'Energyについて話したい', interest: 'エネルギー' },
  ],
} as const;
