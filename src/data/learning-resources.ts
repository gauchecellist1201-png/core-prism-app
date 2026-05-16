// AI が「今日読むべき資料」を選ぶための内蔵 DB。経営者向け書籍・動画・記事 100 件。
// すべて実在の著作。出版社や URL は固有名なので変更がある可能性あり (UI 上は参考表示)。

export type LearningKind = 'book' | 'video' | 'article' | 'podcast';
export type LearningTheme =
  | 'strategy'
  | 'finance'
  | 'product'
  | 'marketing'
  | 'leadership'
  | 'design'
  | 'ai'
  | 'mindset';

export interface LearningResource {
  id: string;
  kind: LearningKind;
  theme: LearningTheme;
  title: string;
  author: string;
  takeaway: string;     // 1 行で「これを学べる」
  durationMin: number;  // 想定時間
  forWho: string;       // 誰に響くか
}

export const LEARNING_RESOURCES: LearningResource[] = [
  // strategy
  { id: 'L001', kind: 'book',    theme: 'strategy',   title: '良い戦略、悪い戦略',                       author: 'リチャード・P・ルメルト', takeaway: '良い戦略の条件 = 診断 / 方針 / 行動の 3 点セット', durationMin: 360, forWho: '事業責任者' },
  { id: 'L002', kind: 'book',    theme: 'strategy',   title: '戦略策定概論',                             author: '波頭亮',                  takeaway: '戦略の構造を 1 冊で俯瞰できる', durationMin: 480, forWho: '幹部・PM' },
  { id: 'L003', kind: 'book',    theme: 'strategy',   title: 'ストーリーとしての競争戦略',               author: '楠木建',                  takeaway: '戦略は要素ではなく流れで描く', durationMin: 540, forWho: '経営層' },
  { id: 'L004', kind: 'book',    theme: 'strategy',   title: 'プロダクトマネジメントのすべて',           author: '及川卓也ほか',            takeaway: 'PM の言語をひと通り獲得できる', durationMin: 600, forWho: 'PM' },
  { id: 'L005', kind: 'article', theme: 'strategy',   title: 'Why Software Is Eating the World',          author: 'Marc Andreessen',          takeaway: 'ソフトが世界を飲み込む論の原点', durationMin: 12,  forWho: '創業者' },
  { id: 'L006', kind: 'book',    theme: 'strategy',   title: 'ブルー・オーシャン戦略',                   author: 'W・チャン・キム',          takeaway: '競争のない場をつくる思考法', durationMin: 360, forWho: '経営者' },
  { id: 'L007', kind: 'book',    theme: 'strategy',   title: '失敗の本質',                               author: '戸部良一ほか',            takeaway: '日本型組織の失敗の構造', durationMin: 420, forWho: '経営者' },
  { id: 'L008', kind: 'book',    theme: 'strategy',   title: 'OODA LOOP',                                author: 'チェット・リチャーズ',    takeaway: '不確実な状況で勝つ意思決定', durationMin: 360, forWho: '幹部' },

  // finance
  { id: 'L009', kind: 'book',    theme: 'finance',    title: '稲盛和夫の実学 — 経営と会計',              author: '稲盛和夫',                takeaway: '会計を経営者の言葉で語る', durationMin: 240, forWho: '経営者' },
  { id: 'L010', kind: 'book',    theme: 'finance',    title: '社長は会計の数字をこう読みなさい',         author: '小堺桂悦郎',              takeaway: '会計を経営判断に直結させる読み方', durationMin: 240, forWho: '中小経営者' },
  { id: 'L011', kind: 'book',    theme: 'finance',    title: 'お金の流れでわかる世界の歴史',             author: '大村大次郎',              takeaway: 'お金の流れで歴史を読み直す', durationMin: 300, forWho: '経営者' },
  { id: 'L012', kind: 'book',    theme: 'finance',    title: '財務 3 表一体理解法',                       author: '國貞克則',                takeaway: 'BS/PL/CF の関係を 1 冊で', durationMin: 300, forWho: '経理初学者' },
  { id: 'L013', kind: 'article', theme: 'finance',    title: 'SaaS Metrics 2.0',                          author: 'David Skok',               takeaway: 'SaaS 経営の必須指標を網羅', durationMin: 30,  forWho: 'SaaS 経営' },
  { id: 'L014', kind: 'book',    theme: 'finance',    title: '攻める経理',                               author: '前田康二郎',              takeaway: '守りから攻めの経理へ', durationMin: 240, forWho: '経理・経営' },
  { id: 'L015', kind: 'book',    theme: 'finance',    title: '社長のための財務戦略',                     author: '熊野御堂佳成',            takeaway: '財務戦略を社長視点で', durationMin: 300, forWho: '中小経営' },
  { id: 'L016', kind: 'article', theme: 'finance',    title: 'Burn Multiple',                             author: 'David Sacks',              takeaway: 'スタートアップの効率を測る指標', durationMin: 10,  forWho: '起業家' },

  // product
  { id: 'L017', kind: 'book',    theme: 'product',    title: 'INSPIRED',                                 author: 'マーティ・ケーガン',      takeaway: '愛されるプロダクトを作る原則', durationMin: 420, forWho: 'PM' },
  { id: 'L018', kind: 'book',    theme: 'product',    title: 'リーン・スタートアップ',                   author: 'エリック・リース',        takeaway: '仮説検証ループの教科書', durationMin: 360, forWho: '起業家' },
  { id: 'L019', kind: 'book',    theme: 'product',    title: 'Hooked',                                   author: 'Nir Eyal',                 takeaway: 'ユーザーを習慣化するモデル', durationMin: 300, forWho: 'PM' },
  { id: 'L020', kind: 'book',    theme: 'product',    title: 'デザインスプリント',                       author: 'ジェイク・ナップ',        takeaway: '5 日で意思決定するスプリント', durationMin: 300, forWho: 'PM・デザイナー' },
  { id: 'L021', kind: 'book',    theme: 'product',    title: 'Continuous Discovery Habits',              author: 'Teresa Torres',            takeaway: '継続的ユーザー発見の習慣化', durationMin: 360, forWho: 'PM' },
  { id: 'L022', kind: 'video',   theme: 'product',    title: 'Y Combinator: Startup School',             author: 'Y Combinator',             takeaway: '創業者が見るべき基礎講義', durationMin: 60,  forWho: '起業家' },
  { id: 'L023', kind: 'article', theme: 'product',    title: 'The PMF Pyramid',                           author: 'Lenny Rachitsky',          takeaway: 'PMF を構造的に見る', durationMin: 12,  forWho: 'PM' },
  { id: 'L024', kind: 'book',    theme: 'product',    title: 'プロダクトレッド・グロース',               author: 'ウェス・ブッシュ',        takeaway: 'プロダクトが営業する設計', durationMin: 360, forWho: 'SaaS' },

  // marketing
  { id: 'L025', kind: 'book',    theme: 'marketing',  title: 'ストーリーブランディング',                 author: 'ドナルド・ミラー',        takeaway: '物語フレームで売る', durationMin: 240, forWho: 'マーケ' },
  { id: 'L026', kind: 'book',    theme: 'marketing',  title: 'コンテンツマーケティングの教科書',         author: '宗像淳ほか',              takeaway: 'CM の基礎から実践まで', durationMin: 300, forWho: 'マーケ' },
  { id: 'L027', kind: 'book',    theme: 'marketing',  title: 'シュガーマンのマーケティング 30 の法則',   author: 'ジョセフ・シュガーマン',  takeaway: '心理トリガー集', durationMin: 240, forWho: 'コピーライター' },
  { id: 'L028', kind: 'book',    theme: 'marketing',  title: 'ザ・コピーライティング',                   author: 'ジョン・ケープルズ',      takeaway: '反応率で測るコピーの古典', durationMin: 360, forWho: 'コピー' },
  { id: 'L029', kind: 'article', theme: 'marketing',  title: '"Jobs to be Done" framework',               author: 'Clayton Christensen',     takeaway: '顧客が雇う「ジョブ」の視点', durationMin: 20,  forWho: 'PM・マーケ' },
  { id: 'L030', kind: 'book',    theme: 'marketing',  title: 'ファンベース',                             author: '佐藤尚之',                takeaway: 'ファンを基盤に成長する考え方', durationMin: 240, forWho: 'マーケ' },
  { id: 'L031', kind: 'book',    theme: 'marketing',  title: 'USJ を劇的に変えた、たった 1 つの考え方',  author: '森岡毅',                  takeaway: '消費者視点での戦略立案', durationMin: 240, forWho: 'マーケ' },
  { id: 'L032', kind: 'book',    theme: 'marketing',  title: 'マーケティング 22 の法則',                 author: 'アル・ライズ',            takeaway: 'マーケの不変原則', durationMin: 180, forWho: '全マーケ' },

  // leadership
  { id: 'L033', kind: 'book',    theme: 'leadership', title: 'リーダーの仮面',                           author: '安藤広大',                takeaway: '感情を排した識学的リーダー像', durationMin: 240, forWho: 'マネージャー' },
  { id: 'L034', kind: 'book',    theme: 'leadership', title: 'EQ 2.0',                                   author: 'トラビス・ブラッドベリー', takeaway: 'EQ の鍛え方', durationMin: 240, forWho: 'リーダー' },
  { id: 'L035', kind: 'book',    theme: 'leadership', title: 'ティール組織',                             author: 'フレデリック・ラルー',    takeaway: '進化する組織のあり方', durationMin: 600, forWho: '経営者' },
  { id: 'L036', kind: 'book',    theme: 'leadership', title: 'NETFLIX の最強人事戦略',                   author: 'パティ・マッコード',      takeaway: '自由と責任の人事文化', durationMin: 240, forWho: 'HR・経営' },
  { id: 'L037', kind: 'video',   theme: 'leadership', title: 'Simon Sinek: Start with Why',              author: 'TED',                      takeaway: 'なぜから始める', durationMin: 18,  forWho: '全リーダー' },
  { id: 'L038', kind: 'book',    theme: 'leadership', title: '心理的安全性のつくりかた',                 author: '石井遼介',                takeaway: 'チームを変える心理的安全性', durationMin: 300, forWho: 'マネージャー' },
  { id: 'L039', kind: 'book',    theme: 'leadership', title: 'WHO NOT HOW',                              author: 'ダン・サリヴァン',        takeaway: 'How より Who で考える', durationMin: 180, forWho: '経営者' },
  { id: 'L040', kind: 'book',    theme: 'leadership', title: '人を動かす',                               author: 'D・カーネギー',            takeaway: '人間関係の古典', durationMin: 360, forWho: '全員' },

  // design
  { id: 'L041', kind: 'book',    theme: 'design',     title: 'デザインの伝え方',                         author: 'トム・グリーバー',        takeaway: 'デザインを言語化する技術', durationMin: 240, forWho: 'デザイナー' },
  { id: 'L042', kind: 'book',    theme: 'design',     title: 'インターフェイスデザインの心理学',         author: 'スーザン・ワインチェンク', takeaway: 'UX 心理学 100 則', durationMin: 360, forWho: 'UX' },
  { id: 'L043', kind: 'book',    theme: 'design',     title: 'デザイン・シンキング (IDEO)',              author: 'ティム・ブラウン',        takeaway: '人間中心設計の原典', durationMin: 240, forWho: '企画' },
  { id: 'L044', kind: 'book',    theme: 'design',     title: 'ノンデザイナーズ・デザインブック',         author: 'Robin Williams',           takeaway: 'デザイン 4 原則', durationMin: 180, forWho: '非デザイナー' },
  { id: 'L045', kind: 'video',   theme: 'design',     title: 'Don Norman: The 3 Ways Good Design Makes You Happy', author: 'TED', takeaway: '良いデザインの 3 層', durationMin: 14, forWho: '全員' },
  { id: 'L046', kind: 'book',    theme: 'design',     title: '誰のためのデザイン?',                      author: 'D・A・ノーマン',          takeaway: 'アフォーダンスの古典', durationMin: 360, forWho: '全員' },

  // ai
  { id: 'L047', kind: 'article', theme: 'ai',         title: 'Building effective agents',                 author: 'Anthropic',                takeaway: 'AI エージェント設計の指針', durationMin: 30, forWho: 'AI 開発' },
  { id: 'L048', kind: 'article', theme: 'ai',         title: 'Prompt Engineering Guide',                  author: 'DAIR.ai',                  takeaway: 'プロンプト技法の総覧', durationMin: 60, forWho: 'AI 開発' },
  { id: 'L049', kind: 'video',   theme: 'ai',         title: 'Andrej Karpathy: Intro to LLMs',           author: 'YouTube',                  takeaway: 'LLM の動きを 1 時間で', durationMin: 60, forWho: 'AI 全員' },
  { id: 'L050', kind: 'book',    theme: 'ai',         title: 'AI vs 教科書が読めない子どもたち',        author: '新井紀子',                takeaway: 'AI 時代に必要な力', durationMin: 300, forWho: '経営者' },
  { id: 'L051', kind: 'book',    theme: 'ai',         title: 'AI 経営',                                  author: '田中道昭',                takeaway: 'AI と経営の交差点', durationMin: 300, forWho: '経営層' },
  { id: 'L052', kind: 'article', theme: 'ai',         title: 'The State of AI 202x',                     author: 'Stanford HAI',             takeaway: 'AI の現状を俯瞰', durationMin: 60, forWho: '経営層' },
  { id: 'L053', kind: 'article', theme: 'ai',         title: 'Claude API Best Practices',                author: 'Anthropic Docs',           takeaway: 'Claude API の実践指針', durationMin: 25, forWho: '開発' },
  { id: 'L054', kind: 'video',   theme: 'ai',         title: 'AI Engineer Summit Sessions',              author: 'AI Engineer',              takeaway: 'AI 実装トレンド', durationMin: 90, forWho: '開発' },

  // mindset
  { id: 'L055', kind: 'book',    theme: 'mindset',    title: '夜と霧',                                   author: 'V・E・フランクル',         takeaway: '意味を見出す力', durationMin: 300, forWho: '経営者' },
  { id: 'L056', kind: 'book',    theme: 'mindset',    title: 'GRIT やり抜く力',                          author: 'アンジェラ・ダックワース', takeaway: 'やり抜く力の構造', durationMin: 300, forWho: '全員' },
  { id: 'L057', kind: 'book',    theme: 'mindset',    title: 'マインドセット「やればできる!」の研究',   author: 'キャロル・ドゥエック',    takeaway: '成長マインドセット', durationMin: 300, forWho: '全員' },
  { id: 'L058', kind: 'book',    theme: 'mindset',    title: 'ヒルビリー・エレジー',                    author: 'J・D・ヴァンス',           takeaway: '貧困と意志の物語', durationMin: 360, forWho: '経営者' },
  { id: 'L059', kind: 'book',    theme: 'mindset',    title: 'ファクトフルネス',                        author: 'ハンス・ロスリング',      takeaway: 'データで世界を見直す', durationMin: 360, forWho: '経営者' },
  { id: 'L060', kind: 'book',    theme: 'mindset',    title: 'エッセンシャル思考',                      author: 'グレッグ・マキューン',    takeaway: 'やらないことを決める', durationMin: 240, forWho: '経営者' },
  { id: 'L061', kind: 'book',    theme: 'mindset',    title: 'DEEP WORK',                               author: 'カル・ニューポート',       takeaway: '深い集中の作り方', durationMin: 300, forWho: '全員' },
  { id: 'L062', kind: 'book',    theme: 'mindset',    title: 'PRINCIPLES (原則)',                       author: 'レイ・ダリオ',             takeaway: '原則による意思決定', durationMin: 600, forWho: '経営者' },
  { id: 'L063', kind: 'book',    theme: 'mindset',    title: 'やり抜く人の 9 つの習慣',                 author: 'ハイディ・グラント',      takeaway: '科学的やり抜き術', durationMin: 120, forWho: '全員' },
  { id: 'L064', kind: 'book',    theme: 'mindset',    title: '習慣の力',                                author: 'チャールズ・デュヒッグ',  takeaway: '習慣のループ', durationMin: 300, forWho: '全員' },

  // 短時間・即効性
  { id: 'L065', kind: 'article', theme: 'product',    title: 'Lenny\'s Newsletter (Weekly)',             author: 'Lenny Rachitsky',          takeaway: 'PM 業界の最新動向', durationMin: 15, forWho: 'PM' },
  { id: 'L066', kind: 'article', theme: 'strategy',   title: 'First Round Review',                       author: 'First Round',              takeaway: 'スタートアップ実践知', durationMin: 20, forWho: '創業者' },
  { id: 'L067', kind: 'article', theme: 'leadership', title: 'HBR: The Best-Performing CEOs',           author: 'HBR',                      takeaway: '優れた CEO の共通点', durationMin: 20, forWho: '経営者' },
  { id: 'L068', kind: 'article', theme: 'finance',    title: 'a16z: How to Read a Cap Table',            author: 'a16z',                     takeaway: 'キャップテーブルの読み方', durationMin: 15, forWho: '創業者' },
  { id: 'L069', kind: 'podcast', theme: 'product',    title: 'Acquired Podcast',                         author: 'Ben & David',              takeaway: '名企業の解剖', durationMin: 180, forWho: '経営者' },
  { id: 'L070', kind: 'podcast', theme: 'mindset',    title: 'Huberman Lab',                             author: 'Andrew Huberman',          takeaway: '脳と体のパフォーマンス', durationMin: 90,  forWho: '全員' },

  // marketing extras
  { id: 'L071', kind: 'article', theme: 'marketing',  title: 'How to Build a Brand',                     author: 'a16z',                     takeaway: 'ブランド構築の実践', durationMin: 20, forWho: 'マーケ' },
  { id: 'L072', kind: 'book',    theme: 'marketing',  title: '広告の天才たちが気付いている人の心を動かす 10 の心理',          author: 'ロバート・チャルディーニ', takeaway: '影響力の原理', durationMin: 300, forWho: 'マーケ' },
  { id: 'L073', kind: 'book',    theme: 'marketing',  title: 'ブランディングの教科書',                   author: '羽田康祐',                takeaway: 'ブランディングの体系', durationMin: 240, forWho: 'マーケ' },

  // product extras
  { id: 'L074', kind: 'article', theme: 'product',    title: 'The Mom Test',                             author: 'Rob Fitzpatrick',          takeaway: '顧客インタビューの設計', durationMin: 90, forWho: '創業者' },
  { id: 'L075', kind: 'book',    theme: 'product',    title: 'Sprint',                                   author: 'Jake Knapp',               takeaway: '5 日で答えを出す', durationMin: 300, forWho: 'PM' },

  // leadership extras
  { id: 'L076', kind: 'book',    theme: 'leadership', title: 'マネジャーの最も大切な仕事',              author: 'テレサ・アマビール',      takeaway: '進捗の法則', durationMin: 360, forWho: 'マネージャー' },
  { id: 'L077', kind: 'book',    theme: 'leadership', title: 'ハイ・アウトプット・マネジメント',        author: 'A・S・グローブ',           takeaway: 'インテル元 CEO の名著', durationMin: 360, forWho: 'マネージャー' },
  { id: 'L078', kind: 'book',    theme: 'leadership', title: '1 兆ドルコーチ',                          author: 'エリック・シュミット他',  takeaway: 'ビル・キャンベルのコーチング', durationMin: 240, forWho: '経営者' },

  // strategy extras
  { id: 'L079', kind: 'book',    theme: 'strategy',   title: '両利きの経営',                            author: 'チャールズ・A・オライリー', takeaway: '深化と探索の同時実行', durationMin: 420, forWho: '経営者' },
  { id: 'L080', kind: 'book',    theme: 'strategy',   title: 'ゼロ・トゥ・ワン',                        author: 'ピーター・ティール',      takeaway: '独占を作る思想', durationMin: 300, forWho: '起業家' },
  { id: 'L081', kind: 'book',    theme: 'strategy',   title: 'ハードシングス',                          author: 'ベン・ホロウィッツ',      takeaway: '困難を生き抜く CEO 論', durationMin: 360, forWho: '経営者' },
  { id: 'L082', kind: 'book',    theme: 'strategy',   title: 'スケーリング・カスタマーサクセス',        author: '弘子ラザヴィ',            takeaway: 'CS の科学', durationMin: 240, forWho: 'CS・経営' },

  // ai extras
  { id: 'L083', kind: 'article', theme: 'ai',         title: 'OpenAI: Spec',                             author: 'OpenAI',                   takeaway: 'モデル仕様の透明化', durationMin: 30, forWho: 'AI 全般' },
  { id: 'L084', kind: 'article', theme: 'ai',         title: 'Vercel AI SDK ドキュメント',              author: 'Vercel',                   takeaway: 'AI 機能を Web に統合する', durationMin: 40, forWho: '開発' },
  { id: 'L085', kind: 'video',   theme: 'ai',         title: 'Stanford CS25: Transformers',              author: 'Stanford',                 takeaway: 'Transformer の本質', durationMin: 90, forWho: '研究' },

  // design extras
  { id: 'L086', kind: 'book',    theme: 'design',     title: 'About Face',                              author: 'アラン・クーパー',        takeaway: 'インタラクションデザインの古典', durationMin: 600, forWho: 'UX' },
  { id: 'L087', kind: 'video',   theme: 'design',     title: 'Refactoring UI (YouTube)',                 author: 'Adam Wathan',              takeaway: '美しい UI の作法', durationMin: 60, forWho: 'デザイナー' },

  // finance extras
  { id: 'L088', kind: 'book',    theme: 'finance',    title: 'ザ・ゴール',                              author: 'エリヤフ・ゴールドラット', takeaway: '制約理論の物語', durationMin: 480, forWho: '経営者' },
  { id: 'L089', kind: 'book',    theme: 'finance',    title: 'ファイナンス入門',                        author: '砂川伸幸',                takeaway: 'コーポレートファイナンス基礎', durationMin: 360, forWho: 'CFO 候補' },

  // mindset extras
  { id: 'L090', kind: 'book',    theme: 'mindset',    title: '影響力の武器',                            author: 'ロバート・チャルディーニ', takeaway: '心理的影響の 6 原則', durationMin: 420, forWho: '全員' },
  { id: 'L091', kind: 'book',    theme: 'mindset',    title: '7 つの習慣',                              author: 'スティーブン・コヴィー',  takeaway: '人格主義の名著', durationMin: 540, forWho: '全員' },
  { id: 'L092', kind: 'book',    theme: 'mindset',    title: '武士道',                                  author: '新渡戸稲造',              takeaway: '日本の倫理観', durationMin: 240, forWho: '経営者' },
  { id: 'L093', kind: 'book',    theme: 'mindset',    title: 'スタンフォードのストレスを力に変える教科書', author: 'ケリー・マクゴニガル',    takeaway: 'ストレスとの付き合い方', durationMin: 300, forWho: '全員' },

  // 経営者の日常
  { id: 'L094', kind: 'article', theme: 'leadership', title: 'Paul Graham Essays',                      author: 'Paul Graham',              takeaway: '起業家の必読エッセイ集', durationMin: 30, forWho: '起業家' },
  { id: 'L095', kind: 'podcast', theme: 'strategy',   title: 'How I Built This',                         author: 'NPR',                      takeaway: '創業者の物語', durationMin: 60, forWho: '起業家' },
  { id: 'L096', kind: 'podcast', theme: 'leadership', title: 'The Tim Ferriss Show',                    author: 'Tim Ferriss',              takeaway: '一流の習慣を解剖', durationMin: 90, forWho: '全員' },
  { id: 'L097', kind: 'article', theme: 'product',    title: 'Sequoia: Adapting to Endure',              author: 'Sequoia',                  takeaway: '逆風期のスタートアップ指針', durationMin: 25, forWho: '創業者' },
  { id: 'L098', kind: 'book',    theme: 'leadership', title: 'マネジメント (エッセンシャル版)',         author: 'P・F・ドラッカー',         takeaway: 'マネジメントの古典', durationMin: 480, forWho: 'マネージャー' },
  { id: 'L099', kind: 'book',    theme: 'mindset',    title: '考え方 — 人生・仕事の結果が変わる',       author: '稲盛和夫',                takeaway: '人生の方程式', durationMin: 240, forWho: '経営者' },
  { id: 'L100', kind: 'article', theme: 'strategy',   title: 'Stratechery (Daily)',                      author: 'Ben Thompson',             takeaway: 'テック戦略の最深分析', durationMin: 15, forWho: '経営者' },
];

export function pickTodayResources(seed: number, count: number = 3): LearningResource[] {
  const list = [...LEARNING_RESOURCES];
  let s = seed;
  for (let i = list.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}
