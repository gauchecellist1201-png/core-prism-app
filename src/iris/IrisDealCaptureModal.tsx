// ============================================================
// IRIS — DM スクショから案件カードを自動作成するモーダル
//
// 「DM のスクショ (1〜3 枚) を撮るだけで AI が案件名・条件・締切を読み取り、
//  低信頼フィールドは追加質問で補完、過去案件があれば料金提案、
//  詐欺シグナルがあれば警告 → 案件カードを自動作成」
//
// 中核プレゼン機能 — Day 1 アップグレード版
// ============================================================
import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, X, RefreshCw, CheckCircle2, AlertTriangle, Image as ImageIcon,
  Plus, Trash2, History, ShieldAlert, MessageCircleQuestion,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import {
  captureDealFromScreenshots, capturedDealToDealInput,
  findSimilarPastDeal, detectCaptureWarnings,
  type CapturedDeal, type SimilarPastDeal, type CaptureWarning, type PastDealRef,
} from './dealCapture';
import type { InfluencerDeal } from '../types/influencerDeal';
import AILoadingState from '../components/AILoadingState';

type DealInput = Omit<InfluencerDeal, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>;

interface Props {
  bg: IrisBackgroundDef;
  onClose: () => void;
  /** 抽出 → 編集確定後に呼ばれる。InfluencerDesk.addDeal に渡す形 */
  onSave: (deal: DealInput) => void;
  /** 過去案件 — 似た案件があれば料金提案 */
  pastDeals?: PastDealRef[];
}

type Step = 'pick' | 'extracting' | 'clarify' | 'review' | 'error';

interface ErrorState { message: string; recovery: string; rawText?: string }

const MAX_FILES = 3;

export default function IrisDealCaptureModal({ bg, onClose, onSave, pastDeals = [] }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [deal, setDeal] = useState<CapturedDeal | null>(null);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium');
  const [weakFields, setWeakFields] = useState<string[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<CaptureWarning[]>([]);
  const [similarDeal, setSimilarDeal] = useState<SimilarPastDeal | null>(null);
  const [errState, setErrState] = useState<ErrorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ink が薄色なら dark テーマ (背景が暗い前提) と判定
  const isDark = useMemo(() => {
    const c = (bg.ink || '').replace('#', '');
    if (c.length < 3) return false;
    const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c.padEnd(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 180;
  }, [bg.ink]);
  const panelBg = isDark ? 'rgba(28,22,42,0.96)' : 'rgba(255,250,247,0.96)';
  const ink = bg.ink;
  const inkSoft = bg.inkSoft;

  const runExtract = useCallback(async (fs: File[]) => {
    setStep('extracting');
    setErrState(null);
    // previews
    setPreviews([]);
    const newPreviews: string[] = await Promise.all(fs.map(f => new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('読み込み失敗'));
      r.readAsDataURL(f);
    }))).catch(() => []);
    setPreviews(newPreviews);

    const result = await captureDealFromScreenshots(fs);
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
    setWeakFields(result.weakFields);
    setFollowUpQuestions(result.followUpQuestions);
    setClarifyAnswers(new Array(result.followUpQuestions.length).fill(''));
    setWarnings(detectCaptureWarnings(result.deal));
    setSimilarDeal(findSimilarPastDeal(result.deal, pastDeals));

    // 質問があれば clarify ステップへ、なければ review へ直行
    if (result.followUpQuestions.length > 0 && result.confidence !== 'high') {
      setStep('clarify');
    } else {
      setStep('review');
    }
  }, [pastDeals]);

  const addFiles = (newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (incoming.length === 0) {
      setErrState({
        message: '画像ファイルを選んでください',
        recovery: 'PNG / JPEG / WebP の画像のみ対応です',
      });
      setStep('error');
      return;
    }
    const merged = [...files, ...incoming].slice(0, MAX_FILES);
    setFiles(merged);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const startExtract = () => {
    if (files.length === 0) return;
    runExtract(files);
  };

  const reset = () => {
    setStep('pick');
    setFiles([]);
    setPreviews([]);
    setDeal(null);
    setWeakFields([]);
    setFollowUpQuestions([]);
    setClarifyAnswers([]);
    setWarnings([]);
    setSimilarDeal(null);
    setErrState(null);
  };

  const applyClarifyAnswersToDeal = () => {
    if (!deal) return;
    let next = { ...deal };
    followUpQuestions.forEach((q, i) => {
      const ans = (clarifyAnswers[i] || '').trim();
      if (!ans) return;
      const wf = weakFields[i]; // 同じ index で weakField とペア
      // 報酬は数字に変換
      if (wf === 'fee') {
        const n = Number(ans.replace(/[^\d]/g, ''));
        if (!isNaN(n) && n > 0) next.fee = n;
      } else if (wf === 'brandName')    next.brandName = ans;
      else if (wf === 'deadline')       next.deadline = ans;
      else if (wf === 'requirements')   next.requirements = ans;
      else if (wf === 'senderHandle')   next.senderHandle = ans;
      else if (wf === 'contactName')    next.contactName = ans;
      else if (wf === 'category')       next.category = ans;
      else {
        // 該当 weakField がなければ notes に追記する形 (rawText 末尾へ)
        next.rawText = (next.rawText || '') + `\n[補足] ${q} → ${ans}`;
      }
      // 答えを反映したら summary にも追記
      next.summary = (next.summary || '') + ` / ${ans}`;
    });
    setDeal(next);
    setSimilarDeal(findSimilarPastDeal(next, pastDeals));
    setWarnings(detectCaptureWarnings(next));
    setStep('review');
  };

  const skipClarify = () => setStep('review');

  const handleSave = () => {
    if (!deal) return;
    const input = capturedDealToDealInput(deal);
    onSave(input);
    onClose();
  };

  const updateField = <K extends keyof CapturedDeal>(k: K, v: CapturedDeal[K]) => {
    setDeal(prev => prev ? { ...prev, [k]: v } : prev);
  };

  const applySimilarFee = () => {
    if (!similarDeal || !deal) return;
    updateField('fee', similarDeal.fee);
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

  const highestSeverity = warnings.reduce<'high' | 'medium' | 'low' | null>((acc, w) => {
    if (acc === 'high') return acc;
    if (w.severity === 'high') return 'high';
    if (w.severity === 'medium' && acc !== 'medium') return 'medium';
    if (!acc) return w.severity;
    return acc;
  }, null);
  const warningColor =
    highestSeverity === 'high' ? '#EF4444' :
    highestSeverity === 'medium' ? '#F59E0B' :
    '#FFB020';

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
          {/* ─── Step 1: ファイル選択 (最大 3 枚) ─── */}
          {step === 'pick' && (
            <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ color: inkSoft, fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 1.2rem' }}>
                Instagram / X / メールの DM スクショを <strong>最大 3 枚</strong> 送るだけで、
                AI が <strong>案件名・報酬・締切</strong> を読んで案件カードを作ります。
                <br />
                <span style={{ fontSize: '0.85rem' }}>長い DM は上→下の順で 2〜3 枚に分けると精度が上がります。</span>
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
              />

              {/* 選択済みプレビュー */}
              {files.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: '1rem' }}>
                  {files.map((f, i) => (
                    <FilePreview key={i} file={f} onRemove={() => removeFile(i)} isDark={isDark} ink={ink} inkSoft={inkSoft} index={i} />
                  ))}
                  {files.length < MAX_FILES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'transparent',
                        border: `2px dashed ${bg.accent}66`,
                        borderRadius: 14,
                        minHeight: 110,
                        cursor: 'pointer',
                        color: bg.accent,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                      <Plus size={22} />
                      <div style={{ fontSize: 11, fontWeight: 700 }}>追加 ({files.length}/{MAX_FILES})</div>
                    </button>
                  )}
                </div>
              )}

              {files.length === 0 && (
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
                  <div style={{ fontSize: '0.82rem', color: inkSoft }}>PNG / JPEG / WebP・最大 {MAX_FILES} 枚</div>
                </button>
              )}

              {files.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: '0.8rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setFiles([])} style={btnSecondary}>
                    <Trash2 size={14} /> 全部消す
                  </button>
                  <button onClick={startExtract} style={btnPrimary}>
                    <Camera size={16} /> AI に読ませる ({files.length} 枚)
                  </button>
                </div>
              )}

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
              style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
              {previews.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {previews.map((p, i) => (
                    <img key={i} src={p} alt="" style={{
                      maxWidth: 140, maxHeight: 200, borderRadius: 12,
                      boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
                    }} />
                  ))}
                </div>
              )}
              <AILoadingState
                active={true}
                brand="iris"
                label={`AI が DM を読んでいます (${previews.length} 枚)`}
                stages={[
                  'スクショの文字を OCR',
                  'ブランド名と担当者を特定',
                  '報酬・締切・依頼内容を抽出',
                  '案件カードに整形',
                ]}
                hint="ふつう 5-15 秒くらい"
                skeletonLines={4}
              />
            </motion.div>
          )}

          {/* ─── Step 3 (新): 追加質問で補完 ─── */}
          {step === 'clarify' && deal && (
            <motion.div key="clar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '0.9rem 1rem',
                background: `${bg.accent}14`,
                border: `1px solid ${bg.accent}40`,
                borderRadius: 14,
                marginBottom: '1.2rem',
              }}>
                <MessageCircleQuestion size={22} color={bg.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: ink, fontSize: '1rem', marginBottom: 4 }}>
                    あと少しだけ教えてください
                  </div>
                  <div style={{ color: inkSoft, fontSize: '0.86rem', lineHeight: 1.7 }}>
                    AI が読み切れなかった部分を補えば、案件カードがもっと正確になります。
                    分かる範囲で OK・分からなければスキップして手入力もできます。
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '0.9rem' }}>
                {followUpQuestions.map((q, i) => (
                  <div key={i}>
                    <label style={label}>
                      <span style={{ color: bg.accent, fontWeight: 800 }}>{`Q${i + 1}.`}</span>{' '}
                      {q}
                    </label>
                    <input
                      style={inp}
                      value={clarifyAnswers[i] || ''}
                      onChange={e => setClarifyAnswers(prev => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })}
                      placeholder="分かる範囲で OK"
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.4rem', flexWrap: 'wrap' }}>
                <button onClick={skipClarify} style={btnSecondary}>スキップ</button>
                <button onClick={applyClarifyAnswersToDeal} style={btnPrimary}>
                  <CheckCircle2 size={16} /> 反映して確認へ
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── Step 4: プレビュー (編集可) ─── */}
          {step === 'review' && deal && (
            <motion.div key="rev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* 警告 (NG ワード自動検出) */}
              {warnings.length > 0 && (
                <div style={{
                  padding: '0.8rem 1rem',
                  background: `${warningColor}1A`,
                  border: `1px solid ${warningColor}55`,
                  borderRadius: 14,
                  marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <ShieldAlert size={18} color={warningColor} />
                    <div style={{ fontWeight: 800, color: ink, fontSize: '0.94rem' }}>
                      {highestSeverity === 'high' ? '注意: 詐欺の可能性があります' :
                       highestSeverity === 'medium' ? '気をつけたい点があります' :
                       '一応確認しておきましょう'}
                    </div>
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 1.2rem', color: inkSoft, fontSize: '0.84rem', lineHeight: 1.7 }}>
                    {warnings.map((w, i) => (
                      <li key={i}>
                        <strong style={{ color: ink }}>{w.kind}</strong> — {w.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 過去案件サジェスト */}
              {similarDeal && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '0.8rem 1rem',
                  background: `${bg.accent}10`,
                  border: `1px solid ${bg.accent}30`,
                  borderRadius: 14,
                  marginBottom: '1rem',
                }}>
                  <History size={18} color={bg.accent} style={{ flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: ink, fontSize: '0.92rem', marginBottom: 2 }}>
                      {similarDeal.reason}
                    </div>
                    <div style={{ color: inkSoft, fontSize: '0.83rem', lineHeight: 1.6 }}>
                      前回は <strong style={{ color: ink }}>¥{similarDeal.fee.toLocaleString()}</strong> でした。
                      {deal.fee == null || deal.fee === 0 ? '同じ料金でいきますか?' : (deal.fee === similarDeal.fee ? '今回も同じ料金です。' : `今回は ¥${(deal.fee).toLocaleString()} の提示です。`)}
                    </div>
                  </div>
                  {(deal.fee == null || deal.fee === 0 || deal.fee !== similarDeal.fee) && (
                    <button
                      onClick={applySimilarFee}
                      style={{
                        background: bg.accent, color: '#fff', border: 'none',
                        borderRadius: 999, padding: '0.5rem 0.9rem', fontWeight: 700,
                        fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      ¥{similarDeal.fee.toLocaleString()} で揃える
                    </button>
                  )}
                </div>
              )}

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
                    {previews.length > 1 && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: inkSoft, fontWeight: 600 }}>({previews.length} 枚統合)</span>}
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
                <FieldGroup field="brandName" label="ブランド名 *" weak={weakFields} labelStyle={label}>
                  <input style={inp} value={deal.brandName || ''} onChange={e => updateField('brandName', e.target.value)} placeholder="例: SHISEIDO" />
                </FieldGroup>
                <FieldGroup field="senderHandle" label="送り主 (@ハンドル)" weak={weakFields} labelStyle={label}>
                  <input style={inp} value={deal.senderHandle || ''} onChange={e => updateField('senderHandle', e.target.value)} placeholder="@brand_official" />
                </FieldGroup>
                <FieldGroup field="contactName" label="担当者名" weak={weakFields} labelStyle={label}>
                  <input style={inp} value={deal.contactName || ''} onChange={e => updateField('contactName', e.target.value)} placeholder="田中" />
                </FieldGroup>
                <FieldGroup field="category" label="カテゴリ" weak={weakFields} labelStyle={label}>
                  <input style={inp} value={deal.category || ''} onChange={e => updateField('category', e.target.value)} placeholder="コスメ / ファッション / グルメ" />
                </FieldGroup>
                <FieldGroup field="fee" label="報酬 (円)" weak={weakFields} labelStyle={label}>
                  <input style={inp} type="number" value={deal.fee ?? ''} onChange={e => updateField('fee', e.target.value === '' ? null : Number(e.target.value))} placeholder="50000" />
                </FieldGroup>
                <FieldGroup field="deadline" label="締切" weak={weakFields} labelStyle={label}>
                  <input style={inp} value={deal.deadline || ''} onChange={e => updateField('deadline', e.target.value)} placeholder="11/30 まで" />
                </FieldGroup>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={label}>
                    依頼内容 / 納品物
                    {weakFields.includes('requirements') && <WeakBadge accent={bg.accent} />}
                  </label>
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

          {/* ─── Step 5: エラー ─── */}
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

// 「自信が低い」フィールドにバッジ表示
function WeakBadge({ accent }: { accent: string }) {
  return (
    <span style={{
      display: 'inline-block', marginLeft: 6, padding: '2px 8px',
      borderRadius: 999, background: `${accent}22`, color: accent,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
      verticalAlign: 'middle',
    }}>要確認</span>
  );
}

function FieldGroup({
  field, label, weak, labelStyle, children,
}: {
  field: string;
  label: string;
  weak: string[];
  labelStyle: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
        {weak.includes(field) && <WeakBadge accent="#E1306C" />}
      </label>
      {children}
    </div>
  );
}

// 選択済みファイルのプレビュー (削除可)
function FilePreview({
  file, onRemove, isDark, ink, inkSoft, index,
}: {
  file: File; onRemove: () => void; isDark: boolean; ink: string; inkSoft: string; index: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  // 1 回だけ読み込み
  useMemo(() => {
    const r = new FileReader();
    r.onload = () => setUrl(r.result as string);
    r.readAsDataURL(file);
  }, [file]);

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      minHeight: 110,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url ? (
        <img src={url} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize: 11, color: inkSoft }}>読込中</span>
      )}
      <div style={{
        position: 'absolute', top: 4, left: 4,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        fontSize: 10, fontWeight: 800,
        padding: '2px 6px', borderRadius: 999,
      }}>{index + 1}</div>
      <button
        onClick={onRemove}
        aria-label="削除"
        style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.6)', border: 'none',
          color: '#fff',
          width: 24, height: 24, borderRadius: '50%',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
        <X size={12} />
      </button>
      {/* unused ink reference to satisfy lint when needed */}
      <span style={{ display: 'none' }}>{ink}</span>
    </div>
  );
}
