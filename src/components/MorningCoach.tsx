// ============================================================
// MorningCoach — 「今日のひとこと」AI 朝コーチ
//
// オーナー指示 (2026-06-04 第 33 波 KKKKK):
//   ダッシュボードの 朝の最初の表示時に AI が「今日 一番大事なこと」を
//   3 案 (1 文 40 字) 提示。ユーザーが選んで採用 → AiSuggestionHistory に記録。
//
// トリガー条件:
//   - view === 'dashboard'
//   - 今日まだ表示していない (localStorage 'core_morning_coach_lastDate')
//   - 時刻が 4:00 - 11:30 (JST 朝の時間)
//   - ?nocoach=1 で 無効化可
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Check, Sun, RefreshCw, ChevronRight } from 'lucide-react';
import { callAiWithFallback } from '../lib/aiFallbackChain';
import { logSuggestion, setStatus as setSuggestionStatus } from '../lib/aiSuggestionLog';

const STORAGE_KEY = 'core_morning_coach_lastDate';
const DISABLE_KEY = 'core_morning_coach_disabled';

interface Props {
  /** 「今日この人格で見ているか」を伝える (任意) */
  personaName?: string;
  /** 業種 (任意) */
  industry?: string;
}

interface Suggestion { id: string; text: string; }

function isMorningHourJst(): boolean {
  const now = new Date();
  // JST = UTC + 9
  const jstH = (now.getUTCHours() + 9) % 24;
  return jstH >= 4 && jstH < 12;
}
function todayKey(): string {
  const d = new Date();
  // JST 朝の判定なので JST 日付
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return jst.toISOString().slice(0, 10);
}

export default function MorningCoach({ personaName, industry }: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adoptedId, setAdoptedId] = useState<string | null>(null);

  // Trigger on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // ?nocoach=1 / または「無効化」設定で 起動しない
      const params = new URLSearchParams(window.location.search);
      if (params.get('nocoach') === '1') return;
      if (localStorage.getItem(DISABLE_KEY) === '1') return;
      if (!isMorningHourJst()) return;
      const last = localStorage.getItem(STORAGE_KEY);
      if (last === todayKey()) return;   // 今日は既に表示済
      // 表示記録
      localStorage.setItem(STORAGE_KEY, todayKey());
      setOpen(true);
      // 表示と同時に AI 取得
      load();
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const system = `あなたは CORE 代表 (井出直毅) の 朝の AI コーチです。
今日 一番大事なことを 3 案 提案してください。
形式: 純 JSON のみ。配列で 3 要素、各要素は 40 字以内 の 1 文。
例:
["今日は CHR と 採用 JD を仕上げ、9 件まとめて送る。", "営業 5 件 のフォロー DM を 午前中に終わらせる。", "決算 数字の異常を 30 分で確認 → Slack で共有。"]
ルール:
- 1 文 40 字以内、句点で終わる
- 数字や 動詞 を 含める (例: 「今日」「5 件」「30 分」)
- 押し売り / 説教 / 励まし は禁止 (淡々と)
- 横文字 過多 禁止
- 既知文脈 (オーナーは 1 人 CEO、PRISM/Iris 運営、判断スピード重視) を 反映`;
      const userPrompt = [
        `今日は ${todayKey()} です。`,
        personaName ? `今 アクティブ ペルソナ: ${personaName}` : '',
        industry ? `業種: ${industry}` : '',
        '3 案を JSON 配列で 返してください。',
      ].filter(Boolean).join('\n');
      const resp = await callAiWithFallback({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = (resp.content?.[0]?.text || '').trim();
      const cleaned = raw.replace(/```(?:json)?\s*\n?|```/g, '').trim();
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (!m) throw new Error('JSON 配列 を 抽出できませんでした');
      const parsed = JSON.parse(m[0]) as string[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('空 配列');
      setSuggestions(parsed.slice(0, 3).map((t, i) => ({ id: `sug_${i}`, text: String(t).trim() })));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const adopt = (s: Suggestion) => {
    try {
      const entry = logSuggestion({
        cxoKey: 'coach',
        cxoName: '今日のひとこと',
        cxoEmoji: '☀️',
        title: s.text,
        detail: `朝コーチ (${new Date().toLocaleString('ja-JP')})`,
        source: 'morning-brief',
      });
      if (entry) setSuggestionStatus(entry.id, 'adopted');
      setAdoptedId(s.id);
      // 2.4 秒後に閉じる
      setTimeout(() => setOpen(false), 2400);
    } catch { /* */ }
  };

  const disable = () => {
    try { localStorage.setItem(DISABLE_KEY, '1'); } catch { /* */ }
    setOpen(false);
  };

  const greeting = useMemo(() => {
    const now = new Date();
    const jstH = (now.getUTCHours() + 9) % 24;
    if (jstH < 6) return 'おはようございます (早起き派)';
    if (jstH < 9) return 'おはようございます';
    return 'おはようございます (今日もよろしく)';
  }, []);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.32 }}
        style={{
          position: 'fixed', left: 0, right: 0, top: 0, zIndex: 95,
          display: 'flex', justifyContent: 'center',
          padding: '16px 12px 0',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          width: 'min(560px, 100%)',
          background: 'linear-gradient(135deg, rgba(251,191,36,0.96) 0%, rgba(245,158,11,0.94) 50%, rgba(244,114,182,0.92) 100%)',
          color: '#1a0a1a',
          borderRadius: 18,
          padding: '16px 18px 14px',
          boxShadow: '0 18px 40px rgba(251,191,36,0.35), 0 0 0 1px rgba(255,255,255,0.3) inset',
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#7C2D12', flexShrink: 0,
            }}><Sun size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.25em', color: 'rgba(26,10,26,0.7)', fontWeight: 800 }}>
                MORNING COACH · {todayKey()}
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 900, lineHeight: 1.2 }}>
                {greeting}。今日 一番 大事なこと は?
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              style={{
                width: 28, height: 28, borderRadius: 14,
                background: 'rgba(0,0,0,0.12)', border: 'none',
                color: '#1a0a1a', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            ><X size={14} /></button>
          </div>

          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.5)',
              fontSize: '0.85rem', color: 'rgba(26,10,26,0.75)',
            }}>
              <Sparkles size={14} style={{ animation: 'spin 2s linear infinite' }} />
              3 案を 考えています…
            </div>
          )}

          {err && (
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.5)', color: '#7C2D12',
              fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span>提案を取得できません: {err.slice(0, 100)}</span>
              <button onClick={load} style={{
                padding: '4px 10px', borderRadius: 8,
                background: '#1a0a1a', color: '#fff',
                border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <RefreshCw size={11} /> 再試行
              </button>
            </div>
          )}

          {!loading && !err && suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map((s) => {
                const adopted = adoptedId === s.id;
                const dim = adoptedId !== null && adoptedId !== s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => !adoptedId && adopt(s)}
                    disabled={!!adoptedId}
                    style={{
                      textAlign: 'left',
                      padding: '11px 14px', borderRadius: 12,
                      background: adopted ? 'rgba(52,211,153,0.6)' : 'rgba(255,255,255,0.55)',
                      border: adopted ? '1px solid #1a0a1a' : '1px solid rgba(26,10,26,0.12)',
                      color: '#1a0a1a',
                      fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.55,
                      cursor: adoptedId ? 'default' : 'pointer',
                      opacity: dim ? 0.45 : 1,
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{ flex: 1 }}>{s.text}</span>
                    {adopted ? <Check size={16} /> : <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, fontSize: 11, color: 'rgba(26,10,26,0.65)',
          }}>
            <span>採用すると 履歴 (Cmd+Shift+H) に記録</span>
            <button
              onClick={disable}
              style={{
                background: 'transparent', border: 'none',
                color: 'rgba(26,10,26,0.6)', fontSize: 11, cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >もう 表示しない</button>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </motion.div>
    </AnimatePresence>
  );
}
