// ============================================================
// integrationBenefits — 連携が完了したときに「これで何ができるか」を
// やさしい言葉で 3 つ並べるための定義集
// ============================================================

export interface IntegrationBenefit {
  /** 連携カードのキー (IntegrationCenter の Tool.id に揃える) */
  id: string;
  /** 表示名 (例: 'Notion') */
  name: string;
  /** 何ができるか — 短文 3 つ。実際の体験を想像できる具体性で */
  benefits: { emoji: string; title: string; desc: string }[];
  /** 「ここで見える」を示す画面ヒント (該当 Studio 名・タブ名) */
  whereVisible: string;
  /** ブランドカラー */
  color: string;
}

export const INTEGRATION_BENEFITS: Record<string, IntegrationBenefit> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    color: '#EA4335',
    whereVisible: 'メール対応スタジオ / シャドー秘書',
    benefits: [
      { emoji: '📥', title: 'いつもの返信を先回り', desc: 'AI があなたの口調で下書きを 3 案、朝に並べておきます' },
      { emoji: '⚡', title: '緊急メールだけ即通知', desc: '90% の「読まなくていいメール」を AI が選り分け' },
      { emoji: '🗂', title: '案件メールを自動整理', desc: '同じ取引先のメールが 1 つの会話にまとまります' },
    ],
  },
  gcal: {
    id: 'gcal',
    name: 'Google カレンダー',
    color: '#4285F4',
    whereVisible: 'ホーム「今日の予定」/ AI ブリーフ',
    benefits: [
      { emoji: '🌅', title: '朝に「今日のひと言」', desc: 'AI が今日の会議を読んで、優先順と準備物を伝えます' },
      { emoji: '🚗', title: '移動と準備を先回り', desc: '次の予定までの移動時間と準備時間を予測' },
      { emoji: '📝', title: '会議のあと議事録が自動', desc: '会議終了後、議事録 AI が要点とアクションを抽出' },
    ],
  },
  gdrive: {
    id: 'gdrive',
    name: 'Google ドライブ',
    color: '#1FA463',
    whereVisible: 'ナレッジ AI / 横断検索',
    benefits: [
      { emoji: '📚', title: '資料を全部覚えてくれる', desc: 'ドライブの中身を AI が読み込み、聞けばすぐ答える' },
      { emoji: '🔍', title: 'Cmd+K で全文検索', desc: '「先月の見積どこ?」と聞くだけで該当ファイルを開く' },
      { emoji: '✨', title: '関連資料を先回り提案', desc: '商談前に「この案件で使えそうな資料 3 件」を提示' },
    ],
  },
  gdocs: {
    id: 'gdocs',
    name: 'Google ドキュメント',
    color: '#4285F4',
    whereVisible: '議事録 AI / 提案書スタジオ',
    benefits: [
      { emoji: '📄', title: '議事録をそのまま書き出し', desc: '会議後 AI が要約 → Google ドキュメントへ自動保存' },
      { emoji: '📑', title: '提案書も自動で', desc: '商談メモから A4 1 枚の提案書を 30 秒で' },
      { emoji: '🔄', title: '常に最新版が一箇所', desc: 'AI が更新した内容は Google 側でも常に最新' },
    ],
  },
  gsheets: {
    id: 'gsheets',
    name: 'Google スプレッドシート',
    color: '#0F9D58',
    whereVisible: '財務エディタ / 売上台帳',
    benefits: [
      { emoji: '📊', title: '売上を自動集計', desc: '請求書を作るたび、スプレッドシートに 1 行追加されます' },
      { emoji: '📈', title: '月次 P&L が自動', desc: 'AI が月末に P&L (損益) シートを更新' },
      { emoji: '💡', title: '異常を AI が見つける', desc: '「先月より広告費 30% 増」など気付きを通知' },
    ],
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    color: '#FF7A59',
    whereVisible: 'CRM スタジオ / 営業 AI',
    benefits: [
      { emoji: '🎯', title: 'リードと商談が同期', desc: 'CORE 側で動かした案件が HubSpot にも反映' },
      { emoji: '🧭', title: '次の一手を AI が提案', desc: '滞留している商談ごとに「次にすべき連絡」を示します' },
      { emoji: '🌐', title: '営業 AI が代わりに打診', desc: 'まだ連絡できていないリードに、AI が初回メールを下書き' },
    ],
  },
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    color: '#00A1E0',
    whereVisible: 'CRM スタジオ / 商談ロープレ',
    benefits: [
      { emoji: '🔄', title: '商談データを双方向で', desc: 'Salesforce の更新が CORE にも、その逆も自動で同期' },
      { emoji: '🎭', title: '商談ロープレを AI と', desc: '本番前に、商談相手を AI が演じてリハーサル' },
      { emoji: '📞', title: '通話メモが自動入力', desc: '通話の要点を AI が抽出して Salesforce 商談へ' },
    ],
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    color: '#0A0A0A',
    whereVisible: 'ナレッジベース / 議事録 AI',
    benefits: [
      { emoji: '📚', title: 'メモが Notion に自動保存', desc: '声で残したメモも、議事録も、自動で Notion へ' },
      { emoji: '🗂', title: 'ナレッジが両側に', desc: 'Notion の既存ページも AI が読み、横断検索で出てきます' },
      { emoji: '✨', title: '提案書も Notion 形式で', desc: '生成した提案書はそのまま Notion に貼り付けられる形式' },
    ],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    color: '#4A154B',
    whereVisible: 'AI ブリーフ / 通知センター',
    benefits: [
      { emoji: '🔔', title: '大事な提案だけ Slack へ', desc: 'AI が「今すぐ判断したい」案件だけを通知' },
      { emoji: '💬', title: 'チームへの共有が 1 タップ', desc: '生成した提案書・議事録を Slack に直接送信' },
      { emoji: '🤖', title: 'Slack 内でも AI に聞ける', desc: '@CORE をメンションして要約・検索を依頼' },
    ],
  },
  trello: {
    id: 'trello',
    name: 'Trello',
    color: '#0079BF',
    whereVisible: 'タスクハブ',
    benefits: [
      { emoji: '📋', title: 'タスクが Trello と同期', desc: 'CORE で作ったタスクが Trello のカードに自動追加' },
      { emoji: '⏱', title: '締切が近い順に並ぶ', desc: 'AI が締切と重要度から優先順を計算' },
      { emoji: '✅', title: '完了で両側が更新', desc: 'どちらで完了させても、両方が「完了」に' },
    ],
  },
  asana: {
    id: 'asana',
    name: 'Asana',
    color: '#F06A6A',
    whereVisible: 'タスクハブ / プロジェクト',
    benefits: [
      { emoji: '📦', title: 'プロジェクトと同期', desc: 'Asana のプロジェクトが CORE 側でも見えます' },
      { emoji: '⚡', title: '会議からタスク自動化', desc: '議事録のアクション項目が Asana タスクに' },
      { emoji: '🎯', title: '進捗を AI が要約', desc: '週次で「今週の進捗 3 行サマリ」を提示' },
    ],
  },
  ms365: {
    id: 'ms365',
    name: 'Microsoft 365',
    color: '#D83B01',
    whereVisible: 'メール / カレンダー / Teams',
    benefits: [
      { emoji: '📧', title: 'Outlook メールも AI で', desc: 'Gmail と同じく、Outlook の返信も AI が下書き' },
      { emoji: '📅', title: 'Teams 会議も議事録に', desc: '会議終了後、議事録 AI が自動で要点抽出' },
      { emoji: '🗂', title: 'OneDrive の資料を読む', desc: 'ナレッジ AI が OneDrive の資料も学習対象に' },
    ],
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    color: '#0061FF',
    whereVisible: 'ナレッジベース / 横断検索',
    benefits: [
      { emoji: '📂', title: 'Dropbox の資料を AI が学習', desc: 'PDF・Docx・画像まで AI が読み、聞けば答える' },
      { emoji: '🔍', title: 'Cmd+K で全文検索', desc: 'ファイル名を覚えてなくても、内容で見つけられる' },
      { emoji: '✨', title: '使われていない資料を発見', desc: '「3 ヶ月触っていない宝の資料」を AI が提案' },
    ],
  },
  zoom: {
    id: 'zoom',
    name: 'Zoom 録音',
    color: '#2D8CFF',
    whereVisible: '議事録 AI',
    benefits: [
      { emoji: '🎙', title: '録音ファイルを丸投げ', desc: 'Zoom の録音を投げ込むと、文字起こし → 要約 → ToDo まで' },
      { emoji: '📝', title: 'アクション項目を自動抽出', desc: '「誰が・何を・いつまでに」を AI が整理' },
      { emoji: '🔁', title: '会議のあと自動でメール', desc: '議事録を関係者にメール送信まで一気通貫' },
    ],
  },
  stripe: {
    id: 'stripe',
    name: 'Stripe',
    color: '#635BFF',
    whereVisible: '売上台帳 / 自分の事業カード',
    benefits: [
      { emoji: '💰', title: 'あなたの事業の売上を表示', desc: '今月の売上・経費・利益が、ホームに自動で出ます' },
      { emoji: '📈', title: '為替も自動で円換算', desc: '海外売上は当日レートで円に換算' },
      { emoji: '🎯', title: '異常があれば AI が通知', desc: '「先月比 ▲30% の月」など気付きを先回り' },
    ],
  },
  freee: {
    id: 'freee',
    name: 'freee 会計',
    color: '#00B58E',
    whereVisible: '財務エディタ / P&L レポート',
    benefits: [
      { emoji: '🔄', title: '売上・請求書を双方向で', desc: 'CORE で作った請求書が freee の取引にもなります' },
      { emoji: '📊', title: '月次 P&L が CORE 内で', desc: 'freee の最新 P&L を CORE のダッシュボードで見られる' },
      { emoji: '🧠', title: '経費を AI が分析', desc: 'カテゴリ別の使いすぎを AI が指摘' },
    ],
  },
  mf: {
    id: 'mf',
    name: 'マネーフォワード クラウド',
    color: '#FFA500',
    whereVisible: '財務エディタ / P&L レポート',
    benefits: [
      { emoji: '🔄', title: '仕訳を双方向同期', desc: 'CORE の取引が MF にも、MF の仕訳が CORE にも' },
      { emoji: '🏦', title: '銀行口座データも取込', desc: 'MF で連携した銀行口座の動きが CORE にも反映' },
      { emoji: '📊', title: '部門別 P&L が見える', desc: '部門別の月次レポートを CORE で確認できる' },
    ],
  },
  yayoi: {
    id: 'yayoi',
    name: '弥生会計オンライン',
    color: '#2E6FD9',
    whereVisible: '財務エディタ / 税額計算',
    benefits: [
      { emoji: '📥', title: '取引データを自動取込', desc: '弥生の取引データを CORE のダッシュボードで見える化' },
      { emoji: '🧮', title: '消費税を自動計算', desc: '請求書発行時に税率を自動適用' },
      { emoji: '📈', title: '決算前の準備が早い', desc: '決算月に AI が「埋まっていない項目」を指摘' },
    ],
  },
  github: {
    id: 'github',
    name: 'GitHub',
    color: '#181717',
    whereVisible: 'プロジェクト / ナレッジ',
    benefits: [
      { emoji: '🐛', title: 'Issue を要約', desc: 'リポジトリの Issue を AI が要約してダッシュボードに' },
      { emoji: '📝', title: 'README を学習', desc: 'README を読んだ AI に質問できる' },
      { emoji: '🚀', title: 'リリースノートを自動', desc: '変更履歴から AI がリリースノートを下書き' },
    ],
  },
  linear: {
    id: 'linear',
    name: 'Linear',
    color: '#5E6AD2',
    whereVisible: 'タスクハブ',
    benefits: [
      { emoji: '🎯', title: 'Linear の Issue と同期', desc: 'CORE のタスクが Linear の Issue と双方向で' },
      { emoji: '📊', title: 'サイクルを AI が要約', desc: 'スプリント終了時に「達成と積み残し」を 3 行で' },
      { emoji: '⚡', title: '会議からチケット自動', desc: '会議の議事録から Linear Issue が自動生成' },
    ],
  },
  'apple-watch': {
    id: 'apple-watch',
    name: 'Apple Watch / ヘルス',
    color: '#FF2D55',
    whereVisible: 'ヘルスハブ / ウェルネストラッカー',
    benefits: [
      { emoji: '❤️', title: '心拍・睡眠を毎朝取り込み', desc: 'AI が体調変化を見て「今日の集中時間」を提案' },
      { emoji: '🌙', title: '睡眠の質を朝に通知', desc: '深い睡眠の割合や中途覚醒も可視化' },
      { emoji: '🏃', title: '歩数・運動も連動', desc: '運動不足の日は AI が「散歩 15 分」を提案' },
    ],
  },
};

export function getIntegrationBenefits(id: string): IntegrationBenefit | null {
  return INTEGRATION_BENEFITS[id] || null;
}
