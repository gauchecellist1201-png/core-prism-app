// ============================================================
// guidedTourSteps — Prism / Iris の「使い方の案内」の中身
//
// 各ステップ:
//   - target: 実 UI 要素のセレクタ (data-tour-id="xxx")
//   - title / body: 何ができるかを、やさしい言葉で
//   - preAction: 必要ならタブ切替 / モーダルを開く
//
// 書き方のルール (2026-08-04 見直し):
//   - 絵文字は使わない (画面の飾りは線画アイコンに寄せる)
//   - 日本語のあいだに余分な空白を入れない
//   - iPhone に無い操作を案内しない (Cmd キー・左サイドバー等)
//   - 触れない要素は説明だけで進める
// ============================================================
import type { TourStep } from '../components/GuidedTourSpotlight';

// ── Prism (BtoB) の案内: 15 ステップ ────────────────────
export const PRISM_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'CORE Prism へようこそ',
    body: 'これから1分半で、請求書・議事録・資料づくり・売上の管理を、14名のAI役員がまとめて引き受ける仕組みを案内します。読むだけでなく、実際に触りながら進められます。',
    placement: 'auto',
  },
  {
    id: 'company-hero',
    title: 'ここがあなたの会社の入口です',
    body: '画面のいちばん上にある「あなたの役員会議室」に、14名のAI役員がいます。名前・担当・いま動いているかが、ひと目で分かります。',
    target: '[data-tour-id="digital-company-hero"]',
    placement: 'auto',
    waitMs: 4000,
  },
  {
    id: 'cxo-grid',
    title: '14名の役員が並んでいます',
    body: '経理・営業・広報・開発など、担当がそれぞれ決まっています。タップすると「いま任せられる仕事3件」が出てきます。',
    target: '[data-tour-id="cxo-grid"]',
    tapLabel: '役員を1人タップ',
    placement: 'top',
  },
  {
    id: 'agent-team-monitor',
    title: '仕事を渡すと、ここが動きます',
    body: '任せた仕事の「やっています / 終わりました」がここに出ます。自分が手を動かしていない間も進んでいるのが見えます。',
    target: '[data-tour-id="agent-team-monitor"]',
    placement: 'left',
    waitMs: 4000,
  },
  {
    id: 'briefings-button',
    title: 'できあがったものは全部ここに残ります',
    body: '役員がつくった文書・計画・分析は、すべて「役員日報」に自動で保存されます。あとから探す・保存する・資料として使い回すことができます。',
    target: '[data-tour-id="briefings-button"]',
    tapLabel: '役員日報を開く',
    placement: 'top',
  },
  {
    id: 'morning-brief',
    title: '朝ひらくと、これが出ます',
    body: '毎朝「昨日の数字」と「今日30分でやる3件」が用意されます。何から手をつけるかを考えなくて済みます。',
    target: '[data-tour-id="morning-brief"]',
    placement: 'auto',
    waitMs: 2000,
  },
  {
    id: 'kpi-sparkline',
    title: '大事な数字がひと目で分かります',
    body: '直近30日の動きを線で表示します。おかしな数字は赤で知らせます。実際に入っているデータだけを出すので、見た数字はそのまま信じて大丈夫です。',
    target: '[data-tour-id="kpi-sparkline"]',
    placement: 'bottom',
  },
  {
    id: 'knowledge-base',
    title: 'ナレッジ = 役員が読む資料の棚',
    body: '書類・メモ・議事録を入れるほど、役員があなたの事情をふまえて動けるようになります。ファイルを選んで入れるだけです。',
    target: '[data-tour-id="knowledge-section"]',
    placement: 'auto',
  },
  {
    id: 'studios',
    title: '仕事の種類ごとの作業場が10個あります',
    body: '請求書・文書・画像・動画・顧客管理・損益・経費など、それぞれ専用の画面です。ひとつの用事がその画面だけで終わります。',
    target: '[data-tour-id="studios-section"]',
    placement: 'auto',
  },
  {
    id: 'search-all',
    title: 'どこにあるか分からない時は、検索',
    body: '機能も、過去にAIが出した提案も、まとめて1か所で探せます。iPhone では画面下の入力欄から、パソコンでは Cmd+K（Windows は Ctrl+K）でも開きます。見つかった件数は隠さず全部出します。',
    placement: 'auto',
  },
  {
    id: 'quick-ask',
    title: '困ったらここから質問できます',
    body: 'ここを押すと、その場でAIに質問できます。入れてある資料をまとめて読んだうえで答えます。',
    target: '[data-tour-id="quick-ask"]',
    placement: 'left',
  },
  {
    id: 'feedback',
    title: '「こうしたい」はここから送れます',
    body: '使っていて気になったところを、その場で送れます。開発にそのまま届きます。',
    target: '[data-tour-id="suggestion-fab"]',
    placement: 'right',
  },
  {
    id: 'settings',
    title: '設定と、外のサービスとのつなぎ込み',
    body: '決済・メール・カレンダー・LINE・Instagram とつなぐ設定はここです。つなぐと、役員が数字を自分で取りに行けるようになります。',
    target: '[data-tour-id="settings-button"]',
    placement: 'auto',
  },
  {
    id: 'persona-switch',
    title: '事業が複数あるなら、ここで切り替えます',
    body: '本業と副業などを分けて持てます。資料も案件も役員のおぼえている内容も、混ざりません。',
    target: '[data-tour-id="persona-switch"]',
    placement: 'bottom',
  },
  {
    id: 'finish',
    title: 'ここまでで、ひと通りです',
    body: 'まずは役員を1人タップして「今週の集客案を3つ」と頼んでみてください。1分ほどで、できあがったものが役員日報に入ります。もう一度この案内を見たい時は、検索で「使い方」と打ってください。',
    placement: 'auto',
  },
];

// ── Iris (Creator) の案内: 12 ステップ ─────────────────
export const IRIS_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'CORE Iris へようこそ',
    body: 'これから1分で、6名のAI担当が Instagram の投稿・お仕事の話・単価の相談をまとめて引き受ける仕組みを案内します。触りながら進められます。',
    placement: 'auto',
  },
  {
    id: 'ig-connect',
    title: 'まず Instagram をつなぎます',
    body: 'つなぐと、プロフィール・投稿・DMを読み取って、投稿の中身や返事づくりに反映できるようになります。',
    target: '[data-tour-id="ig-connect"]',
    tapLabel: 'Instagram をつなぐ',
    placement: 'auto',
  },
  {
    id: 'iris-agents',
    title: '6名の担当がいます',
    body: '投稿づくり・お仕事の話・DMの返事・数字の分析・美容・全体の作戦、それぞれ担当が分かれています。タップして任せます。',
    target: '[data-tour-id="iris-cxo-grid"]',
    tapLabel: '担当を1人タップ',
    placement: 'top',
  },
  {
    id: 'reel-studio',
    title: 'リールをつくる場所',
    body: '台本・字幕・音・ハッシュタグを、選ぶだけで組み立てられます。投稿の予約まで、この画面のなかで終わります。',
    target: '[data-tour-id="reel-studio"]',
    placement: 'auto',
  },
  {
    id: 'deal-capture',
    title: 'DMのスクショから、お仕事の話を取り込めます',
    body: '企業から届いたDMのスクリーンショットを入れると、金額・期限・やることを読み取って、案件として残します。',
    target: '[data-tour-id="deal-capture"]',
    placement: 'auto',
  },
  {
    id: 'fan-engagement',
    title: 'DMの返事をまとめて用意します',
    body: 'たまったDMの返事の下書きを一度に用意し、お仕事につながりそうなものを見つけ出します。',
    target: '[data-tour-id="fan-engagement"]',
    placement: 'auto',
  },
  {
    id: 'post-queue',
    title: '投稿の予約リスト',
    body: 'Instagram・X・TikTok に時間を決めて予約できます。失敗した時は必ず知らせます。黙って落ちることはありません。',
    target: '[data-tour-id="post-queue"]',
    placement: 'auto',
  },
  {
    id: 'brand-match',
    title: '相性の良い企業を探します',
    body: '合いそうな企業を並べて、送る文章の下書きまで用意します。待つのではなく、こちらから声をかけられます。',
    target: '[data-tour-id="brand-match"]',
    placement: 'auto',
  },
  {
    id: 'iris-knowledge',
    title: 'ナレッジ = あなたらしさの置き場',
    body: 'プロフィール・過去の投稿・大事にしていることを入れるほど、出てくる文章があなたの言い方に近づきます。',
    target: '[data-tour-id="iris-knowledge"]',
    placement: 'auto',
  },
  {
    id: 'iris-briefings',
    title: 'できたものは日報タブに残ります',
    body: '投稿案・提案文・分析はすべてここに貯まります。あとから探す・保存する・そのまま Instagram に送ることができます。',
    target: '[data-tour-id="iris-briefings"]',
    placement: 'top',
  },
  {
    id: 'iris-share',
    title: 'Instagram にそのまま送れます',
    body: 'ここを押すと Instagram アプリが開きます。ストーリー・フィード・リールのどれにでも送れます。',
    target: '[data-tour-id="iris-share-button"]',
    placement: 'left',
  },
  {
    id: 'finish',
    title: 'ここまでで、ひと通りです',
    body: 'まずはDMのスクリーンショットを1枚入れて、お仕事の取り込みを試してみてください。1分ほどで提案文までできます。もう一度この案内を見たい時は、検索で「使い方」と打ってください。',
    placement: 'auto',
  },
];
