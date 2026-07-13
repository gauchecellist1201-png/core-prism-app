// ============================================================
// WeeklyValueCard — 「今週、AI役員があなたのために動いた量」
//
// 価値の可視化（オーナー方針 2026-06-13 / 価値で価格を超える）:
//   払う価値を"毎日体感"させる。実データの件数だけを正直に見せ、
//   0 のときは捏造せず「これから貯まる」導線を出す（honest-numbers）。
// ============================================================
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { Sparkles, Send, BookOpen, Briefcase, Activity, FileCheck, TrendingUp, Users, Check, UserRound, Coins } from 'lucide-react';
import { computeWeeklyValue, type ValueMetric, type DayBucket } from '../lib/weeklyValue';
import { statsForLastDays } from '../lib/aiSuggestionLog';
import { cxoActivityLastDays } from '../lib/cxoDeliverables';
import { CXO_META } from '../hooks/useAgentTaskQueue';
import { getEffectivePlanPriceJpy, loadBillingUser } from '../lib/billing';

// 役員 1 人分の集計（誰が・何件・うち採用）。件数はすべて実際に記録された提案の数（honest-numbers）。
interface ExecRow { key: string; name: string; count: number; adopted: number; color: string; Icon: (p: { size?: number; color?: string }) => ReactElement; }

// CXO_META から Lucide アイコン + 色を引く（絵文字は使わない）。未知キーは汎用アイコンにフォールバック。
// 「動いた回数」は 2 系統の実データを合算する（honest-numbers）:
//   ①提案の記録 (aiSuggestionLog) … 役員が「打ち手を提案した」回数（採用/却下つき）
//   ②成果物の納品 (cxoDeliverables) … 「今日の一手」タップ→AIが実際に成果物を作った回数
// ②は deliverable として別ログに入るため、以前はロスターに出ず実働が抜け落ちていた。
// 両方を役員キーで union し、実際に動いた役員をもれなく見せる（デモシードは②側で除外済み）。
function execRowsForWeek(): ExecRow[] {
  const meta = CXO_META as Record<string, { name: string; color: string; Icon: (p: { size?: number; color?: string }) => ReactElement }>;
  const merged = new Map<string, { key: string; name: string; count: number; adopted: number }>();
  for (const c of statsForLastDays(7).byCxo) {
    merged.set(c.key, { key: c.key, name: c.name, count: c.count, adopted: c.adopted });
  }
  for (const d of cxoActivityLastDays(7)) {
    const cur = merged.get(d.key);
    if (cur) cur.count += d.count;
    else merged.set(d.key, { key: d.key, name: d.name, count: d.count, adopted: 0 });
  }
  return [...merged.values()]
    .sort((a, b) => b.count - a.count)
    .map((c) => {
      const m = meta[c.key];
      return {
        key: c.key,
        // CXO_META の正式名を優先（無ければ記録時のキャッシュ名）。「CEO イーロン」等の頭の役職＋名前を短く。
        name: (m?.name || c.name || '役員').replace(/\s+/g, ' ').trim(),
        count: c.count,
        adopted: c.adopted,
        color: m?.color || '#8E5CFF',
        Icon: m?.Icon || ((p) => <UserRound size={p.size} color={p.color} strokeWidth={2.1} />),
      };
    });
}

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
  const [execs, setExecs] = useState<ExecRow[]>(() => execRowsForWeek());

  // ループ完了やナレッジ追加で localStorage が変わったら再集計。
  // 'storage' は別タブ用なので、同じタブでの成果（役員タップ→成果物）も即反映するため
  // 'core:value-updated' を購読する（AIが動いた瞬間に数字が増える＝価値を即体感）。
  // 提案の記録/採用は 'core:ai-suggestion-updated' で通知されるので、役員行もその場で更新。
  useEffect(() => {
    const refresh = () => { setData(computeWeeklyValue()); setExecs(execRowsForWeek()); };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('core:value-updated', refresh as EventListener);
    window.addEventListener('core:ai-suggestion-updated', refresh as EventListener);
    // 成果物が納品された瞬間も「動いた役員」に即反映（今日の一手タップ→AI成果物）。
    window.addEventListener('core:deliverable-added', refresh as EventListener);
    const t = window.setInterval(refresh, 20_000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('core:value-updated', refresh as EventListener);
      window.removeEventListener('core:ai-suggestion-updated', refresh as EventListener);
      window.removeEventListener('core:deliverable-added', refresh as EventListener);
      window.clearInterval(t);
    };
  }, []);

  // 実際に契約している月額（円）。free/トライアルは 0、master は Infinity → 0 扱い。
  // 「外注いくら相当」を"あなたが払っている月額"と honest に突き合わせて
  // 「もう元が取れている」を体感させる（月1万円の価値を毎日実感 / 解約防止）。
  const [monthlyPrice, setMonthlyPrice] = useState<number>(() => {
    const p = getEffectivePlanPriceJpy(loadBillingUser());
    return Number.isFinite(p) ? p : 0;
  });
  useEffect(() => {
    const refresh = () => {
      const p = getEffectivePlanPriceJpy(loadBillingUser());
      setMonthlyPrice(Number.isFinite(p) ? p : 0);
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const { metrics, total, todayTotal, dailySeries, estimatedYen } = data;
  // 役員の稼働記録も「動いた量」の一部。metrics が全0でも役員が動いていれば空状態にしない。
  const empty = total === 0 && execs.length === 0;
  // 直近7日に1日でも実活動があれば momentum バーを出す（嘘の0埋めは見せても、全0なら出さない）
  const seriesMax = dailySeries.reduce((m, d) => Math.max(m, d.count), 0);
  const activeDays = dailySeries.filter((d) => d.count > 0).length;

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
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span>{empty ? 'まだ記録がありません' : `直近7日で合計 ${total.toLocaleString('ja-JP')} 件`}</span>
            {todayTotal > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(6,199,85,0.15)', color: '#06C755',
                border: '1px solid rgba(6,199,85,0.35)',
              }}>
                今日 {todayTotal.toLocaleString('ja-JP')} 件
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 円換算 — 「外注に出せばいくら分」を控えめな相場下限で見せる。
          ¥10,000/月 の価値を毎週"体感"させる最強のレバー（テーマ② ROIを数字で）。
          嘘にならないよう「参考値・下限・実際の支払額ではない」を必ず併記する。 */}
      {!empty && estimatedYen > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12,
          padding: '12px 13px', borderRadius: 13,
          background: 'linear-gradient(135deg, rgba(6,199,85,0.14), rgba(46,111,255,0.06))',
          border: '1px solid rgba(6,199,85,0.32)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#06C755,#2E6FFF)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 12px rgba(6,199,85,0.35)',
          }}><Coins size={17} strokeWidth={2.3} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 1 }}>
              同じ量を外注に出すと
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--fg-strong)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                約 ¥{estimatedYen.toLocaleString('ja-JP')}
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#06C755' }}>相当を代わりに</span>
            </div>
          </div>
        </div>
      )}

      {/* 元が取れたか — 「外注いくら相当」を"あなたが払っている月額"と正直に突き合わせる。
          有料プランのときだけ表示（free/トライアルは月額0なので出さない＝嘘の元取れ表示をしない）。
          今週分（直近7日）だけで月額を超えていれば「もう元が取れている」と言い切れる（控えめ換算なので誇張にならない）。 */}
      {!empty && estimatedYen > 0 && monthlyPrice > 0 && (
        <Payback estimatedYen={estimatedYen} monthlyPrice={monthlyPrice} />
      )}

      {/* 7日 momentum — AIが「毎日動いている」を正直に可視化（実活動のある日だけ色が立つ） */}
      {!empty && seriesMax > 0 && (
        <Sparkbar series={dailySeries} max={seriesMax} activeDays={activeDays} />
      )}

      {/* 動いた役員 — 「誰が」あなたのために動いたかを実データで見せる（提案の記録件数＝honest-numbers） */}
      {execs.length > 0 && <ExecRoster rows={execs} />}

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
              background: 'linear-gradient(135deg,#8E5CFF,#2E6FFF)', color: '#fff',
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
        ※ 件数はすべて、あなたのこのアプリ内での実際の活動です。推定や水増しはしていません。円換算は外注に出した場合の相場下限で計算した参考値で、実際の支払額ではありません。
      </p>
    </div>
  );
}

// 動いた役員 — 「誰が」あなたのために動いたかを顔（Lucideアイコン）付きで見せる。
// 件数は statsForLastDays が返す実際の提案記録数。上位6名まで、多い順。採用があれば控えめに併記。
function ExecRoster({ rows }: { rows: ExecRow[] }) {
  const top = rows.slice(0, 6);
  const hidden = rows.length - top.length;
  const totalAdopted = rows.reduce((s, r) => s + r.adopted, 0);
  return (
    <div style={{
      marginBottom: 12, padding: '11px 12px 10px', borderRadius: 12,
      background: 'var(--surface-3)', border: '1px solid rgba(142,92,255,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '0.01em' }}>
          <Users size={12} strokeWidth={2.3} /> 動いた役員
        </span>
        {totalAdopted > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10.5, fontWeight: 800, color: '#06C755' }}>
            <Check size={11} strokeWidth={3} /> あなたが採用 {totalAdopted} 件
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {top.map((r) => {
          const Icon = r.Icon;
          return (
            <div key={r.key} title={`${r.name}: ${r.count}件${r.adopted > 0 ? `（採用${r.adopted}）` : ''}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '5px 10px 5px 6px', borderRadius: 999,
              background: `${r.color}14`, border: `1px solid ${r.color}44`,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: `${r.color}26`, color: r.color,
              }}><Icon size={13} color={r.color} /></span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-strong)', whiteSpace: 'nowrap' }}>
                {r.name}
              </span>
              <span style={{
                fontSize: 10.5, fontWeight: 900, color: r.color,
                padding: '1px 7px', borderRadius: 999, background: `${r.color}1f`,
              }}>{r.count}</span>
            </div>
          );
        })}
        {hidden > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', padding: '5px 4px' }}>
            ほか {hidden} 名
          </span>
        )}
      </div>
    </div>
  );
}

// 元が取れたか — 今週分の「外注いくら相当」を、あなたが払っている月額と正直に突き合わせる。
// honest-numbers: 今週分（直近7日）の控えめな換算だけで判定。誇張しない。
//   - 今週分 ≥ 月額 → 「もう今月分の元が取れています」＋（月額の何倍か）
//   - 今週分 < 月額 → 「月額のうち今週分で ◯% を回収」＋細い進捗バー
function Payback({ estimatedYen, monthlyPrice }: { estimatedYen: number; monthlyPrice: number }) {
  const paidBack = estimatedYen >= monthlyPrice;
  const pct = Math.min(100, Math.round((estimatedYen / monthlyPrice) * 100));
  const mult = Math.floor(estimatedYen / monthlyPrice); // 何倍（切り捨て）
  const accent = paidBack ? '#06C755' : '#8E5CFF';
  return (
    <div style={{
      marginBottom: 12, padding: '11px 12px', borderRadius: 12,
      background: 'var(--surface-3)', border: `1px solid ${accent}33`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: paidBack ? 0 : 8 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: `${accent}1f`, color: accent,
        }}>
          {paidBack ? <Check size={14} strokeWidth={3} /> : <TrendingUp size={13} strokeWidth={2.4} />}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-strong)', lineHeight: 1.45 }}>
          {paidBack ? (
            <>今週分だけで、月額 ¥{monthlyPrice.toLocaleString('ja-JP')} の<span style={{ color: accent }}>元が取れています</span>{mult >= 2 ? <span style={{ color: 'var(--fg-muted)', fontWeight: 700 }}>（月額の約 {mult} 倍）</span> : null}</>
          ) : (
            <>月額 ¥{monthlyPrice.toLocaleString('ja-JP')} のうち、今週分で <span style={{ color: accent }}>約 {pct}%</span> を回収</>
          )}
        </span>
      </div>
      {!paidBack && (
        <div style={{ height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 999,
            background: 'linear-gradient(90deg,#8E5CFF,#2E6FFF)',
            transition: 'width 0.5s cubic-bezier(.22,1,.36,1)',
          }} />
        </div>
      )}
    </div>
  );
}

// 7日 momentum バー — 実活動のある日だけ色が立つ。高さは件数比（最低でも触知できる芯を残す）。
function Sparkbar({ series, max, activeDays }: { series: DayBucket[]; max: number; activeDays: number }) {
  return (
    <div style={{
      marginBottom: 12, padding: '10px 12px 8px', borderRadius: 12,
      background: 'var(--surface-3)', border: '1px solid rgba(142,92,255,0.18)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '0.01em' }}>
          この7日間の動き
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#06C755' }}>
          7日のうち {activeDays} 日 稼働
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 40 }}>
        {series.map((d) => {
          const ratio = max > 0 ? d.count / max : 0;
          const h = d.count > 0 ? Math.max(6, Math.round(ratio * 34)) : 3;
          return (
            <div key={d.dayStart} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div title={`${d.count} 件`} style={{
                width: '100%', height: h, borderRadius: 5,
                background: d.count > 0
                  ? (d.isToday ? 'linear-gradient(180deg,#8E5CFF,#2E6FFF)' : 'rgba(142,92,255,0.55)')
                  : 'var(--border)',
                transition: 'height 0.4s cubic-bezier(.22,1,.36,1)',
              }} />
              <span style={{
                fontSize: 9, fontWeight: d.isToday ? 800 : 600,
                color: d.isToday ? '#8E5CFF' : 'var(--fg-subtle)',
              }}>{d.isToday ? '今日' : d.weekday}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function tile(color: string): CSSProperties {
  return {
    padding: '11px 11px 12px', borderRadius: 13,
    background: 'var(--surface-3)', border: `1px solid ${color}33`,
  };
}
