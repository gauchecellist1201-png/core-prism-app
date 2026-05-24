import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { KnowledgeItem, KnowledgeChunk, PersonaId, AppSettings, Persona, KnowledgeAnalysis } from '../types/identity';
// fileParser は pdfjs/mammoth/xlsx/jszip を抱える 1MB 級の重さ。
// ファイル取り込みが発火した瞬間にだけ読むよう動的 import に寄せて、main から外す。
async function parseFile(file: File) {
  const mod = await import('../lib/fileParser');
  return mod.parseFile(file);
}
import { analyzeKnowledge, looksLikeFinancialData, extractFinancialData } from '../lib/analyzeKnowledge';
import { useCloudSync } from './useCloudSync';
import { safeSetJSON } from '../lib/storage';

const STORAGE_KEY = 'core_knowledge';
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

function load(): KnowledgeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: KnowledgeItem[]) {
  safeSetJSON(STORAGE_KEY, items, { module: 'ナレッジ' });
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
  const [items, setItems] = useState<KnowledgeItem[]>(load);

  useEffect(() => { save(items); }, [items]);

  // Supabase 同期 (未認証 / env 未設定なら no-op)。
  // ナレッジは個別アイテム最大 100KB 程度になりうるが user_state は jsonb で許容、
  // 上限を超える場合は今後 storage bucket に切替。
  useCloudSync({ key: STORAGE_KEY, value: items, setValue: setItems, isEmpty: v => v.length === 0 });

  const getForPersona = useCallback((personaId: PersonaId) =>
    items.filter(i => i.personaId === personaId),
    [items]
  );

  const updateAnalysis = useCallback((id: string, patch: Partial<KnowledgeItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  // ファイルから追加 (パース → 自動AI分析 + 財務自動取り込み)
  const addFromFile = useCallback(async (personaId: PersonaId, file: File): Promise<KnowledgeItem> => {
    const parsed = await parseFile(file);
    const content = parsed.text;
    const chunks = chunkText(content);
    const item: KnowledgeItem = {
      id: uuidv4(),
      personaId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      content,
      chunks,
      sourceType: 'file',
      fileKind: parsed.kind,
      fileName: file.name,
      fileSize: file.size,
      pages: parsed.pages,
      imageBase64: parsed.imageBase64,
      createdAt: new Date().toISOString(),
      tags: inferTags(content),
      analysisStatus: 'pending',
    };
    setItems(prev => [item, ...prev]);

    const persona = getActivePersona?.();

    // バックグラウンドで AI 分析を実行
    if (settings && persona && content.length > 50) {
      analyzeKnowledge(settings, persona, item.title, content, parsed.imageBase64)
        .then((analysis: KnowledgeAnalysis) => {
          updateAnalysis(item.id, { analysis, analysisStatus: 'done' });
        })
        .catch((err: unknown) => {
          const raw = err instanceof Error ? err.message : String(err);
          const msg = friendlyError(raw);
          updateAnalysis(item.id, { analysisStatus: 'error', analysisError: msg });
        });
    } else {
      updateAnalysis(item.id, { analysisStatus: 'done' });
    }

    // 財務データを検出 → cashflow を自動更新
    if (settings && persona && updateCashflow && looksLikeFinancialData(item.title, content)) {
      extractFinancialData(settings, item.title, content)
        .then(fin => {
          if (!fin.isFinancial) return;
          const income = Number(fin.income) || 0;
          const expenseRaw = Number(fin.expense) || 0;
          // 既存仕様: cashflow.expense は負値で保持
          const expense = expenseRaw > 0 ? -expenseRaw : expenseRaw;
          if (income === 0 && expense === 0) return;
          const label = fin.period
            ? `${persona.name}・${fin.period}`
            : `${persona.name}の収支`;
          updateCashflow(personaId, income, expense, label);
        })
        .catch(() => { /* 財務抽出失敗は無視 */ });
    }

    return item;
  }, [settings, getActivePersona, updateAnalysis, updateCashflow]);

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

  // 既存アイテムを再分析
  const reanalyze = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    const persona = getActivePersona?.();
    if (!item || !settings || !persona) return;
    updateAnalysis(id, { analysisStatus: 'pending', analysisError: undefined });
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
    addNote,
    addFromUrl,
    deleteItem,
    reanalyze,
    recomputeCashflow,
    suggestPersona,
    searchKnowledge: (query: string, personaId: PersonaId) =>
      searchKnowledge(query, items.filter(i => i.personaId === personaId)),
  };
}
