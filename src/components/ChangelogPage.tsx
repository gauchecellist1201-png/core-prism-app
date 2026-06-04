// ============================================================
// ChangelogPage — /changelog 公開変更履歴
//
// オーナー指示 (2026-06-04 第 37 波 VVVVV):
//   public/changelog.json を fetch して 整形表示。
//   セクション (新機能 / 修正 / 内部改善 等) で 折りたたみ + 日付別。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, ChevronDown, ChevronUp, GitCommit, Sparkles } from 'lucide-react';

// BBBBBB (2026-06-04): プレフィックス → カテゴリ 分類
type PrefixCat = 'feat' | 'fix' | 'docs' | 'refactor' | 'perf' | 'chore' | 'test' | 'style' | 'other';
const PREFIX_META: Record<PrefixCat, { label: string; color: string; emoji: string }> = {
  feat:     { label: '新機能',     color: '#34D399', emoji: '✨' },
  fix:      { label: '修正',       color: '#F87171', emoji: '🐛' },
  docs:     { label: 'ドキュメント', color: '#A78BFA', emoji: '📝' },
  refactor: { label: 'リファクタ',  color: '#FBBF24', emoji: '🔧' },
  perf:     { label: 'パフォ',     color: '#22D3EE', emoji: '⚡' },
  chore:    { label: '雑務',       color: '#94A3B8', emoji: '🧹' },
  test:     { label: 'テスト',     color: '#A855F7', emoji: '✅' },
  style:    { label: 'スタイル',   color: '#EC4899', emoji: '💅' },
  other:    { label: 'その他',     color: '#94A3B8', emoji: '🌀' },
};
function prefixOf(message: string): PrefixCat {
  const m = message.match(/^([a-z]+)(?:\([^)]*\))?:/);
  if (!m) return 'other';
  const p = m[1].toLowerCase();
  if (p in PREFIX_META) return p as PrefixCat;
  return 'other';
}

interface Item { hash: string; date: string; message: string; }
interface Section { category: string; items: Item[]; }
interface Changelog {
  generatedAt: string;
  sourceFile: string;
  totalCommits: number;
  sections: Section[];
}

export default function ChangelogPage() {
  const [data, setData] = useState<Changelog | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<PrefixCat | 'all'>('all');

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/changelog.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as Changelog;
      setData(j);
      // 「新機能」 だけ デフォルト 開く
      setOpenSection(new Set(j.sections.filter((s) => /新機能|新規/.test(s.category)).map((s) => s.category)));
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo<Section[]>(() => {
    if (!data) return [];
    const qn = q.trim().toLowerCase();
    return data.sections
      .map((s) => ({
        ...s,
        items: s.items.filter((it) => {
          if (qn && !(it.message.toLowerCase().includes(qn) || it.hash.startsWith(qn))) return false;
          if (activeCat !== 'all' && prefixOf(it.message) !== activeCat) return false;
          return true;
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [data, q, activeCat]);

  // カテゴリ別 件数 (全 sections フラットに)
  const catCounts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!data) return out;
    for (const s of data.sections) for (const it of s.items) {
      const c = prefixOf(it.message);
      out[c] = (out[c] || 0) + 1;
    }
    return out;
  }, [data]);

  const toggle = (cat: string) => {
    setOpenSection((s) => {
      const next = new Set(s);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const expandAll = () => setOpenSection(new Set(filtered.map((s) => s.category)));
  const collapseAll = () => setOpenSection(new Set());

  // 日付別 グループ化用
  const byDate = (items: Item[]) => {
    const m = new Map<string, Item[]>();
    for (const it of items) {
      const k = it.date;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 18px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> ホームへ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(167,139,250,0.4)',
            flexShrink: 0,
          }}><Sparkles size={26} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A78BFA', fontWeight: 800 }}>CHANGELOG</div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', margin: '4px 0 6px', fontWeight: 900, lineHeight: 1.25 }}>
              CORE Prism / Iris 変更履歴
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.6 }}>
              {data ? `${data.totalCommits} 件 の更新` : '読み込み中…'}
              {data?.generatedAt && (
                <span style={{ color: 'rgba(255,255,255,0.5)' }}> · 生成 {new Date(data.generatedAt).toLocaleString('ja-JP')}</span>
              )}
            </p>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 更新
          </button>
        </div>

        {err && (
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
            lineHeight: 1.6,
          }}>
            読み込み失敗: {err}<br />
            <span style={{ fontSize: '0.78rem', color: 'rgba(252,165,165,0.7)' }}>
              → リポジトリで <code>node scripts/syncChangelog.mjs</code> を実行し、 <code>public/changelog.json</code> を 生成してから デプロイしてください。
            </span>
          </div>
        )}

        {/* 検索 + 展開 */}
        {data && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
            flexWrap: 'wrap',
          }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="キーワード / hash で検索…"
              style={{
                flex: '1 1 240px',
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: '0.86rem',
                outline: 'none',
              }}
            />
            <button onClick={expandAll} style={btnGhost}>全部開く</button>
            <button onClick={collapseAll} style={btnGhost}>たたむ</button>
          </div>
        )}

        {/* BBBBBB (2026-06-04): プレフィックス カテゴリ フィルタ */}
        {data && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            <CatChip
              active={activeCat === 'all'}
              color="#A78BFA"
              emoji="🌍"
              label="すべて"
              count={data.totalCommits}
              onClick={() => setActiveCat('all')}
            />
            {(Object.keys(PREFIX_META) as PrefixCat[])
              .filter((k) => (catCounts[k] || 0) > 0)
              .sort((a, b) => (catCounts[b] || 0) - (catCounts[a] || 0))
              .map((k) => {
                const m = PREFIX_META[k];
                return (
                  <CatChip
                    key={k}
                    active={activeCat === k}
                    color={m.color}
                    emoji={m.emoji}
                    label={m.label}
                    count={catCounts[k] || 0}
                    onClick={() => setActiveCat(k)}
                  />
                );
              })}
          </div>
        )}

        {data && filtered.length === 0 && q && (
          <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
            「{q}」 に 一致する 履歴がありません。
          </div>
        )}

        {/* セクション */}
        {filtered.map((s) => {
          const open = openSection.has(s.category);
          const dateGroups = byDate(s.items);
          return (
            <div key={s.category} style={{
              marginBottom: 14,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => toggle(s.category)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 16px',
                  background: 'transparent', border: 'none',
                  color: '#fff', textAlign: 'left',
                  cursor: 'pointer', fontSize: '0.95rem', fontWeight: 800,
                }}
              >
                <span style={{ flex: 1 }}>{s.category}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{s.items.length} 件</span>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {open && (
                <div style={{ padding: '4px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {dateGroups.map(([date, items]) => (
                    <div key={date} style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', fontWeight: 800, marginBottom: 4, padding: '0 4px' }}>
                        {date}
                      </div>
                      {items.map((it) => {
                        const cat = prefixOf(it.message);
                        const m = PREFIX_META[cat];
                        return (
                          <div key={it.hash} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '8px 10px', borderRadius: 8,
                            borderLeft: `3px solid ${m.color}55`,
                            background: 'rgba(255,255,255,0.02)',
                            marginBottom: 4,
                          }}>
                            <GitCommit size={12} color={m.color} style={{ marginTop: 3, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.88)', lineHeight: 1.5 }}>
                                <span style={{
                                  fontSize: 10, padding: '1px 6px', borderRadius: 999,
                                  background: `${m.color}22`, color: m.color, fontWeight: 800,
                                  letterSpacing: '0.05em', marginRight: 6,
                                }}>{m.emoji} {m.label}</span>
                                {it.message}
                              </div>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Menlo, monospace', marginTop: 2 }}>{it.hash}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
          このページは <code>public/changelog.json</code> を 読み込んでいます。
          オーナー が <code>node scripts/syncChangelog.mjs</code> を実行する度に 最新化されます。
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
};

function CatChip({ active, color, emoji, label, count, onClick }: {
  active: boolean; color: string; emoji: string; label: string; count: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 999,
        background: active ? `${color}33` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
        color: active ? color : 'rgba(255,255,255,0.85)',
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 14 }}>{emoji}</span>
      {label}
      <span style={{ fontSize: 10, opacity: 0.75, marginLeft: 2 }}>({count})</span>
    </button>
  );
}
