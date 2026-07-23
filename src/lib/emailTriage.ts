// ============================================================
// メール・トリアージ AI — 受信メール一括分類 + 返信ドラフト
// ============================================================
import type { AppSettings, Persona } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

// Note: API キーは main.tsx の fetch interceptor が localStorage から自動付与する。
// このファイルから明示的に送る必要は無い (旧 x-api-key は不要)。

export interface EmailTriaged {
  id: string;
  from: string;
  subject: string;
  preview: string;       // 本文の先頭 100 文字
  importance: 'high' | 'mid' | 'low' | 'spam';
  urgency: 'immediate' | 'today' | 'this-week' | 'none';
  category: '商談' | '相談' | '通知' | '請求' | '採用' | '社内' | 'スパム' | 'その他';
  summary: string;       // 1-2 行要約
  needsReply: boolean;
  replyDeadline?: string;
  estimatedReplyMin?: number;
  actionRequired?: string;
  draftReply?: string;   // 返信ドラフト (needsReply=true なら)
}

export interface TriageBatch {
  totalEmails: number;
  highCount: number;
  needReplyCount: number;
  spamCount: number;
  emails: EmailTriaged[];
  digest: string;        // 朝のメールサマリ (3-5行)
  generatedAt: string;
}

const SYS = `あなたはメール秘書です。受信メール群を一括でトリアージします。

返答は**JSONのみ**(コードブロック・説明文なし)。スキーマ:
{
  "digest": "受信メール全体のサマリ (3-5行、最重要事項に絞る)",
  "emails": [
    {
      "id": "入力時のID",
      "from": "差出人 (元のまま)",
      "subject": "件名 (元のまま)",
      "preview": "本文の先頭 100文字以内",
      "importance": "high" | "mid" | "low" | "spam",
      "urgency": "immediate" (今すぐ対応) | "today" (今日中) | "this-week" (今週中) | "none",
      "category": "商談" | "相談" | "通知" | "請求" | "採用" | "社内" | "スパム" | "その他",
      "summary": "1-2行要約 (何を求めているか / 何を伝えているか)",
      "needsReply": true | false,
      "replyDeadline": "推奨返信期限 (任意)",
      "estimatedReplyMin": 推定返信時間 (number、分),
      "actionRequired": "必要なアクション (任意)",
      "draftReply": "返信ドラフト (needsReply=true の時のみ。人格コンテキストに合わせた口調)"
    }
  ]
}

トリアージ基準:
- importance "high": 取引・契約・大口顧客・上司・重要意思決定・締切迫る
- importance "mid": 通常業務・社内連絡・問い合わせ
- importance "low": 通知・お知らせ・自動配信
- importance "spam": 明らかな広告・フィッシング・関連性なし
- urgency: 本文の言葉と差出人から判断
- needsReply: 質問・依頼・確認事項がある場合 true、通知・自動配信は false
- draftReply: 人格の役職・専門分野に応じた口調で 3-6 行、礼儀正しく簡潔に

すべて日本語、簡潔に`;

function splitEmails(raw: string): { id: string; raw: string }[] {
  // 区切り: --- や == や ===Email=== や 改行3つ以上、もしくは "From:" / "差出人:" の繰り返し
  const parts: string[] = [];

  // 「From:」「差出人:」で区切る試み
  const fromSplit = raw.split(/(?=^(?:From|差出人|送信者)\s*:)/im);
  if (fromSplit.length > 1) {
    for (const p of fromSplit) {
      if (p.trim()) parts.push(p.trim());
    }
  } else {
    // 区切り線で分割
    const dashSplit = raw.split(/^\s*(?:-{3,}|={3,}|#{3,})\s*$/m);
    if (dashSplit.length > 1) {
      for (const p of dashSplit) {
        if (p.trim()) parts.push(p.trim());
      }
    } else {
      // 3行以上の改行で分割
      const blankSplit = raw.split(/\n{4,}/);
      for (const p of blankSplit) {
        if (p.trim().length > 50) parts.push(p.trim());
      }
    }
  }

  if (parts.length === 0) parts.push(raw);

  return parts.map((p, i) => ({ id: `e${i + 1}`, raw: p }));
}

export async function triageEmails(
  settings: AppSettings,
  persona: Persona,
  rawText: string,
): Promise<TriageBatch> {
  if (!rawText.trim()) throw new Error('メール内容を貼り付けてください');

  const emails = splitEmails(rawText);
  const limited = emails.slice(0, 30); // 最大30通

  const userPrompt = `## 人格コンテキスト (受信者)
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 受信メール群 (${limited.length}通)
${limited.map(e => `=== ${e.id} ===\n${e.raw.slice(0, 3000)}`).join('\n\n')}

上記メールを一括トリアージし、JSON で返してください。
draftReply は ${persona.name} の口調に合わせて作成してください。`;

  // x-claude-api-key / x-gemini-api-key / x-master-key は main.tsx の fetch interceptor が
  // localStorage から自動で付与する。ここでは何も付けない (古い x-api-key は Anthropic 直叩き名残)。
  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 8192,
        system: SYS,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `メールAI エラー: ${res.status}`);
    }
    return res.json();
  });
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { digest: text.slice(0, 400), emails: [] };
  }

  const triaged: EmailTriaged[] = (Array.isArray(parsed.emails) ? parsed.emails : []).map((e: any, i: number) => ({
    id: e.id || `e${i + 1}`,
    from: e.from || '不明',
    subject: e.subject || '(件名なし)',
    preview: e.preview || '',
    importance: e.importance || 'mid',
    urgency: e.urgency || 'none',
    category: e.category || 'その他',
    summary: e.summary || '',
    needsReply: !!e.needsReply,
    replyDeadline: e.replyDeadline,
    estimatedReplyMin: Number(e.estimatedReplyMin) || 0,
    actionRequired: e.actionRequired,
    draftReply: e.draftReply,
  }));

  return {
    totalEmails: triaged.length,
    highCount: triaged.filter(e => e.importance === 'high').length,
    needReplyCount: triaged.filter(e => e.needsReply).length,
    spamCount: triaged.filter(e => e.importance === 'spam').length,
    emails: triaged,
    digest: parsed.digest || '',
    generatedAt: new Date().toISOString(),
  };
}

// 単発返信ドラフト再生成
export async function regenerateDraft(
  settings: AppSettings,
  persona: Persona,
  email: EmailTriaged,
  toneHint?: string,
): Promise<string> {
  const sys = `あなたは ${persona.name} (${persona.subtitle}) として返信を書きます。
${persona.description || ''}

返信は:
- 礼儀正しく簡潔に (3-6行)
- ${toneHint || '自然なビジネス日本語'}
- 主旨を明確に
- 必要なら次のアクション/期日を提示
返答は本文のみ (件名・宛名・署名は不要)`;

  // x-claude-api-key / x-gemini-api-key / x-master-key は main.tsx の fetch interceptor が
  // localStorage から自動で付与する。ここでは何も付けない (古い x-api-key は Anthropic 直叩き名残)。
  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.preferredModel,
        max_tokens: 800,
        system: sys,
        messages: [{
          role: 'user',
          content: `## 受信メール\n差出人: ${email.from}\n件名: ${email.subject}\n本文: ${email.preview}\n要件: ${email.summary}\n\n返信ドラフトを書いてください。`,
        }],
      }),
    });
    if (!res.ok) throw new Error('返信ドラフト生成エラー');
    return res.json();
  });
  return data.content?.[0]?.text ?? '';
}
