// ============================================================
// IrisFlowHub — 連携後の「一気通貫」運用プラン
//
// オーナー指示 (2026-06-18):
//   Instagram 連携後、分析 → 戦略 → リール作成 → 稼ぐ までを一気通貫で。
//   Iris が運用代行会社を代替するレベルに引き上げる。
//
// これまで各段（分析/戦略/案件/リール）は別タブで分断され、データも受け渡されて
// いなかった。本コンポーネントはそれを 1 つの流れにまとめる:
//   ① 分析サマリ（プロフィール＋AI 戦略の見立て）
//   ② 今週やること（AI 戦略 3 本）
//   ③ 今日のリール台本（②の戦略テーマから その場で台本を生成）← 一気通貫の核
//   ④ あなた向け案件（プロフィールのフォロワー数・ジャンルで実マッチ）
// 失敗時は必ず復旧導線（再試行）を出し、行き止まりを作らない。
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import CountUp from '../components/CountUp';
import Celebrate from '../components/Celebrate';
import {
  BarChart3, Sparkles, Clapperboard, Mail, CheckCircle2, ArrowRight,
  Loader2, TrendingUp, RefreshCw, ChevronRight, Hash, Clock, CalendarPlus,
  LayoutGrid, GripVertical, ChevronLeft, Video as VideoIcon, ImageIcon,
  Copy, Check, Camera,
} from 'lucide-react';
import type { IgProfile } from './instagramConnect';
import { useIgStrategy, type StrategyItem } from './useIgStrategy';
import { useIgAnalysis } from './useIgAnalysis';
import { generateReelScript, type ReelScriptResult } from './reelAiScript';
import { getAllBrandDeals, CATEGORY_META, type BrandDeal } from './brandDeals';
import { generateApplicationDraft, type ApplicationDraft } from './brandDealMatch';
import IrisReelComposer from './IrisReelComposer';
import type { ComposeContext } from './reelAiCaption';
import type { ReelStudioSeed } from './IrisReelStudio';
import type { IrisBackgroundDef } from './irisStyle';
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { usePostQueue, type ScheduledPost } from './usePostQueue';
import { copyText } from './copyText';

interface Props {
  bg: IrisBackgroundDef;
  igProfile: IgProfile;
  settings: AppSettings;
  mediaKit?: MediaKit;
  onNavigate: (tab: string) => void;
  /** リールスタジオを開く（生成済みテーマを引き継ぐ） */
  onOpenReelStudio: (theme: string) => void;
  /** リールを投稿予約に追加（任意で案件に紐付け）。ダッシュボードが postQueue.add に橋渡し */
  onScheduleReel?: (p: { caption: string; hashtags: string[]; cta?: string; title?: string; dealId?: string; brandName?: string; mediaKind?: 'video' | 'image' }) => void;
  /** 「素材から構成」の結果をリールスタジオへ渡して動画化する */
  onSendReelToStudio?: (seed: ReelStudioSeed) => void;
  /** 投稿予約キュー（9マス・グリッドプレビュー＋並べ替えに使用）。ダッシュボードの usePostQueue() を橋渡し */
  postQueue?: ReturnType<typeof usePostQueue>;
}

/** リールを紐付ける案件の選択（なし or マッチ済み案件）チップ */
function DealLinkPicker({ deals, value, onChange, accent, bg }: {
  deals: { deal: BrandDeal }[]; value: string | null; onChange: (id: string | null) => void; accent: string; bg: IrisBackgroundDef;
}) {
  if (!deals.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: bg.inkSoft, marginBottom: 6 }}>案件に紐付け（任意）</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[{ id: null as string | null, name: 'なし' }, ...deals.map((d) => ({ id: d.deal.id, name: d.deal.brandName }))].map((opt) => {
          const sel = value === opt.id;
          return (
            <button key={opt.id ?? 'none'} type="button" onClick={() => onChange(opt.id)}
              style={{
                fontSize: 11.5, fontWeight: 700, borderRadius: 99, padding: '9px 14px', minHeight: 40, cursor: 'pointer',
                background: sel ? `linear-gradient(135deg, ${accent}, #F77737)` : 'transparent',
                color: sel ? '#fff' : bg.inkSoft,
                border: sel ? 'none' : `1px solid ${bg.cardBorder}`,
              }}>
              {opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const fmtNum = (n?: number) => (n == null ? '—' : n.toLocaleString('ja-JP'));

/** プロフィール（フォロワー数・ジャンル）で案件を実マッチ。computeMatchScore に依存しない軽量版。 */
function matchDealsForProfile(profile: IgProfile, max = 3): { deal: BrandDeal; reason: string }[] {
  const followers = profile.followers || 0;
  const cats = new Set(profile.topPostCategories || []);
  const scored = getAllBrandDeals().map((deal) => {
    let score = 0;
    const reasons: string[] = [];
    // フォロワー要件
    const minOk = followers >= deal.minFollowers;
    const maxOk = !deal.maxFollowers || followers <= deal.maxFollowers * 1.2;
    if (minOk && maxOk) { score += 40; reasons.push(`フォロワー ${fmtNum(followers)} で条件クリア`); }
    else if (followers >= deal.minFollowers * 0.7) { score += 18; }
    // ジャンル一致（カテゴリ ラベル or audienceTags にユーザーのジャンルが含まれるか）
    const catLabel = CATEGORY_META[deal.category]?.label || '';
    const tagHit = deal.audienceTags.some((t) => [...cats].some((c) => t.includes(c) || c.includes(t)));
    const catHit = [...cats].some((c) => catLabel.includes(c) || c.includes(catLabel));
    if (tagHit || catHit) { score += 35; reasons.push('あなたのジャンルと相性◎'); }
    // 報酬の高さで微加点
    score += Math.min(15, Math.round((deal.fee || 0) / 10000));
    return { deal, score, applicable: minOk && maxOk, reason: reasons.join(' · ') || `報酬 ¥${fmtNum(deal.fee)}` };
  });
  return scored
    .filter((s) => s.applicable || s.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ deal, reason }) => ({ deal, reason }));
}

export default function IrisFlowHub({ bg, igProfile, settings, mediaKit, onNavigate, onOpenReelStudio, onScheduleReel, onSendReelToStudio, postQueue }: Props) {
  const accent = '#E1306C';
  const reduce = useReducedMotion();
  const { data: strategy, loading: stratLoading, error: stratError, refresh } = useIgStrategy(igProfile);
  // 連携後の自動分析（永続化）
  const { data: analysis, loading: anaLoading, error: anaError, refresh: refreshAna } = useIgAnalysis(igProfile, settings);

  // 今日のリール台本（戦略テーマから その場生成）
  const [reelMode, setReelMode] = useState<'script' | 'clips'>('script');
  const [reelTheme, setReelTheme] = useState<string>('');
  const [reel, setReel] = useState<ReelScriptResult | null>(null);
  const [reelLoading, setReelLoading] = useState(false);
  const [reelError, setReelError] = useState<string | null>(null);
  // リール↔案件↔投稿予約の紐付け
  const [linkDealId, setLinkDealId] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  // 達成の瞬間の祝祭
  const [celebrate, setCelebrate] = useState({ n: 0, msg: '' });
  const fire = (msg: string) => setCelebrate((c) => ({ n: c.n + 1, msg }));

  const matchedDeals = useMemo(() => matchDealsForProfile(igProfile), [igProfile]);

  // ⑤ 9マス・グリッドプレビュー＋並べ替え（公開前にフィード全体の統一感を見る）
  //   投稿順（scheduledAt の昇順）を「見た目の並び」として扱い、ドラッグ/矢印で
  //   セルを入れ替えると、対応する予約時刻（枠）同士を入れ替える。
  const feedGridPosts = useMemo(() => {
    if (!postQueue) return [];
    return [...postQueue.posts]
      .filter((p) => p.status !== 'posted' && p.status !== 'skipped')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
      .slice(0, 9);
  }, [postQueue]);
  const [gridLastMove, setGridLastMove] = useState<{ from: number; to: number } | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);

  const applyGridReorder = (from: number, to: number) => {
    if (!postQueue) return;
    if (from === to || from < 0 || to < 0 || from >= feedGridPosts.length || to >= feedGridPosts.length) return;
    setGridError(null);
    setGridLastMove({ from, to });
    try {
      const times = feedGridPosts.map((p) => p.scheduledAt);
      const arr = [...feedGridPosts];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      arr.forEach((p, idx) => {
        if (p.scheduledAt !== times[idx]) postQueue.update(p.id, { scheduledAt: times[idx] });
      });
    } catch (e) {
      setGridError(e instanceof Error ? e.message : '並べ替えの保存に失敗しました');
    }
  };
  const retryGridReorder = () => { if (gridLastMove) applyGridReorder(gridLastMove.from, gridLastMove.to); };
  // usePostQueue 側のストレージ保存失敗も、このセクション内で拾って表示する（沈黙させない）
  const gridSaveError = postQueue?.saveError || gridError;

  // ④ 応募文をその場生成（稼ぐステップを一気通貫で完結）
  const [draftDealId, setDraftDealId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  // 「稼ぐ」ステップ完了 = Iris が応募文（稼ぐための成果物）を出した瞬間に点灯
  const [earnDone, setEarnDone] = useState(false);
  // コピーした案件 id（ボタンを「コピー済み」に変えて沈黙を消す）
  const [copiedDealId, setCopiedDealId] = useState<string | null>(null);
  // コピー失敗も沈黙させない（http 環境や古い端末向けフォールバック込み）
  const [draftCopyFailed, setDraftCopyFailed] = useState(false);

  const copyDraft = async (dealId: string) => {
    if (!draft) return;
    setDraftCopyFailed(false);
    const ok = await copyText(`${draft.subject}\n\n${draft.body}`);
    if (ok) { setCopiedDealId(dealId); fire('応募文をコピーしました'); }
    else setDraftCopyFailed(true);
  };

  const makeDraft = async (deal: BrandDeal) => {
    setDraftDealId(deal.id);
    setDraft(null);
    setDraftError(null);
    setDraftCopyFailed(false);
    setDraftLoading(true);
    const note = [
      `Instagram @${igProfile.handle}`,
      igProfile.followers ? `フォロワー ${igProfile.followers.toLocaleString()}` : '',
      (igProfile.topPostCategories || []).length ? `ジャンル: ${igProfile.topPostCategories.join('・')}` : '',
      analysis?.oneLiner ? `強み: ${analysis.oneLiner}` : '',
    ].filter(Boolean).join(' / ');
    try {
      const d = await generateApplicationDraft({ settings, deal, mediaKit, customNote: note });
      setDraft(d);
      if (!earnDone) { setEarnDone(true); fire('応募文ができました！連携から稼ぐまで一気通貫の完成です'); }
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : '応募文の生成に失敗しました');
    } finally {
      setDraftLoading(false);
    }
  };

  const defaultTheme =
    strategy?.contentTheme || analysis?.next30Days?.week1?.theme || strategy?.strategies?.[0]?.action || strategy?.strategies?.[0]?.title || '';

  // リールを投稿予約へ（選択中の案件に紐付け）
  const scheduleReel = (p: { caption: string; hashtags: string[]; cta?: string; title?: string; mediaKind?: 'video' | 'image' }) => {
    if (!onScheduleReel) return;
    const linked = matchedDeals.find((d) => d.deal.id === linkDealId)?.deal;
    onScheduleReel({ ...p, dealId: linked?.id, brandName: linked?.brandName });
    setScheduled(true);
    fire(linked ? `${linked.brandName} 用に予約しました！` : '投稿予約に追加しました！');
  };

  // 分析から得たリール構成用の文脈（オーディエンス/世界観/テーマ）
  const composeContext: ComposeContext = {
    audience: analysis?.estimatedAudience?.primary,
    brand: analysis?.brandIdentity,
    theme: defaultTheme || undefined,
    goal: '保存数とフォロワーを伸ばす',
  };

  const makeReel = async (theme: string) => {
    const t = (theme || defaultTheme).trim();
    if (!t) { setReelError('先に戦略テーマを選んでください'); return; }
    setReelTheme(t);
    setReelLoading(true);
    setReelError(null);
    setReel(null);
    try {
      const r = await generateReelScript(t);
      setReel(r);
      fire('リール台本ができました！');
    } catch (e) {
      setReelError(e instanceof Error ? e.message : '台本の生成に失敗しました');
    } finally {
      setReelLoading(false);
    }
  };

  const card: React.CSSProperties = {
    background: bg.card,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 20,
    padding: '1.1rem 1.15rem',
    marginBottom: 14,
    scrollMarginTop: 76, // ステップレールからの移動時、上部バーに隠れない
  };
  const stepDoneColor = '#10B981';

  // ステップレール（連携✓ → 戦略 → リール → 案件）。タップで該当セクションへ飛べる
  const steps = [
    { key: 'connect', label: '連携', done: true, section: 'flow-sec-analysis' },
    { key: 'strategy', label: '戦略', done: !!strategy, section: 'flow-sec-strategy' },
    { key: 'reel', label: 'リール', done: !!reel, section: 'flow-sec-reel' },
    { key: 'earn', label: '稼ぐ', done: earnDone, section: 'flow-sec-earn' },
  ];
  // 「いま光らせる」ステップ = 完了していない最初のステップ
  const activeStepIdx = steps.findIndex((s) => !s.done);
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // 「次はこれ」ガイド — 実際の進み具合から、いま押すべき場所を言葉で示す
  const nextGuide = activeStepIdx === -1
    ? { text: '今日の流れはぜんぶ完了！投稿予約を確認しましょう', done: true as const, go: () => onNavigate('schedule') }
    : {
        text: ({
          strategy: stratLoading ? 'いま Iris が今週の戦略を準備中。できたらすぐ下に出ます' : '次はこれ → ② 今週の戦略を確認する',
          reel: '次はこれ → ③ ボタンを押すだけで今日の台本ができます',
          earn: '次はこれ → ④ 案件の「応募文を作る」を押す',
        } as Record<string, string>)[steps[activeStepIdx].key] || '次はこれ → 上から順に進むだけ',
        done: false as const,
        go: () => scrollToSection(steps[activeStepIdx].section),
      };

  // 子要素を順に立ち上げる（段階的に現れることで“組み上がっていく”感）
  const reveal = (i: number) => (reduce
    ? {}
    : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } });

  return (
    <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
      <Celebrate trigger={celebrate.n} message={celebrate.msg} />
      {/* 生きているオーラ（ヘッダ背後でゆっくり呼吸する） */}
      {!reduce && (
        <motion.div aria-hidden
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1], x: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -30, left: -10, width: 260, height: 160,
            background: `radial-gradient(60% 60% at 30% 30%, ${accent}33, transparent 70%), radial-gradient(50% 50% at 80% 40%, #F7773733, transparent 70%)`,
            filter: 'blur(28px)', pointerEvents: 'none', zIndex: 0,
          }}
        />
      )}

      {/* ヘッダ */}
      <motion.div {...reveal(0)} style={{ position: 'relative', zIndex: 1, marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 800, color: accent }}>
          <motion.span
            animate={reduce ? {} : { rotate: [0, 18, -12, 0], scale: [1, 1.18, 1] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex' }}
          ><Sparkles size={13} /></motion.span>
          あなたの運用プラン
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 800, color: bg.ink, lineHeight: 1.35 }}>
          連携から、稼ぐまで一気通貫で
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
          Iris があなたのアカウントを見て、<strong style={{ color: bg.ink }}>今のあなた → 今週やること → 今日のリール → 案件</strong>まで全部そろえます。上から順に進むだけ。
        </p>
      </motion.div>

      {/* ステップレール（流れる光・現在地の脈動・完了のポップ） */}
      <motion.div {...reveal(1)} style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        {steps.map((s, i) => {
          const active = i === activeStepIdx;
          const segDone = steps[i + 1]?.done || s.done;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {/* タップで該当セクションへスクロール（44px 確保） */}
              <button type="button" onClick={() => scrollToSection(s.section)}
                aria-label={`${s.label}のセクションへ移動`}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1, position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 0 4px', minHeight: 44 }}>
                {/* 現在地の脈動リング */}
                {active && !reduce && (
                  <motion.div aria-hidden
                    animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    style={{ position: 'absolute', top: 5, width: 26, height: 26, borderRadius: '50%', border: `2px solid ${accent}`, pointerEvents: 'none' }}
                  />
                )}
                <motion.div
                  initial={false}
                  animate={s.done
                    ? { background: stepDoneColor, scale: reduce ? 1 : [1, 1.25, 1] }
                    : { background: active ? `${accent}26` : `${accent}14` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    border: s.done ? 'none' : `1.5px solid ${active ? accent : accent + '55'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.done ? '#fff' : accent, fontSize: 11, fontWeight: 800,
                    boxShadow: active && !reduce ? `0 0 0 0 ${accent}` : 'none',
                  }}>
                  {s.done ? <CheckCircle2 size={15} /> : i + 1}
                </motion.div>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: s.done ? stepDoneColor : active ? accent : bg.inkSoft }}>{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <div style={{ position: 'relative', height: 2, flex: 1, marginBottom: 16, background: `${accent}22`, borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div
                    initial={false}
                    animate={{ width: segDone ? '100%' : '0%' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    style={{ position: 'absolute', inset: 0, background: `${stepDoneColor}99`, borderRadius: 2 }}
                  />
                  {/* 完了セグメントを流れる光 */}
                  {segDone && !reduce && (
                    <motion.div aria-hidden
                      animate={{ x: ['-40%', '140%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
                      style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* 「次はこれ」ガイド — 今どこまで進んだか＋次に押す場所を1行で。タップで移動 */}
      <motion.div {...reveal(1)} style={{ position: 'relative', zIndex: 1 }}>
        <button type="button" onClick={nextGuide.go}
          style={{
            width: '100%', minHeight: 44, marginBottom: 14,
            background: nextGuide.done ? 'rgba(16,185,129,0.10)' : `${accent}0D`,
            border: `1px solid ${nextGuide.done ? 'rgba(16,185,129,0.3)' : accent + '33'}`,
            borderRadius: 12, padding: '8px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
          }}>
          {nextGuide.done
            ? <CheckCircle2 size={16} color={stepDoneColor} style={{ flexShrink: 0 }} />
            : <ArrowRight size={16} color={accent} style={{ flexShrink: 0 }} />}
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: nextGuide.done ? '#0F7D63' : bg.ink, lineHeight: 1.5 }}>
            {nextGuide.text}
          </span>
          <ChevronRight size={15} color={nextGuide.done ? '#0F7D63' : accent} style={{ flexShrink: 0 }} />
        </button>
      </motion.div>

      {/* ① 分析サマリ（連携後に自動実行） */}
      <div style={card} id="flow-sec-analysis">
        <SectionLabel Icon={BarChart3} color={accent} title="① いまのあなた（自動分析）" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <Stat label="フォロワー" value={igProfile.followers ? <CountUp value={igProfile.followers} /> : '—'} bg={bg} />
          {analysis ? (
            <Stat label="総合スコア" value={<CountUp value={analysis.totalScore} durationMs={1400} />} bg={bg} />
          ) : igProfile.engagementRate != null ? (
            <Stat label="反応率" value={`${igProfile.engagementRate}%`} bg={bg} />
          ) : null}
          {igProfile.bestPostTime && <Stat label="伸びる時間" value={igProfile.bestPostTime} bg={bg} />}
        </div>
        {anaLoading && (
          <InlineLoading text="Iris があなたを分析しています…" bg={bg}
            phases={['プロフィールを読み込んでいます…', '投稿への反応を集計しています…', 'あなたの強みを言葉にしています…', 'リールの想定単価を計算しています…']}
          />
        )}
        {anaError && !analysis && <InlineError text="分析に失敗しました。" onRetry={refreshAna} />}
        {analysis && (
          <>
            <p style={{ margin: '12px 0 0', fontSize: 13.5, fontWeight: 700, color: bg.ink, lineHeight: 1.6 }}>
              {analysis.oneLiner}
            </p>
            {analysis.strengths?.length > 0 && (
              <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analysis.strengths.slice(0, 2).map((s, i) => (
                  <li key={i} style={{ fontSize: 12, color: bg.inkSoft, lineHeight: 1.5, display: 'flex', gap: 6 }}>
                    <span style={{ color: accent, fontWeight: 800 }}>強み</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
            {analysis.estimatedFee?.reel && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: bg.inkSoft }}>
                リール想定単価の目安: <strong style={{ color: bg.ink }}>¥{fmtNum(analysis.estimatedFee.reel.min)}〜¥{fmtNum(analysis.estimatedFee.reel.max)}</strong>
              </div>
            )}
          </>
        )}
        {!analysis && !anaLoading && strategy?.audienceInsight && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: bg.ink, lineHeight: 1.7 }}>{strategy.audienceInsight}</p>
        )}
      </div>

      {/* ② 今週やること（戦略） */}
      <div style={card} id="flow-sec-strategy">
        <SectionLabel Icon={TrendingUp} color={accent} title="② 今週やること（戦略）" />
        {stratLoading && (
          <InlineLoading text="戦略を立てています…" bg={bg}
            phases={['直近の投稿の傾向を見ています…', '伸びやすいテーマを選んでいます…', '今週やること3本に絞っています…']}
          />
        )}
        {stratError && <InlineError text="戦略の取得に失敗しました。" onRetry={refresh} />}
        {strategy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {strategy.contentTheme && (
              <div style={{ fontSize: 12, color: bg.inkSoft }}>
                今月のテーマ: <strong style={{ color: bg.ink }}>{strategy.contentTheme}</strong>
              </div>
            )}
            {(strategy.strategies || []).slice(0, 3).map((s, i) => (
              <StrategyRow key={i} item={s} accent={accent} bg={bg} onMakeReel={() => makeReel(s.action || s.title)} />
            ))}
          </div>
        )}
      </div>

      {/* ③ 今日のリール（台本 or 素材から構成 = 一気通貫の核） */}
      <motion.div {...reveal(2)} whileHover={reduce ? undefined : { y: -2 }} id="flow-sec-reel" style={{ ...card, position: 'relative', zIndex: 1, overflow: 'hidden', border: `1.5px solid ${accent}55`, background: `linear-gradient(180deg, ${accent}0D, ${bg.card})` }}>
        {/* 「核」のカードが息づく — 縁を回る淡い光 */}
        {!reduce && (
          <motion.div aria-hidden
            animate={{ opacity: [0.25, 0.6, 0.25] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: 20, boxShadow: `inset 0 0 30px ${accent}26`, pointerEvents: 'none' }}
          />
        )}
        <SectionLabel Icon={Clapperboard} color={accent} title="③ 今日のリール" />
        {/* モード切替: テーマから台本 / 素材から構成 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: `${accent}10`, borderRadius: 12, padding: 4, margin: '10px 0 12px' }}>
          {([['script', '台本を書く'], ['clips', '写真・動画から作る']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setReelMode(k)}
              style={{
                padding: '8px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: reelMode === k ? '#fff' : 'transparent',
                color: reelMode === k ? accent : bg.inkSoft,
                fontSize: 12, fontWeight: 800,
                boxShadow: reelMode === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* リール↔案件 紐付け（投稿予約に引き継がれる） */}
        <DealLinkPicker deals={matchedDeals} value={linkDealId} onChange={(id) => { setLinkDealId(id); setScheduled(false); }} accent={accent} bg={bg} />

        {reelMode === 'clips' ? (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: bg.inkSoft, lineHeight: 1.6 }}>
              手持ちの写真・動画をえらぶと、Iris が順番とテロップ（字幕）を考えてリールに組み立てます。
            </p>
            <IrisReelComposer
              bg={bg} accent={accent} context={composeContext}
              onSchedule={onScheduleReel ? (p) => scheduleReel({ ...p, mediaKind: 'video' }) : undefined}
              scheduled={scheduled}
              onViewSchedule={() => onNavigate('schedule')}
              onSendToStudio={onSendReelToStudio}
            />
          </div>
        ) : (
        <>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: bg.inkSoft, lineHeight: 1.6 }}>
          上の戦略テーマから、Iris がリールの台本（最初のつかみ → 本編 → 締めのひとこと）を今すぐ書きます。
        </p>
        {!reel && !reelLoading && (
          <button
            type="button"
            onClick={() => makeReel(defaultTheme)}
            disabled={!defaultTheme}
            style={{
              width: '100%', minHeight: 50,
              background: defaultTheme ? `linear-gradient(135deg, ${accent}, #F77737)` : `${accent}55`,
              color: '#fff', border: 'none', borderRadius: 14,
              fontSize: 14.5, fontWeight: 800, cursor: defaultTheme ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: `0 8px 22px ${accent}33`,
            }}
          >
            <Sparkles size={17} /> {defaultTheme ? `「${truncate(defaultTheme, 16)}」で台本を作る` : '戦略を待っています…'}
          </button>
        )}
        {reelLoading && (
          <InlineLoading text="台本を書いています…" bg={bg}
            phases={['最初のつかみ（フック）を考えています…', '3シーンの流れを書いています…', '締めのひとことを整えています…', 'ハッシュタグを選んでいます…']}
          />
        )}
        {reelError && <InlineError text={reelError} onRetry={() => makeReel(reelTheme || defaultTheme)} />}
        {reel && (
          <>
            <ReelScriptCard reel={reel} theme={reelTheme} accent={accent} bg={bg}
              onRegenerate={() => makeReel(reelTheme || defaultTheme)}
              onOpenStudio={() => onOpenReelStudio(reelTheme || defaultTheme)}
            />
            {onScheduleReel && (
              <ScheduleReelBar
                scheduled={scheduled} accent={accent}
                onSchedule={() => scheduleReel({ caption: reel.caption || reel.title, hashtags: reel.hashtags || [], cta: reel.cta, title: reel.title, mediaKind: 'video' })}
                onViewSchedule={() => onNavigate('schedule')}
              />
            )}
          </>
        )}
        </>
        )}
      </motion.div>

      {/* ⑤ 9マス・グリッドプレビュー＋並べ替え（公開前にフィード全体の見た目を確認） */}
      {feedGridPosts.length > 0 && (
        <motion.div {...reveal(3)} style={{ ...card, position: 'relative', zIndex: 1 }}>
          <SectionLabel Icon={LayoutGrid} color={accent} title="フィードの見た目（9マス）" />
          <p style={{ margin: '10px 0 12px', fontSize: 12, color: bg.inkSoft, lineHeight: 1.6 }}>
            公開前に、投稿予約の並びをフィード風に確認できます。ドラッグ（スマホは選んで矢印）で順番を入れ替えられます。
          </p>
          <FeedGridPreview bg={bg} accent={accent} posts={feedGridPosts} onReorder={applyGridReorder} />
          {gridSaveError && (
            <InlineError
              text={gridSaveError}
              onRetry={() => { postQueue?.dismissSaveError(); setGridError(null); retryGridReorder(); }}
            />
          )}
          <button type="button" onClick={() => onNavigate('schedule')}
            style={{
              marginTop: 10, minHeight: 44, background: 'transparent', border: 'none', color: accent,
              fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: 6,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%',
            }}>
            投稿予約をすべて見る <ArrowRight size={14} />
          </button>
        </motion.div>
      )}

      {/* ④ あなた向け案件（プロフィール連動マッチ） */}
      <div style={card} id="flow-sec-earn">
        <SectionLabel Icon={Mail} color={accent} title="④ あなた向けの案件" />
        {matchedDeals.length === 0 ? (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
            ジャンルを登録すると、相性の良い案件が出ます。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {matchedDeals.map(({ deal, reason }) => (
              <div key={deal.id} style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 14, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: `${CATEGORY_META[deal.category]?.color || accent}22`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: CATEGORY_META[deal.category]?.color || accent,
                  }}>
                    {deal.brandName.slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: bg.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {deal.brandName} <span style={{ color: bg.inkSoft, fontWeight: 600 }}>· {deal.productName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: bg.inkSoft, lineHeight: 1.4, marginTop: 1 }}>{reason}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: accent, flexShrink: 0 }}>¥{fmtNum(deal.fee)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => makeDraft(deal)} disabled={draftLoading && draftDealId === deal.id}
                    style={{ flex: 1, minHeight: 44, background: `linear-gradient(135deg, ${accent}, #F77737)`, border: 'none', color: '#fff', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Mail size={13} /> {draftLoading && draftDealId === deal.id ? '作成中…' : '応募文を作る'}
                  </button>
                  <button type="button" onClick={() => onNavigate('deals')}
                    style={{ minHeight: 44, background: 'transparent', border: `1px solid ${bg.cardBorder}`, color: bg.ink, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    詳細 <ChevronRight size={13} />
                  </button>
                </div>
                {/* 応募文（その場生成） */}
                {draftDealId === deal.id && draftLoading && (
                  <InlineLoading text="応募文を書いています…" bg={bg}
                    phases={['あなたの実績を整理しています…', 'ブランドに合う言い方を選んでいます…', '件名と本文を仕上げています…']}
                  />
                )}
                {draftDealId === deal.id && draftError && <InlineError text={draftError} onRetry={() => makeDraft(deal)} />}
                {draftDealId === deal.id && draft && (
                  <div style={{ marginTop: 10, background: `${accent}0A`, border: `1px solid ${accent}33`, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: accent, marginBottom: 4 }}>件名</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: bg.ink, lineHeight: 1.5 }}>{draft.subject}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: accent, margin: '8px 0 4px' }}>本文</div>
                    <div style={{ fontSize: 12, color: bg.ink, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{draft.body}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button type="button"
                        onClick={() => { void copyDraft(deal.id); }}
                        style={{ flex: 1, minHeight: 44, background: copiedDealId === deal.id ? 'rgba(16,185,129,0.12)' : `linear-gradient(135deg, ${accent}, #F77737)`, border: copiedDealId === deal.id ? '1px solid rgba(16,185,129,0.4)' : 'none', color: copiedDealId === deal.id ? '#0F7D63' : '#fff', fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        {copiedDealId === deal.id ? <><CheckCircle2 size={13} /> コピーしました</> : <><Copy size={13} /> 応募文をコピー</>}
                      </button>
                      {deal.contact?.type === 'email' ? (
                        <a href={`mailto:${deal.contact.address}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                          style={{ flex: 1, minHeight: 44, background: 'transparent', border: `1px solid ${accent}66`, color: accent, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '9px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          メールで送る
                        </a>
                      ) : deal.contact?.type === 'form' ? (
                        <a href={deal.contact.url} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, minHeight: 44, background: 'transparent', border: `1px solid ${accent}66`, color: accent, fontSize: 12, fontWeight: 800, borderRadius: 10, padding: '9px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          応募フォームを開く
                        </a>
                      ) : null}
                    </div>
                    {draftCopyFailed && draftDealId === deal.id && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#9B1B30', lineHeight: 1.5 }}>
                        コピーできませんでした。本文を長押しして選択→コピーしてください。
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={() => onNavigate('deals')}
              style={{
                marginTop: 2, minHeight: 44, background: 'transparent', border: 'none', color: accent,
                fontSize: 12.5, fontWeight: 800, cursor: 'pointer', padding: 6,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              すべての案件を見る <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 小物 ────────────────────────────────────────────

function ScheduleReelBar({ scheduled, accent, onSchedule, onViewSchedule }: {
  scheduled: boolean; accent: string; onSchedule: () => void; onViewSchedule: () => void;
}) {
  if (scheduled) {
    return (
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '10px 12px' }}>
        <CheckCircle2 size={16} color="#10B981" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0F7D63' }}>投稿予約に追加しました</span>
        <button type="button" onClick={onViewSchedule}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: accent, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, minHeight: 44, padding: '0 6px' }}>
          予約を見る <ArrowRight size={13} />
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onSchedule}
      style={{ marginTop: 10, width: '100%', minHeight: 44, background: 'transparent', border: `1px solid ${accent}66`, color: accent, fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <CalendarPlus size={14} /> 投稿予約に追加
    </button>
  );
}

/** 9マス・グリッドプレビュー＋並べ替え。ドラッグ(デスクトップ) と 選択→矢印(タップ44px、モバイル向け) の両対応。 */
function FeedGridPreview({ bg, accent, posts, onReorder }: {
  bg: IrisBackgroundDef; accent: string; posts: ScheduledPost[]; onReorder: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const cells: (ScheduledPost | null)[] = Array.from({ length: 9 }, (_, i) => posts[i] || null);

  const selectCell = (i: number) => setSelected((cur) => (cur === i ? null : i));
  const moveSelected = (dir: -1 | 1) => {
    if (selected == null) return;
    const to = selected + dir;
    if (to < 0 || to >= posts.length) return;
    onReorder(selected, to);
    setSelected(to);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {cells.map((p, i) => {
          if (!p) {
            return (
              <div key={`empty-${i}`} aria-hidden
                style={{ aspectRatio: '1 / 1', borderRadius: 12, background: `${bg.accent}0A` }}
              />
            );
          }
          const isSel = selected === i;
          const isDragOver = overIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <div
              key={p.id}
              draggable
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}番目の投稿。選択して矢印で並べ替え`}
              onClick={() => selectCell(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCell(i); }
              }}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex != null && dragIndex !== i) onReorder(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              style={{
                position: 'relative', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                background: '#000', cursor: 'grab',
                boxShadow: isSel ? `0 0 0 2.5px ${accent}` : isDragOver ? `0 0 0 2px ${accent}88` : '0 1px 4px rgba(0,0,0,0.14)',
                transition: 'box-shadow 0.15s, transform 0.15s',
                transform: dragIndex === i ? 'scale(0.96)' : 'scale(1)',
              }}
            >
              {p.thumbDataUrl ? (
                <img src={p.thumbDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${accent}33, #F7773733)` }}>
                  {p.mediaKind === 'image' ? <ImageIcon size={20} color="rgba(255,255,255,0.75)" /> : <VideoIcon size={20} color="rgba(255,255,255,0.75)" />}
                </div>
              )}
              <span style={{
                position: 'absolute', top: 4, left: 4, minWidth: 18, height: 18, borderRadius: 6, padding: '0 4px',
                background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</span>
              <span style={{ position: 'absolute', top: 4, right: 4, display: 'flex', opacity: 0.85 }}>
                <GripVertical size={13} color="#fff" />
              </span>
            </div>
          );
        })}
      </div>

      {/* 選択中セルの並べ替えバー（タップ44px・ドラッグが使えない環境の正規ルート） */}
      {selected != null && posts[selected] && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, background: `${accent}0D`, borderRadius: 12, padding: '6px 8px' }}>
          <button type="button" onClick={() => moveSelected(-1)} disabled={selected === 0}
            aria-label="1つ前に移動"
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', cursor: selected === 0 ? 'not-allowed' : 'pointer',
              background: selected === 0 ? `${accent}14` : `linear-gradient(135deg, ${accent}, #F77737)`,
              color: selected === 0 ? bg.inkSoft : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <ChevronLeft size={18} />
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: bg.ink }}>
            {selected + 1} 番目を選択中
          </span>
          <button type="button" onClick={() => moveSelected(1)} disabled={selected === posts.length - 1}
            aria-label="1つ後ろに移動"
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none', cursor: selected === posts.length - 1 ? 'not-allowed' : 'pointer',
              background: selected === posts.length - 1 ? `${accent}14` : `linear-gradient(135deg, ${accent}, #F77737)`,
              color: selected === posts.length - 1 ? bg.inkSoft : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) { const a = [...s]; return a.length > n ? a.slice(0, n).join('') + '…' : s; }

function SectionLabel({ Icon, color, title }: { Icon: typeof BarChart3; color: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={15} color={color} strokeWidth={2.4} />
      </div>
      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--iris-ink)' }}>{title}</h3>
    </div>
  );
}

function Stat({ label, value, bg }: { label: string; value: React.ReactNode; bg: IrisBackgroundDef }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 16, stiffness: 220 }}
      style={{ flex: '1 1 30%', minWidth: 88, background: `${bg.accent}0D`, borderRadius: 12, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: bg.inkSoft, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: bg.ink, marginTop: 1 }}>{value}</div>
    </motion.div>
  );
}

function StrategyRow({ item, accent, bg, onMakeReel }: { item: StrategyItem; accent: string; bg: IrisBackgroundDef; onMakeReel: () => void }) {
  return (
    <div style={{ background: `${accent}08`, border: `1px solid ${accent}22`, borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: bg.ink, lineHeight: 1.4 }}>{item.title}</div>
      {item.action && <div style={{ fontSize: 11.5, color: bg.inkSoft, lineHeight: 1.5, marginTop: 3 }}>{item.action}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
        {item.kpi && <span style={{ fontSize: 10.5, color: accent, fontWeight: 700, background: `${accent}14`, padding: '2px 8px', borderRadius: 99 }}>KPI: {item.kpi}</span>}
        <button type="button" onClick={onMakeReel}
          style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${accent}55`, color: accent, fontSize: 11.5, fontWeight: 800, borderRadius: 99, padding: '8px 14px', minHeight: 44, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clapperboard size={12} /> これで台本
        </button>
      </div>
    </div>
  );
}

/** 台本を「撮影者・編集者にそのまま渡せる」プレーンテキストに整形（手入力ゼロ） */
function buildScriptText(reel: ReelScriptResult, theme: string): string {
  const lines: string[] = [];
  lines.push(`【リール台本】${reel.title}`);
  lines.push(`テーマ: ${theme}`);
  lines.push('');
  reel.scenes.forEach((sc) => {
    lines.push(`■ シーン${sc.index}（${sc.duration}秒）`);
    if (sc.shot) lines.push(`撮り方: ${sc.shot}`);
    lines.push(`字幕: ${sc.caption}`);
    if (sc.narration) lines.push(`読み: ${sc.narration}`);
    lines.push('');
  });
  if (reel.cta) lines.push(`締め: ${reel.cta}`);
  if (reel.caption) { lines.push(''); lines.push('― 投稿本文 ―'); lines.push(reel.caption); }
  if (reel.hashtags && reel.hashtags.length) {
    lines.push('');
    lines.push(reel.hashtags.map((h) => (h.startsWith('#') ? h : '#' + h)).join(' '));
  }
  return lines.join('\n').trim();
}

function ReelScriptCard({ reel, theme, accent, bg, onRegenerate, onOpenStudio }: {
  reel: ReelScriptResult; theme: string; accent: string; bg: IrisBackgroundDef; onRegenerate: () => void; onOpenStudio: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const handleCopy = async () => {
    const ok = await copyText(buildScriptText(reel, theme));
    if (ok) {
      setCopied(true); setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2600);
    }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 4 }}>
      <div style={{ fontSize: 11, color: bg.inkSoft, marginBottom: 6 }}>テーマ: {theme}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: bg.ink, lineHeight: 1.4, marginBottom: 10 }}>
        {reel.title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {reel.scenes.map((sc) => (
          <div key={sc.index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, background: `${accent}1A`, color: accent, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{sc.index}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: bg.ink, lineHeight: 1.45 }}>{sc.caption}</div>
              {sc.narration && <div style={{ fontSize: 11, color: bg.inkSoft, lineHeight: 1.5, marginTop: 1 }}>{sc.narration}</div>}
              {sc.shot && (
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 4, fontSize: 11, color: accent, lineHeight: 1.5 }}>
                  <Camera size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{sc.shot}</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: 10, color: bg.inkSoft, display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}><Clock size={10} />{sc.duration}s</span>
          </div>
        ))}
      </div>
      {reel.cta && (
        <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: accent }}>締め: {reel.cta}</div>
      )}
      {reel.hashtags && reel.hashtags.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {reel.hashtags.slice(0, 10).map((h, i) => (
            <span key={i} style={{ fontSize: 10.5, color: bg.inkSoft, background: `${bg.accent}10`, borderRadius: 6, padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <Hash size={9} />{h.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}
      <button type="button" onClick={handleCopy}
        style={{ width: '100%', minHeight: 44, marginTop: 12, background: copied ? `${accent}12` : 'transparent', border: `1px solid ${copied ? accent : bg.cardBorder}`, color: copied ? accent : bg.inkSoft, fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .18s ease' }}>
        {copied ? <><Check size={13} /> コピーしました</> : <><Copy size={13} /> 台本をコピー（撮影者にそのまま渡せる）</>}
      </button>
      {copyFailed && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#9B1B30', lineHeight: 1.5 }}>
          コピーできませんでした。台本を長押しして選択→コピーしてください。
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={onRegenerate}
          style={{ flex: 1, minHeight: 44, background: 'transparent', border: `1px solid ${bg.cardBorder}`, color: bg.ink, fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <RefreshCw size={13} /> 別案
        </button>
        <button type="button" onClick={onOpenStudio}
          style={{ flex: 2, minHeight: 44, background: `linear-gradient(135deg, ${accent}, #F77737)`, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Clapperboard size={14} /> 動画にして仕上げる <ArrowRight size={13} />
        </button>
      </div>
    </motion.div>
  );
}

/** 生成待ちの表示。phases を渡すと「AIが今やっていること」を1行ずつ流し、待ち時間を短く感じさせる */
function InlineLoading({ text, bg, phases }: { text: string; bg: IrisBackgroundDef; phases?: string[] }) {
  const [idx, setIdx] = useState(0);
  const count = phases?.length ?? 0;
  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % count), 1800);
    return () => window.clearInterval(id);
  }, [count]);
  const line = count > 0 ? phases![idx % count] : text;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: bg.inkSoft, fontSize: 12.5 }}>
      <Loader2 size={15} className="iris-spin" style={{ flexShrink: 0 }} />
      <motion.span key={line} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {line}
      </motion.span>
    </div>
  );
}

function InlineError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div style={{ marginTop: 12, background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, color: '#9B1B30', lineHeight: 1.5 }}>{text}</div>
      <button type="button" onClick={onRetry}
        style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(200,16,46,0.3)', color: '#9B1B30', fontSize: 11.5, fontWeight: 800, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <RefreshCw size={12} /> 再試行
      </button>
    </div>
  );
}
