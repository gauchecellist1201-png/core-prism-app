// ============================================================
// IRIS — Offer Triage View (案件メールを精査して詐欺見抜き + 魅力度判定)
// ============================================================
import { useState } from 'react';
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { triageOffer, type OfferTriageResult } from './offerTriage';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  mediaKit?: MediaKit;
  onSaveAsDeal?: (extracted: OfferTriageResult['extracted']) => void;
}

export default function IrisTriageView({ bg, settings, mediaKit, onSaveAsDeal }: Props) {
  const [emailText, setEmailText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<OfferTriageResult | null>(null);

  const inp = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.7rem 1rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
  } as React.CSSProperties;

  const card = {
    background: bg.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 22,
    padding: '1.4rem',
  } as React.CSSProperties;

  const btnPrimary = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.75rem 1.6rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.88rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 8px 22px ${bg.accent}55`,
  } as React.CSSProperties;

  const triage = async () => {
    if (!emailText.trim()) { setErr('案件メールを貼り付けてください'); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      setResult(await triageOffer({ settings, emailText, mediaKit }));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const verdictMeta = (v: OfferTriageResult['verdict']) => {
    switch (v) {
      case 'accept':    return { label: '受けていい', color: '#4ADE80', emoji: '' };
      case 'consider':  return { label: '検討の価値あり', color: '#A78BFA', emoji: '' };
      case 'negotiate': return { label: '交渉して受ける', color: '#FFA94D', emoji: '' };
      case 'decline':   return { label: '丁寧に辞退',   color: '#C8956D', emoji: '' };
      case 'block':     return { label: '関わらない',   color: '#C8102E', emoji: '' };
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
          The Triage
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.4rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          案件精査 AI
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          来た案件メールを丸ごと貼って。怪しいか・受けるべきか・いくら出すべきか、3 秒で判定。
        </p>
      </div>

      <div style={card}>
        <textarea style={{ ...inp, width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: '0.85rem' }}
          placeholder={'件名: 【ご依頼】Instagram タイアップのご相談\n\n△△様\n\nいつも投稿を拝見しております。\n弊社では...'}
          value={emailText} onChange={e => setEmailText(e.target.value)} />
        <button onClick={triage} disabled={busy} style={{ ...btnPrimary, marginTop: '0.5rem' }}>
          {busy ? '読んでます…' : '精査する'}
        </button>
      </div>

      {err && <div style={card}><p style={{ color: '#C8102E' }}>{err}</p></div>}

      {result && (
        <>
          {/* 判定サマリー */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent }}>Verdict</p>
                <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '2rem', fontWeight: 800, color: verdictMeta(result.verdict).color, lineHeight: 1.1, margin: '0.25rem 0' }}>
                  {verdictMeta(result.verdict).emoji} {verdictMeta(result.verdict).label}
                </p>
                <p style={{ color: bg.inkSoft, marginTop: '0.5rem', fontSize: '0.92rem' }}>{result.summary}</p>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <ScoreCircle bg={bg} label="安全度" value={result.safetyScore} color={result.safetyScore < 50 ? '#C8102E' : result.safetyScore < 75 ? '#FFA94D' : '#4ADE80'} />
                <ScoreCircle bg={bg} label="魅力度" value={result.attractScore} color={result.attractScore < 40 ? '#9088A8' : result.attractScore < 70 ? '#A78BFA' : '#E84B97'} />
              </div>
            </div>
          </div>

          {/* 警告 */}
          {result.redFlags.length > 0 && (
            <div style={{ ...card, border: `2px solid #C8102E` }}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C8102E', marginBottom: '0.75rem' }}>
                Red Flags
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {result.redFlags.map((f, i) => (
                  <div key={i} style={{
                    padding: '0.6rem 0.8rem', borderRadius: 12,
                    background: f.severity === 'high' ? 'rgba(200,16,46,0.1)' : f.severity === 'medium' ? 'rgba(255,169,77,0.1)' : 'rgba(0,0,0,0.04)',
                    borderLeft: `3px solid ${f.severity === 'high' ? '#C8102E' : f.severity === 'medium' ? '#FFA94D' : '#9088A8'}`,
                  }}>
                    <span style={{ fontWeight: 700, color: bg.ink }}>{f.kind}</span>
                    <p style={{ fontSize: '0.88rem', color: bg.inkSoft, marginTop: '0.25rem' }}>{f.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ポジティブ */}
          {result.positives.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#4ADE80', marginBottom: '0.5rem' }}>
                Positives
              </p>
              <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9 }}>
                {result.positives.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {/* 推奨アクション */}
          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
              Recommended Actions
            </p>
            <ol style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9 }}>
              {result.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          </div>

          {/* 報酬妥当性 */}
          {result.feeAssessment && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
                Fee Assessment
              </p>
              <p style={{ color: bg.ink }}>
                妥当レンジ: ¥{result.feeAssessment.estimatedFair.min.toLocaleString()} 〜 ¥{result.feeAssessment.estimatedFair.max.toLocaleString()}
                {result.feeAssessment.detected && (
                  <span style={{ marginLeft: '1rem', color: bg.accent }}>
                    提示: ¥{result.feeAssessment.detected.toLocaleString()} ({result.feeAssessment.verdict})
                  </span>
                )}
              </p>
              <p style={{ marginTop: '0.5rem', color: bg.inkSoft, fontSize: '0.88rem' }}>{result.feeAssessment.note}</p>
            </div>
          )}

          {/* 抽出メタ情報 */}
          {Object.keys(result.extracted).length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>
                Extracted
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                {Object.entries(result.extracted).map(([k, v]) => v ? (
                  <div key={k}>
                    <p style={{ fontSize: '0.72rem', color: bg.inkSoft, letterSpacing: '0.1em' }}>{k}</p>
                    <p style={{ color: bg.ink, fontWeight: 500 }}>{String(v)}</p>
                  </div>
                ) : null)}
              </div>
              {onSaveAsDeal && (
                <button onClick={() => onSaveAsDeal(result.extracted)} style={{ ...btnPrimary, marginTop: '1rem' }}>
                  案件として保存
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScoreCircle({ bg, label, value, color }: { bg: IrisBackgroundDef; label: string; value: number; color: string }) {
  const r = 36, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke={bg.cardBorder} strokeWidth={6} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 0.6s' }} />
        <text x={45} y={50} textAnchor="middle" fontSize="18" fontWeight="700" fill={bg.ink}>{value}</text>
      </svg>
      <p style={{ fontSize: '0.75rem', color: bg.inkSoft, marginTop: '0.2rem' }}>{label}</p>
    </div>
  );
}
