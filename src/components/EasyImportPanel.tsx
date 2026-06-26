// ============================================================
// EasyImportPanel — API キー不要の取り込み手段を集約
//
// オーナー指示 (2026-05-26):
// 「API 接続はユーザーにとってハードルが高い。他の方法でもっと簡単に
//  あらゆるツールと連携できる仕組みを」
//
// 3 つの代替パス:
//   📸 スクショで取り込む (画面の数字を AI が読み取り)   ← 着手中
//   📁 ファイル (CSV / Excel / PDF) で取り込む           ← 着手中
//   ✍️ 直接入力 (3 つの数字だけで概況反映)              ← 即動く
//
// データ保存:
//   manual 入力分は core_manual_revenue_v1 に。
//   useStripeRevenue が「Stripe 未連携かつ manual あり」のとき manual を採用。
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, FileSpreadsheet, Pencil, Check, X, Sparkles } from 'lucide-react';
import { confirmAction } from '../lib/confirmDialog';

export interface ManualRevenue {
  thisMonthRevenueJpy: number;
  thisMonthExpenseJpy: number;
  pipelineDealCount: number;
  enteredAt: string; // ISO
}

const MANUAL_KEY = 'core_manual_revenue_v1';

export function loadManualRevenue(): ManualRevenue | null {
  try {
    const raw = localStorage.getItem(MANUAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManualRevenue;
  } catch {
    return null;
  }
}

export function saveManualRevenue(v: ManualRevenue): void {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(v));
    window.dispatchEvent(new CustomEvent('core:manual-revenue-updated', { detail: v }));
  } catch { /* quota */ }
}

export function clearManualRevenue(): void {
  try { localStorage.removeItem(MANUAL_KEY); } catch { /* */ }
  window.dispatchEvent(new CustomEvent('core:manual-revenue-updated'));
}

type Mode = null | 'manual' | 'screenshot' | 'file';

export default function EasyImportPanel({ accent }: { accent: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [existing, setExisting] = useState<ManualRevenue | null>(() => loadManualRevenue());

  useEffect(() => {
    const onUpdate = () => setExisting(loadManualRevenue());
    window.addEventListener('core:manual-revenue-updated', onUpdate);
    return () => window.removeEventListener('core:manual-revenue-updated', onUpdate);
  }, []);

  const cards: Array<{
    id: Mode;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
    title: string;
    sub: string;
    badge?: string;
    enabled: boolean;
  }> = [
    { id: 'screenshot', icon: Camera, title: 'スクショで取り込む', sub: '画面の数字を AI が読み取り', badge: '近日', enabled: false },
    { id: 'file', icon: FileSpreadsheet, title: 'ファイルで取り込む', sub: 'CSV / Excel / PDF をドロップ', badge: '近日', enabled: false },
    { id: 'manual', icon: Pencil, title: '直接入力する', sub: '今月の数字を 3 つだけ入れる', enabled: true },
  ];

  return (
    <div style={{
      marginBottom: '1.1rem',
      padding: '0.9rem 1rem',
      background: `linear-gradient(135deg, ${accent}10, ${accent}04)`,
      border: `1px solid ${accent}33`,
      borderRadius: 14,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 800, letterSpacing: '0.2em',
        color: accent, marginBottom: 4,
      }}>
        <Sparkles size={11} /> API キー不要の取り込み
      </div>
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, marginBottom: 10 }}>
        慣れた方法を 1 つ選ぶだけ。3 つから選べます。
        {existing && (
          <span style={{ color: '#10B981', fontWeight: 700, marginLeft: 6 }}>
            ✓ 手動入力データあり
          </span>
        )}
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {cards.map(c => (
          <button
            key={String(c.id)}
            type="button"
            onClick={() => c.enabled && setMode(mode === c.id ? null : c.id)}
            disabled={!c.enabled}
            style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 8px',
              background: mode === c.id ? `${accent}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${mode === c.id ? accent + '88' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 11,
              color: c.enabled ? '#fff' : 'rgba(255,255,255,0.45)',
              cursor: c.enabled ? 'pointer' : 'not-allowed',
              opacity: c.enabled ? 1 : 0.6,
              textAlign: 'center',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {c.badge && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
                padding: '2px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)',
              }}>{c.badge}</span>
            )}
            <c.icon size={20} strokeWidth={2} />
            <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.3 }}>{c.title}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {mode === 'manual' && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <ManualEntryForm
              accent={accent}
              existing={existing}
              onClose={() => setMode(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ManualEntryForm({
  accent, existing, onClose,
}: {
  accent: string;
  existing: ManualRevenue | null;
  onClose: () => void;
}) {
  const [rev, setRev] = useState<string>(existing ? String(existing.thisMonthRevenueJpy) : '');
  const [exp, setExp] = useState<string>(existing ? String(existing.thisMonthExpenseJpy) : '');
  const [deals, setDeals] = useState<string>(existing ? String(existing.pipelineDealCount) : '');
  const [saved, setSaved] = useState(false);

  const parseNum = (s: string) => {
    const n = parseInt(s.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const handleSave = () => {
    const v: ManualRevenue = {
      thisMonthRevenueJpy: parseNum(rev),
      thisMonthExpenseJpy: parseNum(exp),
      pipelineDealCount: parseNum(deals),
      enteredAt: new Date().toISOString(),
    };
    saveManualRevenue(v);
    setSaved(true);
    setTimeout(() => { onClose(); }, 900);
  };

  const handleClear = async () => {
    if (!(await confirmAction({ title: '手動入力データを削除しますか?', body: '入力した売上・費用・案件数が消えます。', tone: 'danger', okLabel: '削除する' }))) return;
    clearManualRevenue();
    onClose();
  };

  const fields: Array<{
    key: 'rev' | 'exp' | 'deals';
    label: string;
    value: string;
    setter: (v: string) => void;
    suffix: string;
    placeholder: string;
  }> = [
    { key: 'rev', label: '今月の売上', value: rev, setter: setRev, suffix: '円', placeholder: '例: 3000000' },
    { key: 'exp', label: '今月の経費', value: exp, setter: setExp, suffix: '円', placeholder: '例: 800000' },
    { key: 'deals', label: '進行中の案件', value: deals, setter: setDeals, suffix: '件', placeholder: '例: 5' },
  ];

  return (
    <div style={{
      padding: '12px 14px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: 10,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#fff' }}>
          いまの状況を 30 秒で
        </div>
        <button
          type="button" onClick={onClose} aria-label="閉じる"
          style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><X size={14} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fields.map(f => (
          <div key={f.key}>
            <label style={{
              display: 'block', fontSize: 10.5, color: 'rgba(255,255,255,0.55)',
              fontWeight: 700, marginBottom: 3,
            }}>{f.label}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                inputMode="numeric"
                value={f.value}
                onChange={e => f.setter(e.target.value)}
                placeholder={f.placeholder}
                style={{
                  width: '100%', padding: '11px 38px 11px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 9,
                  color: '#fff', fontSize: 13, fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: 'rgba(255,255,255,0.45)',
              }}>{f.suffix}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button
          type="button" onClick={handleSave}
          disabled={saved}
          style={{
            flex: 1, minHeight: 42,
            padding: '11px 14px', borderRadius: 9,
            background: saved
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            color: '#fff', border: 'none',
            fontSize: 12.5, fontWeight: 800, cursor: saved ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          {saved ? <><Check size={14} /> 反映しました</> : '保存して反映'}
        </button>
        {existing && !saved && (
          <button
            type="button" onClick={handleClear}
            style={{
              minHeight: 42,
              padding: '11px 14px', borderRadius: 9,
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.14)',
              fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            }}
          >削除</button>
        )}
      </div>
      <p style={{
        fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55,
        marginTop: 8, marginBottom: 0,
      }}>
        後から Stripe をつなぐと、自動で実数字に切り替わります。
      </p>
    </div>
  );
}
