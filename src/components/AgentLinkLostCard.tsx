// ============================================================
// AgentLinkLostCard — 連携が外れたときに、黙って消えないためのカード (2026-07-27)
//
// Googleの認証は仕様上1時間ほどで切れる。切れたときに連携エージェントの
// カードごと消えると、ユーザーには「AIが勝手にいなくなった」としか見えない。
// なので同じ場所に、同じ見た目で、こう出す:
//   ・何が起きたか（外れました・あなたのせいではありません）
//   ・いつまでつながっていたか
//   ・次にどうすればいいか（つなぎ直す＝1タップ）
//   ・もう使わない人の逃げ道（この連携をやめる）
//
// AgentBriefShell と同じ器・同じ余白で並ぶので、画面の並びが崩れない。
// ============================================================
import { useState, type ReactNode } from 'react';
import { PlugZap } from 'lucide-react';
import { forgetAgentLink, describeLastLinked, type AgentLinkId } from '../lib/agentLink';
import type { AgentBriefAccent } from './AgentBriefShell';

export default function AgentLinkLostCard({
  id,
  icon,
  title,
  accent,
  lastLinkedAt,
  reason,
  initialError,
  reconnect,
  onChanged,
}: {
  id: AgentLinkId;
  icon: ReactNode;
  /** 「メール連携エージェント」など、つながっていた時と同じ名前 */
  title: string;
  accent: AgentBriefAccent;
  lastLinkedAt: number;
  /**
   * なぜ外れたのかの説明。連携ごとに切れる理由が違うので差し替えられるようにする
   * （既定はブラウザだけで完結する方式＝1時間で必ず切れる、の説明）。
   * ここに合わない文言を使い回すと「嘘の理由」を出すことになるので必ず実態に合わせる。
   */
  reason?: string;
  /**
   * 直前のつなぎ直しが失敗して戻ってきたときの理由（やさしい日本語で渡す）。
   * 失敗の理由をどこにも出さない＝silent fail なので、必ずカード内に出す。
   */
  initialError?: string;
  /** 実際につなぎ直す処理（成功したら解決する） */
  reconnect: () => Promise<unknown>;
  /** つなぎ直し成功／解除で、親に再描画してもらう */
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(initialError || '');
  const since = describeLastLinked(lastLinkedAt);

  async function handleReconnect() {
    setBusy(true);
    setErr('');
    try {
      await reconnect();
      onChanged();
    } catch (e) {
      // Googleの英語エラーをそのまま出さない。何をすればいいかまで書く
      const raw = e instanceof Error ? e.message : '';
      setErr(
        raw && /[ぁ-んァ-ヶ一-龠]/.test(raw)
          ? raw
          : 'つなぎ直せませんでした。ポップアップがブロックされていないか確認して、もう一度おためしください。',
      );
    } finally {
      setBusy(false);
    }
  }

  function handleForget() {
    forgetAgentLink(id);
    onChanged();
  }

  return (
    <div
      data-explain-id={`agent-link-lost-${id}`}
      style={{
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
        background: 'linear-gradient(135deg, rgba(148,163,184,0.12), rgba(100,116,139,0.06))',
        border: '1px solid rgba(148,163,184,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accent.ink, display: 'inline-flex', flexShrink: 0, opacity: 0.7 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg, #E5E7EB)', minWidth: 0, flex: 1 }}>
          {title}
        </span>
      </div>

      {/* 状態バッジは左寄せの独立行に置く。
          カード右端は画面右の縦FABレーン(COMMANDタブ)が重なる帯で、
          375px 実測でバッジが隠れて「外れている」ことが読めなかった (2026-07-27) */}
      <span
        style={{
          display: 'inline-block', marginTop: 8,
          fontSize: 10.5, fontWeight: 800,
          color: '#FCD34D', background: 'rgba(251,191,36,0.14)',
          border: '1px solid rgba(251,191,36,0.32)',
          borderRadius: 999, padding: '3px 9px',
        }}
      >
        いま外れています
      </span>

      <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #B4B8C2)', margin: '8px 0 0', lineHeight: 1.65 }}>
        {since ? `${since}つながっていました。` : ''}
        {reason
          ?? 'Googleの認証は一定時間でかならず切れます（あなたの操作ミスではありません）。つなぎ直すと、このAIはすぐにまた働き始めます。'}
      </p>

      {err && (
        <p style={{ fontSize: 12.5, color: '#FCA5A5', margin: '8px 0 0', lineHeight: 1.6 }}>{err}</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button
          onClick={() => { void handleReconnect(); }}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            minHeight: 44, padding: '0 18px', borderRadius: 12,
            fontSize: 13.5, fontWeight: 800, color: '#0B1020',
            background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
            border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.65 : 1,
          }}
        >
          <PlugZap size={16} strokeWidth={2.3} />
          {busy ? 'つなぎ直しています…' : 'つなぎ直す'}
        </button>
        <button
          onClick={handleForget}
          style={{
            minHeight: 44, padding: '0 8px', background: 'none', border: 'none',
            fontSize: 12.5, fontWeight: 600, color: 'var(--fg-muted, #9CA3AF)', cursor: 'pointer',
          }}
        >
          この連携はもう使わない
        </button>
      </div>
    </div>
  );
}
