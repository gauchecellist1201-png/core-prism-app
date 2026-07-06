// ============================================================
// CORE Prism ▸ Artifact Studio (エージェント提案 → 美しい一枚成果物 → 書き出し)
//
// Resonance(リッチメニュー) / Iris(カバー) と同じ思想を Prism へ移植:
//   テーマや会議メモを書く → AI が「見出し・要約・アクション・根拠」を提案 →
//   Prism ブランドの“一枚成果物（ポスター）”を canvas で高精細合成 →
//   PNG 書き出し / Markdown コピー・ダウンロード。
//
// ・文字コントラスト恒久ルール：濃いブランド地に白文字で必ず読める。
// ・AI 失敗でも提案は必ず返る（artifactProposal.ts 側で fallback）。
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Wand2, Download, Copy, FileDown, X, Check, RefreshCw } from 'lucide-react';
import { generateArtifact, artifactToMarkdown, kindMeta, type ArtifactKind, type ArtifactProposal } from '../lib/artifactProposal';

const VIOLET = '#A78BFA';
const INDIGO = '#6366F1';
const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif';
const KINDS: { id: ArtifactKind; label: string }[] = [
  { id: 'action', label: 'アクションプラン' },
  { id: 'meeting', label: '会議サマリー' },
  { id: 'report', label: 'レポート' },
];

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  const lines: string[] = [];
  let line = '';
  const pushChar = (tok: string) => {
    for (const ch of [...tok]) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
    }
  };
  for (const tk of tokens) {
    if (/^\s+$/.test(tk)) { if (line && ctx.measureText(line + ' ').width <= maxW) line += ' '; continue; }
    if (ctx.measureText(line + tk).width <= maxW) line += tk;
    else if (ctx.measureText(tk).width <= maxW) { if (line) lines.push(line.trimEnd()); line = tk; }
    else { if (line) { lines.push(line.trimEnd()); line = ''; } pushChar(tk); }
  }
  if (line) lines.push(line.trimEnd());
  return lines.slice(0, maxLines);
}

export default function PrismArtifactStudio({ onClose }: { onClose: () => void; settings?: unknown; persona?: unknown }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kind, setKind] = useState<ArtifactKind>('action');
  const [topic, setTopic] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkLine, setThinkLine] = useState('');
  const [art, setArt] = useState<ArtifactProposal | null>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  async function propose() {
    setErr('');
    setThinking(true);
    const lines = ['メモを読み解いています…', '要点を抜き出しています…', '動ける手順に整理しています…', '根拠をそろえています…'];
    let li = 0; setThinkLine(lines[0]);
    const timer = setInterval(() => { li = (li + 1) % lines.length; setThinkLine(lines[li]); }, 1100);
    try {
      const a = await generateArtifact(topic, kind);
      setArt(a);
    } catch (e: any) {
      setErr(e?.message || '生成に失敗しました。内容を変えて再試行してください。');
    } finally {
      clearInterval(timer);
      setThinking(false);
    }
  }

  // ── canvas へ成果物ポスターを描画（プレビュー＝書き出しと同一） ──
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !art) return;
    const W = 1080, H = 1350;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let cancelled = false;

    (async () => {
      try { await (document as any).fonts?.ready; } catch { /* */ }
      if (cancelled) return;
      const scale = 1;
      const padX = 92;
      const maxW = W - padX * 2;

      // 背景：深い紫紺のグラデ＋上部のブランドグロー
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0E0A1F'); bg.addColorStop(0.55, '#150E2E'); bg.addColorStop(1, '#1B1142');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W * 0.5, -120, 80, W * 0.5, -120, 760);
      glow.addColorStop(0, 'rgba(167,139,250,0.34)'); glow.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 520);
      // 上辺のブランドバー
      const bar = ctx.createLinearGradient(0, 0, W, 0);
      bar.addColorStop(0, VIOLET); bar.addColorStop(1, INDIGO);
      ctx.fillStyle = bar; ctx.fillRect(0, 0, W, 12);

      let y = 132;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      // kicker + rule
      ctx.font = `800 26px ${FONT}`;
      ctx.fillStyle = VIOLET;
      try { (ctx as any).letterSpacing = '6px'; } catch { /* */ }
      ctx.fillText((art.kicker || 'PRISM').toUpperCase(), padX, y);
      try { (ctx as any).letterSpacing = '0px'; } catch { /* */ }
      y += 18;
      ctx.strokeStyle = VIOLET; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(padX + 64, y); ctx.stroke();
      y += 56;

      // title（自動縮小）
      let ts = 78;
      const tf = (s: number) => `800 ${s}px ${FONT}`;
      let tlines: string[] = [];
      for (; ts >= 48; ts -= 3) {
        ctx.font = tf(ts);
        tlines = wrapLines(ctx, art.title, maxW, 3);
        if (Math.max(...tlines.map((l) => ctx.measureText(l).width)) <= maxW) break;
      }
      ctx.font = tf(ts); ctx.fillStyle = '#FFFFFF';
      for (const ln of tlines) { y += ts; ctx.fillText(ln, padX, y); y += ts * 0.18; }
      y += 26;

      // summary
      ctx.font = `400 31px ${FONT}`;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      for (const sl of wrapLines(ctx, art.summary, maxW, 3)) { y += 40; ctx.fillText(sl, padX, y); }
      y += 54;

      // やること（番号バッジ付き）
      if (art.actions.length) {
        ctx.font = `800 22px ${FONT}`; ctx.fillStyle = VIOLET;
        try { (ctx as any).letterSpacing = '3px'; } catch { /* */ }
        ctx.fillText('やること', padX, y);
        try { (ctx as any).letterSpacing = '0px'; } catch { /* */ }
        y += 30;
        const badge = 46;
        art.actions.slice(0, 5).forEach((a, i) => {
          const rowTop = y;
          // バッジ
          const cy = rowTop + 30;
          const bgr = ctx.createLinearGradient(padX, cy - badge / 2, padX + badge, cy + badge / 2);
          bgr.addColorStop(0, VIOLET); bgr.addColorStop(1, INDIGO);
          ctx.fillStyle = bgr;
          ctx.beginPath(); ctx.arc(padX + badge / 2, cy, badge / 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = `800 24px ${FONT}`; ctx.textAlign = 'center';
          ctx.fillText(String(i + 1), padX + badge / 2, cy + 8);
          ctx.textAlign = 'left';
          // 本文
          ctx.font = `600 30px ${FONT}`; ctx.fillStyle = '#FFFFFF';
          const tx = padX + badge + 22;
          const lines = wrapLines(ctx, a, W - padX - tx, 2);
          let ly = rowTop + 28;
          for (const ln of lines) { ctx.fillText(ln, tx, ly); ly += 38; }
          y = Math.max(rowTop + badge + 18, ly + 6);
        });
        y += 18;
      }

      // 根拠・要点
      if (art.rationale.length) {
        ctx.font = `800 22px ${FONT}`; ctx.fillStyle = VIOLET;
        try { (ctx as any).letterSpacing = '3px'; } catch { /* */ }
        ctx.fillText('根拠・要点', padX, y);
        try { (ctx as any).letterSpacing = '0px'; } catch { /* */ }
        y += 28;
        ctx.font = `400 27px ${FONT}`;
        art.rationale.slice(0, 3).forEach((r) => {
          const lines = wrapLines(ctx, r, maxW - 30, 2);
          // ドット
          ctx.fillStyle = VIOLET;
          ctx.beginPath(); ctx.arc(padX + 6, y + 18, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.78)';
          let ly = y + 26;
          for (const ln of lines) { ctx.fillText(ln, padX + 30, ly); ly += 36; }
          y = ly + 6;
        });
      }

      // フッター（日付 ＋ ブランド）
      const today = new Date();
      const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
      ctx.font = `500 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'left'; ctx.fillText(dateStr, padX, H - 64);
      // ブランド wordmark（グラデ）
      ctx.font = `800 26px ${FONT}`; ctx.textAlign = 'right';
      const wm = ctx.createLinearGradient(W - padX - 220, 0, W - padX, 0);
      wm.addColorStop(0, VIOLET); wm.addColorStop(1, INDIGO);
      ctx.fillStyle = wm; ctx.fillText('CORE Prism', W - padX, H - 64);
      void scale;
    })();

    return () => { cancelled = true; };
  }, [art]);

  function downloadPng() {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement('a');
    a.download = `prism-${kind}-${Date.now().toString(36)}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  }
  async function copyMd() {
    if (!art) return;
    try { await navigator.clipboard.writeText(artifactToMarkdown(art)); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setErr('コピーできませんでした。ブラウザの権限をご確認ください。'); }
  }
  function downloadMd() {
    if (!art) return;
    const blob = new Blob([artifactToMarkdown(art)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `prism-${kind}-${Date.now().toString(36)}.md`;
    a.href = url; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const chip = (on: boolean): React.CSSProperties => ({
    padding: '0.5rem 0.85rem', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 700,
    border: `1px solid ${on ? VIOLET : 'rgba(255,255,255,0.16)'}`, background: on ? 'rgba(167,139,250,0.16)' : 'rgba(255,255,255,0.04)',
    color: on ? '#E9E2FF' : 'rgba(255,255,255,0.6)',
  });
  const btn = (grad: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', cursor: 'pointer',
    borderRadius: 12, padding: '0.7rem 1rem', fontSize: 13.5, fontWeight: 800,
    background: grad ? `linear-gradient(135deg, ${VIOLET}, ${INDIGO})` : 'rgba(255,255,255,0.08)',
    color: '#fff',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, overflowY: 'auto',
      background: 'radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.18), transparent), #0A0816',
      fontFamily: FONT, color: '#fff',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.1rem 1.1rem 3rem' }}>
        {/* ヘッダ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={19} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.26em', fontWeight: 800, color: VIOLET }}>ARTIFACT STUDIO</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>メモを、配れる一枚に</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>走り書きを貼ると、AIが見出し・要点・やること付きの画像（PNG）に整えます</div>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 38, height: 38, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* 入力 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1rem 1.1rem', display: 'grid', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {KINDS.map((k) => <button key={k.id} onClick={() => setKind(k.id)} style={chip(kind === k.id)}>{k.label}</button>)}
          </div>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={kind === 'meeting' ? '会議のメモ・議事を貼り付け（箇条書きでOK）' : kind === 'report' ? 'レポートにするテーマ（例: 今週の集客の状況）' : 'やりたいこと・テーマ（例: 来週の新商品ローンチ準備）'}
            rows={4}
            style={{ width: '100%', resize: 'vertical', padding: '0.7rem 0.8rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: FONT }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={propose} disabled={thinking || !topic.trim()} style={{ ...btn(true), opacity: thinking || !topic.trim() ? 0.55 : 1 }}>
              {thinking ? <RefreshCw size={15} className="spin" /> : <Wand2 size={15} />}
              {thinking ? '考え中…' : (art ? 'もう一度提案' : 'AIに提案してもらう')}
            </button>
            {thinking && <span style={{ fontSize: 12.5, color: VIOLET, fontWeight: 600 }}>{thinkLine}</span>}
          </div>
          {err && <div style={{ fontSize: 12.5, color: '#FCA5A5', fontWeight: 600 }}>{err}</div>}
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
            {kindMeta(kind).guide} AIが提案 → 美しい一枚に仕上げて書き出せます。
          </div>
        </div>

        {/* プレビュー＋操作 */}
        {!art ? (
          <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '1.2rem 1.2rem 1.4rem', background: 'rgba(255,255,255,0.03)' }}>
            {/* 3秒でわかる説明 */}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
              {[
                ['1', 'テーマを書く', '「来週の新商品ローンチ準備」のように一行でOK。会議メモの貼り付けでも。'],
                ['2', '「AIに提案してもらう」を押す', 'AIが見出し・要点・やること・根拠を組み立てます。'],
                ['3', '一枚の画像で書き出す', '下のような“配れる一枚”に。PNG保存・文章コピーもその場で。'],
              ].map(([n, t, d]) => (
                <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`, color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{t}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* こんなのが出ます（サンプル出力1枚） */}
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', marginBottom: 8 }}>こんなのが出ます（見本）</div>
            <div style={{ maxWidth: 300, margin: '0 auto', borderRadius: 14, overflow: 'hidden', boxShadow: '0 18px 44px rgba(99,102,241,0.35)', background: '#0A0816', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ height: 8, background: `linear-gradient(90deg, ${VIOLET}, ${INDIGO})` }} />
              <div style={{ padding: '18px 18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', color: VIOLET, marginBottom: 6 }}>ACTION PLAN</div>
                <div style={{ width: 40, height: 2, background: VIOLET, marginBottom: 12 }} />
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>新商品ローンチを<br />1週間で立ち上げる</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', margin: '8px 0 14px', lineHeight: 1.5 }}>告知・在庫・受付フォームを並行で用意し、金曜公開に間に合わせる。</div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: VIOLET, marginBottom: 8 }}>やること</div>
                {['告知文とビジュアルを用意', '受付フォームと決済を用意', '公開前チェックと予約投稿'].map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
                    <div style={{ fontSize: 12.5, color: '#fff', fontWeight: 600 }}>{a}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  <span>2026.07.06</span>
                  <span style={{ fontWeight: 800, color: VIOLET }}>CORE Prism</span>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 10 }}>これは見本です。上でテーマを書いて押すと、あなたの内容で作られます。</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 320px) 1fr', gap: '1rem', alignItems: 'start' }} className="art-grid">
            <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
              <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 300, height: 'auto', borderRadius: 14, boxShadow: '0 18px 44px rgba(99,102,241,0.4)' }} />
            </div>
            <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <button onClick={downloadPng} style={btn(true)}><Download size={16} /> 画像で書き出す（PNG）</button>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={copyMd} style={{ ...btn(false), flex: 1 }}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'コピーしました' : '文章をコピー'}</button>
                <button onClick={downloadMd} style={{ ...btn(false), flex: 1 }}><FileDown size={16} /> .md保存</button>
              </div>
              {/* 中身の確認・微調整 */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '0.9rem 1rem', display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>中身（その場で直せます）</div>
                <input value={art.title} onChange={(e) => setArt({ ...art, title: e.target.value.slice(0, 40) })} style={inp} />
                <textarea value={art.summary} onChange={(e) => setArt({ ...art, summary: e.target.value.slice(0, 90) })} rows={2} style={{ ...inp, resize: 'vertical' }} />
                {art.actions.map((a, i) => (
                  <input key={i} value={a} onChange={(e) => { const next = [...art.actions]; next[i] = e.target.value.slice(0, 44); setArt({ ...art, actions: next }); }} style={inp} />
                ))}
              </div>
              {!art.ai && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>※ いまはAIに繋がらず、おすすめ構成を表示しています。文章はその場で直せます。</div>}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        @media (max-width: 680px) { .art-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: '100%', padding: '0.55rem 0.7rem', borderRadius: 9, border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', fontFamily: FONT,
};
