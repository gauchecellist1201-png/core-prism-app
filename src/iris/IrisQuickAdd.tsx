// ============================================================
// IRIS — クイック追加モーダル (スクショ / 音声 / 文字 → AI 自動入力)
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, X } from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType, DealStage, InfluencerDeal } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META, DEAL_STAGE_META } from '../types/influencerDeal';
import { extractDealFromImages, extractDealFromText, type ExtractedDeal } from './dealOCR';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useVoiceInput } from '../hooks/useVoiceInput';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  onClose: () => void;
  onSave: (deal: Omit<InfluencerDeal, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>) => void;
}

type Mode = 'choose' | 'screenshot' | 'voice' | 'manual';

export default function IrisQuickAdd({ bg, settings, onClose, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [images, setImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const [voiceText, setVoiceText] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDeal | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const card: React.CSSProperties = {
    background: '#FFFFFF',
    borderRadius: 22,
    padding: '1.4rem',
  };
  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid rgba(31,26,46,0.12)',
    color: '#1F1A2E',
    padding: '0.65rem 0.9rem',
    borderRadius: 12,
    fontSize: '0.92rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
  };
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.85rem 1.8rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.95rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 8px 22px ${bg.accent}55`,
  };

  // 音声入力 hook
  const { state: voiceState, interim, isAvailable: voiceAvailable, start: voiceStart, stop: voiceStop } = useVoiceInput(
    (text, isFinal) => {
      if (isFinal) setVoiceText(prev => (prev ? prev + ' ' : '') + text);
    },
    { lang: 'ja-JP', continuous: true, interimResults: true, silenceTimeout: 4000 }
  );
  const listening = voiceState === 'listening';

  // 画像追加 (ドラッグドロップ + クリック)
  const onAddFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: typeof images = [];
    for (let i = 0; i < files.length && images.length + next.length < 5; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const dataUrl: string = await new Promise(res => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(f);
      });
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) next.push({ mediaType: m[1], data: m[2], preview: dataUrl });
    }
    setImages([...images, ...next]);
  };

  // ペースト (クリップボードの画像を貼り付け)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(it => it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();
      const dt = new DataTransfer();
      for (const it of imageItems) {
        const f = it.getAsFile();
        if (f) dt.items.add(f);
      }
      onAddFiles(dt.files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  // ドラッグオーバー
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      onAddFiles(e.dataTransfer?.files ?? null);
    };
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const runExtract = async () => {
    setBusy(true); setErr(null);
    try {
      let result: ExtractedDeal;
      if (images.length > 0) {
        result = await extractDealFromImages({
          settings, images: images.map(i => ({ data: i.data, mediaType: i.mediaType })),
          textHint: [voiceText, hint].filter(Boolean).join('\n') || undefined,
        });
      } else {
        const text = [voiceText, hint].filter(Boolean).join('\n');
        if (!text.trim()) { setErr('画像か音声か、何か入力してください'); setBusy(false); return; }
        result = await extractDealFromText({ settings, text });
      }
      setExtracted(result);
    } catch (e: any) {
      setErr(e.message || '抽出失敗');
    } finally { setBusy(false); }
  };

  const handleSave = () => {
    if (!extracted) return;
    if (!extracted.brandName?.trim()) {
      setErr('ブランド名は必須です。プレビュー画面で編集してください。');
      return;
    }
    onSave({
      brandName: extracted.brandName,
      agencyName: extracted.agencyName,
      productName: extracted.productName,
      platform: (extracted.platform || 'instagram') as Platform,
      contentType: (extracted.contentType || 'post') as ContentType,
      fee: extracted.fee || 0,
      usageFee: extracted.usageFee,
      deliverables: extracted.deliverables || '',
      draftDeadline: extracted.draftDeadline,
      postDeadline: extracted.postDeadline,
      reportDeadline: extracted.reportDeadline,
      contactName: extracted.contactName,
      contactEmail: extracted.contactEmail,
      guidelines: extracted.guidelines,
      notes: extracted.notes,
      stage: (extracted.stage || 'inquiry') as DealStage,
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,10,25,0.65)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      {/* モーダル背景の動的グラデーション (Iris ブランドカラー) */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'fixed', top: '10%', left: '20%',
          width: '60vw', height: '60vw', maxWidth: 800, maxHeight: 800,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, #833AB4 0%, #E1306C 25%, #F77737 50%, #FCB045 75%, #833AB4 100%)`,
          filter: 'blur(120px)', opacity: 0.35,
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={{ scale: 0.9, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'rgba(255,250,247,0.96)',
          backdropFilter: 'blur(40px)',
          borderRadius: 32,
          padding: '1.75rem',
          maxWidth: 760, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          fontFamily: IRIS_FONTS.body, color: '#2A1F3F',
          boxShadow: '0 40px 100px rgba(15,10,25,0.5), 0 0 0 1px rgba(255,255,255,0.4) inset',
          border: '1px solid rgba(225,48,108,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 700, textTransform: 'uppercase' }}>
              Quick Add
            </p>
            <h3 style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
              fontSize: '2rem', margin: '0.25rem 0 0', fontWeight: 500,
            }}>
              案件をひとことで追加
            </h3>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer', fontSize: '1rem',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }} aria-label="閉じる"></button>
        </div>

        {/* 退場アニメ待ち禁止(rAF停止環境でモード切替が凍結する)・キー切替入場のみ */}
        <>
          {/* モード選択 */}
          {mode === 'choose' && !extracted && (
            <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p style={{ color: '#5A4570', fontSize: '0.98rem', marginBottom: '1.5rem', lineHeight: 1.8, textAlign: 'center' }}>
                <span style={{ background: `linear-gradient(135deg, ${bg.accent}, #F77737)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
                  3 秒で案件追加。
                </span>
                <br />
                スクショ撮るだけ・話すだけで、AI が全部やります。
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <ModeBtn
                  emoji="" label="スクショから" desc="メール / DM をパシャ"
                  accent="#E1306C" gradient="linear-gradient(135deg, #FCB045 0%, #E1306C 100%)"
                  onClick={() => setMode('screenshot')}
                  badge="一番ラク"
                />
                <ModeBtn
                  emoji="" label="声で話す" desc="ざっくり喋るだけ"
                  accent="#833AB4" gradient="linear-gradient(135deg, #E1306C 0%, #833AB4 100%)"
                  onClick={() => setMode('voice')} disabled={!voiceAvailable}
                  badge="3 秒"
                />
                <ModeBtn
                  emoji="" label="自分で入力" desc="きっちり手入力"
                  accent="#5A4570" gradient="linear-gradient(135deg, #C13584 0%, #5A4570 100%)"
                  onClick={() => setMode('manual')}
                />
              </div>
            </motion.div>
          )}

          {/* スクショモード */}
          {mode === 'screenshot' && !extracted && (
            <motion.div key="ss" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => setMode('choose')} style={{
                background: 'transparent', border: 'none', color: bg.accent,
                cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.75rem', padding: 0,
              }}>← 戻る</button>

              <div ref={dropRef}>
                <label style={{
                  display: 'block', textAlign: 'center', cursor: 'pointer',
                  padding: '2.5rem 1.5rem', border: `2px dashed ${bg.accent}66`,
                  borderRadius: 18, color: '#5A4570',
                  background: 'rgba(255,255,255,0.6)',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}></div>
                  <div style={{ color: '#1F1A2E', fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                    画像をドロップ / クリック / Cmd+V でペースト
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    案件メール、DM、オファーレターのスクショ ({images.length}/5)
                  </div>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => onAddFiles(e.target.files)} />
                </label>
              </div>

              {images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1 / 1' }}>
                      <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                        borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      }} aria-label="画像を削除"><X size={12} strokeWidth={2.5} /></button>
                    </div>
                  ))}
                </div>
              )}

              <textarea style={{ ...inp, width: '100%', minHeight: 60, marginBottom: '0.75rem' }}
                placeholder="補足 (任意): 例: 来月の案件、リール推し" value={hint} onChange={e => setHint(e.target.value)} />

              <button onClick={runExtract} disabled={busy || images.length === 0} style={{
                ...btnPrimary, width: '100%',
                opacity: (busy || images.length === 0) ? 0.5 : 1,
                cursor: (busy || images.length === 0) ? 'not-allowed' : 'pointer',
              }}>
                {busy ? 'AI が読み取ってます…' : 'AI に読み取らせる'}
              </button>
            </motion.div>
          )}

          {/* 音声モード */}
          {mode === 'voice' && !extracted && (
            <motion.div key="voice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => setMode('choose')} style={{
                background: 'transparent', border: 'none', color: bg.accent,
                cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.75rem', padding: 0,
              }}>← 戻る</button>

              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <button
                  onClick={listening ? voiceStop : voiceStart}
                  aria-label={listening ? '録音停止' : '録音開始'}
                  style={{
                    width: 120, height: 120, borderRadius: '50%',
                    background: listening ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}aa)` : 'rgba(255,255,255,0.92)',
                    color: listening ? '#fff' : '#2A1F3F',
                    border: `3px solid ${listening ? bg.accent : 'rgba(31,26,46,0.12)'}`,
                    cursor: 'pointer',
                    boxShadow: listening
                      ? `0 0 0 12px ${bg.accent}22, 0 12px 30px ${bg.accent}55`
                      : '0 4px 12px rgba(0,0,0,0.1)',
                    animation: listening ? 'voice-mega-pulse 1.6s ease-in-out infinite' : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  {listening ? <Square size={48} strokeWidth={2} fill="currentColor" /> : <Mic size={56} strokeWidth={2} />}
                </button>
                <p style={{ marginTop: '1rem', color: '#5A4570', fontSize: '0.92rem' }}>
                  {listening ? '聞いています… (もう一度押すと停止)' : '押して、話すだけ。'}
                </p>
                <p style={{ color: '#8A7AA0', fontSize: '0.78rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  例: 「資生堂から Instagram のリール 1 本、報酬 8 万円、5 月 20 日が下書き、5 月 25 日投稿」
                </p>
              </div>

              {(voiceText || interim) && (
                <div style={{
                  background: 'rgba(255,255,255,0.6)', padding: '0.85rem 1rem', borderRadius: 14,
                  marginBottom: '0.75rem', fontSize: '0.95rem', lineHeight: 1.7,
                }}>
                  <span style={{ color: '#1F1A2E' }}>{voiceText}</span>
                  <span style={{ color: '#8A7AA0', fontStyle: 'italic' }}> {interim}</span>
                </div>
              )}

              <textarea style={{ ...inp, width: '100%', minHeight: 80, marginBottom: '0.5rem' }}
                placeholder="必要なら手動でも編集 OK" value={voiceText} onChange={e => setVoiceText(e.target.value)} />

              <button onClick={runExtract} disabled={busy || !voiceText.trim()} style={{
                ...btnPrimary, width: '100%',
                opacity: (busy || !voiceText.trim()) ? 0.5 : 1,
              }}>
                {busy ? '構造化中…' : 'AI に構造化させる'}
              </button>

              <style>{`
                @keyframes voice-mega-pulse {
                  0%,100% { box-shadow: 0 0 0 12px ${bg.accent}22, 0 12px 30px ${bg.accent}55; }
                  50%     { box-shadow: 0 0 0 24px ${bg.accent}11, 0 12px 40px ${bg.accent}88; }
                }
              `}</style>
            </motion.div>
          )}

          {/* 手動モード — 既存フォームに誘導 */}
          {mode === 'manual' && !extracted && (
            <motion.div key="manual" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <button onClick={() => setMode('choose')} style={{
                background: 'transparent', border: 'none', color: bg.accent,
                cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.75rem', padding: 0,
              }}>← 戻る</button>
              <div style={{ ...card, padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ color: '#5A4570', lineHeight: 1.8, marginBottom: '1rem' }}>
                  画面を閉じて、上の「自分で入力」フォームを使ってください。
                </p>
                <button onClick={onClose} style={btnPrimary}>閉じる</button>
              </div>
            </motion.div>
          )}

          {/* 抽出結果プレビュー (編集可) */}
          {extracted && (
            <motion.div key="preview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p style={{
                fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                color: bg.accent, fontWeight: 700, marginBottom: '0.5rem',
              }}>
                AI の読み取り結果 — 編集して保存
              </p>
              {extracted.confidence !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#5A4570' }}>信頼度:</span>
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.06)', borderRadius: 999, height: 8, overflow: 'hidden', maxWidth: 200 }}>
                    <div style={{
                      background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}cc)`,
                      width: `${(extracted.confidence || 0) * 100}%`, height: '100%',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: bg.accent }}>
                    {Math.round((extracted.confidence || 0) * 100)}%
                  </span>
                </div>
              )}
              {extracted.warnings && extracted.warnings.length > 0 && (
                <div style={{ background: '#FEF3C7', padding: '0.6rem 0.85rem', borderRadius: 12, marginBottom: '0.75rem' }}>
                  {extracted.warnings.map((w, i) => (
                    <p key={i} style={{ fontSize: '0.82rem', color: '#7C2D12', marginBottom: '0.2rem' }}>{w}</p>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <FieldInput label="ブランド名 *" value={extracted.brandName || ''}
                  onChange={v => setExtracted({ ...extracted, brandName: v })} inp={inp} />
                <FieldInput label="代理店名" value={extracted.agencyName || ''}
                  onChange={v => setExtracted({ ...extracted, agencyName: v })} inp={inp} />
                <FieldInput label="商品/キャンペーン名" value={extracted.productName || ''}
                  onChange={v => setExtracted({ ...extracted, productName: v })} inp={inp} />
                <FieldSelect label="プラットフォーム" value={extracted.platform || 'instagram'}
                  onChange={v => setExtracted({ ...extracted, platform: v as Platform })} inp={inp}
                  options={Object.entries(PLATFORM_META).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
                <FieldSelect label="コンテンツ" value={extracted.contentType || 'post'}
                  onChange={v => setExtracted({ ...extracted, contentType: v as ContentType })} inp={inp}
                  options={Object.entries(CONTENT_TYPE_META).map(([k, v]) => ({ value: k, label: v }))} />
                <FieldInput label="報酬 (円)" type="number" value={String(extracted.fee || '')}
                  onChange={v => setExtracted({ ...extracted, fee: Number(v) || undefined })} inp={inp} />
                <FieldInput label="納品物" value={extracted.deliverables || ''}
                  onChange={v => setExtracted({ ...extracted, deliverables: v })} inp={inp} />
                <FieldInput label="下書き期限" type="datetime-local" value={extracted.draftDeadline || ''}
                  onChange={v => setExtracted({ ...extracted, draftDeadline: v })} inp={inp} />
                <FieldInput label="投稿期限" type="datetime-local" value={extracted.postDeadline || ''}
                  onChange={v => setExtracted({ ...extracted, postDeadline: v })} inp={inp} />
                <FieldInput label="レポート期限" type="datetime-local" value={extracted.reportDeadline || ''}
                  onChange={v => setExtracted({ ...extracted, reportDeadline: v })} inp={inp} />
                <FieldInput label="担当者" value={extracted.contactName || ''}
                  onChange={v => setExtracted({ ...extracted, contactName: v })} inp={inp} />
                <FieldInput label="メール" value={extracted.contactEmail || ''}
                  onChange={v => setExtracted({ ...extracted, contactEmail: v })} inp={inp} />
                <FieldSelect label="ステージ" value={extracted.stage || 'inquiry'}
                  onChange={v => setExtracted({ ...extracted, stage: v as DealStage })} inp={inp}
                  options={Object.entries(DEAL_STAGE_META).sort((a, b) => a[1].order - b[1].order).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
              </div>

              <textarea style={{ ...inp, width: '100%', minHeight: 50, marginBottom: '0.5rem' }}
                placeholder="ガイドライン (#PR必須・NGワード等)"
                value={extracted.guidelines || ''}
                onChange={e => setExtracted({ ...extracted, guidelines: e.target.value })} />
              <textarea style={{ ...inp, width: '100%', minHeight: 50, marginBottom: '0.75rem' }}
                placeholder="メモ"
                value={extracted.notes || ''}
                onChange={e => setExtracted({ ...extracted, notes: e.target.value })} />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setExtracted(null)} style={{
                  background: 'transparent', color: '#5A4570', border: '1px solid rgba(31,26,46,0.12)',
                  padding: '0.85rem 1.4rem', borderRadius: 999, cursor: 'pointer', fontWeight: 600, flex: 1,
                }}>
                  ← やり直す
                </button>
                <button onClick={handleSave} style={{ ...btnPrimary, flex: 2 }}>
                  案件として保存
                </button>
              </div>
            </motion.div>
          )}
        </>

        {err && (
          <div style={{
            background: 'rgba(200,16,46,0.08)', border: '1px solid rgba(200,16,46,0.25)',
            padding: '0.6rem 0.85rem', borderRadius: 12, marginTop: '0.75rem',
            color: '#9B1B30', fontSize: '0.85rem',
          }}>
            {err}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ModeBtn({ emoji, label, desc, accent, gradient, onClick, disabled, badge }: {
  emoji: string; label: string; desc: string; accent: string; gradient?: string;
  onClick: () => void; disabled?: boolean; badge?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -6, transition: { type: 'spring', stiffness: 400, damping: 18 } }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        border: `1px solid ${accent}33`,
        borderRadius: 22,
        padding: '2rem 1rem 1.6rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'center',
        color: '#1F1A2E',
        fontFamily: IRIS_FONTS.body,
        opacity: disabled ? 0.4 : 1,
        overflow: 'hidden',
        boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
      }}
    >
      {/* グラデのアクセント (上部) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
        background: gradient || `linear-gradient(90deg, ${accent}, ${accent}aa)`,
      }} />
      {/* バッジ */}
      {badge && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: gradient || `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: '#fff', padding: '0.18rem 0.55rem', borderRadius: 999,
          fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {badge}
        </div>
      )}
      {/* 背景のグラデーションオーラ (ホバー時に拡大) */}
      <div style={{
        position: 'absolute', bottom: -50, left: '50%', transform: 'translateX(-50%)',
        width: 140, height: 140, borderRadius: '50%',
        background: gradient || accent,
        filter: 'blur(40px)', opacity: 0.18,
        pointerEvents: 'none',
      }} />

      {/* アイコンを大きく */}
      <div style={{
        fontSize: '3rem', marginBottom: '0.75rem',
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.1))',
      }}>{emoji}</div>
      <div style={{
        fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
        fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.3rem',
        background: gradient || `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '0.82rem', color: '#5A4570', lineHeight: 1.5 }}>{desc}</div>
    </motion.button>
  );
}

function FieldInput({ label, value, onChange, type = 'text', inp }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; inp: React.CSSProperties;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: '0.7rem', color: '#5A4570', display: 'block', marginBottom: '0.2rem' }}>{label}</span>
      <input style={{ ...inp, width: '100%' }} type={type} value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function FieldSelect({ label, value, onChange, options, inp }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; inp: React.CSSProperties;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: '0.7rem', color: '#5A4570', display: 'block', marginBottom: '0.2rem' }}>{label}</span>
      <select style={{ ...inp, width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
