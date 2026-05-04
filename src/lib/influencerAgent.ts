// ============================================================
// インフルエンサーデスク AI — 交渉メッセージ・投稿下書き・レポート生成
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import type {
  InfluencerDeal, MediaKit, NegotiationDraft, NegotiationType, PlatformMetrics,
} from '../types/influencerDeal';
import {
  NEGOTIATION_TYPE_META, PLATFORM_META, CONTENT_TYPE_META,
} from '../types/influencerDeal';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

function fmtMediaKit(k?: MediaKit): string {
  if (!k) return '(メディアキット未設定)';
  const lines: string[] = [];
  if (k.handleName) lines.push(`表示名: ${k.handleName}`);
  if (k.followers) {
    const fws = Object.entries(k.followers).filter(([, v]) => v).map(([p, v]) => `${PLATFORM_META[p as keyof typeof PLATFORM_META].label} ${v?.toLocaleString()}`);
    if (fws.length) lines.push(`フォロワー: ${fws.join(' / ')}`);
  }
  if (k.avgEngagementRate) {
    const ers = Object.entries(k.avgEngagementRate).filter(([, v]) => v !== undefined).map(([p, v]) => `${PLATFORM_META[p as keyof typeof PLATFORM_META].label} ${v}%`);
    if (ers.length) lines.push(`平均ER: ${ers.join(' / ')}`);
  }
  if (k.monthlyReach) lines.push(`月間平均リーチ: ${k.monthlyReach.toLocaleString()}`);
  if (k.audienceProfile) lines.push(`オーディエンス: ${k.audienceProfile}`);
  if (k.rateCard) lines.push(`レートカード: ${k.rateCard}`);
  if (k.brandValues) lines.push(`ブランド観/NG: ${k.brandValues}`);
  if (k.caseHistory) lines.push(`過去案件: ${k.caseHistory}`);
  return lines.join('\n');
}

function fmtDeal(d: InfluencerDeal): string {
  const lines: string[] = [];
  lines.push(`ブランド: ${d.brandName}${d.agencyName ? ` (代理店: ${d.agencyName})` : ''}`);
  if (d.productName) lines.push(`商品/キャンペーン: ${d.productName}`);
  lines.push(`プラットフォーム: ${PLATFORM_META[d.platform].label}`);
  lines.push(`コンテンツ: ${CONTENT_TYPE_META[d.contentType]}`);
  lines.push(`報酬: ¥${d.fee.toLocaleString()}${d.usageFee ? ` (+ 二次利用 ¥${d.usageFee.toLocaleString()})` : ''}`);
  lines.push(`納品物: ${d.deliverables}`);
  if (d.draftDeadline)  lines.push(`下書き期限: ${d.draftDeadline}`);
  if (d.postDeadline)   lines.push(`投稿期限: ${d.postDeadline}`);
  if (d.reportDeadline) lines.push(`レポート期限: ${d.reportDeadline}`);
  if (d.guidelines) lines.push(`ガイドライン: ${d.guidelines}`);
  if (d.notes) lines.push(`メモ: ${d.notes}`);
  if (d.contactName) lines.push(`担当者: ${d.contactName}${d.contactEmail ? ` <${d.contactEmail}>` : ''}`);
  return lines.join('\n');
}

// ─── 1. 交渉メッセージ生成 ──────────────────────
export async function generateNegotiation(opts: {
  settings: AppSettings;
  persona: Persona;
  deal: InfluencerDeal;
  mediaKit?: MediaKit;
  type: NegotiationType;
  targetFee?: number;     // カウンターオファー時
  customNote?: string;    // 任意追加指示
}): Promise<Omit<NegotiationDraft, 'id' | 'dealId' | 'status'>> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const meta = NEGOTIATION_TYPE_META[opts.type];

  const sys = `あなたは「インフルエンサーの代わりに広告代理店・ブランドとやり取りするマネージャー」です。
返答は必ず JSON で、説明文・コードブロック禁止。スキーマ:
{
  "subject": "件名 (なければ空文字)",
  "body": "本文 (件名+宛名+本文+締め)",
  "tone": "選んだトーン名",
  "successProbability": 50
}

## 重要なルール
- 日本のビジネスメール慣習に沿って、宛名 → 受領 → 本題 → 締め の順
- 敬語を保ちつつ、媚びすぎず、対等なクリエイターとしての立場を出す
- 条件交渉ではメディアキット (フォロワー / ER / 月間リーチ) を根拠に持ち出す
- 数字を出すときは具体的に (○万円、納期 ○月○日)
- 法的な強い断言は避ける
- 文末は「何卒よろしくお願いいたします。」「ご検討のほどよろしくお願いいたします。」など状況に応じて
- 改行は \\n を使う

${toneInstruction(opts.settings.aiTone)}

## このメッセージの目的
${meta.label} — ${meta.hint}`;

  const userText = `## 案件情報
${fmtDeal(opts.deal)}

## 自分のメディアキット
${fmtMediaKit(opts.mediaKit)}

## 私 (クリエイター本人) の人格コンテキスト
${opts.persona.name} (${opts.persona.subtitle})
${opts.persona.description || ''}

## 追加指示
${opts.customNote || '(なし)'}
${opts.targetFee ? `\n## 希望報酬\n¥${opts.targetFee.toLocaleString()}` : ''}

上記の案件に対して「${meta.label}」のメッセージを生成してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `交渉文生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { body: text, tone: 'professional' };
  }

  return {
    type: opts.type,
    subject: parsed.subject || '',
    body: parsed.body || '',
    tone: parsed.tone || 'professional',
    successProbability: typeof parsed.successProbability === 'number' ? parsed.successProbability : undefined,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 2. 投稿下書き (キャプション) 生成 ──────────
export async function generateDraftCopy(opts: {
  settings: AppSettings;
  persona: Persona;
  deal: InfluencerDeal;
  mediaKit?: MediaKit;
  toneNote?: string; // 自分のトーン (例: 親しみやすく / クール / 詩的)
}): Promise<{ caption: string; hashtags: string[]; cta: string }> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const sys = `あなたは「インフルエンサー本人の声で SNS 投稿の下書きを作るゴーストライター」です。
返答は JSON のみ、説明文・コードブロック禁止。スキーマ:
{
  "caption": "本文 (絵文字や改行を活用、プラットフォームに合わせた長さ)",
  "hashtags": ["#tag1", "#tag2"],
  "cta": "コール・トゥ・アクションの一文 (プロフリンクへ誘導など)"
}

## ルール
- 「広告」「PR」「タイアップ」の必須表記をブランドのガイドラインに従って入れる
- インフルエンサー本人の声で書く (一人称、自然な口調)
- ブランドの押し売りにならない、実体験ベースで
- フォロワーが共感する切り口 (使ってみた感想 / 困りごと解決 / 推しポイント)
- 各プラットフォームの文化に合わせる
  - Instagram: 絵文字多め、3〜5段落、ハッシュタグは末尾に分けて
  - TikTok: 短く、トレンド意識、フックを冒頭に
  - X: 140字目安、続きはリプ
  - YouTube: 概要欄テンプレ、タイムスタンプ風

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 案件
${fmtDeal(opts.deal)}

## メディアキット
${fmtMediaKit(opts.mediaKit)}

## 私の人格
${opts.persona.name} (${opts.persona.subtitle})
${opts.persona.description || ''}

## このトーンで書いて
${opts.toneNote || '自然体・親しみやすく・押し売りしない'}

上記の案件で投稿する下書きを作ってください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `下書き生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      cta: parsed.cta || '',
    };
  } catch {
    return { caption: text, hashtags: [], cta: '' };
  }
}

// ─── 3. 報酬妥当性チェック ────────────────────
export async function evaluateOffer(opts: {
  settings: AppSettings;
  deal: InfluencerDeal;
  mediaKit?: MediaKit;
}): Promise<{
  verdict: 'accept' | 'counter' | 'decline';
  fairFee: { min: number; max: number };
  reason: string;
  counterScript?: string;
}> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const sys = `あなたは「インフルエンサーマーケティングの相場に詳しいエージェント」です。
日本市場のフォロワー単価・ER 別の相場を踏まえて、提示報酬が妥当かを判定します。
返答は JSON のみ:
{
  "verdict": "accept" | "counter" | "decline",
  "fairFee": { "min": 数字, "max": 数字 },
  "reason": "なぜそう判断したか (3〜5行)",
  "counterScript": "counter の場合のみ、相手に伝える際の一文 (例: 大変ありがたいご提案ですが...)"
}

## 日本市場のざっくり相場 (2025年時点、参考)
- Instagram フィード1本: フォロワー単価 1〜4 円 (ER 高いほど上振れ)
- Instagram リール: フィードの 1.2〜1.5 倍
- TikTok: フォロワー単価 0.5〜2 円 (バズ次第)
- YouTube ショート: 5万〜50万円
- YouTube 長尺: 単価 5〜15 円 / フォロワー数 (登録者ベース)
- ストーリー追加: 本投稿の 10〜20%
- 二次利用 (広告転用): 元報酬の 30〜100%

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 案件の提示
${fmtDeal(opts.deal)}

## 私のメディアキット
${fmtMediaKit(opts.mediaKit)}

この提示は妥当ですか? 判定してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 1500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `相場判定APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      verdict: parsed.verdict ?? 'counter',
      fairFee: parsed.fairFee ?? { min: 0, max: 0 },
      reason: parsed.reason ?? '',
      counterScript: parsed.counterScript,
    };
  } catch {
    return { verdict: 'counter', fairFee: { min: 0, max: 0 }, reason: text };
  }
}

// ─── 4. 案件レポート (ブランド納品用) 生成 ──────
export async function generateBrandReport(opts: {
  settings: AppSettings;
  persona: Persona;
  deal: InfluencerDeal;
  mediaKit?: MediaKit;
  metrics: PlatformMetrics;
  reflection?: string; // 自分の振り返りコメント
}): Promise<{ markdown: string; summary: string }> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const sys = `あなたは「インフルエンサーがブランド/代理店に提出する案件レポートを書く秘書」です。
返答は JSON のみ:
{
  "markdown": "Markdown形式のレポート全文",
  "summary": "1-2行のエグゼクティブサマリー"
}

## レポート構成 (markdown)
1. 案件概要 (ブランド・商品・プラットフォーム・投稿日)
2. 数値実績 (リーチ・インプレッション・ER・いいね・コメント・保存・シェア)
3. ハイライト (バズった反応・印象的なコメント)
4. ブランド側への振り返り
5. 次回への提案 (例: ストーリー追加で+20%リーチ見込みなど)

## トーン
丁寧かつフラット。誇張せず、数字を中心に語る。

${toneInstruction(opts.settings.aiTone)}`;

  const m = opts.metrics;
  const numLine = (label: string, v?: number, suffix = '') =>
    v !== undefined && v !== null ? `- ${label}: ${v.toLocaleString()}${suffix}` : '';
  const metricsBlock = [
    numLine('リーチ', m.reach),
    numLine('インプレッション', m.impressions),
    numLine('エンゲージメント率', m.engagementRate, '%'),
    numLine('いいね', m.likes),
    numLine('コメント', m.comments),
    numLine('保存', m.saves),
    numLine('シェア', m.shares),
    numLine('再生数', m.views),
    numLine('視聴時間', m.watchTimeSec, '秒'),
    numLine('クリック', m.clicks),
  ].filter(Boolean).join('\n');

  const userText = `## 案件
${fmtDeal(opts.deal)}

## メディアキット
${fmtMediaKit(opts.mediaKit)}

## 投稿後の数値
${metricsBlock || '(数値未入力)'}

## 自分の振り返り
${opts.reflection || '(なし)'}

## 私の人格
${opts.persona.name} (${opts.persona.subtitle})

このデータで、ブランド/代理店に提出するレポートを作ってください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 3500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `レポート生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m2 = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m2 ? m2[0] : text);
    return {
      markdown: parsed.markdown || '',
      summary: parsed.summary || '',
    };
  } catch {
    return { markdown: text, summary: '' };
  }
}
