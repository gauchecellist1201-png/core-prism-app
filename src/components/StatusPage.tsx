// ============================================================
// StatusPage — /status 公開 稼働状況 ページ
//
// 2026-08-03 作り直し:
//   旧版は /api/status が 22 秒かかるのに 12 秒で打ち切っていたため、
//   実際には毎回失敗していた。にもかかわらず見出しは「すべて正常」のまま、
//   その下に英語のエラー原文と内部用語 (env keys / Upstash) が出ていた。
//
//   直したこと:
//   1. **測れていないものを「正常」と言わない** (取得前・失敗時は「確認中 / 確認できません」)
//   2. エラーは日本語で「何が起きたか + 次にどうするか」+ もう一度ためすボタン
//   3. 90 日ヒートマップを廃止 — 障害記録が 1 件も無い状態で 90 日ぶんを緑に
//      塗るのは「無事故だった」という作り話になるため
//   4. 中身を「7 つのサービスが今ひらけるか」の実測に統一
// ============================================================

import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion, RefreshCw, CheckCircle2, AlertCircle, XCircle, ExternalLink } from 'lucide-react';

interface PublicService { name: string; what?: string; ok: boolean | null; latencyMs: number | null; note: string }
interface Incident { date: string; title: string; status: 'investigating' | 'monitoring' | 'resolved'; minutesDown?: number }

interface StatusData {
  asOf: string;
  overall: 'operational' | 'degraded' | 'major_outage' | 'unknown';
  services: PublicService[];
  incidents: Incident[];
  incidentsKnown?: boolean;
  recordingSince?: string;
}

const PALETTE = {
  operational: { color: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: <ShieldCheck size={26} />,    label: '7つとも ひらけています' },
  degraded:    { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)', icon: <ShieldAlert size={26} />,    label: '一部で 不具合が出ています' },
  major_outage:{ color: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: <ShieldX size={26} />,       label: '複数のサービスが ひらけません' },
  unknown:     { color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: <ShieldQuestion size={26} />,label: 'いま 確認しています' },
} as const;

const BORDER = '1px solid rgba(255,255,255,0.08)';
const CARD_BG = 'rgba(255,255,255,0.04)';

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = '稼働状況（いま ひらけるか） — CORE'; }, []);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      // 実測に 8 秒ほどかかることがあるため 20 秒まで待つ
      const res = await fetchWithTimeout(`/api/status?t=${Date.now()}`, { headers: { Accept: 'application/json' } }, 20000);
      if (!res.ok) throw new Error('SERVER');
      setData(await res.json() as StatusData);
    } catch {
      setData(null);
      setErr('いまの状況を取りにいけませんでした。通信が不安定なときに起きます。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, []);

  // データが無いあいだは「正常」と言わない
  const overall: keyof typeof PALETTE = data?.overall || 'unknown';
  const pal = PALETTE[overall];

  return (
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 18px 80px' }}>
        <a href="/corp" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 12 }}>
          <ArrowLeft size={14} /> CORE のトップへ
        </a>

        {/* 全体 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: pal.bg,
          border: `1px solid ${pal.color}44`,
          borderRadius: 18,
          padding: '20px 22px',
          marginBottom: 18,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${pal.color}, ${pal.color}aa)`,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 10px 24px ${pal.color}55`,
            flexShrink: 0,
          }}>{pal.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: pal.color, fontWeight: 800 }}>CORE 稼働状況</div>
            <h1 style={{ fontSize: 'clamp(1.25rem, 4.4vw, 2rem)', margin: '4px 0 4px', fontWeight: 900, lineHeight: 1.3 }}>
              {err && !loading ? 'いま 確認できていません' : pal.label}
            </h1>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)' }}>
              {loading
                ? 'いま ひとつずつ ひらいて確かめています…'
                : data?.asOf
                  ? `${new Date(data.asOf).toLocaleString('ja-JP')} に確認`
                  : 'まだ確認できていません'}
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, margin: '0 0 22px' }}>
          このページを開くたびに、CORE の 7 つのサービスの本番ページへ実際にアクセスして、
          ひらけたかどうかを測っています。書いてあるのは実測の結果だけです。
        </p>

        {err && (
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.32)',
            color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', marginBottom: 18, lineHeight: 1.75,
          }}>
            <strong style={{ color: '#FBBF24' }}>いま 状況を確認できていません</strong><br />
            {err}<br />
            もう一度おためしいただくか、しばらくしてからご覧ください。
            それでも直らないときは <a href="/contact" style={{ color: '#93C5FD' }}>お問い合わせ</a> からお知らせください。
            <div style={{ marginTop: 12 }}>
              <button onClick={load} disabled={loading} style={btnStyle}>
                <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> もう一度ためす
              </button>
            </div>
          </div>
        )}

        {/* サービス一覧 */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>サービスごとの状況</h2>
        <div style={{ background: CARD_BG, border: BORDER, borderRadius: 16, overflow: 'hidden', marginBottom: 14 }}>
          {(data?.services || []).map((s, i, arr) => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            }}>
              <ServiceIcon ok={s.ok} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  {s.what ? `${s.what} · ` : ''}{s.note}{s.latencyMs ? ` · ${s.latencyMs}ミリ秒` : ''}
                </div>
              </div>
              <ServiceBadge ok={s.ok} />
            </div>
          ))}
          {(!data?.services || data.services.length === 0) && (
            <div style={{ padding: 18, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
              {loading ? 'ひとつずつ ひらいて確かめています…' : 'まだ確認できていません。上の「もう一度ためす」を押してください。'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
          <button onClick={load} disabled={loading} style={btnStyle}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> いま測りなおす
          </button>
        </div>

        {/* 障害の記録 */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '8px 0 12px' }}>不具合の記録</h2>
        <div style={{ background: CARD_BG, border: BORDER, borderRadius: 16, overflow: 'hidden' }}>
          {(data?.incidents || []).length === 0 ? (
            <div style={{ padding: '16px 18px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
              いまのところ、記録されている不具合はありません。
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
                記録をとりはじめたのは {data?.recordingSince || '2026-08-03'} です。
                それより前に不具合が無かった、という意味ではありません。
                これから起きたものは、日付と内容をここに残していきます。
              </div>
            </div>
          ) : (
            (data?.incidents || []).map((inc, i, arr) => (
              <div key={inc.date + i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px',
                borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <IncidentDot status={inc.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{inc.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    {inc.date} · {inc.status === 'resolved' ? '解決済み' : inc.status === 'monitoring' ? '様子を見ています' : '調べています'}
                    {inc.minutesDown ? ` · 影響したと思われる時間 ${inc.minutesDown} 分` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 近くのページ */}
        <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a href="/trust" style={linkStyle}>データの取り扱い <ExternalLink size={12} /></a>
          <a href="/faq" style={linkStyle}>よくある質問 <ExternalLink size={12} /></a>
          <a href="/contact" style={linkStyle}>お問い合わせ <ExternalLink size={12} /></a>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 1.8 }}>
          2 分ごとに自動で測りなおします。運営責任者: 井出 直毅（CORE）
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  minHeight: 44, padding: '10px 16px', borderRadius: 12,
  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(255,255,255,0.15)',
  cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

const linkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  minHeight: 44, padding: '10px 16px', borderRadius: 12,
  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
  border: '1px solid rgba(255,255,255,0.12)',
  textDecoration: 'none', fontSize: '0.85rem', fontWeight: 700,
};

function ServiceIcon({ ok }: { ok: boolean | null }) {
  if (ok === true)  return <CheckCircle2 size={22} color="#34D399" />;
  if (ok === false) return <XCircle size={22} color="#F87171" />;
  return <AlertCircle size={22} color="rgba(255,255,255,0.4)" />;
}

function ServiceBadge({ ok }: { ok: boolean | null }) {
  const map = ok === true
    ? { c: '#34D399', t: 'ひらけます' }
    : ok === false
      ? { c: '#F87171', t: 'ひらけません' }
      : { c: 'rgba(255,255,255,0.45)', t: '確認できず' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
      padding: '5px 10px', borderRadius: 999,
      background: `${map.c}22`, color: map.c,
      border: `1px solid ${map.c}55`,
    }}>{map.t}</span>
  );
}

function IncidentDot({ status }: { status: Incident['status'] }) {
  const c = status === 'resolved' ? '#34D399'
          : status === 'monitoring' ? '#FBBF24' : '#F87171';
  return <span style={{ width: 10, height: 10, borderRadius: 5, background: c, marginTop: 6, flexShrink: 0 }} />;
}
