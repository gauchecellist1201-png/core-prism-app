// ============================================================
// CORE Prism — 統合ナレッジ脳 (knowledge-brain)
//
// 取り込んだ全資料 (デスクトップのフォルダ / Google ドライブ丸ごと等) を
// 横断して「全部を踏まえて考える」ためのエンジン。
//
// ★2026-08-02 の作り直し（オーナー要望「全部読み込んで、めちゃくちゃいい判断を」）
//   旧実装には、資料をいくら入れても賢くならない構造上の天井が3つあった。
//     1. 新しい順に 24,000 文字ぶんで打ち切り
//        → 500件入れても AI が見るのは最新の約20件だけ。残りは**存在すら知らない**。
//     2. 1件あたり本文の先頭 1,100 文字だけ
//        → 100ページの事業計画でも、AI が読むのは表紙と目次。
//     3. 質問と無関係でも新しい順
//        → 「補助金の条件は?」と聞いても、昨日入れた雑メモが優先される。
//
//   作り直した設計は二段構え。
//     ・**索引**（全件）… 何が手元にあるかを AI に必ず全部見せる。抜けを自覚できる。
//     ・**精読**（関連順）… 質問に関係する資料だけ、本文を深く読む。
//   1件あたりの精読は、先頭だけでなく「見出し・数字・締切・末尾」を拾う要約に変えた。
//
// - ingestible: 取り込めるファイル拡張子の判定
// - buildBrainContext: 索引(全件) + 精読(関連順) の 2 段コンテキスト
// - synthesizeKnowledge: 質問に対し全資料を横断統合して回答
// - generateBrainInsights: 質問なしで全資料から重要パターン/打ち手を自動抽出
// - buildConciergeBrief: 「いまの全体像 → 次にやること」の秘書ブリーフ
//
// 最上位プラン (Studio / v2-btoB-pro / v2-enterprise) 限定機能。
// ============================================================
import type { KnowledgeItem, AppSettings } from '../types/identity';
import { callAiWithFallback } from '../lib/aiFallbackChain';

// ─── 取り込み対象ファイル ───────────────────────────────────
// fileParser が扱える形式すべて。ここを絞りすぎると「入れたのに入らない」が起きる。
const INGEST_EXT = new Set([
  // 文書
  'md', 'markdown', 'txt', 'text', 'csv', 'tsv', 'json', 'log', 'rtf',
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'html', 'htm',
  // 設定・データ（事業の実態がよく出る）
  'xml', 'yaml', 'yml', 'env', 'ini', 'conf', 'toml',
  // ソース（自社プロダクトの中身も判断材料になる）
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'css', 'scss', 'sql', 'sh',
]);
const SKIP_DIR = /(^|\/)(node_modules|\.git|dist|build|\.next|\.cache|coverage|\.vercel|Library|\.Trash)(\/|$)/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB/ファイル上限（大きな決算PDFも通す）

/** なぜ取り込めなかったのかを、あとで数えて表示するための理由。黙って捨てない。 */
export type IngestSkipReason = 'フォルダ除外' | 'サイズ超過' | '対象外の形式' | '隠しファイル';

export function ingestSkipReason(file: File): IngestSkipReason | null {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  if (SKIP_DIR.test(path)) return 'フォルダ除外';
  if (file.name.startsWith('~$') || file.name.startsWith('.')) return '隠しファイル';
  if (file.size > MAX_FILE_BYTES) return 'サイズ超過';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!INGEST_EXT.has(ext)) return '対象外の形式';
  return null;
}

export function isIngestibleFile(file: File): boolean {
  return ingestSkipReason(file) === null;
}

/** FileList/配列から取り込めるものだけ抽出 */
export function filterIngestible(files: FileList | File[]): File[] {
  return Array.from(files).filter(isIngestibleFile);
}

/** 取り込めなかったファイルを理由ごとに数える（画面に正直に出すため）。 */
export function countSkips(files: FileList | File[]): { total: number; byReason: Record<string, number> } {
  const byReason: Record<string, number> = {};
  let total = 0;
  for (const f of Array.from(files)) {
    const r = ingestSkipReason(f);
    if (!r) continue;
    total++;
    byReason[r] = (byReason[r] ?? 0) + 1;
  }
  return { total, byReason };
}

// ─── 1件を「要点だけ」に圧縮する ─────────────────────────
// 先頭を切り取るだけだと、長い資料は表紙と目次しか渡らない。
// 見出し・金額・日付・締切・結論らしき行を拾い、頭と尻も残す。
const SIGNAL_RE = /(円|¥|億|万円|%|％|件|人|月|日|年度|締切|期限|納期|目標|課題|리스크|リスク|決定|合意|契約|単価|原価|粗利|売上|利益|損失|赤字|黒字|未定|保留|要確認|TODO|次回)/;
const HEADING_RE = /^\s*(#{1,6}\s|\d+[.)、]\s|第[０-９0-9一二三四五六七八九十]+[章節条]|[■□◆◇●○▼【\[])/;

function normalize(s: string): string {
  return s.replace(/\r/g, '').replace(/[ \t　]+/g, ' ');
}

/** 資料1件を maxChars 以内の「要点」に落とす。 */
export function digestItem(item: KnowledgeItem, maxChars: number): string {
  const summary = item.analysis?.summary?.trim();
  const body = normalize(item.content || '').trim();
  if (!body) return summary || '';

  // 全文が入るなら、そのまま渡すのがいちばん正確
  if (body.length <= maxChars) return (summary ? `【要約】${summary}\n` : '') + body;

  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  const headSize = Math.floor(maxChars * 0.34);
  const tailSize = Math.floor(maxChars * 0.16);

  const head = body.slice(0, headSize);
  const tail = body.slice(-tailSize);

  // 真ん中からは「見出し」と「数字が入った行」だけを拾う
  const midBudget = maxChars - headSize - tailSize - 80;
  const picked: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used >= midBudget) break;
    if (line.length < 4) continue;
    if (!HEADING_RE.test(line) && !SIGNAL_RE.test(line)) continue;
    const l = line.length > 220 ? line.slice(0, 220) + '…' : line;
    picked.push(l);
    used += l.length + 1;
  }

  const parts: string[] = [];
  if (summary) parts.push(`【要約】${summary}`);
  parts.push(`【冒頭】\n${head}`);
  if (picked.length) parts.push(`【本文から拾った要点（見出し・数字・期限）】\n${picked.join('\n')}`);
  parts.push(`【末尾】\n${tail}`);
  parts.push(`（この資料は全${body.length.toLocaleString()}文字。上は要点抜粋です）`);
  return parts.join('\n');
}

// ─── 質問との関連度でならべかえる ───────────────────────
function tokenize(q: string): string[] {
  const words = q
    .toLowerCase()
    .split(/[\s　、。,.:;!?！？「」『』（）()\[\]/]+/)
    .filter(w => w.length >= 2);
  // 日本語は分かち書きされないので、2〜4文字の部分列も鍵にする
  const grams: string[] = [];
  const jp = q.replace(/[\s　]/g, '');
  for (let n = 2; n <= 4; n++) {
    for (let i = 0; i + n <= jp.length && grams.length < 120; i++) {
      const g = jp.slice(i, i + n);
      if (/[぀-ヿ一-鿿]/.test(g)) grams.push(g.toLowerCase());
    }
  }
  return Array.from(new Set([...words, ...grams]));
}

function scoreItem(item: KnowledgeItem, keys: string[]): number {
  if (keys.length === 0) return 0;
  const title = item.title.toLowerCase();
  const tags = item.tags.join(' ').toLowerCase();
  // 本文は先頭 20,000 文字だけを対象にする（全文走査は件数が増えると重い）
  const body = (item.content || '').slice(0, 20000).toLowerCase();
  let score = 0;
  for (const k of keys) {
    if (title.includes(k)) score += 12;
    if (tags.includes(k)) score += 5;
    const hits = body.split(k).length - 1;
    if (hits > 0) score += Math.min(hits, 8);
  }
  return score;
}

function recencyBonus(item: KnowledgeItem): number {
  const t = Date.parse(item.createdAt);
  if (!Number.isFinite(t)) return 0;
  const days = (Date.now() - t) / 86400000;
  if (days < 7) return 6;
  if (days < 30) return 3;
  if (days < 90) return 1;
  return 0;
}

// ─── 索引（全件） + 精読（関連順） の 2 段コンテキスト ─────
export interface BrainContext {
  context: string;
  /** 索引に載せた件数（＝AI が「存在を知っている」件数） */
  indexedCount: number;
  /** 本文まで読んだ件数 */
  deepCount: number;
  /** 総件数 */
  totalCount: number;
  /** 索引にすら載せきれず省いた件数（0 なら全件を把握できている） */
  omittedCount: number;
  /** 精読した資料のタイトル（画面に「どれを読んだか」を出すため） */
  deepTitles: string[];
}

export function buildBrainContext(
  items: KnowledgeItem[],
  opts: {
    question?: string;
    /** 精読に使う総文字数。既定は深め。 */
    deepBudget?: number;
    /** 索引に使う総文字数。 */
    indexBudget?: number;
    /** 精読する最大件数 */
    maxDeep?: number;
  } = {},
): BrainContext {
  const deepBudget = opts.deepBudget ?? 42000;
  const indexBudget = opts.indexBudget ?? 16000;
  const maxDeep = opts.maxDeep ?? 24;

  const total = items.length;
  if (total === 0) {
    return { context: '', indexedCount: 0, deepCount: 0, totalCount: 0, omittedCount: 0, deepTitles: [] };
  }

  const keys = opts.question ? tokenize(opts.question) : [];
  const ranked = [...items]
    .map(it => ({ it, s: scoreItem(it, keys) + recencyBonus(it) }))
    .sort((a, b) => (b.s - a.s) || b.it.createdAt.localeCompare(a.it.createdAt));

  // ── 1. 索引 — 何が手元にあるかを全部見せる ──────────────
  const indexLines: string[] = [];
  let indexUsed = 0;
  let omitted = 0;
  const byDate = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const it of byDate) {
    const date = (it.createdAt || '').slice(0, 10);
    const tag = it.tags.length ? `[${it.tags.slice(0, 3).join('/')}]` : '';
    const size = it.content ? `${Math.round(it.content.length / 100) / 10}千字` : '';
    const kind = it.fileKind ? `${it.fileKind}` : it.sourceType;
    const line = `- ${it.title} ${tag} (${kind}/${size}/${date})`;
    if (indexUsed + line.length > indexBudget) { omitted++; continue; }
    indexLines.push(line);
    indexUsed += line.length + 1;
  }

  // ── 2. 精読 — 関連する資料の中身を深く ─────────────────
  const deep: string[] = [];
  const deepTitles: string[] = [];
  let deepUsed = 0;
  const perItem = Math.max(1800, Math.floor(deepBudget / Math.max(1, Math.min(maxDeep, ranked.length))));
  for (const { it } of ranked) {
    if (deepTitles.length >= maxDeep) break;
    if (deepUsed >= deepBudget) break;
    const room = Math.min(perItem, deepBudget - deepUsed);
    if (room < 600) break;
    const d = digestItem(it, room);
    if (!d.trim()) continue;
    const block = `### ${it.title}${it.tags.length ? ` [${it.tags.slice(0, 3).join('/')}]` : ''}\n${d}`;
    deep.push(block);
    deepTitles.push(it.title);
    deepUsed += block.length;
  }

  const header = [
    `# あなたが把握している資料の全体像`,
    `総数 ${total} 件。うち ${indexLines.length} 件を下の索引に載せ、${deepTitles.length} 件は本文まで読んでいます。`,
    omitted > 0
      ? `⚠️ ${omitted} 件は索引にも載せきれていません。答えるときは「まだ見ていない資料が ${omitted} 件ある」ことを前提にしてください。`
      : `索引は全件そろっています。手元にある資料の抜けはありません。`,
  ].join('\n');

  const context = [
    header,
    `\n## 資料の索引（タイトル / 分類 / 種別 / 分量 / 取込日）`,
    indexLines.join('\n'),
    `\n## 本文まで読んだ資料（${deepTitles.length} 件）`,
    deep.join('\n\n'),
  ].join('\n');

  return {
    context,
    indexedCount: indexLines.length,
    deepCount: deepTitles.length,
    totalCount: total,
    omittedCount: omitted,
    deepTitles,
  };
}

// ─── AI への指示 ────────────────────────────────────────
const BRAIN_SYSTEM = `あなたは CORE Prism の「統合ナレッジ脳」。
ユーザーが取り込んだ資料 (事業計画・収支・議事録・メモ・契約・営業資料・ドライブの中身など) を**全部まとめて横断的に**読み解く専属アナリストです。

渡される情報は2段構えです。
- **索引**: 手元にある資料の一覧（タイトルと分量だけ）。中身は読んでいません。
- **本文まで読んだ資料**: 質問に関係が深いものだけ、中身を深く読んでいます。

絶対ルール:
- 1つの資料だけでなく、**複数の資料をまたいで関連づけて**考える。矛盾・重複・抜け漏れ・相乗効果を見つける。
- 索引にしか無い資料について中身を語らない。必要なら「〇〇は索引にありますが、まだ中身を読んでいません。読みますか」と正直に言う。
- 資料に書かれていないことを断定しない。推測する時は「推測」と明示する。数字は資料の値を使い、勝手に作らない。
- 専門用語は避け、やさしい日本語で。横文字には括弧で和訳を添える。
- 箇条書き・短い見出し・具体的な数字で、結論から先に。
- 出典として、参照した資料は「(○○より)」のように資料タイトルで示す。`;

const CONCIERGE_SYSTEM = `あなたは CORE Prism の専属コンシェルジュ（経営者のそばで全部を把握している秘書）です。
経営者の手元にある資料を全部見た上で、「いま何が起きていて、次に何をすべきか」だけを答えます。

絶対ルール:
- **相手はもう自分の状況を知っている。** 資料の要約を並べない。そこから読み取れる「判断」と「次の一手」を出す。
- 具体的に。「マーケを強化」ではなく「〇〇の見積を今週中に出す（△△より、先方は今月末が期限）」のように、
  **誰が・いつまでに・何をするか**が分かる形にする。
- 数字は資料の値をそのまま使う。無い数字は作らない。「資料に無い」と書く。
- 期限・締切・未決事項・返事待ちを最優先で拾う。**放っておくと事故になるもの**が先。
- 推測には「推測」と明示。索引にしか無い資料の中身は語らない。
- やさしい日本語。専門用語と横文字は避ける（使うときは括弧で和訳）。
- 絵文字は使わない。`;

// ─── 質問に対し全資料を横断統合して回答 ───────────────────
export async function synthesizeKnowledge(
  items: KnowledgeItem[],
  question: string,
  settings: AppSettings,
  opts: { signal?: AbortSignal; onStep?: (model: string) => void } = {},
): Promise<{ answer: string; usedCount: number; truncated: boolean; model: string; ctx: BrainContext }> {
  const empty: BrainContext = { context: '', indexedCount: 0, deepCount: 0, totalCount: 0, omittedCount: 0, deepTitles: [] };
  if (items.length === 0) {
    return {
      answer: 'まだ資料が取り込まれていません。「フォルダを取り込む」または「Google ドライブをまるごと取り込む」から読み込ませてください。',
      usedCount: 0, truncated: false, model: '', ctx: empty,
    };
  }
  const ctx = buildBrainContext(items, { question });
  const userText = `${ctx.context}\n\n---\n\n# 質問\n${question}\n\n上の資料を横断して、統合した答えを返してください。`;

  const data = await callAiWithFallback(
    { model: settings.preferredModel || 'claude-haiku-4-5', max_tokens: 2200, system: BRAIN_SYSTEM, messages: [{ role: 'user', content: userText }] },
    { signal: opts.signal, onStep: (_s, m) => opts.onStep?.(m) },
  );
  const answer = data.content?.[0]?.text?.trim() || '回答を生成できませんでした。もう一度お試しください。';
  return { answer, usedCount: ctx.deepCount, truncated: ctx.omittedCount > 0, model: data.resolvedModel || '', ctx };
}

// ─── 質問なしで全資料から重要パターン/打ち手を自動抽出 ─────
export async function generateBrainInsights(
  items: KnowledgeItem[],
  settings: AppSettings,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  if (items.length === 0) return '';
  const { context } = buildBrainContext(items, {});
  const userText = `${context}\n\n---\n\nこの資料を統合して読み、次の3点を簡潔にまとめてください:\n1. **全体像** — これらの資料が示す状況を3行で。\n2. **横断して見える重要パターン/相乗効果** — 複数資料をまたいで初めて見える発見を3つ。\n3. **次に取るべき具体的な打ち手** — 優先度順に3つ、各1行+理由。`;

  const data = await callAiWithFallback(
    { model: settings.preferredModel || 'claude-haiku-4-5', max_tokens: 1600, system: BRAIN_SYSTEM, messages: [{ role: 'user', content: userText }] },
    { signal: opts.signal },
  );
  return data.content?.[0]?.text?.trim() || '';
}

// ─── コンシェルジュ・ブリーフ ───────────────────────────
// 「自分の現状を全部把握し、全ての資料に目を通し、全てを知った状態で
//   何をすべきかを提案してくれる」— この一枚を出すための関数。
export interface ConciergeBrief {
  text: string;
  readCount: number;
  totalCount: number;
  omittedCount: number;
  deepTitles: string[];
  model: string;
}

export async function buildConciergeBrief(
  items: KnowledgeItem[],
  settings: AppSettings,
  opts: {
    /** 今日の日付（期限判断に使う）。既定は実行時刻。 */
    today?: Date;
    /** 経営者が今いちばん気にしていること（あれば精読の優先に効く） */
    focus?: string;
    /** カレンダー・売上など、資料の外にある事実を足したいとき */
    extraContext?: string;
    signal?: AbortSignal;
    onStep?: (model: string) => void;
  } = {},
): Promise<ConciergeBrief> {
  if (items.length === 0) {
    return {
      text: '', readCount: 0, totalCount: 0, omittedCount: 0, deepTitles: [], model: '',
    };
  }
  const today = opts.today ?? new Date();
  const ymd = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  // 期限・未決・お金にまつわる資料を優先して精読させる
  const focusQuery = [
    opts.focus || '',
    '締切 期限 納期 今月 来月 未定 保留 要確認 決裁 契約 請求 入金 見積 提案 返事待ち 課題 リスク 売上 費用',
  ].join(' ');
  const ctx = buildBrainContext(items, { question: focusQuery, maxDeep: 28 });

  const userText = [
    ctx.context,
    opts.extraContext ? `\n## 資料の外にある事実\n${opts.extraContext}` : '',
    `\n---\n\n今日は ${ymd} です。`,
    opts.focus ? `経営者がいま気にしていること: ${opts.focus}` : '',
    `
上の資料を全部踏まえて、経営者に渡す一枚を書いてください。見出しはこの5つ、この順で。

## いまの状況（3行）
資料から読み取れる現在地。数字があれば数字で。

## 手が止まっているもの
決まっていない・返事待ち・保留のまま動いていないもの。放置している日数が分かるなら添える。

## 期限が近いもの
今日から見て近い順。日付と、間に合わせるために今週やることをセットで。

## 今日やるべき3つ
優先順。各1行で「何をするか」、その下に1行で理由（どの資料から言えるのか）。

## 見落としているかもしれないこと
資料どうしの矛盾、抜けている資料、危ないと感じる点。無ければ「特に無し」。

守ること: 資料の要約を並べない。数字を作らない。索引にしか無い資料の中身を語らない。`,
  ].filter(Boolean).join('\n');

  const data = await callAiWithFallback(
    {
      model: settings.preferredModel || 'claude-haiku-4-5',
      max_tokens: 2600,
      system: CONCIERGE_SYSTEM,
      messages: [{ role: 'user', content: userText }],
    },
    { signal: opts.signal, onStep: (_s, m) => opts.onStep?.(m) },
  );

  return {
    text: data.content?.[0]?.text?.trim() || '',
    readCount: ctx.deepCount,
    totalCount: ctx.totalCount,
    omittedCount: ctx.omittedCount,
    deepTitles: ctx.deepTitles,
    model: data.resolvedModel || '',
  };
}
