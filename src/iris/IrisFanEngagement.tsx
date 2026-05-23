// ============================================================
// IRIS — ファンエンゲージメント管理
// DM / コメント手動記録 → AI が高エンゲージメント TOP10 抽出
// 個人チャット返信テンプレ + 誠意タグ付与
// ============================================================
import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, UserPlus } from 'lucide-react';
import type { AppSettings } from '../types/identity';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { copyText } from '../lib/clipboard';
import { toneInstruction } from '../lib/aiTone';
import { notifyInApp } from '../lib/inAppNotify';
import { v4 as uuidv4 } from 'uuid';
import EmptyInvite from './EmptyInvite';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
}

export type FanTag = 'スーパーファン' | '長期ファン' | '新規' | '個人的友人';

const TAG_COLORS: Record<FanTag, { bg: string; text: string }> = {
  'スーパーファン': { bg: '#E1306C22', text: '#E1306C' },
  '長期ファン':     { bg: '#833AB422', text: '#833AB4' },
  '新規':           { bg: '#FCB04522', text: '#B07020' },
  '個人的友人':     { bg: '#34C75922', text: '#1A8040' },
};

export interface FanContact {
  id: string;
  name: string;
  handle: string;        // @username
  platform: string;      // Instagram / TikTok / X 等
  /** 関係開始 YYYY-MM */
  relationSince?: string;
  tag: FanTag;
  topics: string[];      // 話題のスナップ (例: "スキンケア好き", "毎回コメント")
  notes: string;
  /** DM / コメント 記録 */
  interactions: FanInteraction[];
  createdAt: string;
  updatedAt: string;
}

export interface FanInteraction {
  id: string;
  type: 'dm' | 'comment' | 'reply';
  content: string;
  date: string;          // YYYY-MM-DD
  myReply?: string;
}

const FAN_STORAGE_KEY = 'iris_fans_v1';

function loadFans(): FanContact[] {
  try { const r = localStorage.getItem(FAN_STORAGE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveFans(data: FanContact[]) {
  try { localStorage.setItem(FAN_STORAGE_KEY, JSON.stringify(data)); } catch { /* */ }
}

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

const ALL_TAGS: FanTag[] = ['スーパーファン', '長期ファン', '新規', '個人的友人'];

export default function IrisFanEngagement({ bg, settings }: Props) {
  const [fans, setFans] = useState<FanContact[]>(() => loadFans());
  const [selectedFan, setSelectedFan] = useState<FanContact | null>(null);
  const [showAddFan, setShowAddFan] = useState(false);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [top10, setTop10] = useState<{ name: string; reason: string }[] | null>(null);
  const [top10Loading, setTop10Loading] = useState(false);
  const [replyTemplate, setReplyTemplate] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyFanId, setReplyFanId] = useState<string | null>(null);

  const [fanForm, setFanForm] = useState({
    name: '', handle: '', platform: 'Instagram',
    relationSince: '', tag: 'スーパーファン' as FanTag,
    topics: '', notes: '',
  });
  const [interactionForm, setInteractionForm] = useState({
    type: 'dm' as FanInteraction['type'],
    content: '', date: new Date().toISOString().slice(0, 10),
  });

  const saveAndSet = (next: FanContact[]) => { setFans(next); saveFans(next); };

  // ─── ファン追加 ─────────────────────────────────────────
  const addFan = () => {
    if (!fanForm.name.trim()) return;
    const now = new Date().toISOString();
    const fan: FanContact = {
      id: uuidv4(),
      name: fanForm.name.trim(),
      handle: fanForm.handle.trim(),
      platform: fanForm.platform.trim(),
      relationSince: fanForm.relationSince || undefined,
      tag: fanForm.tag,
      topics: fanForm.topics.split(',').map(t => t.trim()).filter(Boolean),
      notes: fanForm.notes.trim(),
      interactions: [],
      createdAt: now,
      updatedAt: now,
    };
    saveAndSet([fan, ...fans]);
    setFanForm({ name: '', handle: '', platform: 'Instagram', relationSince: '', tag: 'スーパーファン', topics: '', notes: '' });
    setShowAddFan(false);
  };

  // ─── インタラクション追加 ──────────────────────────────
  const addInteraction = () => {
    if (!selectedFan || !interactionForm.content.trim()) return;
    const interaction: FanInteraction = {
      id: uuidv4(),
      type: interactionForm.type,
      content: interactionForm.content.trim(),
      date: interactionForm.date,
    };
    const updated = fans.map(f =>
      f.id === selectedFan.id
        ? { ...f, interactions: [interaction, ...f.interactions], updatedAt: new Date().toISOString() }
        : f
    );
    saveAndSet(updated);
    setSelectedFan(updated.find(f => f.id === selectedFan.id) ?? null);
    setInteractionForm({ type: 'dm', content: '', date: new Date().toISOString().slice(0, 10) });
    setShowAddInteraction(false);
  };

  const updateFanTag = (fanId: string, tag: FanTag) => {
    const updated = fans.map(f => f.id === fanId ? { ...f, tag, updatedAt: new Date().toISOString() } : f);
    saveAndSet(updated);
    if (selectedFan?.id === fanId) setSelectedFan(updated.find(f => f.id === fanId) ?? null);
  };

  const deleteFan = (fanId: string) => {
    saveAndSet(fans.filter(f => f.id !== fanId));
    if (selectedFan?.id === fanId) setSelectedFan(null);
  };

  // ─── AI: TOP10 抽出 ────────────────────────────────────
  const extractTop10 = useCallback(async () => {
    const apiKey = getApiKey(settings);
    if (!apiKey) { notifyInApp({ kind: 'warn', title: 'Claude API キーが未設定です', body: '設定画面で API キーを登録してください。' }); return; }
    if (fans.length === 0) { notifyInApp({ kind: 'info', title: 'ファンデータがありません', body: '先にファンを追加してください。' }); return; }

    setTop10Loading(true);
    setTop10(null);
    try {
      const fanSummary = fans.slice(0, 50).map(f => ({
        name: f.name,
        handle: f.handle,
        tag: f.tag,
        topics: f.topics,
        interactionCount: f.interactions.length,
        lastInteraction: f.interactions[0]?.date ?? '—',
        notes: f.notes,
      }));

      const sys = `あなたはインフルエンサーのファン関係管理を支援する AI。
${toneInstruction()}
返答は JSON のみ:
{ "top10": [{ "name": "ファン名", "reason": "選定理由 (30文字以内)" }, ...] }
最大 10 件。エンゲージメントが高い・関係が長い・話題が豊富なファンを優先する。`;

      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 1000,
            system: sys,
            messages: [{ role: 'user', content: `以下のファンリストから高エンゲージメント TOP10 を選んでください:\n${JSON.stringify(fanSummary, null, 2)}` }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });

      const text = data.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      setTop10(Array.isArray(parsed.top10) ? parsed.top10 : []);
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'AI 分析に失敗しました', body: String(e) });
    } finally {
      setTop10Loading(false);
    }
  }, [fans, settings]);

  // ─── AI: 返信テンプレ生成 ─────────────────────────────
  const generateReply = useCallback(async (fan: FanContact) => {
    const apiKey = getApiKey(settings);
    if (!apiKey) { notifyInApp({ kind: 'warn', title: 'Claude API キーが未設定です', body: '設定画面で API キーを登録してください。' }); return; }

    setReplyFanId(fan.id);
    setReplyLoading(true);
    setReplyTemplate('');

    try {
      const lastMsg = fan.interactions[0]?.content ?? '(最近のやり取りなし)';
      const sys = `あなたはインフルエンサーの専属 AI マネージャー「Iris」。
ファンへの返信テンプレを生成してください。
${toneInstruction()}
- 返信は 2〜3 文、自然で温かみがある
- ファン名・話題・関係を反映させる
- テンプレとして使える汎用的な文に
- 返答は返信テキストのみ (JSONなし・説明文なし)`;

      const prompt = `ファン名: ${fan.name} (@${fan.handle})
タグ: ${fan.tag}
話題: ${fan.topics.join(', ') || 'なし'}
関係: ${fan.relationSince ? fan.relationSince + '〜' : '不明'}
最近のメッセージ: 「${lastMsg}」
このファンへの返信テンプレを作ってください。`;

      const data = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 400,
            system: sys,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        if (!res.ok) throw new Error(`API エラー: ${res.status}`);
        return res.json();
      });

      setReplyTemplate(data.content?.[0]?.text ?? '');
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'テンプレ生成に失敗しました', body: String(e) });
    } finally {
      setReplyLoading(false);
    }
  }, [settings]);

  // ─── タグ別グループ ────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<FanTag, FanContact[]>();
    for (const t of ALL_TAGS) map.set(t, []);
    for (const f of fans) map.get(f.tag)?.push(f);
    return map;
  }, [fans]);

  return (
    <div style={{ display: 'grid', gap: '1.5rem', fontFamily: IRIS_FONTS.body }}>
      {/* ヘッダ */}
      <div>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 600 }}>FAN CARE</p>
        <h1 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', color: bg.ink, margin: '0.25rem 0 0.5rem', fontWeight: 500 }}>
          ファンとの絆を育てる。
        </h1>
        <p style={{ fontSize: '0.85rem', color: bg.inkSoft, lineHeight: 1.8, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          DM・コメントを記録して、AI が大切なファンをピックアップします。
        </p>
      </div>

      {/* アクション */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowAddFan(v => !v)}
          style={btnPrimary(bg)}
        >
          ファンを追加
        </button>
        <button
          onClick={extractTop10}
          disabled={top10Loading}
          style={btnSecondary(bg)}
        >
          {top10Loading ? '分析中…' : 'TOP10 を AI 分析'}
        </button>
      </div>

      {/* ファン追加フォーム */}
      <AnimatePresence>
        {showAddFan && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16 }}
          >
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '1rem' }}>ADD FAN</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <FField label="名前"><input value={fanForm.name} onChange={e => setFanForm(f => ({ ...f, name: e.target.value }))} placeholder="さくらちゃん" style={inp(bg)} /></FField>
              <FField label="ハンドル (@)"><input value={fanForm.handle} onChange={e => setFanForm(f => ({ ...f, handle: e.target.value }))} placeholder="@sakura_fan" style={inp(bg)} /></FField>
              <FField label="プラットフォーム"><input value={fanForm.platform} onChange={e => setFanForm(f => ({ ...f, platform: e.target.value }))} placeholder="Instagram" style={inp(bg)} /></FField>
              <FField label="関係開始 (YYYY-MM)"><input value={fanForm.relationSince} onChange={e => setFanForm(f => ({ ...f, relationSince: e.target.value }))} placeholder="2024-03" style={inp(bg)} /></FField>
              <FField label="タグ">
                <select value={fanForm.tag} onChange={e => setFanForm(f => ({ ...f, tag: e.target.value as FanTag }))} style={inp(bg)}>
                  {ALL_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </FField>
              <FField label="話題 (カンマ区切り)"><input value={fanForm.topics} onChange={e => setFanForm(f => ({ ...f, topics: e.target.value }))} placeholder="スキンケア好き, 毎回コメント" style={inp(bg)} /></FField>
              <FField label="メモ" style={{ gridColumn: '1 / -1' }}><input value={fanForm.notes} onChange={e => setFanForm(f => ({ ...f, notes: e.target.value }))} placeholder="特記事項など" style={inp(bg)} /></FField>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddFan(false)} style={btnCancel(bg)}>キャンセル</button>
              <button onClick={addFan} style={{ ...btnPrimary(bg), padding: '0.6rem 1.5rem' }}>保存</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP10 結果 */}
      <AnimatePresence>
        {top10 && top10.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '1.25rem', background: `${bg.accent}08`, border: `1px solid ${bg.cardBorder}`, borderRadius: 16, textAlign: 'center', color: bg.inkSoft, fontSize: '0.85rem' }}
          >
            該当するファンが見つかりませんでした。ファンとのやり取りを記録してから、もう一度お試しください。
          </motion.div>
        )}

        {top10 && top10.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '1.5rem', background: `linear-gradient(135deg, ${bg.accent}12, ${bg.accent}06)`, border: `1px solid ${bg.accent}30`, borderRadius: 16 }}
          >
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600, marginBottom: '0.75rem' }}>
              高エンゲージメント TOP10
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {top10.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.7)',
                  borderRadius: 10, border: `1px solid ${bg.cardBorder}`,
                }}>
                  <span style={{ fontWeight: 800, color: bg.accent, minWidth: 22, fontSize: '0.9rem' }}>#{i + 1}</span>
                  <div>
                    <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.85rem' }}>{t.name}</p>
                    <p style={{ fontSize: '0.75rem', color: bg.inkSoft, lineHeight: 1.5 }}>{t.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* タグ別ファンリスト */}
      {fans.length === 0 ? (
        <EmptyInvite
          bg={bg}
          icon={Heart}
          title="まだファンの記録がありません"
          description={
            <>
              よく絡んでくれる人を 1 人ずつ書き留めると、<br />
              AI が「いま声をかけたい上位 10 人」を毎週そっと教えてくれます。
            </>
          }
          primaryAction={{
            label: '最初のファンを追加',
            onClick: () => setShowAddFan(true),
            icon: UserPlus,
          }}
          hint="@ハンドルと一言メモだけで OK。タグは後からつけられます"
        />
      ) : (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {ALL_TAGS.map(tag => {
            const list = grouped.get(tag) ?? [];
            if (list.length === 0) return null;
            return (
              <div key={tag}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
                  <span style={{
                    background: TAG_COLORS[tag].bg, color: TAG_COLORS[tag].text,
                    fontSize: '0.7rem', fontWeight: 700, borderRadius: 999,
                    padding: '0.2rem 0.75rem',
                  }}>{tag}</span>
                  <span style={{ fontSize: '0.75rem', color: bg.inkSoft }}>{list.length} 人</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.65rem' }}>
                  {list.map(fan => (
                    <FanCard
                      key={fan.id} fan={fan} bg={bg}
                      isSelected={selectedFan?.id === fan.id}
                      onSelect={() => setSelectedFan(selectedFan?.id === fan.id ? null : fan)}
                      onDelete={() => deleteFan(fan.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 選択ファン詳細パネル */}
      <AnimatePresence>
        {selectedFan && (
          <motion.div
            key={selectedFan.id}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '1.5rem', background: bg.card, border: `1px solid ${bg.accent}40`, borderRadius: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 600 }}>FAN DETAIL</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.4rem', color: bg.ink, fontWeight: 500 }}>
                  {selectedFan.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: bg.inkSoft }}>
                  {selectedFan.handle} · {selectedFan.platform}
                  {selectedFan.relationSince && ` · ${selectedFan.relationSince}〜`}
                </p>
              </div>
              <button
                onClick={() => { setReplyFanId(selectedFan.id); generateReply(selectedFan); }}
                disabled={replyLoading && replyFanId === selectedFan.id}
                style={btnSecondary(bg)}
              >
                {replyLoading && replyFanId === selectedFan.id ? '生成中…' : '返信テンプレ生成'}
              </button>
            </div>

            {/* 誠意タグ変更 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: bg.inkSoft, fontWeight: 600 }}>タグ:</span>
              {ALL_TAGS.map(t => (
                <button key={t} onClick={() => updateFanTag(selectedFan.id, t)} style={{
                  background: selectedFan.tag === t ? TAG_COLORS[t].bg : 'transparent',
                  color: TAG_COLORS[t].text,
                  border: `1px solid ${TAG_COLORS[t].text}40`,
                  borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.2rem 0.65rem', cursor: 'pointer',
                  fontFamily: IRIS_FONTS.body,
                }}>{t}</button>
              ))}
            </div>

            {/* 話題タグ */}
            {selectedFan.topics.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
                {selectedFan.topics.map(t => (
                  <span key={t} style={{ background: `${bg.accent}15`, color: bg.accent, borderRadius: 999, fontSize: '0.72rem', padding: '0.2rem 0.65rem', fontWeight: 600 }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* 返信テンプレ */}
            {replyTemplate && replyFanId === selectedFan.id && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: `${bg.accent}0d`, border: `1px solid ${bg.accent}25`, borderRadius: 10 }}>
                <p style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 600, marginBottom: 6 }}>AI 返信テンプレ</p>
                <p style={{ fontSize: '0.875rem', color: bg.ink, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{replyTemplate}</p>
                <button
                  onClick={() => copyText(replyTemplate, '返信文')}
                  style={{ marginTop: 8, background: 'none', border: `1px solid ${bg.accent}40`, color: bg.accent, borderRadius: 999, padding: '0.3rem 0.85rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: IRIS_FONTS.body }}
                >
                  コピー
                </button>
              </div>
            )}

            {/* インタラクション追加 */}
            <div style={{ marginBottom: '0.75rem' }}>
              <button onClick={() => setShowAddInteraction(v => !v)} style={{ background: 'none', border: `1px solid ${bg.cardBorder}`, color: bg.accent, borderRadius: 999, padding: '0.45rem 1rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600, fontFamily: IRIS_FONTS.body }}>
                + DM / コメントを記録
              </button>
            </div>

            {showAddInteraction && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: `1px solid ${bg.cardBorder}` }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
                  <FField label="種類">
                    <select value={interactionForm.type} onChange={e => setInteractionForm(f => ({ ...f, type: e.target.value as FanInteraction['type'] }))} style={inp(bg)}>
                      <option value="dm">DM</option>
                      <option value="comment">コメント</option>
                      <option value="reply">返信</option>
                    </select>
                  </FField>
                  <FField label="日付">
                    <input type="date" value={interactionForm.date} onChange={e => setInteractionForm(f => ({ ...f, date: e.target.value }))} style={inp(bg)} />
                  </FField>
                  <FField label="内容" style={{ gridColumn: '1 / -1' }}>
                    <input value={interactionForm.content} onChange={e => setInteractionForm(f => ({ ...f, content: e.target.value }))} placeholder="メッセージ内容" style={inp(bg)} />
                  </FField>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddInteraction(false)} style={btnCancel(bg)}>キャンセル</button>
                  <button onClick={addInteraction} style={{ ...btnPrimary(bg), padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}>保存</button>
                </div>
              </div>
            )}

            {/* インタラクション履歴 */}
            {selectedFan.interactions.length > 0 ? (
              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {selectedFan.interactions.map(i => (
                  <div key={i.id} style={{
                    padding: '0.65rem 0.85rem', borderRadius: 10,
                    background: 'rgba(255,255,255,0.55)', border: `1px solid ${bg.cardBorder}`,
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  }}>
                    <span style={{ fontSize: '0.7rem', color: bg.accent, fontWeight: 700, minWidth: 46 }}>
                      {i.type === 'dm' ? 'DM' : i.type === 'comment' ? 'コメント' : '返信'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: bg.inkSoft, minWidth: 72 }}>{i.date}</span>
                    <span style={{ fontSize: '0.85rem', color: bg.ink, flex: 1, lineHeight: 1.6 }}>{i.content}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: bg.inkSoft, fontStyle: 'italic', fontFamily: IRIS_FONTS.serif }}>
                まだやり取りが記録されていません。
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FanCard({ fan, bg, isSelected, onSelect, onDelete }: {
  fan: FanContact;
  bg: IrisBackgroundDef;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const tagColor = TAG_COLORS[fan.tag];
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '0.9rem 1rem', borderRadius: 12,
        background: isSelected ? `${bg.accent}0e` : bg.card,
        border: `1px solid ${isSelected ? bg.accent : bg.cardBorder}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: bg.ink, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fan.name}</p>
          <p style={{ fontSize: '0.75rem', color: bg.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fan.handle}</p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: bg.inkSoft, fontSize: '0.8rem', padding: '0 0.2rem', flexShrink: 0 }}
        ></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
        <span style={{ background: tagColor.bg, color: tagColor.text, fontSize: '0.65rem', fontWeight: 700, borderRadius: 999, padding: '0.18rem 0.55rem' }}>
          {fan.tag}
        </span>
        <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>
          {fan.interactions.length} 件
        </span>
      </div>
      {fan.topics.length > 0 && (
        <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fan.topics.join(' · ')}
        </p>
      )}
    </div>
  );
}

function FField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ fontSize: '0.7rem', color: '#3D3247', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 4, fontFamily: IRIS_FONTS.body }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function inp(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    width: '100%', padding: '0.5rem 0.7rem',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 8,
    fontSize: '0.875rem', fontFamily: IRIS_FONTS.body,
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    outline: 'none', boxSizing: 'border-box',
  };
}

function btnPrimary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
    color: '#fff', border: 'none', borderRadius: 999,
    padding: '0.7rem 1.4rem', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.875rem', fontFamily: IRIS_FONTS.body,
    boxShadow: `0 4px 14px ${bg.accent}40`,
  };
}

function btnSecondary(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.85)',
    color: bg.accent, border: `1px solid ${bg.accent}40`,
    borderRadius: 999, padding: '0.7rem 1.25rem',
    fontWeight: 600, cursor: 'pointer',
    fontSize: '0.875rem', fontFamily: IRIS_FONTS.body,
  };
}

function btnCancel(bg: IrisBackgroundDef): React.CSSProperties {
  return {
    background: 'transparent', color: bg.inkSoft,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 999,
    padding: '0.5rem 1rem', cursor: 'pointer',
    fontFamily: IRIS_FONTS.body, fontSize: '0.85rem',
  };
}
