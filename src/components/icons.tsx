// ============================================================
// 共通アイコン — 絵文字をすべて Lucide に置換するための集中管理
// 売れる UI を作るため、すべての絵文字を「線形・整った・brand-color」のアイコンに統一
// ============================================================
import {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
  Mail, MessageSquare, Calendar, Camera, Mic, Edit3, Film, Search,
  HeartPulse, FileText, ScrollText, FileSpreadsheet, Receipt, Palette,
  Crown, Star, Bell, Settings, Leaf, Target, Image as ImageIcon,
  Flower2, Flower, UsersRound, Handshake, CreditCard, Lightbulb,
  BarChart3, ArrowRight, Plus, X, Menu, ChevronRight,
  Sparkle, AudioLines, Wand2, Send, Brain, Check, Cpu, Globe, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * カラー付き丸アイコンバッジ
 * オーナー方針: 絵文字はダサい。代わりに line-icon + color circle で売れる感を出す。
 */
interface BadgeProps {
  icon: LucideIcon;
  color: string;
  size?: number;
  variant?: 'solid' | 'soft' | 'outline';
  iconSize?: number;
}

export function IconBadge({ icon: Icon, color, size = 44, variant = 'solid', iconSize }: BadgeProps) {
  const px = iconSize ?? Math.round(size * 0.5);
  if (variant === 'solid') {
    return (
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.28),
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        boxShadow: `0 8px 22px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={px} color="#FFFFFF" strokeWidth={2.2} absoluteStrokeWidth={false} />
      </div>
    );
  }
  if (variant === 'soft') {
    return (
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.28),
        background: `${color}1F`,
        border: `1px solid ${color}40`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={px} color={color} strokeWidth={2.0} />
      </div>
    );
  }
  // outline
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: 'transparent',
      border: `1.5px solid ${color}66`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={px} color={color} strokeWidth={2.0} />
    </div>
  );
}

/**
 * 円形バージョン (タブやチップ用、小サイズ)
 */
export function IconChip({ icon: Icon, color, size = 22 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <Icon size={size} color={color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
  );
}

/**
 * 7 エージェントのアイコンマップ
 */
export const PRISM_AGENT_ICONS: Record<string, LucideIcon> = {
  '経営': Compass,
  '営業': Briefcase,
  '財務': TrendingUp,
  '創造': Sparkles,
  '学び': BookOpen,
  '人材': Users,
  '生活': Heart,
};

/**
 * 6 ファセットのアイコンマップ
 */
export const IRIS_FACET_ICONS: Record<string, LucideIcon> = {
  '案件': Mail,
  '分析': BarChart3,
  '創作': Sparkle,
  '交渉': MessageSquare,
  'ブランド': Palette,
  '仲間': UsersRound,
};

/**
 * Iris タブのアイコン (画像 3 の AllFeatures 12 個 / VoiceHome suggestion)
 */
export const IRIS_TAB_ICONS: Record<string, LucideIcon> = {
  'ホーム':       Sparkles,
  '戦略':         TrendingUp,
  '案件精査':     Search,
  '案件':         Mail,
  '丸投げ編集':   Film,
  '交渉':         MessageSquare,
  '投稿下書き':   Edit3,
  '画像加工':     Camera,
  '美容相談':     HeartPulse,
  'ヘルス':       Leaf,
  'コミュニティ': UsersRound,
  'チーム':       Users,
  'ブランド探し': Handshake,
  'メディアキット': FileText,
  // 共通
  'スクショから案件追加': Camera,
  '断り文を書いて': MessageSquare,
  '今週、何投稿すべき?': BarChart3,
  '肌が荒れて困ってる': HeartPulse,
  '動画スタジオを開く': Film,
  'AIと話す': AudioLines,
};

/**
 * Prism クイックアクションのアイコン (画像 2)
 */
export const PRISM_QUICK_ICONS: Record<string, LucideIcon> = {
  '契約書 AI': ScrollText,
  '商談 AI':   Target,
  'メール AI': Mail,
  '請求 AI':   Receipt,
  '画像 AI':   Palette,
  '音声 AI':   Mic,
  'スライド AI': FileSpreadsheet,
  'ヘルス':    HeartPulse,
  'ナレッジ':  BookOpen,
  '案件':      Briefcase,
  '人物':      Users,
  '設定':      Settings,
};

/**
 * Prism のプラン記号 (Crown / Star / Sparkles など)
 */
export const PLAN_BADGE_ICONS: Record<string, LucideIcon> = {
  'crown': Crown,
  'star':  Star,
  'sparkles': Sparkles,
  'check': Check,
};

/**
 * 共通アクション
 */
export {
  Compass, Briefcase, TrendingUp, Sparkles, BookOpen, Users, Heart,
  Mail, MessageSquare, Calendar, Camera, Mic, Edit3, Film, Search,
  HeartPulse, FileText, ScrollText, FileSpreadsheet, Receipt, Palette,
  Crown, Star, Bell, Settings, Leaf, Target, ImageIcon,
  Flower2, Flower, UsersRound, Handshake, CreditCard, Lightbulb,
  BarChart3, ArrowRight, Plus, X, Menu, ChevronRight,
  Sparkle, AudioLines, Wand2, Send, Brain, Check, Cpu, Globe, Zap,
};
