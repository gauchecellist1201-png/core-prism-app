import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import type { MeetingType, MeetingDuration, LocationKind } from '../types/scheduling';
import { useMeetingTypes } from '../hooks/useMeetingTypes';
import {
  isCalConfigured, isCalConnected, connectCalendar, fetchBusy, fetchUpcomingEvents, clearCalToken, loadCalUser,
  type CalUserInfo, type CalEvent,
} from '../lib/googleCalendar';
import { computeFreeSlots, buildBookingUrl, formatSlot, groupSlotsByDay } from '../lib/scheduling';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

const LOCATION_LABELS: Record<LocationKind, string> = {
  'google-meet': 'Google Meet',
  'zoom': 'Zoom',
  'phone': '電話',
  'in-person': '対面',
  'custom': 'カスタム',
};

export default function MeetingScheduler({ persona, onClose }: Props) {
  const { create, update, remove, getForPersona } = useMeetingTypes();
  const personaTypes = getForPersona(persona.id);

  const calReady = isCalConfigured();
  const [calConnected, setCalConnected] = useState(isCalConnected());
  const [calUser, setCalUser] = useState<CalUserInfo | null>(loadCalUser());
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'preview'>('list');

  // 予約 URL 生成用
  const [previewType, setPreviewType] = useState<MeetingType | null>(null);
  const [previewSlots, setPreviewSlots] = useState<string[]>([]);
  const [previewBusy, setPreviewBusy] = useState<boolean>(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [upcomingEvents, setUpcomingEvents] = useState<CalEvent[]>([]);

  useEffect(() => { setCalConnected(isCalConnected()); }, []);

  const handleConnect = useCallback(async () => {
    setError(null); setConnecting(true);
    try {
      const { user } = await connectCalendar();
      setCalConnected(true);
      setCalUser(user);
      // 直近イベントを取得
      try {
        const evs = await fetchUpcomingEvents(7);
        setUpcomingEvents(evs);
      } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    clearCalToken();
    setCalConnected(false);
    setCalUser(null);
    setUpcomingEvents([]);
  }, []);

  // 既に接続済みなら直近イベント取得
  useEffect(() => {
    if (calConnected) {
      fetchUpcomingEvents(7).then(setUpcomingEvents).catch(() => {});
    }
  }, [calConnected]);

  // 予約 URL を生成
  const generateBookingUrl = useCallback(async (mt: MeetingType) => {
    setPreviewBusy(true);
    setError(null);
    setPreviewType(mt);
    try {
      const now = new Date();
      const future = new Date(now); future.setDate(now.getDate() + mt.rules.advanceMaxDays);

      let busy: { start: string; end: string }[] = [];
      if (calConnected) {
        try { busy = await fetchBusy(now.toISOString(), future.toISOString()); }
        catch (e) {
          // トークン切れ等の場合は空配列で続行
          busy = [];
          setError(e instanceof Error ? e.message : String(e));
        }
      }
      const slots = computeFreeSlots({ rules: mt.rules, durationMin: mt.duration, busy, now });
      setPreviewSlots(slots);

      const cfg = {
        v: 1 as const,
        host: persona.name,
        hostEmail: mt.hostEmail,
        personaName: persona.name,
        personaIcon: persona.icon,
        personaColor: persona.accentColor,
        meetingTypeId: mt.id,
        meetingName: mt.name,
        description: mt.description,
        duration: mt.duration,
        location: mt.location,
        customLocation: mt.customLocation,
        slots: slots.slice(0, 60), // 上限 60 枠 (URL 過大化防止)
        generatedAt: new Date().toISOString(),
      };
      const url = buildBookingUrl(cfg);
      setGeneratedUrl(url);
      setActiveTab('preview');
    } finally {
      setPreviewBusy(false);
    }
  }, [calConnected, persona]);

  const copyUrl = useCallback(() => {
    if (generatedUrl) navigator.clipboard.writeText(generatedUrl).catch(() => {});
  }, [generatedUrl]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 modal-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col modal-card"
        style={{ background: 'var(--bg, #15151c)', maxHeight: 'calc(100dvh - 1.5rem)' }}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}
            >📅</div>
            <div className="min-w-0">
              <p className="text-fg text-base font-semibold leading-tight truncate">日程調整リンク</p>
              <p className="text-fg-muted text-xs truncate">{persona.name} · ゲストが空き時間から予約できる共有URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface text-xl leading-none"
          >×</button>
        </div>

        {/* Calendar 接続バー */}
        <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap"
            style={{
              background: calConnected ? `${persona.accentColor}15` : 'var(--surface-3)',
              border: `1px solid ${calConnected ? persona.accentColor + '50' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {calConnected && calUser?.picture ? (
                <img src={calUser.picture} alt="" className="w-9 h-9 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: persona.accentColorLight }}>📆</div>
              )}
              <div className="min-w-0">
                <p className="text-fg text-sm font-semibold leading-tight">
                  Google Calendar {calConnected && <span className="text-xs ml-1" style={{ color: persona.accentColor }}>● 接続中</span>}
                </p>
                {calConnected && calUser ? (
                  <p className="text-fg-muted text-xs truncate">{calUser.email} の空き時間を自動取得</p>
                ) : (
                  <p className="text-fg-muted text-xs">{calReady ? '接続するとリアルタイムの空き時間で予約 URL を発行できます' : 'VITE_GOOGLE_CLIENT_ID 未設定'}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {!calConnected ? (
                <button
                  onClick={handleConnect}
                  disabled={!calReady || connecting}
                  className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-40 flex items-center gap-2"
                  style={{ background: '#ffffff', color: '#1a1a1a', border: '1px solid #dadce0' }}
                >
                  <svg width="14" height="14" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                  </svg>
                  {connecting ? '認証中…' : 'Calendar を接続'}
                </button>
              ) : (
                <button onClick={handleDisconnect} className="text-xs px-3 py-1.5 rounded-md text-fg-muted hover:text-fg">解除</button>
              )}
            </div>
          </div>
          {error && (
            <div className="mt-2 p-2 rounded text-xs" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
              {error}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {[['list', '予約タイプ'], ['preview', '予約 URL プレビュー']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className="text-xs px-3 py-2 rounded-t-md font-medium"
              style={{
                background: activeTab === id ? persona.accentColorLight : 'transparent',
                color: activeTab === id ? persona.accentColor : 'var(--fg-muted)',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'list' && (
            <>
              {/* 予約タイプ一覧 */}
              {personaTypes.length === 0 && (
                <div className="text-center py-8 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-fg-muted text-sm">予約タイプがまだありません</p>
                  <p className="text-fg-subtle text-xs mt-1">「+ 新しい予約タイプ」から作成しましょう</p>
                </div>
              )}
              {personaTypes.map(t => (
                <MeetingTypeRow
                  key={t.id}
                  type={t}
                  persona={persona}
                  isEditing={editingId === t.id}
                  onEdit={() => setEditingId(t.id === editingId ? null : t.id)}
                  onUpdate={(p) => update(t.id, p)}
                  onDelete={() => { if (confirm('削除しますか?')) remove(t.id); }}
                  onGenerate={() => generateBookingUrl(t)}
                  generating={previewBusy && previewType?.id === t.id}
                />
              ))}
              <button
                onClick={() => {
                  const email = calUser?.email || '';
                  if (!email) {
                    setError('Google Calendar に接続するか、ホストのメールアドレスを設定してください');
                  }
                  const created = create(persona.id, email);
                  setEditingId(created.id);
                }}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
              >＋ 新しい予約タイプを作成</button>

              {/* カレンダー直近イベント */}
              {calConnected && upcomingEvents.length > 0 && (
                <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">直近の予定 (7日間)</p>
                  <div className="space-y-1">
                    {upcomingEvents.slice(0, 8).map(ev => {
                      const d = new Date(ev.start);
                      return (
                        <div key={ev.id} className="flex items-center gap-2 text-xs">
                          <span className="text-fg-muted font-mono w-24 flex-shrink-0">
                            {d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-fg truncate">{ev.summary}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'preview' && (
            <PreviewPanel
              persona={persona}
              type={previewType}
              slots={previewSlots}
              url={generatedUrl}
              onCopy={copyUrl}
              onBack={() => setActiveTab('list')}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 予約タイプの 1 行 (展開して編集可) ─────────────
function MeetingTypeRow({
  type, persona, isEditing, onEdit, onUpdate, onDelete, onGenerate, generating,
}: {
  type: MeetingType; persona: Persona; isEditing: boolean;
  onEdit: () => void; onUpdate: (p: Partial<MeetingType>) => void; onDelete: () => void;
  onGenerate: () => void; generating: boolean;
}) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-fg text-sm font-medium truncate">{type.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>{type.duration}分</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded text-fg-muted" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>{LOCATION_LABELS[type.location]}</span>
          </div>
          <p className="text-fg-muted text-xs mt-0.5 truncate">
            {type.rules.weekdays.length}曜日 · {type.rules.windows.map(w => `${w.startHour}-${w.endHour}時`).join(', ')} · 最大{type.rules.advanceMaxDays}日先
          </p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-50"
            style={{ background: persona.accentColor, color: '#0a0a0f' }}
          >{generating ? '計算中…' : '🔗 URL生成'}</button>
          <button onClick={onEdit} className="text-xs px-2 py-1.5 rounded text-fg-muted hover:text-fg">{isEditing ? '閉じる' : '編集'}</button>
        </div>
      </div>
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Field label="名前">
                  <input
                    type="text" value={type.name}
                    onChange={e => onUpdate({ name: e.target.value })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  />
                </Field>
                <Field label="ホストのメール">
                  <input
                    type="email" value={type.hostEmail}
                    onChange={e => onUpdate({ hostEmail: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  />
                </Field>
              </div>
              <Field label="ゲスト向け説明">
                <textarea
                  value={type.description || ''}
                  onChange={e => onUpdate({ description: e.target.value })}
                  rows={2}
                  className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg resize-none"
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="所要時間">
                  <select
                    value={type.duration}
                    onChange={e => onUpdate({ duration: Number(e.target.value) as MeetingDuration })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d}分</option>)}
                  </select>
                </Field>
                <Field label="場所">
                  <select
                    value={type.location}
                    onChange={e => onUpdate({ location: e.target.value as LocationKind })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {(Object.keys(LOCATION_LABELS) as LocationKind[]).map(k => <option key={k} value={k}>{LOCATION_LABELS[k]}</option>)}
                  </select>
                </Field>
                <Field label="バッファ (前後)">
                  <select
                    value={type.rules.bufferMin}
                    onChange={e => onUpdate({ rules: { ...type.rules, bufferMin: Number(e.target.value) } })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {[0, 5, 10, 15, 30].map(b => <option key={b} value={b}>{b}分</option>)}
                  </select>
                </Field>
              </div>
              <Field label="利用可能な曜日">
                <div className="flex gap-1.5">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => {
                    const active = type.rules.weekdays.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const next = active ? type.rules.weekdays.filter(x => x !== i) : [...type.rules.weekdays, i].sort();
                          onUpdate({ rules: { ...type.rules, weekdays: next } });
                        }}
                        className="w-8 h-8 rounded text-xs font-medium"
                        style={{
                          background: active ? persona.accentColor : 'var(--surface-3)',
                          color: active ? '#0a0a0f' : 'var(--fg-muted)',
                        }}
                      >{d}</button>
                    );
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="開始時刻">
                  <select
                    value={type.rules.windows[0]?.startHour ?? 10}
                    onChange={e => onUpdate({ rules: { ...type.rules, windows: [{ startHour: Number(e.target.value), endHour: type.rules.windows[0]?.endHour ?? 18 }] } })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                  </select>
                </Field>
                <Field label="終了時刻">
                  <select
                    value={type.rules.windows[0]?.endHour ?? 18}
                    onChange={e => onUpdate({ rules: { ...type.rules, windows: [{ startHour: type.rules.windows[0]?.startHour ?? 10, endHour: Number(e.target.value) }] } })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="最低何時間先">
                  <select
                    value={type.rules.advanceMinHours}
                    onChange={e => onUpdate({ rules: { ...type.rules, advanceMinHours: Number(e.target.value) } })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {[0, 1, 2, 4, 12, 24, 48].map(h => <option key={h} value={h}>{h}時間後</option>)}
                  </select>
                </Field>
                <Field label="何日先まで">
                  <select
                    value={type.rules.advanceMaxDays}
                    onChange={e => onUpdate({ rules: { ...type.rules, advanceMaxDays: Number(e.target.value) } })}
                    className="w-full text-sm px-2 py-1.5 rounded bg-surface-3 border-edge border text-fg"
                  >
                    {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d}日先</option>)}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={onDelete}
                  className="text-xs px-3 py-1.5 rounded text-red-400 hover:bg-red-400/10"
                >削除</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-fg-muted text-[10px] tracking-wider uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}

function PreviewPanel({
  persona, type, slots, url, onCopy, onBack,
}: {
  persona: Persona; type: MeetingType | null; slots: string[]; url: string; onCopy: () => void; onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!type) {
    return (
      <div className="text-center py-12">
        <p className="text-fg-muted text-sm">予約タイプを選んで「URL生成」を押してください</p>
        <button onClick={onBack} className="mt-3 text-xs text-fg hover:underline">← 一覧へ</button>
      </div>
    );
  }
  const grouped = groupSlotsByDay(slots);
  const handleCopy = () => { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-3">
      <div className="rounded-xl p-3" style={{ background: persona.accentColorLight, border: `1px solid ${persona.accentColor}40` }}>
        <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">公開する予約 URL</p>
        <div className="flex items-center gap-2">
          <input
            value={url} readOnly
            onClick={e => e.currentTarget.select()}
            className="flex-1 text-xs px-2 py-1.5 rounded font-mono bg-surface-3 border-edge border text-fg"
          />
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-1.5 rounded font-semibold"
            style={{ background: persona.accentColor, color: '#0a0a0f' }}
          >{copied ? '✓ コピー済' : '📋 コピー'}</button>
        </div>
        <p className="text-fg-muted text-[11px] mt-2">
          このURLをゲストに送るだけ。ゲストは空き時間を選び → Google Calendar で予約完了 (Calendar/メールが自動で招待を送信)。
        </p>
      </div>

      <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
        <p className="text-fg-muted text-xs tracking-wider uppercase mb-2">埋め込み済みの空き時間 ({slots.length}枠)</p>
        {slots.length === 0 ? (
          <p className="text-fg-muted text-sm py-4 text-center">条件に合う空き時間がありません。曜日・時刻・期間を見直してください</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {grouped.map(g => (
              <div key={g.dayKey}>
                <p className="text-fg-muted text-[11px] mb-1">{g.dayLabel} ({g.weekday})</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.iso.slice(0, 16).map(iso => {
                    const f = formatSlot(iso);
                    return (
                      <span key={iso} className="text-xs px-2 py-1 rounded font-mono" style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                        {f.timeLabel}
                      </span>
                    );
                  })}
                  {g.iso.length > 16 && <span className="text-xs text-fg-muted px-2 py-1">+{g.iso.length - 16}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl p-3" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
        <p className="text-fg text-sm font-medium mb-1">📋 ゲストの体験</p>
        <ol className="text-fg-muted text-xs space-y-1 leading-relaxed">
          <li>1. URL を開くと CORE Prism のブランド付き予約ページが表示</li>
          <li>2. 空き時間を選んで名前 + メール + メッセージを入力</li>
          <li>3. 「予約する」で Google Calendar に予定を作成、ホストに招待が届く</li>
          <li>4. CORE Prism のサーバーは経由しないため、データはあなた・ゲスト・Google だけが扱う</li>
        </ol>
      </div>
    </div>
  );
}
