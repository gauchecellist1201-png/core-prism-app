// ============================================================
// StudioFunnel — /master/studio-funnel オーナー専用
//
// CORE Studio (/studio・/studio/film) の導線は、これまで logEvent() で
// **訪問者自身の localStorage** にしか記録されておらず、CORE 側には
// 1件も届いていなかった。「LINEが何回押されたか」「概算の何問目で
// 帰ったか」が全部見えないまま、LPだけを直し続けていた。
//
// /api/track/studio?days=14 の生カウントを読んで、
//   見た → 概算をはじめた → 何問目まで来た → 概算が出た → 相談を押した
// の順に並べるだけ。数字を作らない・埋めない (0 は 0 と書く)。
// ============================================================

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, BarChart3, MessageCircle, Film } from 'lucide-react';

interface DayRow { date: string; counts: Record<string, number> }
interface ApiResp { ok: boolean; configured: boolean; hint?: string; days: DayRow[] }

const TAB_LABEL: Record<string, string> = {
  home: 'ホーム', film: '映像制作', plans: 'サイト制作', dev: '受託開発',
  care: '運用', works: '実績', about: '会社案内', contact: 'お問い合わせ',
};

/** 概算ウィザードの質問。step は「その質問に答えて次へ進んだ回数」 */
const STEP_LABEL = [
  '1. 制作したいもの', '2. 規模', '3. CMSの要否',
  '4. 必要な機能', '5. 納期', '6. 予算 (答えると結果が出る)',
];

export default function StudioFunnel() {
  const [days, setDays] = useState<DayRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/track/studio?days=14');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as ApiResp;
      setDays(j.days || []);
      setConfigured(!!j.configured);
      setHint(j.hint || null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  /** 14日ぶんの合計。field 完全一致 */
  const sum = (field: string) => days.reduce((a, d) => a + (d.counts[field] || 0), 0);
  /** `<event>:` で始まるフィールドを内訳として集める (多い順) */
  const breakdown = (event: string) => {
    const acc: Record<string, number> = {};
    for (const d of days) {
      for (const [k, v] of Object.entries(d.counts)) {
        if (!k.startsWith(`${event}:`)) continue;
        const label = k.slice(event.length + 1);
        acc[label] = (acc[label] || 0) + v;
      }
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  };

  const views = sum('studio_tab_view');
  const estStart = sum('studio_estimate_start');
  const estDone = sum('studio_estimate_done');
  const lineCta = sum('studio_line_cta');
  const stepMap = Object.fromEntries(breakdown('studio_estimate_step'));
  const totalEvents = days.reduce((a, d) => a + Object.values(d.counts).reduce((x, y) => x + y, 0), 0);

  const pct = (n: number, base: number) => (base > 0 ? `${Math.round((n / base) * 1000) / 10}%` : '—');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #07071a 0%, #0d0d22 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 18px 80px' }}>
        <a href="/master" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> /master へ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #A8823C, #D4A94F)', color: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(168,130,60,0.4)', flexShrink: 0,
          }}><BarChart3 size={24} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#D4A94F', fontWeight: 800 }}>MASTER · STUDIO FUNNEL</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '4px 0 4px', fontWeight: 900 }}>
              CORE Studio の導線 — 直近 14 日
            </h1>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
              {configured === false
                ? hint || 'Upstash 未設定 — 記録は残っていません'
                : '見た → 概算をはじめた → 何問目まで来た → 相談を押した。'}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 更新
          </button>
        </div>

        {err && (
          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18 }}>
            読み込み失敗: {err}
          </div>
        )}

        {/* 計測が始まったばかりの日は 0 が並ぶ。0 を「反応が無かった」と読ませないための断り書き。
            ★読み込みに失敗した時は出さない。取ってこられなかっただけなのに
              「1件もありません」と並べると、失敗を「反応が無かった」と読ませてしまう。 */}
        {configured !== false && !loading && !err && totalEvents === 0 && (
          <Panel>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: 6 }}>まだ 1 件も記録がありません</div>
            <div style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.9 }}>
              この計測は 2026-08-30 に入れたばかりです。それ以前の /studio の反応は
              訪問者自身のブラウザにしか残っていないため、さかのぼって数えることはできません。
              「0 件」は「誰も来なかった」ではなく「まだ記録が無い」です。
            </div>
          </Panel>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <Kpi title="画面を見た" value={views} sub="タブの表示回数 (同じ人の移動も1回ずつ)" color="#94A3B8" />
          <Kpi title="概算をはじめた" value={estStart} sub={`1問目に答えた · 表示の ${pct(estStart, views)}`} color="#60A5FA" />
          <Kpi title="概算が出た" value={estDone} sub={`6問答えきった · はじめた人の ${pct(estDone, estStart)}`} color="#34D399" />
          <Kpi title="LINEを押した" value={lineCta} sub="押した＝連絡が来た、ではない" color="#D4A94F" icon={<MessageCircle size={14} />} />
        </div>

        <H2>概算ウィザード — どの質問まで来て帰ったか</H2>
        <Panel>
          {STEP_LABEL.map((label, i) => {
            const n = stepMap[String(i + 1)] || 0;
            const base = stepMap['1'] || 0;
            const w = base > 0 ? Math.round((n / base) * 100) : 0;
            return (
              <div key={label} style={{ padding: '9px 0', borderBottom: i === STEP_LABEL.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem', marginBottom: 5 }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
                  <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, flexShrink: 0 }}>{n}<span style={{ color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}> / {pct(n, base)}</span></span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, background: 'linear-gradient(90deg,#60A5FA,#34D399)' }} />
                </div>
              </div>
            );
          })}
          <Foot>「4. 必要な機能」だけは未選択でも次へ進めるため、他より落ちにくい。急に減る行の<b>ひとつ手前</b>の質問が重い。</Foot>
        </Panel>

        <H2>内訳</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
          <List title="見られたタブ" rows={breakdown('studio_tab_view').map(([k, v]) => [TAB_LABEL[k] || k, v])} />
          <List title="LINEを押した場所" rows={breakdown('studio_line_cta')} />
          <List title="出た概算プラン" rows={breakdown('studio_estimate_done')} />
          <List title="続きから開いた (何問目)" rows={breakdown('studio_estimate_resume').map(([k, v]) => [`${k}問目`, v])} />
        </div>

        <H2><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Film size={16} /> 映像制作タブ</span></H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <Kpi title="料金のCTAを押した" value={sum('studio_film_pricing_cta')} sub="プラン別は下の内訳" color="#94A3B8" />
          <Kpi title="決済へ進んだ" value={sum('studio_film_checkout_start')} sub="Stripe の決済ページへ" color="#34D399" />
          <Kpi title="決済が出せず控えへ" value={sum('studio_film_checkout_fallback')} sub="0 でないなら価格IDの設定漏れを疑う" color={sum('studio_film_checkout_fallback') > 0 ? '#F87171' : '#94A3B8'} />
          <Kpi title="相談を書き始めた / 送った" value={`${sum('studio_film_inquiry_start')} / ${sum('studio_film_inquiry_submit')}`} sub="送った＝LINEを開いた時点" color="#D4A94F" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
          <List title="料金CTA (プラン_行き先)" rows={breakdown('studio_film_pricing_cta')} />
          <List title="どこまで読んだか (%)" rows={breakdown('studio_film_scroll_depth')} />
        </div>

        <H2>日別 (新しい順)</H2>
        <Panel>
          {[...days].reverse().map(d => {
            const total = Object.entries(d.counts).filter(([k]) => !k.includes(':')).reduce((a, [, v]) => a + v, 0);
            return (
              <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>{d.date}</span>
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  表示 {d.counts['studio_tab_view'] || 0} ・ 概算 {d.counts['studio_estimate_start'] || 0} ・ LINE {d.counts['studio_line_cta'] || 0}
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>（全 {total}）</span>
                </span>
              </div>
            );
          })}
          {days.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>データ なし</div>}
        </Panel>

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.9 }}>
          ソース: <code>/api/track/studio?days=14</code> · Upstash <code>studio:funnel:&lt;date&gt;</code> ハッシュ (100日で消える)<br />
          同じ人が何度来ても別々に数える（人数ではなく回数）。広告ブロッカーやビーコンを止める設定の端末は数えられない。
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>{children}</h2>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 16px', marginBottom: 24 }}>
      {children}
    </div>
  );
}

function Foot({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, padding: '10px 0 4px' }}>{children}</div>;
}

function Kpi({ title, value, sub, color, icon }: { title: string; value: number | string; sub: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}33` }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 900, color, lineHeight: 1.2 }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3, lineHeight: 1.6 }}>{sub}</div>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {rows.length === 0
        ? <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>記録なし</div>
        : rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.82rem', padding: '4px 0' }}>
            <span style={{ color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, flexShrink: 0 }}>{v}</span>
          </div>
        ))}
    </div>
  );
}
