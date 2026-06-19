// ============================================================
// WeeklyValueCard — 「今週、AI役員があなたのために動いた量」
//
// 価値の可視化（オーナー方針 2026-06-13 / 価値で価格を超える）:
//   払う価値を"毎日体感"させる。実データの件数だけを正直に見せ、
//   0 のときは捏造せず「これから貯まる」導線を出す（honest-numbers）。
// ============================================================
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Sparkles, Send, BookOpen, Briefcase, Activity, FileCheck, TrendingUp } from 'lucide-react';
import { computeWeeklyValue, type ValueMetric } from '../lib/weeklyValue';

const ICONS: Record<ValueMetric['icon'], (p: { size?: number; color?: string }) => ReactElement> = {
  sparkles: (p) => <Sparkles size={p.size} color={p.color} strokeWidth={2.1} />,
  send: (p) => <Send size={p.size} color={p.color} strokeWidth={2.1} />,
  book: (p) => <BookOpen size={p.size} color={p.color} strokeWidth={2.1} />,
  briefcase: (p) => <Briefcase size={p.size} color={p.color} strokeWidth={2.1} />,
  activity: (p) => <Activity size={p.size} color={p.color} strokeWidth={2.1} />,
  'file-check': (p) => <FileCheck size={p.size} color={p.color} strokeWidth={2.1} />,
};

export default function WeeklyValueCard({ onRunLoop }: { onRunLoop?: () => void }) {
  const [data, setData] = useState(() => computeWeeklyValue());

  // ループ完了やナレッジ追加で localStorage が変わったら再集計
  useEffect(() => {
    const refresh = () => setData(computeWeeklyValue());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    const t = window.setInterval(refresh, 20_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.clearInterval(t);
    };
  }, []);

  const { metrics, total } = data;
  const empty = total === 0;

  return (
    <div style={{
      padding: '15px 15px 16px', borderRadius: 16, marginBottom: 14,
      background: 'linear-gradient(135deg, rgba(142,92,255,0.12), rgba(46,111,255,0.05))',
      border: '1px solid rgba(142,92,255,0.30)', color: 'var(--fg)',
    }}>
      {/* ヘッダ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg,#8E5CFF,#2E6FFF)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(142,92,255,0.40)',
        }}><TrendingUp size={19} strokeWidth={2.3} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: 0, letterSpacing: '-0.01em' }}>
            今週、AI役員があなたのために動いた量
          </h3>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            {empty ? 'まだ記録がありません' : `直近7日で合計 ${total.toLocaleString('ja-JP')} 件`}
          </div>
        </div>
      </div>

      {empty ? (
        // 正直な空状態 — 嘘の数字を出さず、貯め方を案内
        <div style={{
          padding: '14px 14px', borderRadius: 12, background: 'var(--surface-3)',
          border: '1px dashed rgba(142,92,255,0.35)',
        }}>
          <p style={{ fontSize: 12.5, color: 'var(--fg)', lineHeight: 1.6, margin: '0 0 10px' }}>
            司令塔ループを回したり、メール・ドキュメントを取り込むと、AIがあなたのために動いた量がここに毎週たまっていきます。数字はすべて実際の活動だけを正直に表示します。
          </p>
          {onRunLoop && (
            <button onClick={onRunLoop} style={{
              padding: '10px 16px', minHeight: 44, borderRadius: 10, border: 'none',
              background: 'linear-gradient(90deg,#8E5CFF,#2E6FFF)', color: '#fff',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(142,92,255,0.4)',
            }}>
              ループを回して最初の一手を作る
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
          {metrics.map((m) => {
            const Icon = ICONS[m.icon];
            return (
              <div key={m.key} style={tile(m.color)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Icon size={15} color={m.color} />
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1.5px 6px', borderRadius: 999,
                    background: `${m.color}1f`, color: m.color,
                  }}>{m.window === 'week' ? '今週' : '今月'}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--fg-strong)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {m.count.toLocaleString('ja-JP')}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--fg-muted)', marginTop: 4, lineHeight: 1.35 }}>
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '11px 2px 0', lineHeight: 1.5 }}>
        ※ 表示はすべて、あなたのこのアプリ内での実際の活動件数です。推定や水増しは行っていません。
      </p>
    </div>
  );
}

function tile(color: string): CSSProperties {
  return {
    padding: '11px 11px 12px', borderRadius: 13,
    background: 'var(--surface-3)', border: `1px solid ${color}33`,
  };
}
