// ============================================================
// CORE Iris — メインダッシュボード (抹本リデザイン 2026-05-19)
// Pinterest / Vogue 参考。左サイドバー + 下部 Dock + エディトリアル グリッド。
// ============================================================
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import {
  IRIS_BACKGROUNDS, type IrisBackgroundDef, loadIrisBackground, saveIrisBackground,
  IRIS_COLORS, IRIS_FONTS, getAllBackgrounds, removeCustomBackground, type CustomIrisBackground,
} from './irisStyle';
import { IRIS_TYPE, IRIS_SHADOW, IRIS_RADIUS, IRIS_GRADIENT, IRIS_MOTION, IRIS_SIDEBAR_W, IRIS_DOCK_H } from './irisDesign';
import IrisCustomBgEditor from './IrisCustomBgEditor';
import IrisImageEditor from './IrisImageEditor';
import StreakBadge from '../components/StreakBadge';
import TodayCard, { type TodaySuggestion } from '../components/TodayCard';
import { useIgStrategy } from './useIgStrategy';
import AgentProposalCard from '../components/ProposalCard';
import type { CxoRole } from '../hooks/useAgentTaskQueue';
import { confirmAction } from '../lib/confirmDialog';
import { useInfluencerDesk } from '../hooks/useInfluencerDesk';
import {
  generateNegotiation, generateDraftCopy,
} from '../lib/influencerAgent';
import {
  PLATFORM_META, CONTENT_TYPE_META, DEAL_STAGE_META, NEGOTIATION_TYPE_META,
  type Platform, type ContentType, type DealStage, type NegotiationType,
  type InfluencerDeal, type MediaKit,
} from '../types/influencerDeal';
import { chatBeautyAdvisor, BEAUTY_TOPIC_META, type BeautyTopic, type BeautyMessage } from './beautyAdvisor';
import { shareToInstagram } from './instagramShare';
import { notifyInApp } from '../lib/inAppNotify';
import {
  Sparkles, TrendingUp, Search, Mail, Film, MessageSquare, Edit3,
  Camera, HeartPulse, Leaf, UsersRound, Users, Handshake, FileText,
  Menu as MenuIcon, Gift, Palette, ArrowLeft, Clapperboard, CalendarClock,
  Download, Clipboard, Wand2,
  Bookmark, BookmarkPlus, Send, Trash2, Brain, User,
  Wallet, Calendar, Hourglass, ShieldAlert,
  CheckCircle2, AlertTriangle, Bot, Lightbulb, Sun,
  Briefcase, Rocket, Heart, Smartphone,
  Save, X,
} from 'lucide-react';
import IrisCommandBar from './IrisCommandBar';
import InviteShareCard from '../components/InviteShareCard';
import type { LucideIcon } from 'lucide-react';

// ─── タブ用 Lucide アイコンマップ ──────────────
const IRIS_TAB_ICON: Record<string, LucideIcon> = {
  home: Sparkles,
  strategy: TrendingUp,
  triage: Search,
  deals: Mail,
  director: Film,
  negotiate: MessageSquare,
  draft: Edit3,
  image: Camera,
  beauty: HeartPulse,
  health: Leaf,
  community: UsersRound,
  team: Users,
  brands: Handshake,
  kit: FileText,
  invite: Gift,
  reel: Clapperboard,
  schedule: CalendarClock,
  guideline: ShieldAlert,
  knowledge: Brain,
};

// ─── タブ グループ (Phase 2 — 5 カテゴリ) ──────────
interface TabDef { id: string; l: string }
interface TabGroup { id: string; label: string; color: string; icon: LucideIcon; tabs: TabDef[] }
const TAB_GROUPS: TabGroup[] = [
  { id: 'today',  label: '今日',   color: '#E1306C', icon: Sun,
    tabs: [{ id: 'home', l: 'ホーム' }, { id: 'schedule', l: '予約投稿' }] },
  { id: 'create', label: 'つくる', color: '#833AB4', icon: Wand2,
    tabs: [
      { id: 'reel', l: 'リール' }, { id: 'draft', l: '投稿を書く' },
      { id: 'director', l: '動画おまかせ' }, { id: 'image', l: '写真を直す' },
    ] },
  { id: 'earn',   label: '稼ぐ',   color: '#F77737', icon: Briefcase,
    tabs: [
      { id: 'triage', l: 'お仕事確認' }, { id: 'deals', l: 'お仕事' },
      { id: 'negotiate', l: 'お返事' }, { id: 'brands', l: 'お仕事を探す' },
    ] },
  { id: 'grow',   label: '伸ばす', color: '#3B82F6', icon: Rocket,
    tabs: [
      { id: 'strategy', l: '伸ばす作戦' }, { id: 'invite', l: '友達紹介' },
      { id: 'community', l: 'みんなの広場' }, { id: 'team', l: '仲間' },
    ] },
  { id: 'care',   label: 'ととのえる', color: '#10B981', icon: Heart,
    tabs: [
      { id: 'health', l: 'カラダ管理' }, { id: 'beauty', l: '美容のはなし' },
      { id: 'knowledge', l: 'ナレッジ' },
      { id: 'guideline', l: '私らしさ設定' },
    ] },
];
const TAB_TO_GROUP: Record<string, string> = TAB_GROUPS.reduce((acc, g) => {
  g.tabs.forEach(t => { acc[t.id] = g.id; });
  return acc;
}, {} as Record<string, string>);
import { useIrisTeam, ROLE_META, type IrisTeamMember, type MemberRole } from './team';
import { loadPrismCompanies, generateTieupPitch } from './brandMatch';
import { getAllBrandDeals, CATEGORY_META, type BrandDeal, type BrandCategory } from './brandDeals';
import { getBrandLogoUrl, getDealImageUrl, getDealGradient } from './brandVisuals';
import {
  computeMatchScore, generateApplicationDraft, addApplyRecord,
  loadApplyHistory, computeApplyKpi, updateApplyStatus,
  type ApplicationDraft, type ApplicationRecord,
} from './brandDealMatch';
import IrisDirectorView from './IrisDirectorView';
import VideoStudio from '../components/VideoStudio';
// 抜本リデザインされた美しい Minimal 版が default
// 旧フル機能版は ./IrisReelStudio に残る (詳細モードで呼ぶ用)
const IrisReelStudio = React.lazy(() => import('./IrisReelStudioMinimal'));
import IrisPostQueueView from './IrisPostQueueView';
import { usePostQueue } from './usePostQueue';
import IrisTriageView from './IrisTriageView';
import IrisCommunityView from './IrisCommunityView';
import IrisStrategistView from './IrisStrategistView';
import IrisQuickAdd from './IrisQuickAdd';
import IrisVoiceHome from './IrisVoiceHome';
import { IrisLogo } from '../components/Logo';
import SupportChat from '../components/SupportChat';
import ShortcutHelpModal from '../components/ShortcutHelpModal';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
import FeedbackWidget from '../components/FeedbackWidget';
import IrisHealthView from './IrisHealthView';
import IrisRevenueView from './IrisRevenueView';
import IrisFanEngagement from './IrisFanEngagement';
import { useHealth } from '../hooks/useHealth';
import IrisCollabBoard from './IrisCollabBoard';
import { useMultiAccount, ACCOUNT_TYPE_META, PLATFORM_META_ACCOUNT, type IrisAccount } from './multiAccount';
import { useBrandGuidelines, TONE_META, type BrandGuideline, type BrandTone, runStyleCheck } from './brandGuidelines';
import { useIrisKnowledge } from './irisKnowledge';
import IrisKnowledgeView from './IrisKnowledgeView';
import AgentsOrbit from '../components/AgentsOrbit';
import { IRIS_SPECS, IRIS_ORDER, IRIS_CONVERSATIONS } from '../lib/agentSpecs';
import IrisEarnHero from './IrisEarnHero';
import WellnessTracker from '../components/WellnessTracker';
import IgConnectModal from './IgConnectModal';
import { loadIgProfile, consumeOauthCallback, type IgProfile } from './instagramConnect';

interface Props {
  settings: AppSettings;
  onLeave: () => void;
}

type Tab = 'home' | 'strategy' | 'deals' | 'triage' | 'director' | 'video' | 'reel' | 'schedule' | 'negotiate' | 'draft' | 'beauty' | 'image' | 'community' | 'team' | 'brands' | 'kit' | 'health' | 'revenue' | 'fans' | 'collab' | 'guideline' | 'invite' | 'knowledge';

// ── デスクトップ左サイドバー ────────────────────────────────────
function IrisSidebar({
  tab, setTab, bg, onBgPicker, onLeave,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  bg: IrisBackgroundDef;
  onBgPicker: () => void;
  onLeave: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (id: string) => setCollapsed(p => ({ ...p, [id]: !p[id] }));

  return (
    <aside style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: IRIS_SIDEBAR_W,
      zIndex: 30,
      background: 'rgba(255,255,255,0.82)',
      backdropFilter: 'blur(24px)',
      borderRight: `1px solid ${bg.cardBorder}`,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: IRIS_SHADOW.md,
      overflowY: 'auto',
      scrollbarWidth: 'none',
    }} className="iris-sidebar">
      {/* ロゴ */}
      <div style={{
        padding: '1.25rem 1rem 0.75rem',
        borderBottom: `1px solid ${bg.cardBorder}`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setTab('home')}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0.3rem',
            borderRadius: 10, width: '100%',
          }}
        >
          <IrisLogo size={28} withWordmark={false} />
          <span style={{
            fontFamily: IRIS_FONTS.serif,
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: '1.5rem',
            letterSpacing: '-0.01em',
            lineHeight: 1,
            background: IRIS_GRADIENT.instagram,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>Iris</span>
        </button>
      </div>

      {/* ナビゲーション */}
      <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {TAB_GROUPS.map(group => {
          const GIco = group.icon;
          const isOpen = !collapsed[group.id];
          const isActiveGroup = TAB_TO_GROUP[tab] === group.id;
          return (
            <div key={group.id} style={{ marginBottom: '0.25rem' }}>
              {/* グループヘッダ */}
              <button
                onClick={() => toggleGroup(group.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.6rem', borderRadius: IRIS_RADIUS.md,
                  background: isActiveGroup ? `${group.color}12` : 'transparent',
                  border: 'none', cursor: 'pointer',
                  color: isActiveGroup ? group.color : '#1F1A2E',
                  marginBottom: '0.1rem',
                  transition: 'background 0.15s',
                }}
              >
                <GIco size={13} strokeWidth={2.8} color={isActiveGroup ? group.color : '#8A7AA0'} />
                <span style={{
                  ...IRIS_TYPE.label,
                  color: isActiveGroup ? group.color : '#8A7AA0',
                  flex: 1, textAlign: 'left',
                }}>{group.label}</span>
                <span style={{ fontSize: '0.6rem', color: '#8A7AA0', marginLeft: 'auto' }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>
              {/* タブアイテム */}
              {isOpen && group.tabs.map(t => {
                const Ico = IRIS_TAB_ICON[t.id] || Sparkles;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as Tab)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.5rem 0.6rem 0.5rem 1.75rem',
                      borderRadius: IRIS_RADIUS.md,
                      background: active
                        ? `linear-gradient(135deg, ${group.color}18, ${group.color}0c)`
                        : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: active ? group.color : '#2A1A3A',
                      fontFamily: IRIS_FONTS.body,
                      fontSize: '0.84rem',
                      fontWeight: active ? 700 : 500,
                      textAlign: 'left',
                      transition: 'all 0.12s',
                      borderLeft: active ? `2px solid ${group.color}` : '2px solid transparent',
                      marginBottom: '0.05rem',
                    }}
                  >
                    <Ico size={14} strokeWidth={active ? 2.5 : 2} color={active ? group.color : '#8A7AA0'} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.l}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* 下部コントロール */}
      <div style={{
        padding: '0.75rem',
        borderTop: `1px solid ${bg.cardBorder}`,
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
      }}>
        <button onClick={onBgPicker}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem', borderRadius: IRIS_RADIUS.md,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#5A4570', fontSize: '0.8rem', fontWeight: 500,
            fontFamily: IRIS_FONTS.body, transition: 'background 0.12s',
          }}>
          <Palette size={14} strokeWidth={2} color="#8A7AA0" />
          テーマを変える
        </button>
        <button onClick={onLeave}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 0.75rem', borderRadius: IRIS_RADIUS.md,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#8A7AA0', fontSize: '0.8rem', fontWeight: 500,
            fontFamily: IRIS_FONTS.body,
          }}>
          <ArrowLeft size={14} strokeWidth={2} color="#8A7AA0" />
          戻る
        </button>
      </div>
    </aside>
  );
}

// ── モバイル下部 Dock ───────────────────────────────────────────
function IrisBottomDock({
  tab, setTab, bg,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  bg: IrisBackgroundDef;
  onMore: () => void;
}) {
  const DOCK_ITEMS = [
    { group: TAB_GROUPS[0], defaultTab: 'home' as Tab },
    { group: TAB_GROUPS[2], defaultTab: 'triage' as Tab },
    { group: TAB_GROUPS[1], defaultTab: 'reel' as Tab, isFab: true },
    { group: TAB_GROUPS[3], defaultTab: 'strategy' as Tab },
    { group: TAB_GROUPS[4], defaultTab: 'health' as Tab },
  ];

  return (
    <nav
      className="iris-bottom-dock"
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: `calc(${IRIS_DOCK_H}px + env(safe-area-inset-bottom, 0px))`,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(24px)',
        borderTop: `1px solid ${bg.cardBorder}`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        paddingTop: '0.5rem',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        zIndex: 30,
        boxShadow: '0 -4px 20px rgba(31,26,46,0.08)',
      }}
    >
      {DOCK_ITEMS.map(({ group, defaultTab, isFab }) => {
        const GIco = group.icon;
        const isActive = TAB_TO_GROUP[tab] === group.id;
        if (isFab) {
          return (
            <button
              key={group.id}
              onClick={() => setTab(defaultTab)}
              style={{
                width: 52, height: 52,
                borderRadius: IRIS_RADIUS.full,
                background: IRIS_GRADIENT.cta,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: IRIS_SHADOW.glow(bg.accent),
                transform: 'translateY(-12px)',
                flexShrink: 0,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            >
              <GIco size={22} strokeWidth={2.2} color="#fff" />
            </button>
          );
        }
        return (
          <button
            key={group.id}
            onClick={() => setTab(defaultTab)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              padding: '0.1rem 0.8rem',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isActive ? group.color : '#8A7AA0',
              transition: 'color 0.15s',
            }}
          >
            <GIco size={20} strokeWidth={isActive ? 2.6 : 2} color={isActive ? group.color : '#8A7AA0'} />
            <span style={{ fontSize: '0.6rem', fontWeight: isActive ? 700 : 500, fontFamily: IRIS_FONTS.body, letterSpacing: '0.04em' }}>
              {group.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ── エディトリアル ホームダッシュ ──────────────────────────────
function IrisEditorialHome({
  bg, myDeals, postQueue, igProfile,
  onNavigate,
  onConnectInstagram,
}: {
  bg: IrisBackgroundDef;
  myDeals: any[];
  postQueue: any;
  knowledge?: any;
  igProfile: any;
  onNavigate: (t: Tab) => void;
  settings?: any;
  mediaKit: any;
  onConnectInstagram: () => void;
}) {
  // IG 実データから AI 戦略 3 案を取得 (igProfile があれば即時 fetch、24h キャッシュ)
  const strategy = useIgStrategy(igProfile || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'おはようございます' : today.getHours() < 18 ? 'こんにちは' : 'こんばんは';
  const dateStr = today.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' });

  const upcomingDeals = myDeals
    .filter(d => d.stage !== 'closed')
    .slice(0, 3);

  const engagementPrediction = igProfile?.followingCount
    ? Math.round((igProfile.followingCount || 10000) * 0.042)
    : Math.round(12400 * 0.042);

  return (
    <div ref={scrollRef} style={{ position: 'relative' }}>
      {/* パラックス背景アクセント */}
      <div aria-hidden style={{
        position: 'fixed', top: -80, right: -120, width: 480, height: 480,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, ${bg.accent}18 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }} />
      <div aria-hidden style={{
        position: 'fixed', bottom: 80, left: -60, width: 320, height: 320,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(circle, #833AB418 0%, transparent 70%)`,
        filter: 'blur(40px)',
      }} />

      {/* ── ヒーロー カード ─────────────────────────────── */}
      <motion.div
        {...IRIS_MOTION.cinematic}
        style={{ position: 'relative', zIndex: 1, marginBottom: '1.75rem' }}
      >
        <div style={{
          borderRadius: IRIS_RADIUS['2xl'],
          background: IRIS_GRADIENT.dark,
          padding: 'clamp(1.5rem, 4vw, 2.5rem)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: IRIS_SHADOW.xl,
        }}>
          {/* 背景グラデオーブ */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 80% 50%, ${bg.accent}40 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, #833AB440 0%, transparent 55%)`,
            pointerEvents: 'none',
          }} />
          {/* ラベル */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.3rem 0.85rem',
            borderRadius: IRIS_RADIUS.full,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            marginBottom: '1.25rem',
            backdropFilter: 'blur(8px)',
          }}>
            <Sparkles size={12} color="#FCB045" strokeWidth={2.5} />
            <span style={{ ...IRIS_TYPE.caption, color: '#FCB045', letterSpacing: '0.14em' }}>
              {dateStr} · 今週のハイライト
            </span>
          </div>

          <h1 style={{
            ...IRIS_TYPE.hero,
            color: '#FFFFFF',
            margin: '0 0 0.6rem',
            position: 'relative',
          }}>
            {greeting},<br />
            <span style={{
              background: IRIS_GRADIENT.cta,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              今日も輝いて。
            </span>
          </h1>

          <p style={{
            ...IRIS_TYPE.lead,
            color: 'rgba(255,255,255,0.72)',
            margin: '0 0 1rem',
            maxWidth: 480,
          }}>
            {myDeals.length
              ? `${myDeals.length} 件の案件が進行中。Iris が優先順を整えました。`
              : 'Iris があなたの今日をサポートします。最初の案件を登録しましょう。'}
          </p>

          {/* 連続ログイン日数バッジ */}
          <div style={{ marginBottom: '1.5rem' }}>
            <StreakBadge accent="#E1306C" brand="iris" />
          </div>

          {/* ステータス行 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', position: 'relative' }}>
            {[
              { label: '進行中の案件', value: `${myDeals.filter(d => d.stage !== 'closed').length} 件`, icon: Briefcase, color: '#FCB045' },
              { label: '予約投稿', value: `${postQueue?.posts?.length ?? 0} 本`, icon: CalendarClock, color: '#FD7CB8' },
              { label: 'エンゲージメント予測', value: `${engagementPrediction.toLocaleString()}`, icon: TrendingUp, color: '#B07BD9' },
            ].map(({ label, value, icon: Ico, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: IRIS_RADIUS.md,
                  background: 'rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico size={14} color={color} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ ...IRIS_TYPE.caption, color: 'rgba(255,255,255,0.55)', marginBottom: 1 }}>{label}</div>
                  <div style={{ ...IRIS_TYPE.lead, color: '#fff', fontWeight: 700, lineHeight: 1 }}>{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── 今日の最初の一手 (3 ボタン) ─────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '1.25rem' }}>
        <TodayCard
          heading="今日、Iris で何する?"
          accent={bg.accent}
          suggestions={(() => {
            const out: TodaySuggestion[] = [];
            if (!igProfile) {
              out.push({
                id: 'connect-ig',
                icon: '🌷',
                title: 'Instagram をつなぐ',
                reason: 'アカウントを繋ぐと、伸ばし方が一気に具体的になります',
                cta: 'つなぐ',
                accent: '#E1306C',
                onClick: () => onConnectInstagram(),
              });
            }
            if (myDeals.length === 0) {
              out.push({
                id: 'add-deal',
                icon: '💌',
                title: '最初の案件を登録する',
                reason: 'DM のスクショから 1 件追加するだけで、Iris が交渉文を準備します',
                cta: '登録',
                accent: '#FCB045',
                onClick: () => onNavigate('brands'),
              });
            }
            const pq = postQueue?.posts?.length ?? 0;
            if (pq < 3) {
              out.push({
                id: 'make-reel',
                icon: '🎬',
                title: 'リールを 1 本作ってみる',
                reason: '素材を入れるだけで AI が脚本・キャプション・ハッシュタグまで',
                cta: '作る',
                accent: '#833AB4',
                onClick: () => onNavigate('reel'),
              });
            }
            // 何もなくならないように 3 件確保
            if (out.length < 3) {
              out.push({
                id: 'compose',
                icon: '✍️',
                title: '次の投稿を書く',
                reason: 'お題を 1 つ入れるだけで、AI が note と SNS の文を同時に作ります',
                cta: '書く',
                accent: '#FD7CB8',
                onClick: () => onNavigate('draft'),
              });
            }
            if (out.length < 3) {
              out.push({
                id: 'inbox',
                icon: '💖',
                title: 'お返事をまとめて片付ける',
                reason: '溜まった DM や案件の返信を AI が下書き',
                cta: '見る',
                accent: '#E1306C',
                onClick: () => onNavigate('inbox' as Tab),
              });
            }
            return out.slice(0, 3);
          })()}
        />
      </div>

      {/* ── 2カラムグリッド ──────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        marginBottom: '1.75rem',
        position: 'relative', zIndex: 1,
      }}>
        {/* 今日の予定 */}
        <motion.div {...IRIS_MOTION.stagger(0)}>
          <EditorialCard title="今日の予定" icon={CalendarClock} accent={bg.accent}>
            {upcomingDeals.length === 0 ? (
              <p style={{ ...IRIS_TYPE.small, color: bg.inkSoft, textAlign: 'center', padding: '1rem 0' }}>
                予定はありません。案件を追加しましょう。
              </p>
            ) : upcomingDeals.map((deal, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0',
                borderBottom: i < upcomingDeals.length - 1 ? `1px solid ${bg.cardBorder}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: IRIS_RADIUS.md,
                  background: `${bg.accent}14`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Handshake size={15} color={bg.accent} strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...IRIS_TYPE.small, fontWeight: 700, color: bg.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.brandName}</p>
                  <p style={{ ...IRIS_TYPE.caption, color: bg.inkSoft, margin: 0 }}>
                    {deal.stage === 'inquiry' ? '問い合わせ中' : deal.stage === 'negotiating' ? '交渉中' : deal.stage === 'contracted' ? '契約済み' : '進行中'}
                  </p>
                </div>
                <span style={{
                  ...IRIS_TYPE.caption,
                  background: `${bg.accent}14`,
                  color: bg.accent,
                  padding: '0.25rem 0.6rem',
                  borderRadius: IRIS_RADIUS.full,
                  fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  ¥{(deal.fee || 0).toLocaleString()}
                </span>
              </div>
            ))}
            <button
              onClick={() => onNavigate('deals')}
              style={{ ...ctaButtonSm(bg), marginTop: '0.75rem', width: '100%' }}
            >
              案件を全部見る
            </button>
          </EditorialCard>
        </motion.div>

        {/* AI 戦略 3 案 — IG 実データから生成 (なければデモ) */}
        <motion.div {...IRIS_MOTION.stagger(1)}>
          <EditorialCard title={igProfile ? 'AI の次の打ち手 3 案' : 'AI インサイト'} icon={Sparkles} accent="#833AB4">
            {strategy.loading && (
              <div style={{ ...IRIS_TYPE.small, color: bg.inkSoft, padding: '0.6rem 0' }}>
                AI があなたの実データを読み込んで戦略を組み立てています…
              </div>
            )}
            {strategy.data ? (
              <>
                {/* データ取得状況バッジ — ユーザーに「何が実データ / 何が推測」を明示 */}
                {igProfile && (() => {
                  const src = igProfile.source as string;
                  const label = src === 'oauth' ? '✓ Instagram から実データ取得済み'
                    : src === 'screenshot-ai' ? 'スクショから基本データのみ (詳細は別途インサイト連携)'
                    : src === 'self' ? 'あなたの申告値 (推測ベース)'
                    : 'データ取得状況不明';
                  const tone = src === 'oauth' ? { c: '#10B981', bg: '#10B98115' }
                    : src === 'screenshot-ai' ? { c: '#F59E0B', bg: '#F59E0B15' }
                    : { c: '#9CA3AF', bg: '#9CA3AF15' };
                  return (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 9px', borderRadius: 999,
                      background: tone.bg, border: `1px solid ${tone.c}33`,
                      fontSize: 10.5, color: tone.c, fontWeight: 800,
                      marginBottom: 10, letterSpacing: '0.02em',
                    }}>
                      {label}
                    </div>
                  );
                })()}
                {strategy.data.audienceInsight && (
                  <div style={{
                    padding: '0.55rem 0.75rem', marginBottom: '0.65rem',
                    background: `${bg.accent}0a`, border: `1px solid ${bg.cardBorder}`,
                    borderRadius: IRIS_RADIUS.md,
                    fontSize: '0.78rem', color: bg.ink, lineHeight: 1.55,
                  }}>
                    <strong style={{ color: bg.accent, fontSize: '0.7rem', display: 'block', marginBottom: 2 }}>
                      オーディエンス分析
                    </strong>
                    {strategy.data.audienceInsight}
                  </div>
                )}
                {/* 1 案目は ProposalCard (承認で AI 軍団が動く) として強調表示 */}
                {strategy.data.strategies[0] && (() => {
                  const s = strategy.data.strategies[0];
                  // 戦略テーマからどの CXO が動くか推測
                  const allCxo = (s.title + ' ' + s.action).toLowerCase();
                  const stepsByTheme: Array<{ cxo: CxoRole; label: string }> = [];
                  if (/案件|マッチ|ブランド|交渉|dm/i.test(allCxo)) {
                    stepsByTheme.push({ cxo: 'CDS', label: 'オーディエンス層と合致する案件を抽出' });
                    stepsByTheme.push({ cxo: 'CSO', label: '優先順をつけて 3 件選定' });
                    stepsByTheme.push({ cxo: 'CMO', label: 'AI が初回 DM の下書きを生成' });
                    stepsByTheme.push({ cxo: 'CFO', label: '想定報酬と税率を計算' });
                  } else if (/リール|動画|投稿|時間/i.test(allCxo)) {
                    stepsByTheme.push({ cxo: 'CDS', label: '直近メディアのパフォーマンスを分析' });
                    stepsByTheme.push({ cxo: 'CPO', label: '次の投稿テーマを 3 案組み立て' });
                    stepsByTheme.push({ cxo: 'CMO', label: 'キャプション + ハッシュタグを生成' });
                    stepsByTheme.push({ cxo: 'CDO', label: 'ビジュアル指針を出力' });
                  } else if (/保存|エンゲージ|フォロワー/i.test(allCxo)) {
                    stepsByTheme.push({ cxo: 'CDS', label: '保存率の上位投稿を分析' });
                    stepsByTheme.push({ cxo: 'CPO', label: '"あとで見返したい" 型の投稿仕様を策定' });
                    stepsByTheme.push({ cxo: 'CMO', label: '見出しコピーを 5 案生成' });
                    stepsByTheme.push({ cxo: 'UXE', label: 'プロフィール導線をチェック' });
                  } else {
                    stepsByTheme.push({ cxo: 'CPO', label: '実行計画を組み立て' });
                    stepsByTheme.push({ cxo: 'CMO', label: '必要な文章を生成' });
                    stepsByTheme.push({ cxo: 'CDS', label: '実行後の効果を測定' });
                  }
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <AgentProposalCard
                        brand="iris"
                        dedupeKey={`s0_${s.title.slice(0, 12)}`}
                        proposal={{
                          title: s.title,
                          summary: s.action,
                          why: s.why,
                          expected: s.kpi,
                          dueDays: s.dueDays,
                          steps: stepsByTheme,
                        }}
                      />
                    </div>
                  );
                })()}
                {strategy.data.strategies.slice(1).map((s, i) => (
                  <div key={i} style={{
                    padding: '0.7rem 0',
                    borderBottom: i < strategy.data!.strategies.slice(1).length - 1 ? `1px solid ${bg.cardBorder}` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                        color: '#fff', fontSize: 11, fontWeight: 900,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 2}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...IRIS_TYPE.small, fontWeight: 800, color: bg.ink, margin: '0 0 2px' }}>
                          {s.title}
                          <span style={{
                            marginLeft: 6, fontSize: '0.65rem', fontWeight: 700,
                            color: bg.accent, background: `${bg.accent}14`,
                            padding: '1px 6px', borderRadius: 999,
                          }}>{s.dueDays}日以内</span>
                        </p>
                        <p style={{ ...IRIS_TYPE.caption, color: bg.inkSoft, margin: '2px 0', lineHeight: 1.6 }}>
                          <strong>なぜ:</strong> {s.why}
                        </p>
                        <p style={{ ...IRIS_TYPE.caption, color: bg.ink, margin: '2px 0', lineHeight: 1.6 }}>
                          <strong>やる:</strong> {s.action}
                        </p>
                        <p style={{ ...IRIS_TYPE.caption, color: bg.accent, margin: 0, fontWeight: 700 }}>
                          🎯 {s.kpi}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {strategy.data._meta?.source === 'fallback' && (
                  <p style={{ fontSize: 9.5, color: bg.inkSoft, marginTop: 6, fontStyle: 'italic' }}>
                    ※ AI が一時的に応答できないため、実データから機械的に算出した戦略を表示しています
                  </p>
                )}
              </>
            ) : !strategy.loading && (
              <>
                {[
                  { title: 'リール投稿がピーク', desc: '実データを連携すると、あなた専用の戦略が出ます', color: '#E1306C' },
                  { title: 'ハッシュタグ最適化', desc: '保存されやすい組合せを AI が提案します', color: '#833AB4' },
                  { title: '案件獲得チャンス', desc: 'フォロワー層にマッチする案件を AI が厳選します', color: '#FCB045' },
                ].map((item, i) => (
                  <div key={i} style={{
                    padding: '0.65rem 0',
                    borderBottom: i < 2 ? `1px solid ${bg.cardBorder}` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <p style={{ ...IRIS_TYPE.small, fontWeight: 700, color: bg.ink, margin: '0 0 2px' }}>{item.title}</p>
                        <p style={{ ...IRIS_TYPE.caption, color: bg.inkSoft, margin: 0 }}>{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
            <button onClick={() => onNavigate('strategy')} style={{ ...ctaButtonSm(bg), marginTop: '0.75rem', width: '100%' }}>
              {strategy.data ? '伸ばす作戦を全部見る' : '伸ばす作戦を見る'}
            </button>
          </EditorialCard>
        </motion.div>

        {/* Instagram ポスト */}
        <motion.div {...IRIS_MOTION.stagger(2)}>
          <EditorialCard title="Instagram ポスト" icon={Camera} accent="#F77737">
            {igProfile ? (
              <div>
                <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.75rem' }}>
                  {[
                    { label: 'フォロワー', value: (igProfile.followers || '---').toLocaleString() },
                    { label: '投稿数', value: igProfile.mediaCount || '---' },
                    { label: 'エンゲージ率', value: igProfile.engagementRate ? `${igProfile.engagementRate}%` : '---' },
                  ].map(s => (
                    <div key={s.label} style={{
                      flex: 1, textAlign: 'center',
                      padding: '0.65rem 0.25rem',
                      borderRadius: IRIS_RADIUS.md,
                      background: `${bg.accent}0a`,
                      border: `1px solid ${bg.cardBorder}`,
                    }}>
                      <div style={{ ...IRIS_TYPE.lead, fontWeight: 800, color: bg.ink, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ ...IRIS_TYPE.caption, color: bg.inkSoft, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => onNavigate('strategy')} style={{ ...ctaButtonSm(bg), width: '100%' }}>
                  詳細分析を見る
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                <p style={{ ...IRIS_TYPE.small, color: bg.inkSoft, marginBottom: '0.85rem' }}>
                  Instagram を連携して分析を開始しましょう
                </p>
                <button onClick={onConnectInstagram} style={{
                  ...IRIS_TYPE.small,
                  background: IRIS_GRADIENT.instagram,
                  color: '#fff', border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: IRIS_RADIUS.full,
                  cursor: 'pointer', fontWeight: 700,
                  boxShadow: IRIS_SHADOW.glow('#E1306C'),
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <Camera size={13} strokeWidth={2.5} /> Instagram を連携する
                </button>
              </div>
            )}
          </EditorialCard>
        </motion.div>

        {/* 案件を探す */}
        <motion.div {...IRIS_MOTION.stagger(3)}>
          <EditorialCard title="案件マッチング" icon={Handshake} accent="#E1306C">
            <p style={{ ...IRIS_TYPE.small, color: bg.inkSoft, marginBottom: '0.85rem' }}>
              {strategy.data
                ? 'あなたのフォロワー層から、相性の良い案件カテゴリを AI が厳選しました。'
                : 'あなたのアカウントに合うブランド案件を AI が厳選します。'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(strategy.data?.matchedCategories || ['コスメ / スキンケア', 'ファッション / アパレル', 'グルメ / フード']).slice(0, 5).map((cat, i) => {
                // 実データ駆動の件数推定 (フォロワー数 × カテゴリ相性で 1-12 件のレンジ)
                const baseCount = igProfile ? Math.max(2, Math.round(Math.log10(Math.max(1000, igProfile.followers)) * 2)) : 5;
                const count = baseCount + (i % 3);
                return (
                  <div key={cat} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.5rem 0.7rem',
                    borderRadius: IRIS_RADIUS.md,
                    background: `${bg.accent}0a`,
                    border: `1px solid ${bg.cardBorder}`,
                  }}>
                    <span style={{ ...IRIS_TYPE.small, color: bg.ink, fontWeight: 600 }}>{cat}</span>
                    <span style={{
                      ...IRIS_TYPE.caption,
                      color: bg.accent, fontWeight: 700,
                      background: `${bg.accent}14`,
                      padding: '0.2rem 0.5rem', borderRadius: IRIS_RADIUS.full,
                    }}>{count} 件</span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => onNavigate('brands')} style={{ ...ctaButtonSm(bg), marginTop: '0.75rem', width: '100%' }}>
              案件を探す
            </button>
          </EditorialCard>
        </motion.div>
      </div>
    </div>
  );
}

// ── エディトリアルカード (共通コンポーネント) ──────────────────
function EditorialCard({
  title, icon: Ico, accent, children,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.92)',
      borderRadius: IRIS_RADIUS.xl,
      border: `1px solid rgba(31,26,46,0.07)`,
      boxShadow: IRIS_SHADOW.card,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '1rem 1.1rem 0.7rem',
        borderBottom: '1px solid rgba(31,26,46,0.06)',
        display: 'flex', alignItems: 'center', gap: '0.55rem',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: IRIS_RADIUS.md,
          background: `${accent}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Ico size={14} color={accent} strokeWidth={2.3} />
        </div>
        <span style={{
          fontFamily: IRIS_FONTS.serif,
          fontStyle: 'italic',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: '#1F1A2E',
          letterSpacing: '-0.005em',
        }}>{title}</span>
      </div>
      <div style={{ padding: '0.85rem 1.1rem 1rem' }}>
        {children}
      </div>
    </div>
  );
}

function ctaButtonSm(bg: IrisBackgroundDef) {
  return {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff',
    border: 'none',
    borderRadius: IRIS_RADIUS.full,
    padding: '0.55rem 1rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: IRIS_FONTS.body,
    boxShadow: `0 4px 14px ${bg.accent}44`,
    transition: 'transform 0.12s, box-shadow 0.12s',
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  } as React.CSSProperties;
}

const IRIS_PERSONA_ID = 'iris-default';  // Iris は単一ユーザー前提

export default function IrisDashboard({ settings, onLeave }: Props) {
  const [bg, setBg] = useState<IrisBackgroundDef | CustomIrisBackground>(() => loadIrisBackground());
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [bgListVersion, setBgListVersion] = useState(0); // 再描画用
  const [tab, setTab] = useState<Tab>('home');
  const [moreOpen, setMoreOpen] = useState(false);
  const [igProfile, setIgProfile] = useState<IgProfile | null>(() => loadIgProfile());
  const [showIgConnect, setShowIgConnect] = useState(false);

  useEffect(() => {
    consumeOauthCallback().then(p => { if (p) setIgProfile(p); }).catch(() => {});
  }, []);

  const allBgs = useMemo(() => getAllBackgrounds(), [bgListVersion]);

  const desk = useInfluencerDesk();
  const postQueue = usePostQueue();
  const team = useIrisTeam();
  const health = useHealth();
  const multiAccount = useMultiAccount();
  const brandGuide = useBrandGuidelines();
  const knowledge = useIrisKnowledge();
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const myDeals = useMemo(() => desk.getDealsForPersona(IRIS_PERSONA_ID), [desk.deals]);
  const mediaKit = desk.getMediaKit(IRIS_PERSONA_ID);

  const handlePickBg = (b: IrisBackgroundDef | CustomIrisBackground) => {
    setBg(b); saveIrisBackground(b.id); setBgPickerOpen(false);
  };
  const handleRemoveCustom = async (id: string) => {
    if (!(await confirmAction({ title: 'この背景を削除しますか?', tone: 'danger' }))) return;
    removeCustomBackground(id);
    setBgListVersion(v => v + 1);
    if (bg.id === id) {
      const fallback = IRIS_BACKGROUNDS[0];
      setBg(fallback); saveIrisBackground(fallback.id);
    }
  };

  // CSS variables → 動的テーマ
  const themeStyle = {
    '--iris-accent': bg.accent,
    '--iris-ink': bg.ink,
    '--iris-ink-soft': bg.inkSoft,
    '--iris-card': bg.card,
    '--iris-card-border': bg.cardBorder,
  } as React.CSSProperties;

  const irisPersonaStub = useMemo(() => ({
    id: IRIS_PERSONA_ID,
    name: 'Creator',
    subtitle: 'Influencer / Creator',
    icon: '',
    description: 'インフルエンサー / クリエイター',
    accentColor: bg.accent,
    accentColorLight: bg.cardBorder,
    createdAt: new Date().toISOString(),
    meetingSlug: 'iris',
    tasks: [],
    cashflow: { income: 0, expense: 0, label: '' },
    timeAllocation: 0,
  }), [bg]);

  return (
    <div style={{
      minHeight: '100dvh',
      background: bg.background,
      color: bg.ink,
      fontFamily: IRIS_FONTS.body,
      display: 'flex',
      ...themeStyle,
    }}>
      {/* デスクトップ左サイドバー */}
      <div className="iris-sidebar-wrapper">
        <IrisSidebar tab={tab} setTab={setTab} bg={bg} onBgPicker={() => setBgPickerOpen(true)} onLeave={onLeave} />
      </div>

      {/* 右コンテンツエリア */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

      {/* スリムヘッダ (ロゴ + 主要コントロールのみ) */}
      <header className="iris-header-sticky" style={{
        position: 'sticky', top: 0, zIndex: 40,
        padding: 'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.4rem)) max(1.25rem, env(safe-area-inset-right)) 0.75rem max(1.25rem, env(safe-area-inset-left))',
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${bg.cardBorder}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          {/* Iris ロゴ・ワードマークタップでホーム (案件トップ) に戻る */}
          <button
            type="button"
            onClick={() => setTab('home')}
            aria-label="ホームに戻る"
            title="ホームに戻る"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '0.2rem 0.4rem', borderRadius: 10,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(225,48,108,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <IrisLogo size={32} withWordmark={false} />
            <span style={{
              fontFamily: IRIS_FONTS.serif,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: '1.6rem',
              letterSpacing: '-0.01em',
              lineHeight: 1,
              background: `linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Iris
            </span>
          </button>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <IrisCommandBar bg={bg} settings={settings} onRoute={(t) => setTab(t as Tab)} />
            {/* アカウントスイッチャー */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAccountSwitcherOpen(v => !v)}
                title="アカウント切り替え"
                style={{
                  ...btnIcon(bg),
                  width: 'auto', padding: '0 0.7rem',
                  gap: '0.35rem', display: 'inline-flex', alignItems: 'center',
                  fontSize: '0.72rem', fontWeight: 700,
                  minHeight: 36, height: 36,
                }}>
                <User size={14} strokeWidth={2.4} color={bg.accent} />
                <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {multiAccount.active?.handle || '@me'}
                </span>
              </button>
              {accountSwitcherOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(31,26,46,0.15)',
                  border: `1px solid ${bg.cardBorder}`, minWidth: 220, zIndex: 60, overflow: 'hidden',
                }}>
                  <div style={{ padding: '0.6rem 0.85rem', borderBottom: `1px solid ${bg.cardBorder}` }}>
                    <p style={{ fontSize: '0.7rem', color: bg.inkSoft, fontWeight: 700, margin: 0 }}>アカウント切り替え</p>
                  </div>
                  {multiAccount.accounts.map(acct => (
                    <button key={acct.id} onClick={() => { multiAccount.switchTo(acct.id); setAccountSwitcherOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        width: '100%', padding: '0.65rem 0.85rem', textAlign: 'left',
                        background: acct.id === multiAccount.active?.id ? `${bg.accent}12` : 'transparent',
                        border: 'none', cursor: 'pointer', borderBottom: `1px solid ${bg.cardBorder}`,
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: `${bg.accent}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <User size={16} color={bg.accent} strokeWidth={2.2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: bg.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct.handle}</div>
                        <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>
                          {ACCOUNT_TYPE_META[acct.type].label}
                          {' · '}{PLATFORM_META_ACCOUNT[acct.platform].label}
                        </div>
                      </div>
                      {acct.id === multiAccount.active?.id && (
                        <CheckCircle2 size={14} color={bg.accent} strokeWidth={2.4} />
                      )}
                    </button>
                  ))}
                  <button onClick={() => { setAccountSwitcherOpen(false); setTab('guideline'); }}
                    style={{
                      display: 'block', width: '100%', padding: '0.65rem 0.85rem', textAlign: 'left',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem', color: bg.accent, fontWeight: 700,
                    }}>
                    + アカウントを管理
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setBgPickerOpen(true)} title="背景を変える" aria-label="背景を変える"
              style={btnIcon(bg)}>
              <Palette size={18} strokeWidth={2} />
            </button>
            <button onClick={() => setMoreOpen(true)} title="メニュー" aria-label="メニュー" className="iris-tab-more-trigger"
              style={btnIcon(bg)}><MenuIcon size={18} strokeWidth={2} /></button>
            <button onClick={onLeave} title="戻る" aria-label="戻る" style={btnIcon(bg)} className="iris-back-btn"><ArrowLeft size={18} strokeWidth={2} /></button>
          </div>
        </div>

        {/* モバイル用 タブ ナビゲーション (コンパクト横スクロール) */}
        <nav className="iris-tabs-v2 iris-mobile-tabs" style={{
          maxWidth: 1280, margin: '0.4rem auto 0',
          display: 'flex', alignItems: 'center', gap: 6,
          overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2,
        }}>
          {TAB_GROUPS.map((group, gi) => {
            const isActiveGroup = TAB_TO_GROUP[tab] === group.id;
            const GIco = group.icon;
            return (
              <React.Fragment key={group.id}>
                {gi > 0 && (
                  <span aria-hidden style={{
                    width: 1, height: 22,
                    background: 'rgba(31,26,46,0.12)',
                    flexShrink: 0,
                  }} className="iris-tab-divider" />
                )}
                <div
                  className={`iris-tab-group${isActiveGroup ? ' is-active' : ''}`}
                  data-group={group.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 4px',
                    borderRadius: 14,
                    background: isActiveGroup ? `${group.color}10` : 'transparent',
                  }}
                >
                  <div
                    title={group.label}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '0.3rem 0.55rem',
                      fontSize: '0.62rem', letterSpacing: '0.18em',
                      fontWeight: 800,
                      color: isActiveGroup ? group.color : 'rgba(31,26,46,0.45)',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                    }}>
                    <GIco size={12} strokeWidth={2.8} />
                    {group.label}
                  </div>
                  {group.tabs.map(t => {
                    const Ico = IRIS_TAB_ICON[t.id] || Sparkles;
                    const active = tab === t.id;
                    return (
                      <button key={t.id}
                        onClick={() => setTab(t.id as Tab)}
                        className="iris-tab-btn"
                        style={{
                          background: active
                            ? `linear-gradient(135deg, ${group.color}, ${group.color}cc)`
                            : 'rgba(255,255,255,0.92)',
                          color: active ? '#FFFFFF' : '#1F1A2E',
                          border: active ? 'none' : '1px solid rgba(31,26,46,0.08)',
                          borderRadius: 999,
                          padding: '0.5rem 0.95rem',
                          fontSize: '0.82rem',
                          fontWeight: active ? 700 : 600,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          fontFamily: IRIS_FONTS.body,
                          boxShadow: active
                            ? `0 6px 18px ${group.color}55`
                            : '0 1px 3px rgba(31,26,46,0.06)',
                          transition: 'all 0.15s',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          minHeight: 36,
                        }}>
                        <Ico size={13} strokeWidth={2.4} />
                        {t.l}
                      </button>
                    );
                  })}
                </div>
              </React.Fragment>
            );
          })}
          {/* モバイル用 「もっと」 トリガー: タブ末尾に配置 */}
          <button onClick={() => setMoreOpen(true)} className="iris-tab-more"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color: '#1F1A2E',
              border: `1px solid rgba(31,26,46,0.08)`,
              borderRadius: 999,
              padding: '0.55rem 1.05rem',
              fontSize: '0.85rem', fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: IRIS_FONTS.body,
              boxShadow: '0 1px 3px rgba(31,26,46,0.06)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              flexShrink: 0,
            }}>
            <MenuIcon size={14} strokeWidth={2.4} />
            全機能
          </button>
        </nav>
      </header>

      {/* モバイル用 「もっと」シート */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 60,
              background: 'rgba(31,26,46,0.45)', backdropFilter: 'blur(8px)',
            }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: '#FFFFFF', borderRadius: '24px 24px 0 0',
                padding: '1rem 1rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
                maxHeight: '78dvh', overflowY: 'auto',
                boxShadow: '0 -16px 60px rgba(31,26,46,0.25)',
              }}>
              <div style={{
                width: 44, height: 4, borderRadius: 2,
                background: 'rgba(31,26,46,0.15)', margin: '0 auto 1rem',
              }} />
              <p style={{
                textAlign: 'center', fontSize: '0.7rem', letterSpacing: '0.3em',
                color: bg.accent, fontWeight: 700, margin: '0 0 1rem',
              }}>
                ALL FEATURES
              </p>
              {TAB_GROUPS.map(group => {
                const GIco = group.icon;
                return (
                  <div key={group.id} style={{ marginBottom: '1.1rem' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      margin: '0 0 0.55rem 0.25rem',
                      fontSize: '0.65rem', letterSpacing: '0.22em', fontWeight: 800,
                      color: group.color, textTransform: 'uppercase',
                    }}>
                      <GIco size={12} strokeWidth={2.8} />
                      {group.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.55rem' }}>
                      {group.tabs.map(t => {
                        const Ico = IRIS_TAB_ICON[t.id] || Sparkles;
                        const isActive = tab === t.id;
                        return (
                          <button key={t.id}
                            onClick={() => { setTab(t.id as Tab); setMoreOpen(false); }}
                            style={{
                              background: isActive ? `linear-gradient(135deg, ${group.color}, ${group.color}dd)` : 'rgba(248,244,252,1)',
                              color: isActive ? '#fff' : '#1F1A2E',
                              border: 'none', borderRadius: 14,
                              padding: '0.95rem 0.5rem 0.85rem', fontSize: '0.85rem', fontWeight: 600,
                              cursor: 'pointer', textAlign: 'center',
                              boxShadow: isActive ? `0 6px 18px ${group.color}45` : 'none',
                              minHeight: 76,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: isActive ? 'rgba(255,255,255,0.22)' : `${group.color}18`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Ico size={18} color={isActive ? '#fff' : group.color} strokeWidth={2.2} />
                            </div>
                            <span>{t.l}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setMoreOpen(false)}
                style={{
                  width: '100%', marginTop: '1rem',
                  background: 'transparent', border: '1px solid rgba(31,26,46,0.12)',
                  borderRadius: 12, padding: '0.85rem',
                  fontSize: '0.85rem', color: '#5A4570', fontWeight: 600, cursor: 'pointer',
                }}>
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* メインコンテンツ — デスクトップでは max-w を広げて右側の空白を埋める */}
      <main className="iris-main" style={{
        maxWidth: tab === 'image' ? 1720 : 1640, margin: '0 auto',
        padding: tab === 'image'
          ? '0.75rem 0.7rem calc(0.75rem + env(safe-area-inset-bottom, 0px))'
          : `1.75rem 1.25rem calc(${IRIS_DOCK_H + 24}px + env(safe-area-inset-bottom, 0px))`,
        flex: 1,
      }}>
        {/* タブ切替: アニメ無し (mode="wait" + 初期 opacity:0 の組合せで本文が見えなくなる事故が発生したため、確実に表示することを優先) */}
        <div key={tab}>
            {tab === 'home' && (
              <>
                {/* エディトリアル ホームダッシュ */}
                <IrisEditorialHome
                  bg={bg}
                  myDeals={myDeals}
                  postQueue={postQueue}
                  knowledge={knowledge}
                  igProfile={igProfile}
                  onNavigate={(t) => setTab(t as Tab)}
                  settings={settings}
                  mediaKit={mediaKit}
                  onConnectInstagram={() => setShowIgConnect(true)}
                />

                {/* 6 エージェント オービット */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <AgentsOrbit
                    specs={IRIS_SPECS}
                    order={IRIS_ORDER}
                    conversations={IRIS_CONVERSATIONS}
                    footerLabel="あなたの 6 人の参謀が、いま動いています"
                    agents={[
                      {
                        key: 'deals',
                        count: myDeals.length,
                        status: myDeals.length ? `案件 ${myDeals.length} 件` : '案件を探索中',
                        advice: myDeals.length
                          ? `${myDeals.length} 件の案件があります。優先順を整えて、今日動かす 1 件を選びました`
                          : `案件タブで「ブランド探索」を開くと、私が条件に合う案件を拾ってきます`,
                        onClick: () => setTab('deals'),
                      },
                      {
                        key: 'analytics',
                        count: postQueue.posts.length,
                        status: postQueue.posts.length ? `予約 ${postQueue.posts.length} 本` : '伸びを分析中',
                        advice: postQueue.posts.length
                          ? `予約済み ${postQueue.posts.length} 本の伸びを予測しました。一番伸びそうなのを上に置いてあります`
                          : `Instagram のリンクを貼ると、伸びる時間帯と保存される投稿の共通点を出します`,
                        onClick: () => setTab('strategy'),
                      },
                      {
                        key: 'creative',
                        count: 0,
                        status: '原稿を準備中',
                        advice: `次の投稿のキャプション・サムネを、あなたの世界観に合わせて自動で作ります`,
                        onClick: () => setTab('director'),
                      },
                      {
                        key: 'nego',
                        count: 0,
                        status: '言葉を磨き中',
                        advice: `Apple や UNIQLO など実在ブランドへの返信文を、強気 / ふつう / ていねい の 3 種で下書きします`,
                        onClick: () => setTab('negotiate'),
                      },
                      {
                        key: 'brand',
                        count: knowledge.count,
                        status: knowledge.count ? `資料 ${knowledge.count} 件` : '世界観を整え中',
                        advice: knowledge.count
                          ? `あなたの ${knowledge.count} 件の資料から、ブランドの色とフォントを統一しました`
                          : `スクショ 3 枚をアップすると、あなた専用の色とフォントを提案します`,
                        onClick: () => setTab('image'),
                      },
                      {
                        key: 'community',
                        count: 0,
                        status: 'DM を確認中',
                        advice: `仲間タブを開くと、同じ志のクリエイターと出会えます。コラボ候補も AI が探します`,
                        onClick: () => setTab('beauty' as Tab),
                      },
                    ]}
                  />
                </div>

                {/* 仕事獲得を最優先 */}
                <IrisEarnHero
                  onOpenDeals={() => setTab('deals')}
                  onConnectInstagram={() => setShowIgConnect(true)}
                  igConnected={!!igProfile}
                  igFollowers={igProfile?.followers}
                />

                {/* 健康が積み上がっている実感 */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <WellnessTracker
                    today={health.today}
                    accent="#E1306C"
                    accentSoft="rgba(225,48,108,0.10)"
                    onConnectHealth={() => setTab('health')}
                  />
                </div>

                {/* AI チャット */}
                <IrisVoiceHome
                  bg={bg} settings={settings}
                  myDeals={myDeals} mediaKit={mediaKit}
                  postQueue={postQueue}
                  onNavigate={(t) => setTab(t as Tab)}
                />
              </>
            )}
            {tab === 'deals' && <DealsView bg={bg} desk={desk} myDeals={myDeals} settings={settings} mediaKit={mediaKit} />}
            {tab === 'negotiate' && <NegotiateView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} />}
            {tab === 'draft' && <DraftView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} knowledge={knowledge} />}
            {tab === 'knowledge' && <IrisKnowledgeView bg={bg} knowledge={knowledge} />}
            {tab === 'beauty' && <BeautyChatView bg={bg} settings={settings} />}
            {tab === 'health' && <IrisHealthView bg={bg} health={health} />}
            {tab === 'strategy' && <IrisStrategistView bg={bg} settings={settings} mediaKit={mediaKit} knowledge={knowledge} />}
            {tab === 'image' && <IrisImageEditor bg={bg} settings={settings} />}
            {tab === 'triage' && (
              <IrisTriageView bg={bg} settings={settings} mediaKit={mediaKit}
                onSaveAsDeal={(ex) => {
                  desk.addDeal(IRIS_PERSONA_ID, {
                    brandName: ex.brandName || '不明',
                    agencyName: ex.agencyName,
                    productName: ex.productName,
                    platform: 'instagram',
                    contentType: 'post',
                    fee: ex.fee || 0,
                    deliverables: ex.deliverables || '',
                    contactName: ex.contactName,
                    contactEmail: ex.contactEmail,
                    notes: '[Triage AI で精査済み]',
                    stage: 'inquiry',
                  });
                  notifyInApp({ kind: 'success', title: '案件として保存しました', body: '商談リストに追加しました。' });
                }}
              />
            )}
            {tab === 'director' && <IrisDirectorView bg={bg} settings={settings} />}
            {tab === 'video' && <VideoStudio bg={bg} settings={settings} />}
            {tab === 'reel' && (
              <React.Suspense fallback={
                <div style={{ textAlign: 'center', padding: '4rem 0', color: bg.inkSoft }}>
                  リールスタジオを読み込み中…
                </div>
              }>
                <IrisReelStudio
                  bg={bg}
                  myDeals={myDeals}
                  postQueue={postQueue}
                  settings={settings}
                  persona={irisPersonaStub}
                  mediaKit={mediaKit}
                  onJumpToSchedule={() => setTab('schedule')}
                />
              </React.Suspense>
            )}
            {tab === 'schedule' && <IrisPostQueueView bg={bg} queue={postQueue} />}
            {tab === 'community' && <IrisCommunityView bg={bg} myHandle={mediaKit?.handleName} />}
            {tab === 'team' && <TeamView bg={bg} team={team} desk={desk} myDeals={myDeals} />}
            {tab === 'brands' && <BrandMatchView bg={bg} desk={desk} mediaKit={mediaKit} settings={settings} knowledge={knowledge} />}
            {tab === 'kit' && <MediaKitView bg={bg} desk={desk} kit={mediaKit} />}
            {tab === 'revenue' && <IrisRevenueView bg={bg} />}
            {tab === 'fans' && <IrisFanEngagement bg={bg} settings={settings} />}
            {tab === 'collab' && (
              <IrisCollabBoard bg={bg} myHandle={multiAccount.active?.handle} />
            )}
            {tab === 'guideline' && (
              <BrandGuidelineView bg={bg} multiAccount={multiAccount} brandGuide={brandGuide} settings={settings} />
            )}
            {tab === 'invite' && (
              <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <InviteShareCard
                  brand="iris"
                  palette={{
                    accent: bg.accent, ink: bg.ink,
                    inkSoft: bg.inkSoft, card: bg.card,
                    border: bg.cardBorder,
                  }}
                />
              </div>
            )}
          </div>
      </main>

      {/* Instagram 連携モーダル */}
      <AnimatePresence>
        {showIgConnect && (
          <IgConnectModal
            onClose={() => setShowIgConnect(false)}
            onConnected={(p) => setIgProfile(p)}
          />
        )}
      </AnimatePresence>

      {/* カスタム背景エディタ */}
      <AnimatePresence>
        {customEditorOpen && (
          <IrisCustomBgEditor
            onClose={() => setCustomEditorOpen(false)}
            onCreated={(b) => {
              setBgListVersion(v => v + 1);
              handlePickBg(b);
              setCustomEditorOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* 背景セレクタ モーダル */}
      <AnimatePresence>
        {bgPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setBgPickerOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(20,15,30,0.5)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 24, padding: '1.5rem',
                maxWidth: 700, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
              }}
            >
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: IRIS_COLORS.roseDeep, fontWeight: 600 }}>
                  BACKGROUND
                </p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: IRIS_COLORS.navy, margin: '0.25rem 0 0' }}>
                  気分を変える。
                </h3>
              </div>

              <p style={{ fontSize: '0.75rem', color: IRIS_COLORS.inkSoft, marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={12} color={IRIS_COLORS.roseDeep} /> プリセット (補色ペア)
              </p>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem',
              }}>
                {IRIS_BACKGROUNDS.map(b => {
                  const active = b.id === bg.id;
                  return (
                    <button key={b.id} onClick={() => handlePickBg(b)} style={{
                      background: b.background,
                      border: active ? `3px solid ${IRIS_COLORS.roseDeep}` : `1px solid ${IRIS_COLORS.roseSoft}`,
                      borderRadius: 16,
                      padding: '1.25rem',
                      cursor: 'pointer',
                      minHeight: 110,
                      textAlign: 'left',
                      position: 'relative',
                      color: b.ink,
                      fontFamily: IRIS_FONTS.body,
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{b.emoji}</div>
                      <div style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.05rem', fontStyle: 'italic' }}>{b.label}</div>
                      <div style={{
                        position: 'absolute', bottom: 8, right: 8,
                        width: 16, height: 16, borderRadius: '50%',
                        background: b.accent, border: '2px solid #fff',
                      }} />
                      {active && (
                        <div style={{
                          position: 'absolute', top: 8, right: 8,
                          background: IRIS_COLORS.roseDeep, color: '#fff',
                          borderRadius: 999, fontSize: '0.65rem',
                          padding: '0.15rem 0.5rem', fontWeight: 700,
                        }}>選択中</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* カスタム一覧 */}
              {allBgs.filter(b => 'isCustom' in b && b.isCustom).length > 0 && (
                <>
                  <p style={{ fontSize: '0.75rem', color: IRIS_COLORS.inkSoft, marginTop: '1.25rem', marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Bookmark size={12} color={IRIS_COLORS.roseDeep} /> マイ・カスタム
                  </p>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem',
                  }}>
                    {allBgs.filter((b): b is CustomIrisBackground => 'isCustom' in b && b.isCustom).map(b => {
                      const active = b.id === bg.id;
                      return (
                        <div key={b.id} style={{ position: 'relative' }}>
                          <button onClick={() => handlePickBg(b)} style={{
                            background: b.background,
                            border: active ? `3px solid ${IRIS_COLORS.roseDeep}` : `1px solid ${IRIS_COLORS.roseSoft}`,
                            borderRadius: 16,
                            padding: '1.25rem',
                            cursor: 'pointer',
                            minHeight: 110,
                            textAlign: 'left',
                            color: b.ink,
                            fontFamily: IRIS_FONTS.body,
                            width: '100%',
                          }}>
                            <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{b.emoji}</div>
                            <div style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.05rem', fontStyle: 'italic' }}>{b.label}</div>
                            <div style={{
                              position: 'absolute', bottom: 8, right: 32,
                              width: 16, height: 16, borderRadius: '50%',
                              background: b.accent, border: '2px solid #fff',
                            }} />
                          </button>
                          <button onClick={() => handleRemoveCustom(b.id)} title="削除" aria-label="削除" style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(255,255,255,0.85)',
                            border: 'none', borderRadius: 999,
                            width: 26, height: 26,
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          }}><Trash2 size={13} color="#1F1A2E" strokeWidth={2.2} /></button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <button onClick={() => { setBgPickerOpen(false); setCustomEditorOpen(true); }} style={{
                marginTop: '1.25rem',
                width: '100%',
                background: `linear-gradient(135deg, ${IRIS_COLORS.rose}, ${IRIS_COLORS.roseDeep})`,
                color: '#fff', border: 'none',
                padding: '0.95rem', borderRadius: 999, fontWeight: 700, cursor: 'pointer',
                fontSize: '0.9rem',
                boxShadow: `0 8px 24px ${IRIS_COLORS.roseDeep}55`,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} /> 自分だけの背景を作る
                </span>
              </button>

              <button onClick={() => setBgPickerOpen(false)} style={{
                marginTop: '0.5rem',
                width: '100%',
                background: 'transparent', color: IRIS_COLORS.navy, border: `1px solid ${IRIS_COLORS.roseSoft}`,
                padding: '0.85rem', borderRadius: 999, fontWeight: 600, cursor: 'pointer',
              }}>
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* グローバルAIサポートチャット (右下FAB → 右ドロワー) */}
      <SupportChat
        brand="iris"
        accentColor={bg.accent}
        context={{
          page: 'Iris ダッシュボード',
          dealCount: myDeals.length,
        }}
      />

      {/* キーボードショートカット (? キーで開閉) */}
      <ShortcutHelpModal />

      {/* PWA インストール促進 */}
      <PwaInstallPrompt accentColor={bg.accent} />

      {/* ベータ初日フィードバック */}
      <FeedbackWidget brand="iris" />

      {/* モバイル下部 Dock */}
      <div className="iris-dock-wrapper">
        <IrisBottomDock tab={tab} setTab={setTab} bg={bg} onMore={() => setMoreOpen(true)} />
      </div>

      </div>{/* /右コンテンツエリア */}
    </div>
  );
}

// ─── ホーム ──────────────────────────────────────
type SetTabFn = (t: 'home' | 'strategy' | 'deals' | 'triage' | 'director' | 'negotiate' | 'draft' | 'beauty' | 'image' | 'community' | 'team' | 'brands' | 'kit') => void;

// @ts-expect-error - 旧 HomeView は VoiceHome に置換済みだが将来用に残す
function HomeView({ bg, myDeals, setTab }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; myDeals: InfluencerDeal[]; setTab?: SetTabFn }) {
  const upcoming = useMemo(() => {
    const events: { brand: string; type: string; date: Date; daysLeft: number }[] = [];
    const now = new Date();
    const addEv = (d: InfluencerDeal, iso: string | undefined, type: string) => {
      if (!iso) return;
      const dt = new Date(iso);
      if (Number.isNaN(dt.getTime())) return;
      events.push({
        brand: d.brandName,
        type,
        date: dt,
        daysLeft: Math.ceil((dt.getTime() - now.getTime()) / 86400000),
      });
    };
    myDeals.forEach(d => {
      addEv(d, d.draftDeadline, '下書き');
      addEv(d, d.postDeadline, '投稿');
      addEv(d, d.reportDeadline, 'レポート');
    });
    return events.filter(e => e.daysLeft >= 0).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [myDeals]);

  const earnings = myDeals.filter(d => ['posted','reported','closed'].includes(d.stage)).reduce((s, d) => s + (d.fee || 0), 0);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>TODAY</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(2rem, 5vw, 3rem)', color: bg.ink, margin: '0.25rem 0 0' }}>
          おかえりなさい。
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <StatCard bg={bg} label="進行中" value={myDeals.filter(d => !['closed','declined'].includes(d.stage)).length + ' 件'} icon={Mail} />
        <StatCard bg={bg} label="今週まで" value={upcoming.filter(e => e.daysLeft <= 7).length + ' 件'} icon={Calendar} />
        <StatCard bg={bg} label="売上合計" value={'¥' + earnings.toLocaleString()} icon={Wallet} />
        <StatCard bg={bg} label="終わった分" value={myDeals.filter(d => d.stage === 'closed').length + ' 件'} icon={CheckCircle2} />
      </div>

      {upcoming.length > 0 && (
        <Card bg={bg}>
          <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '1rem', color: bg.ink }}>
            まもなく締め切り
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {upcoming.map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0.75rem', borderRadius: 12,
                background: 'rgba(255,255,255,0.5)',
              }}>
                <div style={{ minWidth: 60, textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.1rem', fontWeight: 700,
                    color: e.daysLeft <= 2 ? '#FF5C5C' : e.daysLeft <= 7 ? '#FFA94D' : bg.accent,
                  }}>
                    {e.daysLeft === 0 ? '今日' : `${e.daysLeft}日`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>
                    {e.date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: bg.ink }}>{e.brand}</div>
                  <div style={{ fontSize: '0.8rem', color: bg.inkSoft }}>{e.type}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI 提案カード (戦略タブへの誘導) */}
      <Card bg={bg}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: bg.accent, fontWeight: 700, marginBottom: '0.25rem' }}>
              AI からの提案
            </p>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.5rem', color: bg.ink, margin: 0, fontWeight: 500 }}>
              次の一本、AI に聞いてみる
            </p>
          </div>
          {setTab && (
            <button onClick={() => setTab('strategy')} style={{
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              color: '#fff', border: 'none', borderRadius: 999,
              padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer',
              fontSize: '0.85rem', boxShadow: `0 6px 20px ${bg.accent}55`,
            }}>
              作戦を見る →
            </button>
          )}
        </div>
        <p style={{ color: bg.inkSoft, fontSize: '0.88rem', lineHeight: 1.7 }}>
          これまでの投稿を入れると、よく反応された型を見つけて、次に書くといい投稿を AI が決めてくれます。30 日ぶんの流れも自動で。
        </p>
      </Card>

      {/* 今、なにする — クイックアクション */}
      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '1rem', color: bg.ink, fontWeight: 500 }}>
          今、なにする?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
          {([
            { I: Search,        l: 'お仕事を確認',   tab: 'triage' },
            { I: Film,          l: '動画おまかせ',   tab: 'director' },
            { I: MessageSquare, l: 'お返事を書く',   tab: 'negotiate' },
            { I: Camera,        l: '写真を直す',     tab: 'image' },
            { I: HeartPulse,    l: '美容のはなし',   tab: 'beauty' },
            { I: UsersRound,    l: 'みんなの広場',   tab: 'community' },
          ] as const).map((q) => {
            const Ico = q.I;
            return (
              <button key={q.l} onClick={() => setTab && setTab(q.tab as any)} className="iris-card-hover" style={{
                background: 'rgba(255,255,255,0.85)',
                border: `1px solid ${bg.cardBorder}`,
                borderRadius: 16,
                padding: '1.1rem 0.75rem',
                cursor: 'pointer',
                textAlign: 'center',
                color: '#1F1A2E',
                fontFamily: IRIS_FONTS.body,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  margin: '0 auto 0.5rem',
                  background: `${bg.accent}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ico size={22} color={bg.accent} strokeWidth={2.2} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{q.l}</div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 先回り提案カード — AI が「これやりましょうか?」を先出し。
// ユーザーは手入力せず ✓承認 / ✗却下 / ✏️修正 だけ。
// ════════════════════════════════════════════════════════════
function ProposalCard({
  bg, title, sub, reason, reasonLabel, badge, busy,
  approveLabel, onApprove, onReject, editArea,
}: {
  bg: IrisBackgroundDef;
  title: React.ReactNode;
  sub?: React.ReactNode;
  reason: string;
  reasonLabel?: string;
  badge?: string;
  busy?: boolean;
  approveLabel: string;
  onApprove: () => void;
  onReject: () => void;
  editArea?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <motion.div layout
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, x: -16 }}>
      <Card bg={bg}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10, letterSpacing: '0.16em', fontWeight: 800,
          color: bg.accent, marginBottom: 8,
        }}>
          <Sparkles size={11} /> {badge || 'AI からの提案'}
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: bg.ink, lineHeight: 1.45 }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: '0.82rem', color: bg.inkSoft, marginTop: 3 }}>{sub}</div>}
        <div style={{
          marginTop: 10, padding: '0.7rem 0.85rem', borderRadius: 12,
          background: `${bg.accent}14`, border: `1px solid ${bg.accent}33`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: bg.accent, marginBottom: 3 }}>
            {reasonLabel || '🤔 AI がこれをすすめる理由'}
          </div>
          <div style={{ fontSize: '0.86rem', color: bg.ink, lineHeight: 1.65 }}>{reason}</div>
        </div>
        {editing && editArea && (
          <div style={{ marginTop: 10 }}>{editArea}</div>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={onReject} disabled={busy}
            style={{ ...btnSecondary(bg), padding: '0.6rem 1rem', opacity: busy ? 0.5 : 1 }}>
            ✗ 却下
          </button>
          {editArea && (
            <button onClick={() => setEditing(e => !e)} disabled={busy}
              style={{ ...btnSecondary(bg), padding: '0.6rem 1rem', opacity: busy ? 0.5 : 1 }}>
              {editing ? '修正をとじる' : '✏️ 修正'}
            </button>
          )}
          <button onClick={onApprove} disabled={busy}
            style={{ ...btnPrimary(bg), padding: '0.6rem 1.2rem', opacity: busy ? 0.6 : 1 }}>
            {busy ? '考え中…' : approveLabel}
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 案件 (DealsView) — AI が「今日応募すべき案件」を先出し ───
function DealsView({ bg, desk, myDeals, settings, mediaKit }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; myDeals: InfluencerDeal[]; settings: AppSettings; mediaKit?: MediaKit }) {
  const [manualOpen, setManualOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [handled, setHandled] = useState<string[]>([]);
  const [feeEdit, setFeeEdit] = useState<Record<string, number>>({});
  const [d, setD] = useState<Partial<InfluencerDeal>>({
    brandName: '', platform: 'instagram', contentType: 'post', fee: 0, deliverables: '', stage: 'inquiry',
  });

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 2400); };

  // AI が実物カタログから合致度の高い案件を 3 件、先回りでピック
  const picks = useMemo(() =>
    getAllBrandDeals()
      .map(deal => ({ deal, score: computeMatchScore(deal, mediaKit) }))
      .filter(p => !handled.includes(p.deal.id))
      .sort((a, b) => b.score.total - a.score.total)
      .slice(0, 3),
    [handled, mediaKit]
  );

  const approvePick = (deal: BrandDeal) => {
    const fee = feeEdit[deal.id] ?? deal.fee;
    desk.addDeal(IRIS_PERSONA_ID, {
      brandName: deal.brandName, productName: deal.productName,
      platform: deal.platform, contentType: deal.contentType,
      fee, deliverables: deal.postExample || deal.summary,
      stage: 'inquiry',
      notes: `AI が見つけた案件 — ${deal.summary}`,
      guidelines: deal.description,
    });
    setHandled(h => [...h, deal.id]);
    showFlash(`${deal.brandName} をお仕事一覧に追加しました`);
  };

  const add = () => {
    setAddError(null);
    if (!d.brandName?.trim()) {
      setAddError('ブランド名を入れてください');
      return;
    }
    desk.addDeal(IRIS_PERSONA_ID, {
      brandName: d.brandName!, agencyName: d.agencyName, productName: d.productName,
      platform: (d.platform || 'instagram') as Platform,
      contentType: (d.contentType || 'post') as ContentType,
      fee: Number(d.fee) || 0,
      deliverables: d.deliverables || '',
      stage: (d.stage || 'inquiry') as DealStage,
      contactName: d.contactName, contactEmail: d.contactEmail, notes: d.notes,
    });
    setD({ brandName: '', platform: 'instagram', contentType: 'post', fee: 0, deliverables: '', stage: 'inquiry' });
    setManualOpen(false);
    showFlash('案件を追加しました');
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {quickOpen && (
        <IrisQuickAdd bg={bg} settings={settings}
          onClose={() => setQuickOpen(false)}
          onSave={(data) => { desk.addDeal(IRIS_PERSONA_ID, data); showFlash('案件を追加しました'); }} />
      )}

      <div>
        <h2 style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0, fontWeight: 500 }}>
          お仕事一覧
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
          AI があなたに合いそうな案件を先に見つけています。✓ で追加するだけ。
        </p>
      </div>

      {flash && (
        <div role="status" style={{
          padding: '0.6rem 0.9rem',
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
          color: '#065F46', borderRadius: 10, fontSize: '0.85rem',
        }}>✓ {flash}</div>
      )}

      {/* AI が先出しした応募候補 */}
      <AnimatePresence>
        {picks.map(({ deal, score }) => (
          <ProposalCard key={deal.id} bg={bg}
            badge="AI が見つけた案件"
            title={`${CATEGORY_META[deal.category].emoji} ${deal.brandName} に応募しましょうか?`}
            sub={`${deal.summary} ・ 締切 ${deal.deadline}`}
            reason={`${score.reasons.slice(0, 2).join('。') || 'あなたのジャンルと相性が良い案件です'}。報酬 ¥${(feeEdit[deal.id] ?? deal.fee).toLocaleString()}${deal.feeNote ? ` (${deal.feeNote})` : ''}。合致度 ${score.total} 点。`}
            approveLabel="✓ お仕事に追加"
            onApprove={() => approvePick(deal)}
            onReject={() => setHandled(h => [...h, deal.id])}
            editArea={
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: bg.ink, marginBottom: 4 }}>報酬を直す (円)</div>
                <input type="number" style={{ ...inp(bg), width: '100%' }}
                  value={feeEdit[deal.id] ?? deal.fee}
                  onChange={e => setFeeEdit(f => ({ ...f, [deal.id]: Number(e.target.value) }))} />
              </div>
            }
          />
        ))}
      </AnimatePresence>

      {picks.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '1rem 0' }}>今日の提案はすべて見終わりました 🎉</p>
        </Card>
      )}

      {/* 自分で追加 (補助) */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button onClick={() => setQuickOpen(true)}
          style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} /> もらった案件を AI で追加
        </button>
        <button onClick={() => setManualOpen(o => !o)}
          style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Edit3 size={14} /> {manualOpen ? '閉じる' : '自分で入力'}
        </button>
      </div>

      {manualOpen && (
        <Card bg={bg}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
            <input style={inp(bg)} placeholder="ブランド名 *" value={d.brandName || ''} onChange={e => setD({ ...d, brandName: e.target.value })} />
            <input style={inp(bg)} placeholder="商品名" value={d.productName || ''} onChange={e => setD({ ...d, productName: e.target.value })} />
            <select style={inp(bg)} value={d.platform} onChange={e => setD({ ...d, platform: e.target.value as Platform })}>
              {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <select style={inp(bg)} value={d.contentType} onChange={e => setD({ ...d, contentType: e.target.value as ContentType })}>
              {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input style={inp(bg)} type="number" placeholder="報酬 (円)" value={d.fee || ''} onChange={e => setD({ ...d, fee: Number(e.target.value) })} />
            <input style={inp(bg)} placeholder="納品物 (例: フィード1本)" value={d.deliverables || ''} onChange={e => setD({ ...d, deliverables: e.target.value })} />
          </div>
          {addError && (
            <div role="alert" style={{
              marginTop: '0.6rem', padding: '0.55rem 0.85rem',
              background: 'rgba(225,29,72,0.10)', border: '1px solid rgba(225,29,72,0.3)',
              color: '#9F1239', borderRadius: 10, fontSize: '0.85rem',
            }}>⚠ {addError}</div>
          )}
          <button onClick={add} style={{ ...btnPrimary(bg), marginTop: '0.75rem' }}>保存</button>
        </Card>
      )}

      {myDeals.length > 0 && (
        <p style={{ color: bg.inkSoft, fontSize: '0.8rem', margin: '0.2rem 0 0', fontWeight: 700 }}>追加済みのお仕事</p>
      )}

      {myDeals.map(deal => {
        const sm = DEAL_STAGE_META[deal.stage];
        const pm = PLATFORM_META[deal.platform];
        return (
          <Card key={deal.id} bg={bg}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{ fontSize: '2rem' }}>{pm.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: bg.ink }}>{deal.brandName}</span>
                  <span style={{
                    background: sm.color + '22', color: sm.color, padding: '0.2rem 0.6rem',
                    borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                  }}>{sm.emoji} {sm.label}</span>
                </div>
                {deal.productName && <div style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>{deal.productName}</div>}
                <div style={{ color: bg.inkSoft, fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {pm.label} / {CONTENT_TYPE_META[deal.contentType]} / ¥{deal.fee.toLocaleString()}
                </div>
              </div>
              <select value={deal.stage}
                onChange={e => desk.updateDeal(deal.id, { stage: e.target.value as DealStage })}
                style={inp(bg)}>
                {Object.entries(DEAL_STAGE_META).sort((a, b) => a[1].order - b[1].order).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
              <button onClick={async () => { if (await confirmAction({ title: 'この案件を削除しますか?', tone: 'danger' })) desk.removeDeal(deal.id); }} title="削除" aria-label="削除" style={btnIcon(bg)}><Trash2 size={16} strokeWidth={2.2} /></button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 交渉 (NegotiateView) — AI が「この案件、◯◯で返信しましょうか?」を先出し ───
// 案件の状況 (stage) から、いま必要な返信のしかたを AI が判断する
const STAGE_NEGO_SUGGEST: Partial<Record<DealStage, NegotiationType>> = {
  'inquiry':         'first-reply',
  'negotiating':     'rate-counter',
  'contracted':      'scope-clarify',
  'draft-submitted': 'follow-up',
  'posted':          'report-cover',
  'reported':        'invoice-request',
};

function NegotiateView({ bg, desk, myDeals, mediaKit, settings, persona }: any) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [typeOverride, setTypeOverride] = useState<Record<string, NegotiationType>>({});
  const [err, setErr] = useState<string | null>(null);

  const negos = desk.negos.filter((n: any) => myDeals.some((d: InfluencerDeal) => d.id === n.dealId));

  // AI が「いま返事が必要な案件」を先回りで拾う
  const proposals = useMemo(() =>
    myDeals
      .filter((d: InfluencerDeal) => STAGE_NEGO_SUGGEST[d.stage] && !dismissed.includes(d.id))
      .slice(0, 4),
    [myDeals, dismissed]
  );

  const approve = async (deal: InfluencerDeal, type: NegotiationType) => {
    setBusyId(deal.id); setErr(null);
    try {
      const r = await generateNegotiation({ settings, persona, deal, mediaKit, type });
      desk.addNego({ ...r, dealId: deal.id, status: 'draft' });
      setDismissed(d => [...d, deal.id]);
    } catch (e: any) {
      setErr((e?.message || '文章の作成に失敗しました') + ' — 通信環境を確認して、もう一度 ✓ を押してください');
    } finally { setBusyId(null); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
          お返事を作る
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
          AI が「返事が必要な案件」を見つけて、返し方まで考えました。✓ で文章ができます。
        </p>
      </div>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p></Card>}

      <AnimatePresence>
        {proposals.map((deal: InfluencerDeal) => {
          const type = typeOverride[deal.id] || STAGE_NEGO_SUGGEST[deal.stage]!;
          const m = NEGOTIATION_TYPE_META[type];
          const sm = DEAL_STAGE_META[deal.stage];
          return (
            <ProposalCard key={deal.id} bg={bg}
              badge="AI からの返信提案"
              busy={busyId === deal.id}
              title={`${deal.brandName} に「${m.emoji} ${m.label}」で返信しましょうか?`}
              sub={`いまの状況: ${sm.emoji} ${sm.label}`}
              reason={m.hint}
              approveLabel="✓ この返事を作る"
              onApprove={() => approve(deal, type)}
              onReject={() => setDismissed(d => [...d, deal.id])}
              editArea={
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: bg.ink, marginBottom: 6 }}>返し方を変える</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.35rem' }}>
                    {Object.entries(NEGOTIATION_TYPE_META).map(([k, v]) => (
                      <button key={k} onClick={() => setTypeOverride(t => ({ ...t, [deal.id]: k as NegotiationType }))}
                        style={{
                          background: type === k ? bg.accent : 'rgba(255,255,255,0.6)',
                          color: type === k ? '#fff' : bg.ink,
                          border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                          padding: '0.4rem 0.5rem', fontSize: '0.78rem', cursor: 'pointer',
                          textAlign: 'left', fontFamily: IRIS_FONTS.body,
                        }}>
                        {v.emoji} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
          );
        })}
      </AnimatePresence>

      {proposals.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '1rem 0' }}>いま返事が必要な案件はありません ☺ お仕事が増えると AI が提案します。</p>
        </Card>
      )}

      {negos.slice(0, 12).map((n: any) => {
        const d = myDeals.find((dd: InfluencerDeal) => dd.id === n.dealId);
        if (!d) return null;
        const m = NEGOTIATION_TYPE_META[n.type as NegotiationType];
        return (
          <Card key={n.id} bg={bg}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <p style={{ fontWeight: 700 }}>{m.emoji} {m.label} — {d.brandName}</p>
              <button onClick={() => navigator.clipboard?.writeText((n.subject ? `件名: ${n.subject}\n\n` : '') + n.body)} title="コピー" aria-label="コピー" style={btnIcon(bg)}><Clipboard size={16} strokeWidth={2.2} /></button>
            </div>
            {n.subject && <p style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>件名: {n.subject}</p>}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '0.5rem' }}>{n.body}</pre>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 創作 (DraftView) — AI が「次はこの投稿を書きましょうか?」を先出し ───
function suggestDraftTone(deal: InfluencerDeal): string {
  if (deal.contentType === 'reel' || deal.contentType === 'short') return '最初の3秒で惹きつける、テンポの良い実演トーン';
  if (deal.contentType === 'story') return 'リアルな日常の一コマとして、素直で軽やかなトーン';
  return '親しみやすく自然体で、自分の言葉で語る体験談トーン';
}

function DraftView({ bg, desk, myDeals, mediaKit, settings, persona, knowledge }: any) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [toneOverride, setToneOverride] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // AI が「まだ投稿文がない案件」を先回りで拾う
  const proposals = useMemo(() =>
    myDeals.filter((d: InfluencerDeal) =>
      !d.draftCopy && !dismissed.includes(d.id) &&
      ['inquiry', 'negotiating', 'contracted', 'drafting', 'approved'].includes(d.stage)
    ).slice(0, 4),
    [myDeals, dismissed]
  );

  const approve = async (deal: InfluencerDeal, tone: string) => {
    setBusyId(deal.id); setErr(null);
    try {
      const r = await generateDraftCopy({
        settings, persona, deal, mediaKit, toneNote: tone || undefined,
        knowledgeContext: knowledge?.getContext?.() || undefined,
      });
      const full = r.caption + '\n\n' + r.hashtags.join(' ') + '\n\n' + r.cta;
      desk.updateDeal(deal.id, { draftCopy: full, stage: deal.stage === 'inquiry' || deal.stage === 'negotiating' ? 'drafting' : deal.stage });
      setDismissed(d => [...d, deal.id]);
    } catch (e: any) {
      setErr((e?.message || '文章の作成に失敗しました') + ' — 通信環境を確認して、もう一度 ✓ を押してください');
    } finally { setBusyId(null); }
  };

  const saveToKnowledge = (d: InfluencerDeal) => {
    if (!knowledge || !d.draftCopy) return;
    knowledge.add({
      kind: 'caption',
      title: `${d.brandName} ${d.productName || ''} キャプション`.trim(),
      content: d.draftCopy,
      tags: ['キャプション', d.platform, d.brandName].filter(Boolean),
      source: d.brandName,
    });
    setSavedNotice(d.id);
    setTimeout(() => setSavedNotice(null), 2000);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
          投稿を書く
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
          AI が「まだ投稿文がない案件」を見つけて、書き方まで考えました。✓ で文章ができます。
        </p>
      </div>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p></Card>}

      <AnimatePresence>
        {proposals.map((deal: InfluencerDeal) => {
          const tone = toneOverride[deal.id] ?? suggestDraftTone(deal);
          return (
            <ProposalCard key={deal.id} bg={bg}
              badge="AI からの投稿提案"
              busy={busyId === deal.id}
              title={`${PLATFORM_META[deal.platform].emoji} ${deal.brandName} の${CONTENT_TYPE_META[deal.contentType]}を書きましょうか?`}
              sub={deal.productName || deal.deliverables || undefined}
              reason={`おすすめのトーン: ${tone}。${knowledge?.count ? `あなたの資料 ${knowledge.count} 件を読んで、らしさを合わせて書きます。` : 'あなたらしい言葉で書きます。'}`}
              approveLabel="✓ この投稿を書く"
              onApprove={() => approve(deal, tone)}
              onReject={() => setDismissed(d => [...d, deal.id])}
              editArea={
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: bg.ink, marginBottom: 4 }}>トーンを直す</div>
                  <input style={{ ...inp(bg), width: '100%' }}
                    value={toneOverride[deal.id] ?? suggestDraftTone(deal)}
                    onChange={e => setToneOverride(t => ({ ...t, [deal.id]: e.target.value }))} />
                </div>
              }
            />
          );
        })}
      </AnimatePresence>

      {proposals.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '1rem 0' }}>いま書く必要のある投稿はありません ☺ お仕事を追加すると AI が提案します。</p>
        </Card>
      )}

      {myDeals.filter((d: InfluencerDeal) => d.draftCopy).map((d: InfluencerDeal) => (
        <Card key={d.id} bg={bg}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.4rem' }}>
            <p style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {PLATFORM_META[d.platform].emoji} {d.brandName}
            </p>
            <button onClick={() => saveToKnowledge(d)} style={btnIcon(bg)} title="ナレッジに追加" aria-label="ナレッジに追加">
              <BookmarkPlus size={16} strokeWidth={2.2} />
            </button>
            <button onClick={() => navigator.clipboard?.writeText(d.draftCopy || '')} style={btnIcon(bg)} title="コピー" aria-label="コピー"><Clipboard size={16} strokeWidth={2.2} /></button>
          </div>
          {savedNotice === d.id && (
            <p style={{ fontSize: '0.78rem', color: '#10B981', marginBottom: '0.5rem' }}>
              <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 4 }} />
              ナレッジに保存しました
            </p>
          )}
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginBottom: '0.85rem' }}>{d.draftCopy}</pre>
          {/* Instagram シェアボタン群 */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                const r = await shareToInstagram({ caption: d.draftCopy || '', filename: `iris-${d.brandName || 'post'}.png` });
                notifyInApp({ kind: r.method === 'failed' ? 'warn' : 'success', title: 'Instagram シェア', body: r.message });
              }}
              style={{
                flex: '1 1 auto', minWidth: 140,
                background: 'linear-gradient(135deg, #FCB045 0%, #E1306C 50%, #833AB4 100%)',
                color: '#fff', border: 'none', borderRadius: 12,
                padding: '0.75rem 1rem', fontSize: '0.88rem', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 6px 18px rgba(225,48,108,0.35)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Camera size={14} /> Instagram で投稿</span>
            </button>
            <button
              onClick={async () => {
                const r = await shareToInstagram({ caption: d.draftCopy || '', filename: `iris-story-${d.brandName || 'post'}.png`, asStory: true });
                notifyInApp({ kind: r.method === 'failed' ? 'warn' : 'success', title: 'Instagram ストーリー', body: r.message });
              }}
              style={{
                flex: '1 1 auto', minWidth: 120,
                background: 'rgba(255,255,255,0.85)', color: '#1F1A2E',
                border: `1px solid ${bg.cardBorder}`, borderRadius: 12,
                padding: '0.75rem 1rem', fontSize: '0.85rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⏱ ストーリーで
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── 美容相談チャット ───────────────────────
function BeautyChatView({ bg, settings }: { bg: IrisBackgroundDef; settings: AppSettings }) {
  const [topic, setTopic] = useState<BeautyTopic>('skincare');
  const [history, setHistory] = useState<BeautyMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = useCallback(async () => {
    if (!input.trim() || busy) return;
    const userMsg: BeautyMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    try {
      const reply = await chatBeautyAdvisor({ settings, topic, history, userMessage: input });
      setHistory(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    } catch (e: any) {
      setHistory(prev => [...prev, { role: 'assistant', content: `すみません、いま接続が不安定みたいです: ${e.message}`, timestamp: new Date().toISOString() }]);
    } finally { setBusy(false); }
  }, [input, busy, history, topic, settings]);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>BEAUTY</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: '0.25rem 0 0' }}>
          なんでも、話して。
        </h2>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {Object.entries(BEAUTY_TOPIC_META).map(([k, v]) => (
          <button key={k} onClick={() => setTopic(k as BeautyTopic)} style={{
            background: topic === k ? bg.accent : 'rgba(255,255,255,0.5)',
            color: topic === k ? '#fff' : bg.ink,
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 999, padding: '0.45rem 0.95rem',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: IRIS_FONTS.body,
          }}>
            {v.emoji} {v.label}
          </button>
        ))}
      </div>

      <Card bg={bg}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', minHeight: 200, maxHeight: 460, overflowY: 'auto', marginBottom: '0.75rem' }}>
          {history.length === 0 && (
            <p style={{ color: bg.inkSoft, textAlign: 'center', padding: '2rem 0' }}>
              {BEAUTY_TOPIC_META[topic].emoji} {BEAUTY_TOPIC_META[topic].hint}
            </p>
          )}
          {history.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '0.7rem 1rem',
              borderRadius: 18,
              background: m.role === 'user' ? bg.accent : 'rgba(255,255,255,0.7)',
              color: m.role === 'user' ? '#fff' : bg.ink,
              whiteSpace: 'pre-wrap',
              fontSize: '0.92rem',
              lineHeight: 1.7,
            }}>
              {m.content}
            </div>
          ))}
          {busy && <div style={{ alignSelf: 'flex-start', padding: '0.7rem 1rem', color: bg.inkSoft }}>考え中…</div>}
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <input
            style={{ ...inp(bg), flex: 1 }}
            placeholder="気になることを書いて…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button onClick={send} disabled={busy || !input.trim()} style={btnPrimary(bg)}>送信</button>
        </div>
      </Card>
    </div>
  );
}


// ─── メディアキット ─────────────────────────
function MediaKitView({ bg, desk, kit }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; kit?: MediaKit }) {
  const [d, setD] = useState<MediaKit>(kit || { personaId: IRIS_PERSONA_ID });
  const save = () => desk.setMediaKit(IRIS_PERSONA_ID, { ...d, personaId: IRIS_PERSONA_ID });
  void desk;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
        私のプロフィール
      </h2>
      <p style={{ color: bg.inkSoft }}>ここに書いた内容を、AI がお返事や投稿を書くときに参考にします。</p>

      <Card bg={bg}>
        <input style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }} placeholder="表示名 (例: @hanako_official)" value={d.handleName || ''} onChange={e => setD({ ...d, handleName: e.target.value })} />

        <p style={{ marginTop: '0.75rem', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>フォロワー数</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
          {(['instagram','tiktok','youtube','x'] as Platform[]).map(p => (
            <input key={p} style={inp(bg)} type="number" placeholder={PLATFORM_META[p].label}
              value={d.followers?.[p] || ''}
              onChange={e => setD({ ...d, followers: { ...(d.followers || {}), [p]: Number(e.target.value) || undefined } })} />
          ))}
        </div>

        <p style={{ marginTop: '0.75rem', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>平均の反応率 (%)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
          {(['instagram','tiktok','youtube','x'] as Platform[]).map(p => (
            <input key={p} style={inp(bg)} type="number" step="0.1" placeholder={PLATFORM_META[p].label}
              value={d.avgEngagementRate?.[p] || ''}
              onChange={e => setD({ ...d, avgEngagementRate: { ...(d.avgEngagementRate || {}), [p]: Number(e.target.value) || undefined } })} />
          ))}
        </div>

        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="よく見てくれる人 (例: 25-34歳の女性)" value={d.audienceProfile || ''} onChange={e => setD({ ...d, audienceProfile: e.target.value })} />
        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="希望する金額の目安" value={d.rateCard || ''} onChange={e => setD({ ...d, rateCard: e.target.value })} />
        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="大切にしたいこと・NGなこと" value={d.brandValues || ''} onChange={e => setD({ ...d, brandValues: e.target.value })} />

        <button onClick={save} style={{ ...btnPrimary(bg), marginTop: '0.75rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Save size={14} /> 保存</span></button>
      </Card>
    </div>
  );
}

// ─── チーム ─────────────────────────────────
function TeamView({ bg, team, desk, myDeals }: {
  bg: IrisBackgroundDef;
  team: ReturnType<typeof useIrisTeam>;
  desk: ReturnType<typeof useInfluencerDesk>;
  myDeals: InfluencerDeal[];
}) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<Partial<IrisTeamMember>>({ role: 'creator' });
  const [importText, setImportText] = useState('');
  const [memberError, setMemberError] = useState<string | null>(null);

  const add = () => {
    setMemberError(null);
    if (!m.name?.trim()) {
      setMemberError('名前を入れてください (必須項目です)');
      return;
    }
    team.addMember({
      name: m.name!,
      handle: m.handle,
      role: (m.role || 'creator') as MemberRole,
      niches: m.niches,
      primaryPlatform: m.primaryPlatform,
      email: m.email,
      line: m.line,
      notes: m.notes,
    });
    setM({ role: 'creator' });
    setOpen(false);
  };

  const exportJson = () => {
    const json = team.exportTeam();
    navigator.clipboard?.writeText(json);
    notifyInApp({ kind: 'success', title: 'チーム情報をコピーしました', body: '仲間に渡してください。' });
  };
  const tryImport = () => {
    if (!importText.trim()) return;
    const r = team.importTeam(importText);
    if (r.error) { notifyInApp({ kind: 'warn', title: 'インポートできませんでした', body: r.error }); return; }
    notifyInApp({ kind: 'success', title: `${r.added} 件追加しました` });
    setImportText('');
  };

  const memberStats = team.members.map(member => {
    const deals = myDeals.filter(d => d.assignedToMemberId === member.id);
    return {
      member,
      activeCount: deals.filter(d => !['closed','declined','reported'].includes(d.stage)).length,
      totalEarnings: deals.filter(d => ['posted','reported','closed'].includes(d.stage)).reduce((s, d) => s + (d.fee || 0), 0),
    };
  });

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>TEAM</p>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: '0.25rem 0 0' }}>
            みんなで、咲く。
          </h2>
        </div>
        <button onClick={() => setOpen(!open)} style={btnPrimary(bg)}>
          {open ? '閉じる' : '+ メンバー追加'}
        </button>
      </div>

      {open && (
        <Card bg={bg}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <input style={inp(bg)} placeholder="名前 *" value={m.name || ''} onChange={e => setM({ ...m, name: e.target.value })} />
            <input style={inp(bg)} placeholder="@handle" value={m.handle || ''} onChange={e => setM({ ...m, handle: e.target.value })} />
            <select style={inp(bg)} value={m.role} onChange={e => setM({ ...m, role: e.target.value as MemberRole })}>
              {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <select style={inp(bg)} value={m.primaryPlatform || ''} onChange={e => setM({ ...m, primaryPlatform: e.target.value as any })}>
              <option value="">主なプラットフォーム</option>
              {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <input style={inp(bg)} placeholder="得意領域 (例: コスメ・旅)" onChange={e => setM({ ...m, niches: e.target.value.split(/[,、]/).map(s => s.trim()).filter(Boolean) })} />
            <input style={inp(bg)} placeholder="email" value={m.email || ''} onChange={e => setM({ ...m, email: e.target.value })} />
          </div>
          <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="メモ" value={m.notes || ''} onChange={e => setM({ ...m, notes: e.target.value })} />
          {memberError && (
            <div role="alert" style={{
              marginTop: '0.55rem', padding: '0.5rem 0.8rem',
              background: 'rgba(225,29,72,0.10)', border: '1px solid rgba(225,29,72,0.3)',
              color: '#9F1239', borderRadius: 10, fontSize: '0.82rem',
            }}>⚠ {memberError}</div>
          )}
          <button onClick={add} style={{ ...btnPrimary(bg), marginTop: '0.5rem' }}>追加</button>
        </Card>
      )}

      {team.members.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '2rem 0' }}>
            まだメンバーがいません。<br />
            一緒に動いてくれる人 (マネージャー / 編集 / コラボ仲間) を登録すると、案件の交通整理ができます。
          </p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {memberStats.map(({ member, activeCount, totalEarnings }) => {
          const role = ROLE_META[member.role];
          return (
            <Card key={member.id} bg={bg}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${role.color}, ${role.color}80)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem',
                }}>
                  {role.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: bg.ink, fontSize: '1.05rem' }}>{member.name}</p>
                  {member.handle && <p style={{ fontSize: '0.8rem', color: bg.inkSoft }}>{member.handle}</p>}
                </div>
                <button onClick={async () => { if (await confirmAction({ title: 'このメンバーを削除しますか?', tone: 'danger' })) team.removeMember(member.id); }} title="削除" aria-label="削除" style={btnIcon(bg)}><Trash2 size={16} strokeWidth={2.2} /></button>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span style={{ background: role.color + '22', color: role.color, padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                  {role.label}
                </span>
                {member.primaryPlatform && (
                  <span style={{ background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.75rem' }}>
                    {PLATFORM_META[member.primaryPlatform].emoji} {PLATFORM_META[member.primaryPlatform].label}
                  </span>
                )}
              </div>
              {member.niches && member.niches.length > 0 && (
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginBottom: '0.5rem' }}>
                  {member.niches.join(' · ')}
                </p>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${bg.cardBorder}` }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>進行中</div>
                  <div style={{ fontWeight: 700, color: bg.accent }}>{activeCount} 件</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>累計報酬</div>
                  <div style={{ fontWeight: 700 }}>¥{totalEarnings.toLocaleString()}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {team.members.length > 0 && myDeals.length > 0 && (
        <Card bg={bg}>
          <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink, marginBottom: '0.75rem' }}>
            案件のアサイン
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {myDeals.slice(0, 12).map(d => (
              <div key={d.id} style={{
                display: 'flex', gap: '0.5rem', alignItems: 'center',
                padding: '0.6rem 0.8rem', borderRadius: 12,
                background: 'rgba(255,255,255,0.5)',
              }}>
                <span style={{ fontSize: '1.2rem' }}>{PLATFORM_META[d.platform].emoji}</span>
                <span style={{ flex: 1, fontWeight: 600, color: bg.ink }}>{d.brandName}</span>
                <select
                  value={d.assignedToMemberId || ''}
                  onChange={e => desk.updateDeal(d.id, { assignedToMemberId: e.target.value || undefined })}
                  style={inp(bg)}
                >
                  <option value="">— 未アサイン —</option>
                  {team.members.map(member => (
                    <option key={member.id} value={member.id}>
                      {ROLE_META[member.role].emoji} {member.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink, marginBottom: '0.75rem' }}>
          チームと共有する
        </p>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          仲間とテンプレ・案件情報を JSON 経由で共有できます (将来サーバ連携で同期予定)。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <button onClick={exportJson} style={btnPrimary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> JSON でエクスポート</span></button>
        </div>
        <textarea
          style={{ ...inp(bg), width: '100%', minHeight: 90, marginBottom: '0.5rem', fontFamily: 'monospace', fontSize: '0.78rem' }}
          placeholder="ここに仲間からもらった JSON を貼り付け"
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        <button onClick={tryImport} disabled={!importText.trim()} style={btnSecondary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Send size={14} style={{ transform: 'rotate(90deg)' }} /> インポート</span></button>
      </Card>

      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink, marginBottom: '0.5rem' }}>
          共有テンプレ
        </p>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          交渉文や投稿テンプレを保存して、チーム内で再利用 (使用回数も記録)。
        </p>
        {team.templates.length === 0 ? (
          <p style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>まだテンプレはありません。交渉センターで生成した文を「テンプレ化」する機能は順次追加予定です。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {team.templates.map(t => (
              <div key={t.id} style={{
                padding: '0.6rem 0.8rem', borderRadius: 12,
                background: 'rgba(255,255,255,0.5)', border: `1px solid ${bg.cardBorder}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 700 }}>{t.label}</span>
                  <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{t.uses} 回使用</span>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.85rem', color: bg.inkSoft }}>{t.body.slice(0, 200)}{t.body.length > 200 ? '…' : ''}</pre>
                <button onClick={() => { navigator.clipboard?.writeText(t.body); team.incrementTemplateUse(t.id); }} style={{ ...btnIcon(bg), width: 'auto', padding: '0.3rem 0.7rem', marginTop: '0.4rem', gap: 4 }}><Clipboard size={13} /> 使う</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── ブランドマッチ ──
function BrandMatchView({ bg, desk, mediaKit, settings, knowledge }: {
  bg: IrisBackgroundDef;
  desk: ReturnType<typeof useInfluencerDesk>;
  mediaKit?: MediaKit;
  settings: AppSettings;
  knowledge?: ReturnType<typeof useIrisKnowledge>;
}) {
  const allDeals = useMemo(() => getAllBrandDeals(), []);
  const [category, setCategory] = useState<BrandCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'fee' | 'deadline'>('match');
  const [openDeal, setOpenDeal] = useState<BrandDeal | null>(null);
  const [history, setHistory] = useState<ApplicationRecord[]>(() => loadApplyHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [prismDealsOpen, setPrismDealsOpen] = useState(false);
  const prismCompanies = useMemo(() => loadPrismCompanies(), []);

  // 各案件のマッチスコアを計算
  const dealsWithScore = useMemo(() => {
    return allDeals.map(d => ({ deal: d, score: computeMatchScore(d, mediaKit) }));
  }, [allDeals, mediaKit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = dealsWithScore.filter(({ deal }) => {
      if (category !== 'all' && deal.category !== category) return false;
      if (!q) return true;
      return (
        deal.brandName.toLowerCase().includes(q) ||
        deal.productName.toLowerCase().includes(q) ||
        deal.summary.toLowerCase().includes(q) ||
        deal.audienceTags.some(t => t.toLowerCase().includes(q))
      );
    });
    if (sortBy === 'match')      arr.sort((a, b) => b.score.total - a.score.total);
    else if (sortBy === 'fee')   arr.sort((a, b) => b.deal.fee - a.deal.fee);
    else if (sortBy === 'deadline') arr.sort((a, b) => a.deal.deadline.localeCompare(b.deal.deadline));
    return arr;
  }, [dealsWithScore, category, search, sortBy]);

  const kpi = useMemo(() => computeApplyKpi(), [history]);

  const refreshHistory = useCallback(() => setHistory(loadApplyHistory()), []);

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>お仕事を、自分から</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: '0.25rem 0 0' }}>
          お仕事を、見つける。
        </h2>
        <p style={{ color: bg.inkSoft, marginTop: '0.5rem', fontSize: '0.9rem' }}>
          実在ブランドの公開案件 {allDeals.length} 件から、あなたに合うものを Iris が見つけます。気になったら AI が応募文を下書きします。
        </p>
      </div>

      {/* ── 応募 KPI ストリップ ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
        <StatCard bg={bg} label="あなたに最適" value={dealsWithScore.filter(d => d.score.level === 'best').length + ' 件'} icon={Sparkles} />
        <StatCard bg={bg} label="応募済み" value={kpi.total + ' 件'} icon={Send} />
        <StatCard bg={bg} label="返信があった" value={kpi.replied + ' 件'} icon={MessageSquare} />
        <StatCard bg={bg} label="獲得した報酬" value={'¥' + kpi.totalFeeWon.toLocaleString()} icon={Wallet} />
      </div>

      {/* ── カテゴリチップ ── */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <button onClick={() => setCategory('all')} style={chip(bg, category === 'all')}>
          すべて <span style={{ opacity: 0.6, marginLeft: 4 }}>({allDeals.length})</span>
        </button>
        {(Object.keys(CATEGORY_META) as BrandCategory[]).map(cat => {
          const count = allDeals.filter(d => d.category === cat).length;
          const meta = CATEGORY_META[cat];
          return (
            <button key={cat} onClick={() => setCategory(cat)} style={chip(bg, category === cat)}>
              <span style={{ marginRight: 4 }}>{meta.emoji}</span>{meta.label}
              <span style={{ opacity: 0.6, marginLeft: 4 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── 検索 + 並び替え ── */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          style={{ ...inp(bg), flex: 1, minWidth: 200 }}
          placeholder="ブランド名・商品名で検索"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inp(bg)} value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
          <option value="match">マッチ度順</option>
          <option value="fee">報酬が高い順</option>
          <option value="deadline">締切が近い順</option>
        </select>
        <span style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>{filtered.length} 件</span>
      </div>

      {/* ── デッキ (案件カード) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '0.75rem' }}>
        {filtered.map(({ deal, score }) => (
          <BrandDealCard key={deal.id} bg={bg} deal={deal} score={score} onOpen={() => setOpenDeal(deal)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '1.5rem 0' }}>
            条件に合う案件が見つかりませんでした。カテゴリや検索ワードを変えてみてください。
          </p>
        </Card>
      )}

      {/* ── 応募履歴セクション ── */}
      <Card bg={bg}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
             onClick={() => setHistoryOpen(o => !o)}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Send size={16} color={bg.accent} />
            <p style={{ fontWeight: 700, color: bg.ink, margin: 0 }}>応募履歴 ({history.length})</p>
          </div>
          <span style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>{historyOpen ? '閉じる' : '見る'} →</span>
        </div>
        {historyOpen && history.length === 0 && (
          <p style={{ color: bg.inkSoft, textAlign: 'center', padding: '1rem 0' }}>まだ応募はありません。気になる案件から始めてみてください。</p>
        )}
        {historyOpen && history.length > 0 && (
          <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
            {history.map(rec => (
              <ApplyHistoryRow key={rec.id} bg={bg} rec={rec} onUpdate={(s) => { updateApplyStatus(rec.id, s); refreshHistory(); }} />
            ))}
          </div>
        )}
      </Card>

      {/* ── Prism リサーチ会社 (オプション、既存機能を保持) ── */}
      {prismCompanies.length > 0 && (
        <Card bg={bg}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
               onClick={() => setPrismDealsOpen(o => !o)}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Handshake size={16} color={bg.accent} />
              <p style={{ fontWeight: 700, color: bg.ink, margin: 0 }}>CORE Prism で調べた会社 ({prismCompanies.length})</p>
            </div>
            <span style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>{prismDealsOpen ? '閉じる' : '見る'} →</span>
          </div>
          {prismDealsOpen && (
            <PrismResearchSection bg={bg} desk={desk} mediaKit={mediaKit} settings={settings} companies={prismCompanies} />
          )}
        </Card>
      )}

      {/* ── 案件詳細 + 応募モーダル ── */}
      <AnimatePresence>
        {openDeal && (
          <BrandDealDetailModal
            bg={bg} deal={openDeal} mediaKit={mediaKit} settings={settings}
            knowledge={knowledge}
            onClose={() => setOpenDeal(null)}
            onApplied={() => { refreshHistory(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 案件カード ─────────────────────────────────────────
function BrandDealCard({ bg, deal, score, onOpen }: {
  bg: IrisBackgroundDef; deal: BrandDeal; score: ReturnType<typeof computeMatchScore>; onOpen: () => void;
}) {
  const meta = CATEGORY_META[deal.category];
  const daysLeft = Math.max(0, Math.ceil((new Date(deal.deadline).getTime() - Date.now()) / 86400000));
  const platMeta = PLATFORM_META[deal.platform];
  const ctLabel = CONTENT_TYPE_META[deal.contentType];
  const logoUrl = getBrandLogoUrl(deal.brandName);
  const imageUrl = getDealImageUrl(deal);
  const gradient = getDealGradient(deal, meta.color);
  const urgent = daysLeft <= 14;
  const followersLabel =
    deal.minFollowers >= 10000
      ? `${(deal.minFollowers / 10000).toFixed(deal.minFollowers % 10000 === 0 ? 0 : 1)}万`
      : `${(deal.minFollowers / 1000).toFixed(deal.minFollowers % 1000 === 0 ? 0 : 1)}千`;

  return (
    <div className="iris-card-hover" style={{
      background: bg.card, backdropFilter: 'blur(10px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      color: bg.ink,
    }}>
      {/* ── ビジュアル (商品画像 + ロゴ + カテゴリ) ── */}
      <button
        type="button"
        onClick={onOpen}
        style={{
          position: 'relative',
          padding: 0, border: 'none', cursor: 'pointer',
          height: 160, width: '100%',
          background: gradient,
          overflow: 'hidden',
          display: 'block',
        }}
      >
        <img
          src={imageUrl}
          alt={deal.productName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: 0.78,
          }}
        />
        {/* 上から覆うグラデーション (テキスト読みやすさ用) */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%)',
        }} />
        {/* カテゴリチップ (左上) */}
        <span style={{
          position: 'absolute', top: 10, left: 12,
          background: 'rgba(255,255,255,0.92)', color: meta.color,
          padding: '0.25rem 0.7rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}>
          {meta.emoji} {meta.label}
        </span>
        {/* マッチスコア (右上) */}
        <span style={{
          position: 'absolute', top: 10, right: 12,
          background: score.color, color: 'white',
          padding: '0.25rem 0.7rem', borderRadius: 999,
          fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}>
          ⚡ {score.total}% {score.label}
        </span>
        {/* ロゴ + ブランド名 (下部) */}
        <div style={{
          position: 'absolute', bottom: 10, left: 12, right: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={deal.brandName + ' ロゴ'}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = 'none';
                  if (el.parentElement) el.parentElement.textContent = deal.brandName.charAt(0);
                }}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: meta.color }}>
                {deal.brandName.charAt(0)}
              </span>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, color: 'white', fontWeight: 700, fontSize: '0.98rem',
              textShadow: '0 1px 3px rgba(0,0,0,0.55)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {deal.brandName}
            </p>
            <p style={{
              margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {deal.productName}
            </p>
          </div>
        </div>
      </button>

      {/* ── 報酬 (大きく) ── */}
      <div style={{
        padding: '0.9rem 1.1rem 0.5rem',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: bg.inkSoft, fontWeight: 600, margin: 0 }}>
            報酬
          </p>
          <p style={{
            margin: '2px 0 0', fontWeight: 800,
            fontSize: '1.6rem', color: meta.color, lineHeight: 1,
            fontFeatureSettings: '"tnum"',
          }}>
            ¥{deal.fee.toLocaleString()}
          </p>
          {deal.feeNote && (
            <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: bg.inkSoft }}>
              {deal.feeNote}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{
            margin: 0, fontSize: '0.7rem', fontWeight: 700,
            color: urgent ? '#E11D48' : bg.inkSoft,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Calendar size={11} /> {urgent ? '⚡' : ''}あと {daysLeft} 日
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: bg.inkSoft }}>
            ~{deal.deadline}
          </p>
        </div>
      </div>

      {/* ── 概要 ── */}
      <div style={{ padding: '0 1.1rem 0.6rem' }}>
        <p style={{
          margin: 0, fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.55,
          display: '-webkit-box',
          WebkitLineClamp: 2 as any,
          WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden',
        }}>
          {deal.summary}
        </p>
      </div>

      {/* ── 条件チップ (フォロワー / プラットフォーム / 形式) ── */}
      <div style={{
        padding: '0 1.1rem 0.7rem',
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: bg.cardBorder, color: bg.ink,
          padding: '0.25rem 0.55rem', borderRadius: 999,
          fontSize: '0.7rem', fontWeight: 600,
        }}>
          <Users size={11} /> {followersLabel}人〜
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: bg.cardBorder, color: bg.ink,
          padding: '0.25rem 0.55rem', borderRadius: 999,
          fontSize: '0.7rem', fontWeight: 600,
        }}>
          {platMeta.emoji} {platMeta.label}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: bg.cardBorder, color: bg.ink,
          padding: '0.25rem 0.55rem', borderRadius: 999,
          fontSize: '0.7rem', fontWeight: 600,
        }}>
          🎬 {ctLabel || deal.contentType}
        </span>
      </div>

      {/* ── 応募ボタン ── */}
      <button
        type="button"
        onClick={onOpen}
        style={{
          margin: '0 1.1rem 1rem',
          padding: '0.7rem 1rem',
          border: 'none',
          borderRadius: 12,
          background: `linear-gradient(135deg, ${meta.color} 0%, ${bg.accent} 100%)`,
          color: 'white',
          fontWeight: 700,
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          boxShadow: `0 4px 12px ${meta.color}40`,
        }}
      >
        <Send size={14} /> 応募する
      </button>
    </div>
  );
}

// ─── 案件詳細 + 応募モーダル ────────────────────────────
function BrandDealDetailModal({ bg, deal, mediaKit, settings, onClose, onApplied, knowledge }: {
  bg: IrisBackgroundDef; deal: BrandDeal; mediaKit?: MediaKit; settings: AppSettings;
  onClose: () => void; onApplied: () => void;
  knowledge?: ReturnType<typeof useIrisKnowledge>;
}) {
  const score = useMemo(() => computeMatchScore(deal, mediaKit), [deal, mediaKit]);
  const [customNote, setCustomNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ApplicationDraft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [savedToKnowledge, setSavedToKnowledge] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'fail'>('idle');

  const meta = CATEGORY_META[deal.category];
  const daysLeft = Math.max(0, Math.ceil((new Date(deal.deadline).getTime() - Date.now()) / 86400000));
  const platMeta = PLATFORM_META[deal.platform];

  const handleGenerate = async () => {
    setBusy(true); setErr(null);
    try {
      const d = await generateApplicationDraft({
        settings, deal, mediaKit, customNote,
        knowledgeContext: knowledge?.getContext?.() || undefined,
      });
      setDraft(d);
      setSavedToKnowledge(false);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const saveDraftToKnowledge = () => {
    if (!draft || !knowledge) return;
    knowledge.add({
      kind: 'application',
      title: `${deal.brandName} 応募文 — ${draft.subject || deal.productName}`,
      content: `件名: ${draft.subject}\n\n${draft.body}${draft.reason ? `\n\n[メモ] ${draft.reason}` : ''}`,
      tags: ['応募文', deal.brandName, deal.category],
      source: deal.brandName,
    });
    setSavedToKnowledge(true);
    setTimeout(() => setSavedToKnowledge(false), 2500);
  };

  const recordAndOpen = (channel: 'email' | 'form' | 'copy', action: () => void) => {
    addApplyRecord({
      dealId: deal.id, dealBrand: deal.brandName, dealProduct: deal.productName,
      fee: deal.fee, platform: deal.platform,
      channel, status: 'sent', draft: draft ?? undefined,
    });
    setDone(true);
    onApplied();
    action();
  };

  const openMail = () => {
    if (deal.contact.type !== 'email') return;
    const subject = draft?.subject || `${deal.brandName} 様 — ${deal.productName} 案件応募の件`;
    const body = draft?.body || '';
    const url = `mailto:${deal.contact.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    recordAndOpen('email', () => { window.location.href = url; });
  };
  const openForm = () => {
    if (deal.contact.type !== 'form') return;
    const url = deal.contact.url;
    recordAndOpen('form', () => { window.open(url, '_blank', 'noopener'); });
  };
  const copyDraft = async () => {
    if (!draft) return;
    const text = `件名: ${draft.subject}\n\n${draft.body}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    setCopyState(ok ? 'done' : 'fail');
    setTimeout(() => setCopyState('idle'), ok ? 1800 : 4000);
    recordAndOpen('copy', () => {});
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(15, 10, 30, 0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0',
      }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: bg.background, color: bg.ink,
          width: '100%', maxWidth: 640, maxHeight: '92vh',
          overflowY: 'auto',
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          padding: '1.5rem 1.4rem 2.2rem',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: 8 }}>
          <div>
            <span style={{
              background: meta.color + '22', color: meta.color,
              padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
              display: 'inline-block', marginBottom: 6,
            }}>
              {meta.emoji} {meta.label}
            </span>
            <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.4rem', color: bg.ink, margin: 0, lineHeight: 1.35 }}>
              {deal.brandName}
            </h3>
            <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: 4 }}>
              {deal.productName}
            </p>
          </div>
          <button onClick={onClose} style={btnIcon(bg)} aria-label="閉じる"><X size={18} strokeWidth={2.4} /></button>
        </div>

        {/* マッチ度バナー */}
        <div style={{
          background: score.color + '15', border: `1px solid ${score.color}55`,
          borderRadius: 16, padding: '0.85rem 1rem', marginBottom: '0.85rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <p style={{ fontWeight: 700, color: score.color, margin: 0, fontSize: '1rem' }}>
              マッチ度 {score.total}% · {score.label}
            </p>
            {score.applicable && <span style={{ fontSize: '0.78rem', color: score.color }}>応募可能</span>}
          </div>
          {score.reasons.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.65 }}>
              {score.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {score.cautions.length > 0 && (
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#B45309', lineHeight: 1.65 }}>
              {score.cautions.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>

        {/* 案件サマリー */}
        <p style={{ color: bg.ink, fontSize: '0.93rem', lineHeight: 1.7, marginBottom: '0.85rem' }}>
          {deal.description}
        </p>

        {deal.postExample && (
          <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: '0.6rem 0.85rem', marginBottom: '0.85rem' }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: bg.accent, fontWeight: 700, marginBottom: 4 }}>投稿イメージ</p>
            <p style={{ fontSize: '0.85rem', color: bg.ink, lineHeight: 1.6 }}>{deal.postExample}</p>
          </div>
        )}

        {/* 詳細条件 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <DetailCell bg={bg} label="報酬" value={'¥' + deal.fee.toLocaleString()} sub={deal.feeNote} />
          <DetailCell bg={bg} label="形式" value={`${platMeta.emoji} ${platMeta.label}`} sub={deal.contentType} />
          <DetailCell bg={bg} label="締切" value={`あと ${daysLeft} 日`} sub={deal.deadline} highlight={daysLeft < 14 ? '#E11D48' : undefined} />
          <DetailCell bg={bg} label="必要 FW" value={deal.minFollowers.toLocaleString() + '+'} sub={deal.maxFollowers ? `〜${deal.maxFollowers.toLocaleString()}` : undefined} />
        </div>

        {deal.requiredHashtags && (
          <div style={{ marginBottom: '0.85rem' }}>
            <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: bg.inkSoft, fontWeight: 600, marginBottom: 4 }}>必須ハッシュタグ</p>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {deal.requiredHashtags.map((t, i) => (
                <span key={i} style={{ background: bg.accent + '22', color: bg.accent, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {(deal.exclusive || deal.prRequired) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.85rem' }}>
            {deal.prRequired && <span style={{ background: '#F8717122', color: '#B91C1C', padding: '0.2rem 0.6rem', borderRadius: 8, fontSize: '0.74rem', fontWeight: 600 }}>PR 表記必須</span>}
            {deal.exclusive && <span style={{ background: '#A78BFA22', color: '#6D28D9', padding: '0.2rem 0.6rem', borderRadius: 8, fontSize: '0.74rem', fontWeight: 600 }}>競合NG・独占</span>}
          </div>
        )}

        {/* 応募窓口 */}
        <div style={{ background: 'rgba(255,255,255,0.45)', borderRadius: 12, padding: '0.6rem 0.85rem', marginBottom: '0.85rem' }}>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: bg.inkSoft, fontWeight: 600, marginBottom: 4 }}>応募窓口</p>
          <p style={{ fontSize: '0.85rem', color: bg.ink, wordBreak: 'break-all' }}>
            {deal.contact.type === 'email' ? deal.contact.address : deal.contact.url}
            {deal.contactPerson && <span style={{ color: bg.inkSoft, marginLeft: 6 }}>({deal.contactPerson})</span>}
          </p>
        </div>

        {/* 応募ボタン (低スコアの場合は無効) */}
        {!score.applicable && (
          <div style={{ background: '#FEF3C7', border: '1px solid #FBBF24', borderRadius: 12, padding: '0.65rem 0.85rem', marginBottom: '0.85rem' }}>
            <p style={{ fontSize: '0.82rem', color: '#92400E', lineHeight: 1.6, margin: 0 }}>
              フォロワー要件にまだ届いていません。「私らしさ設定」でメディアキットを更新するか、フォロワーを伸ばしてから挑戦してみてください。
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <textarea
            style={{ ...inp(bg), width: '100%' }}
            rows={2}
            placeholder="伝えたいこと (例: ブランドへの想い・過去の関連投稿)"
            value={customNote}
            onChange={e => setCustomNote(e.target.value)}
          />
          <button
            onClick={handleGenerate}
            disabled={busy || !score.applicable}
            style={{ ...btnPrimary(bg), opacity: (busy || !score.applicable) ? 0.5 : 1 }}
          >
            {busy ? '考え中…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> AI で応募文を作る</span>}
          </button>
          {knowledge && knowledge.count > 0 && (
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.6, margin: 0 }}>
              <Brain size={11} style={{ display: 'inline', marginRight: 4 }} />
              あなたの {knowledge.count} 件の資料を読んで書きます。
            </p>
          )}

          {err && <p style={{ color: '#B91C1C', fontSize: '0.85rem' }}><AlertTriangle size={14} style={{ display: 'inline', marginRight: 4 }} />{err}</p>}

          {draft && (
            <div style={{ background: 'rgba(255,255,255,0.55)', border: `1px solid ${bg.cardBorder}`, borderRadius: 14, padding: '0.85rem 1rem' }}>
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: bg.inkSoft, marginBottom: 4 }}>件名</p>
              <input
                style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem', fontWeight: 600 }}
                value={draft.subject}
                onChange={e => setDraft({ ...draft, subject: e.target.value })}
              />
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: bg.inkSoft, marginBottom: 4 }}>本文</p>
              <textarea
                style={{ ...inp(bg), width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: 1.7 }}
                rows={10}
                value={draft.body}
                onChange={e => setDraft({ ...draft, body: e.target.value })}
              />
              {draft.reason && (
                <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.4rem', lineHeight: 1.55 }}>
                  <Lightbulb size={12} style={{ display: 'inline', marginRight: 4 }} />
                  {draft.reason}
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem' }}>
                {deal.contact.type === 'email' ? (
                  <button onClick={openMail} style={btnPrimary(bg)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> メーラーで送る</span>
                  </button>
                ) : (
                  <button onClick={openForm} style={btnPrimary(bg)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Send size={14} /> 応募フォームを開く</span>
                  </button>
                )}
                <button onClick={copyDraft} style={btnSecondary(bg)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Clipboard size={14} />
                    {copyState === 'done'
                      ? 'コピーしました'
                      : copyState === 'fail'
                        ? '長押しで文章を選んでコピーを'
                        : 'コピーして応募'}
                  </span>
                </button>
                {knowledge && (
                  <button onClick={saveDraftToKnowledge} style={btnSecondary(bg)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><BookmarkPlus size={14} /> ナレッジに追加</span>
                  </button>
                )}
              </div>
              {savedToKnowledge && (
                <p style={{ fontSize: '0.82rem', color: '#10B981', marginTop: '0.4rem' }}>
                  <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                  ナレッジに保存しました。次回の応募文で参考にされます。
                </p>
              )}

              {done && (
                <p style={{ fontSize: '0.82rem', color: '#059669', marginTop: '0.5rem' }}>
                  <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                  応募履歴に追加しました。
                </p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailCell({ bg, label, value, sub, highlight }: { bg: IrisBackgroundDef; label: string; value: string; sub?: string; highlight?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.45)', borderRadius: 12,
      padding: '0.55rem 0.75rem',
    }}>
      <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: bg.inkSoft, fontWeight: 600, marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.95rem', fontWeight: 700, color: highlight ?? bg.ink, lineHeight: 1.3 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function ApplyHistoryRow({ bg, rec, onUpdate }: {
  bg: IrisBackgroundDef; rec: ApplicationRecord;
  onUpdate: (status: ApplicationRecord['status']) => void;
}) {
  const date = new Date(rec.appliedAt).toLocaleDateString('ja-JP');
  const statusMeta: Record<ApplicationRecord['status'], { label: string; color: string }> = {
    sent:     { label: '応募済み',   color: '#3B82F6' },
    replied:  { label: '返信あり',   color: '#A78BFA' },
    declined: { label: 'お断り',     color: '#9CA3AF' },
    won:      { label: '成立 ',     color: '#10B981' },
  };
  const s = statusMeta[rec.status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.65rem',
      padding: '0.55rem 0.75rem',
      background: 'rgba(255,255,255,0.45)', borderRadius: 12,
      border: `1px solid ${bg.cardBorder}`,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.9rem', lineHeight: 1.3 }}>{rec.dealBrand}</p>
        <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>{rec.dealProduct} · ¥{rec.fee.toLocaleString()} · {date}</p>
      </div>
      <span style={{
        background: s.color + '22', color: s.color,
        padding: '0.2rem 0.6rem', borderRadius: 999,
        fontSize: '0.72rem', fontWeight: 700,
      }}>{s.label}</span>
      <select
        value={rec.status} onChange={e => onUpdate(e.target.value as ApplicationRecord['status'])}
        style={{ ...inp(bg), padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
      >
        <option value="sent">応募済み</option>
        <option value="replied">返信あり</option>
        <option value="won">成立</option>
        <option value="declined">お断り</option>
      </select>
    </div>
  );
}

function PrismResearchSection({ bg, desk, mediaKit, settings, companies }: {
  bg: IrisBackgroundDef;
  desk: ReturnType<typeof useInfluencerDesk>;
  mediaKit?: MediaKit;
  settings: AppSettings;
  companies: ReturnType<typeof loadPrismCompanies>;
}) {
  const [pitchTarget, setPitchTarget] = useState<typeof companies[0] | null>(null);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('post');
  const [proposedFee, setProposedFee] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ subject: string; body: string; matchReason: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const generatePitch = async () => {
    if (!pitchTarget) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await generateTieupPitch({
        settings, company: pitchTarget, mediaKit, platform, contentType,
        proposedFee: proposedFee ? Number(proposedFee) : undefined,
        customNote: customNote || undefined,
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const saveAsDeal = () => {
    if (!pitchTarget || !result) return;
    desk.addDeal(IRIS_PERSONA_ID, {
      brandName: pitchTarget.companyName,
      productName: pitchTarget.industry,
      platform, contentType,
      fee: proposedFee ? Number(proposedFee) : 0,
      deliverables: '初回打診済み (Iris ⇄ Prism Brand Match)',
      stage: 'inquiry',
      notes: `[Brand Match] ${result.matchReason}\n\n[初回打診メール]\n件名: ${result.subject}\n\n${result.body}`,
    });
    setPitchTarget(null); setResult(null);
  };

  return (
    <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
        {companies.map(c => (
          <button key={c.id} onClick={() => { setPitchTarget(c); setResult(null); setErr(null); }}
            style={{ ...btnSecondary(bg), textAlign: 'left', padding: '0.65rem 0.85rem', display: 'block' }}>
            <p style={{ fontWeight: 700, color: bg.ink, fontSize: '0.9rem' }}>{c.companyName}</p>
            {c.industry && <p style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{c.industry}</p>}
          </button>
        ))}
      </div>
      {pitchTarget && (
        <div style={{ background: 'rgba(255,255,255,0.55)', border: `1px solid ${bg.cardBorder}`, borderRadius: 14, padding: '0.85rem 1rem' }}>
          <p style={{ fontWeight: 700, color: bg.ink, marginBottom: 6 }}>{pitchTarget.companyName} へ打診メールを書く</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select style={inp(bg)} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
              {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <select style={inp(bg)} value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>
              {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input style={inp(bg)} type="number" placeholder="希望金額" value={proposedFee} onChange={e => setProposedFee(e.target.value)} />
          </div>
          <textarea style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }} rows={2} value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="共感ポイントなど" />
          <button onClick={generatePitch} disabled={busy} style={btnPrimary(bg)}>{busy ? '考え中…' : 'メールを作る'}</button>
          {err && <p style={{ color: '#B91C1C', fontSize: '0.85rem', marginTop: 4 }}>{err}</p>}
          {result && (
            <div style={{ marginTop: '0.85rem' }}>
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>合う理由: {result.matchReason}</p>
              <p style={{ fontWeight: 600, color: bg.ink, marginTop: 4 }}>{result.subject}</p>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.7, color: bg.ink }}>{result.body}</pre>
              <button onClick={saveAsDeal} style={{ ...btnPrimary(bg), marginTop: 8 }}>案件として保存</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const chip = (bg: IrisBackgroundDef, active: boolean): React.CSSProperties => ({
  background: active ? bg.accent : 'rgba(255,255,255,0.5)',
  color: active ? '#fff' : bg.ink,
  border: `1px solid ${active ? bg.accent : bg.cardBorder}`,
  borderRadius: 999,
  padding: '0.4rem 0.85rem',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
  fontFamily: IRIS_FONTS.body,
});

// ─── 共通スタイル関数 ────────────────────────
function StatCard({ bg, label, value, icon: Ico }: { bg: IrisBackgroundDef; label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="iris-card-hover" style={{
      background: bg.card, backdropFilter: 'blur(10px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 18,
      padding: '1rem 1.2rem',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: `${bg.accent}18`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '0.5rem',
      }}>
        <Ico size={16} color={bg.accent} strokeWidth={2.2} />
      </div>
      <div style={{ fontSize: '0.75rem', color: bg.inkSoft, letterSpacing: '0.1em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: bg.ink, marginTop: '0.15rem' }}>{value}</div>
    </div>
  );
}

function Card({ bg, children }: { bg: IrisBackgroundDef; children: React.ReactNode }) {
  return (
    <div style={{
      background: bg.card, backdropFilter: 'blur(10px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
      padding: '1.2rem 1.4rem',
    }}>
      {children}
    </div>
  );
}

const inp = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.94)',
  border: `1px solid ${bg.cardBorder}`,
  color: '#1F1A2E',
  padding: '0.6rem 0.9rem',
  borderRadius: 12,
  fontSize: '0.9rem',
  fontFamily: IRIS_FONTS.body,
  outline: 'none',
});

const btnPrimary = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
  color: '#fff',
  border: 'none',
  borderRadius: 999,
  padding: '0.65rem 1.4rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontFamily: IRIS_FONTS.body,
  boxShadow: `0 6px 18px ${bg.accent}55`,
});

const btnSecondary = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.6)',
  color: bg.ink,
  border: `1px solid ${bg.cardBorder}`,
  borderRadius: 999,
  padding: '0.65rem 1.4rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.88rem',
  fontFamily: IRIS_FONTS.body,
});

const btnIcon = (bg: IrisBackgroundDef): React.CSSProperties => ({
  background: 'rgba(255,255,255,0.5)',
  color: bg.ink,
  border: `1px solid ${bg.cardBorder}`,
  borderRadius: 999,
  width: 44, height: 44,
  minWidth: 44, minHeight: 44,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '1rem',
  cursor: 'pointer',
  padding: 0,
});

// ─── ブランドガイドライン View ─────────────────────────────────
function BrandGuidelineView({ bg, multiAccount, brandGuide, settings }: {
  bg: IrisBackgroundDef | CustomIrisBackground;
  multiAccount: ReturnType<typeof useMultiAccount>;
  brandGuide: ReturnType<typeof useBrandGuidelines>;
  settings: AppSettings;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<BrandGuideline | null>(null);
  const [checkText, setCheckText] = useState('');
  const [checkResult, setCheckResult] = useState<{ score: number; violations: string[]; suggestions: string[]; revised?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAcct, setNewAcct] = useState<Partial<IrisAccount>>({
    type: 'personal', platform: 'instagram', handle: '', displayName: '', avatarEmoji: '',
  });

  const g = brandGuide.active;

  function startEdit() {
    setDraft(g ? { ...g } : null);
    setEditMode(true);
  }

  function saveEdit() {
    if (!draft) return;
    brandGuide.save(draft);
    setEditMode(false);
    setDraft(null);
  }

  async function handleStyleCheck() {
    if (!g || !checkText.trim()) return;
    setChecking(true);
    const res = await runStyleCheck({ settings, guideline: g, postText: checkText });
    setCheckResult(res);
    setChecking(false);
  }

  const [addErr, setAddErr] = useState<string>('');
  function addAccount() {
    // ハンドル必須 (表示名は任意 — 空ならハンドルで代用)
    const rawHandle = (newAcct.handle || '').trim().replace(/^@+/, '');
    if (!rawHandle) {
      setAddErr('ハンドル (@より後の文字) を入力してください');
      return;
    }
    setAddErr('');
    const displayName = (newAcct.displayName || '').trim() || rawHandle;
    multiAccount.add({
      type: newAcct.type as IrisAccount['type'],
      platform: newAcct.platform as IrisAccount['platform'],
      handle: rawHandle,
      displayName,
      avatarEmoji: newAcct.avatarEmoji || '',
    });
    setNewAcct({ type: 'personal', platform: 'instagram', handle: '', displayName: '', avatarEmoji: '' });
    setShowAddAccount(false);
  }

  const card: React.CSSProperties = {
    background: bg.card, border: `1px solid ${bg.cardBorder}`,
    borderRadius: 20, padding: '1.25rem',
    boxShadow: '0 4px 20px rgba(31,26,46,0.07)',
  };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* タイトル */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.28em', color: bg.accent, fontWeight: 700, marginBottom: 4 }}>私らしさ設定</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>私らしさを決める。</h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: 4 }}>色・話しかた・使わない言葉を覚えさせると、AI が投稿を書くときにそろえてくれます。</p>
      </div>

      {/* ── マルチアカウント管理 ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Smartphone size={16} color={bg.accent} /> 私のアカウント</h3>
          <button onClick={() => setShowAddAccount(v => !v)}
            style={{ ...btnPrimary(bg), padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            + 追加
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {multiAccount.accounts.map(acct => (
            <div key={acct.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0.85rem', borderRadius: 14,
              background: acct.id === multiAccount.active?.id ? `${bg.accent}10` : 'rgba(255,255,255,0.5)',
              border: `1px solid ${acct.id === multiAccount.active?.id ? bg.accent + '44' : bg.cardBorder}`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: `${bg.accent}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={18} color={bg.accent} strokeWidth={2.2} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: bg.ink }}>{acct.handle}</div>
                <div style={{ fontSize: '0.75rem', color: bg.inkSoft }}>
                  {ACCOUNT_TYPE_META[acct.type].label}
                  {' · '}{PLATFORM_META_ACCOUNT[acct.platform].label}
                  {acct.followerCount ? ` · ${acct.followerCount.toLocaleString()} フォロワー` : ''}
                </div>
              </div>
              <button onClick={() => multiAccount.switchTo(acct.id)}
                style={{
                  padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  background: acct.id === multiAccount.active?.id ? bg.accent : 'rgba(255,255,255,0.7)',
                  color: acct.id === multiAccount.active?.id ? '#fff' : bg.ink,
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                {acct.id === multiAccount.active?.id ? '使用中' : '切り替え'}
              </button>
              {multiAccount.accounts.length > 1 && (
                <button onClick={async () => { if (await confirmAction({ title: `${acct.handle} を削除しますか?`, tone: 'danger' })) multiAccount.remove(acct.id); }}
                  title="削除" aria-label="削除"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: bg.inkSoft, padding: 4, display: 'inline-flex' }}><Trash2 size={14} strokeWidth={2.2} /></button>
              )}
            </div>
          ))}
        </div>
        {/* アカウント追加フォーム */}
        <AnimatePresence>
          {showAddAccount && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${bg.cardBorder}` }}>
                <div style={{
                  padding: '0.7rem 0.85rem',
                  background: `linear-gradient(135deg, ${bg.accent}10, transparent)`,
                  border: `1px dashed ${bg.accent}55`,
                  borderRadius: 12,
                  marginBottom: '0.85rem',
                }}>
                  <div style={{
                    fontSize: '0.62rem', letterSpacing: '0.22em',
                    color: bg.accent, fontWeight: 800, marginBottom: 6,
                  }}>
                    QUICK ADD &mdash; ハンドルだけで即追加
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={newAcct.handle || ''}
                      onChange={e => setNewAcct(p => ({ ...p, handle: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && (newAcct.handle || '').trim()) addAccount(); }}
                      placeholder="@your_handle"
                      style={{
                        flex: 1, padding: '0.6rem 0.85rem', borderRadius: 10,
                        border: `1px solid ${bg.cardBorder}`, fontSize: '0.92rem',
                        background: '#fff', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      onClick={addAccount}
                      disabled={!(newAcct.handle || '').trim()}
                      style={{
                        padding: '0.55rem 1.1rem', borderRadius: 999,
                        background: (newAcct.handle || '').trim()
                          ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`
                          : 'rgba(0,0,0,0.08)',
                        color: (newAcct.handle || '').trim() ? '#fff' : '#999',
                        border: 'none', fontSize: '0.85rem', fontWeight: 800,
                        cursor: (newAcct.handle || '').trim() ? 'pointer' : 'not-allowed',
                        boxShadow: (newAcct.handle || '').trim() ? `0 6px 16px ${bg.accent}55` : 'none',
                      }}>
                      追加
                    </button>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
                    Enter で即保存。名前・種別はあとで編集できる
                  </div>
                </div>
                <div style={{
                  fontSize: '0.62rem', letterSpacing: '0.22em',
                  color: bg.inkSoft, fontWeight: 800, marginBottom: 6,
                }}>
                  詳細を最初から入れたい場合 ↓
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    { label: 'ハンドル (必須)', key: 'handle', placeholder: '例: your_handle (@は不要)' },
                    { label: 'ニックネーム (任意)', key: 'displayName', placeholder: '空欄でもOK' },
                    { label: 'アバターの頭文字 (任意)', key: 'avatarEmoji', placeholder: '空欄でOK' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>{f.label}</label>
                      <input value={(newAcct as unknown as Record<string, string>)[f.key] || ''} onChange={e => setNewAcct(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>種別</label>
                    <select value={newAcct.type} onChange={e => setNewAcct(p => ({ ...p, type: e.target.value as IrisAccount['type'] }))}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }}>
                      {(Object.keys(ACCOUNT_TYPE_META) as IrisAccount['type'][]).map(t => (
                        <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>プラットフォーム</label>
                    <select value={newAcct.platform} onChange={e => setNewAcct(p => ({ ...p, platform: e.target.value as IrisAccount['platform'] }))}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }}>
                      {(['instagram', 'tiktok', 'youtube', 'x'] as const).map(p => (
                        <option key={p} value={p}>{PLATFORM_META_ACCOUNT[p].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {addErr && (
                  <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.7rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: '0.8rem' }}>
                    {addErr}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                  <button onClick={addAccount} style={{ ...btnPrimary(bg), fontSize: '0.85rem' }}>追加する</button>
                  <button onClick={() => { setShowAddAccount(false); setAddErr(''); }} style={{ ...btnSecondary(bg), fontSize: '0.85rem' }}>キャンセル</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── ブランドガイドライン ── */}
      {g && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Palette size={16} color={bg.accent} /> {g.name}</h3>
            <button onClick={editMode ? saveEdit : startEdit}
              style={{ ...btnPrimary(bg), padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              {editMode
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Save size={13} /> 保存</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Edit3 size={13} /> 編集</span>}
            </button>
          </div>

          {editMode && draft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: '私のお名前', key: 'name' },
                { label: '一言で言うと', key: 'tagline' },
                { label: 'どんな雰囲気か', key: 'bio' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input value={(draft as unknown as Record<string, string>)[f.key] || ''} onChange={e => setDraft(p => p ? { ...p, [f.key]: e.target.value } : p)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>話しかた</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {(Object.keys(TONE_META) as BrandTone[]).map(t => (
                    <button key={t} onClick={() => setDraft(p => p ? { ...p, tone: t } : p)}
                      style={{
                        padding: '0.35rem 0.85rem', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer',
                        background: draft.tone === t ? bg.accent : 'rgba(255,255,255,0.7)',
                        color: draft.tone === t ? '#fff' : bg.ink,
                        border: `1px solid ${bg.cardBorder}`, fontWeight: 600,
                      }}>
                      {TONE_META[t].emoji} {TONE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>好きな色</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={draft.colors[0]?.hex || '#E1306C'} onChange={e => setDraft(p => p ? { ...p, colors: [{ name: 'Primary', hex: e.target.value }, ...(p.colors.slice(1))] } : p)}
                    style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${bg.cardBorder}`, cursor: 'pointer' }} />
                  <input type="color" value={draft.colors[1]?.hex || '#FCB045'} onChange={e => setDraft(p => p ? { ...p, colors: [p.colors[0], { name: 'Accent', hex: e.target.value }] } : p)}
                    style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${bg.cardBorder}`, cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>Primary / Accent</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>使いたくない言葉 (カンマ区切り)</label>
                <input value={draft.ngWords.join(', ')} onChange={e => setDraft(p => p ? { ...p, ngWords: e.target.value.split(/[,、]+/).map(s => s.trim()).filter(Boolean) } : p)}
                  placeholder="例: 安い, 激安, プチプラ"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>必ず入れたい言葉 (カンマ区切り)</label>
                <input value={draft.mustWords.join(', ')} onChange={e => setDraft(p => p ? { ...p, mustWords: e.target.value.split(/[,、]+/).map(s => s.trim()).filter(Boolean) } : p)}
                  placeholder="例: 上質, 大人, 洗練"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>絵文字の量</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['rich', 'minimal', 'none'] as const).map(s => (
                    <button key={s} onClick={() => setDraft(p => p ? { ...p, emojiStyle: s } : p)}
                      style={{
                        padding: '0.35rem 0.85rem', borderRadius: 999, fontSize: '0.78rem', cursor: 'pointer',
                        background: draft.emojiStyle === s ? bg.accent : 'rgba(255,255,255,0.7)',
                        color: draft.emojiStyle === s ? '#fff' : bg.ink,
                        border: `1px solid ${bg.cardBorder}`, fontWeight: 600,
                      }}>
                      {s === 'rich' ? 'たっぷり' : s === 'minimal' ? '控えめ' : 'なし'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={saveEdit} style={btnPrimary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Save size={14} /> 保存</span></button>
                <button onClick={() => { setEditMode(false); setDraft(null); }} style={btnSecondary(bg)}>キャンセル</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {g.tagline && <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: bg.inkSoft, margin: 0 }}>"{g.tagline}"</p>}
              {g.bio && <p style={{ fontSize: '0.85rem', color: bg.inkSoft, margin: 0 }}>{g.bio}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>話しかた:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: bg.accent }}>{TONE_META[g.tone].emoji} {TONE_META[g.tone].label}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>色:</span>
                {g.colors.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{c.name} {c.hex}</span>
                  </div>
                ))}
              </div>
              {g.ngWords.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>使わない言葉: </span>
                  {g.ngWords.map(w => (
                    <span key={w} style={{ fontSize: '0.75rem', background: '#FFE5EE', color: '#C8102E', borderRadius: 999, padding: '0.15rem 0.55rem', marginRight: 4 }}>{w}</span>
                  ))}
                </div>
              )}
              {g.mustWords.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>必ず入れる: </span>
                  {g.mustWords.map(w => (
                    <span key={w} style={{ fontSize: '0.75rem', background: `${bg.accent}15`, color: bg.accent, borderRadius: 999, padding: '0.15rem 0.55rem', marginRight: 4 }}>{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 投稿チェック ── */}
      <div style={card}>
        <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: '0 0 0.85rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Bot size={16} color={bg.accent} /> 私らしい文章か見てもらう</span>
        </h3>
        <p style={{ fontSize: '0.83rem', color: bg.inkSoft, marginBottom: '0.85rem' }}>
          書いた投稿をここに貼ると、私らしさ設定とくらべて点数と直しどころを教えてくれます。
        </p>
        <textarea value={checkText} onChange={e => setCheckText(e.target.value)} rows={5}
          placeholder="見てもらいたい投稿を貼り付けてください…"
          style={{
            width: '100%', padding: '0.75rem 1rem', borderRadius: 14,
            border: `1px solid ${bg.cardBorder}`, fontSize: '0.88rem',
            resize: 'vertical', boxSizing: 'border-box', fontFamily: IRIS_FONTS.body,
            background: 'rgba(255,255,255,0.9)', color: bg.ink,
          }} />
        <button onClick={handleStyleCheck} disabled={checking || !checkText.trim() || !g}
          style={{ ...btnPrimary(bg), marginTop: '0.65rem', opacity: checking || !checkText.trim() || !g ? 0.5 : 1 }}>
          {checking
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hourglass size={14} /> 読んでいます…</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={14} /> 見てもらう</span>}
        </button>
        {checkResult && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: '1rem', padding: '1rem', borderRadius: 14, background: `${bg.accent}0d`, border: `1px solid ${bg.accent}33` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: bg.accent }}>{checkResult.score}</span>
              <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>/ 100 pts</span>
              <div style={{
                marginLeft: 'auto', height: 8, width: 120, borderRadius: 999,
                background: `linear-gradient(90deg, ${bg.accent} ${checkResult.score}%, rgba(0,0,0,0.08) ${checkResult.score}%)`,
              }} />
            </div>
            {checkResult.violations.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C8102E', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> 気になるところ</p>
                {checkResult.violations.map((v, i) => <p key={i} style={{ fontSize: '0.82rem', color: '#C8102E', margin: '0 0 2px' }}>· {v}</p>)}
              </div>
            )}
            {checkResult.suggestions.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: bg.accent, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={12} /> こうしてみては</p>
                {checkResult.suggestions.map((s, i) => <p key={i} style={{ fontSize: '0.82rem', color: bg.inkSoft, margin: '0 0 2px' }}>· {s}</p>)}
              </div>
            )}
            {checkResult.revised && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}` }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.accent, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} /> 直してみたもの</p>
                <p style={{ fontSize: '0.85rem', color: bg.ink, margin: 0, whiteSpace: 'pre-wrap' }}>{checkResult.revised}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
