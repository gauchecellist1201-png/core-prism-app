// ============================================================
// KnowledgeUsage — /master/knowledge-usage オーナー専用 出典活用度 + 資料不一致率
//
// BACKLOG に残っていた「出典チップが押された回数」「関連資料0件のまま
// 答えた回答の割合」の計測が、計測基盤自体が無く未着手だったため追加。
// /api/track/knowledge-usage?days=14 を叩いて集計を表示するだけ。
// ============================================================

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';

interface DayRow { date: string; citationClicks: number; answerTotal: number; noMatch: number; noMatchRate: number; }
interface ApiResp { ok: boolean; configured: boolean; hint?: string; days: DayRow[]; }

export default function KnowledgeUsage() {
  const [data, setData] = useState<DayRow[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/track/knowledge-usage?days=14');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as ApiResp;
      setData(j.days || []);
      setConfigured(!!j.configured);
      setHint(j.hint || null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const totalClicks = data.reduce((a, d) => a + d.citationClicks, 0);
  const totalAnswers = data.reduce((a, d) => a + d.answerTotal, 0);
  const totalNoMatch = data.reduce((a, d) => a + d.noMatch, 0);
  const overallNoMatchRate = totalAnswers > 0 ? Math.round((totalNoMatch / totalAnswers) * 1000) / 10 : 0;

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
            background: 'linear-gradient(135deg, #6366F1, #A855F7)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 24px rgba(99,102,241,0.4)',
            flexShrink: 0,
          }}><BookOpen size={24} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A855F7', fontWeight: 800 }}>MASTER · KNOWLEDGE USAGE</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', margin: '4px 0 4px', fontWeight: 900 }}>
              出典活用度 — 直近 14 日
            </h1>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
              {configured === false
                ? hint || 'Upstash 未設定 — 集計は表示できません'
                : '出典チップのクリック回数と、関連資料0件のまま答えた割合を1画面で。'}
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
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
          }}>
            読み込み失敗: {err}
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24,
        }}>
          <KpiCard title="出典チップ クリック (14日計)" value={totalClicks.toLocaleString()} sub="押されるほど資料が信頼されている" color="#34D399" icon={<BookOpen size={16} />} />
          <KpiCard title="AI 回答 総数 (14日計)" value={totalAnswers.toLocaleString()} sub="分母" color="#94A3B8" />
          <KpiCard title="資料不一致 (14日計)" value={totalNoMatch.toLocaleString()} sub="関連資料0件のまま答えた回答" color="#FBBF24" icon={<AlertTriangle size={16} />} />
          <KpiCard title="資料不一致 率" value={`${overallNoMatchRate}%`} sub={`${totalNoMatch} / ${totalAnswers}`} color={overallNoMatchRate > 30 ? '#F87171' : '#34D399'} />
        </div>

        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>日別 (新しい順)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'auto', marginBottom: 24,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
                <th style={{ padding: '10px 14px', textAlign: 'left' }}>日付</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>チップ クリック</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>回答 総数</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>資料不一致</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>不一致 率</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d, i) => (
                <tr key={d.date + i} style={{ borderBottom: i === data.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px 14px', color: 'rgba(255,255,255,0.85)' }}>{d.date}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>{d.citationClicks}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>{d.answerTotal}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.85)' }}>{d.noMatch}</td>
                  <td style={{ padding: '8px 14px', textAlign: 'right', color: d.noMatchRate > 30 ? '#F87171' : 'rgba(255,255,255,0.6)' }}>
                    {d.noMatchRate}%
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>データ なし</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          ソース: <code>/api/track/knowledge-usage?days=14</code> · Upstash <code>knowledge:usage:&lt;date&gt;</code> ハッシュ
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function KpiCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 900, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}
