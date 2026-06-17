import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Users, FolderKanban, Compass, BarChart3, Megaphone, Film,
  Clapperboard, Radio, Target, Scale, Receipt, BarChart2, CheckSquare,
  BookOpen, Quote, Calendar, Files, Presentation, MailOpen, Calculator,
  Bot, Camera, Image as ImageIcon, Mic, Send, Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * 各スタジオ intro 用ブランド・ライン・アイコン登録簿。
 * 関連機能は QuickActions の QUICK_ICON_MAP と同じアイコン言語に揃え、
 * OS 標準のカラー絵文字を一掃する (no-cheap-emoji 恒久ルール)。
 */
const STUDIO_ICONS: Record<string, LucideIcon> = {
  people: Users,
  crm: FolderKanban,
  ceo: Compass,
  pnl: BarChart3,
  influencer: Megaphone,
  youtube: Film,
  video: Clapperboard,
  content: Radio,
  strategy: Target,
  legal: Scale,
  finance: BarChart3,
  invoice: Receipt,
  benchmark: BarChart2,
  team: Users,
  tasks: CheckSquare,
  knowledge: BookOpen,
  minutes: Quote,
  meeting: Calendar,
  document: Files,
  slides: Presentation,
  email: MailOpen,
  finConsult: Calculator,
  saas: Bot,
  expense: Camera,
  image: ImageIcon,
  voice: Mic,
  autopost: Send,
  integrations: Link2,
};

/**
 * 各スタジオの一番上に出る「3 秒でわかる説明 + サンプル出力」ストリップ。
 * 初見の人が「この画面で何ができるか / まず何を押すか / どんな結果になるか」を
 * 触らずに理解できるようにする。一度 ✕ を押すと、その画面では二度と出ない。
 */
export function StudioIntro({
  id,
  accent,
  emoji,
  icon: Icon,
  iconKey,
  what,
  tryThis,
  example,
  samplePreview,
  sampleLabel = 'こんなのが出ます',
}: {
  id: string;
  accent: string;
  /** 旧来の絵文字 (no-cheap-emoji 移行中の後方互換)。icon / iconKey があればそちら優先 */
  emoji?: string;
  /** Lucide ライン・アイコン (直接指定)。指定時は iconKey / emoji より優先 */
  icon?: LucideIcon;
  /** STUDIO_ICONS のキー (推奨)。これだけで関連機能と同じブランド・アイコンが付く */
  iconKey?: string;
  what: string;
  tryThis: string;
  example: string;
  samplePreview?: ReactNode;
  sampleLabel?: string;
}) {
  const ResolvedIcon: LucideIcon | undefined = Icon || (iconKey ? STUDIO_ICONS[iconKey] : undefined);
  const storageKey = `cp-studio-intro-dismissed-${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* localStorage 不可でも閉じる */
    }
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          style={{
            background: `linear-gradient(135deg, ${accent}18, ${accent}06 60%)`,
            border: `1px solid ${accent}40`,
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 14,
            overflow: 'hidden',
          }}
        >
          <div
            className="cp-row-between"
            style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
          >
            <div
              className="cp-row"
              style={{ alignItems: 'flex-start', gap: 10, minWidth: 0, flex: '1 1 240px' }}
            >
              {ResolvedIcon ? (
                <span
                  style={{
                    flexShrink: 0,
                    width: 36, height: 36, borderRadius: 10,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: `${accent}1F`, border: `1px solid ${accent}40`,
                  }}
                >
                  <ResolvedIcon size={20} color={accent} strokeWidth={2.2} />
                </span>
              ) : (
                <span style={{ fontSize: '1.35rem', lineHeight: 1.2, flexShrink: 0 }}>{emoji}</span>
              )}
              <div className="cp-stack-sm" style={{ minWidth: 0 }}>
                <p className="cp-h3" style={{ lineHeight: 1.35 }}>{what}</p>
                <p className="cp-meta">
                  <span style={{ color: accent, fontWeight: 700 }}>まずは</span> {tryThis}
                </p>
                <p className="cp-tiny" style={{ opacity: 0.85 }}>例: {example}</p>
              </div>
            </div>

            {samplePreview && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  minWidth: 110,
                }}
              >
                <span
                  className="cp-tiny"
                  style={{
                    color: accent,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontSize: '0.65rem',
                  }}
                >
                  ▼ {sampleLabel}
                </span>
                <div
                  style={{
                    background: 'var(--surface-3)',
                    border: `1px dashed ${accent}55`,
                    borderRadius: 10,
                    padding: 6,
                    minWidth: 120,
                    maxWidth: 200,
                  }}
                  aria-label={`サンプル出力: ${sampleLabel}`}
                >
                  {samplePreview}
                </div>
              </div>
            )}

            <button
              onClick={dismiss}
              className="cp-btn cp-btn-ghost cp-btn-sm"
              style={{ flexShrink: 0 }}
              title="この説明を閉じる"
              aria-label="この説明を閉じる"
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
