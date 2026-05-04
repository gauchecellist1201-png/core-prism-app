// ============================================================
// 商談 AI エージェント — Claude を呼んで企業リサーチ・営業メール・シグナル予測
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import type { CompanyResearch, SalesLead, ApproachDraft, IntentSignal } from '../types/salesAgent';
import { enqueueClaudeCall } from './apiQueue';
import { toneInstruction } from './aiTone';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

// ─── 1. 企業リサーチ AI ─────────────────────────────
export async function researchCompany(opts: {
  settings: AppSettings;
  persona: Persona;
  companyName: string;
  url?: string;
  ownProduct?: string;        // 自社の商材説明
  publicInfo?: string;        // ユーザーが貼り付けた追加情報
}): Promise<Omit<CompanyResearch, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude API キーが未設定です');

  const sys = `あなたは敏腕の営業リサーチアナリストです。
ユーザーが指定した企業について、公開情報や一般的な業界知識から「営業に役立つ情報」を構造化して返します。

返答は **JSONのみ** (コードブロック・説明文なし):
{
  "industry": "業界",
  "revenueEstimate": "売上規模の推定 (例: '年商 10〜50億円' '不明')",
  "employeeCount": "従業員数の推定 (例: '50〜200名')",
  "overview": "事業概要 (3〜4行)",
  "predictedChallenges": ["この企業が抱えていそうな課題1", ...] // 3〜5項目
  "pitchAngle": "この企業に売り込むなら、どの角度が刺さるか (1文)",
  "keyPersonHints": ["重要人物の探し方や肩書ヒント1", ...] // 2〜3項目
  "recommendedSteps": ["最初の接触から商談までの推奨ステップ1", ...] // 3〜5項目
  "signals": ["売れるタイミングの仮説1", ...] // 2〜3項目 (採用拡大・新製品・資金調達などの可能性)
}

${toneInstruction(opts.settings.aiTone)}

## 大事なルール
- 公開されている情報・業界の一般知識から推測する。捏造は禁止。
- 推測には「〜の可能性が高い」「〜と思われる」など、断定しない語尾を使う。
- 自社の商材 (もし指定されていれば) と相手企業の課題を結びつける。`;

  const userMsg = `## 調査対象
企業名: ${opts.companyName}
${opts.url ? `URL: ${opts.url}` : ''}
${opts.publicInfo ? `参考情報:\n${opts.publicInfo}` : ''}

## 自社の商材
${opts.ownProduct || '(未指定)'}

## 営業担当の役割
${opts.persona.name} (${opts.persona.subtitle})
${opts.persona.description || ''}

上記企業を営業対象として研究し、JSON で返してください。`;

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
        max_tokens: 2048,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `企業リサーチ AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* */ }

  return {
    companyName: opts.companyName,
    url: opts.url,
    industry: parsed.industry,
    revenueEstimate: parsed.revenueEstimate,
    employeeCount: parsed.employeeCount,
    overview: parsed.overview,
    predictedChallenges: Array.isArray(parsed.predictedChallenges) ? parsed.predictedChallenges : [],
    pitchAngle: parsed.pitchAngle,
    keyPersonHints: Array.isArray(parsed.keyPersonHints) ? parsed.keyPersonHints : [],
    recommendedSteps: Array.isArray(parsed.recommendedSteps) ? parsed.recommendedSteps : [],
    signals: Array.isArray(parsed.signals) ? parsed.signals : [],
  };
}

// ─── 2. リードスコアリング AI ────────────────────────
export async function scoreLead(opts: {
  settings: AppSettings;
  lead: Pick<SalesLead, 'companyName' | 'contactName' | 'contactRole' | 'notes'>;
  ownProduct?: string;
  research?: CompanyResearch;
}): Promise<{ score: number; scoreReason: string }> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude API キーが未設定です');

  const sys = `あなたは営業のリードスコアリングを専門にする AI です。
「このリードは買ってくれそうか」を 0〜100 で評価し、理由を1文で説明します。

返答は **JSONのみ**:
{ "score": 0-100 の数値, "reason": "なぜこのスコアにしたか 1文" }

${toneInstruction(opts.settings.aiTone)}

## 評価軸
- 自社の商材 (もしあれば) との相性
- 連絡先の役職 (決裁権がありそうか)
- 企業規模・予算余力
- 課題の顕在化度合い (緊急性)`;

  const ctx = opts.research
    ? `\n## 企業リサーチ結果\n${JSON.stringify({ industry: opts.research.industry, challenges: opts.research.predictedChallenges, signals: opts.research.signals }, null, 2)}`
    : '';

  const userMsg = `## リード
企業名: ${opts.lead.companyName}
担当者: ${opts.lead.contactName || '未設定'} (${opts.lead.contactRole || '不明'})
メモ: ${opts.lead.notes || '(なし)'}

## 自社の商材
${opts.ownProduct || '(未指定)'}
${ctx}

スコアと理由を JSON で返してください。`;

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
        max_tokens: 600,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `スコアリング AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* */ }
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 50)),
    scoreReason: String(parsed.reason || '評価できませんでした'),
  };
}

// ─── 3. パーソナライズ営業メール作成 AI ────────────────
export async function generateApproachEmail(opts: {
  settings: AppSettings;
  persona: Persona;
  lead: SalesLead;
  research?: CompanyResearch;
  ownProduct?: string;
  goal?: string;
  tone?: string;             // "親しみやすく" "格式高く" "直球" 等
}): Promise<Omit<ApproachDraft, 'id'>> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude API キーが未設定です');

  const sys = `あなたは「個別最適化された営業メール」を書くプロです。
相手企業のリサーチを踏まえて、相手の心に響くパーソナライズメールを作ります。

返答は **JSONのみ**:
{
  "subject": "件名 (30文字以内、開封されやすい)",
  "body": "本文 (4〜8行。挨拶 → 相手企業への理解 → 提案 → 次のアクション)",
  "tone": "選んだトーン",
  "hitProbability": 開封・返信されそうな確率 0-100
}

${toneInstruction(opts.settings.aiTone)}

## 大事なルール
- いきなり売り込まない。まず「相手企業を理解している」ことを示す。
- 相手企業の課題やシグナルに触れる (リサーチ結果から)。
- 提案は1つだけ。3つ並べない。
- 次のアクションは具体的に (例: "20分のオンライン面談のご相談")。
- 1行目 (挨拶) で相手の名前と肩書を入れる。
- 押し売りやテンプレ感を避ける。`;

  const userMsg = `## 相手企業
${opts.lead.companyName} / ${opts.lead.contactName || '担当者様'} (${opts.lead.contactRole || '役職不明'})

${opts.research ? `## リサーチ結果
業界: ${opts.research.industry}
推定課題: ${(opts.research.predictedChallenges || []).join(' / ')}
売り込み角度: ${opts.research.pitchAngle}
シグナル: ${(opts.research.signals || []).join(' / ')}` : ''}

## 自社の商材
${opts.ownProduct || '(未指定)'}

## 送り主
${opts.persona.name} (${opts.persona.subtitle})

## このメールのゴール
${opts.goal || '商談機会の創出'}

## 希望トーン
${opts.tone || '丁寧で温かい'}

上記を踏まえて、JSON でメール下書きを返してください。`;

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
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `メール作成 AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { /* */ }

  return {
    leadId: opts.lead.id,
    type: 'email',
    subject: parsed.subject || '',
    body: parsed.body || '',
    tone: parsed.tone || opts.tone || '丁寧',
    hitProbability: Math.max(0, Math.min(100, Number(parsed.hitProbability) || 50)),
    status: 'draft',
    generatedAt: new Date().toISOString(),
  };
}

// ─── 4. ホットシグナル予測 AI ──────────────────────────
export async function predictSignals(opts: {
  settings: AppSettings;
  persona: Persona;
  companies: { name: string; url?: string; industry?: string }[];
  ownProduct?: string;
}): Promise<Omit<IntentSignal, 'id' | 'personaId' | 'detectedAt'>[]> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey || opts.companies.length === 0) return [];

  const sys = `あなたは営業のための「ホットシグナル」検出 AI です。
登録企業について、最近起きていそうな「動き」を一般的な業界トレンドから推定します。

返答は **JSONのみ**:
{
  "signals": [
    {
      "companyName": "企業名",
      "signalType": "採用拡大 / 新製品 / 資金調達 / 業界規制 / 経営交代 / リストラ など",
      "severity": "high" | "medium" | "low",
      "description": "何が起きていそうか 1〜2文",
      "suggestedAction": "今、何をすべきか 1文"
    }
  ]
}

${toneInstruction(opts.settings.aiTone)}

## 大事なルール
- 「〜の可能性があります」と推測である事を明示。実データのフリをしない。
- 1企業につき 1〜2 シグナル、合計 5〜10 件以内。
- 自社商材との相性が高いシグナルを優先。`;

  const userMsg = `## 登録企業 (${opts.companies.length} 社)
${opts.companies.slice(0, 20).map(c => `- ${c.name}${c.industry ? ` (${c.industry})` : ''}`).join('\n')}

## 自社の商材
${opts.ownProduct || '(未指定)'}

各企業の業界傾向から、最近起きていそうな動きを JSON で返してください。`;

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
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `シグナル予測 AI エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch { return []; }

  const signals: Omit<IntentSignal, 'id' | 'personaId' | 'detectedAt'>[] =
    (Array.isArray(parsed.signals) ? parsed.signals : []).map((s: any) => ({
      companyName: String(s.companyName || ''),
      signalType: String(s.signalType || ''),
      severity: ['high', 'medium', 'low'].includes(s.severity) ? s.severity : 'medium',
      description: String(s.description || ''),
      suggestedAction: s.suggestedAction ? String(s.suggestedAction) : undefined,
      read: false,
    }));
  return signals.filter(s => s.companyName && s.description);
}
