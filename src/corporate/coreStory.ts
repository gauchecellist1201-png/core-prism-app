// ============================================================
// coreStory — CORE WEB 2035（2026-09-06）の言葉の正本。
//
//   ホームの9幕（理念→AIの時代→AI Transformation→ONE CORE→Studio→NERI→地域へ→ASHITAKA→ENERGY→
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
  kicker: 'AI Company OS Company — Kobe, Japan',
  /** 社是の直下に置く「何の会社か」の一行。10秒で社是と両方が残るように。 */
  line: 'AI前提で、会社そのものを再設計する。御社専用のAI Company OSを。',
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
    { no: '03', en: 'ASHITAKA PROJECT / REGIONAL OS', ja: '地域を、変える。', status: 'NEXT' as LayerStatus, body: '文化で接点をつくる ASHITAKA PROJECT と、自治体・地域事業者の業務を再設計する REGIONAL OS。到達点は、街と村のDXです。', href: '/ashitaka' },
    { no: '04', en: 'CORE ENERGY', ja: '社会を、支える。', status: 'FUTURE' as LayerStatus, body: 'AIの電力需要に、地域の分散資源で応える。エネルギー事業者との協業領域です。', href: '/energy' },
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

/**
 * NERI — 変わったあとの毎日を動かす層（2026-09-06 オーナー判断でホームへ）。
 *
 * なぜホームに要るか:
 *   会社の営業設計は「映像で接点をつくり（Studio）→ NERI で業務に入り → CORE が会社を変える」。
 *   ところがホームの本文19章で NERI に触れているのは 2035 年表の1語だけで、
 *   物語の真ん中が抜けていた（製品カードは #products タブの中にしかなかった）。
 *   Studio の章の直後・BRIDGE（地域へ）の前に置く。CORE Studio 側の NeriHandoff と対になる。
 *
 * 守ること:
 *   ・金額はここに書かない。coreLinks.ts の NERI_FACTS からだけ引く（LP の料金表が正本）。
 *   ・4層（ONE_CORE）に5つ目として足さない。NERI は層ではなく、層の上で毎日を動かす製品。
 *   ・構想ではなく提供中。ここは実績として書いてよい数少ない章（自社開発・本番稼働中）。
 */
export const NERI = {
  kicker: 'CORE NERI — The Operating Layer',
  h2: '変わったあとの毎日を、\n動かし続ける。',
  lead: '設計しても、映像をつくっても、翌朝からの仕事は誰かの手元に残ります。増えた分は、たいてい社長自身に戻ってきます。CORE NERIは、その毎日に入る層です。当社が開発し、運営している、経営者のためのAIです。',
  points: [
    '答えるAIではなく、聞いたことをその場で仕事にします',
    '会社だけでなく、相手の人を理解します。約束・いま必要なこと・決め方・連絡の好みを、根拠つきで覚えます',
    '送信や決済など、外へ出る操作の前には必ず確認を挟みます',
  ],
  /** 受託（AI Transformation）との関係。置き換えではないことを先に言う。 */
  note: '大きな変革の前でも、あとでも置けます。1つの業務から始めて、変わったかどうかを測るところまでを、同じ入口で。使うほど説明が減る。それが、会社を理解するAIから、人を理解するAIへの一歩です。',
  cta: 'CORE NERI を見る',
} as const;

export const BRIDGE = {
  kicker: 'Beyond the Company',
  h2: '変革は、会社の境界で\n止まらない。',
  lead: '会社が変わると、そこで働く人の一日が変わります。人の一日が変わると、町が変わり始めます。COREの次の一歩は、地域です。',
} as const;

export const ASHITAKA = {
  kicker: 'ASHITAKA PROJECT × REGIONAL OS',
  h2: '文化を入口に、\n地域の運営基盤を|再設計する。',
  principle: '入口は音楽。到達点は、街と村のDX。',
  lead: '株式会社COREは、地域変革を二つの固有名で分けて設計しています。文化による接点づくりを担う ASHITAKA PROJECT と、自治体・地域事業者の業務をAI前提で再設計する REGIONAL OS。前者が人と注目を集め、後者が地域の運営そのものを変えます。',
  /** 音楽から地域の運営基盤までの道筋（ホームは8段）。本編は ASHITAKA_PAGE.handoff の2区間で見せる。 */
  chain: ['音楽', '注目', '来訪', '関係人口', '自治体業務', '地域事業者', '地域データ', 'エネルギー'],
  oneRegion: {
    en: 'ONE REGION, ONE STORY',
    ja: '一つの地域に、|一つの物語。',
    body: '全国一律のツアーやパッケージは行いません。地形、歴史、産業、人口構成、行政課題は地域ごとに異なります。その地域に既にある物語と資源を起点に、接点の設計から運営基盤の設計までを、一地域ごとに組み立てます。',
  },
  /** いまの段階（正直に）。文言は 03_FACT_EVIDENCE_MAP と一致させる。 */
  status: {
    label: 'いまの段階',
    body: 'いずれも構想と準備の段階です。ASHITAKA PROJECTは最初の地域で演奏と映像の制作から準備を進めており、自治体との正式な協定や、この構想としての実施実績はまだありません。REGIONAL OSは設計段階です。自治体業務・観光・地域事業者へのAI導入そのものは、当社の本業であるAI Transformationとして現在も個別に提供しています。',
  },
  ctaPrimary: 'ASHITAKA PROJECT と REGIONAL OS を詳しく',
  ctaSecondary: '地域について相談する',
} as const;

/** /ashitaka 本編。ASHITAKA PROJECT（入口）と REGIONAL OS（到達点）を分けて記述する。固有名詞は両方英語表記。 */
export const ASHITAKA_PAGE = {
  title: 'ASHITAKA PROJECT × REGIONAL OS — 文化を入口に、街と村のDXへ',
  /** 二つの固有名。同じ地域変革の、入口と到達点。 */
  entities: {
    kicker: 'Two Names, One Transformation',
    h2: '入口と到達点を、\n分けて設計する。',
    lead: '音楽で人を集めることと、地域の運営を変えることは、必要な能力も、関係者も、時間軸も異なります。だから当社は、この二つを別の固有名で定義し、それぞれを独立して導入できる形にしています。',
    items: [
      {
        id: 'ashitaka', en: 'ASHITAKA PROJECT', role: 'ENTRY', roleJa: '接点をつくる',
        ja: '文化で、人と注目を集める。',
        body: '代表がチェリストとして地域の景観の中で演奏する一日を、CORE Studioが映像化し、全国へ発信します。注目を来訪に、来訪を関係人口に変える、地域変革の入口です。',
        points: ['演奏と映像の制作（代表自身が演奏）', '地域参加の設計（学校・事業者・住民）', '発信と、到達・来訪の計測'],
      },
      {
        id: 'regional-os', en: 'REGIONAL OS', role: 'DESTINATION', roleJa: '運営を変える',
        ja: '街と村の運営を、AI前提で再設計する。',
        body: '自治体の内部業務、住民・来訪者対応、地域事業者の業務、地域データの基盤を、一つの運営層として設計します。企業向けAI Transformationの手順を、そのまま地域に適用します。',
        points: ['自治体業務と住民対応のAI化', '地域事業者のDX（宿・飲食・農林・工房）', '地域データ基盤と、施策の計測'],
      },
    ],
  },
  /** 2区間の道筋。ASHITAKA PROJECT が集め、REGIONAL OS が変える。 */
  handoff: {
    kicker: 'The Handoff',
    h2: '一日の音楽が、\n運営基盤に引き渡されるまで。',
    lead: '入口で得るのは、注目と来訪と関係だけではありません。当日に把握した地域の課題と関係者が、そのまま運営基盤の設計に引き渡されます。',
    ashitaka: ['演奏の一日', '映像・発信', '注目', '来訪', '関係人口', '地域ブランド'],
    regionalOs: ['自治体業務', '地域事業者', '観光・来訪データ', '地域データ基盤', '地域産業', 'エネルギー'],
  },
  /** 演奏者。代表取締役本人が演奏する、という構造が他社との差。事実は演奏資料（本人）に基づく。年齢・学歴は書かない。 */
  performer: {
    kicker: 'The Performer',
    h2: '演奏者は、\n代表取締役。',
    lead: 'ASHITAKA PROJECTで演奏するのは、外部のアーティストではありません。株式会社CORE 代表取締役の井出直毅が、チェリスト GAUCHE として演奏します。演奏の日に地域で得た関係と課題を、そのままREGIONAL OSの設計に持ち込めることが、他社にない構造です。',
    name: 'GAUCHE',
    nameJa: '井出 直毅',
    title: '株式会社CORE 代表取締役 ／ チェリスト',
    /** 仕様書の体裁で書く（AIの会社が演奏者を記述する、という切り口）。 */
    spec: [
      { k: 'INSTRUMENT', v: 'チェロ（無伴奏ソロ）' },
      { k: 'REPERTOIRE', v: 'クラシック／映画音楽／ラテン／ポップス／ロック／ジャズ' },
      { k: 'FORMAT', v: '自然環境での野外演奏／ホール／ホテル・レセプション' },
      { k: 'FIELD RECORDINGS', v: '海上（GAUCHE plays in the SEA）／高原（GAUCHE plays on the PLATEAU）' },
      { k: 'ROLE IN PROJECT', v: '演奏と映像制作の当事者であり、REGIONAL OS の設計責任者' },
    ],
    /** 標準調弦（A=440Hz）。演奏者の「計器」として描く。 */
    strings: [
      { n: 'C', hz: 65.41 },
      { n: 'G', hz: 98.0 },
      { n: 'D', hz: 146.83 },
      { n: 'A', hz: 220.0 },
    ],
    stringsLabel: 'STANDARD TUNING — A = 440 Hz',
    venues: {
      label: '演奏実績（抜粋）',
      domestic: ['リッツ・カールトン', 'エクシブ', 'リーガロイヤル', 'アルカイックホール'],
      overseas: ['Loro Piana（イタリア）', 'New York Café（ハンガリー）', 'ドバイ'],
    },
    fields: [
      { id: 'sea', en: 'SEA', ja: '海の上で', img: '/corp/ashitaka-sea-play.webp', w: 1280, h: 720, cap: '海上での無伴奏演奏。実写映像からの静止画。' },
      { id: 'plateau', en: 'PLATEAU', ja: '高原で', img: '/corp/ashitaka-plateau.webp', w: 1280, h: 572, cap: '高原でのライブ演奏。実写映像からの静止画。' },
    ],
  },
  /** 一日を、興行ではなく工程として設計する。 */
  day: {
    kicker: 'The Day — Program',
    h2: '一日を、\n工程として設計する。',
    lead: '演奏の一日は興行ではなく、地域変革の最初の工程です。事前協議から計測までを一つの計画として組み、次の工程であるREGIONAL OSへ引き渡します。',
    steps: [
      { t: '事前協議', b: '自治体・地元事業者・地権者との調整、演奏と撮影場所の選定、許認可の確認。' },
      { t: '演奏と撮影', b: '森、湖畔、海岸、集落など、その地域の景観の中で代表が演奏し、CORE Studioが撮影します。' },
      { t: '地域参加', b: '学校・住民・職人・農家・宿・飲食店の参加を設計し、当日の体験を地域自身のものにします。' },
      { t: '発信', b: '映像・SNS・メディアで全国へ届け、来訪と注目の起点をつくります。' },
      { t: '計測', b: '到達・来訪・滞在・関係人口を計測し、効果を数値で関係者に共有します。' },
      { t: '引き渡し', b: '当日に把握した地域の課題と関係を、REGIONAL OSの設計へ引き渡します。' },
    ],
  },
  regionalOs: {
    kicker: 'REGIONAL OS — The Operating Layer for Towns and Villages',
    h2: '街と村の運営を、\nAI前提で再設計する。',
    lead: 'REGIONAL OSは、自治体と地域事業者の業務を一つの運営層として捉え直し、AI前提で再設計する取り組みです。個別ツールの導入ではなく、住民対応・内部業務・地域事業者・データ基盤を、業務単位で段階的に統合します。',
    layers: [
      { en: 'INTERFACE', ja: '住民・来訪者との接点', body: '問い合わせのAI一次対応、多言語案内、手続きの案内。窓口と電話の負荷を下げます。' },
      { en: 'OPERATIONS', ja: '自治体と事業者の業務', body: '文書作成、議事録、申請処理、予約・在庫・発信。役場と、宿・飲食・農林・工房の日常業務をAIで再設計します。' },
      { en: 'DATA', ja: '地域データ基盤', body: '来訪・滞在・人口・産業のデータを統合し、施策の効果を数値で判断できる状態にします。' },
      { en: 'INFRASTRUCTURE', ja: '産業とエネルギー', body: '地域産業のAI化と、CORE Energyによるエネルギー領域への接続。長期の運営基盤です。' },
    ],
    processLead: '進め方は、企業向けAI Transformationと同じ手順です。ツールから考えず、地域の運営目標から逆算します。',
    process: ['運営目標', '業務の再設計', 'システム設計', 'AI', '実装', '運用', '計測', 'ROAI'],
    status: {
      label: 'REGIONAL OS のいまの段階',
      body: '統合された運営基盤としてのREGIONAL OSは設計段階です。一方で、自治体業務・観光・地域事業者へのAI導入は、当社の本業であるAI Transformationとして現在も個別に提供しています。構想と提供中のものを分けてお伝えします。',
    },
  },
  offer: {
    kicker: 'For Municipalities and Regional Partners',
    h2: '自治体・地域事業者へ、\nいま提供できること。',
    now: [
      { t: '構想設計と合意形成の支援', b: '地域の資源・課題・関係者を整理し、ASHITAKA PROJECTとREGIONAL OSの導入計画を一緒に設計します。首長・議会・住民への説明資料も作成します。' },
      { t: '演奏・映像・発信の一日', b: '代表が演奏し、CORE Studioが撮影・編集・発信までを担います。地域参加の設計を含みます。' },
      { t: '自治体業務・地域事業者のAI導入', b: '窓口対応、文書業務、観光案内、予約・発信など、個別の業務から段階的にAI化します。' },
      { t: '効果の計測と報告', b: '到達・来訪・関係人口・業務時間の変化を計測し、議会や住民に説明できる形で報告します。' },
    ],
    next: ['地域データ基盤の構築', '地域産業のAI化', 'エネルギー領域への接続（CORE Energy）', '複数地域での運用モデルの標準化'],
    terms: [
      { k: '契約形態', v: '自治体・DMO・地域事業者との個別契約。実証事業、委託、共同事業のいずれにも対応します。' },
      { k: '費用の考え方', v: '地域の規模と範囲に応じて設計します。一律料金は設けず、初回の対話と構想整理は無償です。' },
      { k: '体制', v: '代表が演奏と設計の両方を担い、CORE Studioと開発チームが制作と実装を担当します。' },
    ],
  },
  faq: [
    { q: 'ASHITAKA PROJECT と REGIONAL OS の違いは何ですか。', a: 'ASHITAKA PROJECTは文化による接点づくり（入口）、REGIONAL OSは自治体・地域事業者の業務をAI前提で再設計する運営基盤（到達点）です。前者が人と注目を集め、後者が地域の運営を変えます。別々に導入することも可能です。' },
    { q: 'スタジオジブリとの関係はありますか。', a: 'ありません。ASHITAKA PROJECTは株式会社COREの独自の構想で、スタジオジブリの公式事業・後援・提携ではありません。作品の図像やキャラクターは使用しません。' },
    { q: 'コンサート事業ですか。', a: 'いいえ。演奏は地域変革の最初の工程であり、興行として収益を上げることを目的にしていません。到達点は、自治体業務と地域事業者の業務のDXです。' },
    { q: 'REGIONAL OS はパッケージ製品ですか。', a: 'いいえ。地域ごとに運営目標から設計する取り組みです。既存の自治体システムを置き換えるのではなく、業務単位で段階的にAIを組み込みます。' },
    { q: '費用と規模は。', a: '地域の規模と範囲に応じて設計するため、一律の料金はありません。初回の対話と構想整理は無償です。' },
    { q: 'すでに実施した地域はありますか。', a: 'この構想としての実施実績はまだありません。最初の地域で、演奏と映像の制作から準備を進めている段階です。自治体との正式な協定はまだなく、地域名は関係者の了承を得てから公開します。' },
  ],
  cta: { h2: '最初の一つの地域を、\n一緒に|設計しませんか。', primary: '地域について相談する' },
} as const;

export const ENERGY = {
  kicker: 'CORE Energy — AI × Energy × Regional Infrastructure',
  h2: 'AIの電力需要に、\n地域の分散資源で|応える。',
  lead: 'AIの普及は、計算基盤・データセンター・ロボティクスを通じて、電力需要と系統の制約を押し上げます。株式会社COREは、需要側の最適化、地域の分散型資源、自治体との合意形成を、AIと設計の力で一つにつなぐ協業パートナーを目指します。',
  region: '日本の地域には、森林・水・土地・地熱・太陽・風・バイオマスといった資源が、事業化されないまま残っています。当社はASHITAKA PROJECTとREGIONAL OSで築く地域との関係を、エネルギー事業者との協業に接続します。',
  stages: [
    { when: 'NOW', en: 'ENERGY INTELLIGENCE', ja: '調査・戦略・設計', body: '需要・設備・地域資源のデータ解析、AI活用の設計、事業性評価の支援。現在提供できる範囲です。' },
    { when: 'NEXT', en: 'AI OPTIMIZATION & REGIONAL PROJECTS', ja: '最適化と地域プロジェクト', body: '需要予測・需給最適化・デマンドレスポンスやVPP向けのAI設計と、自治体・地域事業者を含むプロジェクトの組成。' },
    { when: 'FUTURE', en: 'PARTNERSHIP & PARTICIPATION', ja: '提携と、選択的な参画', body: '共同事業・インフラ提携。長期では、選択的なインフラへの参画を検討します。' },
  ],
  fields: ['Energy Intelligence', '需要予測・需給最適化', 'デマンドレスポンス・VPP', '分散型エネルギーの管理', '蓄電・マイクログリッド', '再生可能エネルギーの統合', '設備保全のAI化', '地域データセンター・AI計算基盤', '強靭なインフラ'],
  honest: {
    label: 'いまの段階',
    body: '株式会社COREは現在、電力事業者でも、発電・送配電設備の所有者でもありません。資産を持たず、AI・データ解析・設計・地域との合意形成から始めます。構想と、現在の提供範囲を分けてお伝えします。',
  },
  ctaPrimary: 'CORE Energyを詳しく',
  ctaSecondary: 'エネルギー領域の協業を相談する',
} as const;

export const ENERGY_PAGE = {
  title: 'CORE ENERGY — AIの電力需要に、地域の分散資源で応える',
  logic: {
    kicker: 'The Thesis',
    h2: '知性は、\nエネルギーに依存する。',
    lines: ['計算基盤には、電力が要る。', 'データセンターには、電力が要る。', 'ロボティクスには、電力が要る。', 'AIが動かす産業には、電力が要る。'],
    body: 'したがって、AI時代の変革はソフトウェアの中で完結しません。企業の変革は地域に届き、地域の変革はエネルギーとインフラに届きます。当社はこの順序を、事業設計の前提に置いています。',
  },
  offering: {
    kicker: 'What We Provide',
    h2: 'エネルギー事業者と、\nいま取り組めること。',
    lead: '現在の提供範囲は、AI・データ解析・設計と、地域との合意形成です。設備や資産を持たない分、事業者の技術・資本と組み合わせることを前提に設計しています。',
    items: [
      { t: 'Energy Intelligence', b: '需要・設備・地域資源のデータ解析と可視化。AI活用テーマの特定、事業性評価の支援。' },
      { t: 'AI最適化の設計と開発', b: '需要予測、需給最適化、デマンドレスポンス・VPP、設備保全のAIモデルと運用システムの設計・開発。' },
      { t: '地域プロジェクトの組成', b: '自治体・地域事業者との合意形成と、地域資源の調査・事業化の検討。ASHITAKA PROJECTとREGIONAL OSで築く関係を活用します。' },
      { t: '計測と改善', b: 'Return on AI の考え方で、AI投資の効果を電力量・コスト・時間・リスクで計測し、改善を続けます。' },
    ],
  },
  partnership: {
    kicker: 'Partnership Models',
    h2: '協業の形。',
    lead: '段階を飛ばしません。限定した範囲の共同検討から始め、実績の上に次の段階を積み上げます。',
    items: [
      { en: 'JOINT STUDY', ja: '共同検討・PoC', body: 'AI活用テーマの特定から実証まで。範囲と期間を限定して開始します。' },
      { en: 'REGIONAL PROJECT', ja: '地域プロジェクトの共同組成', body: '自治体・地域事業者との接点を当社が担い、事業者の技術・資本と組み合わせます。' },
      { en: 'LONG-TERM ALLIANCE', ja: '長期提携', body: '共同事業・インフラ提携。長期では、選択的なインフラへの参画を検討します。' },
    ],
  },
  intersection: {
    kicker: 'The Intersection',
    h2: 'AI × エネルギー × 地域。',
    body: 'ASHITAKA PROJECTとREGIONAL OSで築く地域との関係、AI Transformationで培う設計・計測の能力を、エネルギー領域で一つにします。地域の資源を、AIで最も合理的に使う。当社が目指す交点です。',
    chain: ['地域', '資源', 'エネルギー', 'インフラ'],
  },
  faq: [
    { q: '株式会社COREは電力事業者ですか。', a: 'いいえ。現在、電力事業者でも、発電・送配電設備の所有者でもありません。AI・データ解析・設計・地域との合意形成を提供します。' },
    { q: 'エネルギー事業者と、何から始められますか。', a: 'AI活用テーマの共同検討とPoCからです。需要予測、需給最適化、デマンドレスポンス・VPP、設備保全など、範囲を限定して開始します。' },
    { q: '地域との関係は、どのように築きますか。', a: 'ASHITAKA PROJECT（文化による接点）とREGIONAL OS（自治体・地域事業者のDX）を通じて、自治体・地域事業者との関係と地域データを蓄積します。' },
    { q: '将来、発電や送配電に参入しますか。', a: '長期の選択肢として、共同事業やインフラ提携の中で検討します。現時点で計画や時期を公表しているものはありません。' },
  ],
  cta: { h2: 'AI・地域・|エネルギーの交点を、\n一緒に設計しませんか。', primary: 'エネルギー領域の協業を相談する' },
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
    { when: 'NEXT', en: 'REGIONAL TRANSFORMATION', ja: '地域の変革', body: 'ASHITAKA PROJECT・REGIONAL OS。構想と準備の段階。' },
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
    { id: 'region', label: '地域を変えたい', sub: 'ASHITAKA PROJECT・REGIONAL OS', interest: '地域・自治体（Ashitaka）' },
    { id: 'partner', label: 'COREと協業したい', sub: 'エネルギー・新規事業・提携', interest: 'パートナー提携' },
  ],
  quiet: [
    { id: 'venture', label: '新しい事業をつくりたい', interest: '新規事業' },
    { id: 'ashitaka', label: 'ASHITAKA PROJECT / REGIONAL OS について相談したい', interest: '地域・自治体（Ashitaka）' },
    { id: 'energy', label: 'CORE Energy について相談したい', interest: 'エネルギー' },
  ],
} as const;
