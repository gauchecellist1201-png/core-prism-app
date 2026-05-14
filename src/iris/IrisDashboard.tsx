// ============================================================
// CORE Iris — メインダッシュボード
// 案件 / 交渉 / 投稿下書き / 美容相談 / 画像生成 / 背景カスタム
// ============================================================
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import {
  IRIS_BACKGROUNDS, type IrisBackgroundDef, loadIrisBackground, saveIrisBackground,
  IRIS_COLORS, IRIS_FONTS, getAllBackgrounds, removeCustomBackground, type CustomIrisBackground,
} from './irisStyle';
import IrisCustomBgEditor from './IrisCustomBgEditor';
import { useInfluencerDesk } from '../hooks/useInfluencerDesk';
import {
  generateNegotiation, generateDraftCopy, evaluateOffer,
} from '../lib/influencerAgent';
import {
  PLATFORM_META, CONTENT_TYPE_META, DEAL_STAGE_META, NEGOTIATION_TYPE_META,
  type Platform, type ContentType, type DealStage, type NegotiationType,
  type InfluencerDeal, type MediaKit,
} from '../types/influencerDeal';
import { chatBeautyAdvisor, BEAUTY_TOPIC_META, type BeautyTopic, type BeautyMessage } from './beautyAdvisor';
import { shareToInstagram } from './instagramShare';
import {
  Sparkles, TrendingUp, Search, Mail, Film, MessageSquare, Edit3,
  Camera, HeartPulse, Leaf, UsersRound, Users, Handshake, FileText,
  Menu as MenuIcon, Gift, Palette, ArrowLeft, Clapperboard, CalendarClock,
  Download, Image as ImageIcon, Clipboard, RefreshCw, Wand2, Scissors,
  Eye, Bookmark, BookmarkPlus, Send, Trash2, Loader2, Brain, User,
  Wallet, Calendar, Hourglass, ShieldAlert,
  CheckCircle2, AlertTriangle, Bot, Lightbulb, Sun,
  Briefcase, Rocket, Heart, Smartphone, Ban,
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
};

// ─── タブ グループ (Phase 2 — 5 カテゴリ) ──────────
interface TabDef { id: string; l: string }
interface TabGroup { id: string; label: string; color: string; icon: LucideIcon; tabs: TabDef[] }
const TAB_GROUPS: TabGroup[] = [
  { id: 'today',  label: 'Today',  color: '#E1306C', icon: Sun,
    tabs: [{ id: 'home', l: 'ホーム' }, { id: 'schedule', l: '投稿予約' }] },
  { id: 'create', label: 'Create', color: '#833AB4', icon: Wand2,
    tabs: [
      { id: 'reel', l: 'リール作成' }, { id: 'draft', l: '投稿下書き' },
      { id: 'director', l: '丸投げ編集' }, { id: 'image', l: '画像加工' },
    ] },
  { id: 'earn',   label: 'Earn',   color: '#F77737', icon: Briefcase,
    tabs: [
      { id: 'triage', l: '案件精査' }, { id: 'deals', l: '案件' },
      { id: 'negotiate', l: '交渉' }, { id: 'brands', l: 'ブランド探し' },
    ] },
  { id: 'grow',   label: 'Grow',   color: '#3B82F6', icon: Rocket,
    tabs: [
      { id: 'strategy', l: '戦略' }, { id: 'invite', l: '招待 +30日' },
      { id: 'community', l: 'コミュニティ' }, { id: 'team', l: 'チーム' },
    ] },
  { id: 'care',   label: 'Care',   color: '#10B981', icon: Heart,
    tabs: [
      { id: 'health', l: 'ヘルス' }, { id: 'beauty', l: '美容相談' },
      { id: 'guideline', l: 'ガイドライン' },
    ] },
];
const TAB_TO_GROUP: Record<string, string> = TAB_GROUPS.reduce((acc, g) => {
  g.tabs.forEach(t => { acc[t.id] = g.id; });
  return acc;
}, {} as Record<string, string>);
import { useIrisTeam, ROLE_META, type IrisTeamMember, type MemberRole } from './team';
import { loadPrismCompanies, generateTieupPitch } from './brandMatch';
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

interface Props {
  settings: AppSettings;
  onLeave: () => void;
}

type Tab = 'home' | 'strategy' | 'deals' | 'triage' | 'director' | 'video' | 'reel' | 'schedule' | 'negotiate' | 'draft' | 'beauty' | 'image' | 'community' | 'team' | 'brands' | 'kit' | 'health' | 'revenue' | 'fans' | 'collab' | 'guideline' | 'invite';

const IRIS_PERSONA_ID = 'iris-default';  // Iris は単一ユーザー前提

export default function IrisDashboard({ settings, onLeave }: Props) {
  const [bg, setBg] = useState<IrisBackgroundDef | CustomIrisBackground>(() => loadIrisBackground());
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [bgListVersion, setBgListVersion] = useState(0); // 再描画用
  const [tab, setTab] = useState<Tab>('home');
  const [moreOpen, setMoreOpen] = useState(false);

  const allBgs = useMemo(() => getAllBackgrounds(), [bgListVersion]);

  const desk = useInfluencerDesk();
  const postQueue = usePostQueue();
  const team = useIrisTeam();
  const health = useHealth();
  const multiAccount = useMultiAccount();
  const brandGuide = useBrandGuidelines();
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const myDeals = useMemo(() => desk.getDealsForPersona(IRIS_PERSONA_ID), [desk.deals]);
  const mediaKit = desk.getMediaKit(IRIS_PERSONA_ID);

  const handlePickBg = (b: IrisBackgroundDef | CustomIrisBackground) => {
    setBg(b); saveIrisBackground(b.id); setBgPickerOpen(false);
  };
  const handleRemoveCustom = (id: string) => {
    if (!confirm('この背景を削除しますか?')) return;
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
      ...themeStyle,
    }}>
      {/* ヘッダ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        padding: '0.85rem max(1.25rem, env(safe-area-inset-right)) 0.85rem max(1.25rem, env(safe-area-inset-left))',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${bg.cardBorder}`,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          </div>

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
            <button onClick={onLeave} title="戻る" aria-label="戻る" style={btnIcon(bg)}><ArrowLeft size={18} strokeWidth={2} /></button>
          </div>
        </div>

        {/* タブ (Phase 2) — 5 カテゴリ グループ化。PC は横並びグループ、モバイルはアクティブ グループのみ */}
        <nav className="iris-tabs-v2" style={{
          maxWidth: 1280, margin: '0.5rem auto 0',
          display: 'flex', alignItems: 'center', gap: 14,
          overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4,
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

      {/* メインコンテンツ — モバイルではフローティング AI ボタン分の余白を確保 */}
      <main className="iris-main" style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '2rem 1.25rem calc(8.5rem + env(safe-area-inset-bottom, 0px))',
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'home' && (
              <IrisVoiceHome
                bg={bg} settings={settings}
                myDeals={myDeals} mediaKit={mediaKit}
                postQueue={postQueue}
                onNavigate={(t) => setTab(t as Tab)}
              />
            )}
            {tab === 'deals' && <DealsView bg={bg} desk={desk} myDeals={myDeals} settings={settings} />}
            {tab === 'negotiate' && <NegotiateView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} />}
            {tab === 'draft' && <DraftView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} />}
            {tab === 'beauty' && <BeautyChatView bg={bg} settings={settings} />}
            {tab === 'health' && <IrisHealthView bg={bg} health={health} />}
            {tab === 'strategy' && <IrisStrategistView bg={bg} settings={settings} mediaKit={mediaKit} />}
            {tab === 'image' && <ImageStudioView bg={bg} settings={settings} />}
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
                  alert('案件として保存しました');
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
            {tab === 'brands' && <BrandMatchView bg={bg} desk={desk} mediaKit={mediaKit} settings={settings} />}
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
          </motion.div>
        </AnimatePresence>
      </main>

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
        <StatCard bg={bg} label="今週納期" value={upcoming.filter(e => e.daysLeft <= 7).length + ' 件'} icon={Calendar} />
        <StatCard bg={bg} label="総報酬" value={'¥' + earnings.toLocaleString()} icon={Wallet} />
        <StatCard bg={bg} label="完了案件" value={myDeals.filter(d => d.stage === 'closed').length + ' 件'} icon={CheckCircle2} />
      </div>

      {upcoming.length > 0 && (
        <Card bg={bg}>
          <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '1rem', color: bg.ink }}>
            直近の納期
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
              AI Director
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
              戦略を開く →
            </button>
          )}
        </div>
        <p style={{ color: bg.inkSoft, fontSize: '0.88rem', lineHeight: 1.7 }}>
          投稿実績を入れたら、伸びパターンを分析して、次に出すべき投稿を AI が決めてくれる。30 日のストーリーアーク (シリーズ構成) も自動で。
        </p>
      </Card>

      {/* 今、なにする — クイックアクション */}
      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '1rem', color: bg.ink, fontWeight: 500 }}>
          今、なにする?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
          {([
            { I: Search,        l: '案件を精査',     tab: 'triage' },
            { I: Film,          l: '丸投げ編集',     tab: 'director' },
            { I: MessageSquare, l: '交渉文を書く',   tab: 'negotiate' },
            { I: Camera,        l: '写真を加工',     tab: 'image' },
            { I: HeartPulse,    l: '美容相談',       tab: 'beauty' },
            { I: UsersRound,    l: 'コミュニティ',   tab: 'community' },
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

// ─── 案件 (DealsView) ─────────────────────────
function DealsView({ bg, desk, myDeals, settings }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; myDeals: InfluencerDeal[]; settings: AppSettings }) {
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [d, setD] = useState<Partial<InfluencerDeal>>({
    brandName: '', platform: 'instagram', contentType: 'post', fee: 0, deliverables: '', stage: 'inquiry',
  });

  const add = () => {
    if (!d.brandName?.trim()) return;
    desk.addDeal(IRIS_PERSONA_ID, {
      brandName: d.brandName!, agencyName: d.agencyName, productName: d.productName,
      platform: (d.platform || 'instagram') as Platform,
      contentType: (d.contentType || 'post') as ContentType,
      fee: Number(d.fee) || 0, usageFee: d.usageFee ? Number(d.usageFee) : undefined,
      deliverables: d.deliverables || '',
      draftDeadline: d.draftDeadline || undefined,
      postDeadline: d.postDeadline || undefined,
      reportDeadline: d.reportDeadline || undefined,
      stage: (d.stage || 'inquiry') as DealStage,
      contactName: d.contactName, contactEmail: d.contactEmail, notes: d.notes, guidelines: d.guidelines,
    });
    setD({ brandName: '', platform: 'instagram', contentType: 'post', fee: 0, deliverables: '', stage: 'inquiry' });
    setOpen(false);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {quickOpen && (
        <IrisQuickAdd bg={bg} settings={settings}
          onClose={() => setQuickOpen(false)}
          onSave={(data) => { desk.addDeal(IRIS_PERSONA_ID, data); }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0, fontWeight: 500 }}>
          案件
        </h2>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setQuickOpen(true)} style={{
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            color: '#fff', border: 'none', borderRadius: 999,
            padding: '0.7rem 1.4rem', fontWeight: 700, cursor: 'pointer',
            fontSize: '0.88rem', fontFamily: IRIS_FONTS.body,
            boxShadow: `0 8px 22px ${bg.accent}55`,
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> AI で追加</span>
          </button>
          <button onClick={() => setOpen(!open)} style={{
            background: 'rgba(255,255,255,0.85)', color: '#1F1A2E',
            border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
            padding: '0.7rem 1.2rem', fontWeight: 600, cursor: 'pointer',
            fontSize: '0.85rem', fontFamily: IRIS_FONTS.body,
          }}>
            {open ? '閉じる' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Edit3 size={14} /> 手動</span>}
          </button>
        </div>
      </div>

      {open && (
        <Card bg={bg}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
            <input style={inp(bg)} placeholder="ブランド名 *" value={d.brandName || ''} onChange={e => setD({ ...d, brandName: e.target.value })} />
            <input style={inp(bg)} placeholder="代理店名" value={d.agencyName || ''} onChange={e => setD({ ...d, agencyName: e.target.value })} />
            <input style={inp(bg)} placeholder="商品名" value={d.productName || ''} onChange={e => setD({ ...d, productName: e.target.value })} />
            <select style={inp(bg)} value={d.platform} onChange={e => setD({ ...d, platform: e.target.value as Platform })}>
              {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </select>
            <select style={inp(bg)} value={d.contentType} onChange={e => setD({ ...d, contentType: e.target.value as ContentType })}>
              {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input style={inp(bg)} type="number" placeholder="報酬 (円)" value={d.fee || ''} onChange={e => setD({ ...d, fee: Number(e.target.value) })} />
            <input style={inp(bg)} placeholder="納品物 (例: フィード1本)" value={d.deliverables || ''} onChange={e => setD({ ...d, deliverables: e.target.value })} />
            <input style={inp(bg)} type="datetime-local" placeholder="下書き期限" value={d.draftDeadline || ''} onChange={e => setD({ ...d, draftDeadline: e.target.value })} />
            <input style={inp(bg)} type="datetime-local" placeholder="投稿期限" value={d.postDeadline || ''} onChange={e => setD({ ...d, postDeadline: e.target.value })} />
            <input style={inp(bg)} type="datetime-local" placeholder="レポート期限" value={d.reportDeadline || ''} onChange={e => setD({ ...d, reportDeadline: e.target.value })} />
          </div>
          <button onClick={add} style={{ ...btnPrimary(bg), marginTop: '0.75rem' }}>保存</button>
        </Card>
      )}

      {myDeals.length === 0 && (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '2rem 0' }}>まだ案件はありません</p>
        </Card>
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
              <button onClick={() => { if (confirm('削除しますか?')) desk.removeDeal(deal.id); }} title="削除" aria-label="削除" style={btnIcon(bg)}><Trash2 size={16} strokeWidth={2.2} /></button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── 交渉 ─────────────────────────────────────
function NegotiateView({ bg, desk, myDeals, mediaKit, settings, persona }: any) {
  const [dealId, setDealId] = useState('');
  const [negoType, setNegoType] = useState<NegotiationType>('first-reply');
  const [targetFee, setTargetFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [evalRes, setEvalRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const gen = async () => {
    const deal = myDeals.find((d: InfluencerDeal) => d.id === dealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await generateNegotiation({ settings, persona, deal, mediaKit, type: negoType, targetFee: targetFee ? Number(targetFee) : undefined });
      desk.addNego({ ...r, dealId: deal.id, status: 'draft' });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const ev = async () => {
    const deal = myDeals.find((d: InfluencerDeal) => d.id === dealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try { setEvalRes(await evaluateOffer({ settings, deal, mediaKit })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const negos = desk.negos.filter((n: any) => myDeals.some((d: InfluencerDeal) => d.id === n.dealId));

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
        交渉センター
      </h2>

      <Card bg={bg}>
        <select style={{ ...inp(bg), width: '100%', marginBottom: '0.6rem' }} value={dealId} onChange={e => setDealId(e.target.value)}>
          <option value="">— 案件を選ぶ —</option>
          {myDeals.map((d: InfluencerDeal) => <option key={d.id} value={d.id}>{d.brandName}</option>)}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {Object.entries(NEGOTIATION_TYPE_META).map(([k, v]) => (
            <button key={k} onClick={() => setNegoType(k as NegotiationType)}
              style={{
                background: negoType === k ? bg.accent : 'rgba(255,255,255,0.5)',
                color: negoType === k ? '#fff' : bg.ink,
                border: `1px solid ${bg.cardBorder}`,
                borderRadius: 12, padding: '0.5rem',
                fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left',
                fontFamily: IRIS_FONTS.body,
              }}>
              {v.emoji} {v.label}
            </button>
          ))}
        </div>
        {negoType === 'rate-counter' && (
          <input style={{ ...inp(bg), width: '100%', marginBottom: '0.6rem' }} type="number" placeholder="希望報酬 (円)"
            value={targetFee} onChange={e => setTargetFee(e.target.value)} />
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={gen} disabled={busy || !dealId} style={btnPrimary(bg)}>
            {busy ? '生成中…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> 交渉文を作る</span>}
          </button>
          <button onClick={ev} disabled={busy || !dealId} style={btnSecondary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Wallet size={14} /> 報酬チェック</span></button>
        </div>
      </Card>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p></Card>}

      {evalRes && (
        <Card bg={bg}>
          <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink }}>
            判定: {evalRes.verdict === 'accept' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981' }}><CheckCircle2 size={14} /> 受諾OK</span> : evalRes.verdict === 'counter' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#F59E0B' }}><AlertTriangle size={14} /> カウンター推奨</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#EF4444' }}><Ban size={14} /> 辞退推奨</span>}
          </p>
          <p style={{ color: bg.inkSoft, fontSize: '0.9rem' }}>妥当レンジ: ¥{evalRes.fairFee.min?.toLocaleString()} 〜 ¥{evalRes.fairFee.max?.toLocaleString()}</p>
          <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{evalRes.reason}</p>
          {evalRes.counterScript && <p style={{ marginTop: '0.5rem', fontStyle: 'italic', color: bg.accent }}>→ {evalRes.counterScript}</p>}
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

// ─── 投稿下書き ─────────────────────────────
function DraftView({ bg, desk, myDeals, mediaKit, settings, persona }: any) {
  const [dealId, setDealId] = useState('');
  const [tone, setTone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const gen = async () => {
    const deal = myDeals.find((d: InfluencerDeal) => d.id === dealId);
    if (!deal) { setErr('案件を選んでください'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await generateDraftCopy({ settings, persona, deal, mediaKit, toneNote: tone || undefined });
      const full = r.caption + '\n\n' + r.hashtags.join(' ') + '\n\n' + r.cta;
      desk.updateDeal(deal.id, { draftCopy: full, stage: deal.stage === 'inquiry' || deal.stage === 'negotiating' ? 'drafting' : deal.stage });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
        投稿下書き
      </h2>

      <Card bg={bg}>
        <select style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }} value={dealId} onChange={e => setDealId(e.target.value)}>
          <option value="">— 案件を選ぶ —</option>
          {myDeals.map((d: InfluencerDeal) => <option key={d.id} value={d.id}>{d.brandName}</option>)}
        </select>
        <input style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }} placeholder="トーン (例: 親しみやすく)" value={tone} onChange={e => setTone(e.target.value)} />
        <button onClick={gen} disabled={busy || !dealId} style={btnPrimary(bg)}>
          {busy ? '生成中…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> 下書きを作る</span>}
        </button>
      </Card>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p></Card>}

      {myDeals.filter((d: InfluencerDeal) => d.draftCopy).map((d: InfluencerDeal) => (
        <Card key={d.id} bg={bg}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.4rem' }}>
            <p style={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {PLATFORM_META[d.platform].emoji} {d.brandName}
            </p>
            <button onClick={() => navigator.clipboard?.writeText(d.draftCopy || '')} style={btnIcon(bg)} title="コピー" aria-label="コピー"><Clipboard size={16} strokeWidth={2.2} /></button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginBottom: '0.85rem' }}>{d.draftCopy}</pre>
          {/* Instagram シェアボタン群 */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                const r = await shareToInstagram({ caption: d.draftCopy || '', filename: `iris-${d.brandName || 'post'}.png` });
                alert(r.message);
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
                alert(r.message);
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

// ─── 画像加工スタジオ ─
type ImagePreset = {
  id: string;
  name: string;
  brightness: number;
  contrast: number;
  saturate: number;
  warmth: number;
  blur: number;
  vignette: number;
};

const USER_PRESETS_KEY = 'iris-image-user-presets-v1';

function loadUserPresets(): ImagePreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: ImagePreset[]) {
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  } catch { /* ignore quota */ }
}

function ImageStudioView({ bg }: { bg: IrisBackgroundDef; settings?: AppSettings }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const beforeCanvasRef = React.useRef<HTMLCanvasElement>(null);

  const [aspect, setAspect] = useState<'1:1' | '4:5' | '9:16' | 'free'>('1:1');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [warmth, setWarmth] = useState(0);
  const [blur, setBlur] = useState(0);
  const [vignette, setVignette] = useState(0);

  // AI プロンプト + Vision
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string>('');
  const [omakaseBusy, setOmakaseBusy] = useState(false);

  // Before/After 比較
  const [compareMode, setCompareMode] = useState(false);
  const [comparePos, setComparePos] = useState(50); // 0-100, 仕切り位置
  const compareWrapRef = React.useRef<HTMLDivElement>(null);

  // ユーザープリセット
  const [userPresets, setUserPresets] = useState<ImagePreset[]>(() => loadUserPresets());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Instagram シェア
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState('');

  const presets = [
    { id: 'editorial', label: 'Editorial', c: { brightness: 95, contrast: 115, saturate: 85, warmth: -5, vignette: 25 } },
    { id: 'glow',      label: 'Glow',      c: { brightness: 108, contrast: 92, saturate: 105, warmth: 8, vignette: 0 } },
    { id: 'film',      label: 'Film',      c: { brightness: 96, contrast: 108, saturate: 95, warmth: 12, vignette: 35 } },
    { id: 'noir',      label: 'Noir',      c: { brightness: 90, contrast: 130, saturate: 0, warmth: -10, vignette: 50 } },
    { id: 'rosy',      label: 'Rosy',      c: { brightness: 105, contrast: 102, saturate: 110, warmth: 18, vignette: 10 } },
    { id: 'matte',     label: 'Matte',     c: { brightness: 100, contrast: 90, saturate: 88, warmth: 4, vignette: 8 } },
    { id: 'reset',     label: 'Reset',     c: { brightness: 100, contrast: 100, saturate: 100, warmth: 0, vignette: 0 } },
  ];

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setImgUrl(url);
      const img = new Image();
      img.onload = () => setImgEl(img);
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = imgEl.naturalWidth, h = imgEl.naturalHeight;
    let cropW = w, cropH = h, cropX = 0, cropY = 0;
    if (aspect !== 'free') {
      const [aw, ah] = aspect.split(':').map(Number);
      const targetRatio = aw / ah;
      const imgRatio = w / h;
      if (imgRatio > targetRatio) {
        cropW = h * targetRatio;
        cropX = (w - cropW) / 2;
      } else {
        cropH = w / targetRatio;
        cropY = (h - cropH) / 2;
      }
    }

    const outMax = 1080;
    const scale = Math.min(1, outMax / Math.max(cropW, cropH));
    canvas.width = Math.round(cropW * scale);
    canvas.height = Math.round(cropH * scale);

    const filter = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturate}%)`,
      blur > 0 ? `blur(${blur}px)` : '',
      warmth !== 0 ? `sepia(${Math.abs(warmth) / 100 * 0.4})` : '',
      warmth < 0 ? `hue-rotate(180deg)` : '',
    ].filter(Boolean).join(' ');
    ctx.filter = filter;

    ctx.drawImage(imgEl, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    if (warmth > 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(255, 180, 130, ${warmth / 200})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (warmth < 0) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(180, 200, 255, ${-warmth / 200})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    if (vignette > 0) {
      const r = Math.max(canvas.width, canvas.height);
      const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, r * 0.4, canvas.width / 2, canvas.height / 2, r * 0.85);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${vignette / 100 * 0.7})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Before キャンバス (フィルタなし、同じクロップ)
    if (compareMode && beforeCanvasRef.current) {
      const bc = beforeCanvasRef.current;
      const bctx = bc.getContext('2d');
      if (bctx) {
        bc.width = canvas.width;
        bc.height = canvas.height;
        bctx.filter = 'none';
        bctx.drawImage(imgEl, cropX, cropY, cropW, cropH, 0, 0, bc.width, bc.height);
      }
    }
  }, [imgEl, aspect, brightness, contrast, saturate, warmth, blur, vignette, compareMode]);

  const applyPreset = (p: typeof presets[0]) => {
    setBrightness(p.c.brightness);
    setContrast(p.c.contrast);
    setSaturate(p.c.saturate);
    setWarmth(p.c.warmth);
    setVignette(p.c.vignette);
    setBlur(0);
  };

  const download = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `iris-edit-${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  };

  const downloadPng = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `iris-edit-${Date.now()}.png`;
    a.click();
  };

  const copyToClipboard = async () => {
    if (!canvasRef.current) return;
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvasRef.current!.toBlob(b => b ? resolve(b) : reject(), 'image/png');
      });
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })]);
      alert('クリップボードにコピーしました');
    } catch {
      alert('このブラウザはクリップボード画像コピーに対応していません');
    }
  };

  // AI に「こうして」と頼んで、パラメータを返してもらう
  const applyAiPrompt = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote('');
    try {
      const sys = `あなたは Instagram フォトレタッチの達人。ユーザーの自然言語要望から、CSS フィルタ値を JSON で返す。
返す JSON のキー (省略可、未指定はそのまま):
{
  "brightness": number (50-150, %),
  "contrast": number (50-150, %),
  "saturate": number (0-200, %),
  "warmth": number (-50 to 50, +は暖色, -は寒色),
  "blur": number (0-10, px),
  "vignette": number (0-100, %),
  "aspect": "1:1" | "4:5" | "9:16" | "free",
  "comment": "string (10-40字, 何をしたか)"
}
JSON だけを返し、説明文や \`\`\`json は不要。`;
      const userMsg = `現在: 明るさ${brightness}%, コントラスト${contrast}%, 彩度${saturate}%, 暖色${warmth}, ぼかし${blur}px, ビネット${vignette}%, 比率${aspect}\n\n要望: ${aiPrompt}`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMsg }],
          system: sys,
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      const text: string = data.text || data.content || data.message || '';
      // JSON 抽出
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 応答に JSON が含まれていません');
      const j = JSON.parse(match[0]);

      if (typeof j.brightness === 'number') setBrightness(Math.max(50, Math.min(150, j.brightness)));
      if (typeof j.contrast === 'number') setContrast(Math.max(50, Math.min(150, j.contrast)));
      if (typeof j.saturate === 'number') setSaturate(Math.max(0, Math.min(200, j.saturate)));
      if (typeof j.warmth === 'number') setWarmth(Math.max(-50, Math.min(50, j.warmth)));
      if (typeof j.blur === 'number') setBlur(Math.max(0, Math.min(10, j.blur)));
      if (typeof j.vignette === 'number') setVignette(Math.max(0, Math.min(100, j.vignette)));
      if (['1:1', '4:5', '9:16', 'free'].includes(j.aspect)) setAspect(j.aspect);
      setAiNote(j.comment || '適用しました');
      setAiPrompt('');
    } catch (e: any) {
      setAiNote(`エラー: ${e?.message || '不明'} — もう一度試してみてください`);
    } finally {
      setAiBusy(false);
    }
  };

  // ─── Vision: AI が画像を「見て」最適化 ───
  const omakaseOptimize = async () => {
    if (!imgEl || omakaseBusy) return;
    setOmakaseBusy(true);
    setAiNote('');
    try {
      // 解析用に縮小した base64 を作成 (トークン節約)
      const tmp = document.createElement('canvas');
      const maxSide = 384;
      const s = Math.min(1, maxSide / Math.max(imgEl.naturalWidth, imgEl.naturalHeight));
      tmp.width = Math.round(imgEl.naturalWidth * s);
      tmp.height = Math.round(imgEl.naturalHeight * s);
      const tctx = tmp.getContext('2d');
      if (!tctx) throw new Error('canvas ctx 取得失敗');
      tctx.drawImage(imgEl, 0, 0, tmp.width, tmp.height);
      const dataUrl = tmp.toDataURL('image/jpeg', 0.82);
      const b64 = dataUrl.split(',')[1] || '';

      const sys = `あなたは Instagram フォトレタッチの達人。送られた写真を見て、最も「映える」加工パラメータを JSON で返す。
返すキー (すべて必須):
{
  "brightness": number (50-150, %),
  "contrast": number (50-150, %),
  "saturate": number (0-200, %),
  "warmth": number (-50 to 50),
  "blur": number (0-10, 通常 0),
  "vignette": number (0-100),
  "aspect": "1:1" | "4:5" | "9:16" | "free",
  "comment": "string (15-50字, 写真の特徴と意図)"
}
判断材料: 暗い写真は brightness↑、コントラスト不足はcontrast↑、肌色は warmth+8〜+15、夜景・モダンは warmth-5〜-10、ポートレートは vignette 15-30、料理・物撮りは saturate 105-115。
JSON だけ返し、\`\`\`json は不要。`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
              { type: 'text', text: 'この写真に最適な加工パラメータを返してください。' },
            ],
          }],
          system: sys,
          max_tokens: 400,
        }),
      });
      const data = await res.json();
      const text: string =
        data?.content?.[0]?.text ||
        data?.text ||
        data?.message ||
        '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 応答に JSON が含まれていません');
      const j = JSON.parse(match[0]);

      if (typeof j.brightness === 'number') setBrightness(Math.max(50, Math.min(150, j.brightness)));
      if (typeof j.contrast === 'number') setContrast(Math.max(50, Math.min(150, j.contrast)));
      if (typeof j.saturate === 'number') setSaturate(Math.max(0, Math.min(200, j.saturate)));
      if (typeof j.warmth === 'number') setWarmth(Math.max(-50, Math.min(50, j.warmth)));
      if (typeof j.blur === 'number') setBlur(Math.max(0, Math.min(10, j.blur)));
      if (typeof j.vignette === 'number') setVignette(Math.max(0, Math.min(100, j.vignette)));
      if (['1:1', '4:5', '9:16', 'free'].includes(j.aspect)) setAspect(j.aspect);
      setAiNote(`おまかせ完了 — ${j.comment || '画像に合わせて最適化しました'}`);
    } catch (e: any) {
      setAiNote(`おまかせ失敗: ${e?.message || '不明'} — 通信状況を確認してもう一度`);
    } finally {
      setOmakaseBusy(false);
    }
  };

  // ─── プリセット保存 ───
  const saveCurrentAsPreset = () => {
    const name = newPresetName.trim();
    if (!name) return;
    const next: ImagePreset = {
      id: `up-${Date.now()}`,
      name,
      brightness, contrast, saturate, warmth, blur, vignette,
    };
    const updated = [...userPresets.filter(p => p.name !== name), next];
    setUserPresets(updated);
    saveUserPresets(updated);
    setShowSaveDialog(false);
    setNewPresetName('');
    setAiNote(`「${name}」を保存しました`);
  };

  const applyUserPreset = (p: ImagePreset) => {
    setBrightness(p.brightness);
    setContrast(p.contrast);
    setSaturate(p.saturate);
    setWarmth(p.warmth);
    setBlur(p.blur);
    setVignette(p.vignette);
  };

  const removeUserPreset = (id: string) => {
    const updated = userPresets.filter(p => p.id !== id);
    setUserPresets(updated);
    saveUserPresets(updated);
  };

  // ─── Instagram 直行 ───
  const shareToInsta = async () => {
    if (!canvasRef.current || shareBusy) return;
    setShareBusy(true);
    setShareNote('');
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvasRef.current!.toBlob(b => b ? resolve(b) : reject(new Error('blob 生成失敗')), 'image/jpeg', 0.95);
      });
      const result = await shareToInstagram({
        caption: '#iris で加工',
        image: blob,
        filename: `iris-${Date.now()}.jpg`,
      });
      setShareNote(result.message);
    } catch (e: any) {
      setShareNote(`シェア失敗: ${e?.message || '不明'}`);
    } finally {
      setShareBusy(false);
    }
  };

  // ─── 比較スライダーのドラッグ ───
  const onCompareMove = (clientX: number) => {
    const wrap = compareWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    setComparePos(Math.round((x / r.width) * 100));
  };

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
          The Retouch
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.4rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          画像加工スタジオ
        </h2>
      </div>

      {!imgUrl ? (
        <Card bg={bg}>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer',
            padding: '4rem 2rem', border: `2px dashed ${bg.cardBorder}`,
            borderRadius: 16, color: bg.inkSoft, minHeight: 44,
          }}>
            <Camera size={48} color={bg.accent} style={{ marginBottom: '0.85rem' }} />
            <div style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, marginBottom: '0.5rem' }}>
              写真をアップロード
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              JPG / PNG / WebP / HEIC ・ クリックまたはドラッグ
            </div>
            <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
          </label>
        </Card>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '1.25rem',
        }}
        className="iris-image-studio-layout"
        >
          {/* プレビュー (スティッキー) */}
          <div className="iris-image-studio-preview" style={{
            position: 'sticky',
            top: 'calc(env(safe-area-inset-top, 0px) + 96px)',
            zIndex: 5,
            alignSelf: 'start',
          }}>
            <Card bg={bg}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <button
                  onClick={() => setCompareMode(v => !v)}
                  style={{
                    ...btnSecondary(bg),
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.8rem',
                    minHeight: 36,
                    background: compareMode ? bg.accent : 'rgba(255,255,255,0.6)',
                    color: compareMode ? '#fff' : bg.ink,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                  aria-pressed={compareMode}
                >
                  <Eye size={14} />
                  {compareMode ? '比較中' : 'Before / After'}
                </button>
                {compareMode && (
                  <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>
                    左: 元画像 / 右: 加工後 — スライダーをドラッグ
                  </span>
                )}
              </div>

              {compareMode ? (
                <div
                  ref={compareWrapRef}
                  onMouseMove={e => { if (e.buttons === 1) onCompareMove(e.clientX); }}
                  onMouseDown={e => onCompareMove(e.clientX)}
                  onTouchMove={e => onCompareMove(e.touches[0].clientX)}
                  onTouchStart={e => onCompareMove(e.touches[0].clientX)}
                  style={{
                    position: 'relative', width: '100%',
                    minHeight: 280, maxHeight: '60dvh',
                    borderRadius: 12, overflow: 'hidden',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                    cursor: 'ew-resize', userSelect: 'none', touchAction: 'none',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{ display: 'block', width: '100%', maxHeight: '56dvh', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${comparePos}%`, height: '100%',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}>
                    <canvas
                      ref={beforeCanvasRef}
                      style={{
                        display: 'block',
                        width: `${100 / Math.max(comparePos, 0.001) * 100}%`,
                        maxWidth: 'none',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  {/* 仕切り線 */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${comparePos}%`, width: 2,
                    background: '#fff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                    pointerEvents: 'none',
                  }} />
                  {/* つまみ */}
                  <div style={{
                    position: 'absolute', top: '50%',
                    left: `${comparePos}%`, transform: 'translate(-50%, -50%)',
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: bg.accent,
                    pointerEvents: 'none',
                  }}>
                    <Eye size={18} />
                  </div>
                  {/* ラベル */}
                  <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    padding: '0.2rem 0.55rem', borderRadius: 6,
                    fontSize: '0.7rem', letterSpacing: '0.1em',
                    pointerEvents: 'none',
                  }}>BEFORE</div>
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: bg.accent, color: '#fff',
                    padding: '0.2rem 0.55rem', borderRadius: 6,
                    fontSize: '0.7rem', letterSpacing: '0.1em',
                    pointerEvents: 'none',
                  }}>AFTER</div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280, maxHeight: '60dvh' }}>
                  <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '56dvh', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
                </div>
              )}

              {/* AI ノート (操作直下) */}
              {aiNote && (
                <div style={{
                  marginTop: '0.6rem', padding: '0.6rem 0.9rem',
                  background: `${bg.accent}10`, borderRadius: 10,
                  fontSize: '0.82rem', color: bg.ink,
                  border: `1px solid ${bg.accent}30`,
                }}>
                  {aiNote}
                </div>
              )}
              {shareNote && (
                <div style={{
                  marginTop: '0.4rem', padding: '0.55rem 0.9rem',
                  background: 'rgba(255,255,255,0.6)', borderRadius: 10,
                  fontSize: '0.78rem', color: bg.ink,
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                  {shareNote}
                </div>
              )}
            </Card>
          </div>

          {/* コントロール群 */}
          <div style={{ display: 'grid', gap: '1.25rem', minWidth: 0 }}>

          {/* ─── AI 加工 ─── */}
          <Card bg={bg}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>AI に頼む</p>

            {/* おまかせ最適化 (Vision) */}
            <button
              onClick={omakaseOptimize}
              disabled={omakaseBusy}
              style={{
                ...btnPrimary(bg),
                width: '100%',
                marginBottom: '0.7rem',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: omakaseBusy ? 0.6 : 1,
                cursor: omakaseBusy ? 'not-allowed' : 'pointer',
                minHeight: 44,
              }}
            >
              {omakaseBusy ? <Loader2 size={16} className="iris-spin" /> : <Brain size={16} />}
              {omakaseBusy ? 'AI が画像を見ています…' : 'おまかせ最適化 (AI が写真を分析)'}
            </button>

            <p style={{ fontSize: '0.85rem', color: bg.inkSoft, marginBottom: '0.6rem', lineHeight: 1.6 }}>
              または「もっと暖かく」「エディトリアル風に」のように話しかけてください。
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyAiPrompt(); }}
                placeholder="例: 明るくふんわり、ピンクっぽく"
                style={{
                  flex: '1 1 240px', minWidth: 0,
                  padding: '0.65rem 0.9rem',
                  borderRadius: 10,
                  border: `1px solid ${bg.cardBorder}`,
                  background: 'rgba(255,255,255,0.7)',
                  color: bg.ink,
                  fontSize: '0.92rem',
                  fontFamily: IRIS_FONTS.body,
                }}
              />
              <button onClick={applyAiPrompt} disabled={!aiPrompt.trim() || aiBusy} style={{
                ...btnPrimary(bg),
                opacity: !aiPrompt.trim() || aiBusy ? 0.6 : 1,
                cursor: !aiPrompt.trim() || aiBusy ? 'not-allowed' : 'pointer',
              }}>
                {aiBusy ? '考え中…' : 'AI に頼む'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
              {[
                'もっと明るく',
                '暖かみを足して',
                'エディトリアル風',
                'ふんわりピンク',
                'コントラスト強め',
                'ノスタルジック',
              ].map(s => (
                <button key={s} onClick={() => { setAiPrompt(s); }} style={{
                  background: 'rgba(255,255,255,0.5)',
                  color: bg.ink,
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999, padding: '0.35rem 0.85rem',
                  fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                }}>
                  {s}
                </button>
              ))}
            </div>
          </Card>

          <Card bg={bg}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Crop</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { id: '1:1' as const, label: '1:1 Feed' },
                { id: '4:5' as const, label: '4:5 Portrait' },
                { id: '9:16' as const, label: '9:16 Story' },
                { id: 'free' as const, label: 'Free' },
              ].map(a => (
                <button key={a.id} onClick={() => setAspect(a.id)} style={{
                  background: aspect === a.id ? bg.accent : 'rgba(255,255,255,0.5)',
                  color: aspect === a.id ? '#fff' : bg.ink,
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999, padding: '0.5rem 1rem',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                }}>
                  {a.label}
                </button>
              ))}
            </div>
          </Card>

          <Card bg={bg}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Filter</p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button key={p.id} onClick={() => applyPreset(p)} style={{
                  background: 'rgba(255,255,255,0.5)',
                  color: bg.ink,
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 999, padding: '0.5rem 1.1rem',
                  fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                  fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
                  minHeight: 36,
                }}>
                  {p.label}
                </button>
              ))}
            </div>
          </Card>

          {/* ─── マイプリセット ─── */}
          <Card bg={bg}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, margin: 0 }}>
                マイプリセット
              </p>
              <button
                onClick={() => setShowSaveDialog(v => !v)}
                style={{
                  ...btnSecondary(bg),
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  minHeight: 36,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <BookmarkPlus size={14} />
                現在の調整を保存
              </button>
            </div>

            {showSaveDialog && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
                <input
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveCurrentAsPreset(); }}
                  placeholder="プリセット名 (例: 朝ごはん用)"
                  autoFocus
                  style={{
                    flex: '1 1 200px', minWidth: 0,
                    padding: '0.55rem 0.85rem',
                    borderRadius: 10,
                    border: `1px solid ${bg.cardBorder}`,
                    background: 'rgba(255,255,255,0.7)',
                    color: bg.ink,
                    fontSize: '0.88rem',
                    fontFamily: IRIS_FONTS.body,
                  }}
                />
                <button
                  onClick={saveCurrentAsPreset}
                  disabled={!newPresetName.trim()}
                  style={{
                    ...btnPrimary(bg),
                    padding: '0.55rem 1.1rem',
                    minHeight: 40,
                    opacity: !newPresetName.trim() ? 0.6 : 1,
                  }}
                >
                  保存
                </button>
              </div>
            )}

            {userPresets.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.6 }}>
                よく使う調整値を「マイプリセット」として保存できます。スライダーを調整した状態で「保存」ボタンを押してください。
              </p>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {userPresets.map(p => (
                  <div key={p.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: 'rgba(255,255,255,0.55)',
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 999,
                    paddingLeft: '0.85rem',
                  }}>
                    <button
                      onClick={() => applyUserPreset(p)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: bg.ink, fontSize: '0.84rem', fontWeight: 500,
                        cursor: 'pointer', padding: '0.45rem 0.2rem',
                        fontFamily: IRIS_FONTS.body, minHeight: 36,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Bookmark size={12} />
                      {p.name}
                    </button>
                    <button
                      onClick={() => removeUserPreset(p.id)}
                      aria-label={`${p.name} を削除`}
                      style={{
                        background: 'transparent', border: 'none',
                        color: bg.inkSoft, cursor: 'pointer',
                        padding: '0.4rem 0.7rem 0.4rem 0.4rem',
                        display: 'inline-flex', alignItems: 'center',
                        minHeight: 36, minWidth: 36,
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card bg={bg}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>Adjust</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <Slider label="明るさ" value={brightness} min={50} max={150} onChange={setBrightness} suffix="%" bg={bg} />
              <Slider label="コントラスト" value={contrast} min={50} max={150} onChange={setContrast} suffix="%" bg={bg} />
              <Slider label="彩度" value={saturate} min={0} max={200} onChange={setSaturate} suffix="%" bg={bg} />
              <Slider label="暖色 (寒色)" value={warmth} min={-50} max={50} onChange={setWarmth} bg={bg} />
              <Slider label="ぼかし" value={blur} min={0} max={10} onChange={setBlur} suffix="px" bg={bg} />
              <Slider label="ビネット" value={vignette} min={0} max={100} onChange={setVignette} suffix="%" bg={bg} />
            </div>
          </Card>

          <Card bg={bg}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Background</p>
            <p style={{ color: bg.inkSoft, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.7 }}>
              背景の自動削除は、現在の編集中画像を <strong>remove.bg</strong> や <strong>cutout.pro</strong> などの専用サービスへ送って処理する形に対応しています。<br />
              下のボタンから加工後の画像をダウンロード → サービスにアップロード → 背景透過 PNG をまた読み込み直してください。
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" style={{ ...btnSecondary(bg), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Wand2 size={14} /> remove.bg を開く
              </a>
              <a href="https://www.cutout.pro/" target="_blank" rel="noreferrer" style={{ ...btnSecondary(bg), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Scissors size={14} /> cutout.pro を開く
              </a>
            </div>
            <p style={{ color: bg.inkSoft, fontSize: '0.78rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              ※ Iris 内蔵の AI 背景削除は次回アップデートで実装予定 (@imgly/background-removal を統合)
            </p>
          </Card>

          <Card bg={bg}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={shareToInsta}
                disabled={shareBusy}
                style={{
                  ...btnPrimary(bg),
                  background: 'linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)',
                  boxShadow: '0 6px 18px rgba(221, 42, 123, 0.45)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  minHeight: 44,
                  opacity: shareBusy ? 0.6 : 1,
                  cursor: shareBusy ? 'not-allowed' : 'pointer',
                }}
              >
                {shareBusy ? <Loader2 size={14} className="iris-spin" /> : <Send size={14} />}
                {shareBusy ? '準備中…' : 'Instagram で投稿'}
              </button>
              <button onClick={download} style={{ ...btnPrimary(bg), display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Download size={14} /> JPG ダウンロード
              </button>
              <button onClick={downloadPng} style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <ImageIcon size={14} /> PNG ダウンロード
              </button>
              <button onClick={copyToClipboard} style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <Clipboard size={14} /> コピー
              </button>
              <button onClick={() => { setImgUrl(null); setImgEl(null); }} style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
                <RefreshCw size={14} /> 別の写真
              </button>
            </div>
          </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, onChange, suffix, bg }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; suffix?: string;
  bg: IrisBackgroundDef;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.3rem' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: bg.ink }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: bg.accent }} />
    </label>
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
        メディアキット
      </h2>
      <p style={{ color: bg.inkSoft }}>この情報は AI が交渉文や下書きを作るときに、すべての判断材料として使います。</p>

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

        <p style={{ marginTop: '0.75rem', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>平均ER (%)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.4rem' }}>
          {(['instagram','tiktok','youtube','x'] as Platform[]).map(p => (
            <input key={p} style={inp(bg)} type="number" step="0.1" placeholder={PLATFORM_META[p].label}
              value={d.avgEngagementRate?.[p] || ''}
              onChange={e => setD({ ...d, avgEngagementRate: { ...(d.avgEngagementRate || {}), [p]: Number(e.target.value) || undefined } })} />
          ))}
        </div>

        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="主なオーディエンス (例: 25-34歳女性)" value={d.audienceProfile || ''} onChange={e => setD({ ...d, audienceProfile: e.target.value })} />
        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="希望報酬レンジ" value={d.rateCard || ''} onChange={e => setD({ ...d, rateCard: e.target.value })} />
        <textarea style={{ ...inp(bg), width: '100%', marginTop: '0.5rem' }} rows={2} placeholder="ブランド観・NG事項" value={d.brandValues || ''} onChange={e => setD({ ...d, brandValues: e.target.value })} />

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

  const add = () => {
    if (!m.name?.trim()) return;
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
    alert('チーム情報を JSON でコピーしました。仲間に渡してください。');
  };
  const tryImport = () => {
    if (!importText.trim()) return;
    const r = team.importTeam(importText);
    if (r.error) { alert('インポートエラー: ' + r.error); return; }
    alert(`${r.added} 件追加しました`);
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
                <button onClick={() => { if (confirm('削除しますか?')) team.removeMember(member.id); }} title="削除" aria-label="削除" style={btnIcon(bg)}><Trash2 size={16} strokeWidth={2.2} /></button>
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
function BrandMatchView({ bg, desk, mediaKit, settings }: {
  bg: IrisBackgroundDef;
  desk: ReturnType<typeof useInfluencerDesk>;
  mediaKit?: MediaKit;
  settings: AppSettings;
}) {
  const [companies, setCompanies] = useState(() => loadPrismCompanies());
  const [search, setSearch] = useState('');
  const [pitchTarget, setPitchTarget] = useState<typeof companies[0] | null>(null);
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('post');
  const [proposedFee, setProposedFee] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ subject: string; body: string; matchReason: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.companyName.toLowerCase().includes(q) ||
      (c.industry || '').toLowerCase().includes(q) ||
      (c.overview || '').toLowerCase().includes(q)
    );
  }, [companies, search]);

  const refresh = () => setCompanies(loadPrismCompanies());

  const generatePitch = async () => {
    if (!pitchTarget) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await generateTieupPitch({
        settings, company: pitchTarget, mediaKit,
        platform, contentType,
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
    alert('案件として保存しました。「案件」タブで確認できます。');
    setPitchTarget(null);
    setResult(null);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>BRAND × CREATOR</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: '0.25rem 0 0' }}>
          ブランドを、見つける。
        </h2>
        <p style={{ color: bg.inkSoft, marginTop: '0.5rem', fontSize: '0.9rem' }}>
          CORE Prism 側で集めた企業リサーチから、相性のよさそうなブランドを探して、こちら (Iris) からタイアップを打診できます。
        </p>
      </div>

      {companies.length === 0 ? (
        <Card bg={bg}>
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '1.5rem 0', lineHeight: 1.8 }}>
            まだブランドリストがありません。<br />
            <a href="/?app=1" target="_blank" rel="noreferrer" style={{ color: bg.accent, fontWeight: 700 }}>
              CORE Prism (本家) →
            </a>
            の「商談 AI エージェント」で企業リサーチを行うと、ここに表示されます。
          </p>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...inp(bg), flex: 1, minWidth: 200 }}
              placeholder="業界・社名で絞り込み"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button onClick={refresh} style={btnSecondary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> 更新</span></button>
            <span style={{ color: bg.inkSoft, fontSize: '0.85rem' }}>{filtered.length} 社</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
            {filtered.map(c => (
              <Card key={c.id} bg={bg}>
                <p style={{ fontSize: '1.05rem', fontWeight: 700, color: bg.ink, marginBottom: '0.25rem' }}>
                  {c.companyName}
                </p>
                {c.industry && <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginBottom: '0.5rem' }}>{c.industry}</p>}
                {c.overview && <p style={{ fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.7, marginBottom: '0.5rem' }}>
                  {c.overview.slice(0, 100)}{c.overview.length > 100 ? '…' : ''}
                </p>}
                {c.predictedChallenges && c.predictedChallenges.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    {c.predictedChallenges.slice(0, 3).map((ch, i) => (
                      <span key={i} style={{ background: bg.accent + '22', color: bg.accent, padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 }}>
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
                <button onClick={() => { setPitchTarget(c); setResult(null); setErr(null); }} style={{ ...btnPrimary(bg), width: '100%', marginTop: '0.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Handshake size={14} /> タイアップを打診</span>
                </button>
              </Card>
            ))}
          </div>

          {pitchTarget && (
            <Card bg={bg}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontSize: '0.7rem', color: bg.inkSoft, letterSpacing: '0.15em' }}>PITCH TO</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: bg.ink }}>{pitchTarget.companyName}</p>
                </div>
                <button onClick={() => { setPitchTarget(null); setResult(null); }} title="閉じる" aria-label="閉じる" style={btnIcon(bg)}><X size={16} strokeWidth={2.4} /></button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <select style={inp(bg)} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
                  {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
                <select style={inp(bg)} value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>
                  {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input style={inp(bg)} type="number" placeholder="希望報酬 (円)" value={proposedFee} onChange={e => setProposedFee(e.target.value)} />
              </div>
              <textarea style={{ ...inp(bg), width: '100%', marginBottom: '0.5rem' }} rows={2} placeholder="追加指示 (例: ブランドに共感したポイント等)" value={customNote} onChange={e => setCustomNote(e.target.value)} />
              <button onClick={generatePitch} disabled={busy} style={btnPrimary(bg)}>
                {busy ? '生成中…' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={14} /> 打診メールを生成</span>}
              </button>

              {err && <p style={{ color: '#FF5C5C', marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> {err}</p>}

              {result && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)', border: `1px solid ${bg.cardBorder}` }}>
                  <p style={{ fontSize: '0.75rem', color: bg.inkSoft, letterSpacing: '0.15em', marginBottom: '0.25rem' }}>MATCH REASON</p>
                  <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{result.matchReason}</p>
                  <p style={{ fontSize: '0.75rem', color: bg.inkSoft, letterSpacing: '0.15em', marginBottom: '0.25rem' }}>SUBJECT</p>
                  <p style={{ fontWeight: 600, color: bg.ink, marginBottom: '0.5rem' }}>{result.subject}</p>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.7, color: bg.ink }}>{result.body}</pre>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => navigator.clipboard?.writeText((result.subject ? `件名: ${result.subject}\n\n` : '') + result.body)} style={btnSecondary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clipboard size={14} /> コピー</span></button>
                    <button onClick={saveAsDeal} style={btnPrimary(bg)}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> 案件として保存</span></button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

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
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.28em', color: bg.accent, fontWeight: 700, marginBottom: 4 }}>BRAND GUIDE</p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>ブランドの世界観。</h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginTop: 4 }}>色・トーン・NGワードを保存し、AI が投稿生成時に自動でガイドします。</p>
      </div>

      {/* ── マルチアカウント管理 ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Smartphone size={16} color={bg.accent} /> 登録アカウント</h3>
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
                <button onClick={() => { if (confirm(`${acct.handle} を削除しますか?`)) multiAccount.remove(acct.id); }}
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
                { label: 'ブランド名', key: 'name' },
                { label: 'キャッチフレーズ', key: 'tagline' },
                { label: '世界観・説明', key: 'bio' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>{f.label}</label>
                  <input value={(draft as unknown as Record<string, string>)[f.key] || ''} onChange={e => setDraft(p => p ? { ...p, [f.key]: e.target.value } : p)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>トーン</label>
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
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>ブランドカラー (Primary Hex)</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="color" value={draft.colors[0]?.hex || '#E1306C'} onChange={e => setDraft(p => p ? { ...p, colors: [{ name: 'Primary', hex: e.target.value }, ...(p.colors.slice(1))] } : p)}
                    style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${bg.cardBorder}`, cursor: 'pointer' }} />
                  <input type="color" value={draft.colors[1]?.hex || '#FCB045'} onChange={e => setDraft(p => p ? { ...p, colors: [p.colors[0], { name: 'Accent', hex: e.target.value }] } : p)}
                    style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${bg.cardBorder}`, cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>Primary / Accent</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>NGワード (カンマ区切り)</label>
                <input value={draft.ngWords.join(', ')} onChange={e => setDraft(p => p ? { ...p, ngWords: e.target.value.split(/[,、]+/).map(s => s.trim()).filter(Boolean) } : p)}
                  placeholder="例: 安い, 激安, プチプラ"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>必須キーワード (カンマ区切り)</label>
                <input value={draft.mustWords.join(', ')} onChange={e => setDraft(p => p ? { ...p, mustWords: e.target.value.split(/[,、]+/).map(s => s.trim()).filter(Boolean) } : p)}
                  placeholder="例: 上質, 大人, 洗練"
                  style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>絵文字スタイル</label>
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
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>トーン:</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: bg.accent }}>{TONE_META[g.tone].emoji} {TONE_META[g.tone].label}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>カラー:</span>
                {g.colors.map(c => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: c.hex, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{c.name} {c.hex}</span>
                  </div>
                ))}
              </div>
              {g.ngWords.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>NGワード: </span>
                  {g.ngWords.map(w => (
                    <span key={w} style={{ fontSize: '0.75rem', background: '#FFE5EE', color: '#C8102E', borderRadius: 999, padding: '0.15rem 0.55rem', marginRight: 4 }}>{w}</span>
                  ))}
                </div>
              )}
              {g.mustWords.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>必須KW: </span>
                  {g.mustWords.map(w => (
                    <span key={w} style={{ fontSize: '0.75rem', background: `${bg.accent}15`, color: bg.accent, borderRadius: 999, padding: '0.15rem 0.55rem', marginRight: 4 }}>{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ブランドコンサル: スタイルチェック ── */}
      <div style={card}>
        <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: '0 0 0.85rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Bot size={16} color={bg.accent} /> ブランドコンサル — スタイルチェック</span>
        </h3>
        <p style={{ fontSize: '0.83rem', color: bg.inkSoft, marginBottom: '0.85rem' }}>
          投稿文をここに貼ると、AI がブランドガイドラインと照合してスコアと改善案を出してくれます。
        </p>
        <textarea value={checkText} onChange={e => setCheckText(e.target.value)} rows={5}
          placeholder="チェックしたい投稿文を貼り付けてください…"
          style={{
            width: '100%', padding: '0.75rem 1rem', borderRadius: 14,
            border: `1px solid ${bg.cardBorder}`, fontSize: '0.88rem',
            resize: 'vertical', boxSizing: 'border-box', fontFamily: IRIS_FONTS.body,
            background: 'rgba(255,255,255,0.9)', color: bg.ink,
          }} />
        <button onClick={handleStyleCheck} disabled={checking || !checkText.trim() || !g}
          style={{ ...btnPrimary(bg), marginTop: '0.65rem', opacity: checking || !checkText.trim() || !g ? 0.5 : 1 }}>
          {checking
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hourglass size={14} /> 分析中…</span>
            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={14} /> ブランドコンサルを受ける</span>}
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
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C8102E', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={12} /> 問題点</p>
                {checkResult.violations.map((v, i) => <p key={i} style={{ fontSize: '0.82rem', color: '#C8102E', margin: '0 0 2px' }}>· {v}</p>)}
              </div>
            )}
            {checkResult.suggestions.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: bg.accent, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lightbulb size={12} /> 改善提案</p>
                {checkResult.suggestions.map((s, i) => <p key={i} style={{ fontSize: '0.82rem', color: bg.inkSoft, margin: '0 0 2px' }}>· {s}</p>)}
              </div>
            )}
            {checkResult.revised && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}` }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.accent, marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Sparkles size={12} /> 改善後の文章</p>
                <p style={{ fontSize: '0.85rem', color: bg.ink, margin: 0, whiteSpace: 'pre-wrap' }}>{checkResult.revised}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
