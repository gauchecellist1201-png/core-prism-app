// ============================================================
// CORE Iris — 共創フィードバックカード
// 「このアプリを一緒に良くする」ユーザーの「こうだったらいいな」を
// ギルド(GUILD DAO)に届ける。採用された提案にはトークン（謝礼）が届き、
// ユーザーを共創者にする導線。
//
// 沈黙しない設計: 送信中はボタンを無効化、成功は「ギルドで進捗を見る」
// リンク、失敗は理由＋もう一度の導線を必ず出す（silent fail 厳禁）。
// ============================================================
import React, { useState } from 'react';
import { Sparkles, Send, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { loadIgProfile } from './instagramConnect';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';

const GUILD_FEEDBACK_URL = 'https://guild-hazel.vercel.app/api/feedback';

interface Props {
  bg: IrisBackgroundDef;
}

export default function IrisCoCreateCard({ bg }: Props) {
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string } | null>(null);

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)',
    border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E',
    padding: '0.6rem 0.85rem',
    borderRadius: 12,
    fontFamily: IRIS_FONTS.body,
    fontSize: 16,
    width: '100%',
    lineHeight: 1.6,
  };

  async function submit() {
    const idea = bodyText.trim();
    if (!idea) {
      setError('アイデアを入力してください。');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const profile = loadIgProfile();
      const contributor = profile?.handle ? `@${profile.handle}` : 'ゲスト';
      const res = await fetchWithTimeout(GUILD_FEEDBACK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: 'iris',
          contributor,
          ...(title.trim() ? { title: title.trim() } : {}),
          body: idea,
        }),
      }, 20000);
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok || !j?.url) {
        throw new Error('送信に失敗しました');
      }
      setDone({ url: String(j.url) });
      setTitle('');
      setBodyText('');
    } catch {
      setError('うまく届きませんでした。少し時間をおいて、もう一度お試しください。');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1.1rem 1.2rem', boxShadow: '0 10px 28px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
            boxShadow: `0 8px 20px ${bg.accent}55`,
          }}>
            <CheckCircle2 size={22} color="#fff" strokeWidth={2.2} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.05rem', color: bg.ink, margin: 0 }}>
              ギルドに届きました
            </h3>
            <p style={{ color: bg.inkSoft, fontSize: '0.85rem', lineHeight: 1.7, marginTop: 6 }}>
              ありがとうございます。あなたのアイデアは共創コミュニティで検討されます。採用されると
              <strong style={{ color: bg.ink }}>トークン（謝礼）</strong>が届きます。
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <a
                href={done.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  minHeight: 44, borderRadius: 12, padding: '0 1rem',
                  background: bg.accent, color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                  fontFamily: IRIS_FONTS.body, textDecoration: 'none',
                }}
              >
                <ExternalLink size={16} /> ギルドで進捗を見る
              </a>
              <button
                type="button"
                onClick={() => setDone(null)}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 44, borderRadius: 12, padding: '0 1rem',
                  background: 'rgba(255,255,255,0.6)', color: bg.ink,
                  border: `1px solid ${bg.cardBorder}`, fontWeight: 700, fontSize: '0.85rem',
                  fontFamily: IRIS_FONTS.body, cursor: 'pointer',
                }}
              >
                もう一つ送る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 18, padding: '1.1rem 1.2rem', boxShadow: '0 10px 28px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 12, flexShrink: 0,
          background: `${bg.accent}22`, border: `1px solid ${bg.accent}40`,
        }}>
          <Sparkles size={18} color={bg.accent} strokeWidth={2.2} />
        </span>
        <h3 style={{ fontFamily: IRIS_FONTS.display, fontSize: '1.05rem', color: bg.ink, margin: 0 }}>
          このアプリを一緒に良くする
        </h3>
      </div>
      <p style={{ color: bg.inkSoft, fontSize: '0.85rem', lineHeight: 1.7, marginTop: 8 }}>
        あなたの「こうだったらいいな」をギルドに届けると、
        <strong style={{ color: bg.ink }}>採用された提案にはトークン（謝礼）</strong>が届きます。
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ひとことタイトル（任意）"
          maxLength={60}
          style={inp}
        />
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="例：台本を作った後、そのまま撮影メモとして共有できたら嬉しいです。"
          rows={4}
          style={{ ...inp, resize: 'vertical' }}
        />
        {error && (
          <p style={{ color: '#EF4444', fontSize: '0.8rem', margin: 0 }}>{error}</p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={sending || !bodyText.trim()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            minHeight: 48, width: '100%', borderRadius: 12, border: 'none',
            background: bg.accent, color: '#fff', fontWeight: 700, fontSize: '0.9rem',
            fontFamily: IRIS_FONTS.body, cursor: sending || !bodyText.trim() ? 'default' : 'pointer',
            opacity: sending || !bodyText.trim() ? 0.55 : 1,
          }}
        >
          {sending ? (
            <>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> 送っています…
            </>
          ) : (
            <>
              <Send size={18} /> ギルドに改善アイデアを送る
            </>
          )}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
