import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === 'light';

  if (compact) {
    return (
      <button
        onClick={toggle}
        aria-label={isLight ? 'ダークモードに切替' : 'ライトモードに切替'}
        className="tap-target flex items-center justify-center rounded-full transition"
        style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--border)',
          width: 36,
          height: 36,
        }}
      >
        {isLight ? <Moon className="h-4 w-4 text-fg-muted" /> : <Sun className="h-4 w-4 text-fg-muted" />}
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full p-1"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => !isLight && toggle()}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] transition"
        style={
          isLight
            ? { background: 'var(--surface)', color: 'var(--fg)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }
            : { color: 'var(--fg-subtle)' }
        }
      >
        <Sun className="h-3.5 w-3.5" />
        Light
      </button>
      <button
        onClick={() => isLight && toggle()}
        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] transition"
        style={
          !isLight
            ? { background: 'var(--surface)', color: 'var(--fg)', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }
            : { color: 'var(--fg-subtle)' }
        }
      >
        <Moon className="h-3.5 w-3.5" />
        Dark
      </button>
    </div>
  );
}
