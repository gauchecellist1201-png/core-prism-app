// ============================================================
// featureIcons — 「同じ機能は、どこでも同じアイコン・同じ色」の唯一の台帳
//
// これまで機能アイコンの表は 3 か所にバラバラにあった:
//   ・QuickActions.tsx  … QUICK_ICON_MAP (アイコン + 色)
//   ・StudioIntro.tsx   … STUDIO_ICONS   (アイコンのみ・色はペルソナ色)
//   ・EmptyState.tsx    … EMPTY_ICONS    (アイコンのみ)
// その結果、同じ機能なのに場所によって絵も色も違って見えていた:
//   チーム   … タイルでは剣 / 画面上部では人   ← 別機能に見える
//   スライド … タイルではパレット / 画面上部では投影機
//   意思決定 … タイルでは吹き出し / 空っぽ画面ではコンパス
//   さらに briefing / calendar / deals / folder / decision は
//   StudioIntro 側の表に無く、アイコンが「消える」ことがあった。
//
// ここを 1 か所に集約する。使う側は id を渡すだけで、
// 関連機能は必ず同じアイコン + 同じ色で出る (no-cheap-emoji 恒久ルールにも準拠)。
//
// 色は「家族」でそろえる:
//   金 #FACC15 = 経営・上位  / 緑 #10B981 = お金の数字 / 青 #5BA8FF = 資料・つなぐ
//   紫 #A78BFA = 役員・AI    / 桃 #FF6FB5 = 人・発信   / 橙 #FFA94D = 営業
//   赤 #FF0033 = 動画        / 灰 #9CA3AF = 書類
// ============================================================
import {
  Lightbulb, Mic, Film, Clapperboard, MailOpen, BookOpen, FileText, Quote,
  Presentation, Handshake, Compass, Send, Image as ImageIcon, Radio, Receipt,
  ScrollText, BarChart3, BarChart2, Calculator, FileSpreadsheet, Camera,
  FolderKanban, FolderOpen, Files, ClipboardList, Users, Sword, Target, Flag,
  Bot, Link2, CheckSquare, Crown, Calendar, HeartPulse, Megaphone, Scale,
  Landmark,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FeatureIcon {
  Icon: LucideIcon;
  /** ブランドのアクセント色。白いアイコンを載せる前提の濃さで選ぶ */
  color: string;
}

/** 正式 ID → アイコン + 色 (QuickActions のタイル ID を正とする) */
export const FEATURE_ICONS: Record<string, FeatureIcon> = {
  // ── 今すぐ ──────────────────────────────
  brief:         { Icon: Lightbulb,     color: '#F59E0B' },
  voice:         { Icon: Mic,           color: '#FF5C9C' },
  shadow:        { Icon: MailOpen,      color: '#A78BFA' },
  email:         { Icon: MailOpen,      color: '#A78BFA' },
  'tasks-hub':   { Icon: CheckSquare,   color: '#4ADE80' },
  meet:          { Icon: Calendar,      color: '#5BA8FF' },
  'sales-agent': { Icon: Target,        color: '#10B981' },

  // ── つくる ──────────────────────────────
  youtube:       { Icon: Film,          color: '#FF0033' },
  video:         { Icon: Clapperboard,  color: '#FF0033' },
  kb:            { Icon: BookOpen,      color: '#5BA8FF' },
  folder:        { Icon: FolderOpen,    color: '#5BA8FF' },
  note:          { Icon: FileText,      color: '#5BA8FF' },
  minutes:       { Icon: Quote,         color: '#9088A8' },
  slides:        { Icon: Presentation,  color: '#C084FC' },
  post:          { Icon: Send,          color: '#FF6FB5' },
  image:         { Icon: ImageIcon,     color: '#C084FC' },
  engine:        { Icon: Radio,         color: '#4ADE80' },
  decision:      { Icon: Compass,       color: '#A78BFA' },
  nego:          { Icon: Handshake,     color: '#FFA94D' },

  // ── 商い ────────────────────────────────
  invoice:       { Icon: Receipt,       color: '#5BA8FF' },
  sales:         { Icon: ScrollText,    color: '#10B981' },
  pnl:           { Icon: BarChart3,     color: '#10B981' },
  finance:       { Icon: FileSpreadsheet, color: '#10B981' },
  'fin-consult': { Icon: Calculator,    color: '#10B981' },
  expense:       { Icon: Camera,        color: '#FFA94D' },
  benchmark:     { Icon: BarChart2,     color: '#5BA8FF' },
  crm:           { Icon: FolderKanban,  color: '#FFA94D' },
  deals:         { Icon: Handshake,     color: '#FFA94D' },
  documents:     { Icon: Files,         color: '#9CA3AF' },
  legal:         { Icon: Scale,         color: '#9CA3AF' },

  // ── つながる ────────────────────────────
  people:        { Icon: Users,         color: '#FF6FB5' },
  team:          { Icon: Sword,         color: '#9088A8' },
  influencer:    { Icon: Megaphone,     color: '#FF6FB5' },
  'saas-agent':  { Icon: Bot,           color: '#A78BFA' },
  briefing:      { Icon: ClipboardList, color: '#A78BFA' },
  integrations:  { Icon: Link2,         color: '#5BA8FF' },
  premium:       { Icon: Crown,         color: '#FACC15' },
  ceo:           { Icon: Landmark,      color: '#C9A96E' },
  strategy:      { Icon: Flag,          color: '#FACC15' },
  health:        { Icon: HeartPulse,    color: '#F472B6' },
};

/**
 * 呼び出し側が今まで使っていた別名 → 正式 ID。
 * 既存の 30 画面以上の iconKey をそのまま動かしたまま、絵と色だけ 1 本化する。
 */
const ALIASES: Record<string, string> = {
  // 「決算書を作る」タイルだけ台帳に無く、OS 標準の絵文字 📑 のまま残っていた
  financials: 'finance',
  knowledge: 'kb',
  content: 'engine',
  document: 'documents',
  autopost: 'post',
  finConsult: 'fin-consult',
  meeting: 'meet',
  calendar: 'meet',
  saas: 'saas-agent',
  tasks: 'tasks-hub',
};

/** id (別名可) から アイコン + 色 を引く。無ければ undefined */
export function resolveFeatureIcon(key?: string): FeatureIcon | undefined {
  if (!key) return undefined;
  return FEATURE_ICONS[key] || FEATURE_ICONS[ALIASES[key] || ''];
}

/** id (別名可) から色だけ引く。無ければ fallback (ふつうはペルソナのアクセント色) */
export function featureColor(key: string | undefined, fallback: string): string {
  return resolveFeatureIcon(key)?.color || fallback;
}
