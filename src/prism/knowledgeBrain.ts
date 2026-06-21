// ============================================================
// CORE Prism — 統合ナレッジ脳 (knowledge-brain)
//
// 取り込んだ全資料 (デスクトップのフォルダ丸ごと等) を横断して
// 「全部を統合して考える」ためのエンジン。
//
// - ingestible: 取り込めるファイル拡張子の判定
// - buildBrainContext: 全 KnowledgeItem を AI に渡す 1 本のコンテキストに圧縮
// - synthesizeKnowledge: 質問に対し全資料を横断統合して回答
// - generateBrainInsights: 質問なしで全資料から重要パターン/打ち手を自動抽出
//
// 最上位プラン (Studio / v2-btoB-pro / v2-enterprise) 限定機能。
// ============================================================
import type { KnowledgeItem, AppSettings } from '../types/identity';
import { callAiWithFallback } from '../lib/aiFallbackChain';

// ─── 取り込み対象ファイル ───────────────────────────────────
// fileParser が扱える形式 (pdf/docx/xlsx/pptx/csv/txt/md/json 等)。
// 画像やバイナリ・node_modules 系は除外。
const INGEST_EXT = new Set([
  'md', 'markdown', 'txt', 'text', 'csv', 'tsv', 'json', 'log', 'rtf',
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'html', 'htm',
]);
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.cache|coverage|\.vercel)(\/|$)/i;
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB/ファイル上限 (巨大ファイルで固まらない)

export function isIngestibleFile(file: File): boolean {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  if (SKIP_DIR.test(path)) return false;
  if (file.size > MAX_FILE_BYTES) return false;
  if (file.name.startsWith('~$') || file.name.startsWith('.')) return false; // ロック/隠しファイル
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return INGEST_EXT.has(ext);
}

/** FileList/配列から取り込めるものだけ抽出 */
export function filterIngestible(files: FileList | File[]): File[] {
  return Array.from(files).filter(isIngestibleFile);
}

// ─── 全資料を 1 本のコンテキストに圧縮 ──────────────────────
// 件数が多くてもトークンを溢れさせないよう、各資料は
// 「タイトル + タグ + 先頭抜粋」に圧縮。総量で上限を設ける。
export function buildBrainContext(items: KnowledgeItem[], maxChars = 24000): {
  context: string;
  usedCount: number;
  truncated: boolean;
} {
  // 新しい順
  const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const blocks: string[] = [];
  let total = 0;
  let used = 0;
  let truncated = false;

  for (const it of sorted) {
    const tagStr = it.tags.length ? ` [${it.tags.slice(0, 4).join('/')}]` : '';
    // 資料ごとの抜粋: AI 要約があればそれを優先、無ければ本文先頭
    const summary = it.analysis?.summary?.trim();
    const body = (summary || it.content || '').replace(/\s+/g, ' ').trim();
    const excerptLen = Math.min(body.length, 1100);
    const excerpt = body.slice(0, excerptLen) + (body.length > excerptLen ? '…' : '');
    const block = `## ${used + 1}. ${it.title}${tagStr}\n${excerpt}`;
    if (total + block.length > maxChars) { truncated = true; break; }
    blocks.push(block);
    total += block.length;
    used++;
  }
  return { context: blocks.join('\n\n'), usedCount: used, truncated };
}

const BRAIN_SYSTEM = `あなたは CORE Prism の「統合ナレッジ脳」。
ユーザーが取り込んだ複数の資料 (事業計画・収支・議事録・メモ・契約・営業資料など) を**全部まとめて横断的に**読み解く専属アナリストです。

絶対ルール:
- 1つの資料だけでなく、**複数の資料をまたいで関連づけて**考える。矛盾・重複・抜け漏れ・相乗効果を見つける。
- 資料に書かれていないことを断定しない。推測する時は「推測」と明示する。数字は資料の値を使い、勝手に作らない。
- 専門用語は避け、やさしい日本語で。横文字には括弧で和訳を添える。
- 箇条書き・短い見出し・具体的な数字で、結論から先に。
- 出典として、参照した資料は「(○○より)」のように資料タイトルで示す。`;

// ─── 質問に対し全資料を横断統合して回答 ───────────────────
export async function synthesizeKnowledge(
  items: KnowledgeItem[],
  question: string,
  settings: AppSettings,
  opts: { signal?: AbortSignal; onStep?: (model: string) => void } = {},
): Promise<{ answer: string; usedCount: number; truncated: boolean; model: string }> {
  if (items.length === 0) {
    return { answer: 'まだ資料が取り込まれていません。「フォルダを取り込む」から、デスクトップのフォルダを丸ごと読み込ませてください。', usedCount: 0, truncated: false, model: '' };
  }
  const { context, usedCount, truncated } = buildBrainContext(items);
  const userText = `# 取り込み済みの全資料 (${items.length}件中 ${usedCount}件を参照)\n\n${context}\n\n---\n\n# 質問\n${question}\n\n上の全資料を横断して、統合した答えを返してください。`;

  const data = await callAiWithFallback(
    { model: settings.preferredModel || 'claude-haiku-4-5', max_tokens: 1600, system: BRAIN_SYSTEM, messages: [{ role: 'user', content: userText }] },
    { signal: opts.signal, onStep: (_s, m) => opts.onStep?.(m) },
  );
  const answer = data.content?.[0]?.text?.trim() || '回答を生成できませんでした。もう一度お試しください。';
  return { answer, usedCount, truncated, model: data.resolvedModel || '' };
}

// ─── 質問なしで全資料から重要パターン/打ち手を自動抽出 ─────
export async function generateBrainInsights(
  items: KnowledgeItem[],
  settings: AppSettings,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  if (items.length === 0) return '';
  const { context } = buildBrainContext(items);
  const userText = `# 取り込み済みの全資料\n\n${context}\n\n---\n\nこの全資料を統合して読み、次の3点を簡潔にまとめてください:\n1. **全体像** — これらの資料が示す状況を3行で。\n2. **横断して見える重要パターン/相乗効果** — 複数資料をまたいで初めて見える発見を3つ。\n3. **次に取るべき具体的な打ち手** — 優先度順に3つ、各1行+理由。`;

  const data = await callAiWithFallback(
    { model: settings.preferredModel || 'claude-haiku-4-5', max_tokens: 1400, system: BRAIN_SYSTEM, messages: [{ role: 'user', content: userText }] },
    { signal: opts.signal },
  );
  return data.content?.[0]?.text?.trim() || '';
}
