// ============================================================
// IRIS — DM スクショから案件カードを自動作成するモーダル
//
// 「DM のスクショを撮るだけで AI が案件名・条件・締切を読み取り、
//  案件カードを自動作成」という Iris の中核プレゼンを実装。
// ============================================================
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2, X, RefreshCw, CheckCircle2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { captureDealFromScreenshot, capturedDealToDealInput, type CapturedDeal } from './dealCapture';
import type { InfluencerDeal } from '../types/influencerDeal';

type DealInput = Omit<InfluencerDeal, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>;

interface Props {
  bg: IrisBackgroundDef;
  onClose: () => void;
  /** 抽出 → 編集確定後に呼ばれる。InfluencerDesk.addDeal に渡す形 */
  onSave: (deal: DealInput) => void;
}

type Step = 'pick' | 'extracting' | 'review' | 'error';

interface ErrorState { message: string; recovery: string; rawText?: string }

export default function IrisDealCaptureModal({ bg, onClose, onSave }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [preview, setPreview] = useState<string | null>(null);
  const [deal, setDeal] = useState<CapturedDeal | null>(null);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [errState, setErrState] = useState<ErrorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ink が薄色なら dark テーマ (背景が暗い前提) と判定
  const isDark = (() => {
    const c = (bg.ink || '').replace('#', '');
    if (c.length < 3) return false;
    // 短縮形 #fff → ffffff
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // ink が明るい (輝度 > 180) なら dark テーマ
    return (r * 0.299 + g * 0.587 + b * 0.114) > 180;
  })();
  const panelBg = isDark ? 'rgba(28,22,42,0.96)' : 'rgba(255,250,247,0.96)';
  const ink = bg.ink;
  const inkSoft = bg.inkSoft;

  const runExtract = useCallback(async (file: File) => {
    setStep('extracting');
    setErrState(null);
    // preview
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(file);

    const result = await captureDealFromScreenshot(file);
    if (!result.ok) {
      setErrState({
        message: result.message,
        recovery: result.recovery,
        rawText: result.rawText,
      });
      setStep('error');
      return;
    }
    setDeal(result.deal);
    setConfidence(result.confidence);
    setStep('review');
  }, []);

  const onPick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.type.startsWith('image/')) {
      setErrState({
        message: '画像ファイルを選んでください',
        recovery: 'PNG / JPEG / WebP の画像のみ対応です',
      });
      setStep('error');
      return;
    }
    runExtract(f);
  };

  const reset = () => {
    setStep('pick');
    setPreview(null);
    setDeal(null);
    setErrState(null);
  };

  const handleSave = () => {
    if (!deal) return;
    const input = capturedDealToDealInput(deal);
    onSave(input);
    onClose();
  };

  const updateField = <K extends keyof CapturedDeal>(k: K, v: CapturedDeal[K]) => {
    setDeal(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const inp: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.96)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(31,26,46,0.12)'}`,
    color: ink,
    padding: '0.7rem 0.9rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
    width: '100%',
    minHeight: 44,
  };
  const label: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: inkSoft, marginBottom: 4, display: 'block',
  };
  const btnPrimary: React.CSSProperties = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.9rem 1.8rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.98rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 10px 28px ${bg.accent}55`,
    minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };
  const btnSecondary: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    color: ink, border: 'none', borderRadius: 999,
    padding: '0.75rem 1.3rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.92rem', fontFamily: IRIS_FONTS.body,
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };

  const confidenceMeta: Record<'high' | 'medium' | 'low', { label: string; color: string; hint: string }> = {
    high:   { label: 'しっかり読めました', color: '#10B981', hint: 'そのままで OK そうです。' },
    medium: { label: '一部 推定込み',       color: '#F59E0B', hint: '空欄が残っている場合は補ってください。' },
    low:    { label: '読み取り弱め',        color: '#EF4444', hint: '間違いがないか必ず確認してください。' },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(15,10,25,0.65)', backdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: panelBg,
          backdropFilter: 'blur(36px)',
          borderRadius: 28,
          padding: '1.5rem',
          maxWidth: 640, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          fontFamily: IRIS_FONTS.body, color: ink,
          boxShadow: '0 36px 90px rgba(15,10,25,0.5)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(225,48,108,0.15)'}`,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>
              DM Capture
            </p>
            <h3 style={{
              fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
              fontSize: '1.6rem', margin: '0.2rem 0 0', fontWeight: 500, color: ink,
            }}>
              DM スクショから案件追加
            </h3>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{
            background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
            border: 'none', borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            color: ink,
          }}>
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Step 1: ファイル選択 ─── */}
          {step === 'pick' && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ color: inkSoft, fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 1.2rem' }}>
                Instagram / X / メールの DM スクショを 1 枚送るだけで、
                AI が <strong>案件名・報酬・締切</strong> を読んで案件カードを作ります。
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={e => onPick(e.target.files)}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  background: `linear-gradient(135deg, ${bg.accent}22, ${bg.accent}11)`,
                  border: `2px dashed ${bg.accent}66`,
                  borderRadius: 20,
                  padding: '2rem 1rem',
                  cursor: 'pointer',
                  color: ink,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  minHeight: 160,
                }}
              >
                <Camera size={36} color={bg.accent} strokeWidth={1.8} />
                <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>スクショを選ぶ</div>
                <div style={{ fontSize: '0.82rem', color: inkSoft }}>PNG / JPEG / WebP・1 枚まで</div>
              </button>

              <div style={{
                marginTop: '1rem',
                padding: '0.8rem 1rem',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderRadius: 14,
                fontSize: '0.82rem',
                color: inkSoft,
                lineHeight: 1.7,
              }}>
                <strong style={{ color: ink }}>コツ:</strong> DM の本文がはっきり読める明るさで撮影。
                送り主のアカウント名・本文・送信時刻が 1 枚に収まっていると精度が上がります。
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: 抽出中 ─── */}
          {step === 'extracting' && (
            <motion.div key="ext" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              {preview && (
                <img src={preview} alt="" style={{
                  maxWidth: 220, maxHeight: 280, borderRadius: 16,
                  marginBottom: '1.2rem', boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
                }} />
              )}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: bg.accent, marginBottom: 8 }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-flex' }}
                >
                  <Loader2 size={20} />
                </motion.div>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>AI が DM を読んでいます…</span>
              </div>
              <p style={{ color: inkSoft, fontSize: '0.85rem', margin: '0.4rem 0 0' }}>
                ふつう 5-15 秒くらい。少しお待ちください。
              </p>
            </motion.div>
          )}

          {/* ─── Step 3: プレビュー (編集可) ─── */}
          {step === 'review' && deal && (
            <motion.div key="rev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* confidence banner */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0.7rem 0.9rem',
                background: confidenceMeta[confidence].color + '18',
                border: `1px solid ${confidenceMeta[confidence].color}44`,
                borderRadius: 14,
                marginBottom: '1rem',
              }}>
                <CheckCircle2 size={18} color={confidenceMeta[confidence].color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: ink }}>
                    {confidenceMeta[confidence].label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: inkSoft }}>
                    {confidenceMeta[confidence].hint}
                  </div>
                </div>
              </div>

              {/* AI 要約 */}
              {deal.summary && (
                <div style={{
                  padding: '0.8rem 1rem',
                  background: `linear-gradient(135deg, ${bg.accent}10, ${bg.accent}05)`,
                  borderLeft: `3px solid ${bg.accent}`,
                  borderRadius: 12,
                  marginBottom: '1rem',
                  fontSize: '0.9rem',
                  color: ink,
                  lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: bg.accent, marginBottom: 4, letterSpacing: '0.1em' }}>AI 要約</div>
                  {deal.summary}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.7rem' }}>
                <div>
                  <label style={label}>ブランド名 *</label>
                  <input style={inp} value={deal.brandName || ''} onChange={e => updateField('brandName', e.target.value)} placeholder="例: SHISEIDO" />
                </div>
                <div>
                  <label style={label}>送り主 (@ハンドル)</label>
                  <input style={inp} value={deal.senderHandle || ''} onChange={e => updateField('senderHandle', e.target.value)} placeholder="@brand_official" />
                </div>
                <div>
                  <label style={label}>担当者名</label>
                  <input style={inp} value={deal.contactName || ''} onChange={e => updateField('contactName', e.target.value)} placeholder="田中" />
                </div>
                <div>
                  <label style={label}>カテゴリ</label>
                  <input style={inp} value={deal.category || ''} onChange={e => updateField('category', e.target.value)} placeholder="コスメ / ファッション / グルメ" />
                </div>
                <div>
                  <label style={label}>報酬 (円)</label>
                  <input style={inp} type="number" value={deal.fee ?? ''} onChange={e => updateField('fee', e.target.value === '' ? null : Number(e.target.value))} placeholder="50000" />
                </div>
                <div>
                  <label style={label}>締切</label>
                  <input style={inp} value={deal.deadline || ''} onChange={e => updateField('deadline', e.target.value)} placeholder="11/30 まで" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>依頼内容 / 納品物</label>
                  <textarea
                    style={{ ...inp, minHeight: 70, resize: 'vertical' }}
                    value={deal.requirements || ''}
                    onChange={e => updateField('requirements', e.target.value)}
                    placeholder="例: フィードリール 1 本 + ストーリー 3 枚"
                  />
                </div>
              </div>

              {/* rawText 折りたたみ */}
              {deal.rawText && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: inkSoft, fontSize: '0.82rem' }}>
                    <ImageIcon size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    AI が読み取った原文 (デバッグ用)
                  </summary>
                  <pre style={{
                    marginTop: 8,
                    padding: '0.7rem 0.9rem',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    color: inkSoft,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}>{deal.rawText}</pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.4rem', flexWrap: 'wrap' }}>
                <button onClick={reset} style={btnSecondary}>
                  <RefreshCw size={14} /> 別のスクショ
                </button>
                <button onClick={handleSave} style={btnPrimary} disabled={!deal.brandName?.trim()}>
                  <CheckCircle2 size={16} /> この内容で案件を登録
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 4: エラー ─── */}
          {step === 'error' && errState && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '1rem',
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: 14,
                marginBottom: '1rem',
              }}>
                <AlertTriangle size={22} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: ink, fontSize: '1rem', marginBottom: 4 }}>
                    {errState.message}
                  </div>
                  <div style={{ color: inkSoft, fontSize: '0.88rem', lineHeight: 1.7 }}>
                    {errState.recovery}
                  </div>
                </div>
              </div>

              {errState.rawText && (
                <details style={{ marginBottom: '1rem' }}>
                  <summary style={{ cursor: 'pointer', color: inkSoft, fontSize: '0.82rem' }}>
                    AI が読み取れた文字 (参考)
                  </summary>
                  <pre style={{
                    marginTop: 8,
                    padding: '0.7rem 0.9rem',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 10,
                    fontSize: '0.78rem',
                    color: inkSoft,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}>{errState.rawText}</pre>
                </details>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={btnSecondary}>閉じる</button>
                <button onClick={reset} style={btnPrimary}>
                  <RefreshCw size={16} /> もう一度
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
