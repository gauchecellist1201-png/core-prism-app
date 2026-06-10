// ============================================================
// CommandTowerHub — 司令塔ループ（生きた図 + ループ実演）
//
// コーポレートサイト (CoreSite.tsx) の「司令塔 Prism + Iris/Resonance/Lume」
// 図を Prism 本体に常設し、実際に一周する体験にする。
//   - 中央 Prism、上 Iris、左下 Resonance、右下 Lume を配置
//   - シグナルがあるとノードが光り、コネクタ線が流れる
//   - 「ループを回す」で Lume→Iris→Prism(Haiku)→Resonance が一周
//   - ノードをタップ → そのチャネルの最近のシグナル + CTA
// ============================================================
import { useState, useEffect, useRef, type ReactElement } from 'react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo } from './Logo';
import {
  CHANNEL_META, loadSignals, channelStats, runLoop,
  type LoopChannel, type LoopSignal, type LoopStep,
} from '../lib/loop';

const LOGOS: Record<LoopChannel, (p: { size?: number }) => ReactElement> = {
  prism: (p) => <PrismLogo size={p.size} withWordmark={false} />,
  iris: (p) => <IrisLogo size={p.size} withWordmark={false} />,
  resonance: (p) => <ResonanceLogo size={p.size} withWordmark={false} />,
  lume: (p) => <LumeLogo size={p.size} withWordmark={false} />,
};

// ノード配置（% — 図と同じ三角配置）
const POS: Record<LoopChannel, { x: number; y: number }> = {
  prism: { x: 50, y: 50 },
  iris: { x: 50, y: 12 },
  resonance: { x: 16, y: 86 },
  lume: { x: 84, y: 86 },
};

const SPOKES: LoopChannel[] = ['iris', 'resonance', 'lume'];

// 接続状態（honest: Iris は実アプリ稼働、他は準備中）
const CONNECTED: Record<LoopChannel, 'live' | 'soon'> = {
  prism: 'live', iris: 'live', resonance: 'soon', lume: 'soon',
};

export default function CommandTowerHub() {
  const [signals, setSignals] = useState<LoopSignal[]>(() => loadSignals());
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<LoopStep[]>([]);
  const [activeLeg, setActiveLeg] = useState<LoopChannel | null>(null);
  const [selected, setSelected] = useState<LoopChannel | null>(null);
  const tick = useRef(0);

  const stats = channelStats(signals);

  // 軽いアイドル演出: 30 秒ごとに spoke を順に微発光
  const [idlePulse, setIdlePulse] = useState<LoopChannel | null>(null);
  useEffect(() => {
    if (running) return;
    const t = window.setInterval(() => {
      const leg = SPOKES[tick.current % SPOKES.length];
      tick.current += 1;
      setIdlePulse(leg);
      window.setTimeout(() => setIdlePulse(null), 1400);
    }, 4200);
    return () => window.clearInterval(t);
  }, [running]);

  const start = async () => {
    if (running) return;
    setRunning(true);
    setSteps([]);
    setSelected(null);
    try {
      await runLoop((i, step) => {
        setActiveLeg(step.leg);
        setSteps((prev) => {
          const next = [...prev];
          next[i] = step;
          return next;
        });
      });
    } finally {
      setActiveLeg(null);
      setRunning(false);
      setSignals(loadSignals());
    }
  };

  const litLeg = activeLeg ?? idlePulse;

  return (
    <div style={{
      padding: '16px 16px 18px', borderRadius: 16,
      background: 'var(--surface)', border: '1px solid rgba(167,139,250,0.30)',
      marginBottom: 14, color: 'var(--fg)', position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes ctFlow { to { stroke-dashoffset: -16; } }
        @keyframes ctPulse { 0%,100%{ transform: translate(-50%,-50%) scale(1);} 50%{ transform: translate(-50%,-50%) scale(1.07);} }
        @keyframes ctFade { from { opacity:0; transform: translateY(4px);} to { opacity:1; transform:none;} }
        .ct-line { transition: opacity .3s, stroke-width .3s; }
        .ct-line-on { animation: ctFlow .55s linear infinite; }
        .ct-node-on { animation: ctPulse 1.25s ease-in-out infinite; }
        .ct-step { animation: ctFade .35s ease both; }
      `}</style>

      {/* ヘッダ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg,#A78BFA,#6366F1)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
          boxShadow: '0 4px 14px rgba(167,139,250,0.45)',
        }}>🗼</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: 0, letterSpacing: '-0.01em' }}>
            司令塔ループ — 4 プロダクトが一周する
          </h3>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            Lume で集め · Iris で読み · Prism が考え · Resonance で届ける
          </div>
        </div>
      </div>

      {/* 図 */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 480, margin: '6px auto 4px',
        aspectRatio: '1 / 0.92',
      }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {SPOKES.map((leg) => {
            const on = litLeg === leg;
            const c = CHANNEL_META[leg].color;
            return (
              <line key={leg}
                x1={POS.prism.x} y1={POS.prism.y} x2={POS[leg].x} y2={POS[leg].y}
                className={`ct-line ${on ? 'ct-line-on' : ''}`}
                stroke={c} strokeWidth={on ? 2 : 1.4} strokeLinecap="round"
                strokeDasharray="4 5" vectorEffect="non-scaling-stroke"
                style={{ opacity: on ? 1 : 0.38 }}
              />
            );
          })}
        </svg>

        {/* ノード */}
        {(['prism', ...SPOKES] as LoopChannel[]).map((ch) => {
          const meta = CHANNEL_META[ch];
          const Logo = LOGOS[ch];
          const isCenter = ch === 'prism';
          const on = litLeg === ch || (isCenter && activeLeg === 'prism');
          const st = stats[ch];
          const conn = CONNECTED[ch];
          return (
            <button key={ch}
              onClick={() => setSelected((s) => (s === ch ? null : ch))}
              className={on ? 'ct-node-on' : ''}
              style={{
                position: 'absolute', left: `${POS[ch].x}%`, top: `${POS[ch].y}%`,
                transform: 'translate(-50%,-50%)',
                width: isCenter ? 104 : 88, padding: isCenter ? '12px 8px' : '9px 6px',
                borderRadius: 16, cursor: 'pointer', zIndex: 2,
                background: 'var(--surface-3)',
                border: `1.5px solid ${meta.color}${on ? 'ee' : selected === ch ? 'cc' : '66'}`,
                boxShadow: on
                  ? `0 0 0 4px ${meta.color}26, 0 8px 22px ${meta.color}44`
                  : `0 4px 14px rgba(0,0,0,0.18)`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                transition: 'box-shadow .3s, border-color .3s',
                fontFamily: 'inherit',
              }}>
              <Logo size={isCenter ? 34 : 26} />
              <div style={{ fontSize: isCenter ? 13 : 11.5, fontWeight: 800, color: 'var(--fg-strong)', fontStyle: 'italic', lineHeight: 1 }}>
                {meta.name}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{meta.sub}</div>
              <div style={{
                marginTop: 1, fontSize: 8.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 999,
                background: conn === 'live' ? 'rgba(52,211,153,0.18)' : 'rgba(148,163,184,0.16)',
                color: conn === 'live' ? '#34D399' : 'var(--fg-subtle)',
              }}>
                {conn === 'live' ? `稼働 · ${st.count}件` : `準備中 · ${st.count}件`}
              </div>
            </button>
          );
        })}
      </div>

      {/* ループ実行 */}
      <button onClick={start} disabled={running}
        style={{
          width: '100%', marginTop: 8, padding: '12px 14px', borderRadius: 12, border: 'none',
          background: running
            ? 'linear-gradient(90deg,#6366F1,#A78BFA)'
            : 'linear-gradient(90deg,#E1306C,#A78BFA,#06C755)',
          color: '#fff', fontSize: 14, fontWeight: 900, letterSpacing: '0.01em',
          cursor: running ? 'wait' : 'pointer', minHeight: 48,
          boxShadow: '0 6px 18px rgba(167,139,250,0.4)',
        }}>
        {running ? 'ループ実行中…' : '▶ ループを回す（1 人のファンに最適な一言を届ける）'}
      </button>

      {/* ストリーム（Claude Code 風） */}
      {steps.length > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 12,
          background: 'rgba(10,8,20,0.55)', border: '1px solid rgba(167,139,250,0.25)',
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}>
          {steps.map((s, i) => {
            const meta = CHANNEL_META[s.leg];
            return (
              <div key={i} className="ct-step" style={{ marginBottom: i === steps.length - 1 ? 0 : 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#E7E3F5' }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0,
                    boxShadow: s.done ? 'none' : `0 0 0 3px ${meta.color}33`,
                  }} />
                  <span style={{ color: meta.color, fontWeight: 800 }}>{meta.name}</span>
                  <span style={{ opacity: 0.85 }}>{s.label}{s.done ? '' : '…'}</span>
                </div>
                {s.done && s.output && (
                  <div style={{
                    margin: '4px 0 0 14px', padding: '5px 9px', fontSize: 11.5, color: '#F4F2FB',
                    background: 'rgba(0,0,0,0.28)', borderLeft: `2px solid ${meta.color}`, borderRadius: 5,
                  }}>→ {s.output}</div>
                )}
              </div>
            );
          })}
          {!running && steps.length >= 4 && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#34D399', fontWeight: 800 }}>
              ✓ 一周完了 — このやり取りは司令塔タイムラインに記録されました
            </div>
          )}
        </div>
      )}

      {/* ノード詳細 */}
      {selected && (
        <NodeDetail ch={selected} signals={signals} onClose={() => setSelected(null)} />
      )}

      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '10px 2px 0', lineHeight: 1.5 }}>
        ※ 数値・ファンはデモ用のサンプルです。Iris は実アプリ稼働中、Resonance(LINE)・Lume(リンク) は接続準備中。
      </p>
    </div>
  );
}

function NodeDetail({ ch, signals, onClose }: { ch: LoopChannel; signals: LoopSignal[]; onClose: () => void }) {
  const meta = CHANNEL_META[ch];
  const list = signals.filter((s) => s.channel === ch).slice(-4).reverse();
  return (
    <div className="ct-step" style={{
      marginTop: 12, padding: '12px 13px', borderRadius: 12,
      background: 'var(--surface-3)', border: `1px solid ${meta.color}55`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 900, color: 'var(--fg-strong)', fontStyle: 'italic' }}>{meta.name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color }}>{meta.sub} · {meta.role}</span>
        <button onClick={onClose} style={{
          marginLeft: 'auto', width: 26, height: 26, borderRadius: 8, border: 'none',
          background: 'rgba(0,0,0,0.12)', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 14,
        }}>✕</button>
      </div>
      {list.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>まだシグナルがありません。「ループを回す」で動き出します。</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.map((s) => (
            <div key={s.id} style={{ fontSize: 11.5, color: 'var(--fg)', lineHeight: 1.5 }}>
              <span style={{ color: meta.color, fontWeight: 700 }}>{s.who ?? '—'}</span> {s.text}
            </div>
          ))}
        </div>
      )}
      {ch === 'iris' && (
        <button onClick={() => { window.location.href = '/iris'; }} style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 9, border: 'none',
          background: meta.color, color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', minHeight: 40,
        }}>Iris アプリを開く →</button>
      )}
      {(ch === 'resonance' || ch === 'lume') && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--fg-subtle)' }}>
          {meta.name} の実接続は準備中です。ループ上では司令塔とつながって動いています。
        </div>
      )}
    </div>
  );
}
