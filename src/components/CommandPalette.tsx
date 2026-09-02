// ============================================================
// CommandPalette — Cmd+K でアプリの全てに到達できるハブ
//
// Linear / Raycast 級の生産性ハブ:
//   ・50+ コマンド (ナビ / クイック作成 / CXO 直接呼出 / データ操作 / ヘルプ)
//   ・AI 自然言語入力 (マッチしない時「AI に依頼する」候補)
//   ・最近使った 10 件を localStorage 永続化
//   ・AI 依頼は「よく使う依頼」として自動保存 → 次回は入力ゼロで 1 タップ再実行
//     (2026-07-26: 同じ依頼を毎回打ち直していた摩擦の根治。消す→元に戻すも 1 タップ)
//   ・@ で対象を指してから頼む (2026-07-27): @ナレッジ / @カレンダー / @メール / @売上。
//     指した対象の"実データだけ"を読んで実行する = AI が何を見たかが目に見える。
//     繋がっていない連携は候補に出さない。読めなければ理由を出して止める (黙って一般論を書かせない)。
//   ・キーボード操作 (↑↓選択 / Enter実行 / Tabカテゴリ切替 / Cmd+Enter AI 依頼)
//   ・モバイル: 下からシート、input 16px+ で iOS 自動ズーム回避
// ============================================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sparkles, Compass, Plus, Bot, Wrench, Settings as SettingsIcon,
  Clock, ArrowRight, CornerDownLeft, Command, Play, Star, X, Undo2, AtSign, Loader2,
  CreditCard, Square, RefreshCw, Map as MapIcon, History, KeyRound, SunMoon,
  FileText, FileImage, FileType2, ChevronDown,
  CheckCircle2, AlertTriangle, RotateCcw, Copy, CornerUpLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Persona, KnowledgeItem } from '../types/identity';
import {
  listMentionTargets, resolveMentionTarget, buildMentionContext, mentionErrorMessage,
  type MentionTarget,
} from '../lib/mentionTargets';
import { useAgentTaskQueue, CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { notifyInApp } from '../lib/inAppNotify';
import { seedDemoData, setDemoActive, clearDemoData, isDemoActive } from '../lib/onboarding';
import { listSuggestions, setStatus as setSuggestionStatus, type SuggestionEntry } from '../lib/aiSuggestionLog';
import PersonaGlyph, { isRoleCode } from './PersonaGlyph';
// ⌘K の検索結果も、ホームのタイル・からっぽ画面とまったく同じ台帳から絵と色を引く。
// (これが無い間、同じ「スライドを作る」がタイルでは紫の投影機・⌘K では 🎨 に見えていた)
import { resolveFeatureIcon } from '../lib/featureIcons';
import { fuzzyScore, FUZZY_MIN_SCORE } from '../lib/commandFuzzy';
import { rankScore, compareRanked } from '../lib/commandScore';
import { toReading } from '../lib/commandReading';
import { capByCategory, BROWSE_CAP, SEARCH_CAP } from '../lib/commandCap';
// 「答えが 1 つ返るだけ」の用事で、見ていた画面を失わせないための札。
import {
  buildKnowledgeResult,
  buildSuggestionResult,
  nextSuggestionStatus,
  type InlineCommandResult,
} from '../lib/inlineCommandResult';

export type CmdAction =
  // iconKey … 機能アイコン台帳 (lib/featureIcons.ts) の ID。
  //   ある行はブランドのアイコン + 色で出る。無い行だけ従来どおり emoji を出す。
  | { kind: 'open-modal'; modal: ModalKey; label: string; emoji: string; iconKey?: string; subtitle?: string }
  | { kind: 'switch-persona'; personaId: string; label: string; emoji: string; color: string }
  | { kind: 'jump-knowledge'; knowledgeId: string; label: string; subtitle: string; emoji: string; iconKey?: string }
  | { kind: 'jump-task'; taskId: string; personaId: string; label: string; subtitle: string; emoji: string; iconKey?: string }
  | { kind: 'quick-create'; modal: ModalKey; label: string; emoji: string; iconKey?: string; subtitle: string }
  | { kind: 'cxo'; cxo: CxoRole; label: string; subtitle: string; emoji: string; color: string; actionLabel: string }
  | { kind: 'ai-delegate'; prompt: string; label: string; subtitle: string; emoji: string; mentionId?: string }
  // stay … 押してもパレットを閉じない項目。onRun が答えを返したら、その答えを
  //   このパレットの中の「答えの札」に出す (返さなければリストのまま開けておく)。
  //   場所へ連れて行く項目 (設定・請求・全機能マップ…) には付けない。
  | { kind: 'data-op'; id: string; label: string; subtitle: string; emoji: string; iconKey?: string; stay?: true; onRun: () => void | InlineCommandResult }
  | { kind: 'help'; id: string; label: string; subtitle: string; emoji: string; iconKey?: string; stay?: true; onRun: () => void | InlineCommandResult }
  | { kind: 'custom'; id: string; label: string; subtitle?: string; emoji: string; iconKey?: string; stay?: true; onRun: () => void | InlineCommandResult };

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
type CategoryKey = 'saved' | 'recent' | 'nav' | 'create' | 'ai' | 'suggestion' | 'changelog' | 'data' | 'persona' | 'knowledge' | 'task' | 'help';

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  saved: 'よく使う依頼 (タップでもう一度)',
  recent: 'よく使う・最近',
  nav: 'ナビ',
  create: '新規作成',
  ai: 'AI 会社に任せる',
  suggestion: '最近の AI 提案 (タップで採用/却下)',
  changelog: '✨ 最近の 新機能 (タップで /changelog へ)',
  data: 'データ操作',
  persona: '人格切替',
  knowledge: 'ナレッジ',
  task: 'タスク',
  help: 'ヘルプ・設定',
};

/**
 * タブに出す短い名前。iPhone 375px ではタブが横1列に並ぶため、
 * 長い見出しをそのまま出すと隣のタブとぶつかって読めなくなる。
 * 見出し（リスト内）は説明的なまま、タブだけ短くする。
 */
const CATEGORY_TAB_LABEL: Partial<Record<CategoryKey, string>> = {
  saved: 'よく使う依頼',
};

/**
 * 件数が多くなる区分だけ、最初は少しだけ出す数。
 *
 * ★これは「打ち切り」ではなく「たたみ方」。
 *   2026-08-03 まで、ナレッジは `personaKnowledge.slice(0, 50)` で 51 件目以降を
 *   検索の候補にすら入れていなかった。つまり在るのに「見つかりません」と出る状態で、
 *   探し物が見つからない最悪の型だった (タスクも 31 件目以降が同じ)。
 *   いまは検索は必ず全件が対象。ここで絞るのは画面に並べる数だけで、
 *   隠した数は必ず「ほかに◯件あります」と画面に出す (黙って切らない)。
 */
// 段ごとの上限は `src/lib/commandCap.ts` (BROWSE_CAP = 眺めている時 / SEARCH_CAP = 打っている時)。
// 打っている時だけ段ごと 3 件へ畳む = 「必要な結果だけ」。隠した数は必ず画面に出す。

// ナビ系 (既存 MODAL_LIST 拡張)
// iconKey は QuickActions のタイル ID と同じもの。ここを揃えることで、
// ホームで見た絵と ⌘K で見つけた絵が必ず一致する。
const MODAL_LIST: { key: ModalKey; label: string; emoji: string; iconKey: string; subtitle?: string }[] = [
  { key: 'dailyReport', label: '今日のレポート',         emoji: '📊', iconKey: 'briefing',    subtitle: '売上・AI 完了・明日の 3 手を 1 枚で' },
  { key: 'knowledge', label: 'ナレッジを開く',          emoji: '📚', iconKey: 'kb',          subtitle: '資料・メモ・PDF・画像を一覧' },
  { key: 'tasks',     label: 'タスクハブを開く',        emoji: '✅', iconKey: 'tasks-hub',   subtitle: '全人格のタスクを横断管理' },
  { key: 'health',    label: 'ヘルス Hub を開く',       emoji: '🩺', iconKey: 'health',      subtitle: '体調・睡眠・運動の記録' },
  { key: 'minutes',   label: '議事録 AI を開く',         emoji: '🎩', iconKey: 'minutes',     subtitle: '会議の音声を要約' },
  { key: 'slides',    label: 'スライド生成を開く',       emoji: '🎨', iconKey: 'slides',      subtitle: '台本から PPTX を生成' },
  { key: 'nego',      label: '交渉コーチを開く',         emoji: '🤝', iconKey: 'nego',        subtitle: '商談の戦略を相談' },
  { key: 'decision',  label: '意思決定メモを開く',       emoji: '💭', iconKey: 'decision',    subtitle: '判断の根拠を残す' },
  { key: 'post',      label: '投稿生成 (note / X)',     emoji: '📢', iconKey: 'post',        subtitle: 'SNS / ブログ用文章' },
  { key: 'image',     label: '画像生成を開く',           emoji: '🖼', iconKey: 'image',       subtitle: 'OG 画像・アイキャッチ' },
  { key: 'voice',     label: '音声メモを開く',           emoji: '🎤', iconKey: 'voice',       subtitle: '録音 → 自動振り分け' },
  { key: 'youtube',   label: 'YouTube 取込を開く',       emoji: '📺', iconKey: 'youtube',     subtitle: 'URL から字幕要約' },
  { key: 'salesAgent', label: '商談 AI エージェント',     emoji: '🎯', iconKey: 'sales-agent', subtitle: '案件を自動追跡' },
  { key: 'saasAgent',  label: 'SaaS エージェント',       emoji: '🤖', iconKey: 'saas-agent',  subtitle: 'ツール統合の自律エージェント' },
  { key: 'email',     label: 'メールトリアージ',         emoji: '📬', iconKey: 'email',       subtitle: '受信箱を AI で仕分け' },
  { key: 'premium',   label: 'プレミアム Hub',           emoji: '👑', iconKey: 'premium',     subtitle: '上位プランの管理' },
  { key: 'invoice',   label: '請求書スタジオ',           emoji: '🧾', iconKey: 'invoice',     subtitle: '発行・入金管理' },
  { key: 'sales',     label: '売上台帳',                  emoji: '📒', iconKey: 'sales',       subtitle: '日次の売上を記録' },
  { key: 'expense',   label: '経費 / OCR',               emoji: '📷', iconKey: 'expense',     subtitle: 'レシートを撮って計上' },
  { key: 'pnl',       label: 'P&L 損益計算書',           emoji: '📊', iconKey: 'pnl',         subtitle: '今月の損益を見る' },
  { key: 'finConsult', label: '財務コンサルタント',        emoji: '🧮', iconKey: 'fin-consult', subtitle: 'AI に数字を相談' },
  { key: 'crm',       label: 'CRM パイプライン',          emoji: '🗂', iconKey: 'crm',         subtitle: '案件の進捗を管理' },
  { key: 'documents', label: '書類スタジオ',              emoji: '📄', iconKey: 'documents',   subtitle: '契約書・提案書を作る' },
  { key: 'people',    label: '人物カルテ / 1on1',         emoji: '👥', iconKey: 'people',      subtitle: '関係者を記録' },
  { key: 'meeting',   label: '会議リンク',                emoji: '📅', iconKey: 'meet',        subtitle: '会議スケジュール' },
];

// クイック作成
const QUICK_CREATE: { modal: ModalKey; label: string; emoji: string; iconKey: string; subtitle: string }[] = [
  { modal: 'tasks',     label: '+ 新規タスク',          emoji: '✅', iconKey: 'tasks-hub', subtitle: 'タスクハブを開いて追加' },
  { modal: 'invoice',   label: '+ 新規請求書',          emoji: '🧾', iconKey: 'invoice',   subtitle: '請求書スタジオで発行' },
  { modal: 'knowledge', label: '+ 新規ナレッジメモ',     emoji: '📚', iconKey: 'kb',        subtitle: 'メモを追加' },
  { modal: 'people',    label: '+ 新規人物',            emoji: '👥', iconKey: 'people',    subtitle: '人物カルテに登録' },
  { modal: 'expense',   label: '+ 新規経費',            emoji: '📷', iconKey: 'expense',   subtitle: 'レシートを追加' },
  { modal: 'crm',       label: '+ 新規案件',            emoji: '🗂', iconKey: 'crm',       subtitle: 'CRM に案件を作る' },
  { modal: 'post',      label: '+ 新規投稿',            emoji: '📢', iconKey: 'post',      subtitle: '投稿を下書き' },
  { modal: 'documents', label: '+ 新規書類',            emoji: '📄', iconKey: 'documents', subtitle: '契約書/提案書を作成' },
  { modal: 'decision',  label: '+ 新規意思決定メモ',     emoji: '💭', iconKey: 'decision',  subtitle: '判断を残す' },
  { modal: 'minutes',   label: '+ 新規議事録',          emoji: '🎩', iconKey: 'minutes',   subtitle: '会議を要約する' },
];

// ────────────────────────────────────────────────────────────
// 機能ではない行 (データ操作・ヘルプ・ファイル種別) のアイコン台帳。
// 機能タイルの台帳 (featureIcons.ts) には無い行なので、ここで面倒を見る。
// 目的は同じ = 端末によって絵が変わる OS 標準の絵文字をやめ、
// 「どの端末で見ても同じ絵」にする (しょぼい絵文字を使わない 恒久ルール)。
// 色は「何が起きるか」で選ぶ: 灰=見るだけ / 緑=始まる / 橙=止まる・戻る。
// ────────────────────────────────────────────────────────────
const UTIL_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  'stripe-sync': { Icon: CreditCard,  color: '#635BFF' }, // Stripe ブランド紫
  'demo-start':  { Icon: Play,        color: '#10B981' },
  'demo-end':    { Icon: Square,      color: '#FFA94D' },
  reload:        { Icon: RefreshCw,   color: '#5BA8FF' },
  'guided-tour': { Icon: Compass,     color: '#10B981' }, // 緑 = ここから始まる
  sitemap:       { Icon: MapIcon,     color: '#5BA8FF' },
  history:       { Icon: History,     color: '#9088A8' },
  'api-keys':    { Icon: KeyRound,    color: '#FACC15' },
  settings:      { Icon: SettingsIcon, color: '#9CA3AF' },
  theme:         { Icon: SunMoon,     color: '#A78BFA' },
  // ナレッジの中身 (画像 / PDF / それ以外) も絵文字をやめる
  'file-image':  { Icon: FileImage,   color: '#C084FC' },
  'file-pdf':    { Icon: FileType2,   color: '#FF5C5C' },
  'file-doc':    { Icon: FileText,    color: '#5BA8FF' },
};

/** 台帳 (機能 → 汎用) の順に引く。どちらにも無ければ undefined = 絵文字のまま */
function resolveRowIcon(key?: string): { Icon: LucideIcon; color: string } | undefined {
  if (!key) return undefined;
  return resolveFeatureIcon(key) || UTIL_ICONS[key];
}

/**
 * ⌘K の 1 行の左側に出す絵。優先順は
 *   1. 台帳のアイコン (濃い色の角丸 + 白いアイコン ← タイル・からっぽ画面と完全に同じ見た目)
 *   2. 人格グリフ
 *   3. 従来の絵文字 (台帳に無い行の保険)
 * 明るいテーマでも暗いテーマでも白いアイコンが必ず読める (文字コントラスト恒久ルール)。
 */
function RowGlyph({ item, size }: { item: CmdAction; size: number }) {
  const key = 'iconKey' in item ? item.iconKey : undefined;
  const reg = resolveRowIcon(key);
  if (reg) {
    const box = size + 12;
    return (
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: box, height: box, borderRadius: Math.round(box * 0.3),
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, ${reg.color}, ${reg.color}cc)`,
          boxShadow: `0 2px 8px ${reg.color}33, inset 0 1px 0 rgba(255,255,255,0.18)`,
        }}
      >
        <reg.Icon size={size} color="#fff" strokeWidth={2} />
      </span>
    );
  }
  if (isRoleCode(item.emoji)) {
    return <PersonaGlyph icon={item.emoji} size={size} color="currentColor" />;
  }
  return <span style={{ flexShrink: 0, fontSize: size * 1.05, lineHeight: 1 }}>{item.emoji}</span>;
}

// ────────────────────────────────────────────────────────────
// 最近使った
// ────────────────────────────────────────────────────────────
const RECENT_KEY = 'core_cmd_palette_recent_v1';
const RECENT_MAX = 10;

interface RecentEntry {
  id: string; // action id (kind 別に一意化)
  ts: number;
  count?: number; // 使用回数（学習する初期表示＝よく使う順に並べるため）
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

// ────────────────────────────────────────────────────────────
// よく使う依頼 (AI 依頼の自動保存)
//
// ★なぜ (2026-07-26): AI 依頼 (ai-delegate) は prompt が毎回違うため recent から
//   意図的に除外されていた。結果、同じ依頼を毎回ゼロから打ち直す状態だった。
//   ここでは prompt そのものを鍵にして別枠で保存し、2 回目以降を「入力ゼロ・
//   1 タップ」にする。保存が 0 件の人には何も見せない (空カードを出さない)。
// ────────────────────────────────────────────────────────────
const SAVED_KEY = 'core_cmd_saved_prompts_v1';
const SAVED_MAX = 8;
/** 誤爆保存を防ぐ最短文字数。1〜2 文字の打ち間違いは残さない。 */
const SAVED_MIN_LEN = 4;

interface SavedPrompt {
  prompt: string;
  ts: number;
  count: number;
  /** @で指した対象 (2026-07-27)。保存するのは対象の ID だけ = 再実行時に最新データを読み直す。 */
  mentionId?: string;
}

/** 同じ依頼でも「見る対象」が違えば別物として保存する */
function savedKey(prompt: string, mentionId?: string): string {
  return (mentionId ? mentionId + '|' : '') + prompt;
}

function loadSavedPrompts(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // 壊れた要素が 1 つ混ざっても全体を捨てない (沈黙して全消えを防ぐ)
    return arr
      .filter((x: any) => x && typeof x.prompt === 'string' && x.prompt.trim())
      .map((x: any) => ({
        prompt: String(x.prompt),
        ts: Number(x.ts) || 0,
        count: Number(x.count) || 1,
        mentionId: typeof x.mentionId === 'string' && x.mentionId ? String(x.mentionId) : undefined,
      }))
      .slice(0, SAVED_MAX);
  } catch { return []; }
}

function saveSavedPrompts(list: SavedPrompt[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, SAVED_MAX))); } catch { /* 保存できなくても操作は続行 */ }
}

/**
 * 実行した依頼を先頭へ。同じ依頼なら回数だけ増やす。
 * ★あふれた時は「一番古い」ではなく「一番使っていない」を落とす。
 *   単純に末尾を切ると、たまたま単発の依頼が続いただけで、毎週使う依頼が
 *   押し出されて消える (= よく使う依頼が消える) ため。
 */
function recordSavedPrompt(list: SavedPrompt[], prompt: string, mentionId?: string): SavedPrompt[] {
  const p = prompt.trim();
  if (p.length < SAVED_MIN_LEN) return list;
  const key = savedKey(p, mentionId);
  const prev = list.find(s => savedKey(s.prompt, s.mentionId) === key);
  const merged: SavedPrompt[] = [
    { prompt: p, mentionId, ts: Date.now(), count: (prev?.count ?? 0) + 1 },
    ...list.filter(s => savedKey(s.prompt, s.mentionId) !== key),
  ];
  if (merged.length <= SAVED_MAX) return merged;
  const keep = new Set(
    [...merged]
      .sort((a, b) => b.count - a.count || b.ts - a.ts)
      .slice(0, SAVED_MAX)
      .map(s => savedKey(s.prompt, s.mentionId)),
  );
  return merged.filter(s => keep.has(savedKey(s.prompt, s.mentionId)));
}

// ────────────────────────────────────────────────────────
// 読みがなの作り置き (2026-09-02)
//
// 打つたびに全項目ぶん作り直すと辞書の置換が何百回も走るので、
// 同じ文字列は 1 度だけ作って使い回す。項目のラベルは変わらないので
// 上限を超えたら丸ごと捨てるだけで足りる (ナレッジ 1000 件でも 1 回)。
// ────────────────────────────────────────────────────────
const READING_CACHE = new Map<string, string>();
const READING_CACHE_MAX = 2000;
function readingOf(text: string): string {
  const hit = READING_CACHE.get(text);
  if (hit !== undefined) return hit;
  const made = toReading(text);
  if (READING_CACHE.size >= READING_CACHE_MAX) READING_CACHE.clear();
  READING_CACHE.set(text, made);
  return made;
}

function actionId(item: CmdAction): string {
  switch (item.kind) {
    case 'open-modal':     return 'modal:' + item.modal;
    case 'switch-persona': return 'persona:' + item.personaId;
    case 'jump-knowledge': return 'knowledge:' + item.knowledgeId;
    case 'jump-task':      return 'task:' + item.taskId;
    case 'quick-create':   return 'create:' + item.modal;
    case 'cxo':            return 'cxo:' + item.cxo;
    case 'ai-delegate':    return 'ai:' + (item.mentionId ? item.mentionId + '|' : '') + item.prompt;
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
  /** 「ほかに◯件あります・すべて見る」を押して、全部出した区分 */
  const [expandedCats, setExpandedCats] = useState<Set<CategoryKey>>(new Set());
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(loadSavedPrompts);
  /** 消した直後の 1 件。「元に戻す」で復活させる (取り消せない削除を作らない)。 */
  const [undoSaved, setUndoSaved] = useState<SavedPrompt | null>(null);
  /** @で指した対象。ここが埋まっている間、AI はこの対象の実データだけを見る。 */
  const [mention, setMention] = useState<MentionTarget | null>(null);
  /** 実データを読んでいる間 (押しっぱなしの二重実行を防ぐ) */
  const [mentionBusy, setMentionBusy] = useState(false);
  /**
   * ★2026-08-12: 依頼の「答え」をこのパレットの中で見せる (Raycast の浮かぶ窓)。
   * これが無い間、ひとこと訊くたびにパレットが閉じて役員の画面へ飛ばされていた
   * = 見ていた画面を失うので、訊くこと自体をためらう。
   * ここに taskId を入れている間だけ、リストの代わりに答えの札を出す。
   */
  const [inlineTaskId, setInlineTaskId] = useState<string | null>(null);
  /** 答えの札に出す「AI が実際に何を読んだか」(実測値のまま・盛らない) */
  const [inlineNote, setInlineNote] = useState<string | null>(null);
  /**
   * ★2026-08-14: AI に頼まない用事の答えも、ここに出して画面を移らせない。
   * 資料を 1 件読む / 変更の記録を 1 件読む / 提案の採用を切り替える —— どれも
   * これまでは `onClose()` で見ていた画面ごと飛ばしていた (資料に至っては全文を
   * 読むためだけにナレッジ画面へ移動が要った)。場所へ行く用事だけを移動に残す。
   */
  const [inlineResult, setInlineResult] = useState<InlineCommandResult | null>(null);
  /**
   * 提案の状態を変えた回数。一覧の ✅/⌛ は組み立て時の値を持っているので、
   * これを増やして引き直さないと、変えた直後に戻った一覧が古い印を出し続ける
   * (＝押しても変わっていないように見える)。
   */
  const [suggestionTick, setSuggestionTick] = useState(0);
  // MMMMMM (2026-06-04): changelog.json から 直近 新機能 5 件
  const [changelogFeats, setChangelogFeats] = useState<Array<{ hash: string; date: string; message: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const queue = useAgentTaskQueue();

  // 開き直したら「元に戻す」の帯は畳む (古い取り消しが残り続けないように)
  // @の対象も毎回まっさらに戻す (前回の対象が残っていて意図しない範囲で実行される事故を防ぐ)
  useEffect(() => { if (open) { setUndoSaved(null); setMention(null); setMentionBusy(false); setInlineTaskId(null); setInlineNote(null); setInlineResult(null); } }, [open]);

  /** 答えを出している依頼。queue.tasks の実体を毎回引き直す (2 か所で持たない) */
  const inlineTask = useMemo(
    () => (inlineTaskId ? queue.tasks.find(t => t.id === inlineTaskId) ?? null : null),
    [inlineTaskId, queue.tasks]
  );
  /** 答えの本文 = 最後に終わったステップが実際に返した文。無い間は null (作らない)。 */
  const answerText = useMemo(() => {
    if (!inlineTask) return null;
    const done = inlineTask.steps.filter(s => s.status === 'done' && s.output);
    return done.length > 0 ? (done[done.length - 1].output as string) : null;
  }, [inlineTask]);

  // MMMMMM: open 時に changelog.json を 1 度だけ 取得 (キャッシュ可)
  useEffect(() => {
    if (!open) return;
    if (changelogFeats.length > 0) return;
    let cancelled = false;
    fetch('/changelog.json', { cache: 'force-cache' })
      .then((r) => r.ok ? r.json() : null)
      .then((j: any) => {
        if (cancelled || !j) return;
        // 「✨ 新機能」 or "feat" prefix を 上位 5 件
        const all: Array<{ hash: string; date: string; message: string }> = [];
        for (const s of (j.sections || [])) {
          for (const it of (s.items || [])) {
            if (/✨|^feat/i.test(s.category) || /^feat(\(|:)/.test(it.message || '')) {
              all.push(it);
            }
          }
        }
        // 日付降順 → message dedup
        const seen = new Set<string>();
        const top = [];
        for (const it of all.sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
          if (seen.has(it.message)) continue;
          seen.add(it.message);
          top.push(it);
          if (top.length >= 5) break;
        }
        if (!cancelled) setChangelogFeats(top);
      })
      .catch(() => { /* */ });
    return () => { cancelled = true; };
  }, [open, changelogFeats.length]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setActiveTab('all');
      setExpandedCats(new Set());
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
    // 答えはこのパレットの中で出す (画面を移らない)。トーストは出さない = 同じ報せを 2 か所で出さない。
    setInlineNote(null);
    setInlineTaskId(task.id);
  }, [queue]);

  // ────────────────────────────────────────────────────────
  // AI 自然言語依頼 (どの CXO が動くかは CEO が判断)
  // ────────────────────────────────────────────────────────
  const delegateToAi = useCallback(async (prompt: string, target?: MentionTarget | null): Promise<boolean> => {
    const trimmed = prompt.trim();
    if (!trimmed) return false;

    // ★@で対象を指している時は、先に実データを読む。
    //   読めなければ「それらしい一般論」を作らせず、理由を出して止める (silent fail 禁止)。
    let ctx: { text: string; note: string } | null = null;
    if (target) {
      setMentionBusy(true);
      try {
        ctx = await buildMentionContext(target, knowledge);
      } catch (e) {
        setMentionBusy(false);
        notifyInApp({
          kind: 'warn',
          title: `${target.label} を読めませんでした`,
          body: mentionErrorMessage(e),
          duration: 6000,
        });
        return false;
      }
      setMentionBusy(false);
    }

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
    // 文面から担当が決まらなかった時だけ、指した対象をヒントに使う
    else if (target) {
      if (target.kind === 'revenue') cxo = 'CFO';
      else if (target.kind === 'mail' || target.kind === 'calendar') cxo = 'COO';
    }

    const task = queue.propose({
      title: `AI 依頼: ${trimmed.slice(0, 40)}${trimmed.length > 40 ? '…' : ''}`,
      summary: target ? `${trimmed}\n(対象: ${target.label})` : trimmed,
      why: target ? `Cmd+K で ${target.label} を指しての依頼` : 'Cmd+K の自然言語入力から',
      expected: '1 文の実行結果',
      dueDays: 1,
      steps: [
        { cxo: 'CEO', label: '依頼内容を解釈し担当を決定' },
        { cxo, label: trimmed.slice(0, 60) },
      ],
      contextText: ctx?.text,
      contextLabel: target?.label,
    });
    queue.approve(task.id);
    // 答えはこのパレットの中で出す。何を読んだか (ctx.note) も実測値のまま札に出す。
    setInlineNote(ctx?.note ?? null);
    setInlineTaskId(task.id);
    return true;
  }, [queue, knowledge]);

  // ────────────────────────────────────────────────────────
  // 全候補をビルド
  // ────────────────────────────────────────────────────────
  const allItems = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const out: Array<{ item: CmdAction; category: CategoryKey }> = [];

    // ナビ
    for (const m of MODAL_LIST) {
      out.push({
        category: 'nav',
        item: { kind: 'open-modal', modal: m.key, label: m.label, emoji: m.emoji, iconKey: m.iconKey, subtitle: m.subtitle },
      });
    }

    // ナビ — App 側にしか状態が無い3つ (成果物 / 統合脳 / 役員日報)。
    // 2026-08-13 まで、この3つの入口は右下の名前の無い「＋」ただ1つで、
    // ここ (コマンドバー) にも ☰ にも載っていなかった＝名前で探しても出てこなかった。
    // onOpenModal は ModalKey しか受け取れないので、App が購読しているイベントで開く。
    const APP_TOOLS: { id: string; tool: string; label: string; subtitle: string; emoji: string; iconKey: string }[] = [
      { id: 'tool-artifact', tool: 'artifact', label: '成果物（AI が作ったもの）', subtitle: '書いた文章・資料をまとめて見る', emoji: '📄', iconKey: 'documents' },
      { id: 'tool-brain',    tool: 'brain',    label: '統合脳（覚えた資料の全体像）', subtitle: '読ませた資料のつながりを見る', emoji: '🧠', iconKey: 'kb' },
      { id: 'tool-briefings', tool: 'briefings', label: '役員の日報', subtitle: 'AI 役員が今日やったことの報告', emoji: '📋', iconKey: 'briefing' },
    ];
    for (const t of APP_TOOLS) {
      out.push({
        category: 'nav',
        item: {
          kind: 'custom', id: t.id, label: t.label, subtitle: t.subtitle, emoji: t.emoji, iconKey: t.iconKey,
          onRun: () => { window.dispatchEvent(new CustomEvent('core:open-tool', { detail: { tool: t.tool } })); },
        },
      });
    }

    // 新規作成
    for (const c of QUICK_CREATE) {
      out.push({
        category: 'create',
        item: { kind: 'quick-create', modal: c.modal, label: c.label, emoji: c.emoji, iconKey: c.iconKey, subtitle: c.subtitle },
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
    const handleStripeSync = (): InlineCommandResult => {
      // useStripeRevenue / MyBusinessRevenueCard が購読している接続イベントを再発火
      try { window.dispatchEvent(new CustomEvent('core:stripe-connected')); } catch { /* */ }
      notifyInApp({ kind: 'info', title: '💳 Stripe を再同期しました', body: '最新の取引を取得中…', duration: 2200 });
      // 取れた件数も金額もここでは分からない。分からないことは分からないと書く
      // (「◯件 取り込みました」と書けば嘘になる)。
      return {
        id: 'data-op:stripe-sync',
        title: 'Stripe に、新しい取引を取りに行きました',
        meta: '取り込みは裏で進みます',
        emptyReason: '取り込めた件数は、この札では分かりません。売上台帳の数字で確かめられます。',
        open: { label: '売上台帳を開く', run: () => { onClose(); onOpenModal('sales'); } },
      };
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
    const dataOps: Array<{ id: string; label: string; subtitle: string; emoji: string; stay?: true; onRun: () => void | InlineCommandResult }> = [
      { id: 'stripe-sync', label: 'Stripe を再同期', subtitle: '今月の売上を最新化', emoji: '💳', stay: true, onRun: handleStripeSync },
      { id: 'demo-start', label: 'デモを開始', subtitle: 'デモデータで体験する', emoji: '▶️', onRun: handleDemoStart },
      { id: 'demo-end', label: isDemoActive() ? 'デモを終了' : 'デモを終了 (現在オフ)', subtitle: 'デモデータを片付ける', emoji: '⏹', onRun: handleDemoEnd },
      { id: 'reload', label: 'ページを再読み込み', subtitle: '最新の状態を取得', emoji: '🔁', onRun: () => window.location.reload() },
    ];
    for (const d of dataOps) {
      // id と UTIL_ICONS の鍵は同じ = そのまま絵と色が決まる
      out.push({ category: 'data', item: { kind: 'data-op', ...d, iconKey: d.id } });
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

    // ナレッジ (全件。画面に並べる数だけ commandCap.ts で畳む = 検索からは1件も落とさない)
    for (const k of personaKnowledge) {
      out.push({
        category: 'knowledge',
        item: {
          kind: 'jump-knowledge',
          knowledgeId: k.id,
          label: k.title,
          subtitle: `${k.fileKind || 'note'}${k.tags.length > 0 ? ' · ' + k.tags.slice(0, 2).join(', ') : ''}`,
          emoji: k.fileKind === 'image' ? '🖼' : k.fileKind === 'pdf' ? '📑' : '📄',
          iconKey: k.fileKind === 'image' ? 'file-image' : k.fileKind === 'pdf' ? 'file-pdf' : 'file-doc',
        },
      });
    }

    // タスク
    if (activePersona) {
      for (const t of activePersona.tasks.filter(t => !t.done)) {
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

    // MMMMMM (2026-06-04): 最近の 新機能 を Cmd+K に (上位 5 件)
    for (const f of changelogFeats) {
      out.push({
        category: 'changelog',
        item: {
          kind: 'custom',
          id: `feat-${f.hash}`,
          label: f.message.replace(/^feat(\([^)]*\))?:\s*/, '✨ '),
          subtitle: `${f.date} · ${f.hash} — タップで中身を読む`,
          emoji: '✨',
          // 2026-08-14: ここは `window.location.href` でページごと読み込み直していた。
          // 「何が新しくなったか」を 1 行読むためだけに、開いていた画面も入力中の文字も全部失う。
          // 一覧では長い題が切れて読めないので、その場で全文を出すほうが用は足りる。
          stay: true,
          onRun: (): InlineCommandResult => ({
            id: `changelog:${f.hash}`,
            title: f.message.replace(/^feat(\([^)]*\))?:\s*/, ''),
            meta: `${f.date} · ${f.hash}`,
            open: { label: '変更の記録をぜんぶ見る', run: () => { window.location.href = `/changelog#${f.hash}`; } },
          }),
        },
      });
    }

    // WWWWW (2026-06-04): 最近の AI 提案 を Cmd+K でも 横断検索 (最大 5 件)
    try {
      const recent: SuggestionEntry[] = listSuggestions().slice(0, 5);
      for (const s of recent) {
        const statusEmoji = s.status === 'adopted' ? '✅' : s.status === 'rejected' ? '❌' : s.status === 'held' ? '⏸' : '⌛';
        const subtitle = `${s.cxoName} · ${statusEmoji} ${s.status} · ${new Date(s.ts).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        // 2026-08-14: これは「採用 ⇄ 未判定」を切り替えるだけの用事なのに、
        // 押すたびにパレットが閉じて見ていた画面を失っていた (行き先がそもそも無い操作)。
        // 閉じずに、切り替わった結果と提案の詳細をその場に出す。
        const toggleAdopted = (): InlineCommandResult => {
          // ★2026-08-19: 一覧を組み立てた時の `s.status` は古いことがある
          //   (同じ札で 2 回押す・別の画面で先に変えた)。古い値を元に決めると
          //   2 回目が同じ側へ倒れて、押しても何も起きない札になる。
          //   だから押した瞬間に、保存されている実際の値を読み直してから決める。
          const before = listSuggestions().find(x => x.id === s.id);
          const wanted = nextSuggestionStatus(before?.status ?? s.status);
          try { setSuggestionStatus(s.id, wanted); } catch { /* 下で読み直して判定する */ }
          // 書けたかどうかは例外の有無では分からない (setStatus は id が無くても
          // 入れ物がいっぱいでも、何も言わずに帰る)。もう一度読んで実測する。
          const after = listSuggestions().find(x => x.id === s.id);
          setSuggestionTick(t => t + 1); // 一覧の ✅/⌛ も、変わった実際の値へ引き直す
          return buildSuggestionResult({
            suggestion: { id: s.id, title: s.title, detail: before?.detail ?? s.detail, cxoName: s.cxoName },
            wanted,
            after: after?.status,
            open: { label: 'AI 提案の履歴を開く', run: () => { onClose(); openAiHistory(); } },
          });
        };
        out.push({
          category: 'suggestion',
          item: {
            kind: 'custom',
            id: `sug-${s.id}`,
            label: `${s.cxoEmoji} ${s.title}`,
            subtitle,
            emoji: '🕘',
            stay: true,
            onRun: toggleAdopted,
          },
        });
      }
    } catch { /* */ }

    const helpItems: Array<{ id: string; label: string; subtitle: string; emoji: string; stay?: true; onRun: () => void | InlineCommandResult }> = [
      // 使い方の案内 (GuidedTourSpotlight)。ここが唯一の入口 —
      // 自動起動は「うざい」とのオーナー指示で廃止済みなので、呼べる場所が無いと
      // 案内そのものが誰にも届かない状態になる (2026-08-04 に発見して復旧)。
      {
        id: 'guided-tour',
        label: '使い方を案内してもらう',
        subtitle: '画面の上で「ここをタップ」と順に教えます。途中でやめられます（はじめての人向けの案内ツアー）',
        emoji: '🧭',
        onRun: () => {
          const brand = (window.location.pathname.startsWith('/iris') || window.location.search.includes('brand=iris'))
            ? 'iris' : 'prism';
          window.dispatchEvent(new CustomEvent('core:start-guided-tour', { detail: { brand } }));
        },
      },
      { id: 'sitemap',  label: '全機能マップ', subtitle: '全ページ / 全機能 を 1 画面で (Cmd+Shift+/)', emoji: '🗺️', onRun: openSitemapPalette },
      { id: 'history',  label: 'AI 提案 履歴 (7 日)', subtitle: '採用 / 却下 / 採用率 (Cmd+Shift+H)', emoji: '🕘', onRun: openAiHistory },
      { id: 'api-keys', label: 'API キー設定', subtitle: 'OpenAI / Stripe などの接続', emoji: '🔑', onRun: () => onOpenModal('settings') },
      { id: 'settings', label: '設定を開く', subtitle: 'すべての設定 (5 タブ + 検索)', emoji: '⚙️', onRun: () => onOpenModal('settings') },
      // テーマは切り替えた結果が画面そのものに出る = 札は要らない。閉じないことだけが要る
      // (これまでは明るさを変えるたびにパレットが閉じて、見比べるのに開き直していた)。
      { id: 'theme', label: 'テーマ切替', subtitle: 'ライト / ダーク', emoji: '🌓', stay: true, onRun: handleThemeToggle },
    ];
    for (const h of helpItems) {
      out.push({ category: 'help', item: { kind: 'help', ...h, iconKey: h.id } });
    }

    return out;
  }, [personas, personaKnowledge, activePersona, activePersonaId, onOpenModal, onClose, changelogFeats, suggestionTick]);

  // ────────────────────────────────────────────────────────
  // 最近使った (recent) を解決
  // ────────────────────────────────────────────────────────
  /**
   * action id → 使った回数。打った時の並び順に効かせるためだけに使う
   * (2026-08-31)。`recent` が既に持っている数字をそのまま読む
   * = 新しい保存先ゼロ・追加の読み込みゼロ。
   */
  const countById = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recent) m.set(r.id, r.count ?? 0);
    return m;
  }, [recent]);

  const recentItems = useMemo<CmdAction[]>(() => {
    const byId = new Map<string, CmdAction>();
    for (const { item } of allItems) byId.set(actionId(item), item);
    // ★学習する初期表示：よく使う順（count降順）→同数なら最近使った順（ts降順）。
    return [...recent]
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || b.ts - a.ts)
      .map(r => byId.get(r.id))
      .filter((x): x is CmdAction => Boolean(x))
      .slice(0, 10);
  }, [allItems, recent]);

  // ────────────────────────────────────────────────────────
  // よく使う依頼 → そのまま実行できる候補に変換
  // ────────────────────────────────────────────────────────
  const savedItems = useMemo<CmdAction[]>(() => {
    return [...savedPrompts]
      .sort((a, b) => b.count - a.count || b.ts - a.ts)
      .map((s): CmdAction => {
        // 保存しているのは対象の ID だけ = 再実行のたびに最新データを読み直す
        const t = s.mentionId ? resolveMentionTarget(s.mentionId, knowledge) : null;
        return {
          kind: 'ai-delegate',
          prompt: s.prompt,
          mentionId: t ? s.mentionId : undefined, // 対象が消えた/接続が切れた時は対象なしに落とす
          label: (t ? t.label + ' ' : '') + (s.prompt.length > 60 ? s.prompt.slice(0, 60) + '…' : s.prompt),
          // 回数は実測値のみ。1 回目は「1 回使いました」と正直に出す (数字を盛らない)
          subtitle: t
            ? `${s.count} 回使いました・${t.label} の最新データを読んで実行`
            : `${s.count} 回使いました・タップでもう一度 AI に依頼`,
          emoji: '🪄',
        };
      });
  }, [savedPrompts, knowledge]);

  // ────────────────────────────────────────────────────────
  // @ で対象を指す
  //
  // 「@」を打った直後 (まだ空白を打っていない) だけ対象ピッカーに切り替える。
  // 繋がっていない連携は listMentionTargets が最初から返さない = 偽の器を出さない。
  // ────────────────────────────────────────────────────────
  const mentionQuery = useMemo<string | null>(() => {
    if (mention) return null; // すでに 1 つ指している間は普通の検索に戻す
    const m = /(?:^|\s)@([^\s@]*)$/.exec(query);
    return m ? m[1] : null;
  }, [query, mention]);

  const mentionCandidates = useMemo<MentionTarget[]>(() => {
    if (mentionQuery === null) return [];
    return listMentionTargets(personaKnowledge, mentionQuery);
  }, [mentionQuery, personaKnowledge]);

  /** @ ボタンを出すかどうか (指せる対象が 1 つも無い人には出さない) */
  const hasMentionTargets = useMemo(
    () => listMentionTargets(personaKnowledge).length > 0,
    [personaKnowledge],
  );

  /** 対象を確定し、入力欄からは「@…」の断片を消す (チップに置き換わる) */
  const pickMention = useCallback((t: MentionTarget) => {
    setMention(t);
    setQuery(q => q.replace(/(?:^|\s)@[^\s@]*$/, (m) => (m.startsWith(' ') ? ' ' : '')));
    setSelectedIdx(0);
    inputRef.current?.focus();
  }, []);

  // ────────────────────────────────────────────────────────
  // フィルタリング (ファジー、複数語 AND)
  // ────────────────────────────────────────────────────────
  const filtered = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const q = query.trim().toLowerCase();
    // クエリ空 → 最近 + 全件 (重複除去)
    if (!q) {
      const result: Array<{ item: CmdAction; category: CategoryKey }> = [];
      const seen = new Set<string>();
      // ★入力ゼロで「前にやった依頼」が最上段に並ぶ = 2 回目以降が 1 タップ
      if (activeTab === 'all' || activeTab === 'saved') {
        for (const s of savedItems) {
          const id = actionId(s);
          if (seen.has(id)) continue;
          seen.add(id);
          result.push({ item: s, category: 'saved' });
        }
      }
      if (activeTab === 'saved') return result;
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
    // 保存した依頼は「打ち直さずに拾える」ことが価値なので、部分一致したら先頭に出す
    const savedHits: Array<{ item: CmdAction; category: CategoryKey }> = [];
    if (activeTab === 'all' || activeTab === 'saved') {
      for (const s of savedItems) {
        const hay = ('prompt' in s ? s.prompt : s.label).toLowerCase();
        if (parts.every(p => hay.includes(p))) savedHits.push({ item: s, category: 'saved' });
      }
    }
    if (activeTab === 'saved') return savedHits;
    const scored: Array<{ entry: { item: CmdAction; category: CategoryKey }; score: number; count: number }> = [];
    for (const entry of allItems) {
      if (activeTab !== 'all' && entry.category !== activeTab) continue;
      const item = entry.item;
      // スコア: 先頭一致 +10, ラベル一致 +5, それ以外 +1, + 使った回数 (上限 4)
      // 上限 4 は「先頭一致が何回使われた相手にも抜かれない」ための数字 (src/lib/commandScore.ts)
      const count = countById.get(actionId(item)) ?? 0;
      const sub = 'subtitle' in item && item.subtitle ? item.subtitle : undefined;
      const score = rankScore(
        item.label,
        sub,
        parts,
        count,
        // かなで打っている間も当たるように読みがなを渡す (src/lib/commandReading.ts)
        readingOf(item.label + ' ' + (sub ?? '')),
      );
      if (score === null) continue;
      scored.push({ entry, score, count });
    }
    scored.sort(compareRanked);
    const savedIds = new Set(savedHits.map(h => actionId(h.item)));
    return [...savedHits, ...scored.map(s => s.entry).filter(e => !savedIds.has(actionId(e.item)))];
  }, [allItems, recentItems, savedItems, query, activeTab, countById]);

  // ────────────────────────────────────────────────────────
  // 画面に並べる数だけ畳む (検索の対象は上の filtered = 全件のまま)
  //
  // 隠した件数は必ず数えて画面に出す。ここで数えたものが
  // 「ほかに◯件あります・すべて見る」になる = 黙って切らない。
  // ────────────────────────────────────────────────────────
  const capped = useMemo(
    // 打っている時は段ごと 3 件 (SEARCH_CAP)、眺めている時は今までどおり (BROWSE_CAP)。
    () => capByCategory(filtered, e => e.category, query.trim() ? SEARCH_CAP : BROWSE_CAP, expandedCats),
    [filtered, expandedCats, query],
  );

  // クエリにマッチが無い (または少ない) 時、AI 依頼候補を末尾に追加
  const filteredWithAi = useMemo<Array<{ item: CmdAction; category: CategoryKey }>>(() => {
    const q = query.trim();
    if (!q) return capped.list;
    const aiEntry: { item: CmdAction; category: CategoryKey } = {
      category: 'ai',
      item: {
        kind: 'ai-delegate',
        prompt: q,
        mentionId: mention?.id,
        label: mention
          ? `${mention.label} を見て: "${q.slice(0, 40)}${q.length > 40 ? '…' : ''}"`
          : `AI に依頼する: "${q.slice(0, 50)}${q.length > 50 ? '…' : ''}"`,
        subtitle: mention
          ? `${mention.hint} (Cmd+Enter)`
          : '担当 CXO が自動で動きます (Cmd+Enter)',
        emoji: '🪄',
      },
    };
    // すでに同じ ID があれば追加しない
    if (capped.list.some(f => actionId(f.item) === actionId(aiEntry.item))) return capped.list;
    // 対象を指している間は「その対象に頼む」が主目的なので最上段に置く
    return mention ? [aiEntry, ...capped.list] : [...capped.list, aiEntry];
  }, [capped, query, mention]);

  // ────────────────────────────────────────────────────────
  // 0 件時の「もしかして」候補 (bigram 重なりスコア)
  // ────────────────────────────────────────────────────────
  const fuzzySuggestions = useMemo<CmdAction[]>(() => {
    const q = query.trim();
    if (!q || filtered.length > 0) return [];

    const scored: Array<{ item: CmdAction; score: number }> = [];
    const seen = new Set<string>();
    for (const { item } of allItems) {
      // jump-knowledge / jump-task / persona は数が多すぎて雑音になるので除外
      if (item.kind === 'jump-knowledge' || item.kind === 'jump-task' || item.kind === 'switch-persona') continue;
      const id = actionId(item);
      if (seen.has(id)) continue;
      const hay = item.label + ' ' + ('subtitle' in item && item.subtitle ? item.subtitle : '');
      // 2 文字以上つながって重なった時だけ候補にする (見当違いを出さない = src/lib/commandFuzzy.ts)
      // かなの打ち間違い (せいきゆうしょ) も拾えるよう読みがなも渡す
      const score = fuzzyScore(q, hay, readingOf(hay));
      if (score >= FUZZY_MIN_SCORE) {
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
    // 対象ピッカー中は候補数、それ以外は結果数で頭打ちにする (選択が枠外に飛ばないように)
    const len = mentionQuery !== null ? mentionCandidates.length : filteredWithAi.length;
    if (selectedIdx >= len) setSelectedIdx(Math.max(0, len - 1));
  }, [filteredWithAi.length, mentionCandidates.length, mentionQuery, selectedIdx]);

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
    // AI 依頼は prompt そのものを鍵にして「よく使う依頼」へ保存する。
    // (recent は allItems に実体があるコマンドしか復元できないため別枠にする)
    if (item.kind === 'ai-delegate') {
      const nextSaved = recordSavedPrompt(savedPrompts, item.prompt, item.mentionId);
      saveSavedPrompts(nextSaved);
      setSavedPrompts(nextSaved);
      setUndoSaved(null);
    }

    // recent に記録 (ai-delegate は上の「よく使う依頼」で扱う)
    if (item.kind !== 'ai-delegate') {
      const id = actionId(item);
      const prevCount = recent.find(r => r.id === id)?.count ?? 0;
      const next = [{ id, ts: Date.now(), count: prevCount + 1 }, ...recent.filter(r => r.id !== id)].slice(0, RECENT_MAX);
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
      case 'jump-knowledge': {
        // 資料は「読みたいだけ」で選ばれることがほとんど。まずこの場で本文を出し、
        // 直したい人のためにだけ「ナレッジ画面で開く」を札の中に 1 つ置く。
        const jumpToKnowledge = () => {
          onClose();
          onOpenKnowledgeId?.(item.knowledgeId);
          onOpenModal('knowledge');
        };
        const k = knowledge.find(x => x.id === item.knowledgeId);
        // 見つからない時だけ、これまで通り画面へ送る (この場で黙って何も出さない、を作らない)
        if (!k) { jumpToKnowledge(); break; }
        setInlineResult(buildKnowledgeResult(k, { label: 'ナレッジ画面で開く', run: jumpToKnowledge }));
        setTimeout(() => inputRef.current?.focus(), 0);
        break;
      }
      case 'jump-task':
        onClose();
        onOpenModal('tasks');
        break;
      case 'cxo':
        // 閉じない。答えはこのパレットの中に出る (いた場所から動かさない)
        delegateToCxo(item.cxo, item.actionLabel);
        break;
      case 'ai-delegate': {
        const target = item.mentionId ? resolveMentionTarget(item.mentionId, knowledge) : null;
        // 実データを読み終えるまでも、答えが出たあともパレットは開けたまま。
        // 「押したのに何も起きない数秒」を作らず、失敗したら開いたまま直せるようにする。
        void delegateToAi(item.prompt, target);
        break;
      }
      case 'data-op':
      case 'help':
      case 'custom': {
        if (item.stay) {
          // 閉じないと決めた項目。答えが返ればその場で札に出し、返らなければ
          // リストのまま開けておく (テーマ切替のように、結果が画面そのものに出る種類)。
          const res = item.onRun();
          if (res) setInlineResult(res);
          setTimeout(() => inputRef.current?.focus(), 0);
          break;
        }
        onClose();
        item.onRun();
        break;
      }
    }
  }, [recent, savedPrompts, knowledge, onClose, onOpenModal, onSwitchPersona, onOpenKnowledgeId, delegateToCxo, delegateToAi]);

  /**
   * 答えの札を畳んでリストに戻る。
   * まだ動いている途中で畳む時だけ、「まだ続いている・どこで見られるか」を必ず告げる
   * (黙って消すと、押したのに何も起きなかったように見える = 沈黙する失敗)。
   */
  const dismissInline = useCallback(() => {
    if (inlineTask && inlineTask.status === 'running') {
      notifyInApp({
        kind: 'info',
        title: 'AI 会社が続けています',
        body: '札を閉じても実行は止まりません',
        duration: 3000,
      });
    }
    setInlineTaskId(null);
    setInlineNote(null);
    setInlineResult(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [inlineTask]);

  // 保存した依頼を消す / 元に戻す (どちらも 1 タップ・確認ダイアログを挟まない)
  const removeSavedPrompt = useCallback((key: string) => {
    const target = savedPrompts.find(s => savedKey(s.prompt, s.mentionId) === key) || null;
    const next = savedPrompts.filter(s => savedKey(s.prompt, s.mentionId) !== key);
    saveSavedPrompts(next);
    setSavedPrompts(next);
    setUndoSaved(target);
  }, [savedPrompts]);

  const restoreSavedPrompt = useCallback(() => {
    if (!undoSaved) return;
    const undoKey = savedKey(undoSaved.prompt, undoSaved.mentionId);
    const next = [undoSaved, ...savedPrompts.filter(s => savedKey(s.prompt, s.mentionId) !== undoKey)].slice(0, SAVED_MAX);
    saveSavedPrompts(next);
    setSavedPrompts(next);
    setUndoSaved(null);
  }, [undoSaved, savedPrompts]);

  // ────────────────────────────────────────────────────────
  // キーボード
  // ────────────────────────────────────────────────────────
  // 保存が 0 件のうちは「よく使う依頼」タブを出さない (空タブを見せない)
  const TAB_ORDER: Array<CategoryKey | 'all'> = savedItems.length > 0
    ? ['all', 'saved', 'nav', 'create', 'ai', 'data', 'help']
    : ['all', 'nav', 'create', 'ai', 'data', 'help'];

  const picking = mentionQuery !== null && mentionCandidates.length > 0;
  /** 「@」を打っている間 (候補 0 件でも、その事実を正直に出すため画面は切り替える) */
  const mentionMode = mentionQuery !== null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 答えの札を出している間は、そこが主役。上下・決定でリストを触らせない。
    // Esc は「閉じる」ではなく「札を畳んでリストに戻る」= 一気に画面を失わせない。
    if (inlineTaskId || inlineResult) {
      if (e.key === 'Escape') { e.preventDefault(); dismissInline(); return; }
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab') {
        e.preventDefault();
        return;
      }
    }
    // 対象ピッカーを出している間は、そちらの上下・決定を優先する
    if (picking) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(mentionCandidates.length - 1, i + 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); const t = mentionCandidates[selectedIdx]; if (t) pickMention(t); return; }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(filteredWithAi.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(0, i - 1));
    } else if (e.key === 'Backspace' && mention && !query) {
      // 入力が空のまま Backspace → 指した対象を外す (チップの標準的な消し方)
      e.preventDefault();
      setMention(null);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionBusy) return; // 読み込み中の二重実行を防ぐ
      // Cmd+Enter → AI 依頼を強制
      if ((e.metaKey || e.ctrlKey) && query.trim()) {
        void delegateToAi(query, mention);
        return;
      }
      const entry = filteredWithAi[selectedIdx];
      if (entry) runItem(entry.item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // 対象を指している時は、まず対象だけ外す (閉じてやり直しにしない)
      if (mention) { setMention(null); return; }
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

  /**
   * 「見つかりませんでした」画面を出すかどうか。
   *
   * 【なぜ filteredWithAi ではなく filtered で見るのか】(2026-08-30)
   * filteredWithAi は「AI に依頼する」行を必ず 1 本足したあとの一覧なので、
   * 文字を打っている限り必ず 1 件以上ある = flatItems.length === 0 は
   * **打っている間は絶対に成立しなかった**。そのため打ち間違えた人には
   * 細い「AI に依頼する」1 行しか出ず、下の 0 件画面 (もしかして? / 前にやった依頼 /
   * 最近使った / AI に依頼 / デモ) は一度も画面に出ていなかった。
   * AI 行を足す前の filtered で見ることで、書いてあるとおりに出る。
   * (打っていない時に一覧が空 = 今までどおりこの画面が出る)
   */
  const showZeroState = filtered.length === 0;
  /** 画面に並んでいる件数。0 件画面を出している時は「AI に依頼」行を数えない。 */
  const shownCount = showZeroState ? 0 : flatItems.length;

  // ────────────────────────────────────────────────────────
  // カテゴリ アイコン
  // ────────────────────────────────────────────────────────
  const categoryIcon = (c: CategoryKey) => {
    const props = { size: 12, strokeWidth: 2 };
    switch (c) {
      case 'saved':     return <Star {...props} />;
      case 'recent':    return <Clock {...props} />;
      case 'nav':       return <Compass {...props} />;
      case 'create':    return <Plus {...props} />;
      case 'ai':        return <Bot {...props} />;
      case 'suggestion':return <Clock {...props} />;
      case 'changelog': return <Sparkles {...props} />;
      case 'data':      return <Wrench {...props} />;
      case 'persona':   return <Sparkles {...props} />;
      case 'knowledge': return <Search {...props} />;
      case 'task':      return <Search {...props} />;
      case 'help':      return <SettingsIcon {...props} />;
    }
  };

  const categoryAccent = (c: CategoryKey) => {
    switch (c) {
      case 'saved':     return '#E8B84B';
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
            style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
              maxHeight: 'calc(100dvh - 4rem)',
              // 答えの札を出している間だけ、高さを「決まった値」にする。
              // 普段の一覧は中身なりの高さでよいが、札は中身 (資料の長さ) がいくらでも伸びる。
              // 高さが中身任せのままだと flex-1 の枠も伸び続け、下に置いた押せるものが
              // 折り目の外へ出る (2026-08-19 390px 実測: 3 つとも中心を押せなかった)。
              ...(inlineResult ? { height: 'calc(100dvh - 4rem)' } : null),
            }}
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
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIdx(0);
                  // 答えを見終わった人が次を打ち始めたら、札は自動で畳む。
                  // (まだ動いている途中は畳まない = 進み具合を目の前から消さない)
                  if (inlineResult) dismissInline();
                  else if (inlineTask && inlineTask.status !== 'running') dismissInline();
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  inlineTask && inlineTask.status === 'running'
                    ? '答えが出るまで、ここで待てます…'
                    : 'やりたいこと、機能、AI への依頼を入力…'
                }
                className="flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle"
                style={{ fontSize: '17px' /* iOS 自動ズーム回避 (16px+) */ }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {!mention && hasMentionTargets && (
                <button
                  onClick={() => {
                    setQuery(q => (q && !q.endsWith(' ') ? q + ' @' : q + '@'));
                    setSelectedIdx(0);
                    inputRef.current?.focus();
                  }}
                  aria-label="対象を指定する"
                  title="@ で対象を指定 (ナレッジ / カレンダー / メール / 売上)"
                  className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: 44, height: 44, color: 'var(--prism-creative, #A78BFA)', border: '1px solid var(--border)' }}
                >
                  <AtSign size={17} />
                </button>
              )}
              <span className="cp-pill flex-shrink-0" style={{ fontSize: '0.65rem' }}>ESC</span>
            </div>

            {/* 指した対象 — 「AI がこれだけを見る」を目に見える形にする */}
            {mention && (
              <div
                className="px-4 py-2 flex items-center gap-2 flex-wrap"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-3)' }}
              >
                <span
                  className="flex items-center gap-1.5 px-2.5 rounded-full flex-shrink-0"
                  style={{ minHeight: 32, border: '1px solid #A78BFA66', background: '#A78BFA1A', color: 'var(--brief-ink-violet)', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  <AtSign size={12} />
                  {mention.label.replace(/^@/, '')}
                </span>
                <span className="cp-meta" style={{ flex: '1 1 140px', minWidth: 0 }}>
                  {mentionBusy ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" />
                      実データを読んでいます…
                    </span>
                  ) : mention.hint}
                </span>
                <button
                  onClick={() => setMention(null)}
                  aria-label="この対象を外す"
                  title="対象を外す"
                  className="flex items-center justify-center rounded-md flex-shrink-0"
                  style={{ minWidth: 44, height: 44, color: 'var(--fg-subtle)' }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* カテゴリ タブ (対象を選んでいる最中と、答えを出している間は隠す = 迷わせない) */}
            {!mentionMode && !inlineTask && !inlineResult && (
            <div
              className="px-3 py-2 flex items-center gap-1 overflow-x-auto"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {TAB_ORDER.map((tab) => {
                const isActive = activeTab === tab;
                const label = tab === 'all'
                  ? 'すべて'
                  : (CATEGORY_TAB_LABEL[tab as CategoryKey] ?? CATEGORY_LABEL[tab as CategoryKey]);
                const accent = tab === 'all' ? 'var(--prism-creative, #A78BFA)' : categoryAccent(tab as CategoryKey);
                return (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedIdx(0); inputRef.current?.focus(); }}
                    // flex-shrink-0: 375px ではタブが縮んで文字同士が重なり読めなくなる。
                    // 縮ませずに横スクロールさせる (親は overflow-x-auto)。
                    className="px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0"
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
            )}

            {/* 結果リスト */}
            {/* relative … 答えの札 (inlineResult) を inset-0 で「この枠ぴったり」に置くため。
                これが無いと札の高さが決まらず、押せるものが折り目の下へ落ちる (2026-08-19 実測)。 */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-2 relative">
              {/* 消した直後だけ出る「元に戻す」。
                  ★リストの外に置くのが要点: 最後の 1 件を消すと「よく使う依頼」の
                  かたまり自体が消えるため、中に入れると取り消しボタンごと消える。 */}
              {inlineResult ? (
                /* ── 答えの札 (AI に頼まない用事) ────────────────────
                   資料 1 件・変更の記録 1 件・提案の採用切替 …… 行き先が要らない用事は
                   ここで終わらせる。出すのは実データそのままで、要約も補完もしない。 */
                /* ★2026-08-19 390px 実測: 長い資料だと札そのものが縦に伸び、
                   「全文をコピー」「ナレッジ画面で開く」がリストの折り目より下へ落ちて
                   ボタンの中心が押せなくなっていた (elementFromPoint が別物を返した)。
                   札の高さをこの枠の中に収め、伸び縮みするのは本文だけにする＝
                   どんなに長い資料でも、押せるものは最初から画面の中にある。 */
                <div className="absolute inset-0 px-4 py-3 flex flex-col" style={{ minHeight: 0 }}>
                  <div
                    className="rounded-xl px-4 py-3.5 flex flex-col"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', minHeight: 0 }}
                  >
                    <p className="cp-body" style={{ fontWeight: 600, lineHeight: 1.6, flexShrink: 0 }}>{inlineResult.title}</p>
                    {inlineResult.meta && (
                      <p className="cp-meta" style={{ marginTop: 4, lineHeight: 1.6, flexShrink: 0 }}>{inlineResult.meta}</p>
                    )}

                    {inlineResult.body && (
                      <div
                        className="mt-3 pt-3"
                        style={{ borderTop: '1px dashed var(--border)', minHeight: 0, overflowY: 'auto' }}
                      >
                        <p
                          className="cp-body"
                          style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                          {inlineResult.body}
                        </p>
                      </div>
                    )}

                    {/* 切ったなら必ず言う。黙って切ると「これで全部」と読まれる */}
                    {inlineResult.truncated && (
                      <p className="cp-meta" style={{ marginTop: 8, color: 'var(--fg)', lineHeight: 1.7, flexShrink: 0 }}>
                        ここまでが先頭部分です。続きは下のボタンから読めます。
                      </p>
                    )}

                    {/* 出せる中身が無い / うまくいかなかった時の一行 (それらしい文を作らない) */}
                    {inlineResult.emptyReason && (
                      <p className="cp-meta" style={{ marginTop: inlineResult.body ? 8 : 10, lineHeight: 1.7, flexShrink: 0 }}>
                        {inlineResult.emptyReason}
                      </p>
                    )}

                    {/* 押せるものは絶対に縮めない・絶対に折り目の下へ落とさない */}
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 12, flexShrink: 0 }}>
                      {inlineResult.copyText && (
                        <button
                          onClick={() => {
                            const text = inlineResult.copyText as string;
                            const p = navigator.clipboard?.writeText(text);
                            if (!p) {
                              notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'この端末では文字をコピーできません', duration: 3000 });
                              return;
                            }
                            void p.then(
                              () => notifyInApp({ kind: 'success', title: '全文をコピーしました', body: text.slice(0, 40), duration: 2000 }),
                              () => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'この端末では文字をコピーできません', duration: 3000 }),
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 rounded-lg"
                          style={{ minHeight: 44, border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          <Copy size={14} />全文をコピー
                        </button>
                      )}
                      <button
                        onClick={dismissInline}
                        className="flex items-center gap-1.5 px-3 rounded-lg"
                        /* ★2026-08-19 実測: --fg-subtle は暗いテーマの面の上で 2.67:1 = 読めない。
                           押せるものの文字は --fg-muted まで上げる (実測 6.47:1)。 */
                        style={{ minHeight: 44, border: '1px solid var(--border)', color: 'var(--fg-muted)', fontSize: '0.78rem', fontWeight: 600 }}
                      >
                        <CornerUpLeft size={14} />ほかのことをする
                      </button>
                      {/* 「行きたい人だけ行ける」逃げ道。右下に小さく 1 つだけ置く */}
                      {inlineResult.open && (
                        <button
                          onClick={inlineResult.open.run}
                          className="flex items-center gap-1.5 px-3 rounded-lg ml-auto"
                          style={{ minHeight: 44, border: '1px solid var(--border)', color: 'var(--brief-ink-violet)', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          {inlineResult.open.label}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="cp-tiny" style={{ color: 'var(--fg-muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.7, flexShrink: 0 }}>
                    さっきまで見ていた画面は、そのまま後ろに残っています。<br />
                    Esc を押すと札だけ畳んで、元の場所に戻ります。
                  </p>
                </div>
              ) : inlineTask ? (
                /* ── 答えの札 ────────────────────────────────────
                   ここに答えを出すために、依頼しても閉じない。
                   出すのは実際に返ってきた文だけ。まだ返っていない時は
                   「返ってきた風の文」を置かず、いま何をしているかだけを書く。 */
                <div className="px-4 py-3">
                  <div
                    className="rounded-xl px-4 py-3.5"
                    style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                  >
                    {/* 何を頼んだか */}
                    <p className="cp-tiny" style={{ color: 'var(--fg-subtle)' }}>頼んだこと</p>
                    <p className="cp-body" style={{ fontWeight: 600, lineHeight: 1.6, marginTop: 2 }}>
                      {inlineTask.summary.split('\n')[0]}
                    </p>
                    {(inlineTask.contextLabel || inlineNote) && (
                      <p className="cp-meta flex items-center gap-1.5" style={{ marginTop: 6 }}>
                        <AtSign size={12} className="flex-shrink-0" />
                        <span>
                          {inlineTask.contextLabel ? `${inlineTask.contextLabel} を読みました` : '実データを読みました'}
                          {inlineNote ? `（${inlineNote}）` : ''}
                        </span>
                      </p>
                    )}

                    {/* 誰が、いま何をしているか (実際のステップだけ) */}
                    <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--border)' }}>
                      {inlineTask.steps.map((s, i) => {
                        const m = CXO_META[s.cxo];
                        const isWorking = s.status === 'working';
                        const isDone = s.status === 'done';
                        const isFailed = s.status === 'failed';
                        return (
                          <div key={i} className="flex items-start gap-2.5" style={{ padding: '5px 0' }}>
                            <span className="flex-shrink-0" style={{ marginTop: 2, color: isFailed ? '#F87171' : isDone ? '#34D399' : m.color }}>
                              {isWorking ? <Loader2 size={14} className="animate-spin" />
                                : isDone ? <CheckCircle2 size={14} />
                                : isFailed ? <AlertTriangle size={14} />
                                : <Clock size={14} style={{ opacity: 0.5 }} />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="cp-meta" style={{ color: isWorking ? 'var(--fg)' : undefined }}>
                                {m.shortLabel}
                                {isWorking ? ' が考えています…' : isDone ? ' が終えました' : isFailed ? ' で止まりました' : ' は待っています'}
                              </p>
                              {isDone && s.output && (
                                <p className="cp-body" style={{ lineHeight: 1.7, marginTop: 3 }}>{s.output}</p>
                              )}
                              {isFailed && s.error && (
                                <p className="cp-meta" style={{ color: '#FCA5A5', lineHeight: 1.7, marginTop: 3 }}>{s.error}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 手当て — 失敗はやり直す / 終わったら答えを持ち出す */}
                    <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 12 }}>
                      {inlineTask.status === 'failed' && (
                        <button
                          onClick={() => queue.retry(inlineTask.id)}
                          className="flex items-center gap-1.5 px-3 rounded-lg"
                          style={{ minHeight: 44, border: '1px solid #F8717188', color: '#FCA5A5', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          <RotateCcw size={14} />やり直す
                        </button>
                      )}
                      {inlineTask.status === 'done' && answerText && (
                        <button
                          onClick={() => {
                            // clipboard が無い端末では .then が生えないので、先に有無を見る
                            const p = navigator.clipboard?.writeText(answerText);
                            if (!p) {
                              notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'この端末では文字をコピーできません', duration: 3000 });
                              return;
                            }
                            void p.then(
                              () => notifyInApp({ kind: 'success', title: '答えをコピーしました', body: answerText.slice(0, 40), duration: 2000 }),
                              () => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'この端末では文字をコピーできません', duration: 3000 }),
                            );
                          }}
                          className="flex items-center gap-1.5 px-3 rounded-lg"
                          style={{ minHeight: 44, border: '1px solid var(--border)', color: 'var(--fg)', fontSize: '0.78rem', fontWeight: 600 }}
                        >
                          <Copy size={14} />答えをコピー
                        </button>
                      )}
                      <button
                        onClick={dismissInline}
                        className="flex items-center gap-1.5 px-3 rounded-lg"
                        /* ★2026-08-19 実測: --fg-subtle は暗いテーマの面の上で 2.67:1 = 読めない。
                           押せるものの文字は --fg-muted まで上げる (実測 6.47:1)。 */
                        style={{ minHeight: 44, border: '1px solid var(--border)', color: 'var(--fg-muted)', fontSize: '0.78rem', fontWeight: 600 }}
                      >
                        <CornerUpLeft size={14} />ほかのことをする
                      </button>
                    </div>
                  </div>
                  <p className="cp-tiny" style={{ color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 10, lineHeight: 1.7 }}>
                    この札は、さっきまで見ていた画面の上に出ています。<br />
                    Esc を押すと札だけ畳んで、元の場所に戻ります。
                  </p>
                </div>
              ) : mentionMode ? (
                <div className="py-1">
                  <div className="cp-tiny px-5 py-1.5 flex items-center gap-1.5" style={{ color: 'var(--brief-ink-violet)', fontWeight: 600 }}>
                    <AtSign size={12} />
                    <span>どれを見て考えますか (選んだものだけを読みます)</span>
                  </div>
                  {mentionCandidates.length === 0 ? (
                    /* 指せる対象がまだ無い人に空の候補を見せない。何をすれば出るかを書く。 */
                    <p className="px-5 py-3 cp-meta" style={{ lineHeight: 1.7 }}>
                      いま指せる対象はありません。<br />
                      ナレッジに資料やメモを入れるか、カレンダー / メール / 売上 を繋ぐとここに出ます。
                    </p>
                  ) : mentionCandidates.map((t, i) => {
                    const isSel = selectedIdx === i;
                    return (
                      <button
                        key={t.id}
                        data-cmd-idx={i}
                        onMouseEnter={() => setSelectedIdx(i)}
                        onClick={() => pickMention(t)}
                        className="w-full text-left px-5 py-2.5 flex items-center gap-3 transition-all"
                        style={{
                          minHeight: 44,
                          background: isSel ? 'var(--surface-3)' : 'transparent',
                          borderLeft: isSel ? '3px solid #A78BFA' : '3px solid transparent',
                        }}
                      >
                        <AtSign size={16} className="flex-shrink-0" style={{ color: 'var(--brief-ink-violet)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="cp-body truncate" style={{ fontWeight: isSel ? 600 : 400 }}>{t.label}</p>
                          <p className="cp-meta truncate">{t.hint}</p>
                        </div>
                        <ArrowRight size={14} className="flex-shrink-0" style={{ color: 'var(--fg-subtle)' }} />
                      </button>
                    );
                  })}
                </div>
              ) : (
              <>
              {undoSaved && (
                <div
                  className="mx-3 mb-2 px-3 py-2 flex items-center gap-2 rounded-lg"
                  style={{ background: 'var(--surface-3)', border: '1px solid #E8B84B44', fontSize: '0.72rem' }}
                >
                  <span className="truncate flex-1" style={{ color: 'var(--fg)' }}>
                    「{undoSaved.prompt.slice(0, 20)}{undoSaved.prompt.length > 20 ? '…' : ''}」を消しました
                  </span>
                  <button
                    onClick={restoreSavedPrompt}
                    className="flex items-center gap-1 px-3 rounded-md flex-shrink-0"
                    style={{ minHeight: 44, color: 'var(--brass-text)', border: '1px solid #E8B84B77', fontWeight: 600 }}
                  >
                    <Undo2 size={12} />元に戻す
                  </button>
                </div>
              )}
              {showZeroState ? (
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
                          <RowGlyph item={item} size={16} />
                          <span className="cp-zero-row-label">{item.label}</span>
                          <ArrowRight size={14} style={{ color: 'var(--fg-subtle)' }} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* よく使う依頼 — 見つからなかった時の逃げ道にもなる */}
                  {savedItems.length > 0 && (
                    <div className="cp-zero-section">
                      <div className="cp-zero-section-label">
                        <Star size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                        前にやった依頼をもう一度
                      </div>
                      {savedItems.slice(0, 3).map((item) => (
                        <button
                          key={'sv:' + actionId(item)}
                          onClick={() => runItem(item)}
                          className="cp-zero-row"
                        >
                          <RowGlyph item={item} size={16} />
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
                          <RowGlyph item={item} size={16} />
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
                        onClick={() => { void delegateToAi(query, mention); }}
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
                  // 畳んで隠している件数。0 なら何も隠していない。
                  const hiddenHere = capped.hidden.get(category) ?? 0;
                  return (
                    <div key={category} className="mb-1">
                      <div
                        className="cp-tiny px-5 py-1.5 sticky top-0 flex items-center gap-1.5"
                        style={{ background: 'var(--bg-2)', color: accent, fontWeight: 600 }}
                      >
                        {categoryIcon(category)}
                        <span>{CATEGORY_LABEL[category]}</span>
                        {/* 見出しの数字は必ず「本当の総数」。畳んでいる時は 出している数 / 総数 と書く */}
                        <span style={{ marginLeft: 'auto', color: 'var(--fg-subtle)', fontWeight: 400 }}>
                          {hiddenHere > 0 ? `${items.length} / ${items.length + hiddenHere}` : items.length}
                        </span>
                      </div>
                      {items.map((item) => {
                        const flatIdx = flatItems.indexOf(item);
                        const isSelected = flatIdx === selectedIdx;
                        const subtitle = 'subtitle' in item ? item.subtitle : undefined;
                        const barColor = 'color' in item && item.color ? item.color : accent;
                        // 保存した依頼だけは「消す」を持つので、行を button で包まず横並びにする
                        if (category === 'saved' && item.kind === 'ai-delegate') {
                          const removeKey = savedKey(item.prompt, item.mentionId);
                          return (
                            <div
                              key={actionId(item) + flatIdx}
                              className="w-full flex items-center transition-all"
                              style={{
                                background: isSelected ? 'var(--surface-3)' : 'transparent',
                                borderLeft: isSelected ? `3px solid ${barColor}` : '3px solid transparent',
                              }}
                            >
                              <button
                                data-cmd-idx={flatIdx}
                                onMouseEnter={() => setSelectedIdx(flatIdx)}
                                onClick={() => runItem(item)}
                                className="flex-1 min-w-0 text-left pl-5 pr-2 py-2.5 flex items-center gap-3"
                                style={{ minHeight: 44 }}
                              >
                                <RowGlyph item={item} size={18} />
                                <div className="flex-1 min-w-0">
                                  <p className="cp-body truncate" style={{ fontWeight: isSelected ? 600 : 400 }}>{item.label}</p>
                                  {subtitle && <p className="cp-meta truncate">{subtitle}</p>}
                                </div>
                              </button>
                              <button
                                onClick={() => removeSavedPrompt(removeKey)}
                                aria-label="この依頼を保存から消す"
                                title="保存から消す"
                                className="flex items-center justify-center mr-2 rounded-md flex-shrink-0"
                                style={{ width: 44, height: 44, color: 'var(--fg-subtle)' }}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          );
                        }
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
                            <RowGlyph item={item} size={18} />
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
                      {/* 畳んだぶんを必ず言う。押せば全部出る (黙って切らない) */}
                      {hiddenHere > 0 && (
                        <button
                          onClick={() => setExpandedCats(prev => new Set(prev).add(category))}
                          className="w-full text-left px-5 flex items-center gap-2"
                          // 48px: 親指で押す行。上下の行 (約 61px) の間で押し損ねない大きさにする
                          style={{ minHeight: 48, color: accent }}
                        >
                          <ChevronDown size={14} />
                          <span className="cp-meta" style={{ color: accent }}>
                            ほかに {hiddenHere} 件あります・すべて見る
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              </>
              )}
            </div>

            {/* フッタヒント — 答えを出している間は、そこで効くキーだけを書く
                (効かない「↑↓ 選択」を並べたままにしない) */}
            {inlineResult ? (
              <div
                className="px-5 py-2 flex items-center gap-3 flex-wrap text-fg-subtle"
                style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}
              >
                <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Esc</kbd>札を畳んで戻る</span>
                <span className="ml-auto">画面は移っていません</span>
              </div>
            ) : inlineTask ? (
              <div
                className="px-5 py-2 flex items-center gap-3 flex-wrap text-fg-subtle"
                style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}
              >
                <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Esc</kbd>札を畳んで戻る</span>
                <span className="ml-auto">
                  {inlineTask.status === 'running' ? '実行中'
                    : inlineTask.status === 'failed' ? '止まりました'
                    : '終わりました'}
                </span>
              </div>
            ) : (
            <>
            {/* キーの案内は、そのキーがある人にだけ出す。
                iPhone には ↑↓ / Tab / ⌘ / Esc が無いので、一番狭い画面で
                6つの効かない案内が一番下を占領していた (2026-08-13 375px 実測)。
                件数だけはスマホでも意味があるので、下の1行に残す。 */}
            <div
              className="px-5 py-2 items-center gap-3 flex-wrap text-fg-subtle hidden md:flex"
              style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}
            >
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>↑↓</kbd>選択</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>↵</kbd>実行</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Tab</kbd>カテゴリ</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>@</kbd>対象を指す</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>⌘↵</kbd>AI 依頼</span>
              <span className="flex items-center gap-1"><kbd className="cp-pill" style={{ fontSize: '0.6rem' }}>Esc</kbd>閉じる</span>
              <span className="ml-auto">{(mentionQuery !== null ? mentionCandidates.length : shownCount)} 件</span>
            </div>
            <div
              className="px-5 py-1.5 flex md:hidden items-center justify-end text-fg-subtle"
              style={{ borderTop: '1px solid var(--border)', fontSize: '0.7rem' }}
            >
              {(mentionQuery !== null ? mentionCandidates.length : shownCount)} 件
            </div>
            </>
            )}
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
