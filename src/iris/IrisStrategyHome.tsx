// ============================================================
// IRIS — Strategy Home (新・戦略タブ)
// 手入力ゼロ。スクショ貼って終わり。あとは美しく見るだけ。
// 設計: Apple Photos / Linear / Things 3 / Spotify Wrapped の交差点
// ============================================================
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from 'framer-motion';
import {
  Camera, Sparkles, TrendingUp, Bookmark, Share2, Eye, Heart,
  MessageCircle, Clock, Flame, Loader2,
  Image as ImageIcon, FileText, CheckCircle2, X, Upload, Wand2, BarChart3,
  Sliders, Plus, Trash2, RefreshCw, FilePlus2, Pencil, Check,
} from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { ContentType, MediaKit } from '../types/influencerDeal';
import { CONTENT_TYPE_META } from '../types/influencerDeal';
import { IRIS_FONTS } from './irisStyle';
import { BASE_ALL, DUR_BASE, EASE_OUT } from './motion';
import {
  usePostHistory, type PostHistoryItem,
} from './strategist';
import { confirmAction } from '../lib/confirmDialog';
import {
  extractPostsFromScreenshots, fileToBase64Pair, computeStats, dayLabel,
  generateStrategyInsights, parseInstagramCSV,
  type ExtractedPost, type StrategyInsights,
} from './screenshotExtractor';
import { usePostQueue } from './usePostQueue';
import type { IrisBackgroundDef } from './irisStyle';
import { computeApplyKpi, loadApplyHistory } from './brandDealMatch';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  mediaKit?: MediaKit;
  onOpenAdvanced: () => void;
}

type Sort = 'recent' | 'reach' | 'er' | 'saves';

export default function IrisStrategyHome({ bg, settings, mediaKit: _mediaKit, onOpenAdvanced }: Props) {
  const history = usePostHistory();
  const queue = usePostQueue();
  const [extracted, setExtracted] = useState<ExtractedPost[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractErr, setExtractErr] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('recent');
  const [insights, setInsights] = useState<StrategyInsights | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // アップロード中の画像 (プレビュー & リトライ用に Files を保持)
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // posted リールスタジオの投稿を自動的に戦略タブの履歴に同期
  useEffect(() => {
    const postedFromQueue = queue.posts.filter(p => p.status === 'posted');
    if (postedFromQueue.length === 0) return;
    const existingIds = new Set(history.posts.map(h => h.id));
    for (const q of postedFromQueue) {
      const synthId = `q_${q.id}`;
      if (existingIds.has(synthId)) continue;
      const platform = q.platform === 'instagram_feed' || q.platform === 'instagram_reel' || q.platform === 'instagram_story'
        ? 'instagram' : q.platform === 'tiktok' ? 'tiktok' : q.platform === 'x' ? 'x' : 'instagram';
      const contentType: ContentType =
        q.platform === 'instagram_reel' ? 'reel'
        : q.platform === 'instagram_story' ? 'story'
        : q.source === 'reel' ? 'reel'
        : 'post';
      history.add({
        postedAt: q.scheduledAt,
        platform,
        contentType,
        title: (q.caption || q.brandName || 'リールスタジオ投稿').slice(0, 40),
        caption: q.caption,
        tags: q.hashtags,
        brand: q.brandName,
        notes: 'リールスタジオから自動同期',
        metrics: {},
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.posts.length]);

  const stats = useMemo(() => computeStats(history.posts), [history.posts]);

  const sorted = useMemo(() => {
    const arr = [...history.posts];
    if (sort === 'recent') return arr.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
    if (sort === 'reach') return arr.sort((a, b) => (b.metrics.reach || 0) - (a.metrics.reach || 0));
    if (sort === 'er') return arr.sort((a, b) => (b.metrics.engagementRate || 0) - (a.metrics.engagementRate || 0));
    if (sort === 'saves') return arr.sort((a, b) => (b.metrics.saves || 0) - (a.metrics.saves || 0));
    return arr;
  }, [history.posts, sort]);

  const fileToDataUrl = (f: File) => new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(f);
  });

  // 画像ファイル群を解析 (リトライからも呼べる)
  const runExtraction = async (files: File[]) => {
    if (files.length === 0) return;
    setExtracting(true);
    setExtractErr(null);
    setExtracted([]);
    try {
      const images = await Promise.all(files.map(fileToBase64Pair));
      const result = await extractPostsFromScreenshots({ settings, images });
      if (result.length === 0) {
        setExtractErr('投稿を検出できませんでした。インサイト画面のスクショ (リーチ・反応率・保存数が見える画面) を試してみてください。');
        return;
      }
      setExtracted(result);
    } catch (e: any) {
      setExtractErr(e?.message || 'スクショ解析に失敗しました');
    } finally {
      setExtracting(false);
    }
  };

  const handleDropImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 6);
    if (fileArr.length === 0) {
      setExtractErr('画像ファイルが見つかりませんでした');
      return;
    }
    // プレビューを即座に表示 (Vision 待ちで真っ白にならないように)
    const urls = await Promise.all(fileArr.map(fileToDataUrl));
    setPreviewFiles(fileArr);
    setPreviewUrls(urls);
    await runExtraction(fileArr);
  };

  const retryExtraction = () => {
    if (previewFiles.length === 0) {
      setExtractErr('再試行する画像がありません。もう一度ドロップしてください。');
      return;
    }
    runExtraction(previewFiles);
  };

  const clearUploads = () => {
    setPreviewFiles([]);
    setPreviewUrls([]);
    setExtracted([]);
    setExtractErr(null);
  };

  const handleDropCSV = async (file: File) => {
    setExtracting(true); setExtractErr(null);
    try {
      const text = await file.text();
      const result = parseInstagramCSV(text);
      if (result.length === 0) {
        setExtractErr('CSV から投稿を検出できませんでした');
        return;
      }
      setExtracted(result);
    } catch (e: any) {
      setExtractErr(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const acceptExtracted = (item: ExtractedPost) => {
    history.add({
      postedAt: item.postedAt || new Date().toISOString(),
      platform: item.platform,
      contentType: item.contentType,
      title: item.title,
      caption: item.caption,
      tags: item.tags,
      topic: item.topic,
      notes: item.notes,
      metrics: item.metrics,
    });
    setExtracted(prev => prev.filter(p => p !== item));
  };

  const acceptAllExtracted = () => {
    for (const item of extracted) acceptExtracted(item);
    setExtracted([]);
  };

  const runInsights = async () => {
    if (history.posts.length === 0) {
      setInsightErr('まず投稿を追加してください');
      return;
    }
    setInsightBusy(true); setInsightErr(null);
    try {
      const r = await generateStrategyInsights({
        settings,
        stats,
        recentTitles: history.posts.slice(0, 10).map(p => p.title),
      });
      setInsights(r);
    } catch (e: any) {
      setInsightErr(e.message);
    } finally {
      setInsightBusy(false);
    }
  };

  const detail = detailId ? history.posts.find(p => p.id === detailId) : null;

  // ─── スタイル定数 ──
  const accentGradient = `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`;
  const glassCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(18px) saturate(140%)',
    WebkitBackdropFilter: 'blur(18px) saturate(140%)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 24,
    padding: '1.5rem',
  };

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* ─── ヒーロー: 大きな数字 ─── */}
      <HeroBanner bg={bg} stats={stats} />

      {/* ─── ブランド応募 KPI ─── */}
      <BrandApplyKpiBlock bg={bg} />

      {/* ─── キャプチャゾーン (手入力ゼロの中核) ─── */}
      <CaptureZone
        bg={bg}
        glassCard={glassCard}
        accentGradient={accentGradient}
        extracting={extracting}
        extractErr={extractErr}
        previewUrls={previewUrls}
        onImages={handleDropImages}
        onCSV={handleDropCSV}
        onRetry={retryExtraction}
        onClear={clearUploads}
        onManualInput={onOpenAdvanced}
      />

      {/* ─── 抽出プレビュー (確認 → 保存) ─── */}
      <AnimatePresence>
        {extracted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <ExtractedReview
              bg={bg}
              extracted={extracted}
              previewUrls={previewUrls}
              onAccept={acceptExtracted}
              onAcceptAll={acceptAllExtracted}
              onReject={(item) => setExtracted(prev => prev.filter(p => p !== item))}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── AI 戦略インサイト ─── */}
      <InsightsHero
        bg={bg}
        glassCard={glassCard}
        accentGradient={accentGradient}
        insights={insights}
        busy={insightBusy}
        error={insightErr}
        canRun={history.posts.length >= 3}
        onRun={runInsights}
      />

      {/* ─── ダッシュボード (ヒートマップ + フォーマット + Top3) ─── */}
      {history.posts.length > 0 && (
        <Dashboard bg={bg} glassCard={glassCard} stats={stats} />
      )}

      {/* ─── 投稿ギャラリー (Instagram 風) ─── */}
      <Gallery
        bg={bg}
        glassCard={glassCard}
        posts={sorted}
        sort={sort}
        setSort={setSort}
        onTap={setDetailId}
      />

      {/* ─── 上級者モード ─── */}
      <button
        onClick={onOpenAdvanced}
        style={{
          background: 'transparent',
          color: bg.inkSoft,
          border: `1px dashed ${bg.cardBorder}`,
          borderRadius: 14,
          padding: '0.8rem 1.4rem',
          fontSize: '0.85rem',
          fontFamily: IRIS_FONTS.body,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <Sliders size={14} />
        手で入力する / 詳細分析モード
      </button>

      {/* ─── 投稿詳細モーダル ─── */}
      <AnimatePresence>
        {detail && (
          <DetailModal
            bg={bg}
            post={detail}
            onClose={() => setDetailId(null)}
            onDelete={() => { history.remove(detail.id); setDetailId(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// ヒーロー — 大きな数字 (Apple Photos の年次振り返り風)
// ============================================================
function HeroBanner({ bg, stats }: { bg: IrisBackgroundDef; stats: ReturnType<typeof computeStats> }) {
  const er = stats.avgER;
  const reach = stats.avgReach;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 28,
      overflow: 'hidden',
      background: `linear-gradient(135deg, ${bg.accent}22, ${bg.accent}08 60%, transparent)`,
      border: `1px solid ${bg.cardBorder}`,
      padding: 'clamp(1.4rem, 4vw, 2.4rem)',
    }}>
      <div style={{
        position: 'absolute',
        top: -80,
        right: -80,
        width: 280,
        height: 280,
        background: `radial-gradient(circle, ${bg.accent}33, transparent 70%)`,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }} />
      <p style={{
        fontFamily: IRIS_FONTS.serif,
        fontStyle: 'italic',
        fontSize: '0.72rem',
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: bg.accent,
        marginBottom: '0.4rem',
      }}>
        The Strategist
      </p>
      <h2 style={{
        fontFamily: IRIS_FONTS.serif,
        fontStyle: 'italic',
        fontSize: 'clamp(1.9rem, 5.5vw, 2.8rem)',
        color: bg.ink,
        margin: 0,
        fontWeight: 500,
        letterSpacing: '-0.015em',
        lineHeight: 1.1,
      }}>
        あなたの伸びパターン
      </h2>
      <p style={{
        color: bg.inkSoft,
        fontSize: '0.92rem',
        marginTop: '0.6rem',
        marginBottom: '1.4rem',
        lineHeight: 1.6,
      }}>
        Instagram のインサイトをスクショで貼るだけ。AI が読み取って数字を可視化します。
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(0.6rem, 2vw, 1.2rem)',
        marginTop: '1rem',
      }}>
        <MetricBig bg={bg} value={stats.total.toString()} numeric={stats.total} label="投稿" />
        <MetricBig bg={bg} value={er > 0 ? `${er.toFixed(1)}%` : '—'} numeric={er} suffix="%" label="平均 反応率" />
        <MetricBig bg={bg} value={reach > 0 ? formatNumber(Math.round(reach)) : '—'} numeric={reach} label="平均 届いた数" />
        <MetricBig bg={bg} value={stats.avgSaves > 0 ? formatNumber(Math.round(stats.avgSaves)) : '—'} numeric={stats.avgSaves} label="平均保存" />
      </div>
    </div>
  );
}

function MetricBig({ bg, value, label, numeric, suffix }: {
  bg: IrisBackgroundDef;
  value: string;
  label: string;
  numeric?: number;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div style={{
        fontFamily: IRIS_FONTS.serif,
        fontStyle: 'italic',
        fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
        color: bg.ink,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {typeof numeric === 'number' && numeric > 0
          ? <CountUp value={numeric} suffix={suffix} />
          : value}
      </div>
      <div style={{
        fontSize: '0.7rem',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: bg.inkSoft,
        marginTop: '0.4rem',
        fontWeight: 600,
      }}>
        {label}
      </div>
    </motion.div>
  );
}

function CountUp({ value, suffix }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);

  useEffect(() => {
    motionValue.set(0);
    const controls = fmAnimate(motionValue, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = formatCounting(latest, value, suffix);
      },
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, suffix]);

  return <span ref={ref}>{formatCounting(value, value, suffix)}</span>;
}

function formatCounting(latest: number, target: number, suffix?: string): string {
  // Percent (ER): 1 decimal place
  if (suffix === '%') return `${latest.toFixed(1)}%`;
  // Large numbers: K/M abbreviation
  if (target >= 1_000_000) return `${(latest / 1_000_000).toFixed(1)}M`;
  if (target >= 10_000) return `${(latest / 1_000).toFixed(1)}K`;
  // Otherwise round to int
  return `${Math.round(latest).toLocaleString()}${suffix || ''}`;
}

// ============================================================
// キャプチャゾーン — スクショ / CSV ドロップ
// ============================================================
function CaptureZone({
  bg, glassCard, accentGradient, extracting, extractErr, previewUrls,
  onImages, onCSV, onRetry, onClear, onManualInput,
}: {
  bg: IrisBackgroundDef;
  glassCard: React.CSSProperties;
  accentGradient: string;
  extracting: boolean;
  extractErr: string | null;
  previewUrls: string[];
  onImages: (files: FileList | null) => void;
  onCSV: (file: File) => void;
  onRetry: () => void;
  onClear: () => void;
  onManualInput: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (extracting) return;
    inputRef.current?.click();
  };

  return (
    <div
      style={{
        ...glassCard,
        borderColor: drag ? bg.accent : bg.cardBorder,
        background: drag
          ? `linear-gradient(135deg, ${bg.accent}18, ${bg.accent}06)`
          : 'rgba(255,255,255,0.72)',
        transition: BASE_ALL,
        position: 'relative',
      }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        const csv = Array.from(files).find(f => f.name.endsWith('.csv'));
        if (csv) onCSV(csv);
        else onImages(files);
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: accentGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
          boxShadow: `0 6px 16px ${bg.accent}55`,
        }}>
          <Wand2 size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
            fontSize: '1.15rem', color: bg.ink, fontWeight: 600, lineHeight: 1.3,
          }}>
            スクショを貼るだけ
          </p>
          <p style={{ fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.5 }}>
            Instagram インサイトをドロップ。AI が数字を読み取って投稿カードを自動生成します。
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={openPicker}
        disabled={extracting}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          flexDirection: 'column',
          padding: '1.6rem 1rem',
          border: `2px dashed ${drag ? bg.accent : bg.cardBorder}`,
          borderRadius: 18,
          cursor: extracting ? 'wait' : 'pointer',
          background: 'rgba(255,255,255,0.4)',
          transition: BASE_ALL,
          textAlign: 'center',
          fontFamily: IRIS_FONTS.body,
          color: 'inherit',
        }}
      >
        {extracting ? (
          <>
            <Loader2 size={28} style={{ color: bg.accent, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.95rem' }}>
              AI が画像を読み取っています...
            </p>
            <p style={{ fontSize: '0.75rem', color: bg.inkSoft }}>5〜20 秒</p>
          </>
        ) : (
          <>
            <Camera size={28} style={{ color: bg.accent }} />
            <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.98rem' }}>
              インサイト画面のスクショをドロップ
            </p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.6 }}>
              タップして選択も可 · 1 度に最大 6 枚 · CSV エクスポートも対応
            </p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.csv"
        multiple
        disabled={extracting}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          const csv = Array.from(files).find(f => f.name.endsWith('.csv'));
          if (csv) onCSV(csv);
          else onImages(files);
          e.target.value = '';
        }}
      />

      {/* アップロード画像のプレビュー (即時) + クリップボードからの貼り付け */}
      <Previews previewUrls={previewUrls} bg={bg} onPaste={onImages} onClear={onClear} />

      {/* 失敗時の復旧パネル (もう一度 / 別の画像 / 手で入力) */}
      {extractErr && !extracting && (
        <ErrorRecovery
          bg={bg}
          message={extractErr}
          canRetry={previewUrls.length > 0}
          onRetry={onRetry}
          onPickAgain={openPicker}
          onManualInput={onManualInput}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// 失敗時の復旧 UI: 「もう一度」「別の画像で」「手で入力」
function ErrorRecovery({
  bg, message, canRetry, onRetry, onPickAgain, onManualInput,
}: {
  bg: IrisBackgroundDef;
  message: string;
  canRetry: boolean;
  onRetry: () => void | Promise<void>;
  onPickAgain: () => void;
  onManualInput: () => void;
}) {
  type Phase = 'idle' | 'pending' | 'success';
  const [retryPhase, setRetryPhase] = useState<Phase>('idle');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const handleRetry = async () => {
    if (retryPhase !== 'idle') return;
    setRetryPhase('pending');
    try { await Promise.resolve(onRetry()); } catch { /* 失敗は親が新しい message を渡してくる */ }
    if (!mounted.current) return;
    setRetryPhase('success');
    setTimeout(() => { if (mounted.current) setRetryPhase('idle'); }, 1000);
  };

  const btn = (icon: React.ReactNode, label: string, onClick: () => void, primary?: boolean) => (
    <button
      onClick={onClick}
      style={{
        background: primary ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.9)',
        color: primary ? '#fff' : bg.ink,
        border: primary ? 'none' : `1px solid ${bg.cardBorder}`,
        borderRadius: 999,
        padding: '0.5rem 1rem',
        fontWeight: 700,
        fontSize: '0.82rem',
        fontFamily: IRIS_FONTS.body,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        boxShadow: primary ? `0 6px 16px ${bg.accent}55` : 'none',
      }}
    >
      {icon} {label}
    </button>
  );

  const retryBtn = canRetry && (
    <button
      onClick={handleRetry}
      disabled={retryPhase === 'pending'}
      aria-live="polite"
      className={retryPhase === 'success' ? 'cp-phase-success' : undefined}
      style={{
        background: retryPhase === 'success'
          ? 'linear-gradient(135deg, #34D399, #34D399cc)'
          : `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        padding: '0.5rem 1rem',
        fontWeight: 700,
        fontSize: '0.82rem',
        fontFamily: IRIS_FONTS.body,
        cursor: retryPhase === 'pending' ? 'progress' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        boxShadow: retryPhase === 'success'
          ? '0 6px 16px rgba(52, 211, 153, 0.55)'
          : `0 6px 16px ${bg.accent}55`,
        opacity: retryPhase === 'pending' ? 0.88 : 1,
        transition: `background ${DUR_BASE}s ${EASE_OUT}, box-shadow ${DUR_BASE}s ${EASE_OUT}, opacity ${DUR_BASE}s ${EASE_OUT}`,
        minWidth: 144, justifyContent: 'center',
      }}
    >
      {retryPhase === 'pending' ? (
        <><RefreshCw size={14} className="cp-phase-spin" /> 再試行中…</>
      ) : retryPhase === 'success' ? (
        <><Check size={15} strokeWidth={2.8} /> 届きました</>
      ) : (
        <><RefreshCw size={14} /> もう一度ためす</>
      )}
    </button>
  );

  return (
    <div style={{
      marginTop: '0.9rem',
      padding: '0.9rem 1rem',
      background: 'rgba(200,16,46,0.06)',
      border: '1px solid rgba(200,16,46,0.18)',
      borderRadius: 14,
      display: 'grid', gap: '0.6rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <X size={16} style={{ color: '#C8102E', marginTop: 2, flexShrink: 0 }} />
        <p style={{ color: '#9B1024', fontSize: '0.85rem', lineHeight: 1.6 }}>
          {message}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {retryBtn}
        {btn(<FilePlus2 size={14} />, '別の画像でやり直す', onPickAgain)}
        {btn(<Pencil size={14} />, '手で入力する', onManualInput)}
      </div>
    </div>
  );
}

// ============================================================
// アップロード画像のプレビュー + ペースト対応
// 親で管理する previewUrls を受け取り、Cmd+V ペーストもサポート
// ============================================================
function Previews({
  previewUrls, bg, onPaste, onClear,
}: {
  previewUrls: string[];
  bg: IrisBackgroundDef;
  onPaste: (files: FileList | null) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length === 0) return;
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      onPaste(dt.files);
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [onPaste]);

  if (previewUrls.length === 0) return null;

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
      }}>
        <p style={{
          fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          アップロード画像 ({previewUrls.length})
        </p>
        <button
          onClick={onClear}
          style={{
            background: 'transparent',
            color: bg.inkSoft,
            border: 'none',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: IRIS_FONTS.body,
          }}
        >
          <X size={12} /> クリア
        </button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: 6,
      }}>
        {previewUrls.map((u, i) => (
          <div key={i} style={{
            width: '100%', aspectRatio: '1 / 1', borderRadius: 10,
            background: `center / cover no-repeat url(${u})`,
            border: `1px solid ${bg.cardBorder}`,
            boxShadow: '0 4px 10px rgba(0,0,0,0.06)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 抽出結果レビュー — プレビュー画像と数字を横並びで表示
// ============================================================
function ExtractedReview({
  bg, extracted, previewUrls, onAccept, onAcceptAll, onReject,
}: {
  bg: IrisBackgroundDef;
  extracted: ExtractedPost[];
  previewUrls: string[];
  onAccept: (item: ExtractedPost) => void;
  onAcceptAll: () => void;
  onReject: (item: ExtractedPost) => void;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${bg.accent}11, ${bg.accent}05)`,
      border: `1.5px solid ${bg.accent}55`,
      borderRadius: 24,
      padding: '1.4rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} style={{ color: bg.accent }} />
          <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', color: bg.ink, fontWeight: 600 }}>
            {extracted.length} 件 検出しました
          </p>
        </div>
        <button
          onClick={onAcceptAll}
          style={{
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '0.5rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: `0 6px 16px ${bg.accent}66`,
          }}
        >
          <CheckCircle2 size={14} /> すべて保存
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.7rem' }}>
        {extracted.map((p, i) => {
          // 1 つの画像から複数投稿が取れるケースがあるので、画像数より検出数が多ければ
          // 画像をローテーションして紐付け (画像 i % previewUrls.length 番目を使う)。
          // 画像が無いケースは null (画像表示なし)。
          const thumb = previewUrls.length > 0 ? previewUrls[i % previewUrls.length] : null;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                background: 'rgba(255,255,255,0.92)',
                border: `1px solid ${bg.cardBorder}`,
                borderRadius: 18,
                padding: '0.9rem 1rem',
                display: 'grid',
                gridTemplateColumns: thumb ? '96px 1fr auto' : '1fr auto',
                gap: '0.8rem',
                alignItems: 'center',
              }}
            >
              {thumb && (
                <div
                  aria-label={`元画像 ${(i % previewUrls.length) + 1}`}
                  style={{
                    width: 96, height: 120, borderRadius: 12,
                    background: `center / cover no-repeat url(${thumb})`,
                    border: `1px solid ${bg.cardBorder}`,
                    boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontWeight: 700, color: bg.ink, fontSize: '0.95rem',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontFamily: IRIS_FONTS.body,
                }}>
                  {p.title}
                </p>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 3 }}>
                  {CONTENT_TYPE_META[p.contentType]} · {p.postedAt ? new Date(p.postedAt).toLocaleDateString('ja-JP') : '日時不明'} · 信頼度 {p.confidence === 'high' ? '高' : p.confidence === 'medium' ? '中' : '低'}
                </p>
                {/* 数字を大きめに、見やすく */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(78px, 1fr))',
                  gap: '0.45rem',
                  marginTop: '0.55rem',
                }}>
                  {p.metrics.reach !== undefined && (
                    <MiniStat bg={bg} icon={<Eye size={11} />} label="届いた数" value={formatNumber(p.metrics.reach)} />
                  )}
                  {p.metrics.engagementRate !== undefined && (
                    <MiniStat bg={bg} icon={<Flame size={11} />} label="反応率" value={`${p.metrics.engagementRate.toFixed(1)}%`} accent />
                  )}
                  {p.metrics.likes !== undefined && (
                    <MiniStat bg={bg} icon={<Heart size={11} />} label="いいね" value={formatNumber(p.metrics.likes)} />
                  )}
                  {p.metrics.saves !== undefined && (
                    <MiniStat bg={bg} icon={<Bookmark size={11} />} label="保存" value={formatNumber(p.metrics.saves)} />
                  )}
                  {p.metrics.comments !== undefined && (
                    <MiniStat bg={bg} icon={<MessageCircle size={11} />} label="コメント" value={formatNumber(p.metrics.comments)} />
                  )}
                  {p.metrics.shares !== undefined && (
                    <MiniStat bg={bg} icon={<Share2 size={11} />} label="シェア" value={formatNumber(p.metrics.shares)} />
                  )}
                </div>
                {p.notes && (
                  <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: '0.4rem', fontStyle: 'italic' }}>
                    <FileText size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {p.notes}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <button
                  onClick={() => onAccept(p)}
                  style={{
                    background: bg.accent + '22',
                    color: bg.accent,
                    border: `1px solid ${bg.accent}55`,
                    borderRadius: 999,
                    padding: '0.4rem 0.9rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontFamily: IRIS_FONTS.body,
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={12} /> 保存
                </button>
                <button
                  onClick={() => onReject(p)}
                  style={{
                    background: 'transparent',
                    color: bg.inkSoft,
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 999,
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    fontFamily: IRIS_FONTS.body,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  }}
                >
                  <X size={11} /> 捨てる
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// 小さなメトリクスタイル — 画像横に並べる用
function MiniStat({ bg, icon, label, value, accent }: {
  bg: IrisBackgroundDef;
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{
      background: accent ? `linear-gradient(135deg, ${bg.accent}18, ${bg.accent}06)` : 'rgba(0,0,0,0.03)',
      border: `1px solid ${accent ? bg.accent + '44' : bg.cardBorder}`,
      borderRadius: 10,
      padding: '0.35rem 0.5rem',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3,
        color: accent ? bg.accent : bg.inkSoft,
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
      }}>
        {icon}<span>{label}</span>
      </div>
      <p style={{
        fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
        fontSize: '1rem', fontWeight: 700,
        color: accent ? bg.accent : bg.ink,
        lineHeight: 1.1, marginTop: 1,
      }}>
        {value}
      </p>
    </div>
  );
}

// ============================================================
// AI 戦略インサイト
// ============================================================
function InsightsHero({
  bg, glassCard, accentGradient, insights, busy, error, canRun, onRun,
}: {
  bg: IrisBackgroundDef;
  glassCard: React.CSSProperties;
  accentGradient: string;
  insights: StrategyInsights | null;
  busy: boolean;
  error: string | null;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: accentGradient,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 6px 16px ${bg.accent}55`,
        }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{
            fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
            fontSize: '1.15rem', color: bg.ink, fontWeight: 600, lineHeight: 1.3,
          }}>
            AI 戦略インサイト
          </p>
          <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>
            データを 1 タップで読み解く
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={busy || !canRun}
          style={{
            background: canRun ? accentGradient : 'rgba(0,0,0,0.06)',
            color: canRun ? '#fff' : bg.inkSoft,
            border: 'none',
            borderRadius: 999,
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            fontSize: '0.82rem',
            fontFamily: IRIS_FONTS.body,
            cursor: canRun && !busy ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: canRun ? `0 6px 16px ${bg.accent}55` : 'none',
          }}
        >
          {busy ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 分析中</> : <><Wand2 size={14} /> AI で読み解く</>}
        </button>
      </div>

      {!canRun && (
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.7 }}>
          投稿が <strong>3 件以上</strong> 集まると、AI が「次に伸びそうな投稿」「リーチを倍にする方法」を提案します。
        </p>
      )}

      {error && (
        <div style={{ marginTop: '0.6rem', color: '#C8102E', fontSize: '0.82rem' }}>{error}</div>
      )}

      {insights && (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '0.6rem' }}>
          {insights.oneLiner && (
            <p style={{
              fontFamily: IRIS_FONTS.serif,
              fontStyle: 'italic',
              fontSize: '1.3rem',
              color: bg.ink,
              fontWeight: 600,
              lineHeight: 1.5,
              paddingBottom: '0.5rem',
              borderBottom: `1px solid ${bg.cardBorder}`,
            }}>
              "{insights.oneLiner}"
            </p>
          )}

          {insights.doubleReachAdvice?.mainAction && (
            <div style={{
              background: `linear-gradient(135deg, ${bg.accent}11, transparent)`,
              borderLeft: `3px solid ${bg.accent}`,
              borderRadius: '0 16px 16px 0',
              padding: '0.9rem 1.1rem',
            }}>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, marginBottom: '0.3rem' }}>
                リーチを倍にするには
              </p>
              <p style={{ fontSize: '1.05rem', fontWeight: 700, color: bg.ink, marginBottom: '0.4rem', lineHeight: 1.4 }}>
                {insights.doubleReachAdvice.mainAction}
              </p>
              <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.7 }}>
                {insights.doubleReachAdvice.rationale}
              </p>
              {insights.doubleReachAdvice.subActions?.length > 0 && (
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', color: bg.inkSoft, fontSize: '0.82rem', lineHeight: 1.8 }}>
                  {insights.doubleReachAdvice.subActions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
            </div>
          )}

          {insights.nextWinningPatterns?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, marginBottom: '0.6rem' }}>
                次に伸びそうな 3 パターン
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                {insights.nextWinningPatterns.map((p, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ y: -3, boxShadow: `0 12px 28px ${bg.accent}33` }}
                    style={{
                      background: 'rgba(255,255,255,0.85)',
                      border: `1px solid ${bg.cardBorder}`,
                      borderRadius: 16,
                      padding: '0.9rem 1rem',
                      transition: BASE_ALL,
                    }}
                  >
                    <p style={{ fontSize: '0.68rem', color: bg.accent, fontWeight: 700, letterSpacing: '0.18em' }}>
                      No.{String(i + 1).padStart(2, '0')}
                    </p>
                    <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.95rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
                      {p.headline}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.4rem', lineHeight: 1.6 }}>
                      {p.reason}
                    </p>
                    {p.example && (
                      <p style={{ fontSize: '0.78rem', color: bg.accent, marginTop: '0.5rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                        例: {p.example}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {insights.bestPostingTimes?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, marginBottom: '0.6rem' }}>
                おすすめの時間帯
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {insights.bestPostingTimes.map((t, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.85)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 12,
                    padding: '0.5rem 0.9rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <Clock size={14} style={{ color: bg.accent }} />
                    <div>
                      <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.85rem' }}>
                        {t.day} {t.time}
                      </p>
                      <p style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{t.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.bestFormatSummary && (
            <p style={{
              background: 'rgba(255,255,255,0.5)',
              padding: '0.7rem 1rem',
              borderRadius: 14,
              fontSize: '0.88rem',
              color: bg.ink,
              lineHeight: 1.7,
              borderLeft: `3px solid ${bg.accent}66`,
            }}>
              <strong style={{ color: bg.accent }}>ベストフォーマット:</strong> {insights.bestFormatSummary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ダッシュボード (ヒートマップ + Top3 + フォーマット)
// ============================================================
function Dashboard({
  bg, glassCard, stats,
}: {
  bg: IrisBackgroundDef;
  glassCard: React.CSSProperties;
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* 山型グラフ (直近30日) */}
      {stats.timeline.length >= 2 && (
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
            <TrendingUp size={16} style={{ color: bg.accent }} />
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 600, color: bg.ink, margin: 0 }}>
              直近 30 日の伸び
            </p>
            <span style={{ fontSize: '0.72rem', color: bg.inkSoft, marginLeft: 'auto' }}>
              {stats.timeline.length} 日分
            </span>
          </div>
          <TrendChart timeline={stats.timeline} bg={bg} />
        </div>
      )}
      {/* ヒートマップ */}
      {stats.heatmapMax > 0 && (
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <BarChart3 size={16} style={{ color: bg.accent }} />
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 600, color: bg.ink }}>
              曜日 × 時間帯 × 反応率
            </p>
          </div>
          <Heatmap stats={stats} bg={bg} />
          {stats.bestSlots.length > 0 && (
            <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: bg.inkSoft, lineHeight: 2 }}>ベスト: </span>
              {stats.bestSlots.map((s, i) => (
                <span key={i} style={{
                  background: bg.accent + '15',
                  color: bg.accent,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 999,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  {dayLabel(s.day)} {s.hour}時 · 反応率 {s.er.toFixed(1)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top3 グリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.8rem' }}>
        <TopList bg={bg} glassCard={glassCard} title="保存数 TOP3" icon={<Bookmark size={14} />} items={stats.topBySaves.map(p => ({ title: p.title, value: formatNumber(p.saves) }))} />
        <TopList bg={bg} glassCard={glassCard} title="シェア TOP3" icon={<Share2 size={14} />} items={stats.topByShares.map(p => ({ title: p.title, value: formatNumber(p.shares) }))} />
        <TopList bg={bg} glassCard={glassCard} title="反応がよかった投稿 TOP3" icon={<Flame size={14} />} items={stats.topByER.map(p => ({ title: p.title, value: `${p.er.toFixed(1)}%` }))} />
      </div>

      {/* フォーマット別 */}
      {stats.byFormat.length > 0 && (
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
            <TrendingUp size={16} style={{ color: bg.accent }} />
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 600, color: bg.ink }}>
              フォーマット別パフォーマンス
            </p>
          </div>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {stats.byFormat.map((f, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                padding: '0.6rem 0.8rem',
                background: 'rgba(255,255,255,0.5)',
                borderRadius: 12,
              }}>
                <div style={{ minWidth: 80, fontWeight: 700, color: bg.ink, fontSize: '0.88rem' }}>
                  {CONTENT_TYPE_META[f.format] || f.format}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ background: 'rgba(0,0,0,0.06)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (f.avgER / Math.max(...stats.byFormat.map(x => x.avgER || 0.01))) * 100)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.08 }}
                      style={{
                        height: '100%',
                        background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}aa)`,
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.78rem', color: bg.inkSoft, minWidth: 130, textAlign: 'right', justifyContent: 'flex-end' }}>
                  <span style={{ color: bg.accent, fontWeight: 700 }}>{f.avgER.toFixed(1)}%</span>
                  <span>{f.count} 本</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Heatmap({ stats, bg }: { stats: ReturnType<typeof computeStats>; bg: IrisBackgroundDef }) {
  const HOURS = [6, 9, 12, 15, 18, 21]; // 凝縮表示
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto repeat(' + HOURS.length + ', minmax(36px, 1fr))', gap: 4, minWidth: '100%' }}>
        <div />
        {HOURS.map(h => (
          <div key={h} style={{
            fontSize: '0.68rem', color: bg.inkSoft, textAlign: 'center', fontWeight: 600,
          }}>
            {h}時
          </div>
        ))}
        {[1, 2, 3, 4, 5, 6, 0].map(d => (
          <Fragment key={`row-${d}`}>
            <div style={{
              fontSize: '0.7rem', color: bg.inkSoft, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: '0.5rem',
            }}>
              {dayLabel(d)}
            </div>
            {HOURS.map(h => {
              // 凝縮: h時±1時間の平均
              let sum = 0; let n = 0;
              for (let off = -1; off <= 1; off++) {
                const hh = (h + off + 24) % 24;
                if (stats.heatmap[d][hh] > 0) { sum += stats.heatmap[d][hh]; n += 1; }
              }
              const v = n ? sum / n : 0;
              const intensity = stats.heatmapMax > 0 ? v / stats.heatmapMax : 0;
              return (
                <motion.div
                  key={`${d}-${h}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: (d * 6 + h * 0.1) * 0.01 }}
                  title={v > 0 ? `${dayLabel(d)} ${h}時: 反応率 ${v.toFixed(2)}%` : '投稿なし'}
                  style={{
                    aspectRatio: '1.4 / 1',
                    minHeight: 28,
                    background: intensity > 0
                      ? `linear-gradient(135deg, ${bg.accent}${alphaHex(0.15 + intensity * 0.85)}, ${bg.accent}${alphaHex(0.05 + intensity * 0.65)})`
                      : 'rgba(0,0,0,0.04)',
                    borderRadius: 6,
                    border: `1px solid ${bg.cardBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 700,
                    color: intensity > 0.5 ? '#fff' : bg.inkSoft,
                  }}
                >
                  {v > 0 ? v.toFixed(1) : ''}
                </motion.div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function alphaHex(a: number): string {
  const clamped = Math.max(0, Math.min(1, a));
  return Math.round(clamped * 255).toString(16).padStart(2, '0');
}

// ============================================================
// 山型グラフ — 直近 30 日の reach + ER 推移
// (Stripe Revenue Dashboard 風の area + dot)
// ============================================================
function TrendChart({
  timeline, bg,
}: {
  timeline: { date: string; reach: number; er: number; count: number }[];
  bg: IrisBackgroundDef;
}) {
  // 30 日ぶんの bins を作る (歯抜けの日も含めて連続表示)
  const series = useMemo(() => fillTimeline(timeline, 30), [timeline]);
  const maxReach = Math.max(1, ...series.map(d => d.reach));
  const maxER = Math.max(0.5, ...series.map(d => d.er));

  const W = 600;
  const H = 160;
  const padL = 14;
  const padR = 14;
  const padT = 14;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const x = (i: number) => padL + (innerW * i) / Math.max(1, series.length - 1);
  const yReach = (v: number) => padT + innerH - (innerH * v) / maxReach;
  const yER = (v: number) => padT + innerH - (innerH * v) / maxER;

  // area path (reach)
  const areaPath = series.length === 0 ? '' :
    `M ${x(0)},${padT + innerH} ` +
    series.map((d, i) => `L ${x(i)},${yReach(d.reach)}`).join(' ') +
    ` L ${x(series.length - 1)},${padT + innerH} Z`;

  // line path (ER, scaled to its own y axis)
  const linePath = series.length === 0 ? '' :
    series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)},${yER(d.er)}`).join(' ');

  // Peak day (highest reach)
  const peakIdx = series.reduce((best, d, i) =>
    d.reach > series[best].reach ? i : best, 0);
  const peak = series[peakIdx];

  const gradId = `irisGrad-${bg.accent.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 'clamp(140px, 32vw, 180px)', display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={bg.accent} stopOpacity="0.55" />
            <stop offset="55%" stopColor={bg.accent} stopOpacity="0.18" />
            <stop offset="100%" stopColor={bg.accent} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline (薄いグリッド) */}
        {[0.25, 0.5, 0.75].map(t => (
          <line
            key={t}
            x1={padL} x2={W - padR}
            y1={padT + innerH * t} y2={padT + innerH * t}
            stroke={bg.cardBorder} strokeWidth="1" strokeDasharray="2 4"
          />
        ))}

        {/* area (reach) */}
        {areaPath && (
          <motion.path
            d={areaPath}
            fill={`url(#${gradId})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}

        {/* line (ER) */}
        {linePath && (
          <motion.path
            d={linePath}
            fill="none"
            stroke={bg.accent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        )}

        {/* dots for post days */}
        {series.map((d, i) => d.count > 0 ? (
          <motion.circle
            key={i}
            cx={x(i)} cy={yER(d.er)} r={3}
            fill="#fff"
            stroke={bg.accent}
            strokeWidth="1.8"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.015, duration: 0.3 }}
          />
        ) : null)}

        {/* peak marker */}
        {peak && peak.reach > 0 && (
          <motion.g
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            <circle cx={x(peakIdx)} cy={yReach(peak.reach)} r={5} fill={bg.accent} />
            <circle cx={x(peakIdx)} cy={yReach(peak.reach)} r={5} fill="none" stroke={bg.accent} strokeOpacity={0.4} strokeWidth={6} />
          </motion.g>
        )}
      </svg>

      {/* axis labels (端 2 つ + peak) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.66rem',
        color: bg.inkSoft,
        marginTop: 2,
        paddingInline: 8,
      }}>
        <span>{formatShortDate(series[0]?.date)}</span>
        {peak && peak.reach > 0 && (
          <span style={{ color: bg.accent, fontWeight: 700 }}>
            ピーク {formatShortDate(peak.date)} · リーチ {formatNumber(peak.reach)}
          </span>
        )}
        <span>{formatShortDate(series[series.length - 1]?.date)}</span>
      </div>

      {/* 凡例 */}
      <div style={{
        display: 'flex', gap: '0.9rem', marginTop: '0.5rem',
        fontSize: '0.7rem', color: bg.inkSoft,
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            display: 'inline-block', width: 10, height: 10, borderRadius: 2,
            background: `linear-gradient(180deg, ${bg.accent}aa, ${bg.accent}22)`,
          }} />
          リーチ
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <span style={{
            display: 'inline-block', width: 16, height: 2, borderRadius: 2,
            background: bg.accent,
          }} />
          エンゲージメント率
        </span>
      </div>
    </div>
  );
}

function fillTimeline(
  timeline: { date: string; reach: number; er: number; count: number }[],
  days: number,
): { date: string; reach: number; er: number; count: number }[] {
  const map = new Map(timeline.map(t => [t.date, t]));
  const out: { date: string; reach: number; er: number; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const v = map.get(key);
    out.push(v ?? { date: key, reach: 0, er: 0, count: 0 });
  }
  return out;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function TopList({
  bg, glassCard, title, icon, items,
}: {
  bg: IrisBackgroundDef;
  glassCard: React.CSSProperties;
  title: string;
  icon: React.ReactNode;
  items: { title: string; value: string }[];
}) {
  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
        <span style={{ color: bg.accent }}>{icon}</span>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700 }}>
          {title}
        </p>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.7 }}>データ不足</p>
      ) : (
        <ol style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: '0.5rem',
              padding: '0.4rem 0',
              borderBottom: i < items.length - 1 ? `1px solid ${bg.cardBorder}` : 'none',
            }}>
              <span style={{
                fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                fontSize: '1.1rem', color: bg.accent, fontWeight: 700, minWidth: 22,
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: '0.85rem', color: bg.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                {item.title}
              </span>
              <span style={{ fontSize: '0.85rem', color: bg.accent, fontWeight: 700, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
                {item.value}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ============================================================
// ギャラリー (Instagram 風)
// ============================================================
function Gallery({
  bg, glassCard, posts, sort, setSort, onTap,
}: {
  bg: IrisBackgroundDef;
  glassCard: React.CSSProperties;
  posts: PostHistoryItem[];
  sort: Sort;
  setSort: (s: Sort) => void;
  onTap: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={16} style={{ color: bg.accent }} />
          <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.05rem', fontWeight: 600, color: bg.ink }}>
            投稿 ({posts.length})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {([
            ['recent', '新着'],
            ['er', 'ER'],
            ['reach', 'リーチ'],
            ['saves', '保存'],
          ] as [Sort, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              style={{
                background: sort === k ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.7)',
                color: sort === k ? '#fff' : bg.inkSoft,
                border: sort === k ? 'none' : `1px solid ${bg.cardBorder}`,
                borderRadius: 999,
                padding: '0.32rem 0.85rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: IRIS_FONTS.body,
                boxShadow: sort === k ? `0 4px 10px ${bg.accent}55` : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div style={{ ...glassCard, textAlign: 'center', padding: '2.4rem 1rem' }}>
          <Upload size={28} style={{ color: bg.inkSoft, marginBottom: '0.6rem' }} />
          <p style={{ color: bg.inkSoft, lineHeight: 1.8, fontSize: '0.88rem' }}>
            投稿はまだありません。<br />
            上のキャプチャゾーンに Instagram のスクショをドロップしてください。
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 'clamp(0.5rem, 1.5vw, 0.8rem)',
        }}>
          {posts.slice(0, 60).map(p => (
            <PostCard key={p.id} bg={bg} post={p} onTap={() => onTap(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ bg, post, onTap }: { bg: IrisBackgroundDef; post: PostHistoryItem; onTap: () => void }) {
  const m = post.metrics;
  const isReel = post.contentType === 'reel';

  return (
    <motion.button
      onClick={onTap}
      whileHover={{ y: -3, boxShadow: `0 16px 32px ${bg.accent}33` }}
      whileTap={{ scale: 0.98 }}
      style={{
        position: 'relative',
        aspectRatio: '4 / 5',
        borderRadius: 18,
        overflow: 'hidden',
        border: `1px solid ${bg.cardBorder}`,
        background: `linear-gradient(160deg, ${bg.accent}26, ${bg.accent}10 50%, rgba(255,255,255,0.65))`,
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        transition: BASE_ALL,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{
        padding: '0.7rem 0.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '0.4rem',
      }}>
        <span style={{
          background: isReel ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
          color: isReel ? '#fff' : bg.ink,
          padding: '0.2rem 0.6rem',
          borderRadius: 999,
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          backdropFilter: 'blur(4px)',
        }}>
          {CONTENT_TYPE_META[post.contentType]}
        </span>
        {typeof m.engagementRate === 'number' && (
          <span style={{
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}dd)`,
            color: '#fff',
            padding: '0.2rem 0.55rem',
            borderRadius: 999,
            fontSize: '0.68rem',
            fontWeight: 700,
            boxShadow: `0 4px 10px ${bg.accent}66`,
          }}>
            {m.engagementRate.toFixed(1)}%
          </span>
        )}
      </div>

      <div style={{
        padding: '0 0.8rem',
        flex: 1,
        display: 'flex',
        alignItems: 'center',
      }}>
        <p style={{
          fontFamily: IRIS_FONTS.serif,
          fontStyle: 'italic',
          fontSize: 'clamp(0.95rem, 2.6vw, 1.15rem)',
          color: bg.ink,
          fontWeight: 600,
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {post.title}
        </p>
      </div>

      <div style={{
        padding: '0.6rem 0.8rem',
        background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.85))',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', flexWrap: 'wrap' }}>
          {typeof m.reach === 'number' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 600 }}>
              <Eye size={11} /> {formatNumber(m.reach)}
            </span>
          )}
          {typeof m.saves === 'number' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 600 }}>
              <Bookmark size={11} /> {formatNumber(m.saves)}
            </span>
          )}
          {typeof m.likes === 'number' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 600 }}>
              <Heart size={11} /> {formatNumber(m.likes)}
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.62rem', color: bg.inkSoft, marginTop: '0.3rem', textAlign: 'right' }}>
          {new Date(post.postedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
        </p>
      </div>
    </motion.button>
  );
}

// ============================================================
// 詳細モーダル
// ============================================================
function DetailModal({
  bg, post, onClose, onDelete,
}: {
  bg: IrisBackgroundDef;
  post: PostHistoryItem;
  onClose: () => void;
  onDelete: () => void;
}) {
  const m = post.metrics;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,10,30,0.55)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2rem',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 24,
          maxWidth: 480,
          width: '100%',
          maxHeight: 'calc(100dvh - 1.5rem)',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 32px 80px rgba(20,10,30,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, marginBottom: '0.3rem' }}>
              {CONTENT_TYPE_META[post.contentType]} · {new Date(post.postedAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.4rem', fontWeight: 600, color: bg.ink, lineHeight: 1.3 }}>
              {post.title}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: '50%',
            width: 32, height: 32,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
          <Stat bg={bg} icon={<Eye size={14} />} label="届いた数" value={m.reach} />
          <Stat bg={bg} icon={<Flame size={14} />} label="ER" value={m.engagementRate} suffix="%" />
          <Stat bg={bg} icon={<Heart size={14} />} label="いいね" value={m.likes} />
          <Stat bg={bg} icon={<MessageCircle size={14} />} label="コメント" value={m.comments} />
          <Stat bg={bg} icon={<Bookmark size={14} />} label="保存" value={m.saves} />
          <Stat bg={bg} icon={<Share2 size={14} />} label="シェア" value={m.shares} />
          {typeof m.views === 'number' && <Stat bg={bg} icon={<Eye size={14} />} label="再生" value={m.views} />}
        </div>

        {post.caption && (
          <div style={{ marginTop: '1rem', padding: '0.8rem 1rem', background: 'rgba(0,0,0,0.03)', borderRadius: 14 }}>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: '0.3rem', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}>
              キャプション
            </p>
            <p style={{ fontSize: '0.85rem', color: bg.ink, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{post.caption}</p>
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div style={{ marginTop: '0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {post.tags.map((t, i) => (
              <span key={i} style={{
                background: bg.accent + '15', color: bg.accent,
                padding: '0.2rem 0.6rem', borderRadius: 999,
                fontSize: '0.72rem', fontWeight: 600,
              }}>{t}</span>
            ))}
          </div>
        )}

        {post.notes && (
          <p style={{ marginTop: '0.7rem', fontSize: '0.78rem', color: bg.inkSoft, fontStyle: 'italic', lineHeight: 1.7 }}>
            <FileText size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            {post.notes}
          </p>
        )}

        <button
          onClick={async () => { if (await confirmAction({ title: 'この投稿を削除しますか?', tone: 'danger' })) onDelete(); }}
          style={{
            marginTop: '1.2rem',
            width: '100%',
            background: 'transparent',
            color: '#C8102E',
            border: '1px solid rgba(200,16,46,0.3)',
            borderRadius: 12,
            padding: '0.6rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            fontFamily: IRIS_FONTS.body,
          }}
        >
          <Trash2 size={14} /> 削除
        </button>
      </motion.div>
    </motion.div>
  );
}

function Stat({ bg, icon, label, value, suffix }: {
  bg: IrisBackgroundDef;
  icon: React.ReactNode;
  label: string;
  value?: number;
  suffix?: string;
}) {
  return (
    <div style={{
      background: typeof value === 'number' ? `linear-gradient(135deg, ${bg.accent}11, ${bg.accent}05)` : 'rgba(0,0,0,0.03)',
      border: `1px solid ${typeof value === 'number' ? bg.accent + '33' : bg.cardBorder}`,
      borderRadius: 14,
      padding: '0.7rem 0.85rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: typeof value === 'number' ? bg.accent : bg.inkSoft, marginBottom: '0.3rem' }}>
        {icon}
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <p style={{
        fontFamily: IRIS_FONTS.serif,
        fontStyle: 'italic',
        fontSize: '1.4rem',
        fontWeight: 600,
        color: bg.ink,
        lineHeight: 1,
      }}>
        {typeof value === 'number' ? `${formatNumber(value)}${suffix || ''}` : '—'}
      </p>
    </div>
  );
}

// ============================================================
// ヘルパー
// ============================================================

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1_000) return n.toLocaleString();
  return n.toString();
}

// ============================================================
// ブランド応募 KPI — 「お仕事を探す」タブからの応募状況をここに集約
// ============================================================
function BrandApplyKpiBlock({ bg }: { bg: IrisBackgroundDef }) {
  const kpi = useMemo(() => computeApplyKpi(), []);
  const history = useMemo(() => loadApplyHistory(), []);
  if (kpi.total === 0) return null;

  const tile = (label: string, value: string, color?: string): React.ReactNode => (
    <div style={{
      background: 'rgba(255,255,255,0.55)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
      padding: '0.75rem 0.95rem', backdropFilter: 'blur(10px)',
    }}>
      <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: bg.inkSoft, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: '1.35rem', fontWeight: 700, color: color || bg.ink }}>{value}</p>
    </div>
  );

  return (
    <div style={{
      background: bg.card, border: `1px solid ${bg.cardBorder}`,
      borderRadius: 22, padding: '1.1rem 1.25rem', backdropFilter: 'blur(10px)',
    }}>
      <p style={{ fontSize: '0.7rem', letterSpacing: '0.22em', color: bg.accent, fontWeight: 700, marginBottom: 6 }}>BRAND APPLICATIONS</p>
      <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.5rem', color: bg.ink, marginBottom: '0.85rem' }}>
        応募の成果
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
        {tile('応募した', kpi.total + ' 件')}
        {tile('返信があった', kpi.replied + ' 件', '#A78BFA')}
        {tile('成立', kpi.won + ' 件', '#10B981')}
        {tile('応募合計報酬', '¥' + kpi.totalFeeApplied.toLocaleString())}
        {tile('獲得報酬', '¥' + kpi.totalFeeWon.toLocaleString(), '#10B981')}
        {kpi.total > 0 && tile('返信率', Math.round(kpi.responseRate * 100) + '%')}
      </div>
      {history[0] && (
        <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.75rem', lineHeight: 1.55 }}>
          直近: <span style={{ color: bg.ink, fontWeight: 600 }}>{history[0].dealBrand}</span> · ¥{history[0].fee.toLocaleString()} ({new Date(history[0].appliedAt).toLocaleDateString('ja-JP')})
        </p>
      )}
    </div>
  );
}
