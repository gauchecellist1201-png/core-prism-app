// ============================================================
// ExecutiveBriefingsTab — 「役員 日報」 タブ
//
// オーナー指示 (2026-06-05):
//   「13 名 の 役員 が 勝手 に 仕事 を こなした 成果物 を、
//    アプリ内 で 全部 見える 様 に。 誰 が 何を どの ナレッジ を 元に
//    作った のか 含めて、 ファイル みたい に 蓄積 される タブ。」
//
// 設計:
//   - 上: KPI バッジ (今日 / 今週 / 累計) + 「未読 N 件」
//   - 中: フィルタ (役員 / カテゴリ / 期間)
//   - 下: 成果物 リスト → 1 件 タップで 詳細 (markdown 全文 + 操作)
//   - 操作: 📋 コピー / ⬇ ダウンロード (.md) / 📚 ナレッジ化 / 📌 ピン / 🗑 削除
//
// やさしい 言葉 ルール: 「成果物」 → 「役員 が 作った もの」 と 平易 に
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  listDeliverables, markViewed, markAllViewed, togglePin, removeDeliverable,
  statsForPersona, seedDemoDeliverables, CATEGORY_LABEL,
  type CxoDeliverable, type DeliverableCategory,
} from '../lib/cxoDeliverables';
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import type { Persona } from '../types/identity';
import { copyText } from '../lib/clipboard';
import { confirmAction } from '../lib/confirmDialog';
import EmptyState from './EmptyState';

interface Props {
  persona: Persona;
  onSaveAsKnowledge?: (title: string, content: string) => void;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'all';

export default function ExecutiveBriefingsTab({ persona, onSaveAsKnowledge }: Props) {
  const [items, setItems] = useState<CxoDeliverable[]>(() => listDeliverables(persona.id));
  const [openId, setOpenId] = useState<string | null>(null);
  const [cxoFilter, setCxoFilter] = useState<CxoRole | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<DeliverableCategory | 'all'>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('week');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string>('');

  // 初回 ロード時 に デモ シード を 入れる (空の 場合 のみ)
  useEffect(() => {
    seedDemoDeliverables(persona.id);
    setItems(listDeliverables(persona.id));
  }, [persona.id]);

  // 他 コンポ から logDeliverable() された 時 に 自動 更新
  useEffect(() => {
    const onAdded = () => setItems(listDeliverables(persona.id));
    window.addEventListener('core:deliverable-added', onAdded);
    return () => window.removeEventListener('core:deliverable-added', onAdded);
  }, [persona.id]);

  const stats = useMemo(() => statsForPersona(persona.id), [persona.id, items]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400_000;
    return items.filter((d) => {
      if (cxoFilter !== 'all' && d.cxoRole !== cxoFilter) return false;
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      const age = now - new Date(d.createdAt).getTime();
      if (periodFilter === 'today' && age > dayMs) return false;
      if (periodFilter === 'week'  && age > dayMs * 7) return false;
      if (periodFilter === 'month' && age > dayMs * 30) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!(d.title + d.summary + d.content + d.cxoName).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, cxoFilter, categoryFilter, periodFilter, query]);

  // 利用 されている 役員 (フィルタ chips に 表示する 用)
  const activeCxos = useMemo(() => {
    const set = new Set<CxoRole>();
    items.forEach((d) => set.add(d.cxoRole));
    return Array.from(set);
  }, [items]);

  const toastIt = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(''), 2200); };

  const handleOpen = (id: string) => {
    setOpenId(id);
    markViewed(id);
    setItems(listDeliverables(persona.id));
  };

  const handleCopy = async (d: CxoDeliverable) => {
    await copyText(`${d.title}\n\n${d.content}`);
    toastIt('📋 全文 を コピー しました');
  };

  const handleDownload = (d: CxoDeliverable) => {
    const safeName = d.title.replace(/[^\p{L}\p{N}_\-]+/gu, '_').slice(0, 40);
    const filename = `${d.cxoRole}_${safeName}_${d.createdAt.slice(0, 10)}.md`;
    const body = `---\nCXO: ${d.cxoName} (${d.cxoRole})\n作成 日時: ${new Date(d.createdAt).toLocaleString('ja-JP')}\nカテゴリ: ${CATEGORY_LABEL[d.category].label}\n${d.knowledgeRef ? `参照 ナレッジ: ${d.knowledgeRef}\n` : ''}---\n\n# ${d.title}\n\n${d.content}\n`;
    const blob = new Blob([body], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toastIt(`⬇ ${filename} を ダウンロード しました`);
  };

  const handleSaveKb = (d: CxoDeliverable) => {
    if (!onSaveAsKnowledge) { toastIt('ナレッジ 保存 は ここ で 使えません'); return; }
    onSaveAsKnowledge(d.title, d.content);
    toastIt('📚 ナレッジ に 保存 しました');
  };

  const handleDelete = async (d: CxoDeliverable) => {
    if (!await confirmAction({
      title: 'この 成果物 を 削除 します か?',
      body: `${d.cxoName} が 作った 「${d.title}」 を 削除 します。`,
      tone: 'danger', okLabel: '削除',
    })) return;
    removeDeliverable(d.id);
    setItems(listDeliverables(persona.id));
    setOpenId(null);
    toastIt('🗑 削除 しました');
  };

  const accent = persona.accentColor || '#A78BFA';

  return (
    <div style={{
      padding: '24px 18px 80px', color: '#fff', minHeight: '100%',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      {/* ヘッダ */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 32 }}>📋</span>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>役員 日報</h1>
          {stats.unread > 0 && (
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 800,
              background: '#F472B6', color: '#fff',
            }}>未読 {stats.unread}</span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
          13 名 の AI 役員 が 「持ち主 の 代わり に やった 仕事」 が ここ に 全部 貯まります。
          ナレッジ を 渡せば、 戦略 と リスク は 役員 が 自分 で 考えて 進めます。
        </p>
      </div>

      {/* KPI バッジ 3 つ + 全部 既読 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        <Kpi label="今日 の 納品" value={stats.todayCount} unit="件" color="#34D399" emoji="📦" />
        <Kpi label="今週 の 納品" value={stats.weekCount} unit="件" color="#22D3EE" emoji="📅" />
        <Kpi label="累計" value={stats.totalCount} unit="件" color={accent} emoji="🗂️" />
        <div style={{
          padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <button
            onClick={() => { markAllViewed(persona.id); setItems(listDeliverables(persona.id)); toastIt('✓ 全部 既読 に しました'); }}
            disabled={stats.unread === 0}
            style={{
              fontSize: 11, padding: '6px 10px', borderRadius: 6, fontWeight: 700,
              background: stats.unread > 0 ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)',
              color: stats.unread > 0 ? accent : 'rgba(255,255,255,0.3)',
              border: `1px solid ${stats.unread > 0 ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
              cursor: stats.unread > 0 ? 'pointer' : 'default',
            }}
          >✓ 全部 既読 に</button>
        </div>
      </div>

      {/* フィルタ */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 タイトル / 内容 / 役員 名 で 検索…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {(['today', 'week', 'month', 'all'] as const).map((p) => (
          <FilterChip key={p} active={periodFilter === p} onClick={() => setPeriodFilter(p)} accent={accent}>
            {p === 'today' ? '今日' : p === 'week' ? '今週' : p === 'month' ? '今月' : '全部'}
          </FilterChip>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <FilterChip active={cxoFilter === 'all'} onClick={() => setCxoFilter('all')} accent={accent}>👑 全 役員</FilterChip>
        {activeCxos.map((r) => {
          const m = CXO_META[r];
          return (
            <FilterChip key={r} active={cxoFilter === r} onClick={() => setCxoFilter(r)} accent={accent}>
              {m.emoji} {r}
            </FilterChip>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} accent={accent}>📦 全カテゴリ</FilterChip>
        {(Object.keys(CATEGORY_LABEL) as DeliverableCategory[]).map((c) => {
          const cm = CATEGORY_LABEL[c];
          if (!stats.byCategory[c]) return null;
          return (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)} accent={accent}>
              {cm.emoji} {cm.label}
            </FilterChip>
          );
        })}
      </div>

      {/* リスト */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title={items.length === 0 ? 'まだ 役員 が 何も 作って いません' : '該当 する 成果物 が ありません'}
          description={items.length === 0
            ? 'ダッシュボード の AI 軍団 ボタン や、 各 Studio で 「✨ 任せる」 を 押すと、\n役員 が 仕事 を 始めて ここ に 成果物 が 並びます。'
            : '期間 / 役員 / カテゴリ の フィルタ を 緩める と 出て きます。'}
          accent={accent}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((d) => {
            const meta = CXO_META[d.cxoRole];
            const cm = CATEGORY_LABEL[d.category];
            const ageMin = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / 60000);
            const ageLabel = ageMin < 1 ? 'たった今'
              : ageMin < 60 ? `${ageMin} 分前`
              : ageMin < 1440 ? `${Math.floor(ageMin / 60)} 時間前`
              : `${Math.floor(ageMin / 1440)} 日前`;
            return (
              <button
                key={d.id}
                onClick={() => handleOpen(d.id)}
                style={{
                  textAlign: 'left', padding: '14px 14px', borderRadius: 12,
                  background: !d.viewed ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${!d.viewed ? accent + '40' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', color: 'inherit', position: 'relative',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                {!d.viewed && (
                  <span style={{
                    position: 'absolute', top: 10, right: 10, width: 8, height: 8,
                    borderRadius: 999, background: '#F472B6',
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 999, fontWeight: 800, letterSpacing: '0.06em',
                    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
                  }}>{meta.emoji} {d.cxoRole}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 700,
                    background: cm.color + '22', color: cm.color, border: `1px solid ${cm.color}55`,
                  }}>{cm.emoji} {cm.label}</span>
                  {d.pinned && <span style={{ fontSize: 10, color: '#FBBF24' }}>📌 ピン</span>}
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.52)', marginLeft: 'auto' }}>{ageLabel}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35 }}>{d.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{d.summary}</div>
                {d.knowledgeRef && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.52)', marginTop: 2 }}>
                    📂 参照: {d.knowledgeRef}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 詳細 モーダル */}
      <AnimatePresence>
        {openId && (() => {
          const d = items.find((x) => x.id === openId);
          if (!d) return null;
          const meta = CXO_META[d.cxoRole];
          const cm = CATEGORY_LABEL[d.category];
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 70,
                background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
              }}
              onClick={() => setOpenId(null)}
            >
              <motion.div
                initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%', maxWidth: 760, maxHeight: 'calc(100dvh - 28px)',
                  background: '#15151c', borderRadius: 16, overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* ヘッダ */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 999, fontWeight: 800,
                      background: 'rgba(255,255,255,0.08)',
                    }}>{meta.emoji} {d.cxoName}</span>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 700,
                      background: cm.color + '22', color: cm.color, border: `1px solid ${cm.color}55`,
                    }}>{cm.emoji} {cm.label}</span>
                    {d.durationSec != null && (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>⏱ {d.durationSec} 秒 で 完了</span>
                    )}
                    <button onClick={() => setOpenId(null)} aria-label="閉じる" style={{
                      marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 999,
                      color: 'rgba(255,255,255,0.7)', fontSize: 20, cursor: 'pointer', padding: 0, flexShrink: 0,
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}>×</button>
                  </div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, lineHeight: 1.35 }}>{d.title}</h2>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {new Date(d.createdAt).toLocaleString('ja-JP')}
                  </div>
                  {d.knowledgeRef && (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 8,
                      background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.18)',
                      fontSize: 11, color: 'rgba(34,211,238,0.85)',
                    }}>
                      📂 ナレッジ 参照: {d.knowledgeRef}
                    </div>
                  )}
                </div>
                {/* 本文 */}
                <div style={{
                  flex: 1, overflow: 'auto', padding: '16px 18px',
                  fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.88)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {d.content}
                </div>
                {/* アクション バー */}
                <div style={{
                  padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', gap: 8, flexWrap: 'wrap', background: 'rgba(0,0,0,0.3)',
                }}>
                  <ActionBtn onClick={() => handleCopy(d)}>📋 コピー</ActionBtn>
                  <ActionBtn onClick={() => handleDownload(d)}>⬇ .md ダウンロード</ActionBtn>
                  {onSaveAsKnowledge && <ActionBtn onClick={() => handleSaveKb(d)}>📚 ナレッジに保存</ActionBtn>}
                  <ActionBtn onClick={() => { togglePin(d.id); setItems(listDeliverables(persona.id)); }}>
                    {d.pinned ? '📌 ピン 解除' : '📌 ピン 留め'}
                  </ActionBtn>
                  <ActionBtn onClick={() => handleDelete(d)} danger>🗑 削除</ActionBtn>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* トースト */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
              padding: '10px 18px', borderRadius: 12, zIndex: 80,
              background: 'rgba(20,20,30,0.95)', color: '#fff', fontSize: 13, fontWeight: 700,
              border: '1px solid rgba(167,139,250,0.4)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ label, value, unit, color, emoji }: { label: string; value: number; unit: string; color: string; emoji: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12 }}>{emoji}</span> {label}
      </div>
      <div style={{ fontSize: '1.2rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, accent = '#A78BFA' }: { active: boolean; onClick: () => void; children: React.ReactNode; accent?: string }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '5px 10px', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
      background: active ? `${accent}2e` : 'rgba(255,255,255,0.04)',
      color: active ? accent : 'rgba(255,255,255,0.6)',
      border: `1px solid ${active ? accent + '66' : 'rgba(255,255,255,0.08)'}`,
    }}>{children}</button>
  );
}

function ActionBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '7px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer',
      background: danger ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
      color: danger ? '#FCA5A5' : 'rgba(255,255,255,0.85)',
      border: `1px solid ${danger ? 'rgba(248,113,113,0.32)' : 'rgba(255,255,255,0.12)'}`,
    }}>{children}</button>
  );
}
