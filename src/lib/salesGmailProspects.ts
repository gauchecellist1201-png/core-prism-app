// ============================================================
// 営業エージェント — Gmail から営業先候補を発掘
// NoimosAI 型: 受信メールの差出人(実在の会社/担当者)を営業先候補として抽出し、
// 自社商材との相性を AI が判定 → 各社に最適な営業メール → Gmail 下書きへ。
// 重要: 候補は「実際に受信した差出人」だけ。架空の会社を捏造しない(honest)。
// ============================================================
import type { AppSettings } from '../types/identity';
import type { GmailMessage } from './gmail';
import { aiFetch } from './aiFetch';

export interface GmailProspect {
  email: string;
  name: string;
  domain: string;
  /** ドメイン/差出人名から推定した会社名(確定ではない) */
  companyGuess: string;
  lastSubject: string;
  snippet: string;
  msgId: string;
  /** フリーメール(個人)由来か */
  isPersonal: boolean;
}

export interface QualifiedProspect extends GmailProspect {
  /** 自社商材との相性 0-100 */
  fit: number;
  /** なぜ営業先になりうるか(根拠) */
  fitReason: string;
  /** 刺さりそうな切り口 */
  angle: string;
  /** AI のおすすめか */
  recommend: boolean;
}

// 個人用フリーメール(会社ドメインではない)
const FREE_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.co.jp', 'yahoo.com', 'icloud.com', 'me.com', 'mac.com',
  'outlook.com', 'outlook.jp', 'hotmail.com', 'hotmail.co.jp', 'live.jp', 'live.com', 'msn.com',
  'docomo.ne.jp', 'ezweb.ne.jp', 'au.com', 'softbank.ne.jp', 'i.softbank.jp', 'ybb.ne.jp',
  'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'nifty.com', 'so-net.ne.jp', 'ocn.ne.jp',
]);

// 自動配信・通知・サポート等(人ではない/営業先にならない)
const NOISE = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notification|newsletter|^news@|^info@|^support@|^billing@|^account@|^accounts@|^automated|^bounce|^mail@|^system@|^admin@|^webmaster@|^hello@|^team@|^marketing@|@.*\.(amazonses|sendgrid|mailchimp|sg\.|sparkpostmail))/i;

/** "Name <email>" / "email" から名前とアドレスを取り出す */
function parseFrom(from: string): { name: string; email: string } {
  const s = (from || '').trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  const bare = s.match(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/);
  return { name: '', email: (bare ? bare[0] : '').toLowerCase() };
}

/** ドメインから会社名を推定 (例: shibuya-clinic.co.jp → Shibuya Clinic) */
function companyFromDomain(domain: string): string {
  const core = domain
    .replace(/\.(co|or|ne|go|ac|ad|ed|gr|lg)\.jp$/i, '')
    .replace(/\.(jp|com|net|org|io|co|inc|biz|info|me|app|dev|tech|store)$/i, '')
    .split('.').slice(-1)[0] || domain;
  return core
    .split(/[-_]/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * 受信メールの差出人から営業先候補を抽出。
 * - 自分のドメイン宛/発は除外
 * - 自動配信(no-reply 等)は除外
 * - 会社ドメイン単位で重複排除(同じ会社は最新1件)
 */
export function extractProspectsFromInbox(messages: GmailMessage[], selfEmail?: string): GmailProspect[] {
  const selfDomain = (selfEmail || '').split('@')[1]?.toLowerCase() || '';
  const seen = new Set<string>();
  const out: GmailProspect[] = [];
  for (const m of messages) {
    const { name, email } = parseFrom(m.from);
    if (!email || !email.includes('@')) continue;
    if (NOISE.test(email)) continue;
    const domain = email.split('@')[1] || '';
    if (!domain) continue;
    if (selfDomain && domain === selfDomain) continue;
    const isPersonal = FREE_DOMAINS.has(domain);
    // 重複排除キー: 会社は domain 単位、個人は email 単位
    const key = isPersonal ? email : domain;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      email,
      name: name || email.split('@')[0],
      domain,
      companyGuess: isPersonal ? (name || email.split('@')[0]) : companyFromDomain(domain),
      lastSubject: m.subject || '',
      snippet: (m.snippet || '').slice(0, 160),
      msgId: m.id,
      isPersonal,
    });
  }
  return out;
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const m = body.match(/[[{][\s\S]*[\]}]/);
  if (!m) throw new Error('JSON が見つかりません');
  return JSON.parse(m[0]);
}

/**
 * 自社商材との相性を AI が判定。
 * 重要: 受信メールから分かる事実(会社名・件名・抜粋)だけで判断し、
 * 売上規模・従業員数などの未知の数値は捏造しない。
 */
export async function qualifyProspects(opts: {
  settings: AppSettings;
  ownProduct: string;
  prospects: GmailProspect[];
}): Promise<QualifiedProspect[]> {
  const { settings, ownProduct, prospects } = opts;
  if (!ownProduct.trim()) {
    throw new Error('先に「自社の商材」を入力してください。何を売るかが分からないと、相性は判定できません。');
  }
  if (!prospects.length) return [];

  const list = prospects.slice(0, 25).map((p, i) =>
    `${i}. 会社/差出人: ${p.companyGuess} / ドメイン: ${p.domain} / 直近件名: ${p.lastSubject || '(なし)'} / 抜粋: ${p.snippet || '(なし)'}`
  ).join('\n');

  const sys = `あなたは B2B 営業のプロです。自社商材を踏まえ、受信メールの差出人それぞれが「自社の営業先になりうるか」を判定します。

返答は JSON のみ:
{ "results": [
  { "i": 0, "fit": 0-100, "fitReason": "なぜ営業先になりうるか(1〜2行・具体的に)", "angle": "刺さりそうな切り口(1行)", "recommend": true/false }
] }

## ルール
- fit は自社商材と相手の相性。商材を本当に必要としそうな相手ほど高く
- 判断材料は「会社名・ドメイン・直近件名・抜粋」だけ。売上・従業員数など未知の数値は推測で書かない(嘘禁止)
- 既存の取引/問い合わせらしき相手は営業先として有望(fit高め)。無関係・的外れは低く、recommend=false
- fitReason は具体的に。「IT企業だから」ではなく「○○の課題を持ちやすく、自社の△△が効く」のように
- すべての i について 1 件ずつ返す`;

  const userMsg = `## 自社商材\n${ownProduct.slice(0, 800)}\n\n## 受信メールの差出人(営業先候補)\n${list}\n\n各差出人について相性を判定し、JSON で返してください。`;

  const res = await aiFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.preferredModel,
      max_tokens: 3000,
      system: sys,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.userMessage || err.error?.message || `営業先判定AIエラー: ${res.status}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  if (!text) throw new Error('AI から空の応答が返りました。もう一度お試しください。');
  const parsed = extractJson(text);
  const rows: any[] = Array.isArray(parsed?.results) ? parsed.results : Array.isArray(parsed) ? parsed : [];
  const byIdx = new Map<number, any>();
  rows.forEach(r => { if (typeof r?.i === 'number') byIdx.set(r.i, r); });

  const qualified: QualifiedProspect[] = prospects.slice(0, 25).map((p, i) => {
    const r = byIdx.get(i) || {};
    const fit = Math.max(0, Math.min(100, Number(r.fit) || 0));
    return {
      ...p,
      fit,
      fitReason: String(r.fitReason || '').slice(0, 200) || '判定材料が少なく、相性は不明です。',
      angle: String(r.angle || '').slice(0, 160),
      recommend: r.recommend === true,
    };
  });
  // 相性の高い順
  return qualified.sort((a, b) => b.fit - a.fit);
}
