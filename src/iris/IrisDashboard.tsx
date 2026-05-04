// ============================================================
// CORE Iris — メインダッシュボード
// 案件 / 交渉 / 投稿下書き / 美容相談 / 画像生成 / 背景カスタム
// ============================================================
import { useState, useMemo, useCallback } from 'react';
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

interface Props {
  settings: AppSettings;
  onLeave: () => void;
}

type Tab = 'home' | 'deals' | 'negotiate' | 'draft' | 'beauty' | 'image' | 'kit';

const IRIS_PERSONA_ID = 'iris-default';  // Iris は単一ユーザー前提

export default function IrisDashboard({ settings, onLeave }: Props) {
  const [bg, setBg] = useState<IrisBackgroundDef | CustomIrisBackground>(() => loadIrisBackground());
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [bgListVersion, setBgListVersion] = useState(0); // 再描画用
  const [tab, setTab] = useState<Tab>('home');

  const allBgs = useMemo(() => getAllBackgrounds(), [bgListVersion]);

  const desk = useInfluencerDesk();
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
            <span style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: '1.5rem', color: bg.ink, letterSpacing: '-0.02em',
            }}>
              Iris
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button onClick={() => setBgPickerOpen(true)} title="背景を変える"
              style={btnIcon(bg)}>
              {bg.emoji}
            </button>
            <button onClick={onLeave} title="戻る" style={btnIcon(bg)}>←</button>
          </div>
        </div>

        {/* タブ */}
        <nav style={{
          maxWidth: 1280, margin: '0.5rem auto 0', display: 'flex', gap: '0.4rem',
          overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4,
        }}>
          {[
            { id: 'home' as Tab,      e: '🌸', l: 'ホーム' },
            { id: 'deals' as Tab,     e: '💌', l: '案件' },
            { id: 'negotiate' as Tab, e: '💬', l: '交渉' },
            { id: 'draft' as Tab,     e: '✍',  l: '投稿' },
            { id: 'beauty' as Tab,    e: '💆‍♀️', l: '美容' },
            { id: 'image' as Tab,     e: '🎨', l: '画像' },
            { id: 'kit' as Tab,       e: '📇', l: 'メディアキット' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.5)',
                color: tab === t.id ? '#fff' : bg.ink,
                border: 'none',
                borderRadius: 999,
                padding: '0.55rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: IRIS_FONTS.body,
                boxShadow: tab === t.id ? `0 6px 18px ${bg.accent}55` : 'none',
              }}>
              <span style={{ marginRight: 6 }}>{t.e}</span>
              {t.l}
            </button>
          ))}
        </nav>
      </header>

      {/* メインコンテンツ */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'home' && <HomeView bg={bg} desk={desk} myDeals={myDeals} />}
            {tab === 'deals' && <DealsView bg={bg} desk={desk} myDeals={myDeals} />}
            {tab === 'negotiate' && <NegotiateView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} />}
            {tab === 'draft' && <DraftView bg={bg} desk={desk} myDeals={myDeals} mediaKit={mediaKit} settings={settings} persona={irisPersonaStub} />}
            {tab === 'beauty' && <BeautyChatView bg={bg} settings={settings} />}
            {tab === 'image' && <ImageStudioView bg={bg} settings={settings} />}
            {tab === 'kit' && <MediaKitView bg={bg} desk={desk} kit={mediaKit} />}
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
    </div>
  );
}

// ─── ホーム ──────────────────────────────────────
function HomeView({ bg, myDeals }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; myDeals: InfluencerDeal[] }) {
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

      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', marginBottom: '1rem', color: bg.ink }}>
          今、なにする?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
          {[
            { e: '💌', l: '案件を追加', tab: 'deals' },
            { e: '💬', l: '交渉文を書く', tab: 'negotiate' },
            { e: '✍', l: '投稿下書き', tab: 'draft' },
            { e: '💆‍♀️', l: '美容相談', tab: 'beauty' },
          ].map((q) => (
            <button key={q.l} style={{
              background: 'rgba(255,255,255,0.5)',
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 16,
              padding: '1rem 0.75rem',
              cursor: 'pointer',
              textAlign: 'center',
              color: bg.ink,
              fontFamily: IRIS_FONTS.body,
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{q.e}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{q.l}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── 案件 (DealsView) ─────────────────────────
function DealsView({ bg, desk, myDeals }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; myDeals: InfluencerDeal[] }) {
  const [open, setOpen] = useState(false);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
          案件
        </h2>
        <button onClick={() => setOpen(!open)} style={btnPrimary(bg)}>
          {open ? '閉じる' : '+ 追加'}
        </button>
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

// ─── 画像生成 (簡易プロンプト保存) ─────────────
function ImageStudioView({ bg }: { bg: IrisBackgroundDef; settings?: AppSettings }) {
  const [prompt, setPrompt] = useState('');
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '2rem', color: bg.ink, margin: 0 }}>
        画像 / 動画 のアイデア
      </h2>
      <Card bg={bg}>
        <p style={{ color: bg.inkSoft, marginBottom: '0.75rem' }}>
          イメージしてる画像を文字で描写してください。本家 Prism の画像生成スタジオで使えるプロンプトに整えます。
        </p>
        <textarea style={{ ...inp(bg), width: '100%', minHeight: 120, marginBottom: '0.5rem' }}
          placeholder="例: 春のピンクの背景、白いコスメボトル、上から差し込む朝日、Instagram フィード用 1:1"
          value={prompt} onChange={e => setPrompt(e.target.value)} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigator.clipboard?.writeText(prompt)} style={btnPrimary(bg)}>📋 プロンプトをコピー</button>
          <a href="/?app=1" target="_blank" rel="noreferrer" style={{ ...btnSecondary(bg), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            🎨 本家の画像スタジオを開く
          </a>
        </div>
        <p style={{ color: bg.inkSoft, fontSize: '0.78rem', marginTop: '0.75rem' }}>
          ※ Iris 内蔵の画像生成は近日リリース予定。今は本家 Prism の ImageStudio を使ってください。
        </p>
      </Card>

      <Card bg={bg}>
        <p style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.3rem', color: bg.ink, marginBottom: '0.75rem' }}>
          リール / ショート 構成テンプレ
        </p>
        <ul style={{ paddingLeft: '1.2rem', color: bg.inkSoft, lineHeight: 1.9 }}>
          <li>0–3 秒: フック (引きの一言 or 結論先出し)</li>
          <li>3–10 秒: 課題提起 (誰の何を解決するか)</li>
          <li>10–30 秒: 商品体験 / Before-After</li>
          <li>30–45 秒: 推しポイント 3 つ</li>
          <li>最後 5 秒: CTA「保存してね」or「コメントで○○教えて」</li>
        </ul>
      </Card>
    </div>
  );
}

// ─── メディアキット ─────────────────────────
function MediaKitView({ bg, desk, kit }: { bg: IrisBackgroundDef; desk: ReturnType<typeof useInfluencerDesk>; kit?: MediaKit }) {
  const [d, setD] = useState<MediaKit>(kit || { personaId: IRIS_PERSONA_ID });
  const save = () => desk.setMediaKit(IRIS_PERSONA_ID, { ...d, personaId: IRIS_PERSONA_ID });
  void desk; // keep ref

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
  background: 'rgba(255,255,255,0.6)',
  border: `1px solid ${bg.cardBorder}`,
  color: bg.ink,
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
