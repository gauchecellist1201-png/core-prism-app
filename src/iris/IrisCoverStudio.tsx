// ============================================================
// IRIS ▸ Cover / Thumbnail Studio (写真ヒーロー × editorial テキスト)
//
// 思想（Resonance リッチメニュー "プレミアム" の移植）:
//   AI がテーマから「見出し・配色ムード・写真の方向性」を提案 →
//   クライアントの canvas で VOGUE 級の“表紙/サムネ”を高精細に合成 →
//   そのまま PNG で書き出し（投稿カバー / リール表紙 / ストーリー）。
//
// ・写真がある時は白文字＋上品なスクリムで必ず読める（文字コントラスト恒久ルール遵守）
// ・写真が無くてもブランド配色のグラデで成立
// ・AI 失敗でも提案は必ず返る（coverProposal.ts 側でフォールバック）
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { Sparkles, ImagePlus, Download, Wand2, Check, RefreshCw } from 'lucide-react';
import { IRIS_FONTS, IRIS_COLORS } from './irisStyle';
import { generateCoverProposal, type CoverMood, type CoverLayout, type CoverProposal } from './coverProposal';

interface CoverBg {
  accent?: string; ink?: string; inkSoft?: string; card?: string; cardBorder?: string;
}

type AspectId = '4:5' | '1:1' | '9:16';
const ASPECTS: { id: AspectId; w: number; h: number; label: string }[] = [
  { id: '4:5', w: 1080, h: 1350, label: '投稿 (4:5)' },
  { id: '1:1', w: 1080, h: 1080, label: '正方形' },
  { id: '9:16', w: 1080, h: 1920, label: 'リール/ストーリー表紙' },
];

// 配色ムード → グラデと文字色（写真が無い時の背景）。写真がある時は常に白文字＋スクリム。
const PALS: Record<CoverMood, { bg1: string; bg2: string; text: string; label: string }> = {
  rose:      { bg1: IRIS_COLORS.pink,    bg2: IRIS_COLORS.purple,   text: '#FFFFFF', label: 'ローズ' },
  champagne: { bg1: IRIS_COLORS.goldChampagne, bg2: IRIS_COLORS.gold, text: IRIS_COLORS.ink, label: 'シャンパン' },
  lavender:  { bg1: IRIS_COLORS.purpleLt, bg2: IRIS_COLORS.purpleDeep, text: '#FFFFFF', label: 'ラベンダー' },
  peach:     { bg1: IRIS_COLORS.peach,   bg2: IRIS_COLORS.goldDeep,  text: IRIS_COLORS.ink, label: 'ピーチ' },
  midnight:  { bg1: IRIS_COLORS.ink,     bg2: IRIS_COLORS.inkBlack,  text: '#FFFFFF', label: 'ミッドナイト' },
  cream:     { bg1: IRIS_COLORS.cream,   bg2: IRIS_COLORS.ivoryDeep, text: IRIS_COLORS.ink, label: 'クリーム' },
};
const MOOD_IDS: CoverMood[] = ['rose', 'champagne', 'lavender', 'peach', 'midnight', 'cream'];
const LAYOUTS: { id: CoverLayout; label: string }[] = [
  { id: 'bottom', label: '下に置く' },
  { id: 'center', label: '中央' },
  { id: 'top', label: '上に置く' },
];

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('画像を読み込めませんでした'));
    i.src = src;
  });
}

// cover フィット（縦のフォーカス指定）。人物の顔が切れにくいようやや上寄せ。
function coverDrawFocus(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fy: number) {
  const iw = img.width, ih = img.height, ir = iw / ih, cr = w / h;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (ir > cr) { sw = ih * cr; sx = (iw - sw) / 2; } else { sh = iw / cr; sy = (ih - sh) * fy; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// 和文は文字単位・英単語は語単位で自然に折り返す。
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  const lines: string[] = [];
  let line = '';
  const pushChar = (tok: string) => {
    for (const ch of [...tok]) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
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

export default function IrisCoverStudio({ bg }: { bg: CoverBg; settings?: unknown }) {
  const accent = bg.accent || IRIS_COLORS.hotPink;
  const ink = bg.ink || IRIS_COLORS.ink;
  const inkSoft = bg.inkSoft || IRIS_COLORS.inkSoft;
  const card = bg.card || '#FFFFFF';
  const cardBorder = bg.cardBorder || '#F0DCE6';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState('');
  const [thinking, setThinking] = useState(false);
  const [thinkLine, setThinkLine] = useState('');
  const [proposal, setProposal] = useState<CoverProposal | null>(null);
  const [err, setErr] = useState('');

  // 編集中の値（提案で初期化、その後ユーザーが自由に直せる）
  const [aspect, setAspect] = useState<AspectId>('4:5');
  const [mood, setMood] = useState<CoverMood>('rose');
  const [layout, setLayout] = useState<CoverLayout>('bottom');
  const [kicker, setKicker] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [handle, setHandle] = useState('');
  const [photo, setPhoto] = useState('');
  const [accentCol, setAccentCol] = useState(accent);

  // ── AI 提案 ──
  async function propose() {
    setErr('');
    setThinking(true);
    const lines = ['テーマを読み解いています…', '指が止まる見出しを考えています…', '配色と写真の方向性を選んでいます…', '配置を整えています…'];
    let li = 0; setThinkLine(lines[0]);
    const timer = setInterval(() => { li = (li + 1) % lines.length; setThinkLine(lines[li]); }, 1100);
    try {
      const p = await generateCoverProposal(theme);
      setProposal(p);
      setKicker(p.kicker);
      setTitle(p.titles[0] || '');
      setSubtitle(p.subtitle);
      setMood(p.mood);
      setLayout(p.layout);
      setAccentCol(p.accent);
    } catch (e: any) {
      setErr(e?.message || '提案の生成に失敗しました。テーマを変えて再試行してください。');
    } finally {
      clearInterval(timer);
      setThinking(false);
    }
  }

  // ── 写真取り込み ──
  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/image\/(png|jpe?g|webp)/.test(f.type)) { setErr('写真は PNG / JPEG / WebP を選んでください。'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ''));
    reader.onerror = () => setErr('写真を読み込めませんでした。別の画像でお試しください。');
    reader.readAsDataURL(f);
  }

  // ── canvas へ描画（プレビュー＝書き出しと同一の1枚） ──
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = ASPECTS.find((x) => x.id === aspect) || ASPECTS[0];
    cv.width = a.w; cv.height = a.h;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let cancelled = false;

    (async () => {
      try { await (document as any).fonts?.ready; } catch { /* フォント未対応でも続行 */ }
      if (cancelled) return;
      const W = a.w, H = a.h;
      const pal = PALS[mood];
      const onPhoto = !!photo;
      const textCol = onPhoto ? '#FFFFFF' : pal.text;

      // 背景
      if (onPhoto) {
        try {
          const img = await loadImg(photo);
          if (cancelled) return;
          coverDrawFocus(ctx, img, 0, 0, W, H, 0.4);
        } catch {
          const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, pal.bg1); g.addColorStop(1, pal.bg2);
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
      } else {
        const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, pal.bg1); g.addColorStop(1, pal.bg2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // 紙の質感：うっすらビネット
        const vg = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.06)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      }

      // 写真の上は読みやすさのためスクリム（配置に応じて方向を変える）
      if (onPhoto) {
        const sc = ctx.createLinearGradient(0, 0, 0, H);
        if (layout === 'top') { sc.addColorStop(0, 'rgba(10,6,16,0.62)'); sc.addColorStop(0.5, 'rgba(10,6,16,0.12)'); sc.addColorStop(1, 'rgba(10,6,16,0)'); }
        else if (layout === 'center') { sc.addColorStop(0, 'rgba(10,6,16,0.12)'); sc.addColorStop(0.5, 'rgba(10,6,16,0.5)'); sc.addColorStop(1, 'rgba(10,6,16,0.12)'); }
        else { sc.addColorStop(0, 'rgba(10,6,16,0)'); sc.addColorStop(0.5, 'rgba(10,6,16,0.12)'); sc.addColorStop(1, 'rgba(10,6,16,0.66)'); }
        ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);
      }

      const padX = Math.round(W * 0.085);
      const maxW = W - padX * 2;
      const scale = W / 1080;
      const centerAlign = layout === 'center';
      ctx.textAlign = centerAlign ? 'center' : 'left';
      const ax = centerAlign ? W / 2 : padX;

      // 見出しの行を先に計測（フォントサイズは比率＋行数で自動調整）
      const titleText = (title || '').trim() || (proposal?.titles[0] ?? '見出しを入力');
      let titleSize = Math.round(96 * scale * (H / W > 1.6 ? 1.05 : 1));
      const titleFont = (s: number) => `italic 700 ${s}px ${IRIS_FONTS.display}`;
      let lines: string[] = [];
      for (; titleSize >= Math.round(52 * scale); titleSize -= 3) {
        ctx.font = titleFont(titleSize);
        lines = wrapLines(ctx, titleText, maxW, 4);
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (widest <= maxW && lines.length <= 4) break;
      }
      const titleLH = titleSize * 1.12;

      const kickerSize = Math.round(26 * scale);
      const subSize = Math.round(30 * scale);
      const ruleW = Math.round(64 * scale);
      const gapK = Math.round(26 * scale);
      const gapS = Math.round(30 * scale);

      // ブロック総高さ
      const hasKicker = !!kicker.trim();
      const hasSub = !!subtitle.trim();
      let blockH = lines.length * titleLH;
      if (hasKicker) blockH += kickerSize + gapK + Math.round(18 * scale);
      if (hasSub) blockH += gapS + subSize;

      // 配置の基準 y（ブロックの最上部）
      let topY: number;
      if (layout === 'top') topY = Math.round(H * 0.12);
      else if (layout === 'center') topY = Math.round((H - blockH) / 2);
      else topY = Math.round(H - blockH - H * 0.11);

      let y = topY;

      // kicker（小ラベル＋罫線）
      if (hasKicker) {
        ctx.font = `700 ${kickerSize}px ${IRIS_FONTS.body}`;
        ctx.fillStyle = accentCol;
        try { (ctx as any).letterSpacing = `${Math.round(6 * scale)}px`; } catch { /* 未対応は無視 */ }
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(kicker.trim().toUpperCase(), ax, y + kickerSize);
        try { (ctx as any).letterSpacing = '0px'; } catch { /* */ }
        // 罫線
        const ry = y + kickerSize + Math.round(12 * scale);
        ctx.strokeStyle = accentCol; ctx.lineWidth = Math.max(2, Math.round(3 * scale));
        ctx.beginPath();
        if (centerAlign) { ctx.moveTo(W / 2 - ruleW / 2, ry); ctx.lineTo(W / 2 + ruleW / 2, ry); }
        else { ctx.moveTo(ax, ry); ctx.lineTo(ax + ruleW, ry); }
        ctx.stroke();
        y = ry + gapK;
      }

      // title（影で必ず読めるように）
      ctx.font = titleFont(titleSize);
      ctx.fillStyle = textCol;
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = onPhoto ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = Math.round((onPhoto ? 14 : 4) * scale);
      ctx.shadowOffsetY = Math.round(2 * scale);
      let lastBaseline = y;
      for (const ln of lines) {
        lastBaseline = y + titleSize;
        ctx.fillText(ln, ax, lastBaseline);
        y += titleLH;
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

      // subtitle（最後の見出し行のベースライン基準で配置）
      if (hasSub) {
        let sy = lastBaseline + gapS + subSize;
        ctx.font = `500 ${subSize}px ${IRIS_FONTS.body}`;
        ctx.fillStyle = onPhoto ? 'rgba(255,255,255,0.92)' : (mood === 'midnight' || mood === 'rose' || mood === 'lavender' ? 'rgba(255,255,255,0.9)' : inkSoft);
        const subLines = wrapLines(ctx, subtitle.trim(), maxW, 2);
        for (const sl of subLines) { ctx.fillText(sl, ax, sy); sy += subSize * 1.35; }
      }

      // handle（右下にさりげなく）
      if (handle.trim()) {
        const h = handle.trim().startsWith('@') ? handle.trim() : '@' + handle.trim();
        ctx.font = `600 ${Math.round(24 * scale)}px ${IRIS_FONTS.body}`;
        ctx.fillStyle = onPhoto ? 'rgba(255,255,255,0.85)' : inkSoft;
        ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(h, W - padX, H - Math.round(H * 0.045));
      }
    })();

    return () => { cancelled = true; };
  }, [aspect, mood, layout, kicker, title, subtitle, handle, photo, accentCol, proposal, inkSoft]);

  function download() {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement('a');
    a.download = `iris-cover-${aspect.replace(':', 'x')}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
  }

  // ── UI ──
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: inkSoft, letterSpacing: '0.04em' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.7rem', borderRadius: 10, border: `1px solid ${cardBorder}`,
    background: '#fff', color: ink, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };
  const chip = (on: boolean): React.CSSProperties => ({
    padding: '0.45rem 0.7rem', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    border: `1px solid ${on ? accent : cardBorder}`, background: on ? `${accent}14` : '#fff', color: on ? accent : inkSoft,
  });

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 920, margin: '0 auto' }}>
      {/* ヒーロー */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '1.2rem 1.3rem',
        background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 60%, #F77737 100%)', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <Sparkles size={18} />
          <span style={{ fontSize: 10.5, letterSpacing: '0.26em', fontWeight: 700, opacity: 0.92 }}>COVER STUDIO</span>
        </div>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.55rem', margin: '0 0 4px' }}>
          指が止まる、表紙をつくる。
        </h2>
        <p style={{ fontSize: '0.83rem', lineHeight: 1.6, margin: 0, opacity: 0.95, maxWidth: 520 }}>
          テーマを書くだけで、AI が見出し・配色・写真の方向性まで提案。写真を載せれば、雑誌の表紙のような1枚に。
        </p>
      </div>

      {/* ① テーマ → 提案 */}
      <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '1rem 1.1rem', display: 'grid', gap: 10 }}>
        <div style={labelStyle}>① テーマを書いて、AI に提案してもらう</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !thinking) propose(); }}
            placeholder="例: 朝のスキンケアルーティン / 旅の持ち物 / 新作コスメレビュー"
            style={{ ...inputStyle, flex: 1, minWidth: 220 }}
          />
          <button
            onClick={propose}
            disabled={thinking || !theme.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: thinking || !theme.trim() ? 'default' : 'pointer',
              background: `linear-gradient(135deg, ${accent}, #F77737)`, color: '#fff', borderRadius: 999,
              padding: '0.6rem 1.2rem', fontSize: 13, fontWeight: 800, opacity: thinking || !theme.trim() ? 0.6 : 1,
            }}
          >
            {thinking ? <RefreshCw size={15} className="spin" /> : <Wand2 size={15} />}
            {thinking ? '考え中…' : '提案してもらう'}
          </button>
        </div>
        {thinking && <div style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{thinkLine}</div>}
        {err && <div style={{ fontSize: 12, color: '#C8102E', fontWeight: 600 }}>{err}</div>}

        {/* 見出し候補（提案後） */}
        {proposal && proposal.titles.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={labelStyle}>見出しの候補（タップで採用）{proposal.ai ? '' : '（おすすめ構成）'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {proposal.titles.map((t, i) => (
                <button key={i} onClick={() => setTitle(t)} style={chip(title === t)}>
                  {title === t && <Check size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}{t}
                </button>
              ))}
            </div>
            {proposal.photoHint && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: inkSoft, background: `${accent}0D`, border: `1px solid ${accent}22`, borderRadius: 10, padding: '0.55rem 0.7rem' }}>
                <Sparkles size={14} color={accent} style={{ flexShrink: 0, marginTop: 1 }} />
                <span><b style={{ color: ink }}>おすすめの写真：</b>{proposal.photoHint}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ② 仕上げ：プレビュー（左）＋調整（右） */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) 1fr', gap: '1rem', alignItems: 'start' }} className="cover-grid">
        {/* プレビュー */}
        <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: '0.9rem', display: 'grid', gap: 10, justifyItems: 'center' }}>
          <div style={{ ...labelStyle, justifySelf: 'start' }}>② プレビュー（この1枚が書き出されます）</div>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', maxWidth: 260, height: 'auto', borderRadius: 12, boxShadow: '0 12px 30px rgba(225,48,108,0.16)', background: '#eee' }}
          />
          <button
            onClick={download}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', width: '100%', justifyContent: 'center',
              background: `linear-gradient(135deg, ${accent}, #833AB4)`, color: '#fff', borderRadius: 12, padding: '0.7rem 1rem', fontSize: 13.5, fontWeight: 800 }}
          >
            <Download size={16} /> 画像を書き出す（PNG）
          </button>
        </div>

        {/* 調整 */}
        <div style={{ display: 'grid', gap: 12 }}>
          {/* 写真 */}
          <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: '0.9rem 1rem', display: 'grid', gap: 8 }}>
            <div style={labelStyle}>写真（任意・載せると映えます）</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={onPickPhoto} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => fileRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px dashed ${accent}88`, background: `${accent}0D`, color: accent, borderRadius: 10, padding: '0.55rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <ImagePlus size={15} /> {photo ? '写真を差し替える' : '写真をアップロード'}
              </button>
              {photo && (
                <button onClick={() => setPhoto('')} style={{ border: `1px solid ${cardBorder}`, background: '#fff', color: inkSoft, borderRadius: 10, padding: '0.55rem 0.9rem', fontSize: 12, cursor: 'pointer' }}>外す</button>
              )}
            </div>
          </div>

          {/* テキスト */}
          <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: '0.9rem 1rem', display: 'grid', gap: 9 }}>
            <div style={labelStyle}>文字</div>
            <div style={{ display: 'grid', gap: 7 }}>
              <input value={kicker} onChange={(e) => setKicker(e.target.value.slice(0, 14))} placeholder="上の小ラベル（例: BEAUTY / 朝の習慣）" style={inputStyle} />
              <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 40))} placeholder="大見出し（指が止まるフック）" style={inputStyle} />
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value.slice(0, 50))} placeholder="小さな添え文（例: 保存して見返してね）" style={inputStyle} />
              <input value={handle} onChange={(e) => setHandle(e.target.value.slice(0, 24))} placeholder="アカウント名（任意・例: @your_id）" style={inputStyle} />
            </div>
          </div>

          {/* 比率 / 配置 / 配色 */}
          <div style={{ background: card, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: '0.9rem 1rem', display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={labelStyle}>サイズ</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ASPECTS.map((a) => <button key={a.id} onClick={() => setAspect(a.id)} style={chip(aspect === a.id)}>{a.label}</button>)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={labelStyle}>文字の位置</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LAYOUTS.map((l) => <button key={l.id} onClick={() => setLayout(l.id)} style={chip(layout === l.id)}>{l.label}</button>)}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={labelStyle}>配色ムード（写真が無い時の背景・差し色）</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {MOOD_IDS.map((m) => {
                  const p = PALS[m]; const on = mood === m;
                  return (
                    <button key={m} onClick={() => setMood(m)} title={p.label}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.6rem', borderRadius: 999, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, border: `1px solid ${on ? accent : cardBorder}`, background: on ? `${accent}12` : '#fff', color: on ? accent : inkSoft }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg, ${p.bg1}, ${p.bg2})`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={labelStyle}>差し色</div>
              <input type="color" value={accentCol} onChange={(e) => setAccentCol(e.target.value)} style={{ width: 40, height: 28, border: `1px solid ${cardBorder}`, borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
        @media (max-width: 680px) { .cover-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
