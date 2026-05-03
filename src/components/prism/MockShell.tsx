import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const PRISM = {
  logic: '#2E6FFF',
  empathy: '#E84B97',
  creative: '#8E5CFF',
  action: '#FF7A1A',
  ethics: '#D9A41A',
} as const;

interface NavItem {
  key: string;
  label: string;
  Icon: LucideIcon;
  badge?: number;
  badgeColor?: string;
}

interface Props {
  module: string;
  color?: string;
  nav: NavItem[];
  active: string;
  onSelect?: (key: string) => void;
  status?: string;
  user?: string;
  syncLabel?: string;
  syncValue?: string;
  syncSpinner?: boolean;
  children: ReactNode;
  className?: string;
}

export function MockShell({
  module,
  color = PRISM.logic,
  nav,
  active,
  onSelect,
  status = 'GHOST · ACTIVE',
  user = 'N',
  syncLabel = 'SYNC',
  syncValue = 'Naoki K.',
  syncSpinner = true,
  children,
  className = '',
}: Props) {
  return (
    <div
      className={`glass relative w-full overflow-hidden rounded-3xl ${className}`}
      style={{ boxShadow: `var(--shadow), 0 30px 80px -50px ${color}55` }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between border-b px-3 py-2.5 sm:px-5 sm:py-3"
        style={{ background: 'var(--titlebar-bg)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden gap-1.5 sm:flex">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--surface-3)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--surface-3)' }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--surface-3)' }} />
          </div>
          <span className="text-[11px] tracking-[0.3em] sm:text-[12px] sm:tracking-[0.4em] text-fg-muted">
            CORE&nbsp;PRISM&nbsp;·&nbsp;{module.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-[12px] tracking-[0.3em] text-fg-muted sm:inline">
            {status}
          </span>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-medium"
            style={{ background: `${color}26`, color, border: `1px solid ${color}55` }}
          >
            {user}
          </div>
        </div>
      </div>

      {/* Mobile: top tab strip + content. Desktop: sidebar + content */}
      <div className="md:grid md:grid-cols-[200px_1fr]">
        {/* Mobile tab bar (horizontal scroll) */}
        <div
          className="no-scrollbar flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden"
          style={{ borderColor: 'var(--border-2)' }}
        >
          {nav.map((n) => {
            const isActive = n.key === active;
            return (
              <button
                key={n.key}
                onClick={() => onSelect?.(n.key)}
                className="tap-target relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition"
                style={
                  isActive
                    ? { background: `${color}1F`, color, border: `1px solid ${color}55` }
                    : { color: 'var(--fg-muted)', background: 'var(--surface-3)' }
                }
              >
                <n.Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>{n.label}</span>
                {n.badge && n.badge > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                    style={{
                      background: n.badgeColor ?? '#FF6F6F',
                      color: '#0A0A0A',
                    }}
                  >
                    {n.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop sidebar */}
        <aside
          className="hidden border-r p-3 md:block"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}
        >
          <div className="px-2 py-2 text-[11px] tracking-[0.4em] text-fg-subtle">
            {module.toUpperCase()}&nbsp;OS
          </div>
          <nav className="flex flex-col gap-0.5">
            {nav.map((n) => {
              const isActive = n.key === active;
              return (
                <button
                  type="button"
                  key={n.key}
                  onClick={() => onSelect?.(n.key)}
                  className="tap-target flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[14px] transition"
                  style={
                    isActive
                      ? { background: `${color}1F`, color: 'var(--fg)' }
                      : { color: 'var(--fg-muted)' }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--surface-3)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <n.Icon
                    className="h-4 w-4"
                    strokeWidth={1.5}
                    style={{ color: isActive ? color : undefined }}
                  />
                  <span className="flex-1">{n.label}</span>
                  {n.badge && n.badge > 0 && (
                    <span
                      className="rounded-full px-1.5 text-[11px] font-semibold leading-[16px]"
                      style={{
                        background: n.badgeColor ?? '#FF6F6F',
                        color: '#0A0A0A',
                        minWidth: 16,
                        textAlign: 'center',
                      }}
                    >
                      {n.badge}
                    </span>
                  )}
                  {isActive && !n.badge && (
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  )}
                </button>
              );
            })}
          </nav>
          <div
            className="mt-6 rounded-xl p-3"
            style={{ background: 'var(--surface-3)' }}
          >
            <div className="text-[11px] tracking-[0.3em] text-fg-subtle">{syncLabel}</div>
            <div className="mt-1 text-[14px] text-fg">{syncValue}</div>
            {syncSpinner && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-muted">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: color }}
                />
                learning…
              </div>
            )}
          </div>
        </aside>

        {/* Content */}
        <section className="p-3 sm:p-5">{children}</section>
      </div>
    </div>
  );
}

export function Pill({ children, color = '#666' }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] tracking-[0.15em]"
      style={{
        background: `${color}1F`,
        border: `1px solid ${color}50`,
        color,
      }}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  unit = '',
  delta,
  color = PRISM.logic,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  color?: string;
}) {
  return (
    <div className="glass rounded-2xl p-3 sm:p-4">
      <div className="text-[11px] tracking-[0.3em] text-fg-subtle">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-light" style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-[12px] tracking-wider text-fg-subtle">{unit}</span>}
      </div>
      {delta && <div className="mt-1.5 text-[12px] text-fg-muted">{delta}</div>}
    </div>
  );
}
