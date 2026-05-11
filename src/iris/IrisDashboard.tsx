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
import { useIrisTeam, ROLE_META, type IrisTeamMember, type MemberRole } from './team';
import { loadPrismCompanies, generateTieupPitch } from './brandMatch';
import IrisDirectorView from './IrisDirectorView';
import VideoStudio from '../components/VideoStudio';
import IrisTriageView from './IrisTriageView';
import IrisCommunityView from './IrisCommunityView';
import IrisStrategistView from './IrisStrategistView';
import IrisQuickAdd from './IrisQuickAdd';
import IrisVoiceHome from './IrisVoiceHome';
import { IrisLogo } from '../components/Logo';
import SupportChat from '../components/SupportChat';
import ShortcutHelpModal from '../components/ShortcutHelpModal';
import PwaInstallPrompt from '../components/PwaInstallPrompt';
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

type Tab = 'home' | 'strategy' | 'deals' | 'triage' | 'director' | 'video' | 'negotiate' | 'draft' | 'beauty' | 'image' | 'community' | 'team' | 'brands' | 'kit' | 'health' | 'revenue' | 'fans' | 'collab' | 'guideline';

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
    icon: '🌸',
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
      minHeight: '100vh',
      background: bg.background,
      color: bg.ink,
      fontFamily: IRIS_FONTS.body,
      ...themeStyle,
    }}>
      {/* ヘッダ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        padding: '0.85rem 1.25rem',
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
            {/* アカウントスイッチャー */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAccountSwitcherOpen(v => !v)}
                title="アカウント切り替え"
                style={{
                  ...btnIcon(bg),
                  width: 'auto', padding: '0 0.75rem',
                  gap: '0.4rem', display: 'inline-flex', alignItems: 'center',
                  fontSize: '0.78rem', fontWeight: 700,
                }}>
                <span>{multiAccount.active?.avatarEmoji || '👤'}</span>
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {multiAccount.active?.handle || '@me'}
                </span>
                <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>▼</span>
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
                      <span style={{ fontSize: '1.1rem' }}>{acct.avatarEmoji || '👤'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: bg.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct.handle}</div>
                        <div style={{ fontSize: '0.7rem', color: bg.inkSoft }}>
                          {ACCOUNT_TYPE_META[acct.type].emoji} {ACCOUNT_TYPE_META[acct.type].label}
                          {' · '}{PLATFORM_META_ACCOUNT[acct.platform].label}
                        </div>
                      </div>
                      {acct.id === multiAccount.active?.id && (
                        <span style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 700 }}>選択中</span>
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
            <button onClick={() => setBgPickerOpen(true)} title="背景を変える"
              style={btnIcon(bg)}>
              {bg.emoji}
            </button>
            <button onClick={() => setMoreOpen(true)} title="メニュー" className="iris-tab-more-trigger"
              style={btnIcon(bg)}>≡</button>
            <button onClick={onLeave} title="戻る" style={btnIcon(bg)}>←</button>
          </div>
        </div>

        {/* タブ — モバイルでは「主要タブのみ」、PC ではスクロールで全表示 */}
        <nav className="iris-tabs" style={{
          maxWidth: 1280, margin: '0.5rem auto 0', display: 'flex', gap: '0.4rem',
          overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4,
        }}>
          {[
            { id: 'home' as Tab,      e: '✦', l: 'ホーム',       primary: true },
            { id: 'strategy' as Tab,  e: '📈', l: '戦略',         primary: true },
            { id: 'triage' as Tab,    e: '🔍', l: '案件精査',     primary: true },
            { id: 'deals' as Tab,     e: '💌', l: '案件',         primary: true },
            { id: 'director' as Tab,  e: '🎬', l: '丸投げ編集',   primary: false },
            { id: 'negotiate' as Tab, e: '💬', l: '交渉',         primary: false },
            { id: 'draft' as Tab,     e: '✍',  l: '投稿下書き',   primary: false },
            { id: 'image' as Tab,     e: '📷', l: '画像加工',     primary: false },
            { id: 'beauty' as Tab,    e: '💆‍♀️', l: '美容相談',  primary: false },
            { id: 'health' as Tab,    e: '🌿', l: 'ヘルス',       primary: false },
            { id: 'community' as Tab, e: '🌹', l: 'コミュニティ', primary: false },
            { id: 'team' as Tab,      e: '🌷', l: 'チーム',       primary: false },
            { id: 'brands' as Tab,    e: '🤝', l: 'ブランド探し', primary: false },
            { id: 'kit' as Tab,       e: '📇', l: 'メディアキット', primary: false },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={t.primary ? 'iris-tab-primary' : 'iris-tab-secondary'}
              style={{
                background: tab === t.id
                  ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`
                  : 'rgba(255,255,255,0.92)',
                color: tab === t.id ? '#FFFFFF' : '#1F1A2E',
                border: tab === t.id ? 'none' : `1px solid rgba(31,26,46,0.08)`,
                borderRadius: 999,
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: tab === t.id ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: IRIS_FONTS.body,
                boxShadow: tab === t.id
                  ? `0 6px 18px ${bg.accent}55`
                  : '0 1px 3px rgba(31,26,46,0.06)',
                transition: 'all 0.15s',
              }}>
              <span style={{ marginRight: 6 }}>{t.e}</span>
              {t.l}
            </button>
          ))}
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
            }}>
            ⋯ メニュー
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
                maxHeight: '78vh', overflowY: 'auto',
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem' }}>
                {[
                  { id: 'home' as Tab,      e: '✦', l: 'ホーム' },
                  { id: 'strategy' as Tab,  e: '📈', l: '戦略' },
                  { id: 'triage' as Tab,    e: '🔍', l: '案件精査' },
                  { id: 'deals' as Tab,     e: '💌', l: '案件' },
                  { id: 'director' as Tab,  e: '🎬', l: '丸投げ編集' },
                  { id: 'negotiate' as Tab, e: '💬', l: '交渉' },
                  { id: 'draft' as Tab,     e: '✍',  l: '投稿下書き' },
                  { id: 'image' as Tab,     e: '📷', l: '画像加工' },
                  { id: 'beauty' as Tab,    e: '💆‍♀️', l: '美容相談' },
                  { id: 'health' as Tab,    e: '🌿', l: 'ヘルス' },
                  { id: 'community' as Tab, e: '🌹', l: 'コミュニティ' },
                  { id: 'team' as Tab,      e: '🌷', l: 'チーム' },
                  { id: 'brands' as Tab,    e: '🤝', l: 'ブランド探し' },
                  { id: 'kit' as Tab,       e: '📇', l: 'メディアキット' },
                ].map(t => (
                  <button key={t.id}
                    onClick={() => { setTab(t.id); setMoreOpen(false); }}
                    style={{
                      background: tab === t.id ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}dd)` : 'rgba(248,244,252,1)',
                      color: tab === t.id ? '#fff' : '#1F1A2E',
                      border: 'none', borderRadius: 14,
                      padding: '0.85rem 0.5rem', fontSize: '0.85rem', fontWeight: 600,
                      cursor: 'pointer', textAlign: 'center',
                      boxShadow: tab === t.id ? `0 6px 18px ${bg.accent}45` : 'none',
                      minHeight: 56,
                    }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{t.e}</div>
                    {t.l}
                  </button>
                ))}
              </div>
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
                maxWidth: 700, width: '100%', maxHeight: '85vh', overflow: 'auto',
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

              <p style={{ fontSize: '0.75rem', color: IRIS_COLORS.inkSoft, marginBottom: '0.5rem' }}>
                ✨ プリセット (補色ペア)
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
                  <p style={{ fontSize: '0.75rem', color: IRIS_COLORS.inkSoft, marginTop: '1.25rem', marginBottom: '0.5rem' }}>
                    🌟 マイ・カスタム
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
                          <button onClick={() => handleRemoveCustom(b.id)} style={{
                            position: 'absolute', top: 6, right: 6,
                            background: 'rgba(255,255,255,0.85)',
                            border: 'none', borderRadius: 999,
                            width: 26, height: 26,
                            cursor: 'pointer', fontSize: '0.85rem',
                          }}>🗑</button>
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
                ✨ 自分だけの背景を作る
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
        <StatCard bg={bg} label="進行中" value={myDeals.filter(d => !['closed','declined'].includes(d.stage)).length + ' 件'} icon="💌" />
        <StatCard bg={bg} label="今週納期" value={upcoming.filter(e => e.daysLeft <= 7).length + ' 件'} icon="📅" />
        <StatCard bg={bg} label="総報酬" value={'¥' + earnings.toLocaleString()} icon="💰" />
        <StatCard bg={bg} label="完了案件" value={myDeals.filter(d => d.stage === 'closed').length + ' 件'} icon="✨" />
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
          {[
            { e: '🔍', l: '案件を精査',     tab: 'triage' },
            { e: '🎬', l: '丸投げ編集',     tab: 'director' },
            { e: '💬', l: '交渉文を書く',   tab: 'negotiate' },
            { e: '📷', l: '写真を加工',     tab: 'image' },
            { e: '💆‍♀️', l: '美容相談',     tab: 'beauty' },
            { e: '🌹', l: 'コミュニティ',   tab: 'community' },
          ].map((q) => (
            <button key={q.l} onClick={() => setTab && setTab(q.tab as any)} style={{
              background: 'rgba(255,255,255,0.85)',
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 16,
              padding: '1.1rem 0.75rem',
              cursor: 'pointer',
              textAlign: 'center',
              color: '#1F1A2E',
              fontFamily: IRIS_FONTS.body,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 22px ${bg.accent}33`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{q.e}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{q.l}</div>
            </button>
          ))}
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
            ✨ AI で追加
          </button>
          <button onClick={() => setOpen(!open)} style={{
            background: 'rgba(255,255,255,0.85)', color: '#1F1A2E',
            border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
            padding: '0.7rem 1.2rem', fontWeight: 600, cursor: 'pointer',
            fontSize: '0.85rem', fontFamily: IRIS_FONTS.body,
          }}>
            {open ? '閉じる' : '✏ 手動'}
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
          <p style={{ textAlign: 'center', color: bg.inkSoft, padding: '2rem 0' }}>まだ案件はありません 🌸</p>
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
              <button onClick={() => { if (confirm('削除しますか?')) desk.removeDeal(deal.id); }} style={btnIcon(bg)}>🗑</button>
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
            {busy ? '生成中…' : '✨ 交渉文を作る'}
          </button>
          <button onClick={ev} disabled={busy || !dealId} style={btnSecondary(bg)}>💴 報酬チェック</button>
        </div>
      </Card>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C' }}>⚠ {err}</p></Card>}

      {evalRes && (
        <Card bg={bg}>
          <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink }}>
            判定: {evalRes.verdict === 'accept' ? '✅ 受諾OK' : evalRes.verdict === 'counter' ? '🟡 カウンター推奨' : '🔴 辞退推奨'}
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
              <button onClick={() => navigator.clipboard?.writeText((n.subject ? `件名: ${n.subject}\n\n` : '') + n.body)} style={btnIcon(bg)}>📋</button>
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
          {busy ? '生成中…' : '✨ 下書きを作る'}
        </button>
      </Card>

      {err && <Card bg={bg}><p style={{ color: '#FF5C5C' }}>⚠ {err}</p></Card>}

      {myDeals.filter((d: InfluencerDeal) => d.draftCopy).map((d: InfluencerDeal) => (
        <Card key={d.id} bg={bg}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <p style={{ fontWeight: 700 }}>{PLATFORM_META[d.platform].emoji} {d.brandName}</p>
            <button onClick={() => navigator.clipboard?.writeText(d.draftCopy || '')} style={btnIcon(bg)}>📋</button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{d.draftCopy}</pre>
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
function ImageStudioView({ bg }: { bg: IrisBackgroundDef; settings?: AppSettings }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [aspect, setAspect] = useState<'1:1' | '4:5' | '9:16' | 'free'>('1:1');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [warmth, setWarmth] = useState(0);
  const [blur, setBlur] = useState(0);
  const [vignette, setVignette] = useState(0);

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
  }, [imgEl, aspect, brightness, contrast, saturate, warmth, blur, vignette]);

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
            display: 'block', textAlign: 'center', cursor: 'pointer',
            padding: '4rem 2rem', border: `2px dashed ${bg.cardBorder}`,
            borderRadius: 16, color: bg.inkSoft,
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📷</div>
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
        <>
          <Card bg={bg}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360 }}>
              <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' }} />
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
                }}>
                  {p.label}
                </button>
              ))}
            </div>
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
              <a href="https://www.remove.bg/" target="_blank" rel="noreferrer" style={{ ...btnSecondary(bg), textDecoration: 'none' }}>
                🪄 remove.bg を開く
              </a>
              <a href="https://www.cutout.pro/" target="_blank" rel="noreferrer" style={{ ...btnSecondary(bg), textDecoration: 'none' }}>
                ✂ cutout.pro を開く
              </a>
            </div>
            <p style={{ color: bg.inkSoft, fontSize: '0.78rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              ※ Iris 内蔵の AI 背景削除は次回アップデートで実装予定 (@imgly/background-removal を統合)
            </p>
          </Card>

          <Card bg={bg}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={download} style={btnPrimary(bg)}>📥 JPG ダウンロード</button>
              <button onClick={downloadPng} style={btnSecondary(bg)}>🖼 PNG ダウンロード</button>
              <button onClick={copyToClipboard} style={btnSecondary(bg)}>📋 コピー</button>
              <button onClick={() => { setImgUrl(null); setImgEl(null); }} style={btnSecondary(bg)}>🔄 別の写真</button>
            </div>
          </Card>
        </>
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

        <button onClick={save} style={{ ...btnPrimary(bg), marginTop: '0.75rem' }}>💾 保存</button>
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
            🌷 まだメンバーがいません。<br />
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
                <button onClick={() => { if (confirm('削除しますか?')) team.removeMember(member.id); }} style={btnIcon(bg)}>🗑</button>
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
          <button onClick={exportJson} style={btnPrimary(bg)}>📤 JSON でエクスポート</button>
        </div>
        <textarea
          style={{ ...inp(bg), width: '100%', minHeight: 90, marginBottom: '0.5rem', fontFamily: 'monospace', fontSize: '0.78rem' }}
          placeholder="ここに仲間からもらった JSON を貼り付け"
          value={importText}
          onChange={e => setImportText(e.target.value)}
        />
        <button onClick={tryImport} disabled={!importText.trim()} style={btnSecondary(bg)}>📥 インポート</button>
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
                <button onClick={() => { navigator.clipboard?.writeText(t.body); team.incrementTemplateUse(t.id); }} style={{ ...btnIcon(bg), width: 'auto', padding: '0.3rem 0.7rem', marginTop: '0.4rem' }}>📋 使う</button>
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
    alert('案件として保存しました。「💌 案件」タブで確認できます。');
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
            🌸 まだブランドリストがありません。<br />
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
              placeholder="🔍 業界・社名で絞り込み"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button onClick={refresh} style={btnSecondary(bg)}>🔄 更新</button>
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
                  🤝 タイアップを打診
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
                <button onClick={() => { setPitchTarget(null); setResult(null); }} style={btnIcon(bg)}>✕</button>
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
                {busy ? '生成中…' : '✨ 打診メールを生成'}
              </button>

              {err && <p style={{ color: '#FF5C5C', marginTop: '0.5rem' }}>⚠ {err}</p>}

              {result && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 12, background: 'rgba(255,255,255,0.5)', border: `1px solid ${bg.cardBorder}` }}>
                  <p style={{ fontSize: '0.75rem', color: bg.inkSoft, letterSpacing: '0.15em', marginBottom: '0.25rem' }}>MATCH REASON</p>
                  <p style={{ color: bg.inkSoft, fontSize: '0.85rem', marginBottom: '0.75rem' }}>{result.matchReason}</p>
                  <p style={{ fontSize: '0.75rem', color: bg.inkSoft, letterSpacing: '0.15em', marginBottom: '0.25rem' }}>SUBJECT</p>
                  <p style={{ fontWeight: 600, color: bg.ink, marginBottom: '0.5rem' }}>{result.subject}</p>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.7, color: bg.ink }}>{result.body}</pre>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => navigator.clipboard?.writeText((result.subject ? `件名: ${result.subject}\n\n` : '') + result.body)} style={btnSecondary(bg)}>📋 コピー</button>
                    <button onClick={saveAsDeal} style={btnPrimary(bg)}>💌 案件として保存</button>
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
function StatCard({ bg, label, value, icon }: { bg: IrisBackgroundDef; label: string; value: string | number; icon: string }) {
  return (
    <div style={{
      background: bg.card, backdropFilter: 'blur(10px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 18,
      padding: '1rem 1.2rem',
    }}>
      <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{icon}</div>
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
  width: 38, height: 38,
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
    type: 'personal', platform: 'instagram', handle: '', displayName: '', avatarEmoji: '🌸',
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

  function addAccount() {
    if (!newAcct.handle || !newAcct.displayName) return;
    multiAccount.add({
      type: newAcct.type as IrisAccount['type'],
      platform: newAcct.platform as IrisAccount['platform'],
      handle: newAcct.handle,
      displayName: newAcct.displayName,
      avatarEmoji: newAcct.avatarEmoji,
    });
    setNewAcct({ type: 'personal', platform: 'instagram', handle: '', displayName: '', avatarEmoji: '🌸' });
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
          <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: 0 }}>📱 登録アカウント</h3>
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
              <span style={{ fontSize: '1.4rem' }}>{acct.avatarEmoji || '👤'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: bg.ink }}>{acct.handle}</div>
                <div style={{ fontSize: '0.75rem', color: bg.inkSoft }}>
                  {ACCOUNT_TYPE_META[acct.type].emoji} {ACCOUNT_TYPE_META[acct.type].label}
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: bg.inkSoft }}>🗑</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  {[
                    { label: 'ハンドル *', key: 'handle', placeholder: '@your_handle' },
                    { label: '表示名 *', key: 'displayName', placeholder: 'サブ垢' },
                    { label: '絵文字アバター', key: 'avatarEmoji', placeholder: '✨' },
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
                        <option key={t} value={t}>{ACCOUNT_TYPE_META[t].emoji} {ACCOUNT_TYPE_META[t].label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: bg.inkSoft, fontWeight: 700, display: 'block', marginBottom: 3 }}>プラットフォーム</label>
                    <select value={newAcct.platform} onChange={e => setNewAcct(p => ({ ...p, platform: e.target.value as IrisAccount['platform'] }))}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 10, border: `1px solid ${bg.cardBorder}`, fontSize: '0.85rem', boxSizing: 'border-box' }}>
                      {(['instagram', 'tiktok', 'youtube', 'x'] as const).map(p => (
                        <option key={p} value={p}>{PLATFORM_META_ACCOUNT[p].emoji} {PLATFORM_META_ACCOUNT[p].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem' }}>
                  <button onClick={addAccount} style={{ ...btnPrimary(bg), fontSize: '0.85rem' }}>追加する</button>
                  <button onClick={() => setShowAddAccount(false)} style={{ ...btnSecondary(bg), fontSize: '0.85rem' }}>キャンセル</button>
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
            <h3 style={{ fontFamily: IRIS_FONTS.serif, fontSize: '1.1rem', color: bg.ink, margin: 0 }}>🎨 {g.name}</h3>
            <button onClick={editMode ? saveEdit : startEdit}
              style={{ ...btnPrimary(bg), padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
              {editMode ? '💾 保存' : '✏️ 編集'}
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
                      {s === 'rich' ? '😊 たっぷり' : s === 'minimal' ? '🤏 控えめ' : '🚫 なし'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={saveEdit} style={btnPrimary(bg)}>💾 保存</button>
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
          🤖 ブランドコンサル — スタイルチェック
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
          {checking ? '⏳ 分析中…' : '🔍 ブランドコンサルを受ける'}
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
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#C8102E', marginBottom: 4 }}>⚠ 問題点</p>
                {checkResult.violations.map((v, i) => <p key={i} style={{ fontSize: '0.82rem', color: '#C8102E', margin: '0 0 2px' }}>· {v}</p>)}
              </div>
            )}
            {checkResult.suggestions.length > 0 && (
              <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: bg.accent, marginBottom: 4 }}>💡 改善提案</p>
                {checkResult.suggestions.map((s, i) => <p key={i} style={{ fontSize: '0.82rem', color: bg.inkSoft, margin: '0 0 2px' }}>· {s}</p>)}
              </div>
            )}
            {checkResult.revised && (
              <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.cardBorder}` }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.accent, marginBottom: 6 }}>✨ 改善後の文章</p>
                <p style={{ fontSize: '0.85rem', color: bg.ink, margin: 0, whiteSpace: 'pre-wrap' }}>{checkResult.revised}</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
