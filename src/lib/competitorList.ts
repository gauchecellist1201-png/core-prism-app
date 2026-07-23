// ============================================================
// 同業他社一覧 — AI に「公開情報ベースの代表的な日本市場の同業 5-8 社」を出させる
// データの捏造を避けるため、売上などの数値は **要求しない**。会社名 / HP / 一言メモ のみ。
// ============================================================
import { enqueueClaudeCall } from './apiQueue';
import type { AppSettings } from '../types/identity';
import { getIndustryInfo } from './benchmarkAnalyst';
import { aiFetch } from './aiFetch';

export interface CompetitorBrand {
  /** 表示名 (公開情報の社名・サービス名) */
  name: string;
  /** 公式 HP の URL (https://...) */
  hpUrl: string;
  /** favicon API などの絶対 URL — 取れなければ name の頭文字で fallback 表示 */
  iconUrl?: string;
  /** 50 字以内の一言。何が特徴か。数値や売上は書かない。 */
  oneLineNote: string;
  /** 規模感の主観 (S=個人〜小, M=中堅, L=大手) — 任意 */
  sizeRough?: 'S' | 'M' | 'L';
  /** 設立年 (西暦) — 公開情報で確実なときのみ。不明は省略 */
  foundYear?: number;
  /** 自分が手動で追加したマーカー */
  isUserAdded?: boolean;
}

export interface CompetitorListResult {
  industryId: string;
  industryLabel: string;
  competitors: CompetitorBrand[];
  generatedAt: string;
  /** 「実データなしの参考情報」表記 */
  disclaimer: string;
}

const CACHE_PREFIX = 'core_competitor_list_v1_';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 日

interface CacheEntry { fetchedAt: number; data: CompetitorListResult }

export function loadCompetitorList(industryId: string): CompetitorListResult | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + industryId);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
    return entry.data;
  } catch { return null; }
}

function saveCompetitorList(industryId: string, data: CompetitorListResult) {
  try {
    const entry: CacheEntry = { fetchedAt: Date.now(), data };
    localStorage.setItem(CACHE_PREFIX + industryId, JSON.stringify(entry));
  } catch { /* quota */ }
}

export function faviconUrlFor(hpUrl: string): string | undefined {
  try {
    const u = new URL(hpUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`;
  } catch { return undefined; }
}

const SYSTEM_PROMPT = `あなたは日本市場の業界リサーチャーです。
ユーザーの業種について、**実在する代表的な日本の同業 5〜8 社** を JSON で返してください。

ルール (絶対):
- 公開情報 (公式 HP、企業名鑑、上場情報) で確認可能な企業のみ
- 売上・利益・従業員数などの **数値は一切書かない** (推測禁止)
- HP URL は https:// で始まる実在ドメイン。怪しければ含めない
- 創業年は不明なら省略 (推測しない)
- 1 社につき一言メモは 50 字以内、「何の特徴か」だけ
- 個人事業主 / 小規模が多い業種 (個人レッスン業など) では、代表的な「プラットフォーム」「協会」「フランチャイズ」を混ぜて良い

返答は JSON 配列のみ:
[
  {
    "name": "正式社名",
    "hpUrl": "https://example.jp",
    "oneLineNote": "全国チェーン。低価格メニュー中心",
    "sizeRough": "L",
    "foundYear": 1968
  }
]`;

export interface GenerateOptions {
  knowledgeTitles?: string[];
  knowledgeSummary?: string;
  personaName?: string;
  forceRefresh?: boolean;
}

/** 同業他社一覧を AI で生成。30 日キャッシュ。 */
export async function generateCompetitorList(
  industryId: string,
  settings: AppSettings,
  opts: GenerateOptions = {},
): Promise<CompetitorListResult> {
  if (!opts.forceRefresh) {
    const cached = loadCompetitorList(industryId);
    if (cached) return cached;
  }

  const info = getIndustryInfo(industryId);
  const industryLabel = info?.label ?? industryId;

  const hints: string[] = [];
  if (opts.personaName) hints.push(`事業者名: ${opts.personaName}`);
  if (opts.knowledgeTitles && opts.knowledgeTitles.length > 0) {
    hints.push(`関連ナレッジ: ${opts.knowledgeTitles.slice(0, 8).join(' / ')}`);
  }
  if (opts.knowledgeSummary) hints.push(`事業概要: ${opts.knowledgeSummary.slice(0, 400)}`);
  const hintBlock = hints.length > 0 ? `\n\n## 追加ヒント\n${hints.join('\n')}` : '';

  const prompt = `## 業界: ${industryLabel} (id: ${industryId})${hintBlock}\n\nこの業界の代表的な日本の同業を 5〜8 社、JSON 配列で返してください。`;

  let competitors: CompetitorBrand[] = [];
  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ai-weight': 'light' },
        body: JSON.stringify({
          model: settings.preferredModel || 'claude-haiku-4-5',
          max_tokens: 1600,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `API error: ${res.status}`);
      }
      return res.json();
    });
    const text = (data as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
    const m = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(m ? m[0] : text) as Array<Partial<CompetitorBrand>>;
    competitors = (Array.isArray(parsed) ? parsed : [])
      .filter(c => c && c.name && c.hpUrl && /^https?:\/\//.test(String(c.hpUrl)))
      .slice(0, 8)
      .map(c => ({
        name: String(c.name).slice(0, 60),
        hpUrl: String(c.hpUrl),
        iconUrl: faviconUrlFor(String(c.hpUrl)),
        oneLineNote: String(c.oneLineNote || '').slice(0, 60),
        sizeRough: c.sizeRough === 'S' || c.sizeRough === 'M' || c.sizeRough === 'L' ? c.sizeRough : undefined,
        foundYear: typeof c.foundYear === 'number' && c.foundYear > 1800 && c.foundYear <= new Date().getFullYear()
          ? c.foundYear : undefined,
      }));
  } catch {
    competitors = [];
  }

  const result: CompetitorListResult = {
    industryId,
    industryLabel,
    competitors,
    generatedAt: new Date().toISOString(),
    disclaimer: 'AI が公開情報をもとに参考として挙げたものです。売上などの数値は含めていません。',
  };
  if (competitors.length > 0) saveCompetitorList(industryId, result);
  return result;
}

// ── ユーザーが手動で追加した同業 ───────────────────────
const USER_ADDED_PREFIX = 'core_competitor_user_v1_';

export function loadUserAddedCompetitors(industryId: string): CompetitorBrand[] {
  try {
    const raw = localStorage.getItem(USER_ADDED_PREFIX + industryId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompetitorBrand[];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveUserAddedCompetitors(industryId: string, list: CompetitorBrand[]) {
  try { localStorage.setItem(USER_ADDED_PREFIX + industryId, JSON.stringify(list)); } catch { /* quota */ }
}

export function addUserCompetitor(industryId: string, c: Omit<CompetitorBrand, 'isUserAdded' | 'iconUrl'>): CompetitorBrand {
  const item: CompetitorBrand = {
    ...c,
    iconUrl: faviconUrlFor(c.hpUrl),
    isUserAdded: true,
  };
  const list = loadUserAddedCompetitors(industryId);
  list.unshift(item);
  saveUserAddedCompetitors(industryId, list);
  return item;
}

export function removeUserCompetitor(industryId: string, name: string) {
  const list = loadUserAddedCompetitors(industryId).filter(c => c.name !== name);
  saveUserAddedCompetitors(industryId, list);
}
