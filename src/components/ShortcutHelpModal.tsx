// ============================================================
// ShortcutHelpModal — `?` / `/` / `Cmd+/` でキーボードショートカット一覧
// OS 自動判定 (Mac = ⌘ / Win = Ctrl)、検索フィルター付き
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function detectMod(): string {
  if (typeof navigator === 'undefined') return '⌘';
  const p = (navigator.platform || '').toLowerCase();
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMac = p.includes('mac') || ua.includes('mac');
  return isMac ? '⌘' : 'Ctrl';
}

interface Shortcut {
  keys: string[];
  label: string;
  desc?: string;
  category?: string;
}

function buildShortcuts(mod: string): Shortcut[] {
  return [
    // ヘルプ
    { category: 'ヘルプ', keys: ['?'], label: 'ショートカット一覧を開く', desc: 'このモーダル' },
    { category: 'ヘルプ', keys: ['/'], label: 'ショートカット一覧を開く', desc: '? と同じ' },
    { category: 'ヘルプ', keys: [mod, '/'], label: 'ショートカット一覧 / AIサポート開閉' },

    // ナビゲーション
    { category: 'ナビゲーション', keys: [mod, 'K'], label: 'コマンドパレット', desc: '横断検索 + クイック操作' },
    { category: 'ナビゲーション', keys: [mod, ','], label: '設定を開く', desc: 'Settings / Preferences' },
    { category: 'ナビゲーション', keys: ['Esc'], label: 'モーダル / ドロワーを閉じる' },

    // 作成・編集
    { category: '作成・編集', keys: [mod, 'N'], label: '新規ペルソナ / 新規ノート', desc: 'コンテキストに応じて作成' },
    { category: '作成・編集', keys: [mod, 'S'], label: '保存', desc: '編集中の内容を保存' },
    { category: '作成・編集', keys: ['Enter'], label: '送信', desc: 'チャット入力時' },
    { category: '作成・編集', keys: ['Shift', 'Enter'], label: '改行', desc: 'チャット入力時' },

    // タブ切替 (Iris)
    { category: 'タブ切替 (Iris)', keys: [mod, '1'], label: 'タブ 1 へ切替' },
    { category: 'タブ切替 (Iris)', keys: [mod, '2'], label: 'タブ 2 へ切替' },
    { category: 'タブ切替 (Iris)', keys: [mod, '3'], label: 'タブ 3 へ切替' },
    { category: 'タブ切替 (Iris)', keys: [mod, '4'], label: 'タブ 4 へ切替' },
    { category: 'タブ切替 (Iris)', keys: [mod, '5'], label: 'タブ 5 へ切替' },
    { category: 'タブ切替 (Iris)', keys: [mod, '6〜9'], label: 'タブ 6〜9 へ切替' },

    // Chrome 拡張
    { category: 'Chrome 拡張', keys: ['Alt', 'P'], label: 'Chrome 拡張で Prism を開く' },
    { category: 'Chrome 拡張', keys: ['Alt', 'I'], label: 'Chrome 拡張で Iris を開く' },

    // 高度
    { category: '高度', keys: [mod, '.'], label: 'マスターモード切替', desc: 'オーナー専用' },
  ];
}

interface Props {
  open?: boolean;
  onClose?: () => void;
}

export default function ShortcutHelpModal({ open: openProp, onClose }: Props = {}) {
  const [open, setOpen] = useState<boolean>(!!openProp);
  const [query, setQuery] = useState<string>('');
  const mod = useMemo(() => detectMod(), []);
  const shortcuts = useMemo(() => buildShortcuts(mod), [mod]);

  useEffect(() => {
    if (openProp !== undefined) setOpen(openProp);
  }, [openProp]);

  // グローバル keydown: ? / / / Cmd+/ / Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isInput = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t as any).isContentEditable);

      // Esc は常に許可 (モーダル内検索欄からも閉じれる)
      if (e.key === 'Escape' && open) {
        setOpen(false);
        onClose?.();
        return;
      }

      // input/textarea 内では発火させない
      if (isInput) return;

      // ? キー (Shift + /)
      if (e.key === '?') {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // / キー単体
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      // Cmd+/ or Ctrl+/
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 検索フィルター
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shortcuts;
    return shortcuts.filter(s =>
      s.label.toLowerCase().includes(q) ||
      (s.desc || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q) ||
      s.keys.join(' ').toLowerCase().includes(q)
    );
  }, [shortcuts, query]);

  // カテゴリーごとにグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, Shortcut[]>();
    for (const s of filtered) {
      const cat = s.category || 'その他';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setOpen(false); onClose?.(); }}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-0 z-[91] flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto"
              style={{
                width: '92%',
                maxWidth: 580,
                maxHeight: 'calc(100dvh - 2rem)',
                overflowY: 'auto',
                background: 'rgba(15,15,25,0.92)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 18,
                padding: '22px 24px',
                color: '#fff',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                    KEYBOARD SHORTCUTS
                  </p>
                  <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>ショートカット一覧</h2>
                </div>
                <button
                  onClick={() => { setOpen(false); onClose?.(); }}
                  style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              {/* 検索フィルター */}
              <div style={{ marginBottom: 14 }}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ショートカットを検索 (例: 保存, タブ, 新規)"
                  autoFocus
                  style={{
                    width: '100%',
                    minHeight: 40,
                    padding: '0 14px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {grouped.length === 0 && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '24px 0' }}>
                  該当するショートカットが見つかりませんでした
                </p>
              )}

              <div style={{ display: 'grid', gap: 14 }}>
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <p style={{
                      fontSize: 10, letterSpacing: '0.2em', fontWeight: 700,
                      color: 'rgba(255,255,255,0.4)', marginBottom: 6, paddingLeft: 4,
                    }}>
                      {cat.toUpperCase()}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                      {items.map((s, i) => (
                        <li
                          key={`${cat}-${i}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 10,
                          }}
                        >
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {s.keys.map((k, j) => (
                              <span
                                key={j}
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 9px',
                                  minWidth: 28,
                                  textAlign: 'center',
                                  background: 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.18)',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                                  fontWeight: 600,
                                }}
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</p>
                            {s.desc && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{s.desc}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
                <strong>?</strong> / <strong>/</strong> / <strong>{mod}+/</strong> でいつでもこの一覧を開けます
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
