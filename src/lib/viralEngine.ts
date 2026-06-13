// ============================================================
// バイラル・コンテンツエンジン — テーマ → 市場リサーチ → 伸びパターン分析
//   → 同系統の投稿を生成 → 下書きキュー
//   X / Threads 向け。投稿は creds(VITE_X_CLIENT_ID 等)が入れば有効化。
// ============================================================
import { callAiWithFallback } from './aiFallbackChain';

export type ViralPlatform = 'x' | 'threads';

export interface GeneratedPost {
  id: string;
  platform: ViralPlatform;
  hook: string;        // 1行目（最重要）
  body: string;        // 本文
  hashtags: string[];
  bestTime: string;    // おすすめ投稿時間
  rationale: string;   // なぜ伸びる想定か
  createdAt: number;
  posted?: boolean;
}

export interface TrendAnalysis {
  theme: string;
  patterns: string[];   // 伸びている型（フック/構成/長さ等）
  angles: string[];     // 攻めるべき切り口
  avoid: string[];      // 避けるべきこと
}

const QKEY = 'core_viral_queue_v1';
function uid() { return 'v_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }

function jsonFromText(text: string): any {
  // ```json ... ``` やテキスト混じりでも JSON 部分を抜く
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI 応答を解析できませんでした');
  return JSON.parse(raw.slice(start, end + 1));
}

async function ai(system: string, user: string, maxTokens = 1200): Promise<string> {
  const data = await callAiWithFallback({
    model: 'claude-haiku-4-5', max_tokens: maxTokens, system,
    messages: [{ role: 'user', content: user }],
  });
  return (data.content?.[0]?.text ?? '').trim();
}

/** テーマで市場リサーチ → 伸びパターンを分析 */
export async function researchTrends(theme: string): Promise<TrendAnalysis> {
  const system = 'あなたは日本のSNS(X/Threads)バイラル分析の専門家。与えられたテーマで「今 伸びている投稿の型」を、実在の傾向に基づき具体的に分析する。マーケ用語は避け、誰でも分かる言葉で。必ず指定のJSONだけを返す。';
  const user = `テーマ「${theme}」について、X/Threadsで伸びている投稿の傾向を分析。
次のJSONのみ返す:
{"patterns":["伸びている型を4つ(フックの作り方/構成/長さ/感情)"],"angles":["このテーマで攻めるべき切り口を4つ"],"avoid":["やると伸びない/逆効果なことを3つ"]}`;
  const t = await ai(system, user, 900);
  const j = jsonFromText(t);
  return { theme, patterns: j.patterns || [], angles: j.angles || [], avoid: j.avoid || [] };
}

/** 分析を踏まえて similar 投稿を生成 */
export async function generatePosts(theme: string, analysis: TrendAnalysis, platform: ViralPlatform, count = 3): Promise<GeneratedPost[]> {
  const limit = platform === 'x' ? 140 : 500;
  const system = `あなたは日本のSNSコピーライター。${platform === 'x' ? 'X(旧Twitter)' : 'Threads'}で実際に伸びる投稿を書く。1行目のフックで止める。${limit}字以内。絵文字は控えめ。煽り・誇大・嘘は禁止。必ず指定のJSONだけを返す。`;
  const user = `テーマ「${theme}」。
伸びている型: ${analysis.patterns.join(' / ')}
攻める切り口: ${analysis.angles.join(' / ')}
避ける: ${analysis.avoid.join(' / ')}

上を踏まえ、伸びそうな投稿を ${count} 本作る。次のJSONのみ:
{"posts":[{"hook":"1行目","body":"本文(フック含む全文・${limit}字以内)","hashtags":["#タグ"],"bestTime":"おすすめ投稿時間帯","rationale":"なぜ伸びる想定か1行"}]}`;
  const t = await ai(system, user, 1400);
  const j = jsonFromText(t);
  const now = Date.now();
  return (j.posts || []).slice(0, count).map((p: any) => ({
    id: uid(), platform,
    hook: p.hook || '', body: (p.body || '').slice(0, limit),
    hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
    bestTime: p.bestTime || '', rationale: p.rationale || '', createdAt: now,
  }));
}

/** テーマ一発で 分析→X/Threads両方を生成 */
export async function runViral(theme: string, perPlatform = 3): Promise<{ analysis: TrendAnalysis; posts: GeneratedPost[] }> {
  const analysis = await researchTrends(theme);
  const [x, th] = await Promise.all([
    generatePosts(theme, analysis, 'x', perPlatform),
    generatePosts(theme, analysis, 'threads', perPlatform),
  ]);
  return { analysis, posts: [...x, ...th] };
}

// ─── 下書きキュー ───
export function loadQueue(): GeneratedPost[] {
  try { const r = localStorage.getItem(QKEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveToQueue(posts: GeneratedPost[]) {
  try { localStorage.setItem(QKEY, JSON.stringify([...posts, ...loadQueue()].slice(0, 100))); } catch { /* quota */ }
}
export function removeFromQueue(id: string) {
  try { localStorage.setItem(QKEY, JSON.stringify(loadQueue().filter(p => p.id !== id))); } catch { /* */ }
}
export function markPosted(id: string) {
  try { localStorage.setItem(QKEY, JSON.stringify(loadQueue().map(p => p.id === id ? { ...p, posted: true } : p))); } catch { /* */ }
}
