// ============================================================
// AgentSpecs — Prism (7) と Iris (6) のエージェント定義 + 会話台本
// ============================================================
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
  Mail, BarChart3, Sparkle, MessageSquare, Palette, UsersRound,
} from 'lucide-react';
import type { AgentSpec, AgentConversation } from '../components/AgentsOrbit';

// ─── PRISM 7 エージェント (経営者向け) ───────────────
// whatItDoes: 「これは何ができる?」初見の人が 3 秒で役割を掴めるレベルで 3 行ずつ。
export const PRISM_SPECS: AgentSpec[] = [
  { key: 'ceo',       name: '経営', role: 'CEO',       color: '#ff5757', Icon: Compass,
    thinking: ['次の一手を考えています', '今月の数字を見直しています', '優先順位を組み直しています', 'リスクを洗い出しています'],
    whatItDoes: [
      '今月の数字と状況を毎朝まとめて教えてくれる',
      '大事な判断のたたき台を一緒に作ってくれる',
      '見落としやすいリスク・優先順位を一覧で見せる',
    ] },
  { key: 'sales',     name: '営業', role: 'Sales',     color: '#ff9842', Icon: Briefcase,
    thinking: ['見込みのお客さんを探しています', '商談メモを整理しています', '提案文を下書きしています', '反論への返しを用意しています'],
    whatItDoes: [
      '見込みのお客さんを探して優先順位をつけてくれる',
      '提案文・返信文を下書きしてくれる (そのまま送れる)',
      '商談メモを整理して次の打ち手を提案してくれる',
    ] },
  { key: 'cfo',       name: '財務', role: 'CFO',       color: '#fbbf24', Icon: TrendingUp,
    thinking: ['今月の売上を集計しています', 'キャッシュを予測しています', '経費を分類しています', '請求書の発行待ちを確認しています'],
    whatItDoes: [
      '売上・経費を自動で集計して「今いくら?」が一目で分かる',
      '請求書の発行漏れ・入金遅れを見張ってくれる',
      '来月のお金の残りを予測して教えてくれる',
    ] },
  { key: 'creative',  name: '創造', role: 'Creative',  color: '#4ade80', Icon: Sparkles,
    thinking: ['画像を構図しています', '原稿の骨組みを考えています', 'ブランドの色を整えています', 'スライドの順番を組み直しています'],
    whatItDoes: [
      '画像・スライド・原稿をブランドの世界観で作ってくれる',
      'デザインの色・フォントを自動で統一してくれる',
      'リール / 投稿のサムネと構成を一気に下書きしてくれる',
    ] },
  { key: 'knowledge', name: '学び', role: 'Knowledge', color: '#60a5fa', Icon: BookOpen,
    thinking: ['資料を読み込んでいます', '関連する文脈を結びつけています', '要点を抜き出しています', '横断検索の道を作っています'],
    whatItDoes: [
      '社内の資料・議事録から答えを横断検索してくれる',
      '長い PDF / 議事録を 3 行に要約してくれる',
      '関連する過去の話題を「あの時はこうでしたよ」と紐づけてくれる',
    ] },
  { key: 'people',    name: '人材', role: 'People',    color: '#a78bfa', Icon: Users,
    thinking: ['チームの空気を読んでいます', '1on1 の話題を準備しています', '採用候補を整理しています', '言葉づかいを調整しています'],
    whatItDoes: [
      '1on1 で何を話すか、議題を準備してくれる',
      'メンバーの強み・困りごとを記憶して気配りを助けてくれる',
      '採用候補や紹介ネットワークを整理してくれる',
    ] },
  { key: 'life',      name: '生活', role: 'Life',      color: '#f472b6', Icon: Heart,
    thinking: ['睡眠の質を見ています', '今日のリズムを設計しています', '心の余白を見守っています', '家族の予定を整えています'],
    whatItDoes: [
      '睡眠・体調・気分を記録して今日のリズムを提案してくれる',
      '休む / 動く のタイミングを優しく教えてくれる',
      '家族の予定や私的な ToDo もまとめて見守ってくれる',
    ] },
];

export const PRISM_ORDER = PRISM_SPECS.map(s => s.key);

export const PRISM_CONVERSATIONS: AgentConversation[] = [
  { from: 'ceo',       msg: '営業さん、今月の有望案件 3 つに集中しよう' },
  { from: 'sales',     msg: '了解。A さんに今日中に下書きを送ります' },
  { from: 'cfo',       msg: '財務から見ると粗利 38% の案件を優先で' },
  { from: 'creative',  msg: '提案資料のビジュアルは今夜整えます' },
  { from: 'knowledge', msg: '過去の似た案件 5 件を読み込み済み、参考にどうぞ' },
  { from: 'people',    msg: '担当者の好みは「数字より物語」型でした' },
  { from: 'life',      msg: '今日は午後 3 時に少し休むのがいいリズムです' },
  { from: 'ceo',       msg: 'ありがとう。みんなで進めよう' },
  { from: 'sales',     msg: '新しい見込み客 2 件追加しました' },
  { from: 'cfo',       msg: '今月の売上、目標の 78% に達しています' },
];

// ─── IRIS 6 エージェント (クリエイター向け) ───────────────
// LP の FACETS と完全一致: 案件 / 分析 / 創作 / 交渉 / ブランド / 仲間
export const IRIS_SPECS: AgentSpec[] = [
  { key: 'deals',      name: '案件',     role: 'Deals',     color: '#E1306C', Icon: Mail,
    thinking: ['新しいブランド案件を探しています', '下書きの返信文を考えています', '報酬の相場を調べています', '応募メッセージを磨いています'],
    whatItDoes: [
      '相性の良いブランド案件を毎日探して通知してくれる',
      '応募メッセージ・返信文を下書きしてくれる',
      '報酬の相場をその場で調べて「これは安い / 妥当」を教えてくれる',
    ] },
  { key: 'analytics',  name: '分析',     role: 'Analytics', color: '#833AB4', Icon: BarChart3,
    thinking: ['投稿の伸びを分析しています', '保存される投稿の共通点を探しています', '伸びる時間帯を計算しています', 'フォロワーの動きを見守っています'],
    whatItDoes: [
      '伸びる時間帯・テーマを過去の投稿から見つけてくれる',
      '保存数が伸びた投稿の「何が効いたか」を教えてくれる',
      'フォロワーの動きを毎日見張って変化を知らせてくれる',
    ] },
  { key: 'creative',   name: '創作',     role: 'Creative',  color: '#F77737', Icon: Sparkle,
    thinking: ['キャプションを考えています', 'サムネのアイデアを練っています', 'リールの構成を組み立てています', '絵文字の配置を磨いています'],
    whatItDoes: [
      'キャプションを 3 案 (強気 / ふつう / 優しめ) 出してくれる',
      'リールの構成・冒頭 3 秒の問いかけを一緒に作ってくれる',
      'サムネのアイデア・絵文字配置まで提案してくれる',
    ] },
  { key: 'nego',       name: '交渉',     role: 'Nego',      color: '#FBBF24', Icon: MessageSquare,
    thinking: ['交渉の言葉を磨いています', 'メディアキットの数字を最新化しています', 'ブランドへの返信を考えています', '価格の根拠を整えています'],
    whatItDoes: [
      'ブランドへの返信を 3 種類 (強気 / ふつう / ていねい) 下書き',
      'メディアキットの数字を最新化してくれる',
      '希望価格に「なぜそれが妥当か」の根拠をつけてくれる',
    ] },
  { key: 'brand',      name: 'ブランド', role: 'Brand',     color: '#C13584', Icon: Palette,
    thinking: ['世界観の色を整えています', 'フォントの組み合わせを試しています', '統一感のあるパターンを探っています', 'プロフィールの印象を磨いています'],
    whatItDoes: [
      'プロフィール全体の世界観 (色・フォント) を整えてくれる',
      '投稿を 9 枚のグリッドで「揃って見えるか」をチェック',
      'ブランドに刺さるムードボードを自動で組んでくれる',
    ] },
  { key: 'community',  name: '仲間',     role: 'Community', color: '#FD7C9B', Icon: UsersRound,
    thinking: ['DM への返信を考えています', '仲間の投稿に目を通しています', 'コラボ候補を探しています', 'ファンの声を集めています'],
    whatItDoes: [
      'DM を「返信優先 / 後で / 無視で OK」に自動で振り分け',
      'コラボ候補のクリエイターを探して紹介してくれる',
      'ファンの声 (コメント・DM) をまとめて見せてくれる',
    ] },
];

export const IRIS_ORDER = IRIS_SPECS.map(s => s.key);

export const IRIS_CONVERSATIONS: AgentConversation[] = [
  { from: 'deals',     msg: '新しいブランド案件 2 件、条件良さそうです' },
  { from: 'nego',      msg: 'では下書き 3 種 (強気 / ふつう / ていねい) で作ります' },
  { from: 'analytics', msg: 'この時期は土曜 21 時の投稿が一番伸びてます' },
  { from: 'creative',  msg: 'その時間に合わせてキャプション 3 案を仕込みます' },
  { from: 'brand',     msg: 'サムネはローズゴールド系で統一感が出ますね' },
  { from: 'community', msg: '今週 DM が 14 件、3 件は返信優先かも' },
  { from: 'deals',     msg: '昨日のリール、保存数が前回比 +180%' },
  { from: 'creative',  msg: '同じパターンで来週 5 本仕込みましょう' },
  { from: 'analytics', msg: '保存率トップ 3 の共通点は「冒頭 3 秒の問いかけ」' },
  { from: 'nego',      msg: 'その実績を入れた媒体資料を更新しておきます' },
];
