// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IrisMorningBrief — Iris 用「朝のブリーフ」3 カード
//   - フォロワー伸び (前日差)
//   - 案件 DM 件数 (本日の応募候補数)
//   - 今日投稿すべき時間帯 (igProfile.bestPostTime)
//
//   表示ルール:
//   - 1 日 1 回 まで (localStorage `core_iris_brief_shown:<personaId>:<YYYY-MM-DD>`)
//   - フォロワー履歴は毎日 1 回スナップショット保存
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, MessageCircle, Clock, X, Sparkles, ArrowRight } from 'lucide-react';
import type { IgProfile } from './instagramConnect';
import { getAllBrandDeals } from './brandDeals';
import { IRIS_COLORS } from './irisStyle';
import { getActiveAccount } from './multiAccount';

const HISTORY_KEY_BASE = 'core_iris_follower_history_v1';
const SHOWN_KEY_BASE = 'core_iris_brief_shown';

/** ペルソナ間文脈隔離 — multi-account 切替 で混ざらないようキーを scope する。 */
function scopedKey(base: string, personaId: string): string {
  const acctId = (() => { try { return getActiveAccount()?.id || 'default'; } catch { return 'default'; } })();
  return `${base}:${personaId}:${acctId}`;
}

type FollowerHistoryEntry = { date: string; followers: number };

function loadHistory(personaId: string): FollowerHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(scopedKey(HISTORY_KEY_BASE, personaId)) || '[]'); } catch { return []; }
}

function saveHistory(personaId: string, h: FollowerHistoryEntry[]) {
  try { localStorage.setItem(scopedKey(HISTORY_KEY_BASE, personaId), JSON.stringify(h.slice(-30))); } catch { /* */ }
}

/** 今日の日付 (YYYY-MM-DD JST 想定) */
function today() { return new Date().toISOString().slice(0, 10); }

/** 前日比のフォロワー差を返す。前日データがなければ null。 */
function getFollowerDelta(personaId: string, currentFollowers: number): {
  delta: number | null;
  pctText: string;
  yesterdayFollowers: number | null;
} {
  const h = loadHistory(personaId);
  const todayStr = today();
  const todayEntry = h.find(e => e.date === todayStr);
  // 今日のスナップショットが無ければ今追加
  if (!todayEntry) {
    const next = [...h, { date: todayStr, followers: currentFollowers }];
    saveHistory(personaId, next);
  }
  // 前日のエントリ
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ye = h.find(e => e.date === yesterday);
  if (!ye) return { delta: null, pctText: '昨日比 計測開始', yesterdayFollowers: null };
  const delta = currentFollowers - ye.followers;
  const pct = ye.followers > 0 ? (delta / ye.followers) * 100 : 0;
  const sign = delta >= 0 ? '+' : '';
  return {
    delta,
    pctText: `${sign}${delta.toLocaleString()} 人 (${sign}${pct.toFixed(2)}%)`,
    yesterdayFollowers: ye.followers,
  };
}

/** 「いま応募可能な案件 = DM 候補」をフォロワー帯でフィルタ */
function countMatchingDeals(followers: number): { total: number; topNames: string[] } {
  const deals = getAllBrandDeals().filter(d => {
    if (followers < d.minFollowers) return false;
    if (d.maxFollowers && followers > d.maxFollowers) return false;
    return true;
  });
  return {
    total: deals.length,
    topNames: deals.slice(0, 3).map(d => d.brandName),
  };
}

type Props = {
  personaId: string;
  personaName: string;
  igProfile: IgProfile | null;
  /** mobile=コンパクト, desktop=フルワイド */
  variant?: 'mobile' | 'desktop';
  /** 強制表示 (今日表示済みでも再表示する開発者用) */
  force?: boolean;
  /** 「今日の一手」タップ時の遷移。未指定なら一手カードは出さない。 */
  onAction?: (tab: string) => void;
};

/** その日の最優先アクション 1 つを、表示データから決める。
 *  応募できる案件があれば最優先 (直接の収益)、次にベストタイム投稿、次に投稿作成。 */
function pickOneMove(
  dealCount: number, topNames: string[], bestPostTime: string | null,
): { tab: string; label: string; cta: string; detail: string } {
  if (dealCount > 0) {
    const who = topNames.length ? `${topNames[0]} など` : 'あなたに合う案件';
    return {
      tab: 'deals',
      label: '今日の一手',
      cta: '案件を見て1件応募する',
      detail: `${who}に今日1件だけ応募しましょう。最初の1通が仕事につながります。`,
    };
  }
  if (bestPostTime) {
    return {
      tab: 'reel',
      label: '今日の一手',
      cta: 'リールを1本つくる',
      detail: `今日のベストタイム ${bestPostTime} に向けて、リールを1本仕上げましょう。`,
    };
  }
  return {
    tab: 'draft',
    label: '今日の一手',
    cta: '投稿を1つ書く',
    detail: '今日の投稿を1つ作って、止めずに発信を続けましょう。',
  };
}

export default function IrisMorningBrief({
  personaId, personaName, igProfile, variant = 'desktop', force = false, onAction,
}: Props) {
  const [visible, setVisible] = useState(false);

  // 表示判定
  useEffect(() => {
    if (force) { setVisible(true); return; }
    if (!igProfile) { setVisible(false); return; } // IG 未接続なら出さない
    const key = `${scopedKey(SHOWN_KEY_BASE, personaId)}:${today()}`;
    const alreadyShown = localStorage.getItem(key) === '1';
    if (alreadyShown) { setVisible(false); return; }
    setVisible(true);
    try { localStorage.setItem(key, '1'); } catch { /* */ }
  }, [personaId, igProfile, force]);

  const cards = useMemo(() => {
    if (!igProfile) return null;
    const followers = igProfile.followers || 0;
    const { pctText, delta } = getFollowerDelta(personaId, followers);
    const deltaPositive = (delta ?? 0) >= 0;
    const { total: dealCount, topNames } = countMatchingDeals(followers);
    return [
      {
        icon: TrendingUp,
        label: 'フォロワー',
        primary: followers.toLocaleString(),
        secondary: pctText,
        secondaryColor: deltaPositive ? '#22c55e' : '#ef4444',
        accent: IRIS_COLORS.gold,
        hint: `現在: ${followers.toLocaleString()} 人`,
      },
      {
        icon: MessageCircle,
        label: '応募できる案件',
        primary: `${dealCount} 件`,
        secondary: topNames.length ? `${topNames.slice(0, 2).join(' / ')} 等` : '—',
        secondaryColor: 'rgba(255,255,255,0.7)',
        accent: IRIS_COLORS.hotPink,
        hint: 'あなたのフォロワー帯にマッチ',
      },
      {
        icon: Clock,
        label: '今日の最適投稿時間',
        primary: igProfile.bestPostTime || '—',
        secondary: igProfile.bestPostTime
          ? `保存率 ${(igProfile.saveRate || 0).toFixed(1)}% / 反応率最大`
          : 'IG 連携で算出',
        secondaryColor: 'rgba(255,255,255,0.7)',
        accent: IRIS_COLORS.purpleLt,
        hint: '上位投稿の平均時間帯',
      },
    ];
  }, [igProfile]);

  const oneMove = useMemo(() => {
    if (!igProfile || !onAction) return null;
    const followers = igProfile.followers || 0;
    const { total, topNames } = countMatchingDeals(followers);
    return pickOneMove(total, topNames, igProfile.bestPostTime || null);
  }, [igProfile, onAction]);

  if (!visible || !cards) return null;

  const hour = new Date().getHours();
  const greet = hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
  const isMobile = variant === 'mobile';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35 }}
        style={{
          background: `linear-gradient(135deg, ${IRIS_COLORS.purpleDeep}25 0%, ${IRIS_COLORS.inkBlack} 100%)`,
          border: `1px solid ${IRIS_COLORS.gold}33`,
          borderRadius: 16,
          padding: isMobile ? '0.9rem 0.85rem' : '1.25rem 1.5rem',
          margin: isMobile ? '0.5rem 0.75rem' : '1rem 0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 閉じるボタン */}
        <button
          aria-label="ブリーフを閉じる"
          onClick={() => setVisible(false)}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 26, height: 26, borderRadius: 13,
            border: 'none',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>

        <div style={{ marginBottom: isMobile ? 10 : 14 }}>
          <p style={{
            fontSize: '0.62rem',
            letterSpacing: '0.3em',
            color: IRIS_COLORS.gold,
            fontWeight: 700,
            marginBottom: 4,
          }}>
            MORNING BRIEF
          </p>
          <h3 style={{
            fontSize: isMobile ? '0.95rem' : '1.1rem',
            fontWeight: 700,
            color: IRIS_COLORS.cream,
            margin: 0,
          }}>
            {greet}、{personaName} さん。
          </h3>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 8 : 12,
        }}>
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${c.accent}22`,
                  borderRadius: 12,
                  padding: isMobile ? '0.7rem 0.85rem' : '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${c.accent}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={18} color={c.accent} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 2 }}>
                    {c.label}
                  </div>
                  <div style={{
                    fontSize: isMobile ? '1.1rem' : '1.2rem',
                    fontWeight: 700,
                    color: IRIS_COLORS.cream,
                    lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.primary}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: c.secondaryColor,
                    fontWeight: 600,
                    marginTop: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.secondary}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── 今日の一手 ── タップで該当画面へ ──────────────── */}
        {oneMove && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            onClick={() => { setVisible(false); onAction?.(oneMove.tab); }}
            style={{
              width: '100%',
              marginTop: isMobile ? 10 : 12,
              textAlign: 'left',
              cursor: 'pointer',
              border: `1px solid ${IRIS_COLORS.gold}55`,
              borderRadius: 12,
              padding: isMobile ? '0.8rem 0.9rem' : '0.9rem 1.1rem',
              background: `linear-gradient(135deg, ${IRIS_COLORS.gold}1f 0%, ${IRIS_COLORS.hotPink}14 100%)`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${IRIS_COLORS.gold}26`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={18} color={IRIS_COLORS.gold} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.6rem', letterSpacing: '0.18em',
                color: IRIS_COLORS.gold, fontWeight: 700, marginBottom: 3,
              }}>
                {oneMove.label.toUpperCase() === oneMove.label ? oneMove.label : '今日の一手'}
              </div>
              <div style={{
                fontSize: isMobile ? '0.92rem' : '1rem',
                fontWeight: 700, color: IRIS_COLORS.cream, lineHeight: 1.25,
                marginBottom: 2,
              }}>
                {oneMove.cta}
              </div>
              <div style={{
                fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)',
                fontWeight: 500, lineHeight: 1.35,
              }}>
                {oneMove.detail}
              </div>
            </div>
            <ArrowRight size={18} color={IRIS_COLORS.gold} style={{ flexShrink: 0 }} />
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
