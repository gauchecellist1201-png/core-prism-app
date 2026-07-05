// ============================================================
// PrismCoCreateCard — 「このアプリを一緒に良くする」共創フィードバックカード
// ユーザーの「こうだったらいいな」をギルド(GUILD DAO)に届ける。
// 採用された提案にはトークン（謝礼）が届く＝ユーザーを共創者にする導線。
//
// 沈黙しない設計：送信中はボタンを無効化、成功は「ギルドで進捗を見る」リンク、
// 失敗は理由＋もう一度の導線を必ず出す。（Resonance の CoCreateCard を Prism 用に移植）
// ============================================================
import { useState } from 'react';
import { Sparkles, Send, Check, Link2, Loader2 } from 'lucide-react';
import { loadBillingUser } from '../lib/billing';

const GUILD_FEEDBACK_URL = 'https://guild-hazel.vercel.app/api/feedback';

export default function PrismCoCreateCard() {
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ url: string } | null>(null);

  async function submit() {
    const idea = bodyText.trim();
    if (!idea) {
      setError('アイデアを入力してください。');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const user = loadBillingUser();
      const contributor = user?.email?.trim() || 'ゲスト';
      const res = await fetch(GUILD_FEEDBACK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product: 'prism',
          contributor,
          ...(title.trim() ? { title: title.trim() } : {}),
          body: idea,
        }),
      });
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
      <div className="rounded-2xl bg-surface-3 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: '#A78BFA' }}
          >
            <Check className="h-6 w-6 text-white" />
          </span>
          <div className="min-w-0">
            <h2 className="text-fg text-lg font-semibold">ギルドに届きました</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">
              ありがとうございます。あなたのアイデアは共創コミュニティで検討されます。採用されると
              <b className="text-fg">トークン（謝礼）</b>が届きます。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={done.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5CFF)' }}
              >
                <Link2 className="h-4 w-4" /> ギルドで進捗を見る
              </a>
              <button
                type="button"
                onClick={() => setDone(null)}
                className="border-edge text-fg-muted inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]"
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
    <div className="rounded-2xl bg-surface-3 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(167,139,250,0.16)', color: '#A78BFA' }}
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <h2 className="text-fg text-lg font-semibold">このアプリを一緒に良くする</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        あなたの「こうだったらいいな」をギルドに届けると、<b className="text-fg">採用された提案にはトークン（謝礼）</b>が届きます。
      </p>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ひとことタイトル（任意）"
          maxLength={60}
          className="border-edge bg-surface text-fg placeholder:text-fg-subtle w-full rounded-xl border px-3.5 py-3 text-base focus:outline-none"
          style={{ fontSize: 16 }}
        />
        <textarea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="例：朝のブリーフに、前日の商談結果も反映してほしいです。"
          rows={4}
          className="border-edge bg-surface text-fg placeholder:text-fg-subtle w-full resize-y rounded-xl border px-3.5 py-3 text-base leading-relaxed focus:outline-none"
          style={{ fontSize: 16 }}
        />
        {error && <p className="text-sm" style={{ color: '#F87171' }}>{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={sending || !bodyText.trim()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5CFF)' }}
        >
          {sending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> 送っています…
            </>
          ) : (
            <>
              <Send className="h-5 w-5" /> ギルドに改善アイデアを送る
            </>
          )}
        </button>
      </div>
    </div>
  );
}
