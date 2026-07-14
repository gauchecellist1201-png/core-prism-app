import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { KnowledgeItem, KnowledgeChunk, PersonaId, AppSettings, Persona } from '../types/identity';
// fileParser は pdfjs/mammoth/xlsx/jszip を抱える 1MB 級の重さ。
// ファイル取り込みが発火した瞬間にだけ読むよう動的 import に寄せて、main から外す。
async function parseFile(file: File) {
  const mod = await import('../lib/fileParser');
  return mod.parseFile(file);
}
import { analyzeKnowledge, looksLikeFinancialData, extractFinancialData } from '../lib/analyzeKnowledge';
import { useCloudSync } from './useCloudSync';
import { useEmailBlobSync } from './useEmailBlobSync';
import { safeSetJSON } from '../lib/storage';
import { idbGet, idbSet } from '../lib/idbStore';
import { useBillingUser, getEffectivePlan, getEffectivePlanPriceJpy, checkFeature, isMasterAuth } from '../lib/billing';

const STORAGE_KEY = 'core_knowledge';

// 大量データの取込（統合ナレッジ脳）は最上位＝¥29,800 以上のプラン限定。
// それ未満は少量（プレビュー用途）に制限し、明確にアップグレードへ誘導する。
const FREE_KNOWLEDGE_CAP = 30;
const CHUNK_SIZE = 400; // characters per chunk

// ── テキストをチャンクに分割 ─────────────────────────────
function chunkText(text: string): KnowledgeChunk[] {
  const sentences = text.split(/(?<=[。！？\n])\s*/);
  const chunks: KnowledgeChunk[] = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_SIZE && current.length > 0) {
      chunks.push({ id: uuidv4(), content: current.trim() });
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    chunks.push({ id: uuidv4(), content: current.trim() });
  }
  return chunks;
}

// ── キーワードベースRAG検索 ───────────────────────────────
export function searchKnowledge(query: string, items: KnowledgeItem[], topK = 4): KnowledgeChunk[] {
  const queryWords = query
    .toLowerCase()
    .split(/[\s\u3000\u3001\u3002]+/)
    .filter(w => w.length > 1);

  const scored: (KnowledgeChunk & { score: number })[] = [];

  for (const item of items) {
    for (const chunk of item.chunks) {
      const content = chunk.content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        // 完全一致: 2点、部分一致: 1点
        const exactCount = (content.match(new RegExp(word, 'g')) ?? []).length;
        score += exactCount * 2;
      }
      // タイトルマッチはボーナス
      if (item.title.toLowerCase().includes(queryWords.join(''))) score += 5;
      if (score > 0) scored.push({ ...chunk, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── ファイル読み込み ──────────────────────────────────────
// (legacy export — 互換のため残す。新しいコードは parseFile を使う)
export async function readFileAsText(file: File): Promise<string> {
  const result = await parseFile(file);
  return result.text;
}

// ── AIによる自動タグ生成（ローカル推定）────────────────────
function inferTags(text: string): string[] {
  const patterns: [RegExp, string][] = [
    [/医療|歯科|患者|診断|治療|薬|手術/i, '医療'],
    [/不動産|物件|賃料|テナント|投資|収益|利回り/i, '不動産'],
    [/音楽|楽譜|演奏|チェロ|バイオリン|ピアノ|楽器/i, '音楽'],
    [/売上|収支|財務|キャッシュフロー|利益|コスト/i, '財務'],
    [/会議|ミーティング|議事録|アジェンダ/i, '会議'],
    [/contract|契約|法律|条項|合意/i, '法務'],
    [/AI|機械学習|データ|プログラム|コード/i, 'テクノロジー'],
    [/スケジュール|予定|カレンダー|日程/i, '予定'],
  ];
  return patterns
    .filter(([re]) => re.test(text))
    .map(([, tag]) => tag)
    .slice(0, 4);
}

function friendlyError(raw: string): string {
  if (/concurrent connections|rate limit|429|too many requests/i.test(raw)) {
    return 'AI が混雑しています。少し時間をおいて「🔄 再分析」を押してください。';
  }
  if (/overloaded|5\d\d/i.test(raw)) {
    return 'AI サーバーが一時的に混雑中です。後ほど再分析できます。';
  }
  if (/api key|unauthorized|401/i.test(raw)) {
    return '右上の歯車 → API キーで、無料の Gemini キーを 1 分で登録すると即解消します。';
  }
  if (/network|fetch failed|timeout/i.test(raw)) {
    return 'ネットワーク接続エラー。再試行してください。';
  }
  return raw;
}

/** 旧 localStorage からの読み出し（IndexedDB への移行元） */
function loadLocal(): KnowledgeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// 永続化は IndexedDB（大容量可）。画像 base64 は重いので保存対象から外す
// （RAG はテキスト chunks で成立。画像プレビューはセッション中のみ）。
function slimForStore(items: KnowledgeItem[]): KnowledgeItem[] {
  return items.map((i) => (i.imageBase64 ? { ...i, imageBase64: undefined } : i));
}
async function save(items: KnowledgeItem[]) {
  const slim = slimForStore(items);
  const ok = await idbSet(STORAGE_KEY, slim);
  if (!ok) {
    // IndexedDB が使えない環境のみ localStorage へフォールバック（容量内のときだけ成功）
    safeSetJSON(STORAGE_KEY, slim, { module: 'ナレッジ' });
  }
}

type UpdateCashflowFn = (
  personaId: PersonaId,
  income: number,
  expense: number,
  label: string,
) => void;

export function useKnowledge(
  settings?: AppSettings,
  getActivePersona?: () => Persona | null,
  updateCashflow?: UpdateCashflowFn,
) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const hydratedRef = useRef(false);
  // 大量データ取込の解放判定：実際のプラン価格が ¥29,800 以上か（ブランド差・プランID共有を吸収）。マスターは常に解放。
  const { user: billingUser } = useBillingUser();
  const bulkUnlocked = isMasterAuth()
    || getEffectivePlanPriceJpy(billingUser) >= 29800
    || checkFeature(getEffectivePlan(billingUser), 'knowledge-brain').allowed;
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const CAP_MSG = '無料・標準プランのナレッジは 30 件までです。大量のデータ取込（統合ナレッジ脳）は ¥29,800 以上のプランで解放され、精度が大きく上がります。';

  // 永続化は IndexedDB（大容量可）。マウント時に1回ハイドレート（旧 localStorage からは自動移行）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data = await idbGet<KnowledgeItem[]>(STORAGE_KEY);
      if (!Array.isArray(data) || data.length === 0) {
        const ls = loadLocal();
        if (ls.length) {
          data = ls;
          await idbSet(STORAGE_KEY, slimForStore(ls));
          try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
        }
      }
      if (!cancelled && Array.isArray(data) && data.length) setItems(data);
      hydratedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // 変更を保存（ハイドレート完了後のみ・debounce で大量書込みをまとめる）
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => { void save(items); }, 400);
    return () => clearTimeout(t);
  }, [items]);

  // Supabase 同期 (未認証 / env 未設定なら no-op)。
  // ナレッジは個別アイテム最大 100KB 程度になりうるが user_state は jsonb で許容、
  // 上限を超える場合は今後 storage bucket に切替。
  useCloudSync({ key: STORAGE_KEY, value: items, setValue: setItems, isEmpty: v => v.length === 0 });

  // ★同一メール基準の端末引き継ぎ（PC→スマホで「また1から」を根治）。
  //   ログイン中(email)なら、cloud のナレッジを id 単位でマージ（既存を消さず、無い物だけ足す）。
  //   push は画像base64を除いた slim 版で軽量化（サーバー上限保護）。
  useEmailBlobSync<KnowledgeItem[]>({
    key: 'knowledge',
    email: billingUser?.email,
    value: slimForStore(items), // 画像base64を除いた軽量版を送る（サーバー上限保護）
    isEmpty: v => v.length === 0,
    // 画像を落とした slim を送る（受信側でも問題なく検索・表示できる）
    onRemote: (merged) => setItems(merged),
    merge: (local, remote) => {
      const byId = new Map<string, KnowledgeItem>();
      for (const it of remote) byId.set(it.id, it);
      for (const it of local) byId.set(it.id, it); // ローカルの最新を優先
      return Array.from(byId.values());
    },
  });

  const getForPersona = useCallback((personaId: PersonaId) =>
    items.filter(i => i.personaId === personaId),
    [items]
  );

  const updateAnalysis = useCallback((id: string, patch: Partial<KnowledgeItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  // ファイルから追加 (パース → 自動AI分析 + 財務自動取り込み)
  //
  // 進捗を 4 段階に細分化してユーザーに体感させる:
  //   pending  (item を一覧に挿入した直後 = 0%)
  //   parsing  (parseFile 中: 文字起こし / OCR 待ち)
  //   tagging  (inferTags 中: ローカル推定なので 200ms 程度表示)
  //   summarizing (analyzeKnowledge 中: 一番時間がかかる)
  //   extracting  (looksLikeFinancialData が true の場合のみ: 数字抽出中)
  //   done / error
  const addFromFile = useCallback(async (personaId: PersonaId, file: File): Promise<KnowledgeItem> => {
    if (!bulkUnlocked && items.length >= FREE_KNOWLEDGE_CAP) {
      setCapacityError(CAP_MSG);
      throw new Error(CAP_MSG);
    }
    const id = uuidv4();
    // パース前にプレースホルダ item を一覧に挿入 → ユーザーに「読み始めた」感を即座に出す
    const placeholder: KnowledgeItem = {
      id,
      personaId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      content: '',
      chunks: [],
      sourceType: 'file',
      fileName: file.name,
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      tags: [],
      analysisStatus: 'parsing',
    };
    setItems(prev => [placeholder, ...prev]);

    let parsed: Awaited<ReturnType<typeof parseFile>>;
    try {
      parsed = await parseFile(file);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      updateAnalysis(id, { analysisStatus: 'error', analysisError: friendlyError(raw) });
      throw err;
    }

    const content = parsed.text;
    const chunks = chunkText(content);

    // tagging ステージ — ローカル推定は瞬時に終わるので、可視化のため 200ms 表示
    updateAnalysis(id, {
      content,
      chunks,
      fileKind: parsed.kind,
      pages: parsed.pages,
      imageBase64: parsed.imageBase64,
      analysisStatus: 'tagging',
    });
    const tags = inferTags(content);
    await new Promise(resolve => setTimeout(resolve, 200));
    updateAnalysis(id, { tags });

    const persona = getActivePersona?.();
    const willExtract = !!(settings && persona && updateCashflow && looksLikeFinancialData(placeholder.title, content));

    // summarizing ステージ — AI 要約 (一番長い)
    if (settings && persona && content.length > 50) {
      updateAnalysis(id, { analysisStatus: 'summarizing' });
      try {
        const analysis = await analyzeKnowledge(settings, persona, placeholder.title, content, parsed.imageBase64);
        updateAnalysis(id, { analysis, analysisStatus: willExtract ? 'extracting' : 'done' });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = friendlyError(raw);
        updateAnalysis(id, { analysisStatus: 'error', analysisError: msg });
        // 失敗しても財務抽出は続行できるので return しない
      }
    } else {
      updateAnalysis(id, { analysisStatus: willExtract ? 'extracting' : 'done' });
    }

    // extracting ステージ — 財務データを検出 → cashflow を自動更新
    if (willExtract && settings && persona && updateCashflow) {
      try {
        const fin = await extractFinancialData(settings, placeholder.title, content);
        if (fin.isFinancial) {
          const income = Number(fin.income) || 0;
          const expenseRaw = Number(fin.expense) || 0;
          // 既存仕様: cashflow.expense は負値で保持
          const expense = expenseRaw > 0 ? -expenseRaw : expenseRaw;
          if (income !== 0 || expense !== 0) {
            const label = fin.period
              ? `${persona.name}・${fin.period}`
              : `${persona.name}の収支`;
            updateCashflow(personaId, income, expense, label);
          }
        }
      } catch {
        // 財務抽出失敗は無視 (要約は既に完了しているので UX に影響しない)
      }
      // error 状態でなければ done に確定
      setItems(prev => prev.map(i => i.id === id
        ? (i.analysisStatus === 'error' ? i : { ...i, analysisStatus: 'done' })
        : i));
    }

    // 戻り値: 最新スナップショット (UI 側はストア参照する想定だが、互換のため返す)
    return { ...placeholder, content, chunks, tags, fileKind: parsed.kind, pages: parsed.pages, imageBase64: parsed.imageBase64 };
  }, [settings, getActivePersona, updateAnalysis, updateCashflow, bulkUnlocked, items.length]);

  // 指定人格の全資料から財務データを抽出して cashflow を再計算
  const recomputeCashflow = useCallback(async (personaId: PersonaId, personaName: string): Promise<{
    success: boolean;
    totalIncome: number;
    totalExpense: number;
    period?: string;
    sources: number;
    failed: number;
    error?: string;
  }> => {
    if (!settings || !updateCashflow) {
      return { success: false, totalIncome: 0, totalExpense: 0, sources: 0, failed: 0, error: 'API キーが未設定です' };
    }
    const personaItems = items.filter(i => i.personaId === personaId);
    const candidates = personaItems.filter(i => looksLikeFinancialData(i.title, i.content));
    if (candidates.length === 0) {
      return { success: false, totalIncome: 0, totalExpense: 0, sources: 0, failed: 0, error: 'この人格に紐づく決算・財務資料が見つかりません' };
    }
    let totalIncome = 0;
    let totalExpense = 0;
    let latestPeriod: string | undefined;
    let failed = 0;
    for (const item of candidates) {
      try {
        const fin = await extractFinancialData(settings, item.title, item.content);
        if (!fin.isFinancial) continue;
        if (typeof fin.income === 'number') totalIncome += fin.income;
        if (typeof fin.expense === 'number') totalExpense += Math.abs(fin.expense);
        if (fin.period) latestPeriod = fin.period;
      } catch {
        failed++;
      }
    }
    if (totalIncome === 0 && totalExpense === 0) {
      return { success: false, totalIncome, totalExpense, sources: candidates.length, failed, error: '金額の抽出に失敗しました。資料の形式を確認してください' };
    }
    const label = latestPeriod ? `${personaName}・${latestPeriod}` : `${personaName}の収支`;
    updateCashflow(personaId, totalIncome, -totalExpense, label);
    return { success: true, totalIncome, totalExpense, period: latestPeriod, sources: candidates.length, failed };
  }, [items, settings, updateCashflow]);

  // 既存アイテムを再分析 — パース済みコンテンツに対する summarizing のみ走らせる
  const reanalyze = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    const persona = getActivePersona?.();
    if (!item || !settings || !persona) return;
    updateAnalysis(id, { analysisStatus: 'summarizing', analysisError: undefined });
    try {
      const analysis = await analyzeKnowledge(settings, persona, item.title, item.content, item.imageBase64);
      updateAnalysis(id, { analysis, analysisStatus: 'done' });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      updateAnalysis(id, { analysisStatus: 'error', analysisError: friendlyError(raw) });
    }
  }, [items, settings, getActivePersona, updateAnalysis]);

  // テキストノートから追加
  const addNote = useCallback((personaId: PersonaId, title: string, content: string): KnowledgeItem => {
    const chunks = chunkText(content);
    const item: KnowledgeItem = {
      id: uuidv4(),
      personaId,
      title,
      content,
      chunks,
      sourceType: 'note',
      createdAt: new Date().toISOString(),
      tags: inferTags(content),
    };
    setItems(prev => [item, ...prev]);
    return item;
  }, []);

  // URLコンテンツから追加（タイトル+要約テキスト）
  const addFromUrl = useCallback((personaId: PersonaId, url: string, title: string, content: string): KnowledgeItem => {
    const chunks = chunkText(content);
    const item: KnowledgeItem = {
      id: uuidv4(),
      personaId,
      title,
      content: `URL: ${url}\n\n${content}`,
      chunks,
      sourceType: 'url',
      createdAt: new Date().toISOString(),
      tags: inferTags(content),
    };
    setItems(prev => [item, ...prev]);
    return item;
  }, []);

  // フォルダ丸ごと一括取込 (統合ナレッジ脳用)。
  // 個別 AI 要約はかけず parse + chunk + ローカルタグだけ → 大量ファイルでも速く・無料。
  // 横断的な「統合思考」は KnowledgeBrainView 側でまとめて 1 回の AI 呼び出しに集約する。
  const addFilesBulk = useCallback(async (
    personaId: PersonaId,
    files: File[],
    onProgress?: (done: number, total: number, currentName: string) => void,
  ): Promise<{ added: number; skipped: number; failed: number; capped?: boolean }> => {
    // 大量一括取込は最上位（¥29,800〜）限定。未解放なら何も取り込まずアップグレード誘導。
    if (!bulkUnlocked) {
      setCapacityError(CAP_MSG);
      return { added: 0, skipped: files.length, failed: 0, capped: true };
    }
    setCapacityError(null);
    let added = 0, skipped = 0, failed = 0;
    const total = files.length;
    const seen = new Set(items.map(i => `${i.fileName}::${i.fileSize}`));
    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      onProgress?.(idx, total, file.name);
      const key = `${file.name}::${file.size}`;
      if (seen.has(key)) { skipped++; continue; } // 取り込み済み (重複防止)
      try {
        const parsed = await parseFile(file);
        const content = (parsed.text || '').trim();
        if (content.length < 20) { skipped++; continue; } // 中身が無い/画像のみ等はスキップ
        const item: KnowledgeItem = {
          id: uuidv4(),
          personaId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          content,
          chunks: chunkText(content),
          sourceType: 'file',
          fileKind: parsed.kind,
          fileName: file.name,
          fileSize: file.size,
          pages: parsed.pages,
          createdAt: new Date().toISOString(),
          tags: inferTags(content),
          analysisStatus: 'done',
        };
        seen.add(key);
        setItems(prev => [item, ...prev]);
        added++;
      } catch {
        failed++;
      }
    }
    onProgress?.(total, total, '');
    return { added, skipped, failed };
  }, [items, bulkUnlocked]);

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // AIが推奨ペルソナを推定（簡易）
  const suggestPersona = useCallback((text: string, personas: { id: string; name: string; description: string }[]): string | null => {
    let bestScore = 0;
    let bestId: string | null = null;
    for (const p of personas) {
      const descWords = (p.name + ' ' + p.description).toLowerCase().split(/\s+/);
      const textLower = text.toLowerCase();
      const score = descWords.filter(w => w.length > 2 && textLower.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestId = p.id;
      }
    }
    return bestId;
  }, []);

  return {
    items,
    getForPersona,
    addFromFile,
    addFilesBulk,
    addNote,
    addFromUrl,
    deleteItem,
    reanalyze,
    recomputeCashflow,
    suggestPersona,
    // 大量データ取込の解放状態・件数制限・アップグレード文言（UI 側のメーター/誘導用）
    bulkUnlocked,
    freeCap: FREE_KNOWLEDGE_CAP,
    capacityError,
    clearCapacityError: () => setCapacityError(null),
    searchKnowledge: (query: string, personaId: PersonaId) =>
      searchKnowledge(query, items.filter(i => i.personaId === personaId)),
  };
}
