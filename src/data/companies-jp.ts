// ============================================================
// 日本企業 静的データベース (公開情報のみ)
// ------------------------------------------------------------
// 目的: 商談 AI が「先回りでマッチする企業」を選ぶための候補プール。
//       外部 API は使わず、ここに静的に持つ。
// 出典: 公式 IR / Wikipedia / プレスリリース要約 (2025-2026 時点)
// ============================================================

export type CompanySize = 'large' | 'mid' | 'startup';

export interface CompanyEntry {
  /** スラッグ (一意キー) */
  id: string;
  /** 正式社名 */
  name: string;
  /** 業界 (粗いカテゴリ) */
  industry: string;
  /** 規模感 */
  size: CompanySize;
  /** 主たる本社所在地 */
  region: string;
  /** 公開情報をもとにした近年のトピック (営業の角度づくり用) */
  newsHint: string;
}

export const COMPANIES_JP: CompanyEntry[] = [
  // ─── 自動車・モビリティ ────────────────────────
  { id: 'toyota',        name: 'トヨタ自動車',           industry: '自動車',     size: 'large',   region: '愛知',   newsHint: 'EV・全固体電池の量産化を加速、ソフトウェア人材を大量採用中' },
  { id: 'honda',         name: '本田技研工業',           industry: '自動車',     size: 'large',   region: '東京',   newsHint: 'EV 専用ブランド 0 シリーズ展開、SDV (Software Defined Vehicle) 強化' },
  { id: 'nissan',        name: '日産自動車',             industry: '自動車',     size: 'large',   region: '神奈川', newsHint: '構造改革と人員整理、新型 EV モデルの投入を計画' },
  { id: 'suzuki',        name: 'スズキ',                 industry: '自動車',     size: 'large',   region: '静岡',   newsHint: 'インド市場が好調、軽 EV と二輪事業を拡大' },
  { id: 'mazda',         name: 'マツダ',                 industry: '自動車',     size: 'large',   region: '広島',   newsHint: 'ラージ商品群への投資、ロータリー EV の復活' },
  { id: 'subaru',        name: 'SUBARU',                 industry: '自動車',     size: 'large',   region: '東京',   newsHint: '米国市場への依存、EV ラインナップの拡充が課題' },
  { id: 'denso',         name: 'デンソー',               industry: '自動車部品', size: 'large',   region: '愛知',   newsHint: '半導体内製化と SDV 向けソフトウェア事業に投資' },
  { id: 'bridgestone',   name: 'ブリヂストン',           industry: 'タイヤ',     size: 'large',   region: '東京',   newsHint: 'リトレッド事業とソリューション事業へのシフト' },
  { id: 'yamaha-motor',  name: 'ヤマハ発動機',           industry: 'モビリティ', size: 'large',   region: '静岡',   newsHint: '電動二輪・電動アシスト自転車・船外機が好調' },
  { id: 'aisin',         name: 'アイシン',               industry: '自動車部品', size: 'large',   region: '愛知',   newsHint: '電動ユニット e-Axle 増産、住宅・エネルギー事業も拡大' },

  // ─── 電機・半導体 ────────────────────────
  { id: 'sony',          name: 'ソニーグループ',         industry: '電機',       size: 'large',   region: '東京',   newsHint: 'ゲーム・音楽・センサー事業が好調、エンタメ IP 投資を加速' },
  { id: 'panasonic',     name: 'パナソニック',           industry: '電機',       size: 'large',   region: '大阪',   newsHint: '車載電池とコネクテッド家電に注力、テスラ向け増産' },
  { id: 'hitachi',       name: '日立製作所',             industry: '総合電機',   size: 'large',   region: '東京',   newsHint: 'Lumada 事業 (DX) が成長エンジン、米 GlobalLogic 統合進む' },
  { id: 'toshiba',       name: '東芝',                   industry: '総合電機',   size: 'large',   region: '東京',   newsHint: '非上場化後の再建、半導体・量子・電力事業に集中' },
  { id: 'mitsubishi-electric', name: '三菱電機',         industry: '総合電機',   size: 'large',   region: '東京',   newsHint: 'FA・空調が主力、品質不正問題からの構造改革進行中' },
  { id: 'fujitsu',       name: '富士通',                 industry: 'IT・電機',   size: 'large',   region: '東京',   newsHint: 'Uvance 戦略でグローバル DX 支援に注力' },
  { id: 'nec',           name: 'NEC',                    industry: 'IT・電機',   size: 'large',   region: '東京',   newsHint: 'AI・5G・サイバーセキュリティ事業を成長領域に位置付け' },
  { id: 'sharp',         name: 'シャープ',               industry: '電機',       size: 'large',   region: '大阪',   newsHint: 'ディスプレイ事業の構造改革、Foxconn 傘下で再編進行' },
  { id: 'canon',         name: 'キヤノン',               industry: '電機',       size: 'large',   region: '東京',   newsHint: '半導体露光装置と医療機器事業を成長領域に' },
  { id: 'ricoh',         name: 'リコー',                 industry: '電機',       size: 'large',   region: '東京',   newsHint: 'デジタルサービス会社への転換を加速、複合機からの脱皮' },
  { id: 'kyocera',       name: '京セラ',                 industry: '電子部品',   size: 'large',   region: '京都',   newsHint: '半導体パッケージ・5G 基地局向け部品が好調' },
  { id: 'murata',        name: '村田製作所',             industry: '電子部品',   size: 'large',   region: '京都',   newsHint: 'MLCC で世界シェアトップ、車載・AI サーバー向け増産' },
  { id: 'rohm',          name: 'ローム',                 industry: '半導体',     size: 'large',   region: '京都',   newsHint: 'SiC パワー半導体に注力、東芝と提携拡大' },
  { id: 'renesas',       name: 'ルネサスエレクトロニクス', industry: '半導体',   size: 'large',   region: '東京',   newsHint: '車載 MCU で世界トップクラス、M&A で IP 拡充' },
  { id: 'tdk',           name: 'TDK',                    industry: '電子部品',   size: 'large',   region: '東京',   newsHint: '車載・スマホ向け二次電池が好調、半導体材料も拡大' },
  { id: 'kioxia',        name: 'キオクシア',             industry: '半導体',     size: 'large',   region: '東京',   newsHint: 'NAND メモリ大手、上場準備と AI 需要拡大の追い風' },
  { id: 'sumco',         name: 'SUMCO',                  industry: '半導体材料', size: 'large',   region: '東京',   newsHint: '300mm ウエハーの増産投資、AI 半導体需要が追い風' },
  { id: 'tokyo-electron',name: '東京エレクトロン',       industry: '半導体製造装置', size: 'large', region: '東京', newsHint: '生成 AI 向け半導体製造装置の需要が爆発的に拡大' },
  { id: 'screen',        name: 'SCREEN ホールディングス', industry: '半導体製造装置', size: 'large', region: '京都', newsHint: '洗浄装置で世界トップ、最先端ロジック向け需要好調' },
  { id: 'advantest',     name: 'アドバンテスト',         industry: '半導体検査装置', size: 'large', region: '東京', newsHint: 'AI チップ向けテスタの需要急増、業績過去最高' },
  { id: 'disco',         name: 'ディスコ',               industry: '半導体製造装置', size: 'large', region: '東京', newsHint: 'ダイシング装置で世界シェアトップ、HBM 関連需要で増収' },

  // ─── 通信・ネット ────────────────────────
  { id: 'ntt',           name: '日本電信電話 (NTT)',     industry: '通信',       size: 'large',   region: '東京',   newsHint: 'IOWN 構想推進、データセンター・グローバル事業を拡大' },
  { id: 'ntt-data',      name: 'NTT データ',             industry: 'SIer',       size: 'large',   region: '東京',   newsHint: '海外売上比率が過半、生成 AI の SI 案件を急拡大' },
  { id: 'kddi',          name: 'KDDI',                   industry: '通信',       size: 'large',   region: '東京',   newsHint: '通信以外の DX・金融・電力事業を拡大' },
  { id: 'softbank',      name: 'ソフトバンク',           industry: '通信',       size: 'large',   region: '東京',   newsHint: '生成 AI 事業に大規模投資、PayPay 連携を強化' },
  { id: 'rakuten',       name: '楽天グループ',           industry: 'EC・金融',   size: 'large',   region: '東京',   newsHint: '通信事業の収益化と楽天モバイルの黒字化が最優先課題' },
  { id: 'ynh',           name: 'LY コーポレーション',    industry: 'ネット',     size: 'large',   region: '東京',   newsHint: 'LINE と Yahoo の経営統合完了、広告・コマース・金融を融合' },
  { id: 'cyberagent',    name: 'サイバーエージェント',   industry: '広告・ゲーム', size: 'large', region: '東京',   newsHint: 'AI 広告クリエイティブ事業を急拡大、ABEMA の収益化進む' },
  { id: 'dena',          name: 'DeNA',                   industry: 'ネット',     size: 'large',   region: '東京',   newsHint: 'スポーツ・ヘルスケア事業を強化、ゲーム事業は縮小' },
  { id: 'gree',          name: 'GREE',                   industry: 'ゲーム',     size: 'mid',     region: '東京',   newsHint: 'メタバース・XR 事業に注力、ライブエンタメへピボット' },
  { id: 'mixi',          name: 'MIXI',                   industry: 'ネット',     size: 'mid',     region: '東京',   newsHint: 'モンスト依存からの脱却、スポーツ事業を強化' },
  { id: 'gmo',           name: 'GMO インターネット',     industry: 'ネット',     size: 'large',   region: '東京',   newsHint: 'ドメイン・FX・暗号資産の総合ネットインフラを展開' },
  { id: 'kakaku',        name: 'カカクコム',             industry: 'ネット',     size: 'mid',     region: '東京',   newsHint: '食べログ・価格.com の AI 化、決済データ連携が課題' },
  { id: 'visional',      name: 'ビジョナル',             industry: 'HR Tech',    size: 'mid',     region: '東京',   newsHint: 'ビズリーチが好調、HR DX 領域への横展開' },

  // ─── 大手 SIer・IT サービス ────────────────────────
  { id: 'nri',           name: '野村総合研究所',         industry: 'SIer・コンサル', size: 'large', region: '東京', newsHint: '金融 DX とコンサル統合で増収、生成 AI 活用支援が増加' },
  { id: 'obic',          name: 'オービック',             industry: 'SIer',       size: 'mid',     region: '東京',   newsHint: '中堅企業向け基幹システム OBIC7 で安定成長' },
  { id: 'tis',           name: 'TIS',                    industry: 'SIer',       size: 'large',   region: '東京',   newsHint: 'ペイメント・金融 SI が主力、ASEAN 事業も拡大' },
  { id: 'itochu-techno', name: '伊藤忠テクノソリューションズ (CTC)', industry: 'SIer', size: 'large', region: '東京', newsHint: 'インフラ・クラウド SI に強み、生成 AI 案件が拡大' },
  { id: 'scsk',          name: 'SCSK',                   industry: 'SIer',       size: 'large',   region: '東京',   newsHint: '住友商事系、自動車・流通向け SI に強み' },

  // ─── IT・SaaS スタートアップ (上場) ────────────────────────
  { id: 'mercari',       name: 'メルカリ',               industry: 'EC',         size: 'mid',     region: '東京',   newsHint: '米国事業 黒字化を目指す、メルコイン・ハロの収益化' },
  { id: 'smarthr',       name: 'SmartHR',                industry: 'HR Tech',    size: 'mid',     region: '東京',   newsHint: '従業員数 50 万社突破、タレントマネジメント領域に拡大' },
  { id: 'freee',         name: 'freee',                  industry: 'Fintech',    size: 'mid',     region: '東京',   newsHint: '中小企業 DX の総合プラットフォーム、人事労務領域を強化' },
  { id: 'moneyforward',  name: 'マネーフォワード',       industry: 'Fintech',    size: 'mid',     region: '東京',   newsHint: '法人向け SaaS が伸長、家計簿アプリは横ばい' },
  { id: 'rakus',         name: 'ラクス',                 industry: 'SaaS',       size: 'mid',     region: '東京',   newsHint: '楽楽精算・楽楽明細が経費精算 SaaS でシェア拡大' },
  { id: 'sansan',        name: 'Sansan',                 industry: 'SaaS',       size: 'mid',     region: '東京',   newsHint: '名刺管理から営業 DX プラットフォームへ進化、Bill One 急成長' },
  { id: 'plaid',         name: 'プレイド',               industry: 'CXプラットフォーム', size: 'mid', region: '東京', newsHint: 'KARTE で CX 領域を深耕、AI 連携機能を拡充' },
  { id: 'beenos',        name: 'BEENOS',                 industry: '越境EC',     size: 'mid',     region: '東京',   newsHint: 'tenso・Buyee の越境 EC 支援が円安追い風で好調' },
  { id: 'raksul',        name: 'ラクスル',               industry: '印刷・物流', size: 'mid',     region: '東京',   newsHint: '印刷 EC のラクスル、物流 DX のハコベル、広告のノバセル' },
  { id: 'lifenet',       name: 'ライフネット生命',       industry: '保険',       size: 'mid',     region: '東京',   newsHint: 'KDDI・auじぶん経済圏との連携で新規契約数拡大' },
  { id: 'spider-plus',   name: 'スパイダープラス',       industry: '建設 SaaS',  size: 'startup', region: '東京',   newsHint: '建設業向け図面 SaaS、業界シェア拡大中' },
  { id: 'kaonavi',       name: 'カオナビ',               industry: 'HR Tech',    size: 'mid',     region: '東京',   newsHint: 'タレントマネジメントで国内シェアトップ、人的資本開示で追い風' },
  { id: 'ubisecure',     name: 'ユーザベース',           industry: '情報サービス', size: 'mid',   region: '東京',   newsHint: 'SPEEDA・NewsPicks で経済情報の AI 化を推進' },
  { id: 'recruit',       name: 'リクルートホールディングス', industry: 'HR・情報', size: 'large', region: '東京',   newsHint: 'Indeed が成長エンジン、米国景気の影響を受けやすい' },
  { id: 'persol',        name: 'パーソルホールディングス', industry: '人材',     size: 'large',   region: '東京',   newsHint: 'doda・テンプスタッフが主力、海外 M&A で派遣事業拡大' },
  { id: 'opt',           name: 'デジタルホールディングス', industry: '広告',     size: 'mid',     region: '東京',   newsHint: 'デジタル広告の運用力が強み、コマース支援も拡大' },
  { id: 'astamuse',      name: 'アスタミューゼ',         industry: 'AI・IPデータ', size: 'startup', region: '東京', newsHint: '特許・論文ビッグデータで R&D・IR 支援、AI 機能拡充' },
  { id: 'kufu',          name: 'クフ',                   industry: 'HR Tech',    size: 'startup', region: '東京',   newsHint: 'SmartHR と並ぶ HR スタートアップ、SaaS で拡大' },
  { id: 'andpad',        name: 'アンドパッド',           industry: '建設 SaaS',  size: 'mid',     region: '東京',   newsHint: '建設業向け統合 SaaS、IPO 準備中で営業を強化' },
  { id: 'caddi',         name: 'キャディ',               industry: '製造業 SaaS', size: 'mid',    region: '東京',   newsHint: '製造業の図面データプラットフォーム、海外展開を加速' },
  { id: 'lay-bricks',    name: 'レイヤーX',              industry: 'Fintech',    size: 'startup', region: '東京',   newsHint: 'バクラク経費精算が急成長、AI-OCR が強み' },
  { id: 'studist',       name: 'スタディスト',           industry: 'SaaS',       size: 'mid',     region: '東京',   newsHint: 'マニュアル作成 SaaS Teachme Biz、現場 DX 領域で拡大' },
  { id: 'cybozu',        name: 'サイボウズ',             industry: 'SaaS',       size: 'mid',     region: '東京',   newsHint: 'kintone でノーコード市場リード、海外展開を強化' },
  { id: 'wantedly',      name: 'ウォンテッドリー',       industry: 'HR Tech',    size: 'startup', region: '東京',   newsHint: '採用 SaaS でスタートアップ・IT 系に強い顧客基盤' },
  { id: 'newspicks',     name: 'NewsPicks',              industry: 'メディア',   size: 'startup', region: '東京',   newsHint: '経済メディアと法人研修事業のシナジー、AI 要約機能拡充' },
  { id: 'lancers',       name: 'ランサーズ',             industry: 'ギグワーク', size: 'startup', region: '東京',   newsHint: 'フリーランス向け SaaS と仕事マッチングを強化' },
  { id: 'crowdworks',    name: 'クラウドワークス',       industry: 'ギグワーク', size: 'mid',     region: '東京',   newsHint: 'BPO・派遣事業を強化、AI を活用したマッチング自動化' },
  { id: 'medpeer',       name: 'メドピア',               industry: '医療 SaaS',  size: 'mid',     region: '東京',   newsHint: '医師コミュニティと製薬企業向けマーケ支援が好調' },
  { id: 'amato',         name: 'アマナ',                 industry: 'クリエイティブ', size: 'mid', region: '東京',   newsHint: '生成 AI とクリエイティブ制作の融合を模索' },

  // ─── 金融・保険 ────────────────────────
  { id: 'mufg',          name: '三菱UFJフィナンシャルG', industry: '銀行',       size: 'large',   region: '東京',   newsHint: '米国市場での個人向け事業強化、デジタル銀行を統合' },
  { id: 'mizuho',        name: 'みずほフィナンシャルG',  industry: '銀行',       size: 'large',   region: '東京',   newsHint: 'システム障害からの信頼回復、PayPay 連携拡大' },
  { id: 'smfg',          name: '三井住友フィナンシャルG', industry: '銀行',      size: 'large',   region: '東京',   newsHint: 'Olive で金融サービス統合、海外展開も積極的' },
  { id: 'resona',        name: 'りそなホールディングス', industry: '銀行',       size: 'large',   region: '大阪',   newsHint: '関西・首都圏のリテール特化、地銀との連携拡大' },
  { id: 'nomura',        name: '野村ホールディングス',   industry: '証券',       size: 'large',   region: '東京',   newsHint: '富裕層向けウェルスマネジメント強化、米州事業の改善' },
  { id: 'daiwa',         name: '大和証券グループ',       industry: '証券',       size: 'large',   region: '東京',   newsHint: 'M&A 助言とリテール両軸、ウェルスマネ事業を強化' },
  { id: 'monex',         name: 'マネックスグループ',     industry: '証券',       size: 'mid',     region: '東京',   newsHint: '暗号資産事業に注力、米国 TradeStation との統合' },
  { id: 'sbi',           name: 'SBIホールディングス',    industry: '金融',       size: 'large',   region: '東京',   newsHint: '地銀連合戦略を推進、新生銀行統合効果が顕在化' },
  { id: 'jcb',           name: 'JCB',                    industry: '決済',       size: 'large',   region: '東京',   newsHint: '加盟店データを活用したマーケ支援サービスを強化' },
  { id: 'paypay',        name: 'PayPay',                 industry: '決済',       size: 'large',   region: '東京',   newsHint: '上場準備中、決済データを活用した広告・金融事業へ拡大' },
  { id: 'tokio-marine',  name: '東京海上ホールディングス', industry: '損害保険', size: 'large',   region: '東京',   newsHint: '海外保険事業が成長エンジン、M&A で米欧拡大' },
  { id: 'sompo',         name: 'SOMPO ホールディングス', industry: '損害保険',   size: 'large',   region: '東京',   newsHint: '介護・デジタル事業を成長領域に位置付け' },
  { id: 'ms-ad',         name: 'MS&AD インシュアランスG', industry: '損害保険',  size: 'large',   region: '東京',   newsHint: '海外保険と国内自動車保険が主力、サイバー保険拡大' },
  { id: 'nipponseimei',  name: '日本生命保険',           industry: '生命保険',   size: 'large',   region: '大阪',   newsHint: 'インドや米国への海外投資拡大、デジタル顧客接点を強化' },
  { id: 'dai-ichi-life', name: '第一生命ホールディングス', industry: '生命保険', size: 'large',   region: '東京',   newsHint: '海外生保事業の利益寄与拡大、健康増進型保険を強化' },

  // ─── 商社 ────────────────────────
  { id: 'mitsubishi-corp', name: '三菱商事',             industry: '総合商社',   size: 'large',   region: '東京',   newsHint: 'EX・DX の中期戦略推進、北米シェールガスや再エネ投資' },
  { id: 'mitsui-corp',   name: '三井物産',               industry: '総合商社',   size: 'large',   region: '東京',   newsHint: '資源価格に左右されにくいヘルスケア・モビリティ事業強化' },
  { id: 'itochu',        name: '伊藤忠商事',             industry: '総合商社',   size: 'large',   region: '東京',   newsHint: 'ファミリーマート・繊維事業など非資源分野が強い' },
  { id: 'sumitomo-corp', name: '住友商事',               industry: '総合商社',   size: 'large',   region: '東京',   newsHint: 'メディア・不動産・モビリティに加え、Jupiter Telecommunications 等' },
  { id: 'marubeni',      name: '丸紅',                   industry: '総合商社',   size: 'large',   region: '東京',   newsHint: '電力・穀物・航空機リースが強み、米国農業ビジネスに注力' },
  { id: 'sojitz',        name: '双日',                   industry: '総合商社',   size: 'large',   region: '東京',   newsHint: '自動車・航空・化学に強み、東南アジア展開を強化' },

  // ─── 不動産・建設 ────────────────────────
  { id: 'mitsui-fudosan', name: '三井不動産',            industry: '不動産',     size: 'large',   region: '東京',   newsHint: '日本橋・大手町再開発、海外不動産・スマートシティに投資' },
  { id: 'mitsubishi-estate', name: '三菱地所',           industry: '不動産',     size: 'large',   region: '東京',   newsHint: '丸の内エリア再開発と海外オフィス・物流投資' },
  { id: 'sumitomo-realty', name: '住友不動産',           industry: '不動産',     size: 'large',   region: '東京',   newsHint: '都心オフィス賃貸が主力、注文住宅事業も拡大' },
  { id: 'tokyu-fudosan', name: '東急不動産ホールディングス', industry: '不動産', size: 'large',   region: '東京',   newsHint: '渋谷再開発と環境不動産・再エネ事業を強化' },
  { id: 'nomura-real',   name: '野村不動産ホールディングス', industry: '不動産', size: 'large',   region: '東京',   newsHint: 'PROUD ブランドのマンション開発と賃貸住宅事業' },
  { id: 'daiwa-house',   name: '大和ハウス工業',         industry: '住宅・建設', size: 'large',   region: '大阪',   newsHint: '物流施設・データセンター開発が好調、戸建ては苦戦' },
  { id: 'sekisui-house', name: '積水ハウス',             industry: '住宅',       size: 'large',   region: '大阪',   newsHint: '米国住宅事業の M&A で売上拡大、賃貸住宅も主力' },
  { id: 'kashima',       name: '鹿島建設',               industry: 'ゼネコン',   size: 'large',   region: '東京',   newsHint: '半導体工場・データセンターの大型受注、人手不足が課題' },
  { id: 'shimizu',       name: '清水建設',               industry: 'ゼネコン',   size: 'large',   region: '東京',   newsHint: '再エネ施設や宇宙関連にも参入、施工 DX を推進' },
  { id: 'taisei',        name: '大成建設',               industry: 'ゼネコン',   size: 'large',   region: '東京',   newsHint: '大規模再開発と海外プロジェクトに注力' },
  { id: 'obayashi',      name: '大林組',                 industry: 'ゼネコン',   size: 'large',   region: '東京',   newsHint: '海外工事の収益安定化と建設 DX、ZEB 普及推進' },
  { id: 'open-house',    name: 'オープンハウスグループ', industry: '不動産',     size: 'large',   region: '東京',   newsHint: '都心戸建てと米国不動産投資で急成長' },
  { id: 'lifull',        name: 'LIFULL',                 industry: '不動産ネット', size: 'mid',   region: '東京',   newsHint: '海外不動産ポータルと中古住宅マーケットを強化' },

  // ─── 小売・流通 ────────────────────────
  { id: 'seven-i',       name: 'セブン&アイHD',          industry: '小売',       size: 'large',   region: '東京',   newsHint: 'コンビニ事業に集中、米 7-Eleven の戦略見直し' },
  { id: 'aeon',          name: 'イオン',                 industry: '小売',       size: 'large',   region: '千葉',   newsHint: 'PB トップバリュ強化、デジタル・金融事業も拡大' },
  { id: 'familymart',    name: 'ファミリーマート',       industry: 'コンビニ',   size: 'large',   region: '東京',   newsHint: 'デジタル広告事業「FamilyMartVision」と PB 強化' },
  { id: 'lawson',        name: 'ローソン',               industry: 'コンビニ',   size: 'large',   region: '東京',   newsHint: 'KDDI・三菱商事との 3 社協業、店舗 DX と物販強化' },
  { id: 'fast-retailing',name: 'ファーストリテイリング', industry: 'アパレル',   size: 'large',   region: '山口',   newsHint: 'ユニクロ海外売上が国内超え、東南アジア出店加速' },
  { id: 'shimamura',     name: 'しまむら',               industry: 'アパレル',   size: 'large',   region: '埼玉',   newsHint: 'PB 強化と SNS マーケで若年層獲得、店舗 DX も推進' },
  { id: 'nitori',        name: 'ニトリホールディングス', industry: '家具・小売', size: 'large',   region: '北海道', newsHint: '海外出店と PB 製造、ホームファッションへ展開' },
  { id: 'mujirushi',     name: '良品計画',               industry: '小売',       size: 'large',   region: '東京',   newsHint: '無印良品の中国・東南アジア出店、食品事業を強化' },
  { id: 'don-quijote',   name: 'パン・パシフィック・インターナショナルHD', industry: '小売', size: 'large', region: '東京', newsHint: 'ドン・キホーテのインバウンド需要、アジア出店も拡大' },
  { id: 'matsukiyococokara', name: 'マツキヨココカラ&カンパニー', industry: 'ドラッグストア', size: 'large', region: '千葉', newsHint: '都市型店舗とインバウンド集客で他社との差別化' },
  { id: 'welcia',        name: 'ウエルシアホールディングス', industry: 'ドラッグストア', size: 'large', region: '東京', newsHint: '調剤併設店の拡大、深夜営業と地域連携が強み' },
  { id: 'tsuruha',       name: 'ツルハホールディングス', industry: 'ドラッグストア', size: 'large', region: '北海道', newsHint: 'ウエルシアとの経営統合協議、東日本でドミナント' },
  { id: 'cosmos',        name: 'コスモス薬品',           industry: 'ドラッグストア', size: 'large', region: '福岡', newsHint: '九州を中心とした食品強化型ドラッグストア' },
  { id: 'sundrug',       name: 'サンドラッグ',           industry: 'ドラッグストア', size: 'large', region: '東京', newsHint: '都市型と郊外型を組み合わせた多業態出店' },
  { id: 'yamada',        name: 'ヤマダホールディングス', industry: '家電量販',   size: 'large',   region: '群馬',   newsHint: '家電量販と住宅・家具のクロスセル戦略' },
  { id: 'bic',           name: 'ビックカメラ',           industry: '家電量販',   size: 'large',   region: '東京',   newsHint: 'インバウンド需要回復、コジマとの相乗効果' },
  { id: 'yodobashi',     name: 'ヨドバシカメラ',         industry: '家電量販',   size: 'large',   region: '東京',   newsHint: 'EC のヨドバシ.com が急成長、首都圏物流網が強み' },
  { id: 'shobun',        name: '商船三井',               industry: '海運',       size: 'large',   region: '東京',   newsHint: 'コンテナ船は ONE で運営、自動車船・LNG 船で増益' },
  { id: 'doutor',        name: 'ドトール・日レスホールディングス', industry: '飲食', size: 'mid', region: '東京', newsHint: '都市部のカフェ事業と日本レストランシステムの両軸' },
  { id: 'kirindo',       name: 'キリン堂ホールディングス', industry: 'ドラッグストア', size: 'mid', region: '大阪', newsHint: '関西を中心とした調剤強化と PB 拡充' },

  // ─── 飲食・食品 ────────────────────────
  { id: 'kirin',         name: 'キリンホールディングス', industry: '食品・酒類', size: 'large',   region: '東京',   newsHint: 'ヘルスサイエンス事業強化、海外ビールの選別投資' },
  { id: 'asahi',         name: 'アサヒグループHD',       industry: '食品・酒類', size: 'large',   region: '東京',   newsHint: '欧州事業が成長、中国の不振が課題' },
  { id: 'suntory',       name: 'サントリーホールディングス', industry: '食品・酒類', size: 'large', region: '大阪', newsHint: 'プレミアム蒸留酒のグローバル展開、健康食品も拡大' },
  { id: 'sapporo',       name: 'サッポロホールディングス', industry: '食品・酒類', size: 'large', region: '東京',   newsHint: '不動産・恵比寿エリアの再開発が収益柱に' },
  { id: 'cocacola-japan', name: 'コカ・コーラ ボトラーズジャパン', industry: '飲料', size: 'large', region: '東京', newsHint: '自動販売機の DX とコスト構造改革' },
  { id: 'ito-en',        name: '伊藤園',                 industry: '飲料',       size: 'large',   region: '東京',   newsHint: 'お〜いお茶を世界ブランドに育成、米国市場で成長' },
  { id: 'meiji',         name: '明治ホールディングス',   industry: '食品',       size: 'large',   region: '東京',   newsHint: 'チョコレート・乳製品・医薬の 3 本柱、海外乳製品強化' },
  { id: 'morinaga',      name: '森永製菓',               industry: '食品',       size: 'large',   region: '東京',   newsHint: 'ハイチュウ等の海外展開、健康食品事業 inゼリーも拡大' },
  { id: 'fujioil',       name: '不二製油グループ本社',   industry: '食品素材',   size: 'mid',     region: '大阪',   newsHint: '植物性油脂・大豆たん白で世界トップクラス、ESG 投資先として注目' },
  { id: 'nissin-food',   name: '日清食品ホールディングス', industry: '食品',     size: 'large',   region: '東京',   newsHint: 'カップヌードルの海外売上拡大、プレミアム化路線' },
  { id: 'yamazaki',      name: '山崎製パン',             industry: '食品',       size: 'large',   region: '東京',   newsHint: 'PB 強化とコンビニ向け OEM、海外展開も推進' },
  { id: 'ajinomoto',     name: '味の素',                 industry: '食品',       size: 'large',   region: '東京',   newsHint: '電子材料 ABF の半導体需要が爆発、本業の調味料も堅調' },
  { id: 'kewpie',        name: 'キユーピー',             industry: '食品',       size: 'large',   region: '東京',   newsHint: '海外マヨネーズ事業の拡大、業務用も好調' },
  { id: 'house-foods',   name: 'ハウス食品グループ本社', industry: '食品',       size: 'large',   region: '大阪',   newsHint: '健康食品事業と海外カレー事業の拡大' },
  { id: 'mcdonalds-jp',  name: '日本マクドナルドHD',     industry: '飲食',       size: 'large',   region: '東京',   newsHint: 'モバイルオーダー・デリバリー対応強化' },
  { id: 'skylark',       name: 'すかいらーくホールディングス', industry: '飲食', size: 'large',   region: '東京',   newsHint: 'ガストの DX 化、配膳ロボット導入で人手不足対応' },
  { id: 'zensho',        name: 'ゼンショーホールディングス', industry: '飲食', size: 'large',     region: '東京',   newsHint: 'すき家・はま寿司の海外展開、M&A で多業態化' },
  { id: 'fr',            name: 'FOOD & LIFE COMPANIES',  industry: '飲食',       size: 'large',   region: '大阪',   newsHint: 'スシロー海外展開とサイドメニュー戦略を強化' },
  { id: 'kura',          name: 'くら寿司',               industry: '飲食',       size: 'large',   region: '大阪',   newsHint: '米国・アジア展開、テクノロジー回転寿司モデル' },
  { id: 'monogatari',    name: '物語コーポレーション',   industry: '飲食',       size: 'mid',     region: '愛知',   newsHint: '焼肉きんぐ・丸源ラーメン等多業態、店舗オペレーション DX' },
  { id: 'torikizoku',    name: 'トリキホールディングス', industry: '飲食',       size: 'mid',     region: '大阪',   newsHint: '鳥貴族の単価アップと多業態展開' },
  { id: 'ohsho',         name: '王将フードサービス',     industry: '飲食',       size: 'mid',     region: '京都',   newsHint: '餃子の王将のセントラルキッチン強化、店舗 DX' },
  { id: 'starbucks-jp',  name: 'スターバックス コーヒー ジャパン', industry: '飲食', size: 'large', region: '東京', newsHint: 'モバイルオーダー・地域限定店舗で差別化' },

  // ─── 製薬・医療 ────────────────────────
  { id: 'takeda',        name: '武田薬品工業',           industry: '製薬',       size: 'large',   region: '大阪',   newsHint: '希少疾患・消化器・神経領域に集中、米国売上比率高い' },
  { id: 'astellas',      name: 'アステラス製薬',         industry: '製薬',       size: 'large',   region: '東京',   newsHint: 'ゾルゲンスマ等遺伝子治療薬、Veozah で更年期領域に進出' },
  { id: 'daiichi-sankyo',name: '第一三共',               industry: '製薬',       size: 'large',   region: '東京',   newsHint: 'ADC エンハーツが世界的ブロックバスター候補に' },
  { id: 'chugai',        name: '中外製薬',               industry: '製薬',       size: 'large',   region: '東京',   newsHint: 'ヘムライブラ・ロシュ連携が業績牽引' },
  { id: 'eisai',         name: 'エーザイ',               industry: '製薬',       size: 'large',   region: '東京',   newsHint: 'アルツハイマー治療薬レカネマブの拡大' },
  { id: 'sumitomo-pharma', name: '住友ファーマ',         industry: '製薬',       size: 'large',   region: '大阪',   newsHint: 'ラツーダ特許切れ後の収益回復が課題' },
  { id: 'otsuka',        name: '大塚ホールディングス',   industry: '製薬・食品', size: 'large',   region: '東京',   newsHint: 'エビリファイ・サムスカ等、栄養食品ポカリスエットも' },
  { id: 'kobayashi',     name: '小林製薬',               industry: '日用品・製薬', size: 'large', region: '大阪',   newsHint: '紅麹サプリ問題からの信頼回復と新興国展開が課題' },
  { id: 'rohto',         name: 'ロート製薬',             industry: '医薬・化粧品', size: 'large', region: '大阪',   newsHint: 'スキンケアの肌ラボ・OBAGI、再生医療事業も展開' },
  { id: 'sysmex',        name: 'シスメックス',           industry: '医療機器',   size: 'large',   region: '兵庫',   newsHint: '血球計数装置で世界トップ、診断薬事業も拡大' },
  { id: 'terumo',        name: 'テルモ',                 industry: '医療機器',   size: 'large',   region: '東京',   newsHint: '心臓血管・血液事業が好調、海外売上比率 7 割超' },
  { id: 'olympus',       name: 'オリンパス',             industry: '医療機器',   size: 'large',   region: '東京',   newsHint: '消化器内視鏡で世界シェアトップ、医療事業に専念' },
  { id: 'nipro',         name: 'ニプロ',                 industry: '医療機器',   size: 'large',   region: '大阪',   newsHint: '医療機器・人工腎臓・透析関連が主力' },
  { id: 'm3',            name: 'エムスリー',             industry: '医療プラットフォーム', size: 'large', region: '東京', newsHint: '医師向けプラットフォームから治験 DX・グローバル展開を推進' },
  { id: 'jmdc',          name: 'JMDC',                   industry: '医療データ', size: 'mid',     region: '東京',   newsHint: 'レセプトデータ事業を中心に医療 DX 領域を拡大' },
  { id: 'sgholdings',    name: 'SGホールディングス',     industry: '物流',       size: 'large',   region: '京都',   newsHint: '佐川急便の運賃改定と EC 連携、海外物流も拡大' },

  // ─── 物流・運輸 ────────────────────────
  { id: 'yamato',        name: 'ヤマトホールディングス', industry: '物流',       size: 'large',   region: '東京',   newsHint: 'EC 拡大対応で構造改革進行、Amazon との関係に変化' },
  { id: 'nittsu',        name: 'NIPPON EXPRESS HD',      industry: '物流',       size: 'large',   region: '東京',   newsHint: '海外フォワーディングを強化、半導体物流も拡大' },
  { id: 'kintetsu-express', name: '近鉄エクスプレス',    industry: '物流',       size: 'large',   region: '東京',   newsHint: '航空・海上フォワーディング、欧州物流網も拡大' },
  { id: 'jal',           name: '日本航空 (JAL)',         industry: '航空',       size: 'large',   region: '東京',   newsHint: '国際線とビジネスクラス需要が回復、貨物事業も拡大' },
  { id: 'ana',           name: 'ANAホールディングス',    industry: '航空',       size: 'large',   region: '東京',   newsHint: '中国路線の回復遅れが課題、Peach 連結で LCC 強化' },
  { id: 'jr-east',       name: 'JR東日本',               industry: '鉄道',       size: 'large',   region: '東京',   newsHint: '駅ナカ・都市開発・MaaS で非鉄道収益を強化' },
  { id: 'jr-central',    name: 'JR東海',                 industry: '鉄道',       size: 'large',   region: '愛知',   newsHint: '東海道新幹線が収益柱、リニア中央新幹線が長期投資' },
  { id: 'jr-west',       name: 'JR西日本',               industry: '鉄道',       size: 'large',   region: '大阪',   newsHint: '北陸新幹線延伸、関西エリアの非鉄道事業を強化' },
  { id: 'tokyu',         name: '東急',                   industry: '鉄道・不動産', size: 'large', region: '東京',   newsHint: '渋谷再開発と沿線価値向上、海外事業はまだ小規模' },
  { id: 'mol',           name: '商船三井',               industry: '海運',       size: 'large',   region: '東京',   newsHint: 'LNG 船・自動車船・洋上風力分野で事業拡大' },

  // ─── エンタメ・出版・メディア ────────────────────────
  { id: 'bandai-namco',  name: 'バンダイナムコホールディングス', industry: 'エンタメ', size: 'large', region: '東京', newsHint: 'IP ファースト戦略、ガンダム・鬼滅で世界展開' },
  { id: 'square-enix',   name: 'スクウェア・エニックスHD', industry: 'ゲーム',  size: 'large',   region: '東京',   newsHint: 'マルチプラットフォーム戦略、FF・DQ の続編戦略' },
  { id: 'koei-tecmo',    name: 'コーエーテクモホールディングス', industry: 'ゲーム', size: 'mid', region: '神奈川', newsHint: '海外向けタイトル拡大、IP コラボ作品も好調' },
  { id: 'capcom',        name: 'カプコン',               industry: 'ゲーム',     size: 'large',   region: '大阪',   newsHint: 'モンハン・バイオハザード IP の継続的なヒット' },
  { id: 'konami',        name: 'コナミグループ',         industry: 'ゲーム・アミューズメント', size: 'large', region: '東京', newsHint: 'eスポーツ・モバイルゲームの収益拡大' },
  { id: 'sega-sammy',    name: 'セガサミーホールディングス', industry: 'ゲーム', size: 'large',   region: '東京',   newsHint: 'パチスロ・ゲーム両軸、IR (統合型リゾート) 進出' },
  { id: 'taito',         name: 'タイトー',               industry: 'ゲーム',     size: 'mid',     region: '東京',   newsHint: 'スクエニ傘下、アーケード・モバイル両軸' },
  { id: 'kadokawa',      name: 'KADOKAWA',               industry: '出版・エンタメ', size: 'large', region: '東京', newsHint: 'IP の多メディア展開、サイバー攻撃からの復旧後の体制強化' },
  { id: 'shogakukan',    name: '小学館',                 industry: '出版',       size: 'mid',     region: '東京',   newsHint: '電子コミック海外売上拡大、ジャンプとの IP 競合' },
  { id: 'shueisha',      name: '集英社',                 industry: '出版',       size: 'mid',     region: '東京',   newsHint: 'ジャンプブランドのグローバル展開、IP ライセンスで成長' },
  { id: 'kodansha',      name: '講談社',                 industry: '出版',       size: 'mid',     region: '東京',   newsHint: '電子コミックと IP ライセンス収益が成長、海外編集部設立' },
  { id: 'asahi-shimbun', name: '朝日新聞社',             industry: 'メディア',   size: 'large',   region: '東京',   newsHint: 'デジタル化加速、有料電子版会員獲得が経営課題' },
  { id: 'yomiuri',       name: '読売新聞グループ本社',   industry: 'メディア',   size: 'large',   region: '東京',   newsHint: '全国紙最大発行部数だがデジタル展開が課題' },
  { id: 'nhk-ent',       name: 'NHK エンタープライズ',   industry: 'メディア',   size: 'mid',     region: '東京',   newsHint: '番組制作の海外展開、IP ライセンス事業を強化' },
  { id: 'wowow',         name: 'WOWOW',                  industry: 'メディア',   size: 'mid',     region: '東京',   newsHint: '配信プラットフォームへの移行、スポーツ中継強化' },
  { id: 'avex',          name: 'エイベックス',           industry: 'エンタメ',   size: 'mid',     region: '東京',   newsHint: '音楽ライブ事業の好調、グローバル IP 育成' },

  // ─── アパレル・ファッション・化粧品 ────────────────────────
  { id: 'shiseido',      name: '資生堂',                 industry: '化粧品',     size: 'large',   region: '東京',   newsHint: '中国市場の回復と日本ブランド再強化、トラベル小売が課題' },
  { id: 'kao',           name: '花王',                   industry: '日用品・化粧品', size: 'large', region: '東京', newsHint: '中国市場とコモディティ事業の構造改革' },
  { id: 'pola-orbis',    name: 'ポーラ・オルビスHD',     industry: '化粧品',     size: 'mid',     region: '東京',   newsHint: 'プレステージ化粧品とアジア市場開拓' },
  { id: 'unicharm',      name: 'ユニ・チャーム',         industry: '日用品',     size: 'large',   region: '愛媛',   newsHint: 'おむつ・生理用品のアジア展開、ペット用品も成長' },
  { id: 'kose',          name: 'コーセー',               industry: '化粧品',     size: 'large',   region: '東京',   newsHint: '雪肌精・ALBION のグローバル展開、米 Tarte 連結' },
  { id: 'mandom',        name: 'マンダム',               industry: '化粧品',     size: 'mid',     region: '大阪',   newsHint: '男性化粧品ギャツビー、アジア市場で成長' },
  { id: 'adastria',      name: 'アダストリア',           industry: 'アパレル',   size: 'large',   region: '東京',   newsHint: 'GLOBAL WORK・niko and… 等、店舗 OMO 強化' },
  { id: 'baycurrent',    name: 'BAYCREW\'S',             industry: 'アパレル',   size: 'mid',     region: '東京',   newsHint: 'ジャーナルスタンダード等、セレクトショップ業態' },
  { id: 'workman',       name: 'ワークマン',             industry: 'アパレル',   size: 'large',   region: '群馬',   newsHint: '作業服から一般向け・ヘルメット・キャンプ用品へ拡大' },
  { id: 'asics',         name: 'アシックス',             industry: 'スポーツ用品', size: 'large', region: '兵庫',   newsHint: 'ランニングシューズの世界的ヒット、株価が大幅上昇' },
  { id: 'mizuno',        name: 'ミズノ',                 industry: 'スポーツ用品', size: 'large', region: '大阪',   newsHint: 'ゴルフ・野球の海外展開、ライフスタイル分野も' },
  { id: 'descente',      name: 'デサント',               industry: 'スポーツ用品', size: 'large', region: '大阪',   newsHint: '伊藤忠と韓国 LF 系の体制下、アジア展開強化' },
  { id: 'goldwin',       name: 'ゴールドウイン',         industry: 'スポーツ用品', size: 'large', region: '東京',   newsHint: 'THE NORTH FACE 国内ライセンスが収益柱' },

  // ─── 教育 ────────────────────────
  { id: 'benesse',       name: 'ベネッセホールディングス', industry: '教育',     size: 'large',   region: '岡山',   newsHint: 'MBO 後の再建中、進研ゼミの DX 化と介護事業' },
  { id: 'recruit-edu',   name: 'リクルートマーケティングパートナーズ', industry: '教育', size: 'mid', region: '東京', newsHint: 'スタディサプリの国内外展開、英語 4 技能対応強化' },
  { id: 'gakken',        name: '学研ホールディングス',   industry: '教育・介護', size: 'large',   region: '東京',   newsHint: '出版から教室・介護・医療まで広域に展開' },
  { id: 'kumon',         name: 'KUMON (公文教育研究会)', industry: '教育',       size: 'large',   region: '大阪',   newsHint: '海外学習者数が国内を超え、デジタル化を推進' },
  { id: 'sapix',         name: 'SAPIX',                  industry: '教育',       size: 'mid',     region: '東京',   newsHint: '中学受験塾の最大手、首都圏での圧倒的なシェア' },
  { id: 'lifellone',     name: 'ライフネット',           industry: 'EdTech',     size: 'startup', region: '東京',   newsHint: 'オンライン MBA・社会人教育で BIZREACH 系と協業' },

  // ─── エネルギー・素材 ────────────────────────
  { id: 'eneos',         name: 'ENEOS ホールディングス', industry: '石油・エネルギー', size: 'large', region: '東京', newsHint: 'カーボンニュートラル戦略、銅・水素・再エネに投資' },
  { id: 'idemitsu',      name: '出光興産',               industry: '石油・エネルギー', size: 'large', region: '東京', newsHint: '石油精製と全固体電池材料、再生可能エネルギーに投資' },
  { id: 'cosmo',         name: 'コスモエネルギーHD',     industry: '石油',       size: 'large',   region: '東京',   newsHint: '風力発電・水素事業を成長領域に位置付け' },
  { id: 'tepco',         name: '東京電力ホールディングス', industry: '電力',     size: 'large',   region: '東京',   newsHint: '柏崎刈羽再稼働、再エネ事業と廃炉が長期課題' },
  { id: 'kepco',         name: '関西電力',               industry: '電力',       size: 'large',   region: '大阪',   newsHint: '原発再稼働で収益回復、情報通信子会社オプテージも好調' },
  { id: 'chubu-electric',name: '中部電力',               industry: '電力',       size: 'large',   region: '愛知',   newsHint: 'JERA を通じた LNG 事業と再エネへの投資' },
  { id: 'tokyo-gas',     name: '東京ガス',               industry: 'ガス',       size: 'large',   region: '東京',   newsHint: 'LNG と再エネ、電力小売との総合エネルギーサービス' },
  { id: 'osaka-gas',     name: '大阪ガス',               industry: 'ガス',       size: 'large',   region: '大阪',   newsHint: '海外 LNG・再エネ事業と国内エネルギーソリューション' },
  { id: 'mitsubishi-chem',name: '三菱ケミカルグループ',  industry: '化学',       size: 'large',   region: '東京',   newsHint: '事業ポートフォリオ再編、医薬・電池材料を強化' },
  { id: 'sumitomo-chem', name: '住友化学',               industry: '化学',       size: 'large',   region: '東京',   newsHint: '農薬・医薬・電子材料・石油化学の 4 本柱' },
  { id: 'asahi-kasei',   name: '旭化成',                 industry: '化学・繊維', size: 'large',   region: '東京',   newsHint: '住宅・ヘルスケア・素材の 3 本柱、車載リチウムイオン電池' },
  { id: 'shin-etsu',     name: '信越化学工業',           industry: '化学',       size: 'large',   region: '東京',   newsHint: '塩化ビニル・半導体シリコンウエハーで世界トップシェア' },
  { id: 'mitsubishi-materials', name: '三菱マテリアル',  industry: '非鉄金属',   size: 'large',   region: '東京',   newsHint: '銅事業とリサイクル事業、半導体材料も成長領域' },
  { id: 'sumitomo-metal',name: '住友金属鉱山',           industry: '非鉄金属',   size: 'large',   region: '東京',   newsHint: '銅・ニッケル・コバルト等の電池材料、資源価格動向に左右' },
  { id: 'nippon-steel',  name: '日本製鉄',               industry: '鉄鋼',       size: 'large',   region: '東京',   newsHint: 'US Steel 買収交渉、構造改革と高付加価値鋼材' },
  { id: 'jfe',           name: 'JFEホールディングス',    industry: '鉄鋼',       size: 'large',   region: '東京',   newsHint: '鉄鋼・エンジニアリング・商社の 3 本柱' },
  { id: 'kobelco',       name: '神戸製鋼所',             industry: '鉄鋼',       size: 'large',   region: '兵庫',   newsHint: '鉄鋼・アルミ・建設機械の 3 軸、ESG 対応強化' },

  // ─── ホテル・観光 ────────────────────────
  { id: 'hotel-okura',   name: 'オークラホールディングス', industry: 'ホテル',   size: 'mid',     region: '東京',   newsHint: 'インバウンド回復で都心高級ホテル好調' },
  { id: 'prince-hotels', name: '西武ホールディングス',   industry: 'ホテル・鉄道', size: 'large', region: '埼玉',   newsHint: 'プリンスホテルのインバウンド対応強化、鉄道との連携' },
  { id: 'apa',           name: 'アパグループ',           industry: 'ホテル',     size: 'large',   region: '東京',   newsHint: '直営型シティホテルの拡大、海外展開も視野に' },
  { id: 'fujita-kanko',  name: '藤田観光',               industry: 'ホテル',     size: 'mid',     region: '東京',   newsHint: 'ワシントンホテル・椿山荘ブランドの再強化' },
  { id: 'jtb',           name: 'JTB',                    industry: '旅行',       size: 'large',   region: '東京',   newsHint: 'インバウンドと法人ソリューション (BTM) に注力' },
  { id: 'hisgroup',      name: 'エイチ・アイ・エス (H.I.S.)', industry: '旅行', size: 'large',   region: '東京',   newsHint: '海外旅行事業の再建、ハウステンボス売却で財務改善' },
  { id: 'kyoritsu',      name: '共立メンテナンス',       industry: 'ホテル・寮', size: 'mid',     region: '東京',   newsHint: 'ドーミーインのインバウンド対応、学生寮事業も安定' },

  // ─── 広告・マーケティング ────────────────────────
  { id: 'dentsu',        name: '電通グループ',           industry: '広告',       size: 'large',   region: '東京',   newsHint: '海外事業のリストラ、国内デジタル広告のシェア維持' },
  { id: 'hakuhodo',      name: '博報堂DYホールディングス', industry: '広告',     size: 'large',   region: '東京',   newsHint: 'プラットフォーム広告対応とクリエイティブ強化' },
  { id: 'septeni',       name: 'セプテーニ・ホールディングス', industry: '広告', size: 'mid',     region: '東京',   newsHint: 'デジタル広告運用と AI 領域への投資' },
  { id: 'macromill',     name: 'マクロミル',             industry: 'マーケティング', size: 'mid', region: '東京',   newsHint: 'インターネットリサーチ大手、AI 分析を強化' },
  { id: 'irep',          name: 'アイレップ',             industry: '広告',       size: 'mid',     region: '東京',   newsHint: '検索広告に強み、博報堂 DY 傘下で事業拡大' },

  // ─── コンサル・専門サービス ────────────────────────
  { id: 'mri',           name: '三菱総合研究所',         industry: 'シンクタンク', size: 'mid',   region: '東京',   newsHint: '官公庁向け政策研究、企業向け DX コンサルも拡大' },
  { id: 'nri-cons',      name: '野村総合研究所 (NRI コンサル部門)', industry: 'コンサル', size: 'large', region: '東京', newsHint: '金融・公共・流通へのコンサル + システム実装の両軸' },
  { id: 'abeam',         name: 'アビームコンサルティング', industry: 'コンサル', size: 'large',   region: '東京',   newsHint: 'NEC 系、SAP 導入と DX コンサル' },
  { id: 'pasona',        name: 'パソナグループ',         industry: '人材',       size: 'large',   region: '東京',   newsHint: '本社機能の淡路島移転、BPO・地方創生事業を強化' },
  { id: 'recruit-staff', name: 'リクルートスタッフィング', industry: '人材',     size: 'large',   region: '東京',   newsHint: 'リクルート傘下、人材派遣と紹介事業' },
  { id: 'fullcast',      name: 'フルキャストホールディングス', industry: '人材', size: 'mid',     region: '東京',   newsHint: 'スポット派遣に強み、軽作業・物流案件が伸長' },

  // ─── 不動産・建設 (中堅) ────────────────────────
  { id: 'haseko',        name: '長谷工コーポレーション', industry: '建設',       size: 'large',   region: '東京',   newsHint: 'マンション建設で国内トップ、不動産管理も拡大' },
  { id: 'ichigo',        name: 'いちご',                 industry: '不動産',     size: 'mid',     region: '東京',   newsHint: '中古不動産再生と再エネ事業の両軸' },
  { id: 'leopalace21',   name: 'レオパレス21',           industry: '不動産',     size: 'mid',     region: '東京',   newsHint: '施工不良問題からの再建、外国人住居サービス強化' },
  { id: 'lifullhomes',   name: 'LIFULL HOME\'S',         industry: '不動産メディア', size: 'mid', region: '東京',   newsHint: '不動産情報サイトの差別化、海外展開を加速' },

  // ─── スタートアップ・新興 (非上場含む) ────────────────────────
  { id: 'preferred',     name: 'Preferred Networks',     industry: 'AI',         size: 'mid',     region: '東京',   newsHint: '生成 AI と独自半導体 MN-Core、ヘルスケア・教育に展開' },
  { id: 'sakana-ai',     name: 'Sakana AI',              industry: 'AI',         size: 'startup', region: '東京',   newsHint: '日本発 LLM、進化的アルゴリズムによるモデル統合' },
  { id: 'rinna',         name: 'rinna',                  industry: 'AI',         size: 'startup', region: '東京',   newsHint: '日本語特化型 LLM の B2B 展開' },
  { id: 'shippio',       name: 'Shippio',                industry: '物流 SaaS',  size: 'startup', region: '東京',   newsHint: '国際物流 DX のフォワーディング SaaS' },
  { id: 'estyle',        name: 'エニグモ',               industry: 'EC',         size: 'mid',     region: '東京',   newsHint: '海外アパレル EC BUYMA、円安が追い風' },
  { id: 'minkabu',       name: 'みんかぶ',               industry: 'Fintech',    size: 'mid',     region: '東京',   newsHint: '個人投資家向けメディア・分析ツール、新 NISA で追い風' },
  { id: 'finatext',      name: 'Finatext',               industry: 'Fintech',    size: 'startup', region: '東京',   newsHint: '証券・保険業界向け SaaS、BaaS 展開' },
  { id: 'kanmu',         name: 'カンム',                 industry: 'Fintech',    size: 'startup', region: '東京',   newsHint: 'バンドルカード、MUFG 傘下でカード事業拡大' },
  { id: 'mc-data-plus',  name: 'MC データプラス',        industry: '建設 SaaS',  size: 'mid',     region: '東京',   newsHint: '建設現場の作業員入退場管理 SaaS、IPO 後成長' },
  { id: 'spiber',        name: 'Spiber',                 industry: 'バイオ素材', size: 'mid',     region: '山形',   newsHint: 'タンパク質素材 Brewed Protein を THE NORTH FACE 等で採用' },
  { id: 'tier4',         name: 'TIER IV',                industry: '自動運転',   size: 'mid',     region: '東京',   newsHint: '自動運転 OS Autoware、ロボタクシー実証実験' },
  { id: 'ascent',        name: 'ascent Robotics',        industry: 'AI・ロボット', size: 'startup', region: '東京', newsHint: '物流倉庫向け汎用ロボット AI、Microsoft と提携' },
  { id: 'jam',           name: 'jam',                    industry: 'AI コンテンツ', size: 'startup', region: '東京', newsHint: '生成 AI による広告クリエイティブ制作 SaaS' },
  { id: 'algomatic',     name: 'Algomatic',              industry: 'AI',         size: 'startup', region: '東京',   newsHint: '生成 AI ネイティブのプロダクト群を多数立ち上げ' },
  { id: 'stockmark',     name: 'ストックマーク',         industry: 'AI',         size: 'startup', region: '東京',   newsHint: '法人向けニュース AI Anews、自社 LLM 開発も推進' },
  { id: 'kotozna',       name: 'Kotozna',                industry: 'AI 翻訳',    size: 'startup', region: '東京',   newsHint: 'リアルタイム多言語チャット、観光業向けで導入拡大' },
  { id: 'panasonic-connect', name: 'パナソニックコネクト', industry: 'B2B IT',   size: 'large',   region: '東京',   newsHint: '生成 AI ConnectAI を全社展開、サプライチェーン SaaS Blue Yonder' },
  { id: 'lawson-ec',     name: 'KADOKAWA DREAM',         industry: 'EC',         size: 'startup', region: '東京',   newsHint: 'IP コラボ商品の EC を強化' },
  { id: 'rebase',        name: 'Rebase',                 industry: 'スペースシェア', size: 'startup', region: '東京', newsHint: 'スペースマーケット型レンタル、地方創生連携' },
  { id: 'visasq',        name: 'ビザスク',               industry: 'スポットコンサル', size: 'mid', region: '東京', newsHint: 'スポットコンサルマッチング、海外案件も拡大' },
  { id: 'oikawa',        name: '及川電気',               industry: '製造業',     size: 'mid',     region: '神奈川', newsHint: '電子部品・センサーの受託製造、自動車関連も' },
  { id: 'autify',        name: 'Autify',                 industry: 'AI テスト',  size: 'startup', region: '東京',   newsHint: 'AI による Web/モバイルテスト自動化、海外導入も拡大' },
  { id: 'ubie',          name: 'Ubie',                   industry: 'HealthTech', size: 'mid',     region: '東京',   newsHint: '症状検索エンジン、製薬・医療機関向けへも展開' },
  { id: 'atrae',         name: 'アトラエ',               industry: 'HR Tech',    size: 'mid',     region: '東京',   newsHint: '組織サーベイ Wevox、エンゲージメント測定 SaaS' },
  { id: 'hubble',        name: 'ハブル',                 industry: 'リーガル Tech', size: 'startup', region: '東京', newsHint: '契約書管理・レビュー SaaS、AI 機能拡充中' },
  { id: 'legalon',       name: 'LegalOn Technologies',   industry: 'リーガル Tech', size: 'mid',  region: '東京',   newsHint: 'AI 契約書レビュー、米国にも展開' },
  { id: 'mfs',           name: 'MFS',                    industry: 'Fintech',    size: 'startup', region: '東京',   newsHint: '住宅ローン比較 SaaS モゲチェック、住宅ローン領域を深耕' },

  // ─── 中堅メーカー (BtoB) ────────────────────────
  { id: 'fanuc',         name: 'ファナック',             industry: 'FA',         size: 'large',   region: '山梨',   newsHint: '工作機械 CNC とロボット、中国市況の影響を受ける' },
  { id: 'yaskawa',       name: '安川電機',               industry: 'FA',         size: 'large',   region: '福岡',   newsHint: 'サーボモータ・ロボットで世界トップクラス、AI 連携' },
  { id: 'keyence',       name: 'キーエンス',             industry: 'FA',         size: 'large',   region: '大阪',   newsHint: '高収益のセンサー・計測機器メーカー、海外売上比率高い' },
  { id: 'smc',           name: 'SMC',                    industry: 'FA',         size: 'large',   region: '東京',   newsHint: '空気圧機器で世界トップ、半導体向け需要が成長' },
  { id: 'misumi',        name: 'ミスミグループ本社',     industry: 'BtoB EC',    size: 'large',   region: '東京',   newsHint: '機械部品 EC、AI 見積もり meviy で製造業 DX' },
  { id: 'monotaro',      name: 'MonotaRO',               industry: 'BtoB EC',    size: 'large',   region: '兵庫',   newsHint: '間接資材通販、中堅企業向け事業の拡大' },
  { id: 'amada',         name: 'アマダ',                 industry: '工作機械',   size: 'large',   region: '神奈川', newsHint: '板金加工機械の世界大手、自動化ソリューション' },
  { id: 'mori-seiki',    name: 'DMG 森精機',             industry: '工作機械',   size: 'large',   region: '愛知',   newsHint: '高精度マシニングセンタ、AI 加工最適化' },
  { id: 'okuma',         name: 'オークマ',               industry: '工作機械',   size: 'large',   region: '愛知',   newsHint: '工作機械の自動化・無人化ソリューション' },
  { id: 'komatsu',       name: 'コマツ',                 industry: '建設機械',   size: 'large',   region: '東京',   newsHint: 'スマートコンストラクション、鉱山自動運転' },
  { id: 'hitachi-cm',    name: '日立建機',               industry: '建設機械',   size: 'large',   region: '東京',   newsHint: 'ICT 建機と部品再生ビジネス、北米事業強化' },
  { id: 'kubota',        name: 'クボタ',                 industry: '農機',       size: 'large',   region: '大阪',   newsHint: 'スマート農業と海外建機事業、米国市場が主軸' },
  { id: 'yanmar',        name: 'ヤンマーホールディングス', industry: '農機',     size: 'large',   region: '大阪',   newsHint: '農機・舶用エンジン・建機の 3 軸、スマート農業に投資' },

  // ─── ヘルスケア・介護 ────────────────────────
  { id: 'panasonic-age', name: 'パナソニック エイジフリー', industry: '介護',   size: 'mid',     region: '大阪',   newsHint: 'デイサービス・住宅型介護施設、介護 DX 推進' },
  { id: 'nichii',        name: 'ニチイ学館',             industry: '介護・教育', size: 'large',   region: '東京',   newsHint: '医療事務・介護事業の大手、MBO で非上場化' },
  { id: 'sun-mark',      name: 'SOMPO ケア',             industry: '介護',       size: 'large',   region: '東京',   newsHint: 'SOMPO HD 傘下、デジタル化と人材確保が課題' },
  { id: 'mcs',           name: 'メディカル・ケア・サービス', industry: '介護',   size: 'mid',     region: '埼玉',   newsHint: 'グループホームに特化、外国人材活用' },
  { id: 'tsukui',        name: 'ツクイホールディングス', industry: '介護',       size: 'mid',     region: '神奈川', newsHint: 'デイサービス・訪問介護の大手、地方拠点を強化' },
  { id: 'optim',         name: 'オプティム',             industry: 'AI・IoT',    size: 'mid',     region: '東京',   newsHint: '医療・農業・建設の現場 AI ソリューション' },

  // ─── 中堅・地方有力企業 ────────────────────────
  { id: 'lixil',         name: 'LIXIL',                  industry: '住宅設備',   size: 'large',   region: '東京',   newsHint: '住宅設備の国内大手、米国 ASD 売却で構造改革' },
  { id: 'toto',          name: 'TOTO',                   industry: '住宅設備',   size: 'large',   region: '福岡',   newsHint: 'ウォシュレットの世界展開、中国市況回復が課題' },
  { id: 'noritz',        name: 'ノーリツ',               industry: '住宅設備',   size: 'mid',     region: '兵庫',   newsHint: '給湯器の脱炭素化と中国市場対応' },
  { id: 'rinnai',        name: 'リンナイ',               industry: '住宅設備',   size: 'large',   region: '愛知',   newsHint: '北米市場でのタンクレス給湯器シェア拡大' },
  { id: 'daikin',        name: 'ダイキン工業',           industry: '空調',       size: 'large',   region: '大阪',   newsHint: '世界トップの空調メーカー、ヒートポンプ需要で欧州拡大' },
  { id: 'mitsubishi-heavy', name: '三菱重工業',          industry: '重工業',     size: 'large',   region: '東京',   newsHint: '防衛・GTCC・水素事業に成長期待、航空機事業は撤退' },
  { id: 'kawasaki-heavy', name: '川崎重工業',            industry: '重工業',     size: 'large',   region: '兵庫',   newsHint: '水素ガスタービン・水素サプライチェーンで世界先行' },
  { id: 'ihi',           name: 'IHI',                    industry: '重工業',     size: 'large',   region: '東京',   newsHint: '航空エンジン・宇宙事業、火力発電も継続的に堅調' },
  { id: 'jera',          name: 'JERA',                   industry: '電力',       size: 'large',   region: '東京',   newsHint: '東電・中電 50:50 出資、LNG と再エネ・水素事業' },
  { id: 'rakuten-bank',  name: '楽天銀行',               industry: '銀行',       size: 'mid',     region: '東京',   newsHint: 'ネット銀行国内最大、楽天経済圏との連携が強み' },
  { id: 'sbi-shinsei',   name: 'SBI 新生銀行',           industry: '銀行',       size: 'large',   region: '東京',   newsHint: 'SBI 統合効果、リテール改革と地銀連携' },
  { id: 'cyberagent-game', name: 'Cygames',              industry: 'ゲーム',     size: 'mid',     region: '東京',   newsHint: 'ウマ娘プリティーダービー、グラブル等の IP 展開' },
  { id: 'sea-mountain',  name: '海山ホールディングス',   industry: '水産',       size: 'mid',     region: '東京',   newsHint: 'マグロ養殖とサーモン養殖、輸出向け強化' },
  { id: 'maruha-nichiro', name: 'マルハニチロ',          industry: '水産・食品', size: 'large',   region: '東京',   newsHint: '水産物加工と冷凍食品、海外養殖事業を強化' },
  { id: 'nh-foods',      name: '日本ハム',               industry: '食品',       size: 'large',   region: '大阪',   newsHint: '畜産物加工と植物代替肉、海外ハム・ソーセージ事業' },
  { id: 'ito-ham',       name: 'プリマハム',             industry: '食品',       size: 'large',   region: '東京',   newsHint: 'ハム・ソーセージと水産加工、中食事業強化' },
  { id: 'snow-brand',    name: '雪印メグミルク',         industry: '食品',       size: 'large',   region: '東京',   newsHint: '酪農生乳事業、機能性ヨーグルトに注力' },

  // ─── ベンチャー・特殊領域 ────────────────────────
  { id: 'zozo',          name: 'ZOZO',                   industry: 'EC',         size: 'large',   region: '千葉',   newsHint: 'ZOZOTOWN の堅調成長、ZOZOSUIT 2 や AI 接客強化' },
  { id: 'asbit',         name: 'BASE',                   industry: 'EC',         size: 'mid',     region: '東京',   newsHint: '個人向け EC 構築、決済 PAY.JP で収益化加速' },
  { id: 'shopify-jp',    name: 'Shopify Japan',          industry: 'EC',         size: 'mid',     region: '東京',   newsHint: '中堅 EC への上位プラン浸透、B2B 機能を強化' },
  { id: 'minne',         name: 'GMO ペパボ',             industry: 'EC・ホスティング', size: 'mid', region: '東京', newsHint: 'minne・カラーミー・SUZURI、個人クリエイター EC' },
  { id: 'cookpad',       name: 'クックパッド',           industry: 'ネット',     size: 'mid',     region: '東京',   newsHint: '海外事業のリストラ、AI レシピ提案で再成長を模索' },
  { id: 'menicon',       name: 'メニコン',               industry: '医療機器',   size: 'large',   region: '愛知',   newsHint: 'コンタクトレンズ、メルスプラン会員数拡大' },
  { id: 'nichicon',      name: 'ニチコン',               industry: '電子部品',   size: 'mid',     region: '京都',   newsHint: 'EV 用車載コンデンサと家庭用蓄電池が成長' },
  { id: 'sumco-tek',     name: 'SUMCO TECHXIV',          industry: '半導体材料', size: 'mid',     region: '佐賀',   newsHint: 'シリコンウエハ製造、AI 半導体需要が追い風' },
  { id: 'jdc',           name: '日本デジタル研究所',     industry: 'IT・会計',   size: 'mid',     region: '東京',   newsHint: '中小企業向け会計・税務システム JDL ブランド' },
  { id: 'tkc',           name: 'TKC',                    industry: 'IT・会計',   size: 'mid',     region: '栃木',   newsHint: '税理士会計事務所向け SaaS、自治体システムも展開' },
  { id: 'pca',           name: 'ピー・シー・エー',       industry: 'SaaS',       size: 'mid',     region: '東京',   newsHint: '中堅企業向け会計・販売管理 SaaS' },
  { id: 'rakuten-pay',   name: '楽天ペイメント',         industry: '決済',       size: 'mid',     region: '東京',   newsHint: 'コード決済 (楽天ペイ)、楽天経済圏内ポイント連携' },
  { id: 'aucnet',        name: 'オークネット',           industry: 'B2B EC',     size: 'mid',     region: '東京',   newsHint: '中古車・ブランド品・花卉のオークションプラットフォーム' },
  { id: 'auctus',        name: 'カイカ',                 industry: '金融 IT',    size: 'mid',     region: '東京',   newsHint: '暗号資産・ブロックチェーン関連事業' },

  // ─── 地方経済を担う企業 ────────────────────────
  { id: 'nissin-seifun', name: '日清製粉グループ本社',   industry: '食品',       size: 'large',   region: '東京',   newsHint: '製粉・パスタ・健康食品、海外製粉事業も拡大' },
  { id: 'showa-sangyo',  name: '昭和産業',               industry: '食品',       size: 'mid',     region: '東京',   newsHint: '製粉・油脂事業、業務用・PB 強化' },
  { id: 'mitsui-sugar',  name: '三井 DM 砂糖ホールディングス', industry: '食品', size: 'mid',    region: '東京',   newsHint: '砂糖事業と製品多角化、海外原料調達' },
  { id: 'yakult',        name: 'ヤクルト本社',           industry: '食品',       size: 'large',   region: '東京',   newsHint: '海外売上比率高い、ヤクルト 1000 の機能性訴求成功' },
  { id: 'kameda',        name: '亀田製菓',               industry: '食品',       size: 'mid',     region: '新潟',   newsHint: '米菓の海外展開、亀田の柿の種をグローバルブランド化' },
  { id: 'shimano',       name: 'シマノ',                 industry: 'スポーツ用品', size: 'large', region: '大阪',   newsHint: '自転車部品で世界シェアトップ、北米市場で在庫調整' },
  { id: 'lion',          name: 'ライオン',               industry: '日用品',     size: 'large',   region: '東京',   newsHint: 'オーラルケア・ハミガキ、東南アジア市場で成長' },
  { id: 'p-and-g-jp',    name: 'P&G ジャパン',           industry: '日用品',     size: 'large',   region: '兵庫',   newsHint: '高付加価値ブランド戦略、SK-II 等プレステージ' },
  { id: 'kojima',        name: '小島プレス工業',         industry: '自動車部品', size: 'mid',     region: '愛知',   newsHint: 'トヨタ系内装部品、樹脂成型に強み' },
  { id: 'mabuchi-motor', name: 'マブチモーター',         industry: '電機',       size: 'large',   region: '千葉',   newsHint: '小型モータで世界シェアトップ、車載 EV 部品にも展開' },
  { id: 'nidec',         name: 'ニデック',               industry: '電機',       size: 'large',   region: '京都',   newsHint: '車載トラクションモータ事業の収益化が課題、M&A で多角化' },
  { id: 'horiba',        name: '堀場製作所',             industry: '計測機器',   size: 'large',   region: '京都',   newsHint: '半導体製造装置向けの質量流量計や排ガス計測装置' },
  { id: 'shimadzu',      name: '島津製作所',             industry: '計測機器',   size: 'large',   region: '京都',   newsHint: '分析計測機器と医療機器、ノーベル賞研究者輩出' },
  { id: 'olympus-life',  name: 'エビデント',             industry: '光学機器',   size: 'mid',     region: '東京',   newsHint: 'オリンパスの科学事業を分社化、産業用顕微鏡' },
  { id: 'mitsutoyo',     name: 'ミツトヨ',               industry: '計測機器',   size: 'large',   region: '神奈川', newsHint: '精密測定機器で世界トップクラス、半導体向け需要' },

  // ─── 中堅 SI・IT ────────────────────────
  { id: 'works-applications', name: 'ワークスアプリケーションズ', industry: 'SaaS', size: 'mid', region: '東京', newsHint: '人事給与システム HUE、PE 系傘下で再建中' },
  { id: 'mejar',         name: 'メジャー',               industry: 'IT',         size: 'mid',     region: '東京',   newsHint: '銀行系メインフレーム共同センター、機能拡張' },
  { id: 'jbcc',          name: 'JBCCホールディングス',   industry: 'SIer',       size: 'mid',     region: '東京',   newsHint: 'クラウドインテグレーション、中堅企業向け' },
  { id: 'argo',          name: 'アルゴグラフィックス',   industry: 'IT',         size: 'mid',     region: '東京',   newsHint: 'CAD/PLM 領域に強み、製造業 DX' },
  { id: 'cyber-link',    name: 'サイバーリンクス',       industry: 'IT・通信',   size: 'mid',     region: '和歌山', newsHint: '流通業向け SaaS と地域通信事業' },
  { id: 'computer-engineering', name: 'コンピュータエンジニアリング', industry: 'SIer', size: 'mid', region: '兵庫', newsHint: '関西を中心とした SI、製造業向けが主力' },

  // ─── スポーツ・エンタメ ────────────────────────
  { id: 'oricon',        name: 'オリコン',               industry: 'メディア',   size: 'startup', region: '東京',   newsHint: 'ランキング・顧客満足度調査、エンタメ IP データ' },
  { id: 'doga',          name: '東映',                   industry: 'エンタメ',   size: 'large',   region: '東京',   newsHint: '映画・アニメ IP、ドラゴンボール・ワンピース等' },
  { id: 'toho',          name: '東宝',                   industry: 'エンタメ',   size: 'large',   region: '東京',   newsHint: 'シン・エヴァや邦画ヒット、映画・演劇・不動産の 3 軸' },
  { id: 'shochiku',      name: '松竹',                   industry: 'エンタメ',   size: 'mid',     region: '東京',   newsHint: '歌舞伎・映画・演劇、IP のグローバル展開' },
  { id: 'rakuten-mobile',name: '楽天モバイル',           industry: '通信',       size: 'large',   region: '東京',   newsHint: '基地局完全仮想化と AI 制御、楽天経済圏との連携' },

  // ─── 地銀・地方有力 ────────────────────────
  { id: 'fukuoka-fg',    name: 'ふくおかフィナンシャルG', industry: '地銀',      size: 'large',   region: '福岡',   newsHint: 'デジタルバンク「みんなの銀行」、九州ドミナント' },
  { id: 'concordia',     name: 'コンコルディア・フィナンシャルG', industry: '地銀', size: 'large', region: '神奈川', newsHint: '横浜銀行・東日本銀行の統合効果、首都圏営業強化' },
  { id: 'chiba-bank',    name: '千葉銀行',               industry: '地銀',       size: 'large',   region: '千葉',   newsHint: 'TSUBASA アライアンスでデジタル投資を共同化' },
  { id: 'shizuoka-bank', name: '静岡銀行',               industry: '地銀',       size: 'large',   region: '静岡',   newsHint: '富裕層向けプライベートバンキング、東京進出も継続' },
  { id: 'kyoto-bank',    name: '京都銀行',               industry: '地銀',       size: 'mid',     region: '京都',   newsHint: '京都を中心に関西広域、優良企業との取引基盤' },
  { id: 'hokuhoku',      name: 'ほくほくフィナンシャルG', industry: '地銀',      size: 'mid',     region: '富山',   newsHint: '北陸三県と北海道のクロスボーダー連携' },

  // ─── 食品・小売 (地方) ────────────────────────
  { id: 'lopia',         name: 'ロピア',                 industry: '小売',       size: 'mid',     region: '神奈川', newsHint: '生鮮特化型ディスカウントスーパー、関東で急拡大' },
  { id: 'oksstore',      name: 'オーケー',               industry: '小売',       size: 'mid',     region: '神奈川', newsHint: 'ディスカウントスーパーの首都圏出店ペース加速' },
  { id: 'belc',          name: 'ベルク',                 industry: '小売',       size: 'mid',     region: '埼玉',   newsHint: '関東を中心とした地域密着スーパー' },
  { id: 'lifecorp',      name: 'ライフコーポレーション', industry: '小売',       size: 'large',   region: '大阪',   newsHint: '関西・首都圏で展開、PB BIO-RAL に注力' },
  { id: 'okuwa',         name: 'オークワ',               industry: '小売',       size: 'mid',     region: '和歌山', newsHint: '関西広域のスーパー、ネットスーパー対応強化' },
  { id: 'arcs',          name: 'アークス',               industry: '小売',       size: 'large',   region: '北海道', newsHint: '北海道・東北のドミナント、地域連携で物流効率化' },

  // ─── 教育・人材 (中堅・スタートアップ) ────────────────────────
  { id: 'mana',          name: 'マナラボ',               industry: 'EdTech',     size: 'startup', region: '東京',   newsHint: '子供向けプログラミング教育、地方自治体導入も拡大' },
  { id: 'manabo',        name: 'マナボ',                 industry: 'EdTech',     size: 'startup', region: '東京',   newsHint: 'オンライン家庭教師、スマホアプリ受験対応' },
  { id: 'eikoh',         name: '栄光ホールディングス',   industry: '教育',       size: 'mid',     region: '東京',   newsHint: '中学・高校受験塾、ZOOM 等オンライン併用' },
  { id: 'cybeads',       name: 'サイバーエージェント (AI 部門)', industry: 'AI', size: 'large', region: '東京',     newsHint: '日本語特化型 LLM CyberAgentLM、広告クリエイティブ AI' },

  // ─── ベンチャー / 注目スタートアップ ────────────────────────
  { id: 'gnus',          name: 'GNUS',                   industry: 'クリエイター', size: 'startup', region: '東京', newsHint: 'プロクリエイター向け SaaS、デザイン・動画案件マッチング' },
  { id: 'estyle-bio',    name: 'バイオファクトリー',     industry: 'バイオ',     size: 'startup', region: '東京',   newsHint: '微生物資源を活用した素材開発' },
  { id: 'glia',          name: 'GLIA',                   industry: 'AI',         size: 'startup', region: '東京',   newsHint: '医療画像 AI 診断支援、製薬企業との協業' },
  { id: 'biz-up',        name: 'BIZUP',                  industry: 'B2B SaaS',   size: 'startup', region: '東京',   newsHint: 'バックオフィス効率化 SaaS、中小企業向け' },
  { id: 'asaba',         name: 'ASOBO',                  industry: 'EC',         size: 'startup', region: '東京',   newsHint: '推し活グッズ・サブカル EC' },
  { id: 'baseconnect',   name: 'Baseconnect',            industry: '営業 DX',    size: 'startup', region: '京都',   newsHint: '法人データベース Musubu、AI 法人検索' },
  { id: 'gigxr',         name: 'GIG XR',                 industry: 'XR',         size: 'startup', region: '東京',   newsHint: '医療・教育向けの XR コンテンツ制作' },
  { id: 'rakurakuchin',  name: 'らくらくちん',           industry: '高齢者向け SaaS', size: 'startup', region: '東京', newsHint: '高齢者の見守りと家族連絡を統合した SaaS' },
  { id: 'craft',         name: 'クラフト',               industry: 'AI クリエイティブ', size: 'startup', region: '東京', newsHint: 'AI による広告・SNS クリエイティブ自動生成' },
  { id: 'agriest',       name: 'アグリスト',             industry: 'アグリテック', size: 'startup', region: '宮崎', newsHint: '自動収穫ロボット、農業の人手不足を解消' },
  { id: 'inahosec',      name: 'いなほ',                 industry: 'AI スマート農業', size: 'startup', region: '東京', newsHint: '画像認識による農作物検品 AI' },
  { id: 'wovn',          name: 'WOVN Technologies',      industry: 'AI 翻訳',    size: 'mid',     region: '東京',   newsHint: 'Web サイト多言語化 SaaS、外資企業の日本展開支援' },
  { id: 'helpfeel',      name: 'Helpfeel',               industry: 'FAQ SaaS',   size: 'mid',     region: '京都',   newsHint: '意図予測検索 FAQ、コンタクトセンター負荷軽減' },
  { id: 'cocopay',       name: 'KOMOJU',                 industry: '決済',       size: 'startup', region: '東京',   newsHint: '越境 EC 向け決済ゲートウェイ、アジア展開' },
  { id: 'rever',         name: 'リバー',                 industry: 'リコマース', size: 'startup', region: '東京',   newsHint: '中古品買取・リユース、サステナブル領域' },
  { id: 'starflyer',     name: 'スターフライヤー',       industry: '航空',       size: 'mid',     region: '福岡',   newsHint: '北九州拠点の地域航空、デザイン重視のブランディング' },

  // ─── 海外進出 / グローバル展開メーカー ────────────────────────
  { id: 'jt',            name: '日本たばこ産業 (JT)',    industry: 'たばこ',     size: 'large',   region: '東京',   newsHint: '海外たばこ事業 (JTI) が利益柱、医薬・加工食品は売却' },
  { id: 'pilot-corp',    name: 'パイロットコーポレーション', industry: '文具',   size: 'mid',     region: '東京',   newsHint: '高級筆記具で世界展開、フリクションが収益柱' },
  { id: 'shachihata',    name: 'シヤチハタ',             industry: '文具',       size: 'mid',     region: '愛知',   newsHint: '電子印鑑事業へシフト、Shachihata Cloud 拡大' },
  { id: 'kobe-bussan',   name: '神戸物産',               industry: '小売',       size: 'large',   region: '兵庫',   newsHint: '業務スーパーの全国展開、PB 製造と地域 FC 戦略' },
  { id: 'oedo',          name: '大江戸温泉物語',         industry: 'ホテル',     size: 'mid',     region: '東京',   newsHint: '地方温泉旅館の再生、ファンドの傘下' },

  // ─── BtoC スタートアップ ────────────────────────
  { id: 'newview',       name: 'NewView',                industry: 'XR',         size: 'startup', region: '東京',   newsHint: 'AR/VR クリエイター支援プラットフォーム' },
  { id: 'splatoon-team', name: 'Cluster',                industry: 'メタバース', size: 'startup', region: '東京',   newsHint: '仮想空間プラットフォーム cluster、企業イベント拡大' },
  { id: 'mealtreats',    name: 'OniGO',                  industry: 'クイックコマース', size: 'startup', region: '東京', newsHint: '即配 EC、東京 23 区中心に拡大' },
  { id: 'tabelog-onyx',  name: 'kabuk style',            industry: '長期滞在',   size: 'startup', region: '東京',   newsHint: 'サブスク型多拠点居住、地方創生連携' },
  { id: 'aniteam',       name: 'animateam',              industry: 'IP',         size: 'startup', region: '東京',   newsHint: 'アニメ IP 制作の新興プロデュース、海外配信契約' },

  // ─── 上場準備 / 注目 SaaS ────────────────────────
  { id: 'commune',       name: 'コミューン',             industry: 'コミュニティ SaaS', size: 'mid', region: '東京', newsHint: 'ファンコミュニティ SaaS、米国展開も開始' },
  { id: 'forcia',        name: 'フォーシア',             industry: '検索 SaaS',  size: 'mid',     region: '東京',   newsHint: '旅行業界向け検索エンジン、観光業向け DX' },
  { id: 'asoview',       name: 'アソビュー',             industry: 'レジャー予約', size: 'mid',   region: '東京',   newsHint: 'レジャー予約サイトと法人向け SaaS' },
  { id: 'spacely',       name: 'スペースリー',           industry: 'XR・不動産', size: 'startup', region: '東京',   newsHint: '不動産向け VR 内見、住宅展示場 DX' },
  { id: 'spcc',          name: 'スペースマーケット',     industry: 'スペースシェア', size: 'mid', region: '東京',   newsHint: 'C2C 場所貸し、レンタルスペース予約' },

  // ─── 学術・研究系・専門 ────────────────────────
  { id: 'rikenvitamin',  name: '理研ビタミン',           industry: '食品',       size: 'mid',     region: '東京',   newsHint: '海藻・調味料、中食市場向けに製品強化' },
  { id: 'shimano-pharm', name: '島野興産',               industry: '産業材料',   size: 'mid',     region: '兵庫',   newsHint: '工業薬品・水処理薬品、半導体製造向けも' },
  { id: 'ngk',           name: '日本ガイシ',             industry: '電子材料',   size: 'large',   region: '愛知',   newsHint: 'NAS 電池とディーゼル排ガス浄化、半導体製造機材' },
  { id: 'sumitomo-bake', name: '住友ベークライト',       industry: '化学',       size: 'mid',     region: '東京',   newsHint: '半導体封止材で世界トップシェア、医療事業も拡大' },
  { id: 'lintec',        name: 'リンテック',             industry: '化学',       size: 'mid',     region: '東京',   newsHint: '粘着技術と半導体関連、テープ・ラベルで強み' },
  { id: 'sumitomoseika', name: '住友精化',               industry: '化学',       size: 'mid',     region: '大阪',   newsHint: '高吸水性樹脂、デンプン誘導体、機能化学' },
  { id: 'nittobo',       name: '日東紡',                 industry: '化学・繊維', size: 'mid',     region: '東京',   newsHint: '半導体ガラスクロス、グラスファイバー世界トップ' },
];

/**
 * 業界別にフィルタする補助関数。
 * 引数を渡さなければ全件、配列を渡せばその業界のみを返す。
 */
export function filterByIndustry(industries?: string[]): CompanyEntry[] {
  if (!industries || industries.length === 0) return COMPANIES_JP;
  const set = new Set(industries);
  return COMPANIES_JP.filter(c => set.has(c.industry));
}

/**
 * ランダムにシャッフルして N 社抽出 (シード固定で日替わり要素を実装可能)。
 * AI に投げる候補プールが大きすぎると遅くなるので、絞り込み用。
 */
export function sampleCompanies(n: number, seed: number = Date.now()): CompanyEntry[] {
  // 日付ベース簡易シャッフル (Mulberry32)
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = COMPANIES_JP.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/**
 * 日付ベースのシード (YYYYMMDD).
 * 同じ日には同じピックアップが出るように。
 */
export function todaySeed(d: Date = new Date()): number {
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`);
}
