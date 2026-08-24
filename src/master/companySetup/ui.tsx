// ============================================================
// /master/company-setup — 共有の小さな再利用コンポーネント
// 既存 /master/* の慣習 (inline style, ダーク単色, lucide-react) に合わせる。
// 配色・フォーマッタは ./tokens (Fast Refresh 対応のため分離)。
// ============================================================
import type { ReactNode, CSSProperties } from 'react';
import type { TaskStatus, TaskPriority, PaymentStatus, DocumentStatus } from './types';
import { COLORS } from './tokens';

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.line}`,
      borderRadius: 16,
      padding: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

const STATUS_LABEL: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: '未着手', color: COLORS.mut, bg: 'rgba(154,166,178,0.12)' },
  in_progress: { label: '進行中', color: COLORS.gold, bg: COLORS.goldSoft },
  blocked: { label: '停滞', color: COLORS.danger, bg: COLORS.dangerSoft },
  completed: { label: '完了', color: COLORS.teal, bg: COLORS.tealSoft },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_LABEL[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

const PRIORITY_LABEL: Record<TaskPriority, { label: string; color: string }> = {
  critical: { label: '最優先', color: COLORS.danger },
  high: { label: '優先', color: COLORS.warn },
  normal: { label: '通常', color: COLORS.mut },
  low: { label: '低', color: COLORS.mut },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const p = PRIORITY_LABEL[priority];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: p.color }}>{p.label}</span>
  );
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, { label: string; color: string; bg: string }> = {
  unpaid: { label: '未払い', color: COLORS.warn, bg: COLORS.warnSoft },
  locked: { label: '払込待ち', color: COLORS.lock, bg: COLORS.lockSoft },
  paid: { label: '支払済み', color: COLORS.teal, bg: COLORS.tealSoft },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS_LABEL[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

const DOC_STATUS_LABEL: Record<DocumentStatus, { label: string; color: string; bg: string }> = {
  not_acquired: { label: '未取得', color: COLORS.mut, bg: 'rgba(154,166,178,0.12)' },
  acquired: { label: '取得済み', color: COLORS.teal, bg: COLORS.tealSoft },
  sent: { label: '送付済み', color: COLORS.gold, bg: COLORS.goldSoft },
};

export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const s = DOC_STATUS_LABEL[status];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
      border: `1px solid ${s.color}33`, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{
        width: `${clamped}%`, height: '100%', borderRadius: 999,
        background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.teal})`,
        transition: 'width 300ms ease',
      }} />
    </div>
  );
}

export function WarningBanner({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? COLORS.danger : COLORS.warn;
  const bg = tone === 'danger' ? COLORS.dangerSoft : COLORS.warnSoft;
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12, background: bg,
      border: `1px solid ${color}44`, color, fontSize: 13, fontWeight: 600,
      lineHeight: 1.5,
    }}>{text}</div>
  );
}
