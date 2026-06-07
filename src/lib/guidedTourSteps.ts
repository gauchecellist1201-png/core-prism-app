// ============================================================
// guidedTourSteps — Prism / Iris 用 ガイド ツアー 定義
//
// 各 ステップ:
//   - target: 実 UI 要素 の セレクタ (data-tour-id="xxx" 推奨)
//   - title / body: HubSpot 風 説明
//   - preAction: 必要 なら タブ 切替 / モーダル 開く
//
// 設計 方針:
//   - 「機能 を 触る 順番」 で 並べる (見せる → やらせる)
//   - 14 ステップ 以内 で 主要 機能 を 1 周
//   - 触れ ない 要素 (master 専用 等) は 説明 だけ で 進める
// ============================================================
import type { TourStep } from '../components/GuidedTourSpotlight';

// ── Prism (BtoB) ツアー: 14 ステップ ────────────────────
export const PRISM_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: '👋 CORE Prism へ ようこそ',
    body: 'これ から 1 分 30 秒 で、 14 名 の AI 役員 が あなた の 代わり に 仕事 を こなす 仕組み を 案内 します。 触り ながら 覚えられる 様 に なって います。',
    placement: 'auto',
  },
  {
    id: 'agent-team-monitor',
    title: '🏢 まず ここ が 「AI 会社」 です',
    body: '画面 右下 の パネル が CXO 軍団 の 作戦本部。 14 名 の 役員 が ここ に 待機 して います。 タップ すると 開きます。',
    target: '[data-tour-id="agent-team-monitor"]',
    tapLabel: 'パネル を 開く',
    placement: 'left',
    waitMs: 4000,
  },
  {
    id: 'cxo-grid',
    title: '👥 14 名 の 役員 が ここ に います',
    body: 'CEO / CFO / CMO / CTO… 各 役員 が 担当 領域 を 持って います。 タップ する と 「今 任せられる 3 件」 が 出ます。',
    target: '[data-tour-id="cxo-grid"]',
    tapLabel: '役員 を 1 人 タップ',
    placement: 'top',
  },
  {
    id: 'briefings-button',
    title: '📋 成果物 は ここ に 全部 蓄積',
    body: '役員 が 作った 「文書 / 計画 / 分析」 が 全部 役員 日報 に 自動 保存 されます。 検索 / DL / ナレッジ 化 も できる。',
    target: '[data-tour-id="briefings-button"]',
    tapLabel: '役員 日報 を 開く',
    placement: 'top',
  },
  {
    id: 'morning-brief',
    title: '🌅 朝 開くと これ が 出ます',
    body: '毎朝 自動 で 「昨日 の 数字 + 今日 30 分 で やる 3 件」 を 役員 が 提案。 触らなくて も 仕事 が 前 に 進む 仕掛け です。',
    target: '[data-tour-id="morning-brief"]',
    placement: 'auto',
    waitMs: 2000,
  },
  {
    id: 'kpi-sparkline',
    title: '📊 主要 数字 が 一目 で',
    body: 'オンボ 完了 率 / DAU / 月次 売上 の 30 日 推移。 異常 値 は 赤 で 警告。',
    target: '[data-tour-id="kpi-sparkline"]',
    placement: 'bottom',
  },
  {
    id: 'knowledge-base',
    title: '🧠 ナレッジ ベース = 役員 の 脳',
    body: 'ファイル / メモ / 議事 録 を 渡す ほど、 役員 が 「あなた の 文脈」 で 動ける 様 に なります。 ドラッグ で 取込 OK。',
    target: '[data-tour-id="knowledge-section"]',
    placement: 'auto',
  },
  {
    id: 'studios',
    title: '🛠 10 種 の Studio (専門 作業 場)',
    body: '請求書 / 文書 / 画像 / 動画 / CRM / 損益 / 経費 等、 業務 別 の 専門 画面。 各 Studio で AI が 1 件 完結 で 仕上げ ます。',
    target: '[data-tour-id="studios-section"]',
    placement: 'auto',
  },
  {
    id: 'cmd-k',
    title: '⌘ Cmd+K で 全機能 を 一発 検索',
    body: 'キーボード で Cmd+K を 押す と 「全機能 + 過去 AI 提案」 が 横断 検索 できます。 慣れ たら 最速 で 動ける 操作 です。',
    placement: 'auto',
  },
  {
    id: 'quick-ask',
    title: '💬 困った 時 は 右下 の ✦',
    body: '画面 右下 の 紺色 FAB を タップ する と 「今 AI に 質問」 できます。 ナレッジ を 横断 して 答えて くれます。',
    target: '[data-tour-id="quick-ask"]',
    placement: 'left',
  },
  {
    id: 'feedback',
    title: '💡 「こう したい」 は 左下 へ',
    body: '改善 提案 ボタン から 「ここ こう したい」 を 即 送信 → 開発 へ 直 結 します。',
    target: '[data-tour-id="suggestion-fab"]',
    placement: 'right',
  },
  {
    id: 'settings',
    title: '⚙️ 設定 + 連携',
    body: 'Stripe / Gmail / Calendar / LINE / Instagram の 連携 は 設定 から。 連携 すれば 役員 が 自動 で 数字 を 取り に 行きます。',
    target: '[data-tour-id="settings-button"]',
    placement: 'auto',
  },
  {
    id: 'persona-switch',
    title: '🎭 複数 事業 を 持つ なら ペルソナ で 分ける',
    body: '本業 / 副業 を ペルソナ 別 に 切り替え られます。 ナレッジ / 案件 / 役員 の 文脈 は 完全 隔離。',
    target: '[data-tour-id="persona-switch"]',
    placement: 'bottom',
  },
  {
    id: 'finish',
    title: '🎉 これ で 一通り 終わり です',
    body: 'まず は CXO を 1 人 タップ → 「今週 の 集客 案 3 つ」 を 任せて みて ください。 60 秒 で 成果物 が 役員 日報 に 入ります。 もう 一度 ツアー したい 時 は Cmd+K で 「ツアー」 と 検索。',
    placement: 'auto',
  },
];

// ── Iris (Creator) ツアー: 12 ステップ ─────────────────
export const IRIS_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: '✨ CORE Iris へ ようこそ',
    body: 'これ から 1 分 で、 6 名 の AI 役員 が 「Instagram / 案件 / 単価」 を 上げる 仕組み を 案内 します。 触り ながら 覚えられます。',
    placement: 'auto',
  },
  {
    id: 'ig-connect',
    title: '📸 まず Instagram を 繋ぐ',
    body: 'Iris の 中核 は IG 連携。 OAuth で プロフィール / 投稿 / DM を 取得 → 役員 が 戦略 に 反映 します。',
    target: '[data-tour-id="ig-connect"]',
    tapLabel: 'IG 連携 へ',
    placement: 'auto',
  },
  {
    id: 'iris-agents',
    title: '👥 6 名 の クリエイター 役員',
    body: 'コンテンツ / 案件 / DM / 分析 / 美容 / 戦略 の 6 名 が 役員 として 動きます。 タップ で 任せる。',
    target: '[data-tour-id="iris-cxo-grid"]',
    tapLabel: '役員 を タップ',
    placement: 'top',
  },
  {
    id: 'reel-studio',
    title: '🎬 リール Studio',
    body: '台本 / 字幕 / BGM / ハッシュタグ を 1 タップ で 設計。 投稿 予約 まで 一気 通貫。',
    target: '[data-tour-id="reel-studio"]',
    placement: 'auto',
  },
  {
    id: 'deal-capture',
    title: '💌 DM スクショ で 案件 取込',
    body: 'ブランド から の DM を スクショ → AI が 金額 / 期限 / 業務 内容 を 抽出 → 自動 で 案件 化。',
    target: '[data-tour-id="deal-capture"]',
    placement: 'auto',
  },
  {
    id: 'fan-engagement',
    title: '💕 ファン エンゲージ',
    body: 'DM 一括 自動 返信 + 案件 候補 抽出。 24h 以内 返信 で エンゲージ メント 維持。',
    target: '[data-tour-id="fan-engagement"]',
    placement: 'auto',
  },
  {
    id: 'post-queue',
    title: '📅 投稿 予約 キュー',
    body: '複数 媒体 (IG / X / TikTok) に 時刻 予約。 失敗 通知 + 容量 自動 調整 で 落とさない。',
    target: '[data-tour-id="post-queue"]',
    placement: 'auto',
  },
  {
    id: 'brand-match',
    title: '🤝 ブランド 案件 マッチ',
    body: '相性 良い ブランド 5 社 を AI が リスト + 提案 文 を 自動 生成。 こちら から 営業 する 仕組み。',
    target: '[data-tour-id="brand-match"]',
    placement: 'auto',
  },
  {
    id: 'iris-knowledge',
    title: '🧠 ナレッジ = あなた の 世界 観',
    body: 'プロフィール / 過去 投稿 / ブランド 観 を 渡す ほど、 役員 が 「あなた らしい 文章 / 提案」 を 書ける 様 に。',
    target: '[data-tour-id="iris-knowledge"]',
    placement: 'auto',
  },
  {
    id: 'iris-briefings',
    title: '📋 成果物 は 役員 日報 タブ に',
    body: '役員 が 作った 投稿 案 / 提案 文 / 分析 を 全部 蓄積。 検索 / DL / IG 直 シェア も できる。',
    target: '[data-tour-id="iris-briefings"]',
    placement: 'top',
  },
  {
    id: 'iris-share',
    title: '📲 IG 直 シェア',
    body: 'Web Share API → Instagram アプリ に 即 ジャンプ。 ストーリー / フィード / リール どこに でも 投稿 可能。',
    target: '[data-tour-id="iris-share-button"]',
    placement: 'left',
  },
  {
    id: 'finish',
    title: '🎉 これ で 一通り 終わり です',
    body: 'まず DM スクショ を 1 枚 入れて 案件 取込 を 試して ください。 60 秒 で AI が 提案 文 を 作って くれます。 もう 一度 ツアー は Cmd+K → 「ツアー」。',
    placement: 'auto',
  },
];
