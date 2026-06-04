// ============================================================
// CommandPalette — Cmd+K でアプリの全てに到達できるハブ
//
// Linear / Raycast 級の生産性ハブ:
//   ・50+ コマンド (ナビ / クイック作成 / CXO 直接呼出 / データ操作 / ヘルプ)
//   ・AI 自然言語入力 (マッチしない時「AI に依頼する」候補)
//   ・最近使った 10 件を localStorage 永続化
//   ・キーボード操作 (↑↓選択 / Enter実行 / Tabカテゴリ切替 / Cmd+Enter AI 依頼)
//   ・モバイル: 下からシート、input 16px+ で iOS 自動ズーム回避
// ============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, Compass, Plus, Bot, Wrench, Settings as SettingsIcon,
  Clock, ArrowRight, CornerDownLeft, Command, Play,
} from 'lucide-react';
import type { Persona, KnowledgeItem } from '../types/identity';
import { useAgentTaskQueue, CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { notifyInApp } from '../lib/inAppNotify';
import { seedDemoData, setDemoActive, clearDemoData, isDemoActive } from '../lib/onboarding';

export type CmdAction =
  | { kind: 'open-modal'; modal: ModalKey; label: string; emoji: string; subtitle?: string }
  | { kind: 'switch-persona'; personaId: string; label: string; emoji: string; color: string }
  | { kind: 'jump-knowledge'; knowledgeId: string; label: string; subtitle: string; emoji: string }
  | { kind: 'jump-task'; taskId: string; personaId: string; label: string; subtitle: string; emoji: string }
  | { kind: 'quick-create'; modal: ModalKey; label: string; emoji: string; subtitle: string }
  | { kind: 'cxo'; cxo: CxoRole; label: string; subtitle: string; emoji: string; color: string; actionLabel: string }
  | { kind: 'ai-delegate'; prompt: string; label: string; subtitle: string; emoji: string }
  | { kind: 'data-op'; id: string; label: string; subtitle: string; emoji: string; onRun: () => void }
  | { kind: 'help'; id: string; label: string; subtitle: string; emoji: string; onRun: () => void }
  | { kind: 'custom'; id: string; label: string; subtitle?: string; emoji: string; onRun: () => void };

export type ModalKey =
  | 'knowledge' | 'meeting' | 'health' | 'minutes' | 'slides' | 'nego'
  | 'decision' | 'email' | 'premium' | 'post' | 'image' | 'invoice'
  | 'sales' | 'expense' | 'crm' | 'tasks' | 'pnl' | 'finConsult' | 'voice' | 'youtube'
  | 'salesAgent' | 'saasAgent' | 'settings' | 'documents' | 'people'
  | 'dailyReport';

interface Props {
  open: boolean;
  onClose: () => void;
  personas: Persona[];
  knowledge: KnowledgeItem[];
  activePersonaId: string;
  onSwitchPersona: (id: string) => void;
  onOpenModal: (m: ModalKey) => void;
  onOpenKnowledgeId?: (id: string) => void;
}

// ────────────────────────────────────────────────────────────
// カテゴリ定義
// ────────────────────────────────────────────────────────────
type CategoryKey = 'recent' | 'nav' | 'create' | 'ai' | 'data' | 'persona' | 'knowledge' | 'task' | 'help';

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  recent: '最近使った',
  nav: 'ナビ',
  create: '新規作成',
  ai: 'AI 会社に任せる',
  data: 'データ操作',
  persona: '人格切替',
  knowledge: 'ナレッジ',
  task: 'タスク',
  help: 'ヘルプ・設定',
};

// ナビ系 (既存 MODAL_LIST 拡張)
const MODAL_LIST: { key: ModalKey; label: string; emoji: string; subtitle?: string }[] = [
  { key: 'dailyReport', label: '今日のレポート',         emoji: '📊', subtitle: '売上・AI 完了・明日の 3 手を 1 枚で' },
  { key: 'knowledge', label: 'ナレッジを開く',          emoji: '📚', subtitle: '資料・メモ・PDF・画像を一覧' },
  { key: 'tasks',     label: 'タスクハブを開く',        emoji: '✅', subtitle: '全人格のタスクを横断管理' },
  { key: 'health',    label: 'ヘルス Hub を開く',       emoji: '🩺', subtitle: '体調・睡眠・運動の記録' },
  { key: 'minutes',   label: '議事録 AI を開く',         emoji: '🎩', subtitle: '会議の音声を要約' },
  { key: 'slides',    label: 'スライド生成を開く',       emoji: '🎨', subtitle: '台本から PPTX を生成' },
  { key: 'nego',      label: '交渉コーチを開く',         emoji: '🤝', subtitle: '商談の戦略を相談' },
  { key: 'decision',  label: '意思決定メモを開く',       emoji: '💭', subtitle: '判断の根拠を残す' },
  { key: 'post',      label: '投稿生成 (note / X)',     emoji: '📢', subtitle: 'SNS / ブログ用文章' },
  { key: 'image',     label: '画像生成を開く',           emoji: '🖼', subtitle: 'OG 画像・アイキャッチ' },
  { key: 'voice',     label: '音声メモを開く',           emoji: '🎤', subtitle: '録音 → 自動振り分け' },
  { key: 'youtube',   label: 'YouTube 取込を開く',       emoji: '📺', subtitle: 'URL から字幕要約' },
  { key: 'salesAgent', label: '商談 AI エージェント',     emoji: '🎯', subtitle: '案件を自動追跡' },
  { key: 'saasAgent',  label: 'SaaS エージェント',       emoji: '🤖', subtitle: 'ツール統合の自律エージェント' },
  { key: 'email',     label: 'メールトリアージ',         emoji: '📬', subtitle: '受信箱を AI で仕分け' },
  { key: 'premium',   label: 'プレミアム Hub',           emoji: '👑', subtitle: '上位プランの管理' },
  { key: 'invoice',   label: '請求書スタジオ',           emoji: '🧾', subtitle: '発行・入金管理' },
  { key: 'sales',     label: '売上台帳',                  emoji: '📒', subtitle: '日次の売上を記録' },
  { key: 'expense',   label: '経費 / OCR',               emoji: '📷', subtitle: 'レシートを撮って計上' },
  { key: 'pnl',       label: 'P&L 損益計算書',           emoji: '📊', subtitle: '今月の損益を見る' },
  { key: 'finConsult', label: '財務コンサルタント',        emoji: '🧮', subtitle: 'AI に数字を相談' },
  { key: 'crm',       label: 'CRM パイプライン',          emoji: '🗂', subtitle: '案件の進捗を管理' },
  { key: 'documents', label: '書類スタジオ',              emoji: '📄', subtitle: '契約書・提案書を作る' },
  { key: 'people',    label: '人物カルテ / 1on1',         emoji: '👥', subtitle: '関係者を記録' },
  { key: 'meeting',   label: '会議リンク',                emoji: '📅', subtitle: '会議スケジュール' },
];

// クイック作成
const QUICK_CREATE: { modal: ModalKey; label: string; emoji: string; subtitle: string }[] = [
  { modal: 'tasks',     label: '+ 新規タスク',          emoji: '✅', subtitle: 'タスクハブを開いて追加' },
  { modal: 'invoice',   label: '+ 新規請求書',          emoji: '🧾', subtitle: '請求書スタジオで発行' },
  { modal: 'knowledge', label: '+ 新規ナレッジメモ',     emoji: '📚', subtitle: 'メモを追加' },
  { modal: 'people',    label: '+ 新規人物',            emoji: '👥', subtitle: '人物カルテに登録' },
  { modal: 'expense',   label: '+ 新規経費',            emoji: '📷', subtitle: 'レシートを追加' },
  { modal: 'crm',       label: '+ 新規案件',            emoji: '🗂', subtitle: 'CRM に案件を作る' },
  { modal: 'post',      label: '+ 新規投稿',            emoji: '📢', subtitle: '投稿を下書き' },
  { modal: 'documents', label: '+ 新規書類',            emoji: '📄', subtitle: '契約書/提案書を作成' },
  { modal: 'decision',  label: '+ 新規意思決定メモ',     emoji: '💭', subtitle: '判断を残す' },
  { modal: 'minutes',   label: '+ 新規議事録',          emoji: '🎩', subtitle: '会議を要約する' },
];

// ────────────────────────────────────────────────────────────
// 最近使った
// ────────────────────────────────────────────────────────────
const RECENT_KEY = 'core_cmd_palette_recent_v1';
const RECENT_MAX = 10;

interface RecentEntry {
  id: string; // action id (kind 別に一意化)
  ts: number;
}

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentEntry[];
  } catch { return []; }
}

function saveRecent(entries: RecentEntry[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, RECENT_MAX))); } catch { /* */ }
}

function actionId(item: CmdAction): string {
  switch (item.kind) {
    case 'open-modal':     return 'modal:' + item.modal;
    case 'switch-persona': return 'persona:' + item.personaId;
    case 'jump-knowledge': return 'knowledge:' + item.knowledgeId;
    case 'jump-task':      return 'task:' + item.taskId;
    case 'quick-create':   return 'create:' + item.modal;
    case 'cxo':            return 'cxo:' + item.cxo;
    case 'ai-delegate':    return 'ai:' + item.prompt;
    case 'data-op':        return 'op:' + item.id;
    case 'help':           return 'help:' + item.id;
    case 'custom':         return 'custom:' + item.id;
  }
}

// ────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────
export default function CommandPalette({
  open, onClose, personas, knowledge, activePersonaId,
  onSwitchPersona, onOpenModal, onOpenKnowledgeId,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<CategoryKey | 'all'>('all');
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const queue = useAgentTaskQueue();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setActiveTab('all');
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const activePersona = personas.find(p => p.id === activePersonaId);
  const personaKnowledge = useMemo(
    () => knowledge.filter(k => k.personaId === activePersonaId),
    [knowledge, activePersonaId]
  );

  // ────────────────────────────────────────────────────────
  // CXO 直接呼出 (propose + auto-approve)
  // ────────────────────────────────────────────────────────
  const delegateToCxo = useCallback((cxo: CxoRole, actionLabel: string) => {
    const meta = CXO_META[cxo];
    const task = queue.propose({
      title: `${meta.shortLabel} に依頼: ${actionLabel}`,
      summary: `${meta.name} (${meta.tagline}) が ${actionLabel} を実行します。`,
      why: 'Cmd+K から直接呼び出し',
      expected: '1 文の実行結果',
      dueDays: 1,
      steps: [
        { cxo, label: actionLabel },
      ],
    });
    queue.approve(task.id);
    notifyInApp({
      kind: 'success',
      title: `${meta.emoji} ${meta.shortLabel} に依頼しました`,
      body: actionLabel,
      duration: 3000,
    });
  }, [queue]);

  // ────────────────────────────────────────────────────────
  // AI 自然言語依頼 (どの CXO が動くかは CEO が判断)
  // ────────────────────────────────────────────────────────
  const delegateToAi = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    // 簡易ヒューリスティクス: キーワードから担当 CXO を推定
    let cxo: CxoRole = 'CEO';
    if (/数字|売上|収支|p&?l|損益|予算|経費|請求/.test(trimmed)) cxo = 'CFO';
    else if (/投稿|sns|note|x |twitter|instagram|拡散|コピー|lp/i.test(trimmed)) cxo = 'CMO';
    else if (/案件|営業|商談|リード|提案|顧客/i.test(trimmed)) cxo = 'CSO';
    else if (/デザイン|配色|ロゴ|og|画像/i.test(trimmed)) cxo = 'CDO';
    else if (/コード|実装|バグ|エラー|api|サイト/i.test(trimmed)) cxo = 'CTO';
    else if (/分析|データ|傾向|異常|指標/i.test(trimmed)) cxo = 'CDS';
    else if (/契約|nda|規約|法務|リスク/i.test(trimmed)) cxo = 'CLO';
    else if (/整理|スケジュール|運用|片付け|滞留/i.test(trimmed)) cxo = 'COO';
    else if (/仕様|機能|プロダクト|ロードマップ/i.test(trimmed)) cxo = 'CPO';

    const meta = CXO_META[cxo];
    const task = queue.propose({
      title: `AI 依頼: ${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}`,
      summary: trimmed,
      why: 'Cmd+K の自然言語入力から',
      expected: '1 文の実行結果',
      dueDays: 1,
      steps: [
        { cxo: 'CEO', label: '依頼内容を解釈し担当を決定' },
        { cxo, label: trimmed.slice(0, 60) },
      ],
    });
    queue.approve(task.id);
    notifyInApp({
      kind: 'success',
      title: `${meta.emoji} ${meta.shortLabel} に依頼しました`,
      body: trimmed.slice(0, 60),
      duration: 3500,
    });
  }, [queue]);

  // ────────────────────────────────────────────────────────
  // 全候補をビルド
  // ────────────────────────────────────────────────────────
  const allItems = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const out: Array<{ item: CmdAction; category: CategoryKey }> = [];

    // ナビ
    for (const m of MODAL_LIST) {
      out.push({
        category: 'nav',
        item: { kind: 'open-modal', modal: m.key, label: m.label, emoji: m.emoji, subtitle: m.subtitle },
      });
    }

    // 新規作成
    for (const c of QUICK_CREATE) {
      out.push({
        category: 'create',
        item: { kind: 'quick-create', modal: c.modal, label: c.label, emoji: c.emoji, subtitle: c.subtitle },
      });
    }

    // AI 会社 (CXO 直接呼出) — 各 CXO の代表アクション (canDo[0])
    (Object.keys(CXO_META) as CxoRole[]).forEach((cxo) => {
      const meta = CXO_META[cxo];
      const action = meta.canDo[0];
      if (!action) return;
      out.push({
        category: 'ai',
        item: {
          kind: 'cxo',
          cxo,
          label: `${meta.shortLabel} に依頼: ${action}`,
          subtitle: `${meta.name} · ${meta.tagline}`,
          emoji: meta.emoji,
          color: meta.color,
          actionLabel: action,
        },
      });
      // 2 番目のアクションも候補に
      if (meta.canDo[1]) {
        out.push({
          category: 'ai',
          item: {
            kind: 'cxo',
            cxo,
            label: `${meta.shortLabel}: ${meta.canDo[1]}`,
            subtitle: `${meta.name} · ${meta.tagline}`,
            emoji: meta.emoji,
            color: meta.color,
            actionLabel: meta.canDo[1],
          },
        });
      }
    });

    // データ操作 — 直接ハンドラを実行 (CustomEvent ではリスナがおらず無音になっていた)
    const handleStripeSync = () => {
      // useStripeRevenue / MyBusinessRevenueCard が購読している接続イベントを再発火
      try { window.dispatchEvent(new CustomEvent('core:stripe-connected')); } catch { /* */ }
      notifyInApp({ kind: 'info', title: '💳 Stripe を再同期しました', body: '最新の取引を取得中…', duration: 2200 });
    };
    const handleDemoStart = () => {
      try {
        const n = seedDemoData();
        setDemoActive(true);
        notifyInApp({ kind: 'success', title: '▶️ デモを開始しました', body: `${n} 件のサンプルデータで体験`, duration: 2500 });
        setTimeout(() => window.location.reload(), 600);
      } catch (e: any) {
        notifyInApp({ kind: 'warn', title: 'デモ開始に失敗', body: e?.message || 'もう一度お試しください', duration: 3500 });
      }
    };
    const handleDemoEnd = () => {
      try {
        clearDemoData();
        notifyInApp({ kind: 'success', title: '⏹ デモを片付けました', body: 'サンプルを削除', duration: 2200 });
        setTimeout(() => window.location.reload(), 500);
      } catch (e: any) {
        notifyInApp({ kind: 'warn', title: 'デモ終了に失敗', body: e?.message || 'もう一度お試しください', duration: 3500 });
      }
    };
    const dataOps: Array<{ id: string; label: string; subtitle: string; emoji: string; onRun: () => void }> = [
      { id: 'stripe-sync', label: 'Stripe を再同期', subtitle: '今月の売上を最新化', emoji: '💳', onRun: handleStripeSync },
      { id: 'demo-start', label: 'デモを開始', subtitle: 'デモデータで体験する', emoji: '▶️', onRun: handleDemoStart },
      { id: 'demo-end', label: isDemoActive() ? 'デモを終了' : 'デモを終了 (現在オフ)', subtitle: 'デモデータを片付ける', emoji: '⏹', onRun: handleDemoEnd },
      { id: 'reload', label: 'ページを再読み込み', subtitle: '最新の状態を取得', emoji: '🔁', onRun: () => window.location.reload() },
    ];
    for (const d of dataOps) {
      out.push({ category: 'data', item: { kind: 'data-op', ...d } });
    }

    // 人格切替
    for (const p of personas) {
      if (p.id === activePersonaId) continue;
      out.push({
        category: 'persona',
        item: {
          kind: 'switch-persona',
          personaId: p.id,
          label: `人格切替: ${p.name}`,
          emoji: p.icon,
          color: p.accentColor,
        },
      });
    }

    // ナレッジ
    for (const k of personaKnowledge.slice(0, 50)) {
      out.push({
        category: 'knowledge',
        item: {
          kind: 'jump-knowledge',
          knowledgeId: k.id,
          label: k.title,
          subtitle: `${k.fileKind || 'note'}${k.tags.length > 0 ? ' · ' + k.tags.slice(0, 2).join(', ') : ''}`,
          emoji: k.fileKind === 'image' ? '🖼' : k.fileKind === 'pdf' ? '📑' : '📄',
        },
      });
    }

    // タスク
    if (activePersona) {
      for (const t of activePersona.tasks.filter(t => !t.done).slice(0, 30)) {
        out.push({
          category: 'task',
          item: {
            kind: 'jump-task',
            taskId: t.id,
            personaId: activePersona.id,
            label: t.title,
            subtitle: `${t.priority === 'high' ? '高' : t.priority === 'mid' ? '中' : '低'} · ${t.due}`,
            emoji: '✅',
          },
        });
      }
    }

    // ヘルプ・設定 — 設定モーダルへ集約 (専用画面のない項目はリスナが無くなる)
    const handleThemeToggle = () => {
      try {
        const root = document.documentElement;
        const cur = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const next = cur === 'light' ? 'dark' : 'light';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('core_theme', next); } catch { /* */ }
        notifyInApp({ kind: 'info', title: `🌓 テーマを ${next === 'light' ? 'ライト' : 'ダーク'} に切替`, duration: 1800 });
      } catch { /* */ }
    };
    const openSitemapPalette = () => {
      try {
        // SitemapPalette は keydown で Cmd+Shift+/ を購読しているので、合成イベントを 投げる
        const ev = new KeyboardEvent('keydown', { key: '/', shiftKey: true, metaKey: true, bubbles: true });
        window.dispatchEvent(ev);
        // 互換: 一部 環境で metaKey が無効化される可能性 → 直接 CustomEvent でもトリガ
        window.dispatchEvent(new CustomEvent('core:open-sitemap-palette'));
      } catch { /* */ }
    };
    const openAiHistory = () => {
      try { window.dispatchEvent(new CustomEvent('core:open-ai-suggestions')); } catch { /* */ }
    };
    const helpItems: Array<{ id: string; label: string; subtitle: string; emoji: string; onRun: () => void }> = [
      { id: 'sitemap',  label: '全機能マップ', subtitle: '全ページ / 全機能 を 1 画面で (Cmd+Shift+/)', emoji: '🗺️', onRun: openSitemapPalette },
      { id: 'history',  label: 'AI 提案 履歴 (7 日)', subtitle: '採用 / 却下 / 採用率 (Cmd+Shift+H)', emoji: '🕘', onRun: openAiHistory },
      { id: 'api-keys', label: 'API キー設定', subtitle: 'OpenAI / Stripe などの接続', emoji: '🔑', onRun: () => onOpenModal('settings') },
      { id: 'settings', label: '設定を開く', subtitle: 'すべての設定 (5 タブ + 検索)', emoji: '⚙️', onRun: () => onOpenModal('settings') },
      { id: 'theme', label: 'テーマ切替', subtitle: 'ライト / ダーク', emoji: '🌓', onRun: handleThemeToggle },
    ];
    for (const h of helpItems) {
      out.push({ category: 'help', item: { kind: 'help', ...h } });
    }

    return out;
  }, [personas, personaKnowledge, activePersona, activePersonaId, onOpenModal]);

  // ────────────────────────────────────────────────────────
  // 最近使った (recent) を解決
  // ────────────────────────────────────────────────────────
  const recentItems = useMemo<CmdAction[]>(() => {
    const byId = new Map<string, CmdAction>();
    for (const { item } of allItems) byId.set(actionId(item), item);
    return recent
      .map(r => byId.get(r.id))
      .filter((x): x is CmdAction => Boolean(x))
      .slice(0, 10);
  }, [allItems, recent]);

  // ────────────────────────────────────────────────────────
  // フィルタリング (ファジー、複数語 AND)
  // ────────────────────────────────────────────────────────
  const filtered = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const q = query.trim().toLowerCase();
    // クエリ空 → 最近 + 全件 (重複除去)
    if (!q) {
      const result: Array<{ item: CmdAction; category: CategoryKey }> = [];
      const seen = new Set<string>();
      for (const r of recentItems) {
        const id = actionId(r);
        if (seen.has(id)) continue;
        seen.add(id);
        result.push({ item: r, category: 'recent' });
      }
      for (const entry of allItems) {
        const id = actionId(entry.item);
        if (seen.has(id)) continue;
        seen.add(id);
        if (activeTab !== 'all' && entry.category !== activeTab) continue;
        result.push(entry);
      }
      return result;
    }
    // クエリあり → スコア順にフィルタ
    const parts = q.split(/\s+/);
    const scored: Array<{ entry: { item: CmdAction; category: CategoryKey }; score: number }> = [];
    for (const entry of allItems) {
      if (activeTab !== 'all' && entry.category !== activeTab) continue;
      const item = entry.item;
      const hay = (item.label + ' ' + ('subtitle' in item && item.subtitle ? item.subtitle : '')).toLowerCase();
      if (!parts.every(p => hay.includes(p))) continue;
      // スコア: 先頭一致 +10, ラベル一致 +5, それ以外 +1
      let score = 0;
      for (const p of parts) {
        if (item.label.toLowerCase().startsWith(p)) score += 10;
        else if (item.label.toLowerCase().includes(p)) score += 5;
        else score += 1;
      }
      scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.entry);
  }, [allItems, recentItems, query, activeTab]);

  // クエリにマッチが無い (または少ない) 時、AI 依頼候補を末尾に追加
  const filteredWithAi = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const q = query.trim();
    if (!q) return filtered;
    const aiEntry: { item: CmdAction; category: CategoryKey } = {
      category: 'ai',
      item: {
        kind: 'ai-delegate',
        prompt: q,
        label: `AI に依頼する: "${q.slice(0, 50)}${q.length > 50 ? '…' : ''}"`,
        subtitle: '担当 CXO が自動で動きます (Cmd+Enter)',
        emoji: '🪄',
      },
    };
    // すでに同じ ID があれば追加しない
    if (filtered.some(f => actionId(f.item) === actionId(aiEntry.item))) return filtered;
    return [...filtered, aiEntry];
  }, [filtered, query]);

  // ────────────────────────────────────────────────────────
  // 0 件時の「もしかして」候補 (bigram 重なりスコア)
  // ────────────────────────────────────────────────────────
  const fuzzySuggestions = useMemo<CmdAction[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || filtered.length > 0) return [];
    // 1 文字 + 隣接 2 文字の n-gram で重なりカウント
    const grams = new Set<string>();
    for (const ch of q) grams.add(ch);
    for (let i = 0; i < q.length - 1; i++) grams.add(q.slice(i, i + 2));
    if (grams.size === 0) return [];

    const scored: Array<{ item: CmdAction; score: number }> = [];
    const seen = new Set<string>();
    for (const { item } of allItems) {
      // jump-knowledge / jump-task / persona は数が多すぎて雑音になるので除外
      if (item.kind === 'jump-knowledge' || item.kind === 'jump-task' || item.kind === 'switch-persona') continue;
      const id = actionId(item);
      if (seen.has(id)) continue;
      const hay = (item.label + ' ' + ('subtitle' in item && item.subtitle ? item.subtitle : '')).toLowerCase();
      let score = 0;
      for (const g of grams) if (hay.includes(g)) score += g.length;
      if (score > 0) {
        seen.add(id);
        scored.push({ item, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(s => s.item);
  }, [allItems, query, filtered.length]);

  // ────────────────────────────────────────────────────────
  // selectedIdx を範囲内に保つ
  // ────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedIdx >= filteredWithAi.length) setSelectedIdx(Math.max(0, filteredWithAi.length - 1));
  }, [filteredWithAi.length, selectedIdx]);

  // 選択行を可視に
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const node = list.querySelector(`[data-cmd-idx="${selectedIdx}"]`) as HTMLElement | null;
    if (node) {
      const top = node.offsetTop;
      const bottom = top + node.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top - 4;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
    }
  }, [selectedIdx]);

  // ────────────────────────────────────────────────────────
  // 実行
  // ────────────────────────────────────────────────────────
  const runItem = useCallback((item: CmdAction) => {
    // recent に記録 (ai-delegate は prompt が毎回違うので除外)
    if (item.kind !== 'ai-delegate') {
      const id = actionId(item);
      const next = [{ id, ts: Date.now() }, ...recent.filter(r => r.id !== id)].slice(0, RECENT_MAX);
      saveRecent(next);
      setRecent(next);
    }

    switch (item.kind) {
      case 'open-modal':
      case 'quick-create':
        onClose();
        onOpenModal(item.modal);
        break;
      case 'switch-persona':
        onClose();
        onSwitchPersona(item.personaId);
        break;
      case 'jump-knowledge':
        onClose();
        onOpenKnowledgeId?.(item.knowledgeId);
        onOpenModal('knowledge');
        break;
      case 'jump-task':
        onClose();
        onOpenModal('tasks');
        break;
      case 'cxo':
        onClose();
        delegateToCxo(item.cxo, item.actionLabel);
        break;
      case 'ai-delegate':
        onClose();
        delegateToAi(item.prompt);
        break;
      case 'data-op':
      case 'help':
      case 'custom':
        onClose();
        item.onRun();
        break;
    }
  }, [recent, onClose, onOpenModal, onSwitchPersona, onOpenKnowledgeId, delegateToCxo, delegateToAi]);

  // ────────────────────────────────────────────────────────
  // キーボード
  // ────────────────────────────────────────────────────────
  const TAB_ORDER: Array<CategoryKey | 'all'> = ['all', 'nav', 'create', 'ai', 'data', 'help'];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(filteredWithAi.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Cmd+Enter → AI 依頼を強制
      if ((e.metaKey || e.ctrlKey) && query.trim()) {
        onClose();
        delegateToAi(query);
        return;
      }
      const entry = filteredWithAi[selectedIdx];
      if (entry) runItem(entry.item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const idx = TAB_ORDER.indexOf(activeTab);
      const next = TAB_ORDER[(idx + (e.shiftKey ? -1 : 1) + TAB_ORDER.length) % TAB_ORDER.length];
      setActiveTab(next);
      setSelectedIdx(0);
    }
  };

  // ────────────────────────────────────────────────────────
  // グルーピング (描画用)
  // ────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<CategoryKey, CmdAction[]>();
    for (const { item, category } of filteredWithAi) {
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(item);
    }
    return [...map.entries()];
  }, [filteredWithAi]);

  const flatItems = filteredWithAi.map(f => f.item);

  // ────────────────────────────────────────────────────────
  // カテゴリ アイコン
  // ────────────────────────────────────────────────────────
  const categoryIcon = (c: CategoryKey) => {
    const props = { size: 12, strokeWidth: 2 };
    switch (c) {
      case 'recent':    return <Clock {...props} />;
      case 'nav':       return <Compass {...props} />;
      case 'create':    return <Plus {...props} />;
      case 'ai':        return <Bot {...props} />;
      case 'data':      return <Wrench {...props} />;
      case 'persona':   return <Sparkles {...props} />;
      case 'knowledge': return <Search {...props} />;
      case 'task':      return <Search {...props} />;
      case 'help':      return <SettingsIcon {...props} />;
    }
  };

  const categoryAccent = (c: CategoryKey) => {
    switch (c) {
      case 'recent':    return '#94A3B8';
      case 'nav':       return '#60A5FA';
      case 'create':    return '#34D399';
      case 'ai':        return '#A78BFA';
      case 'data':      return '#F59E0B';
      case 'persona':   return '#F472B6';
      case 'knowledge': return '#22D3EE';
      case 'task':      return '#FBBF24';
      case 'help':      return '#9CA3AF';
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center pt-20 px-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', maxHeight: 'calc(100dvh - 4rem)' }}
            initial={{ scale: 0.96, y: -20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: -20 }}
            onClick={e => e.stopPropagation()}
          >
            {/* 検索ボックス */}
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <Sparkles size={20} style={{ color: 'var(--prism-creative, #A78BFA)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={handleKeyDown}
                placeholder="やりたいこと、機能、AI への依頼を入力…"
                className="flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle"
                style={{ fontSize: '17px' /* iOS 自動ズーム回避 (16px+) */ }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="cp-pill" style={{ fontSize: '0.65rem' }}>ESC</span>
            </div>

            {/* カテゴリ タブ */}
            <div
              className="px-3 py-2 flex items-center gap-1 overflow-x-auto"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {TAB_ORDER.map((tab) => {
                const isActive = activeTab === tab;
                const label = tab === 'all' ? 'すべて' : CATEGORY_LABEL[tab as CategoryKey];
                const accent = tab === 'all' ? 'var(--prism-creative, #A78BFA)' : categoryAccent(tab as CategoryKey);
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedIdx(0); inputRef.current?.focus(); }}
                    className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all flex items-center gap-1.5"
                    style={{
                      background: isActive ? `${accent}22` : 'transparent',
                      color: isActive ? accent : 'var(--fg-subtle)',
                      border: `1px solid ${isActive ? accent + '55' : 'transparent'}`,
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {tab !== 'all' && categoryIcon(tab as CategoryKey)}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* 結果リスト */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-2">
              {flatItems.length === 0 ? (
                <div className="cp-zero">
                  <p className="cp-empty-icon" style={{ marginTop: 8 }}><Search size={32} /></p>
                  <p className="cp-zero-title">
                    {query.trim() ? (
                      <>「<span style={{ color: 'var(--fg)', fontWeight: 600 }}>{query.slice(0, 24)}{query.length > 24 ? '…' : ''}</span>」は見つかりませんでした</>
                    ) : '該当なし'}
                  </p>

                  {/* もしかして？ — 近い候補 */}
                  {query.trim() && fuzzySuggestions.length > 0 && (
                    <div className="cp-zero-section">
                      <div className="cp-zero-section-label">もしかして？</div>
                      {fuzzySuggestions.map((item) => (
                        <button
                          key={'fz:' + actionId(item)}
                          onClick={() => runItem(item)}
                          className="cp-zero-row"
                        >
                          <span className="cp-zero-row-emoji">{item.emoji}</span>
                          <span className="cp-zero-row-label">{item.label}</span>
                          <ArrowRight size={14} style={{ color: 'var(--fg-subtle)' }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 最近使った 3 件 — クエリ無しでも常に出して行き止まりを作らない */}
                  {recentItems.length > 0 && (
                    <div className="cp-zero-section">
                      <div className="cp-zero-section-label">
                        <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                        最近使った
                      </div>
                      {recentItems.slice(0, 3).map((item) => (
                        <button
                          key={'rc:' + actionId(item)}
                          onClick={() => runItem(item)}
                          className="cp-zero-row"
                        >
                          <span className="cp-zero-row-emoji">{item.emoji}</span>
                          <span className="cp-zero-row-label">{item.label}</span>
                          <ArrowRight size={14} style={{ color: 'var(--fg-subtle)' }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 復旧 CTA: AI 依頼 + デモ開始 */}
                  <div className="cp-zero-ctas">
                    {query.trim() && (
                      <button
                        onClick={() => { onClose(); delegateToAi(query); }}
                        className="cp-zero-cta-primary"
                      >
                        <Bot size={14} />
                        AI 会社に「{query.slice(0, 22)}{query.length > 22 ? '…' : ''}」を依頼
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onClose();
                        try {
                          const n = seedDemoData();
                          setDemoActive(true);
                          notifyInApp({ kind: 'success', title: '▶️ デモを開始しました', body: `${n} 件のサンプル`, duration: 2200 });
                          setTimeout(() => window.location.reload(), 500);
                        } catch (e: any) {
                          notifyInApp({ kind: 'warn', title: 'デモ開始に失敗', body: e?.message || '再試行してください', duration: 3000 });
                        }
                      }}
                      className="cp-zero-cta-secondary"
                    >
                      <Play size={13} />
                      デモで触ってみる
                    </button>
                  </div>
                  <p className="cp-zero-hint">何も決めずに閉じてもOKです (Esc)</p>
                </div>
              ) : (
                grouped.map(([category, items]) => {
                  const accent = categoryAccent(category);
                  return (
                    <div key={category} className="mb-1">
                      <div
                        className="cp-tiny px-5 py-1.5 sticky top-0 flex items-center gap-1.5"
                        style={{ background: 'var(--bg-2)', color: accent, fontWeight: 600 }}
                      >
                        {categoryIcon(category)}
                        <span>{CATEGORY_LABEL[category]}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--fg-subtle)', fontWeight: 400 }}>{items.length}</span>
                      </div>
                      {items.map((item) => {
                        const flatIdx = flatItems.indexOf(item);
                        const isSelected = flatIdx === selectedIdx;
                        const subtitle = 'subtitle' in item ? item.subtitle : undefined;
                        const barColor = 'color' in item && item.color ? item.color : accent;
                        return (
                          <button
                            key={actionId(item) + flatIdx}
                            data-cmd-idx={flatIdx}
                            onMouseEnter={() => setSelectedIdx(flatIdx)}
                            onClick={() => runItem(item)}
                            className="w-full text-left px-5 py-2.5 flex items-center gap-3 transition-all"
                            style={{
                              background: isSelected ? 'var(--surface-3)' : 'transparent',
                              borderLeft: isSelected ? `3px solid ${barColor}` : '3px solid transparent',
                              transform: isSelected ? 'translateX(2px)' : 'none',
                            }}
                          >
                            <span className="text-xl flex-shrink-0">{item.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="cp-body truncate" style={{ fontWeight: isSelected ? 600 : 400 }}>{item.label}</p>
                              {subtitle && <p className="cp-meta truncate">{subtitle}</p>}
                            </div>
                            {isSelected && (
                              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
                                {item.kind === 'ai-delegate' ? (
                                  <><Command size={10} /><CornerDownLeft size={10} /></>
                                ) : (
                                  <ArrowRight size={12} />
                                )}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* フッタヒント */}
            <div
              className="px-5 py-2 flex items-center gap-3 flex-wrap text-fg-subtle"
              style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}
            >
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>↑↓</kbd>選択</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>↵</kbd>実行</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Tab</kbd>カテゴリ</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>⌘↵</kbd>AI 依頼</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Esc</kbd>閉じる</span>
              <span className="ml-auto">{flatItems.length} 件</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Cmd+K / Ctrl+K グローバルキーバインド */
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
