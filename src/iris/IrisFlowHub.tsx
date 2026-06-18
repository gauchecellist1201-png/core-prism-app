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
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Sparkles, Clapperboard, Mail, CheckCircle2, ArrowRight,
  Loader2, TrendingUp, RefreshCw, ChevronRight, Hash, Clock,
} from 'lucide-react';
import type { IgProfile } from './instagramConnect';
import { useIgStrategy, type StrategyItem } from './useIgStrategy';
import { useIgAnalysis } from './useIgAnalysis';
import { generateReelScript, type ReelScriptResult } from './reelAiScript';
import { getAllBrandDeals, CATEGORY_META, type BrandDeal } from './brandDeals';
import IrisReelComposer from './IrisReelComposer';
import type { ComposeContext } from './reelAiCaption';
import type { IrisBackgroundDef } from './irisStyle';
import type { AppSettings } from '../types/identity';

interface Props {
  bg: IrisBackgroundDef;
  igProfile: IgProfile;
  settings: AppSettings;
  onNavigate: (tab: string) => void;
  /** リールスタジオを開く（生成済みテーマを引き継ぐ） */
  onOpenReelStudio: (theme: string) => void;
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

export default function IrisFlowHub({ bg, igProfile, settings, onNavigate, onOpenReelStudio }: Props) {
  const accent = '#E1306C';
  const { data: strategy, loading: stratLoading, error: stratError, refresh } = useIgStrategy(igProfile);
  // 連携後の自動分析（永続化）
  const { data: analysis, loading: anaLoading, error: anaError, refresh: refreshAna } = useIgAnalysis(igProfile, settings);

  // 今日のリール台本（戦略テーマから その場生成）
  const [reelMode, setReelMode] = useState<'script' | 'clips'>('script');
  const [reelTheme, setReelTheme] = useState<string>('');
  const [reel, setReel] = useState<ReelScriptResult | null>(null);
  const [reelLoading, setReelLoading] = useState(false);
  const [reelError, setReelError] = useState<string | null>(null);

  const matchedDeals = useMemo(() => matchDealsForProfile(igProfile), [igProfile]);

  const defaultTheme =
    strategy?.contentTheme || analysis?.next30Days?.week1?.theme || strategy?.strategies?.[0]?.action || strategy?.strategies?.[0]?.title || '';

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
  };
  const stepDoneColor = '#10B981';

  // ステップレール（連携✓ → 戦略 → リール → 案件）
  const steps = [
    { key: 'connect', label: '連携', done: true },
    { key: 'strategy', label: '戦略', done: !!strategy },
    { key: 'reel', label: 'リール', done: !!reel },
    { key: 'earn', label: '稼ぐ', done: false },
  ];

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* ヘッダ + ステップレール */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10.5, letterSpacing: '0.18em', fontWeight: 800, color: accent,
          }}>
            <Sparkles size={13} /> あなたの運用プラン
          </div>
          <h2 style={{ margin: '4px 0 0', fontSize: '1.15rem', fontWeight: 800, color: bg.ink, lineHeight: 1.35 }}>
            連携から、稼ぐまで一気通貫で
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        {steps.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: s.done ? stepDoneColor : `${accent}1A`,
                border: s.done ? 'none' : `1.5px solid ${accent}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: s.done ? '#fff' : accent, fontSize: 11, fontWeight: 800,
              }}>
                {s.done ? <CheckCircle2 size={15} /> : i + 1}
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: s.done ? stepDoneColor : bg.inkSoft }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ height: 2, flex: 1, background: steps[i + 1].done || s.done ? `${stepDoneColor}66` : `${accent}22`, marginBottom: 16 }} />
            )}
          </div>
        ))}
      </div>

      {/* ① 分析サマリ（連携後に自動実行） */}
      <div style={card}>
        <SectionLabel Icon={BarChart3} color={accent} title="① いまのあなた（自動分析）" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <Stat label="フォロワー" value={fmtNum(igProfile.followers)} bg={bg} />
          {analysis ? (
            <Stat label="総合スコア" value={`${analysis.totalScore}`} bg={bg} />
          ) : igProfile.engagementRate != null ? (
            <Stat label="エンゲージ率" value={`${igProfile.engagementRate}%`} bg={bg} />
          ) : null}
          {igProfile.bestPostTime && <Stat label="伸びる時間" value={igProfile.bestPostTime} bg={bg} />}
        </div>
        {anaLoading && <InlineLoading text="Iris があなたを分析しています…" bg={bg} />}
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
      <div style={card}>
        <SectionLabel Icon={TrendingUp} color={accent} title="② 今週やること（戦略）" />
        {stratLoading && <InlineLoading text="戦略を立てています…" bg={bg} />}
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
      <div style={{ ...card, border: `1.5px solid ${accent}55`, background: `linear-gradient(180deg, ${accent}0D, ${bg.card})` }}>
        <SectionLabel Icon={Clapperboard} color={accent} title="③ 今日のリール" />
        {/* モード切替: テーマから台本 / 素材から構成 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: `${accent}10`, borderRadius: 12, padding: 4, margin: '10px 0 12px' }}>
          {([['script', '戦略から台本'], ['clips', '素材から構成']] as const).map(([k, label]) => (
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

        {reelMode === 'clips' ? (
          <IrisReelComposer bg={bg} accent={accent} context={composeContext} />
        ) : (
        <>
        <p style={{ margin: '0 0 10px', fontSize: 12, color: bg.inkSoft, lineHeight: 1.6 }}>
          戦略のテーマから、Iris が今すぐ台本（フック→本編→締め）を書きます。
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
        {reelLoading && <InlineLoading text="台本を書いています…（フック・3シーン・ハッシュタグ）" bg={bg} />}
        {reelError && <InlineError text={reelError} onRetry={() => makeReel(reelTheme || defaultTheme)} />}
        {reel && (
          <ReelScriptCard reel={reel} theme={reelTheme} accent={accent} bg={bg}
            onRegenerate={() => makeReel(reelTheme || defaultTheme)}
            onOpenStudio={() => onOpenReelStudio(reelTheme || defaultTheme)}
          />
        )}
        </>
        )}
      </div>

      {/* ④ あなた向け案件（プロフィール連動マッチ） */}
      <div style={card}>
        <SectionLabel Icon={Mail} color={accent} title="④ あなた向けの案件" />
        {matchedDeals.length === 0 ? (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
            ジャンルを登録すると、相性の良い案件が出ます。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {matchedDeals.map(({ deal, reason }) => (
              <button key={deal.id} type="button" onClick={() => onNavigate('deals')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 14,
                  padding: '10px 12px', cursor: 'pointer', width: '100%',
                }}>
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
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: accent }}>¥{fmtNum(deal.fee)}</div>
                  <ChevronRight size={15} color={bg.inkSoft} style={{ marginLeft: 'auto' }} />
                </div>
              </button>
            ))}
            <button type="button" onClick={() => onNavigate('deals')}
              style={{
                marginTop: 2, background: 'transparent', border: 'none', color: accent,
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

function Stat({ label, value, bg }: { label: string; value: string; bg: IrisBackgroundDef }) {
  return (
    <div style={{ flex: '1 1 30%', minWidth: 88, background: `${bg.accent}0D`, borderRadius: 12, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: bg.inkSoft, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: bg.ink, marginTop: 1 }}>{value}</div>
    </div>
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
          style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${accent}55`, color: accent, fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '4px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Clapperboard size={12} /> これで台本
        </button>
      </div>
    </div>
  );
}

function ReelScriptCard({ reel, theme, accent, bg, onRegenerate, onOpenStudio }: {
  reel: ReelScriptResult; theme: string; accent: string; bg: IrisBackgroundDef; onRegenerate: () => void; onOpenStudio: () => void;
}) {
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
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onRegenerate}
          style={{ flex: 1, background: 'transparent', border: `1px solid ${bg.cardBorder}`, color: bg.ink, fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <RefreshCw size={13} /> 別案
        </button>
        <button type="button" onClick={onOpenStudio}
          style={{ flex: 2, background: `linear-gradient(135deg, ${accent}, #F77737)`, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, borderRadius: 12, padding: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Clapperboard size={14} /> 動画にして仕上げる <ArrowRight size={13} />
        </button>
      </div>
    </motion.div>
  );
}

function InlineLoading({ text, bg }: { text: string; bg: IrisBackgroundDef }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: bg.inkSoft, fontSize: 12.5 }}>
      <Loader2 size={15} className="iris-spin" /> {text}
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
