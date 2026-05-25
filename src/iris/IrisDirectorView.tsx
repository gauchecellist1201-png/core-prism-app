// ============================================================
// IRIS — Content Director View (クリエイティブ司令塔)
// ・撮影スケジュール 7 日 grid (撮影/編集/投稿の 3 ライン、日付ドラッグ移動)
// ・AI が今週のクリエイティブを提案 (リール 3 + ストーリー 7 + 投稿 4)
// ・ロケ地候補 AI (5 案)
// ・衣装 + 小道具メモ AI
// ・「次の撮影を準備する」を CDO に AgentTaskQueue で propose
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType } from '../types/influencerDeal';
import { PLATFORM_META, CONTENT_TYPE_META } from '../types/influencerDeal';
import {
  generateBlueprint, type ContentBlueprint,
  generateWeeklyCreative, type WeeklyCreativePlan,
  proposeLocations, type LocationProposal, type LocationTheme,
  generateWardrobe, type WardrobeChecklist,
  type ShootSlot, type ShootLane,
} from './contentDirector';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { notifyInApp } from '../lib/inAppNotify';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
}

const SCHEDULE_KEY = 'iris_director_schedule_v1';
const WEEKLY_KEY = 'iris_director_weekly_v1';

const WD_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const LANE_META: Record<ShootLane, { label: string; emoji: string; color: string }> = {
  shoot: { label: '撮影', emoji: '📸', color: '#F472B6' },
  edit: { label: '編集', emoji: '✂️', color: '#A78BFA' },
  post: { label: '投稿', emoji: '🚀', color: '#34D399' },
};

const LOCATION_THEMES: LocationTheme[] = ['カフェ', '公園', '自宅', '都内', '旅先'];

function uid() { return 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function nextNDates(start: Date, n: number): { iso: string; label: string; weekday: string; isToday: boolean }[] {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const out: { iso: string; label: string; weekday: string; isToday: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push({
      iso,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      weekday: WD_LABELS[d.getDay()],
      isToday: iso === todayIso,
    });
  }
  return out;
}

function loadSchedule(): ShootSlot[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSchedule(s: ShootSlot[]) {
  try { localStorage.setItem(SCHEDULE_KEY, JSON.stringify(s.slice(0, 200))); } catch { /* */ }
}

function loadWeekly(): WeeklyCreativePlan | null {
  try {
    const raw = localStorage.getItem(WEEKLY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWeekly(p: WeeklyCreativePlan) {
  try { localStorage.setItem(WEEKLY_KEY, JSON.stringify(p)); } catch { /* */ }
}

export default function IrisDirectorView({ bg, settings }: Props) {
  // ─── 既存「丸投げ編集」入力 ───
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [contentType, setContentType] = useState<ContentType>('reel');
  const [brand, setBrand] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('');
  const [duration, setDuration] = useState<string>('30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ContentBlueprint | null>(null);

  // ─── 7 日 grid schedule ───
  const [schedule, setSchedule] = useState<ShootSlot[]>(() => loadSchedule());
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => nextNDates(today, 7), [today]);
  const [dragging, setDragging] = useState<string | null>(null);

  // ─── AI 今週のクリエイティブ ───
  const [weekly, setWeekly] = useState<WeeklyCreativePlan | null>(() => loadWeekly());
  const [weeklyBusy, setWeeklyBusy] = useState(false);
  const [weeklyFocus, setWeeklyFocus] = useState('');

  // ─── ロケ地候補 ───
  const [locTheme, setLocTheme] = useState<LocationTheme>('カフェ');
  const [locations, setLocations] = useState<LocationProposal[]>([]);
  const [locBusy, setLocBusy] = useState(false);

  // ─── 衣装 + 小道具 ───
  const [wardrobeBySlot, setWardrobeBySlot] = useState<Record<string, WardrobeChecklist>>({});
  const [wardrobeBusy, setWardrobeBusy] = useState<string | null>(null);

  // ─── AgentTaskQueue 委任 ───
  const queue = useAgentTaskQueue();
  const [delegating, setDelegating] = useState(false);

  useEffect(() => { saveSchedule(schedule); }, [schedule]);

  const inp = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.7rem 1rem',
    borderRadius: 12,
    fontSize: '0.95rem',
    fontFamily: IRIS_FONTS.body,
    outline: 'none',
  } as React.CSSProperties;

  const card = {
    background: bg.card,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 22,
    padding: '1.4rem',
  } as React.CSSProperties;

  const btnPrimary = {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.75rem 1.6rem', fontWeight: 600, cursor: 'pointer',
    fontSize: '0.88rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 8px 22px ${bg.accent}55`,
  } as React.CSSProperties;

  const btnGhost = {
    background: 'rgba(255,255,255,0.6)',
    color: bg.ink,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 999,
    padding: '0.55rem 1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontFamily: IRIS_FONTS.body,
  } as React.CSSProperties;

  const sectionLabel = {
    fontFamily: IRIS_FONTS.serif,
    fontStyle: 'italic' as const,
    fontSize: '0.78rem',
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    color: bg.accent,
    marginBottom: '0.5rem',
  };

  // ─── 丸投げ生成 ───
  const generate = async () => {
    if (!topic.trim()) { setErr('テーマを入れてください'); return; }
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await generateBlueprint({
        settings, topic, platform, contentType, brand: brand || undefined,
        targetAudience: audience || undefined, selfTone: tone || undefined,
        durationSec: duration ? Number(duration) : undefined,
      });
      setResult(r);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const fullExport = () => {
    if (!result) return;
    const md: string[] = [];
    md.push(`# ${result.title}`);
    md.push(`\n## フック\n${result.hook}\n`);
    md.push(`## 構成`);
    result.scenes.forEach((s, i) => {
      md.push(`\n### ${i + 1}. ${s.scene} (${s.time})`);
      md.push(`映像: ${s.visual}`);
      if (s.line) md.push(`セリフ: ${s.line}`);
    });
    md.push(`\n## テロップ`);
    result.captions.forEach(c => md.push(`- [${c.time}] ${c.text}`));
    md.push(`\n## 投稿本文\n${result.postCaption}`);
    md.push(`\n## ハッシュタグ`);
    md.push(`メイン: ${result.hashtags.main.join(' ')}`);
    md.push(`カテゴリ: ${result.hashtags.category.join(' ')}`);
    md.push(`ロングテール: ${result.hashtags.longtail.join(' ')}`);
    md.push(`\n## CTA\n${result.cta}`);
    md.push(`\n## 撮影前準備`);
    result.prep.forEach(p => md.push(`- ${p}`));
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md.join('\n'))
        .then(() => notifyInApp({ kind: 'success', title: 'コピーしました', body: 'Markdown 形式でクリップボードに入りました。' }))
        .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'お使いのブラウザでコピーの権限が許可されているかご確認ください。' }));
    } else {
      notifyInApp({ kind: 'info', title: 'コピーに未対応のブラウザです', body: 'テキストを手動で選択してコピーしてください。' });
    }
  };

  // ─── スケジュール操作 ───
  const addSlot = (date: string, lane: ShootLane) => {
    const title = prompt(`${LANE_META[lane].label}のタイトル`, lane === 'shoot' ? 'リール撮影' : lane === 'edit' ? 'カット編集' : 'Instagram 投稿');
    if (!title || !title.trim()) return;
    setSchedule(prev => [...prev, {
      id: uid(), date, lane, title: title.trim(), status: 'planned',
    }]);
  };

  const removeSlot = (id: string) => {
    setSchedule(prev => prev.filter(s => s.id !== id));
  };

  const onDragStart = (id: string) => setDragging(id);
  const onDropTo = (date: string, lane: ShootLane) => {
    if (!dragging) return;
    setSchedule(prev => prev.map(s => s.id === dragging ? { ...s, date, lane } : s));
    setDragging(null);
  };

  const buildWeekly = async () => {
    setWeeklyBusy(true);
    try {
      const p = await generateWeeklyCreative({
        settings,
        audience: audience || undefined,
        focus: weeklyFocus || undefined,
      });
      setWeekly(p);
      saveWeekly(p);
      notifyInApp({ kind: 'success', title: '今週のクリエイティブができました', body: 'リール 3 / ストーリー 7 / 投稿 4 を提案しました' });
    } catch (e: any) {
      notifyInApp({ kind: 'warn', title: '生成できませんでした', body: e?.message ?? String(e) });
    } finally { setWeeklyBusy(false); }
  };

  // 週次案 → スケジュールに 1 タップで反映
  const seedScheduleFromWeekly = () => {
    if (!weekly) return;
    const seeds: ShootSlot[] = [];
    weekly.reels.forEach((r, i) => {
      const d = days[i] ? days[i].iso : days[0].iso;
      seeds.push({ id: uid(), date: d, lane: 'shoot', title: `🎬 ${r.title}`, detail: r.hook, status: 'planned' });
      const edDay = days[i + 1] ? days[i + 1].iso : d;
      seeds.push({ id: uid(), date: edDay, lane: 'edit', title: `✂️ ${r.title}`, status: 'planned' });
      const pDay = days[i + 2] ? days[i + 2].iso : edDay;
      seeds.push({ id: uid(), date: pDay, lane: 'post', title: `🚀 ${r.title}`, status: 'planned' });
    });
    weekly.posts.forEach((p, i) => {
      const d = days[(i + 3) % 7].iso;
      seeds.push({ id: uid(), date: d, lane: 'post', title: `📷 ${p.title}`, detail: p.caption, status: 'planned' });
    });
    setSchedule(prev => [...prev, ...seeds]);
    notifyInApp({ kind: 'success', title: 'スケジュールに反映しました', body: `${seeds.length} 件のスロットを追加` });
  };

  const fetchLocations = async () => {
    setLocBusy(true);
    try {
      const list = await proposeLocations({
        settings, theme: locTheme,
        audience: audience || undefined,
        contentTopic: topic || undefined,
      });
      setLocations(list);
    } catch (e: any) {
      notifyInApp({ kind: 'warn', title: 'ロケ地提案エラー', body: e?.message ?? String(e) });
    } finally { setLocBusy(false); }
  };

  const fetchWardrobe = async (slot: ShootSlot) => {
    setWardrobeBusy(slot.id);
    try {
      const w = await generateWardrobe({
        settings,
        topic: slot.title,
        contentType: slot.contentType,
        audience: audience || undefined,
      });
      setWardrobeBySlot(prev => ({ ...prev, [slot.id]: w }));
    } catch (e: any) {
      notifyInApp({ kind: 'warn', title: '衣装メモエラー', body: e?.message ?? String(e) });
    } finally { setWardrobeBusy(null); }
  };

  const delegateNextShoot = () => {
    const upcoming = schedule.filter(s => s.lane === 'shoot' && s.status !== 'done')
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!upcoming) {
      notifyInApp({ kind: 'info', title: '撮影スロットがありません', body: 'まず 7 日 grid に撮影を追加してください' });
      return;
    }
    setDelegating(true);
    queue.propose({
      title: `次の撮影を準備する: ${upcoming.title}`,
      summary: `${upcoming.date} に予定された撮影「${upcoming.title}」を CDO が司令塔として準備します。ロケ地・衣装・小道具・台本・テロップを 1 枚に。`,
      why: '撮影当日は時間が限られる。前日までに「衣装/小道具/ロケ/台本」が揃っていれば、本番のクオリティが 2 段上がる。',
      expected: 'ロケ地 1 つ確定 + 衣装 + 小道具リスト + 撮影台本 + テロップ 1 セット',
      dueDays: 2,
      steps: [
        { cxo: 'CDO', label: `ロケ地候補 5 つから 1 つを選び、撮影許可・ベストタイムを確定` },
        { cxo: 'CDO', label: '衣装 + 小道具 + ヘアメイクのチェックリストを最終化' },
        { cxo: 'CMO', label: '台本 + テロップ + 投稿本文 + ハッシュタグを 1 セットに' },
        { cxo: 'COO', label: '当日の段取り (時間表 + 持ち物) を 1 枚に整える' },
      ],
    });
    notifyInApp({ kind: 'success', title: '次の撮影を CDO に委任しました', body: 'AgentTaskQueue で進捗が見えます' });
    setTimeout(() => setDelegating(false), 600);
  };

  // ─── render ───
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.4rem' }}>
          The Creative Director
        </p>
        <h2 style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.4rem', color: bg.ink, margin: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
          クリエイティブ司令塔
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.92rem', marginTop: '0.4rem' }}>
          1 週間の撮影・編集・投稿を、AI と一緒に組み立てる。
        </p>
      </div>

      {/* ── 7 日 grid スケジュール ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <p style={sectionLabel}>7-Day Production Schedule</p>
            <p style={{ color: bg.inkSoft, fontSize: '0.82rem' }}>カードをドラッグして日付やレーンを移せます</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={delegateNextShoot} disabled={delegating} style={btnPrimary}>
              次の撮影を CDO に委任
            </button>
          </div>
        </div>

        {schedule.length === 0 && (
          <div style={{
            padding: '1.2rem 1rem',
            marginBottom: '0.9rem',
            background: `${bg.accent}11`,
            border: `1px dashed ${bg.accent}55`,
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }} aria-hidden>🎬</div>
            <p style={{ fontSize: '0.95rem', color: bg.ink, fontWeight: 700, margin: 0 }}>
              まだ撮影の予定はありません
            </p>
            <p style={{ fontSize: '0.8rem', color: bg.inkSoft, marginTop: 6, lineHeight: 1.6 }}>
              下の grid の「＋ 追加」を押すと、撮影 / 編集 / 投稿 の予定を入れられます。<br />
              「今週のクリエイティブを作る」を押すと、リール 3 本 + ストーリー 7 本 + 投稿 4 本を AI が一気に組み立てます。
            </p>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `90px repeat(7, minmax(120px, 1fr))`,
            gap: 6,
            minWidth: 920,
          }}>
            {/* ヘッダ行 */}
            <div />
            {days.map(d => (
              <div key={d.iso} style={{
                textAlign: 'center', padding: '0.4rem',
                background: d.isToday ? `${bg.accent}22` : 'rgba(255,255,255,0.4)',
                border: `1px solid ${d.isToday ? bg.accent : bg.cardBorder}`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: '0.7rem', color: bg.inkSoft, fontWeight: 600 }}>{d.weekday}</div>
                <div style={{ fontSize: '0.92rem', color: bg.ink, fontWeight: 700 }}>{d.label}</div>
              </div>
            ))}

            {/* 3 レーン */}
            {(['shoot', 'edit', 'post'] as ShootLane[]).map(lane => (
              <React.Fragment key={lane}>
                <div style={{
                  padding: '0.5rem', borderRadius: 10,
                  background: `${LANE_META[lane].color}18`,
                  border: `1px solid ${LANE_META[lane].color}44`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ fontSize: '1.2rem' }}>{LANE_META[lane].emoji}</div>
                  <div style={{ fontSize: '0.72rem', color: bg.ink, fontWeight: 700 }}>{LANE_META[lane].label}</div>
                </div>
                {days.map(d => {
                  const slots = schedule.filter(s => s.date === d.iso && s.lane === lane);
                  return (
                    <div
                      key={`${lane}-${d.iso}`}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDropTo(d.iso, lane)}
                      style={{
                        minHeight: 76,
                        padding: 6,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.45)',
                        border: `1px dashed ${bg.cardBorder}`,
                        display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      {slots.map(s => (
                        <div
                          key={s.id}
                          draggable
                          onDragStart={() => onDragStart(s.id)}
                          style={{
                            padding: '0.4rem 0.5rem',
                            background: `${LANE_META[lane].color}33`,
                            borderLeft: `3px solid ${LANE_META[lane].color}`,
                            borderRadius: 8,
                            fontSize: '0.75rem',
                            color: bg.ink,
                            cursor: 'grab',
                            position: 'relative',
                          }}
                          title={s.detail || s.title}
                        >
                          <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{s.title}</div>
                          {s.detail && <div style={{ fontSize: '0.68rem', color: bg.inkSoft, marginTop: 2 }}>{s.detail.slice(0, 30)}</div>}
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            {lane === 'shoot' && (
                              <button onClick={() => fetchWardrobe(s)} disabled={wardrobeBusy === s.id} style={{
                                fontSize: '0.62rem', padding: '0.18rem 0.35rem', borderRadius: 999,
                                background: bg.accent, color: '#fff', border: 'none', cursor: 'pointer',
                              }}>
                                {wardrobeBusy === s.id ? '…' : '衣装AI'}
                              </button>
                            )}
                            <button onClick={() => removeSlot(s.id)} style={{
                              fontSize: '0.62rem', padding: '0.18rem 0.35rem', borderRadius: 999,
                              background: 'rgba(0,0,0,0.06)', color: bg.inkSoft, border: 'none', cursor: 'pointer',
                            }}>×</button>
                          </div>
                          {wardrobeBySlot[s.id] && (
                            <div style={{ marginTop: 4, padding: 4, background: 'rgba(255,255,255,0.7)', borderRadius: 6, fontSize: '0.62rem', color: bg.ink, lineHeight: 1.4 }}>
                              {wardrobeBySlot[s.id].outfits.slice(0, 2).map((o, i) => <div key={i}>👗 {o}</div>)}
                              {wardrobeBySlot[s.id].props.slice(0, 2).map((p, i) => <div key={i}>🎒 {p}</div>)}
                            </div>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addSlot(d.iso, lane)} style={{
                        marginTop: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: bg.accent,
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        opacity: 0.7,
                      }}>+ 追加</button>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI が今週のクリエイティブを提案 ── */}
      <div style={card}>
        <p style={sectionLabel}>Weekly Creative AI</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.5rem', color: bg.ink, fontWeight: 700, margin: '0 0 0.6rem' }}>
          今週のリール 3 + ストーリー 7 + 投稿 4 を AI に
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.7rem' }}>
          <input style={{ ...inp, flex: 1, minWidth: 220 }} placeholder="今週のフォーカス (例: 春コーデ特集)" value={weeklyFocus} onChange={e => setWeeklyFocus(e.target.value)} />
          <button onClick={buildWeekly} disabled={weeklyBusy} style={btnPrimary}>
            {weeklyBusy ? '組み立て中…' : '今週のクリエイティブを作る'}
          </button>
        </div>

        {weekly && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <button onClick={seedScheduleFromWeekly} style={btnGhost}>
              ↻ この案を 7 日 grid に反映
            </button>

            {weekly.reels.length > 0 && (
              <div>
                <p style={{ ...sectionLabel, marginBottom: '0.3rem' }}>🎬 Reels (3)</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {weekly.reels.map((r, i) => (
                    <div key={i} style={{ padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.6)', borderRadius: 10, borderLeft: `3px solid ${LANE_META.shoot.color}` }}>
                      <p style={{ fontWeight: 700, color: bg.ink }}>{r.title}</p>
                      <p style={{ fontSize: '0.78rem', color: bg.accent, fontStyle: 'italic' }}>HOOK: {r.hook}</p>
                      <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>{r.scene}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weekly.stories.length > 0 && (
              <div>
                <p style={{ ...sectionLabel, marginBottom: '0.3rem' }}>📲 Stories (7)</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                  {weekly.stories.map((s, i) => (
                    <div key={i} style={{ padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.55)', borderRadius: 10, borderLeft: `3px solid ${LANE_META.post.color}` }}>
                      <p style={{ fontSize: '0.72rem', color: bg.accent, fontWeight: 700 }}>{s.day}</p>
                      <p style={{ fontSize: '0.8rem', color: bg.ink }}>{s.idea}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weekly.posts.length > 0 && (
              <div>
                <p style={{ ...sectionLabel, marginBottom: '0.3rem' }}>📷 Posts (4)</p>
                <div style={{ display: 'grid', gap: 6 }}>
                  {weekly.posts.map((p, i) => (
                    <div key={i} style={{ padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.6)', borderRadius: 10, borderLeft: `3px solid ${LANE_META.edit.color}` }}>
                      <p style={{ fontWeight: 700, color: bg.ink }}>{p.title}</p>
                      <p style={{ fontSize: '0.78rem', color: bg.inkSoft, fontStyle: 'italic' }}>{p.visual}</p>
                      <p style={{ fontSize: '0.78rem', color: bg.ink, marginTop: 2 }}>{p.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ロケ地候補 AI ── */}
      <div style={card}>
        <p style={sectionLabel}>Location Scouting AI</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', color: bg.ink, fontWeight: 700, margin: '0 0 0.6rem' }}>
          ロケ地を 5 つ提案
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          {LOCATION_THEMES.map(t => (
            <button key={t} onClick={() => setLocTheme(t)} style={{
              ...btnGhost,
              background: locTheme === t ? `${bg.accent}33` : 'rgba(255,255,255,0.6)',
              borderColor: locTheme === t ? bg.accent : bg.cardBorder,
              fontWeight: locTheme === t ? 700 : 500,
            }}>{t}</button>
          ))}
          <button onClick={fetchLocations} disabled={locBusy} style={btnPrimary}>
            {locBusy ? '探してます…' : `${locTheme} で 5 案`}
          </button>
        </div>

        {locations.length > 0 && (
          <div style={{ display: 'grid', gap: 6 }}>
            {locations.map((l, i) => (
              <div key={i} style={{ padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.6)', borderRadius: 10, borderLeft: `3px solid ${bg.accent}` }}>
                <p style={{ fontWeight: 700, color: bg.ink }}>{l.name}</p>
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft }}>{l.vibe}</p>
                <p style={{ fontSize: '0.74rem', color: bg.accent, marginTop: 3 }}>⏰ {l.bestTime} · ⚠️ {l.permission}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 既存「丸投げ編集」 ── */}
      <div style={card}>
        <p style={sectionLabel}>Full Auto Edit</p>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.4rem', color: bg.ink, fontWeight: 700, margin: '0 0 0.6rem' }}>
          1 本まるごと丸投げ編集
        </h3>
        <textarea style={{ ...inp, width: '100%', minHeight: 80, marginBottom: '0.5rem' }}
          placeholder="例: 春の新作リップ3本を比較。30代の唇に合うのはどれ?"
          value={topic} onChange={e => setTopic(e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <select style={inp} value={platform} onChange={e => setPlatform(e.target.value as Platform)}>
            {Object.entries(PLATFORM_META).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
          <select style={inp} value={contentType} onChange={e => setContentType(e.target.value as ContentType)}>
            {Object.entries(CONTENT_TYPE_META).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input style={inp} type="number" placeholder="尺 (秒)" value={duration} onChange={e => setDuration(e.target.value)} />
          <input style={inp} placeholder="ブランド (任意)" value={brand} onChange={e => setBrand(e.target.value)} />
          <input style={inp} placeholder="ターゲット" value={audience} onChange={e => setAudience(e.target.value)} />
          <input style={inp} placeholder="自分のトーン" value={tone} onChange={e => setTone(e.target.value)} />
        </div>
        <button onClick={generate} disabled={busy} style={btnPrimary}>
          {busy ? '構成中…' : '全部おまかせ'}
        </button>
      </div>

      {err && (
        <div style={{ ...card, background: '#FFF1F3', border: '1px solid #FECDD3' }}>
          <p style={{ color: '#9F1239', fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.92rem' }}>
            生成できませんでした
          </p>
          <p style={{ color: '#7F1D1D', fontSize: '0.85rem', marginBottom: '0.8rem', lineHeight: 1.6 }}>
            {err}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { setErr(null); generate(); }} style={btnPrimary}>
              もう一度試す
            </button>
            <button onClick={() => setErr(null)} style={{
              ...btnPrimary, background: 'transparent', color: bg.ink,
              border: `1px solid ${bg.cardBorder}`,
            }}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {result && (
        <>
          <div style={card}>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>
              Concept
            </p>
            <p style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.6rem', fontWeight: 700, color: bg.ink, lineHeight: 1.2 }}>
              {result.title}
            </p>
            <p style={{ fontStyle: 'italic', color: bg.inkSoft, marginTop: '0.5rem' }}>
              <span style={{ color: bg.accent }}>HOOK:</span> {result.hook}
            </p>
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>Scene Plan</p>
            {result.scenes.map((s, i) => (
              <div key={i} style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: `1px solid ${bg.cardBorder}` }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', color: bg.accent, minWidth: 70 }}>{s.time}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: bg.ink, marginBottom: '0.2rem' }}>{s.scene}</p>
                    <p style={{ fontSize: '0.85rem', color: bg.inkSoft }}>{s.visual}</p>
                    {s.line && <p style={{ fontSize: '0.85rem', color: bg.ink, marginTop: '0.3rem', fontStyle: 'italic' }}>「{s.line}」</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.75rem' }}>Captions</p>
            {result.captions.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.4rem 0', borderBottom: i < result.captions.length - 1 ? `1px solid ${bg.cardBorder}` : 'none' }}>
                <span style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.78rem', color: bg.accent, minWidth: 70 }}>{c.time}</span>
                <span style={{ flex: 1, fontWeight: 500, color: bg.ink }}>{c.text}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Post Caption</p>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: bg.ink, lineHeight: 1.7 }}>{result.postCaption}</pre>
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Hashtags</p>
            {(['main', 'category', 'longtail'] as const).map(k => (
              <div key={k} style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: '0.3rem', fontStyle: 'italic' }}>{k}</p>
                <p style={{ color: bg.accent, lineHeight: 1.7 }}>{result.hashtags[k].join(' ')}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={{ fontSize: '0.78rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.5rem' }}>Prep Checklist</p>
            <ul style={{ paddingLeft: '1.2rem', color: bg.ink, lineHeight: 1.9 }}>
              {result.prep.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <p style={{ marginTop: '0.75rem', color: bg.accent, fontStyle: 'italic' }}>CTA: {result.cta}</p>
          </div>

          <div style={card}>
            <button onClick={fullExport} style={btnPrimary}>全部 Markdown でコピー</button>
          </div>
        </>
      )}
    </div>
  );
}
