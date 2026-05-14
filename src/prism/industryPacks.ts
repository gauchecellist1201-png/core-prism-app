// ============================================================
// 業界別パッケージ — Industry Packs for CORE Prism
// 7業界 × (KPI 3 / 悩み 5 / 施策 10 / 用語辞書 / 月商規模感)
// AI 呼び出しの先頭に業界 context を必ず注入して、
// 一般論ではなく「その業界の中の人がわかる言葉」で提案する。
// ============================================================

export type IndustryId =
  | 'food'         // 飲食
  | 'beauty'       // 美容
  | 'it'           // IT・SaaS
  | 'realestate'   // 不動産
  | 'ec'           // EC・通販
  | 'medical'      // 医療・クリニック
  | 'education';   // 教育・スクール

export interface RevenueBand {
  /** 小規模 (個人〜数名) の月商目安 */
  small: string;
  /** 中規模 (10名前後) の月商目安 */
  mid: string;
  /** 大規模 (法人化・多店舗) の月商目安 */
  large: string;
  /** 業界の平均的な粗利率 (%) */
  grossMarginPct: number;
}

export interface IndustryPack {
  id: IndustryId;
  label: string;          // 表示名 (やさしい言葉)
  emoji: string;          // ピッカー用アイコン
  shortDescription: string; // 1 行紹介 (オンボーディング表示)
  /** 典型 KPI 3つ — 数字で見て一目で「今この事業のどこが健康か」がわかる指標 */
  kpis: { name: string; unit: string; benchmark: string; why: string }[];
  /** よくある悩み 5つ — オーナーが夜眠れなくなる種類のもの */
  painPoints: string[];
  /** 売上を伸ばす施策 10個 — 今日明日から動ける打ち手 */
  growthPlays: { title: string; detail: string; effort: 'low' | 'mid' | 'high'; impact: 'low' | 'mid' | 'high' }[];
  /** 業界用語辞書 — AI が「シズル」「ABC分析」と言われて困らないように */
  glossary: { term: string; meaning: string }[];
  /** 月商規模感 */
  revenue: RevenueBand;
}

// ============================================================
// 1. 飲食 (food)
// ============================================================
const FOOD: IndustryPack = {
  id: 'food',
  label: '飲食店',
  emoji: '🍽️',
  shortDescription: 'カフェ・居酒屋・レストラン・テイクアウトなど',
  kpis: [
    {
      name: '客単価',
      unit: '円',
      benchmark: 'ランチ¥1,000〜1,500 / ディナー¥3,000〜6,000 / カフェ¥800〜1,200',
      why: '同じ来客数でも客単価¥200違うだけで月の利益が大きく変わる。最重要指標。',
    },
    {
      name: 'FL比率 (食材費+人件費 ÷ 売上)',
      unit: '%',
      benchmark: '55〜60% が健全。65%超は赤信号',
      why: '飲食の利益は FL比率でほぼ決まる。家賃と合わせて70%以内に収める。',
    },
    {
      name: '席稼働率 / 回転率',
      unit: '回 or %',
      benchmark: 'ランチ2.5回転 / ディナー1.5回転 / カフェ1.8回転',
      why: '客単価が低いほど回転率で稼ぐ必要がある。ピーク帯の取りこぼしが致命傷。',
    },
  ],
  painPoints: [
    '人手不足。求人を出してもアルバイトが集まらない / 直前にバックレされる',
    '食材原価の高騰で、値上げしないと利益が出ないが客離れが怖い',
    'ランチは満席なのにディナーが空席だらけ。アイドルタイムの埋め方がわからない',
    'リピーターが定着しない。新規でなんとか回しているが広告費がかさむ',
    '口コミ評価が ★3.5 で止まっている。何を改善すれば ★4 に届くか見えない',
  ],
  growthPlays: [
    { title: 'メニューの ABC 分析で死に筋を整理',         detail: '売上 × 粗利でメニューを4象限に分け、Cランクを廃止・差替え。在庫ロスと調理時間が同時に減る。', effort: 'low', impact: 'high' },
    { title: '看板メニューの「シズル写真」を撮り直す',     detail: '湯気・照り・断面が見える1枚を Google マップとUber Eatsトップに差し替え。CTR が 1.5〜2倍。', effort: 'low', impact: 'mid' },
    { title: 'Google ビジネスプロフィールの返信率を100%に', detail: '★3〜4の口コミに丁寧に返信。MEO 順位が上がり、新規流入が無料で増える。', effort: 'low', impact: 'mid' },
    { title: 'アイドルタイム限定セットを作る',             detail: '14:00〜17:00 限定で「コーヒー+デザート¥800」など。固定費を売上に変える。', effort: 'low', impact: 'mid' },
    { title: 'LINE 公式で再来店クーポンを自動配信',         detail: '初回来店後3日目に「2回目10%OFF」を自動送信。リピート率が15→25%へ。', effort: 'mid', impact: 'high' },
    { title: 'モーニング営業の追加で1時間あたり売上UP',     detail: '物件家賃を朝で割り戻して粗利が出るなら開始。固定客がつきやすい。', effort: 'high', impact: 'mid' },
    { title: 'テイクアウト + Uber Eats / 出前館 二刀流',     detail: '客席を増やさず売上+20〜30%。手数料35%を見越して¥+150〜200の上乗せ価格に。', effort: 'mid', impact: 'high' },
    { title: 'コース料理化で客単価+¥1,000',                 detail: '単品注文 → 3,500円コース誘導。仕込みも楽になり、人件費もコントロールしやすい。', effort: 'mid', impact: 'high' },
    { title: 'Instagram リールで「作り方の裏側」を週1投稿', detail: 'シェフの手元動画は保存率が高い。フォロワー獲得 → 来店動線。', effort: 'mid', impact: 'mid' },
    { title: '法人ランチ・ケータリングを営業',               detail: '近隣オフィスに法人弁当をFAX/メール営業。1社固定客で月¥10万安定。', effort: 'mid', impact: 'high' },
  ],
  glossary: [
    { term: 'FL比率',          meaning: 'Food (食材費) + Labor (人件費) ÷ 売上。飲食経営の健康診断の数字。' },
    { term: 'ABC分析',         meaning: 'メニューを売上順に A/B/C にランク分けし、死に筋を見つける手法。' },
    { term: '回転率',          meaning: '1席が1日何回お客様に使われたか。ランチで2回転超えると優秀。' },
    { term: 'シズル感',        meaning: '湯気・照り・音などで「美味しそう！」と感じさせる演出。写真の出来で売上が変わる。' },
    { term: 'MEO',             meaning: 'Map Engine Optimization。Google マップの検索順位対策。飲食は MEO が SEO より大事。' },
    { term: 'アイドルタイム',  meaning: '14:00〜17:00 などお客様が少ない時間帯。ここを埋められると利益が一気に増える。' },
    { term: 'インバウンド',    meaning: '訪日外国人客。観光地・繁華街では英語/中国語メニューだけで売上が変わる。' },
    { term: 'OMO',             meaning: 'Online Merges Offline。LINE 予約→来店→アプリでポイント、のように店とネットを混ぜる動き。' },
  ],
  revenue: { small: '¥150万〜400万/月', mid: '¥500万〜1,500万/月', large: '¥2,000万〜1億/月 (多店舗)', grossMarginPct: 65 },
};

// ============================================================
// 2. 美容 (beauty)
// ============================================================
const BEAUTY: IndustryPack = {
  id: 'beauty',
  label: '美容 (サロン)',
  emoji: '💇',
  shortDescription: '美容室・ネイル・まつエク・エステ・脱毛など',
  kpis: [
    {
      name: '指名リピート率',
      unit: '%',
      benchmark: '新規→2回目で40%超 / 既存全体で70%超が優秀',
      why: '美容はリピートビジネス。新規広告費は3回来てやっと回収する世界。',
    },
    {
      name: '一人あたり生産性 (技術売上 ÷ スタイリスト数)',
      unit: '万円/月',
      benchmark: '美容師は月100万円が一人前。150万円超は優秀',
      why: '人件費が固定の業態。生産性が低いと赤字、高ければ歩合で離職を防げる。',
    },
    {
      name: '店販比率 (物販売上 ÷ 技術売上)',
      unit: '%',
      benchmark: '10〜15%が標準 / 20%超でかなり優秀',
      why: 'シャンプー・トリートメントは粗利40〜50%。技術売上を増やさず利益だけ伸ばせる。',
    },
  ],
  painPoints: [
    '新人スタイリストがデビュー前に辞めてしまう。教育コストが回収できない',
    'ホットペッパー依存で、掲載費を払えば客が来るが、月¥30万のコストが利益を圧迫',
    '指名客が固定化して、特定スタイリストの予約だけ埋まり他が暇',
    'カラー剤・薬剤の原価が上がっているのに、値上げできず利益率が下がっている',
    '空席が出ると不安で安売り対応してしまい、客単価がじわじわ下がる',
  ],
  growthPlays: [
    { title: '指名固定化キャンペーン',                  detail: '初回客に「同じ担当の2回目で20%OFF」を案内。指名率が上がるとリピート率と単価が両方上がる。', effort: 'low', impact: 'high' },
    { title: '物販レコメンドを来店時カウンセリングに組み込む', detail: '施術中に「お家でやってほしいケア」をシートにして渡す。店販比率が10→20%へ。', effort: 'low', impact: 'high' },
    { title: 'メニュー名を「悩み起点」にリライト',       detail: '「カット+カラー¥9,000」→「白髪を目立たせない大人カラー¥9,000」。ホットペッパーCTR2倍。', effort: 'low', impact: 'mid' },
    { title: 'Instagram で施術ビフォーアフター毎日1枚', detail: 'ハッシュタグは地域名+悩み (#銀座 #くせ毛)。Google 検索よりも Instagram 検索で新規流入。', effort: 'mid', impact: 'mid' },
    { title: '次回予約をその場で取る運用に',             detail: '会計時に「次回いつ来られますか？」と必ず聞く。離脱を半分に減らせる。', effort: 'low', impact: 'high' },
    { title: 'ホットペッパーから自社予約サイトへ移行',     detail: 'STORES予約 / SquareなどでLINE連携。新規はホットペッパー、リピートは自社経由で手数料ゼロに。', effort: 'mid', impact: 'high' },
    { title: 'アシスタント営業日を「練習会」に転換',      detail: '半額モデル募集で技術向上+SNS素材+新規見込みの3得。', effort: 'low', impact: 'mid' },
    { title: '客単価帯を3つに分ける',                    detail: '¥6,000 / ¥10,000 / ¥18,000 と松竹梅。中間帯を選ぶ心理で平均単価+¥1,500。', effort: 'mid', impact: 'high' },
    { title: 'スタイリストごとに「得意領域」を公式に発表', detail: '「縮毛矯正担当」「ブリーチ専門」など。指名分散で売上が平準化。', effort: 'mid', impact: 'mid' },
    { title: 'プリペイドカード/回数券で前受金を作る',     detail: '5回券で5%OFF。キャッシュフロー改善+解約防止。', effort: 'mid', impact: 'mid' },
  ],
  glossary: [
    { term: '指名リピート率', meaning: '同じスタイリストを名指しで再予約した割合。美容業の最強指標。' },
    { term: '店販',           meaning: 'お客様に物を売ること (シャンプー等)。技術以外の売上で利益率を底上げできる。' },
    { term: 'ホットペッパー', meaning: 'リクルートの美容予約サイト。新規流入の主戦場だが掲載費が重い。' },
    { term: '稼働率',         meaning: 'スタイリストが営業時間中、施術している時間の割合。70%超で健全。' },
    { term: 'カラーチャージ', meaning: '長さ・薬剤追加の追加料金。客単価UPの定番施策。' },
    { term: 'プリカ / 回数券',meaning: '前払いで割引する仕組み。キャッシュ前受け+リピート確保。' },
    { term: 'シェアサロン',   meaning: '面貸し型サロン。フリーランス美容師が借りる仕組み。一気に増えている形態。' },
    { term: 'AGEHA / 美容師図鑑', meaning: 'Instagram でスタイリスト個人がブランドを作るカルチャー。指名集客の主戦場。' },
  ],
  revenue: { small: '¥80万〜250万/月', mid: '¥300万〜800万/月', large: '¥1,000万〜5,000万/月 (多店舗)', grossMarginPct: 85 },
};

// ============================================================
// 3. IT・SaaS (it)
// ============================================================
const IT: IndustryPack = {
  id: 'it',
  label: 'IT・SaaS',
  emoji: '💻',
  shortDescription: 'SaaS・受託開発・スタートアップ・Web制作など',
  kpis: [
    {
      name: 'MRR (月次経常収益)',
      unit: '円/月',
      benchmark: 'シード:¥100万、シリーズA:¥1,000万、PMF後:成長率10%/月',
      why: 'SaaSの心臓。MRRが成長していれば資金調達もしやすく、止まれば一気に難しくなる。',
    },
    {
      name: 'Churn Rate (解約率)',
      unit: '%/月',
      benchmark: 'SMB向け:3〜5%以下、エンプラ向け:1%以下',
      why: '解約率5%超だと新規をどれだけ取っても穴の空いたバケツ。LTVが伸びない。',
    },
    {
      name: 'CAC回収期間 (顧客獲得コスト ÷ 月額)',
      unit: 'ヶ月',
      benchmark: '12ヶ月以下が健全 / 18ヶ月超は要注意',
      why: '広告/営業に使ったお金が何ヶ月で回収されるか。長すぎるとキャッシュが先に尽きる。',
    },
  ],
  painPoints: [
    '無料トライアル → 有料転換が伸びない。離脱箇所がわからない',
    'エンジニア採用が難しく、人月単価が上がり続けている',
    '受託開発で稼いでいるが、ストック収益 (SaaS) に転換できない',
    'プロダクトが「何でもできます」になり、訴求が刺さらない',
    'カスタマーサクセスのリソースが足りず、解約が増えはじめている',
  ],
  growthPlays: [
    { title: 'オンボーディングで「Aha モーメント」までの導線を最短化', detail: '初回ログインから10分以内に成果を体験できるよう、ガイド・サンプルデータ・テンプレを用意。トライアル→有料率が2倍。', effort: 'mid', impact: 'high' },
    { title: 'プライシングページを3プラン化',           detail: 'Starter / Pro / Enterprise。Pro を真ん中に置く心理効果で平均単価+30%。', effort: 'low', impact: 'high' },
    { title: 'Product-Led Growth (PLG) 化',             detail: 'Free → Pro へのアップグレード動線をプロダクト内に埋め込む。Slack・Notion 方式。', effort: 'high', impact: 'high' },
    { title: 'カスタマーサクセスを役割定義',             detail: '導入後30日 / 90日 / 半年のヘルスチェック自動化。Churn率を1pt下げる。', effort: 'mid', impact: 'high' },
    { title: '年間契約で2ヶ月無料',                     detail: 'キャッシュ前受け+Churn低下のダブル効果。CFOが喜ぶ。', effort: 'low', impact: 'high' },
    { title: '導入事例 (ケーススタディ) を月1本',        detail: '「導入企業のロゴ+ROI数字」で営業資料の説得力が一段上がる。', effort: 'mid', impact: 'mid' },
    { title: 'SEO ハブページを作る',                    detail: '「[業界] + SaaS 比較」「料金表」「ROI計算機」など、検索意図上位を網羅。', effort: 'high', impact: 'high' },
    { title: 'API/連携を増やす (Zapier / Slack / Salesforce)', detail: '連携が増えると Churn が下がる。SaaS は「他システムから抜けにくい」が勝ち筋。', effort: 'high', impact: 'high' },
    { title: '受託案件をプロダクト化',                   detail: '同じ業界向けの受託を3案件こなしたら共通機能を抽出してパッケージ化。', effort: 'high', impact: 'high' },
    { title: 'Public Roadmap で顧客を巻き込む',          detail: '機能要望投票+進捗公開。ファンが営業してくれる現象が起きる。', effort: 'mid', impact: 'mid' },
  ],
  glossary: [
    { term: 'MRR / ARR',     meaning: 'Monthly/Annual Recurring Revenue。SaaSの収益の単位。' },
    { term: 'Churn',         meaning: '解約率。月次/年次でみる。SaaSは Churn を制す者がスケールする。' },
    { term: 'LTV',           meaning: 'Life Time Value。1顧客が一生のうちに払う総額。CACの3倍以上が目標。' },
    { term: 'CAC',           meaning: 'Customer Acquisition Cost。顧客1人獲得にかかった広告/営業費。' },
    { term: 'PLG',           meaning: 'Product-Led Growth。営業より先にプロダクト自体が顧客を獲得する成長モデル。' },
    { term: 'Aha モーメント',meaning: 'ユーザーが「これは使える！」と確信する瞬間。ここまでの時間がオンボの全て。' },
    { term: 'NRR',           meaning: 'Net Revenue Retention。既存顧客の翌年売上÷今年売上。120%超でT2D3に乗る。' },
    { term: 'PMF',           meaning: 'Product-Market Fit。「作ったものが市場に刺さった」と言える状態。' },
    { term: 'バーンレート',  meaning: '月の赤字額。資金調達済みスタートアップの寿命を決める数字。' },
  ],
  revenue: { small: '¥30万〜300万/月 (受託/小規模SaaS)', mid: '¥500万〜3,000万/月 (PMF後)', large: '¥1億〜/月 (シリーズB以降)', grossMarginPct: 75 },
};

// ============================================================
// 4. 不動産 (realestate)
// ============================================================
const REALESTATE: IndustryPack = {
  id: 'realestate',
  label: '不動産',
  emoji: '🏢',
  shortDescription: '賃貸仲介・売買仲介・管理・大家業など',
  kpis: [
    {
      name: '反響率 (問合せ ÷ 物件掲載数)',
      unit: '%',
      benchmark: 'SUUMO/HOMES で1〜3%が標準',
      why: '掲載は無料じゃない。同じ広告費でも掲載の質で反響が変わる。',
    },
    {
      name: '成約率 (内見 → 契約)',
      unit: '%',
      benchmark: '賃貸:30〜50% / 売買:5〜15%',
      why: '営業の力量と、物件選定の精度が出る。低ければトークと物件提案を見直す。',
    },
    {
      name: '空室率 (管理物件)',
      unit: '%',
      benchmark: '5%以下が健全 / 10%超は赤信号',
      why: '管理オーナーへの説明責任。空室が長引くと管理契約自体を切られる。',
    },
  ],
  painPoints: [
    'ポータルサイト (SUUMO/HOMES) の掲載費が毎月¥30〜80万かかり、利益を圧迫',
    '繁忙期 (1〜3月) と閑散期の差が激しく、スタッフ稼働を平準化できない',
    '相続物件の売却案件をもっと取りたいが、士業との接点がない',
    '管理物件のオーナーが高齢化して、相続発生時に他社に乗り換えられる',
    '若いスタッフが宅建を取らずに辞めていく。営業力ある人材が定着しない',
  ],
  growthPlays: [
    { title: '物件写真を「広角+明るさ補正」で撮り直し',  detail: 'SUUMO 上位表示の8割は写真の出来。プロカメラマン1回¥3万で反響2倍は普通。', effort: 'mid', impact: 'high' },
    { title: 'GoogleマップMEOで「地域名+賃貸」攻略',     detail: 'ポータル依存を減らす最初の一手。口コミ100件超で問合せが安定。', effort: 'mid', impact: 'high' },
    { title: '内見VR / 360°写真を全物件に',             detail: '遠方客 (転勤・学生) の決定率が上がる。来店せず申込まで進む顧客が増える。', effort: 'mid', impact: 'mid' },
    { title: 'LINE で内見後フォロー自動化',             detail: '内見後3日以内に再連絡で契約率20%→35%。テンプレ+人で十分。', effort: 'low', impact: 'high' },
    { title: '士業 (税理士・司法書士) との紹介ネットワーク', detail: '相続発生→売却の動線を作る。1件¥500万〜の仲介手数料。', effort: 'high', impact: 'high' },
    { title: 'オーナー向けニュースレター (月1)',         detail: '空室対策・税制改正情報を配信。乗り換え防止+紹介発生。', effort: 'mid', impact: 'mid' },
    { title: '法人向け社宅斡旋営業',                     detail: '近隣大企業の総務に営業。1法人で複数件・長期契約が取れる。', effort: 'high', impact: 'high' },
    { title: 'リフォーム提案で空室対策の主導権を取る',   detail: '管理物件のオーナーに「家賃下げる前にリフォーム」を提案。粗利が積み上がる。', effort: 'mid', impact: 'high' },
    { title: '繁忙期前 (12月) に学生・新社会人向け早割', detail: '1月決定の客を11月から囲い込む。競合が動く前に契約。', effort: 'low', impact: 'mid' },
    { title: 'YouTube / Instagram でルームツアー',       detail: 'ポータルにない「動きと音」が決定力に。物件紹介+地域紹介で問合せ増。', effort: 'mid', impact: 'mid' },
  ],
  glossary: [
    { term: '反響',           meaning: '物件掲載から問合せが来ること。「反響が薄い」は写真と価格を疑う。' },
    { term: 'AD (広告料)',    meaning: 'オーナーが仲介会社に払う成約報酬上乗せ分。AD3ヶ月で営業の優先度が一気に上がる。' },
    { term: '専任媒介 / 一般媒介', meaning: '売却を1社に任せるか複数社か。専任の方が囲い込みリスクあり。' },
    { term: '客付け / 元付け',meaning: '客付け=借りたい人を連れてくる側 / 元付け=オーナー側担当。' },
    { term: '宅建',           meaning: '宅地建物取引士。事務所に5名に1人必須。実務の要。' },
    { term: '重説 (重要事項説明)', meaning: '契約前に法定で説明すべき事項。読み上げに30分以上かかることも。' },
    { term: '原状回復',       meaning: '退去時の修繕。ガイドラインを知らないとオーナー有利にしすぎてトラブル。' },
    { term: 'サブリース',     meaning: '一括借上。家賃保証だが、長期で見ると相場下落リスクをオーナーが負う。' },
  ],
  revenue: { small: '¥100万〜500万/月 (小規模仲介)', mid: '¥800万〜3,000万/月 (中堅)', large: '¥5,000万〜/月 (売買特化・管理戸数1,000超)', grossMarginPct: 80 },
};

// ============================================================
// 5. EC・通販 (ec)
// ============================================================
const EC: IndustryPack = {
  id: 'ec',
  label: 'EC・通販',
  emoji: '🛒',
  shortDescription: '自社EC・Amazon・楽天・D2C・物販など',
  kpis: [
    {
      name: 'ROAS (広告費用対効果)',
      unit: '%',
      benchmark: '新規広告で300〜400% / リターゲで500%以上',
      why: '広告費¥1で何円の売上が返ってくるか。粗利率と合わせて利益が出る分岐点を必ず計算する。',
    },
    {
      name: 'CVR (購入率)',
      unit: '%',
      benchmark: '自社EC:1〜3% / Amazon:10〜15% / 楽天:2〜5%',
      why: '訪問者の何%が買ったか。低ければ商品ページ・価格・送料を疑う。',
    },
    {
      name: 'リピート率 (90日以内2回目購入)',
      unit: '%',
      benchmark: '消耗品で30%超 / 化粧品で40%超',
      why: 'EC は新規獲得広告費がじわじわ上がっている。リピートが利益を作る。',
    },
  ],
  painPoints: [
    'Meta/Google 広告 CPM が上がり続け、新規 ROAS が悪化',
    'カゴ落ち率が70%超。決済・送料・会員登録のどこで離脱しているか不明',
    '在庫管理がスプレッドシートで限界。欠品 → 機会損失と過剰在庫 → 廃棄を繰り返している',
    'Amazon の規約変更で売上が突然落ちる。プラットフォーム依存が怖い',
    '自社ブランドのファンが育たず、価格競合に巻き込まれて値下げ合戦',
  ],
  growthPlays: [
    { title: '商品ページのファーストビュー再設計',       detail: 'メインビジュアル+価格+送料+口コミ星をスマホ1画面に。CVRが1.3〜1.8倍。', effort: 'mid', impact: 'high' },
    { title: 'メール+LINE でカゴ落ちリカバリ自動化',     detail: '1時間 / 1日 / 3日後の3通配信。カゴ落ち売上の10〜15%を回収。', effort: 'mid', impact: 'high' },
    { title: 'クロスセル/アップセル (購入完了画面)',     detail: '「あと¥500で送料無料」「一緒に買われている商品」。AOV (客単価) が+10〜20%。', effort: 'low', impact: 'high' },
    { title: 'UGC (ユーザー投稿) を商品ページに掲載',     detail: '実購入者のレビュー+写真で信頼度が上がる。CVR+20%は普通。', effort: 'mid', impact: 'mid' },
    { title: '定期購入プランの導入',                     detail: '消耗品ならサブスク化で LTV が2〜3倍。Churn 制御が肝。', effort: 'mid', impact: 'high' },
    { title: 'Amazon SEO (商品名・サジェスト・A+コンテンツ)', detail: '検索1ページ目に入れば売上が桁で変わる。', effort: 'mid', impact: 'high' },
    { title: 'インフルエンサーギフティング',             detail: 'マイクロインフルエンサー (1〜5万フォロワー) に商品提供。広告より刺さる。', effort: 'mid', impact: 'mid' },
    { title: 'クーポン乱発をやめて「初回限定」「リピーター限定」に整理', detail: '値下げ依存から脱却。ブランド価値の毀損を防ぐ。', effort: 'low', impact: 'mid' },
    { title: '配送品質を改善 (即日/翌日発送)',           detail: 'Amazon 並みの体感に。レビュー★1のほぼ全部が「梱包・配送」起因。', effort: 'high', impact: 'high' },
    { title: 'BFCM / SS (大型セール) のシナリオ準備',     detail: 'ブラックフライデー・年末SS は年間売上の20〜30%。在庫・広告・LINE 配信を3ヶ月前から逆算。', effort: 'high', impact: 'high' },
  ],
  glossary: [
    { term: 'ROAS',           meaning: 'Return On Ad Spend。広告費に対する売上倍率。粗利と合わせて見ないと意味がない。' },
    { term: 'CVR',            meaning: 'Conversion Rate。訪問者のうち購入した割合。' },
    { term: 'AOV',            meaning: 'Average Order Value。客単価。1注文あたり平均金額。' },
    { term: 'カゴ落ち',       meaning: 'カートに入れたまま購入しない離脱。EC 最大の損失源。' },
    { term: 'UGC',            meaning: 'User Generated Content。実購入者の写真・レビュー。広告より信頼される。' },
    { term: 'D2C',            meaning: 'Direct to Consumer。メーカーが直接消費者に売るモデル。' },
    { term: 'BFCM',           meaning: 'Black Friday / Cyber Monday。EC最大セール期。' },
    { term: 'SKU',            meaning: 'Stock Keeping Unit。在庫管理上の品目単位。色違い・サイズ違いも別 SKU。' },
    { term: 'CPM / CPC',      meaning: 'インプレッション単価/クリック単価。広告コストの基本単位。' },
  ],
  revenue: { small: '¥50万〜300万/月 (個人物販)', mid: '¥500万〜5,000万/月 (D2Cブランド)', large: '¥1億〜/月 (大手モール+自社EC)', grossMarginPct: 50 },
};

// ============================================================
// 6. 医療 (medical)
// ============================================================
const MEDICAL: IndustryPack = {
  id: 'medical',
  label: '医療・クリニック',
  emoji: '🏥',
  shortDescription: '内科・歯科・美容医療・整体・薬局など',
  kpis: [
    {
      name: '1日あたり来院患者数',
      unit: '人/日',
      benchmark: '保険診療:40〜60人 / 自由診療:10〜20人',
      why: '保険診療は数で稼ぐ、自由診療は単価で稼ぐ。事業モデルで意味が変わる指標。',
    },
    {
      name: '保険・自由診療比率',
      unit: '%',
      benchmark: '一般クリニック:保険9割 / 自由診療振り 30%超で収益安定',
      why: '保険診療は点数固定で天井がある。自由診療を増やすと利益率が一気に上がる。',
    },
    {
      name: '再診率 / リコール率',
      unit: '%',
      benchmark: '歯科リコール:50%超 / 内科再診:70%超',
      why: '新規より再来の方が圧倒的に利益。リコール (定期検診) ハガキ運用で大きく変わる。',
    },
  ],
  painPoints: [
    '受付の電話対応が回らず、新規予約を取りこぼしている',
    '自由診療を伸ばしたいが、患者に提案するタイミングと言い方がわからない',
    '院長 (自分) しか診療できず、休めない。家族との時間が取れない',
    '近隣クリニックが増え、口コミ評価で差別化が必要だが、口コミ依頼の声かけが苦手',
    'スタッフの離職が多く、特に歯科衛生士/医療事務が育つ前に辞める',
  ],
  growthPlays: [
    { title: 'WEB予約システム導入で電話を減らす',         detail: 'EPARK / メディカ などで24時間予約可。電話を取り逃した新規が拾える。受付の負担も激減。', effort: 'mid', impact: 'high' },
    { title: 'Googleマップ口コミ依頼を会計時に',         detail: 'QRコードで★評価誘導。MEO 上位 → 新規が無料で増える。', effort: 'low', impact: 'high' },
    { title: '自由診療メニューを「悩み起点」で再構築',     detail: '「ホワイトニング」より「歯の黄ばみが気になる方へ」。提案率が上がる。', effort: 'mid', impact: 'high' },
    { title: 'リコールハガキ / LINE 自動配信',           detail: '半年に1回の定期検診案内。歯科なら売上の30%がここから。', effort: 'mid', impact: 'high' },
    { title: 'スタッフ教育プログラム整備',                detail: '入職3ヶ月の OJT を文書化。離職率が下がるとブランドにもなる。', effort: 'high', impact: 'mid' },
    { title: '物販 (歯ブラシ・サプリ・化粧品) で月10万円', detail: '診察ついでの購買は粗利40〜60%。在庫リスクも低い。', effort: 'low', impact: 'mid' },
    { title: 'Instagram で症例 (ビフォーアフター) 投稿',  detail: '美容医療・矯正歯科は症例数で選ばれる。広告ガイドラインに準拠。', effort: 'mid', impact: 'high' },
    { title: '法人健診・企業契約を取りに行く',           detail: '近隣企業に健診プランを営業。安定収益+紹介発生。', effort: 'high', impact: 'mid' },
    { title: '電子カルテ + ペーパーレスで人時短縮',       detail: '受付・会計の時間が半分。スタッフが患者対応に時間を使える。', effort: 'high', impact: 'mid' },
    { title: '「待ち時間ゼロ」の予約枠管理',             detail: '完全予約制+ダブルブッキング禁止で評判が良くなる。リピート率+10pt。', effort: 'mid', impact: 'high' },
  ],
  glossary: [
    { term: '保険診療',   meaning: '健康保険適用の診療。点数で報酬が決まる。' },
    { term: '自由診療',   meaning: '自費。価格は医院が決められる。利益率が高い。' },
    { term: '点数',       meaning: '保険診療の報酬計算単位。1点=10円。' },
    { term: 'リコール',   meaning: '定期検診案内。歯科・美容クリニックの根幹。' },
    { term: '主訴',       meaning: '患者が「これで困って来た」と言う一番の理由。カウンセリングの起点。' },
    { term: 'インフォームドコンセント',meaning: '治療内容を説明し、同意を得ること。自由診療では特に大事。' },
    { term: 'レセプト',   meaning: '保険診療の請求書。月初に審査支払機関へ提出。' },
    { term: '広告ガイドライン', meaning: '医療広告は他業種より厳しい。ビフォーアフター・口コミ表現に制限あり。' },
  ],
  revenue: { small: '¥300万〜800万/月 (個人クリニック)', mid: '¥1,000万〜3,000万/月 (中規模)', large: '¥5,000万〜/月 (多院展開・美容医療)', grossMarginPct: 70 },
};

// ============================================================
// 7. 教育 (education)
// ============================================================
const EDUCATION: IndustryPack = {
  id: 'education',
  label: '教育・スクール',
  emoji: '🎓',
  shortDescription: '学習塾・英会話・プログラミングスクール・オンライン講座など',
  kpis: [
    {
      name: '在籍生徒数',
      unit: '人',
      benchmark: '個人塾:30〜80人 / 中堅:150〜300人',
      why: '月謝×人数がストック収益。新規と退会のバランスで毎月見る数字。',
    },
    {
      name: '継続率 (年間)',
      unit: '%',
      benchmark: '塾:80%超 / 月謝制スクール:75%超',
      why: '教育は3〜6ヶ月で成果が出始める。短期で辞められると採算が合わない。',
    },
    {
      name: 'CPA (1問合せ獲得コスト)',
      unit: '円',
      benchmark: '塾:¥3,000〜8,000 / オンライン講座:¥1,500〜5,000',
      why: '広告効率の指標。問合せ→体験→入会の歩留まりと合わせて損益分岐を計算。',
    },
  ],
  painPoints: [
    '体験授業まで来てくれるが、入会まで進まない。クロージングが弱い',
    '夏期/冬期講習で売上は上がるが、3月の退会ラッシュで結局トントン',
    '講師の質がバラつき、保護者からのクレームが講師起因で発生する',
    'オンライン化を進めたいが、生徒のモチベ管理が対面より難しく継続率が落ちる',
    'チラシ・ポスティング・SEO の費用対効果が読めない。何にどれだけ使うべきか不明',
  ],
  growthPlays: [
    { title: '無料体験 → 入会の動線を「次の一歩」設計',  detail: '体験後その場で「今月入会で初月無料」を提案。クロージング率が30%→50%へ。', effort: 'low', impact: 'high' },
    { title: '保護者向けの定期面談を制度化',             detail: '3ヶ月に1回、学習進捗+次の目標を共有。継続率+10pt、紹介発生。', effort: 'mid', impact: 'high' },
    { title: '紹介制度 (紹介者 / 紹介された人どちらにも特典)', detail: '広告費よりCPAが安く、入会後の継続率も高い。', effort: 'low', impact: 'high' },
    { title: '夏期/冬期講習を「単発」でなく「コース」に', detail: '入会への接続を前提に設計。夏期で接点 → 通常コース移行率を伸ばす。', effort: 'mid', impact: 'high' },
    { title: '合格実績/伸び率を保護者会で「数字で」発信', detail: '「平均偏差値+8」「英検2級合格率70%」など。チラシより口コミより強い。', effort: 'mid', impact: 'high' },
    { title: 'YouTube / Instagram で「授業の中身」を切り出し公開', detail: '無料公開は受講者を奪わない。むしろ信頼が積み上がる。', effort: 'mid', impact: 'mid' },
    { title: 'LMS (学習管理) 導入で講師依存を減らす',   detail: '宿題・進捗・スコアを生徒/保護者が見える化。離脱前に手が打てる。', effort: 'high', impact: 'high' },
    { title: '兄弟姉妹割引',                             detail: '家族単位で取り込めば継続率も新規獲得コストも下がる。', effort: 'low', impact: 'mid' },
    { title: 'オンライン+対面のハイブリッド',           detail: 'コロナ後の標準。商圏が広がり、悪天候・体調不良での欠席が減る。', effort: 'high', impact: 'mid' },
    { title: '法人提携 (社員研修・福利厚生)',           detail: '企業の英会話/プログラミング研修。1社¥30〜100万/月の固定収入。', effort: 'high', impact: 'high' },
  ],
  glossary: [
    { term: '体験授業',     meaning: '無料or格安の入会前授業。クロージング率がここで決まる。' },
    { term: '継続率',       meaning: '入会後一定期間在籍した割合。教育ビジネスの心臓。' },
    { term: '月謝制',       meaning: '毎月の定額課金。安定収益だが値上げが難しい。' },
    { term: 'LMS',          meaning: 'Learning Management System。学習進捗・宿題・スコアを管理するシステム。' },
    { term: 'CPA',          meaning: 'Cost Per Acquisition。1件問合せ獲得コスト。チラシ・SEO・広告で比較。' },
    { term: '夏期講習',     meaning: '夏休みの短期集中講座。年間売上の15〜25%を占めることも。' },
    { term: 'クロージング', meaning: '体験から入会への決断を促す会話。スクリプト化で歩留まり改善。' },
    { term: '少人数制 / マンツーマン', meaning: '指導形態。単価と継続率にトレードオフ。' },
  ],
  revenue: { small: '¥50万〜300万/月 (個人塾)', mid: '¥500万〜2,000万/月 (中規模スクール)', large: '¥3,000万〜/月 (法人研修+多教室)', grossMarginPct: 75 },
};

// ============================================================
// 全パック + ヘルパ
// ============================================================
export const INDUSTRY_PACKS: Record<IndustryId, IndustryPack> = {
  food: FOOD,
  beauty: BEAUTY,
  it: IT,
  realestate: REALESTATE,
  ec: EC,
  medical: MEDICAL,
  education: EDUCATION,
};

export const INDUSTRY_LIST: IndustryPack[] = [
  FOOD, BEAUTY, IT, REALESTATE, EC, MEDICAL, EDUCATION,
];

export function getIndustryPack(id?: IndustryId | string | null): IndustryPack | null {
  if (!id) return null;
  return (INDUSTRY_PACKS as Record<string, IndustryPack>)[id] ?? null;
}

/**
 * AI 呼び出しの先頭に注入する業界 context ブロックを生成する。
 * proactiveAgent / coachScheduler の userPrompt 先頭に挿す前提。
 *
 * 一般論ではなく「その業界のオーナーがわかる言葉」で提案させるための土台。
 */
export function buildIndustryContext(industry?: IndustryId | string | null): string {
  const pack = getIndustryPack(industry);
  if (!pack) return '';

  const kpis = pack.kpis
    .map(k => `  - **${k.name}** (単位: ${k.unit}) — 業界目安: ${k.benchmark}。${k.why}`)
    .join('\n');

  const pains = pack.painPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n');

  const plays = pack.growthPlays
    .map((p, i) => `  ${i + 1}. [効果:${p.impact}/工数:${p.effort}] **${p.title}** — ${p.detail}`)
    .join('\n');

  const glossary = pack.glossary.map(g => `  - ${g.term}: ${g.meaning}`).join('\n');

  return `## このオーナーの業界: ${pack.label} ${pack.emoji}
${pack.shortDescription}

### この業界で最重要の KPI (3つ)
${kpis}

### この業界でよくある悩み (上位5つ)
${pains}

### 売上を伸ばす定番施策 (この中から最適なものを選んで提案OK)
${plays}

### 業界用語 (この用語は説明なしで使ってOK、ただし専門用語ばかりは避ける)
${glossary}

### 月商規模感の目安
- 小規模: ${pack.revenue.small}
- 中規模: ${pack.revenue.mid}
- 大規模: ${pack.revenue.large}
- 業界平均粗利率: 約${pack.revenue.grossMarginPct}%

---
**重要**: 提案は必ず上記の業界文脈に沿って具体化すること。
「業務改善しましょう」のような一般論ではなく、
この業界の人が「あ、わかってる人だ」と感じる粒度で書く。
業界 KPI を必ず1つ以上引用し、施策は上の10個から選ぶか同等の粒度で新規提案する。
`;
}
