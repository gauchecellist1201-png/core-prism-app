// ============================================================
// IrisReelComposer — 素材の文脈を理解して「文章・順番・カット」を自動構成
//
// オーナー指示 (2026-06-18): 動画素材の文脈を理解し、適切な文章生成と順番・カットを作る。
//
// ユーザーが撮った動画/画像を順不同で放り込む → Iris が各素材の中身を読み取り、
// リールとして一番伸びる「並び順・各カットの役割・字幕・ナレーション・秒数」を設計して返す。
// 文脈(分析のオーディエンス/世界観/テーマ)を渡すと、その層に刺さる言葉で書く。
// ============================================================
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Loader2, RefreshCw, Film, Clock, X, Wand2, Hash } from 'lucide-react';
import {
  composeReelFromClips, type ReelComposition, type ComposeContext, type CutInput, type CutRole,
} from './reelAiCaption';
import type { IrisBackgroundDef } from './irisStyle';

interface ClipMeta { id: string; kind: 'image' | 'video'; url: string; name: string; duration: number }

interface Props {
  bg: IrisBackgroundDef;
  /** 分析から得た文脈 (オーディエンス/世界観/テーマ) */
  context?: ComposeContext;
  accent?: string;
}

const ROLE_META: Record<CutRole, { label: string; color: string }> = {
  hook: { label: 'フック', color: '#E1306C' },
  build: { label: '惹きつけ', color: '#833AB4' },
  payoff: { label: '山場', color: '#F77737' },
  cta: { label: '締め', color: '#10B981' },
};

let _cid = 0;
const nextId = () => `clip_${++_cid}`;

function loadClip(file: File): Promise<{ meta: ClipMeta; el: HTMLImageElement | HTMLVideoElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video');
    if (isVideo) {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
      v.onloadedmetadata = () => resolve({
        meta: { id: nextId(), kind: 'video', url, name: file.name, duration: Math.min(6, Math.max(1, v.duration || 3)) },
        el: v,
      });
      v.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} を読み込めませんでした`)); };
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve({
        meta: { id: nextId(), kind: 'image', url, name: file.name, duration: 3 },
        el: img,
      });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} を読み込めませんでした`)); };
    }
  });
}

export default function IrisReelComposer({ bg, context, accent = '#E1306C' }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const elMap = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map());
  const [clips, setClips] = useState<ClipMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [comp, setComp] = useState<ReelComposition | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    const arr = Array.from(files).slice(0, 12);
    try {
      const loaded = await Promise.all(arr.map(loadClip));
      loaded.forEach(({ meta, el }) => elMap.current.set(meta.id, el));
      setClips((prev) => [...prev, ...loaded.map((l) => l.meta)].slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : '素材の読み込みに失敗しました');
    }
  };

  const removeClip = (id: string) => {
    const meta = clips.find((c) => c.id === id);
    if (meta) { try { URL.revokeObjectURL(meta.url); } catch { /* */ } }
    elMap.current.delete(id);
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  const compose = async () => {
    if (!clips.length) { setError('まず素材を1つ以上追加してください'); return; }
    setBusy(true); setError(null); setComp(null); setProgress('');
    try {
      const inputs: CutInput[] = clips.map((c) => ({
        kind: c.kind, el: elMap.current.get(c.id)!, duration: c.duration,
      })).filter((i) => i.el);
      const result = await composeReelFromClips(inputs, {
        context,
        onProgress: (phase) => setProgress(phase),
      });
      setComp(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '構成の生成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const clipById = (i: number) => clips[i];

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
        撮った動画・写真をそのまま入れてください。Iris が中身を読み取り、
        <strong style={{ color: bg.ink }}>並び順・カットの役割・字幕</strong>まで自動で構成します。
      </p>

      {/* 素材グリッド */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {clips.map((c, i) => (
          <div key={c.id} style={{ position: 'relative', width: 72, height: 96, borderRadius: 10, overflow: 'hidden', border: `1px solid ${bg.cardBorder}` }}>
            {c.kind === 'video'
              ? <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 5, padding: '1px 5px' }}>
              {i + 1}{c.kind === 'video' ? <Film size={8} style={{ marginLeft: 3, verticalAlign: 'middle' }} /> : ''}
            </div>
            <button type="button" onClick={() => removeClip(c.id)} aria-label="削除"
              style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <X size={11} />
            </button>
          </div>
        ))}
        {clips.length < 12 && (
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ width: 72, height: 96, borderRadius: 10, border: `1.5px dashed ${accent}66`, background: `${accent}0D`, color: accent, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 10, fontWeight: 700 }}>
            <Upload size={18} /> 追加
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ''; }} />

      {/* 構成ボタン */}
      {!busy && (
        <button type="button" onClick={compose} disabled={!clips.length}
          style={{
            width: '100%', minHeight: 50, marginBottom: 4,
            background: clips.length ? `linear-gradient(135deg, ${accent}, #F77737)` : `${accent}44`,
            color: '#fff', border: 'none', borderRadius: 14, fontSize: 14.5, fontWeight: 800,
            cursor: clips.length ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 22px ${accent}33`,
          }}>
          <Wand2 size={17} /> {comp ? 'もう一度 構成する' : '文脈を読んで構成する'}
        </button>
      )}

      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', color: bg.inkSoft, fontSize: 13 }}>
          <Loader2 size={16} className="iris-spin" /> {progress || '構成中…'}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: '#9B1B30', lineHeight: 1.5 }}>{error}</div>
          {!!clips.length && (
            <button type="button" onClick={compose}
              style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(200,16,46,0.3)', color: '#9B1B30', fontSize: 11.5, fontWeight: 800, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} /> 再試行
            </button>
          )}
        </div>
      )}

      {/* 構成結果 */}
      {comp && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: bg.inkSoft }}>テーマ: {comp.themeGuess}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: bg.ink, lineHeight: 1.4, margin: '4px 0 6px' }}>{comp.title}</div>
          {comp.editorNote && (
            <div style={{ fontSize: 12, color: bg.inkSoft, lineHeight: 1.6, background: `${accent}0D`, borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
              ねらい: {comp.editorNote}
            </div>
          )}

          {/* 並べ替えられたカット */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {comp.cuts.map((cut) => {
              const clip = clipById(cut.sourceIndex);
              const rm = ROLE_META[cut.role];
              return (
                <div key={cut.order} style={{ display: 'flex', gap: 10, background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 14, padding: 10 }}>
                  <div style={{ position: 'relative', width: 64, height: 86, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: '#0001' }}>
                    {clip ? (clip.kind === 'video'
                      ? <video src={clip.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <img src={clip.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : null}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, fontWeight: 800, textAlign: 'center', padding: '1px 0' }}>
                      元#{cut.sourceIndex + 1}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>{cut.order + 1}.</span>
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: rm.color, borderRadius: 99, padding: '2px 8px' }}>{rm.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: bg.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Clock size={10} />{cut.durationSec}s</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: bg.ink, lineHeight: 1.4 }}>{cut.overlayText || '（字幕なし）'}</div>
                    {cut.narration && <div style={{ fontSize: 11.5, color: bg.inkSoft, lineHeight: 1.5, marginTop: 2 }}>🎙 {cut.narration}</div>}
                    {cut.reason && <div style={{ fontSize: 10.5, color: bg.inkSoft, lineHeight: 1.45, marginTop: 4, opacity: 0.85 }}>なぜ: {cut.reason}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 本文 + ハッシュタグ */}
          {comp.caption && (
            <div style={{ marginTop: 12, background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: accent, marginBottom: 6 }}>投稿本文</div>
              <div style={{ fontSize: 12.5, color: bg.ink, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{comp.caption}</div>
              {comp.hashtags.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {comp.hashtags.slice(0, 12).map((h, i) => (
                    <span key={i} style={{ fontSize: 10.5, color: bg.inkSoft, background: `${accent}10`, borderRadius: 6, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                      <Hash size={9} />{h.replace(/^#/, '')}
                    </span>
                  ))}
                </div>
              )}
              <button type="button"
                onClick={() => { try { navigator.clipboard?.writeText(`${comp.caption}\n\n${comp.hashtags.join(' ')}`); } catch { /* */ } }}
                style={{ marginTop: 10, background: 'transparent', border: `1px solid ${bg.cardBorder}`, color: bg.ink, fontSize: 11.5, fontWeight: 800, borderRadius: 10, padding: '8px 12px', cursor: 'pointer' }}>
                本文＋タグをコピー
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
