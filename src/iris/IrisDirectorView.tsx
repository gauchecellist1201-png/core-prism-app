// ============================================================
// IRIS — Content Director View (構成・テロップ・キャプション 丸投げ)
// ============================================================
import { useState } from 'react';
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META } from '../types/influencerDeal';
import { generateBlueprint, type ContentBlueprint } from './contentDirector';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
}

export default function IrisDirectorView({ bg, settings }: Props) {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('reel');
  const [brand, setBrand] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [duration, setDuration] = useState<string>('30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ContentBlueprint | null>(null);

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

  const generate = async () => {
    if (!topic.trim()) { setErr('テーマを入れてください'); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await generateBlueprint({
        settings, topic, platform, contentType, brand: brand || undefined,
        targetAudience: audience || undefined, selfTone: tone || undefined,
        durationSec: duration ? Number(duration) : undefined,
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const fullExport = () => {
    if (!result) return;
    const md: string[] = [];
    md.push(`# ${result.title}`);
    md.push(`\n## フック\n${result.hook}\n`);
    md.push(`## 構成`);
    result.scenes.forEach((s, i) => {
      md.push(`\n### ${i + 1}. ${s.scene} (${s.time})`);
      md.push(`映像: ${s.visual}`);
      if (s.line) md.push(`セリフ: ${s.line}`);
    });
    md.push(`\n## テロップ`);
    result.captions.forEach(c => md.push(`- [${c.time}] ${c.text}`));
    md.push(`\n## 投稿本文\n${result.postCaption}`);
    md.push(`\n## ハッシュタグ`);
    md.push(`メイン: ${result.hashtags.main.join(' ')}`);
    md.push(`カテゴリ: ${result.hashtags.category.join(' ')}`);
    md.push(`ロングテール: ${result.hashtags.longtail.join(' ')}`);
    md.push(`\n## CTA\n${result.cta}`);
    md.push(`\n## 撮影前準備`);
    result.prep.forEach(p => md.push(`- ${p}`));
    navigator.clipboard?.writeText(md.join('\n'));
    alert('Markdown 形式でクリップボードにコピーしました');
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
          The Director
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.4rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          丸投げ編集スタジオ
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          テーマだけ入れたら、構成 / テロップ / 投稿文 / ハッシュタグまで全部つくる。
        </p>
      </div>

      <div style={card}>
        <textarea style={{ ...inp, width: '100%', minHeight: 80, marginBottom: '0.5rem' }}
          placeholder="例: 春の新作リップ3本を比較。30代の唇に合うのはどれ?"
          value={topic} onChange={e => setTopic(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <select style={inp} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
            {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select style={inp} value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>
            {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input style={inp} type="number" placeholder="尺 (秒)" value={duration} onChange={e => setDuration(e.target.value)} />
          <input style={inp} placeholder="ブランド (任意)" value={brand} onChange={e => setBrand(e.target.value)} />
          <input style={inp} placeholder="ターゲット" value={audience} onChange={e => setAudience(e.target.value)} />
          <input style={inp} placeholder="自分のトーン" value={tone} onChange={e => setTone(e.target.value)} />
        </div>
        <button onClick={generate} disabled={busy} style={btnPrimary}>
          {busy ? '構成中…' : '✨ 全部おまかせ'}
        </button>
      </div>

      {err && <div style={card}><p style={{ color: '#C8102E' }}>⚠ {err}</p></div>}

      {result && (
        <>
          <div style={card}>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              Concept
            </p>
            <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.6rem', fontWeight: 700, color: bg.ink, lineHeight: 1.2 }}>
              {result.title}
            </p>
            <p style={{ fontStyle: 'italic', color: bg.inkSoft, marginTop: '0.5rem' }}>
              <span style={{ color: bg.accent }}>HOOK:</span> {result.hook}
            </p>
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>Scene Plan</p>
            {result.scenes.map((s, i) => (
              <div key={i} style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: `1px solid ${bg.cardBorder}` }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', color: bg.accent, minWidth: 70 }}>{s.time}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: bg.ink, marginBottom: '0.2rem' }}>{s.scene}</p>
                    <p style={{ fontSize: '0.85rem', color: bg.inkSoft }}>{s.visual}</p>
                    {s.line && <p style={{ fontSize: '0.85rem', color: bg.ink, marginTop: '0.3rem', fontStyle: 'italic' }}>「{s.line}」</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>Captions</p>
            {result.captions.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < result.captions.length - 1 ? `1px solid ${bg.cardBorder}` : 'none' }}>
                <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', color: bg.accent, minWidth: 70 }}>{c.time}</span>
                <span style={{ flex: 1, fontWeight: 500, color: bg.ink }}>{c.text}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Post Caption</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink, lineHeight: 1.7 }}>{result.postCaption}</pre>
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Hashtags</p>
            {(['main', 'category', 'longtail'] as const).map(k => (
              <div key={k} style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: '0.3rem', fontStyle: 'italic' }}>{k}</p>
                <p style={{ color: bg.accent, lineHeight: 1.7 }}>{result.hashtags[k].join(' ')}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Prep Checklist</p>
            <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9 }}>
              {result.prep.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <p style={{ marginTop: '0.75rem', color: bg.accent, fontStyle: 'italic' }}>CTA: {result.cta}</p>
          </div>

          <div style={card}>
            <button onClick={fullExport} style={btnPrimary}>📋 全部 Markdown でコピー</button>
          </div>
        </>
      )}
    </div>
  );
}
