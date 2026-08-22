// ============================================================
// Sales OS — 共通UI部品 (インラインstyle。既存 /master 系と同じ流儀)
// 触れるものは必ず 44px 以上。文字色は T のコントラスト検証ずみの値だけを使う。
// ============================================================
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RADIUS, T, TAP } from './theme';

// ---- ボタン --------------------------------------------------------------
type BtnVariant = 'primary' | 'ghost' | 'quiet' | 'danger';

const btnStyle = (v: BtnVariant, full: boolean, small: boolean): CSSProperties => {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: small ? 38 : TAP, padding: small ? '0 12px' : '0 16px',
    borderRadius: RADIUS.md, border: '1px solid transparent',
    fontSize: small ? 13 : 14.5, fontWeight: 700, lineHeight: 1.2,
    cursor: 'pointer', textDecoration: 'none', width: full ? '100%' : undefined,
    fontFamily: 'inherit', textAlign: 'center',
  };
  if (v === 'primary') return { ...base, background: T.gold, color: '#0B0A06', borderColor: T.gold };
  if (v === 'danger') return { ...base, background: 'transparent', color: T.red, borderColor: 'rgba(248,113,113,0.4)' };
  if (v === 'quiet') return { ...base, background: 'transparent', color: T.mute, borderColor: 'transparent' };
  return { ...base, background: T.raise2, color: T.ink, borderColor: T.line };
};

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: BtnVariant;
  full?: boolean;
  small?: boolean;
  disabled?: boolean;
  title?: string;
  newTab?: boolean;
}) {
  const { children, onClick, href, variant = 'ghost', full, small, disabled, title, newTab } = props;
  const style = { ...btnStyle(variant, !!full, !!small), opacity: disabled ? 0.45 : 1 };
  if (href && !disabled) {
    return (
      <a
        href={href}
        style={style}
        title={title}
        {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" style={style} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

// ---- カード --------------------------------------------------------------
export function Card(props: { children: ReactNode; onClick?: () => void; pad?: number; style?: CSSProperties }) {
  const { children, onClick, pad = 14, style } = props;
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background: T.raise, border: `1px solid ${T.line}`, borderRadius: RADIUS.lg,
        padding: pad, cursor: onClick ? 'pointer' : undefined, ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---- 小物 ----------------------------------------------------------------
export function Chip(props: { children: ReactNode; color?: string; active?: boolean; onClick?: () => void }) {
  const { children, color = T.mute, active, onClick } = props;
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    minHeight: onClick ? TAP - 8 : 22,
    padding: onClick ? '0 12px' : '2px 8px',
    borderRadius: RADIUS.pill, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
    border: `1px solid ${active ? color : T.line}`,
    background: active ? `${color}22` : 'transparent',
    color: active ? color : T.mute,
    cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit',
  };
  if (onClick) return <button type="button" style={style} onClick={onClick}>{children}</button>;
  return <span style={style}>{children}</span>;
}

export function Dot({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block', flexShrink: 0 }} />;
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, letterSpacing: '0.18em', color: T.faint, fontWeight: 800, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

export function Muted({ children, size = 12.5 }: { children: ReactNode; size?: number }) {
  return <div style={{ fontSize: size, color: T.mute, lineHeight: 1.75 }}>{children}</div>;
}

export function Stat(props: { label: string; value: ReactNode; sub?: string; color?: string }) {
  const { label, value, sub, color = T.ink } = props;
  return (
    <div style={{ background: T.raise, border: `1px solid ${T.line}`, borderRadius: RADIUS.md, padding: '10px 12px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: T.mute, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 900, color, marginTop: 3, lineHeight: 1.15, letterSpacing: '-0.01em' }}>{value}</div>
      {sub ? <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

// ---- 入力 ----------------------------------------------------------------
const inputBase: CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: '#0B0D12',
  border: `1px solid ${T.line}`, borderRadius: RADIUS.md,
  color: T.ink, padding: '11px 12px',
  // 16px を割ると iPhone が勝手に拡大する
  fontSize: 16, fontFamily: 'inherit', outline: 'none', minHeight: TAP,
};

export function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; rows?: number; hint?: string; inputMode?: 'text' | 'url' | 'email' | 'tel' | 'numeric';
}) {
  const { label, value, onChange, placeholder, type = 'text', rows, hint, inputMode } = props;
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: T.mute, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {rows ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.7, minHeight: rows * 24 + 22 }}
        />
      ) : (
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          inputMode={inputMode} autoCapitalize="off" autoCorrect="off" style={inputBase}
        />
      )}
      {hint ? <div style={{ fontSize: 11.5, color: T.faint, marginTop: 5, lineHeight: 1.6 }}>{hint}</div> : null}
    </label>
  );
}

// ---- 状態表示 ------------------------------------------------------------
export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.mute, fontSize: 13, padding: '14px 2px' }}>
      <span
        style={{
          width: 15, height: 15, borderRadius: 999,
          border: `2px solid ${T.line}`, borderTopColor: T.gold,
          animation: 'salesspin 0.8s linear infinite', display: 'inline-block',
        }}
      />
      {label || '読み込み中…'}
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div style={{
      background: T.redSoft, border: '1px solid rgba(248,113,113,0.35)', borderRadius: RADIUS.md,
      padding: 12, color: '#FCA5A5', fontSize: 13, lineHeight: 1.8,
    }}>
      {children}
      {onRetry ? <div style={{ marginTop: 10 }}><Btn small onClick={onRetry}>もう一度</Btn></div> : null}
    </div>
  );
}

export function Empty(props: { title: string; body: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 16px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: T.mute, lineHeight: 1.9, maxWidth: 380, margin: '0 auto 16px' }}>{props.body}</div>
      {props.action}
    </div>
  );
}

// ---- コピー --------------------------------------------------------------
export function CopyBtn({ text, label = 'コピー', full }: { text: string; label?: string; full?: boolean }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // https でない / 権限が無い端末向けの逃げ道
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    // 成功していないのに「コピーしました」と出さない
    if (!ok) { window.prompt('コピーできませんでした。ここから手でコピーしてください。', text); return; }
    setDone(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };
  return <Btn small full={full} onClick={copy} variant={done ? 'primary' : 'ghost'}>{done ? 'コピーしました' : label}</Btn>;
}

// ---- シート (下から出る。中身が伸びても必ずスクロールできる) --------------
export function Sheet(props: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { open, title, onClose, children } = props;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.66)', zIndex: 90,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, background: T.bg,
          border: `1px solid ${T.line}`, borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0`,
          // 中身が伸びた日に閉じられなくなるのを防ぐ: 高さ上限 + 縦スクロール
          maxHeight: '88svh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderBottom: `1px solid ${T.line}`, flexShrink: 0,
        }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, flex: 1, minWidth: 0 }}>{title}</div>
          <Btn small variant="quiet" onClick={onClose}>閉じる</Btn>
        </div>
        <div style={{
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          padding: `14px 14px calc(20px + env(safe-area-inset-bottom))`,
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---- スコアの帯 ----------------------------------------------------------
export function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ height: 6, background: T.raise2, borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999 }} />
    </div>
  );
}
