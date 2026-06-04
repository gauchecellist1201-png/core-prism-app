// ============================================================
// 共有メールテンプレート — Resend / Gmail SMTP 両経路で使用
// ============================================================

export type Template = 'welcome' | 'trial_ending' | 'cancel_save' | 'reengagement' | 'd3_highlights' | 'd7_progress' | 'd14_results';

export interface TemplateData {
  name?: string;
  brand?: string;
  plan?: string;
  code?: string;
  days?: number;
  upgradeUrl?: string;
}

function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif; }
  .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #0033A0, #1A4FC4); padding: 32px 40px; color: #fff; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.3px; }
  .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.8; }
  .body { padding: 32px 40px; color: #1F1A2E; }
  .body p { line-height: 1.8; font-size: 15px; margin: 0 0 16px; }
  .cta { display: inline-block; background: linear-gradient(135deg, #0033A0, #1A4FC4); color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 999px; font-weight: 700; font-size: 15px; margin: 8px 0 24px; }
  .highlight { background: #f0f4ff; border-left: 3px solid #0033A0; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 14px; }
  .footer { padding: 20px 40px; background: #f4f4f7; font-size: 12px; color: #8A8593; text-align: center; line-height: 1.7; }
</style>
</head>
<body>
<div class="wrap">
${body}
<div class="footer">
  © 2026 CORE Inc. | <a href="https://core-prism-app.vercel.app" style="color:#0033A0;">core-prism-app.vercel.app</a><br>
  このメールに心当たりがない場合はご連絡ください。
</div>
</div>
</body>
</html>`;
}

function welcomeHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const brand = data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const guideUrl = data.brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml(`${brand} へようこそ`, `
<div class="header">
  <h1>ようこそ、${brand} へ</h1>
  <p>アカウントが正常に作成されました</p>
</div>
<div class="body">
  <p>${name} さん、${brand} にご登録いただきありがとうございます。</p>
  <p>最初の <strong>3 分</strong> で ${brand} を体感する手順をご案内します。</p>
  <div class="highlight">
    <strong>ステップ 1</strong> — ダッシュボードを開く<br>
    <strong>ステップ 2</strong> — 「AI 相談」でビジネス課題を入力<br>
    <strong>ステップ 3</strong> — 提案を受け取り、次のアクションを決める
  </div>
  <a class="cta" href="${guideUrl}">${brand} を今すぐ始める →</a>
  <p style="font-size:13px;color:#8A8593;">ご不明な点はいつでもサポートまでご連絡ください。</p>
</div>`);
}

function trialEndingHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const days = data.days ?? 3;
  const upgradeUrl = data.upgradeUrl || 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml('無料トライアル終了まであと少し', `
<div class="header" style="background: linear-gradient(135deg, #7C3AED, #C026D3);">
  <h1>トライアルがあと ${days} 日で終了</h1>
  <p>引き続きご利用いただくにはプランのアップグレードを</p>
</div>
<div class="body">
  <p>${name} さん、こんにちは。</p>
  <p>ご利用の無料トライアルは <strong>あと ${days} 日</strong> で終了します。</p>
  <p>トライアル終了後もすべての機能を使い続けるには、有料プランへのアップグレードをお願いします。</p>
  <div class="highlight">
    <strong>Lite</strong> — ¥1,980/月 (Iris) または ¥4,980/月 (Prism)<br>
    <strong>Standard</strong> — 人気 No.1。AI 機能が無制限に<br>
    <strong>Pro / Studio</strong> — チーム・代理店向け
  </div>
  <a class="cta" href="${upgradeUrl}">プランをアップグレード →</a>
  <p style="font-size:13px;color:#8A8593;">アップグレードしなかった場合、トライアル終了後もデータは保持されます。</p>
</div>`);
}

function cancelSaveHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const code = data.code || 'COMEBACK50';
  const resubUrl = 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml('またいつでも戻ってきてください', `
<div class="header" style="background: linear-gradient(135deg, #374151, #6B7280);">
  <h1>ご利用ありがとうございました</h1>
  <p>いつでも再開できます</p>
</div>
<div class="body">
  <p>${name} さん、これまでのご利用、誠にありがとうございました。</p>
  <p>解約のお手続きが完了しました。現在のご契約期間が終了するまでは引き続きご利用いただけます。</p>
  <p>気が変わったときのために、<strong>50% OFF の復帰クーポン</strong> をご用意しました。</p>
  <div class="highlight" style="border-color: #10B981; background: #f0fdf4;">
    <strong>復帰クーポンコード:</strong><br>
    <span style="font-size: 22px; font-weight: 900; letter-spacing: 3px; color: #065f46;">${code}</span><br>
    <span style="font-size: 12px; color: #6B7280;">初月 50% OFF。有効期限: 30 日間</span>
  </div>
  <a class="cta" style="background: linear-gradient(135deg, #059669, #10B981);" href="${resubUrl}">再開する →</a>
  <p style="font-size:13px;color:#8A8593;">またいつでもお待ちしております。</p>
</div>`);
}

function reengagementHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  const brand = data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
  const days = data.days ?? 1;
  const url = data.brand === 'iris'
    ? 'https://core-prism-app.vercel.app/iris?app=1'
    : 'https://core-prism-app.vercel.app/?app=1';

  return baseHtml(`${brand} があなたを待っています`, `
<div class="header" style="background: linear-gradient(135deg, #E1306C, #F77737);">
  <h1>${name} さん、おかえりなさい</h1>
  <p>${days} 日ぶりのご訪問をお待ちしています</p>
</div>
<div class="body">
  <p>${name} さん、おはようございます。</p>
  <p>${brand} に最後にログインしてから <strong>${days} 日</strong> が経ちました。</p>
  <p>今日の朝のブリーフ、あなたの AI マネージャがすでに準備しています。</p>
  <div class="highlight" style="border-color: #E1306C; background: #fff0f5;">
    <strong>今すぐ開くと…</strong><br>
    ・今日フォーカスすべき 3 アクション<br>
    ・進行中の案件 / 納期サマリー<br>
    ・連続日数のストリーク復帰チャンス
  </div>
  <a class="cta" style="background: linear-gradient(135deg, #E1306C, #F77737);" href="${url}">${brand} を開く →</a>
  <p style="font-size:13px;color:#8A8593;">通知が不要な場合は設定からオフにできます。</p>
</div>`);
}

// ──────────────────────────────────────────────
// XXXXX (2026-06-04): D3 / D7 / D14 オンボ ナーチャリング テンプレ
// ──────────────────────────────────────────────

function d3HighlightsHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  return baseHtml('3 日目の確認 — 14 役員 はちゃんと動いていますか?', `
<div class="header" style="background: linear-gradient(135deg, #A78BFA, #F472B6, #FBBF24);">
  <h1>3 日目の確認</h1>
  <p>${name} さん、14 役員 はちゃんと動いていますか?</p>
</div>
<div class="body">
  <p>CORE Prism を始めて <strong>3 日</strong> — 14 人の役員 を「肌で感じる」のに 最適なタイミングです。</p>
  <p>下の <strong>3 つのタスク</strong> を 1 回ずつ AI に頼んでみてください。それぞれ 1 分で結果が返ります。</p>
  <div class="highlight" style="border-color: #A78BFA; background: #faf7ff;">
    <strong>📊 CFO に「今月の収支を整理して」</strong><br>
    入金 / 出金 を一覧化 → 30 秒で 赤字 / 黒字 が見える
  </div>
  <div class="highlight" style="border-color: #6366F1; background: #f0f4fa;">
    <strong>💼 CSO (営業) に「明日アプローチする 3 社を選んで」</strong><br>
    CRM から「いま動かすべき 3 社」 + 一文 アプローチを 即時生成
  </div>
  <div class="highlight" style="border-color: #F472B6; background: #fff0f5;">
    <strong>📣 CMO (マーケ) に「今週の SNS 投稿 3 本を生成」</strong><br>
    note / X / Instagram 用 を 3 本 同時生成 → コピー → 投稿 で完
  </div>
  <a class="cta" style="background: linear-gradient(135deg, #A78BFA, #F472B6);" href="https://core-prism-app.vercel.app/?utm_source=d3_highlights">✨ いま始める →</a>
  <p style="font-size:13px;color:#8A8593;">画面左下の 💡 改善提案 で 1 行 フィードバック もお待ちしてます。</p>
</div>`);
}

function d7ProgressHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  return baseHtml('1 週間 おつかれさま — 14 役員 の 進捗', `
<div class="header" style="background: linear-gradient(135deg, #34D399, #10B981, #059669);">
  <h1>1 週間 おつかれさま</h1>
  <p>${name} さん、14 役員 と どこまで来ましたか?</p>
</div>
<div class="body">
  <p>CORE Prism を始めて <strong>1 週間</strong>。3 日目 にお送りした 3 タスクの 「結果が出始める」 のは このタイミングです。</p>
  <p>もし「まだ ピンと来てない」 なら、次の <strong>+2 つ</strong> を 今週中 に試してみてください — どれも 1 タップ で 動きます。</p>
  <div class="highlight" style="border-color: #34D399; background: #f0fdf4;">
    <strong>🧠 CDS に「先週の数字を比較して 一番効いた施策」</strong><br>
    自分でも気づかなかった「勝ちパターン」 を 数字 から 抽出
  </div>
  <div class="highlight" style="border-color: #6366F1; background: #f5f3ff;">
    <strong>👔 CEO に「来週やる 3 つの大事なこと」</strong><br>
    朝 1 分 で「今週 何に集中するか」 が 自分の言葉になる
  </div>
  <p style="margin-top:18px;font-size:14px"><strong>採用率 が 50% を超えた CXO の提案</strong> が ある場合、画面 上の 履歴 (Cmd+Shift+H) からも 振り返れます。</p>
  <a class="cta" style="background: linear-gradient(135deg, #34D399, #10B981);" href="https://core-prism-app.vercel.app/?utm_source=d7_progress">📈 続きを見る →</a>
  <p style="font-size:13px;color:#8A8593;">「もう自走している」 なら 返信不要。気になることがあれば 1 行 で 返信ください。</p>
</div>`);
}

function d14ResultsHtml(data: TemplateData): string {
  const name = data.name || 'お客様';
  return baseHtml('2 週間 — 投資判断 の時間', `
<div class="header" style="background: linear-gradient(135deg, #6366F1, #A855F7, #EC4899);">
  <h1>2 週間 — 投資判断 の時間</h1>
  <p>${name} さん、CORE Prism は「経費」 になりましたか? それとも 「投資」 になりましたか?</p>
</div>
<div class="body">
  <p>2 週間 が経ちました。 ここまで来た方には 「率直な振り返り」 をお願いしています。</p>
  <p>下の 3 つの問い に「はい / いいえ」 で 答えてみてください — 全部 「はい」 なら、 投資 として 継続が正解 です。</p>
  <div class="highlight" style="border-color: #6366F1; background: #f5f3ff;">
    <strong>Q1.</strong> 自分が 1 人で 抱えていた 雑務 を 5 件 以上 AI に渡せた?<br>
    <strong>Q2.</strong> AI の提案 で 「採用」 を 押した数 が 「却下」 を 上回っている? (履歴 Cmd+Shift+H)<br>
    <strong>Q3.</strong> 来週 また 朝コーチ を 1 度は開きたいと思う?
  </div>
  <p style="margin-top:18px;font-size:14px">「いいえ」 が 1 つでもあれば、 オーナー (井出) に <strong>直接 メール返信</strong> してください。当日に 30 分 だけ 個別に お話を伺います (料金 据え置き)。</p>
  <a class="cta" style="background: linear-gradient(135deg, #6366F1, #A855F7);" href="https://core-prism-app.vercel.app/billing?utm_source=d14_results">📊 数字で 判断する →</a>
  <a class="cta" style="background: rgba(99,102,241,0.08); color: #6366F1; border: 1px solid #6366F1;" href="mailto:gauche.cellist1201@gmail.com?subject=CORE+2週間+振り返り">📨 30 分 を 予約する</a>
  <p style="font-size:13px;color:#8A8593;">継続 / 解約 / 一時停止 — どれを選んでも、データ は 30 日 残ります。</p>
</div>`);
}

export function buildEmail(template: Template, data: TemplateData): { subject: string; html: string } {
  switch (template) {
    case 'welcome':
      return {
        subject: `ようこそ ${data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} へ — はじめかたガイド`,
        html: welcomeHtml(data),
      };
    case 'trial_ending':
      return {
        subject: `【重要】無料トライアルがあと ${data.days ?? 3} 日で終了します`,
        html: trialEndingHtml(data),
      };
    case 'cancel_save':
      return {
        subject: 'ご利用ありがとうございました — 復帰クーポンをお届けします',
        html: cancelSaveHtml(data),
      };
    case 'reengagement':
      return {
        subject: `${data.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} があなたを待っています — 今日のブリーフが準備できました`,
        html: reengagementHtml(data),
      };
    case 'd3_highlights':
      return {
        subject: '3 日目の確認 — 14 役員 はちゃんと 動いてますか?',
        html: d3HighlightsHtml(data),
      };
    case 'd7_progress':
      return {
        subject: '1 週間 おつかれさま — 14 役員 と どこまで来ましたか',
        html: d7ProgressHtml(data),
      };
    case 'd14_results':
      return {
        subject: '2 週間 — 経費 か 投資 か、 数字 で 判断する 時間',
        html: d14ResultsHtml(data),
      };
  }
}

export const VALID_TEMPLATES: Template[] = ['welcome', 'trial_ending', 'cancel_save', 'reengagement', 'd3_highlights', 'd7_progress', 'd14_results'];
