// ============================================================
// GmailInsightsCard — 「Gmail を 連携 した 価値」 を 出す ダッシュ カード
//
// オーナー指示 (2026-06-05):
//   「Gmail を 連携 したら 内容 を 棚卸し → 返信 必要 / 案件 候補 を 抽出
//    → 下書き まで AI が 作る、 という 体験 が 欲しい。
//    『最強 の RAG』 = 全 ツール の 内容 が プリズム に 集約 され、
//    役員 が 横断 で 提案 する 状態 を 目指す。」
//
// 動き:
//   1. isGmailConnected() で 接続 状態 確認
//   2. fetchInbox(15) で 直近 14 日 の メール 取得
//   3. Claude Haiku に メール 一覧 を 渡して 分類 + 重要度 判定
//   4. 「返信 必要」 と 分類 された もの に AI 下書き を 生成
//   5. UI で:
//      - 案件 候補: 「[Sender] が [内容]」 + 提案 アクション
//      - 返信 必要: 件名 + AI 下書き 入り 編集 欄 + 📨 Gmail に 下書き 保存
//      - 督促/重要 / 後で良い / ニュースレター も タグ 分け
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandIcon } from './BrandIcons';
import {
import { aiFetch } from '../lib/aiFetch';
  isGmailConfigured, isGmailConnected, connectGmail, loadGmailUser,
  fetchInbox, createGmailDraft, buildReplyMeta, type GmailMessage,
} from '../lib/gmail';

type Category = 'deal' | 'reply' | 'urgent' | 'later' | 'newsletter';

interface Insight {
  msgId: string;
  category: Category;
  reason: string;       // なぜこの分類か (1 行)
  action?: string;      // 推奨 アクション (返信内容 / 動き)
  draft?: string;       // AI 生成 返信 下書き (replyのみ)
}

const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string; order: number }> = {
  deal:       { label: '案件 候補',   emoji: '💼', color: '#34D399', order: 0 },
  urgent:     { label: '至急 / 督促', emoji: '🔥', color: '#F87171', order: 1 },
  reply:      { label: '返信 必要',   emoji: '✉️', color: '#22D3EE', order: 2 },
  later:      { label: '後で 良い',   emoji: '⏰', color: '#94A3B8', order: 3 },
  newsletter: { label: 'ニュース',    emoji: '📰', color: '#94A3B8', order: 4 },
};

const CACHE_KEY = 'core_gmail_insights_cache_v1';
const CACHE_TTL_MS = 30 * 60_000; // 30 分

interface Cached { ts: number; emails: GmailMessage[]; insights: Insight[]; }

function loadCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || typeof c !== 'object') return null;
    if (Date.now() - (c.ts || 0) > CACHE_TTL_MS) return null;
    if (!Array.isArray(c.emails) || !Array.isArray(c.insights)) return null;
    return c as Cached;
  } catch { return null; }
}
function saveCache(c: Cached) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}

export default function GmailInsightsCard() {
  const [connected, setConnected] = useState(() => isGmailConnected());
  const configured = isGmailConfigured();
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<Record<string, 'saved' | 'sending' | 'err'>>({});

  const user = loadGmailUser();

  // 初回: キャッシュ あれば 使う、 無ければ 取得
  useEffect(() => {
    if (!connected) return;
    const c = loadCache();
    if (c) {
      setEmails(c.emails);
      setInsights(c.insights);
    } else {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true); setErr(null);
    try {
      const list = await fetchInbox(15);
      if (list.length === 0) {
        setEmails([]); setInsights([]);
        saveCache({ ts: Date.now(), emails: [], insights: [] });
        return;
      }
      setEmails(list);
      // AI で 一括 分類 + 返信 必要 のは 下書き 生成
      const aiInsights = await classifyAndDraft(list);
      setInsights(aiInsights);
      saveCache({ ts: Date.now(), emails: list, insights: aiInsights });
    } catch (e: any) {
      setErr(e?.message || 'Gmail 取得 に 失敗 しました');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const handleConnect = async () => {
    setLoading(true); setErr(null);
    try {
      await connectGmail();
      setConnected(isGmailConnected());
      await refresh();
    } catch (e: any) {
      setErr(e?.message || 'Gmail 連携 に 失敗 しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (msg: GmailMessage, insight: Insight) => {
    if (!insight.draft) return;
    setDraftStatus((s) => ({ ...s, [msg.id]: 'sending' }));
    try {
      const meta = buildReplyMeta(msg);
      await createGmailDraft({
        threadId: msg.threadId,
        to: meta.to,
        subject: meta.subject,
        body: insight.draft,
        inReplyTo: meta.inReplyTo,
        references: meta.references,
      });
      setDraftStatus((s) => ({ ...s, [msg.id]: 'saved' }));
      window.setTimeout(() => {
        setDraftStatus((s) => {
          const next = { ...s }; delete next[msg.id]; return next;
        });
      }, 5000);
    } catch (e) {
      console.error('createGmailDraft', e);
      setDraftStatus((s) => ({ ...s, [msg.id]: 'err' }));
    }
  };

  // 分類 順 で 並べる
  const sorted = useMemo(() => {
    const map = new Map(emails.map((e) => [e.id, e]));
    return insights
      .filter((i) => map.has(i.msgId))
      .sort((a, b) => CATEGORY_META[a.category].order - CATEGORY_META[b.category].order);
  }, [emails, insights]);

  const counts = useMemo(() => {
    const c: Record<Category, number> = { deal: 0, urgent: 0, reply: 0, later: 0, newsletter: 0 };
    for (const i of insights) c[i.category]++;
    return c;
  }, [insights]);

  // ─── 未 設定 ─────────────
  if (!configured) {
    return (
      <div style={cardStyle()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <BrandIcon name="gmail" size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={titleStyle()}>Gmail インサイト</h3>
            <p style={bodyStyle()}>
              Gmail OAuth Client ID が 未設定 です (環境変数 <code>VITE_GOOGLE_CLIENT_ID</code>)。
              連携 すると 受信トレイ を 役員 が 棚卸し → 案件 候補 / 返信 必要 を 抽出 + 下書き まで 作ります。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── 未 連携 ─────────────
  if (!connected) {
    return (
      <div style={cardStyle('#34D399')}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <BrandIcon name="gmail" size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={titleStyle()}>Gmail を 役員 に 渡す</h3>
            <p style={bodyStyle()}>
              受信トレイ の 内容 を 役員 が 自動 で 棚卸し します:
            </p>
            <ul style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--fg)', margin: '6px 0 12px', paddingLeft: 18 }}>
              <li>💼 案件 候補 を 自動 抽出 (送信 主 / 業種 / 規模)</li>
              <li>✉️ 「返信 必要」 を 優先順 で リスト 化</li>
              <li>📝 各 返信 の AI 下書き を 自動 生成 (Gmail 下書き に 保存)</li>
              <li>🔥 督促 / クレーム / 至急 メール を 警告</li>
            </ul>
            <button
              onClick={handleConnect}
              disabled={loading}
              style={primaryButtonStyle('#34D399')}
            >
              {loading ? '連携 中…' : '🟢 Gmail を 連携 する (OAuth)'}
            </button>
            {err && (
              <div style={errStyle()}>
                ⚠️ {err}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 連携 済み ───────────
  const allEmpty = !loading && emails.length === 0;

  return (
    <div style={cardStyle('#34D399')}>
      {/* ヘッダ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <BrandIcon name="gmail" size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={titleStyle()}>Gmail インサイト</h3>
          {user?.email && (
            <div style={{ fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🟢 連携 中: {user.email}
            </div>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.35)',
          }}
        >{loading ? '取得中…' : '🔄 再取得'}</button>
      </div>

      {err && <div style={errStyle()}>⚠️ {err}</div>}

      {/* カテゴリ サマリ チップ */}
      {!allEmpty && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {(Object.keys(CATEGORY_META) as Category[])
            .filter((k) => counts[k] > 0)
            .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
            .map((k) => {
              const meta = CATEGORY_META[k];
              return (
                <div key={k} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 800,
                  background: meta.color + '22', color: meta.color,
                  border: `1px solid ${meta.color}55`,
                }}>{meta.emoji} {meta.label} {counts[k]}</div>
              );
            })}
        </div>
      )}

      {/* リスト */}
      {allEmpty ? (
        <div style={{ padding: '12px 4px', fontSize: 12, color: 'var(--fg-muted)' }}>
          ⏳ 直近 14 日 で 棚卸し 対象 の メール が 見つかりません でした。
        </div>
      ) : sorted.length === 0 && loading ? (
        <div style={{ padding: '12px 4px', fontSize: 12, color: 'var(--fg-muted)' }}>
          ⚙ 役員 が メール を 棚卸し 中… (5 - 15 秒)
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.slice(0, 10).map((i) => {
            const msg = emails.find((e) => e.id === i.msgId);
            if (!msg) return null;
            const meta = CATEGORY_META[i.category];
            const isOpen = openId === msg.id;
            const dStatus = draftStatus[msg.id];
            return (
              <div key={msg.id} style={{
                borderRadius: 10, border: `1px solid ${meta.color}55`,
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}>
                <button
                  onClick={() => setOpenId(isOpen ? null : msg.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--fg)',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}
                >
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 800,
                    background: meta.color + '22', color: meta.color,
                    flexShrink: 0, marginTop: 2, letterSpacing: '0.04em',
                  }}>{meta.emoji} {meta.label}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 800, color: 'var(--fg-strong)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{msg.subject || '(件名 なし)'}</div>
                    <div style={{
                      fontSize: 10, color: 'var(--fg-muted)', marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <strong>{cleanFrom(msg.from)}</strong> · {i.reason}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{isOpen ? '▾' : '▸'}</span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 12px 12px' }}>
                        {/* 本文 抜粋 */}
                        <div style={{
                          fontSize: 11, lineHeight: 1.6, color: 'var(--fg-muted)',
                          padding: '8px 10px', borderRadius: 6,
                          background: 'var(--surface-3)', marginBottom: 10,
                          maxHeight: 120, overflow: 'auto',
                        }}>{msg.snippet || msg.body.slice(0, 280)}…</div>

                        {/* AI 推奨 アクション */}
                        {i.action && (
                          <div style={{
                            fontSize: 11.5, lineHeight: 1.55, color: 'var(--fg-strong)',
                            padding: '8px 10px', borderRadius: 6,
                            background: meta.color + '14',
                            border: `1px solid ${meta.color}55`,
                            marginBottom: 10,
                          }}>
                            💡 <strong>役員 提案</strong>: {i.action}
                          </div>
                        )}

                        {/* AI 返信 下書き */}
                        {i.draft && (
                          <>
                            <div style={{
                              fontSize: 9, color: 'var(--fg-subtle)', fontWeight: 800,
                              letterSpacing: '0.14em', marginBottom: 4,
                            }}>📝 AI 下書き (編集 可)</div>
                            <textarea
                              defaultValue={i.draft}
                              onChange={(e) => {
                                const v = e.target.value;
                                setInsights((arr) => arr.map((x) => x.msgId === i.msgId ? { ...x, draft: v } : x));
                              }}
                              rows={6}
                              style={{
                                width: '100%', minHeight: 110, resize: 'vertical',
                                padding: '8px 10px', borderRadius: 6,
                                background: 'var(--surface)', color: 'var(--fg-strong)',
                                border: '1px solid var(--border, rgba(0,0,0,0.1))',
                                fontSize: 11.5, lineHeight: 1.6,
                                fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleCreateDraft(msg, i)}
                                disabled={dStatus === 'sending'}
                                style={{
                                  fontSize: 11, padding: '6px 12px', borderRadius: 6, fontWeight: 800,
                                  background: dStatus === 'saved' ? 'rgba(52,211,153,0.2)' : meta.color,
                                  color: dStatus === 'saved' ? '#34D399' : '#0a0a0f',
                                  border: 'none', cursor: dStatus === 'sending' ? 'wait' : 'pointer',
                                }}
                              >
                                {dStatus === 'saved' ? '✓ Gmail 下書き 保存 済' :
                                 dStatus === 'sending' ? '保存 中…' :
                                 dStatus === 'err' ? '⚠ 再 試行' :
                                 '📨 Gmail に 下書き 保存'}
                              </button>
                              <a
                                href={`https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  fontSize: 11, padding: '6px 12px', borderRadius: 6, fontWeight: 700,
                                  background: 'var(--surface-3)', color: 'var(--fg)',
                                  border: '1px solid var(--border, rgba(0,0,0,0.1))',
                                  textDecoration: 'none', display: 'inline-block',
                                }}
                              >🔗 Gmail で 開く</a>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* RAG ビジョン フッタ */}
      <div style={{
        marginTop: 14, padding: '10px 12px', borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.10), rgba(99,102,241,0.10))',
        border: '1px solid rgba(167,139,250,0.3)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#A78BFA', marginBottom: 4 }}>
          ✨ 最強 の RAG ビジョン
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--fg)' }}>
          Gmail を 入れた のと 同じ 様 に、 Instagram / TikTok / Stripe / 会議 録 を 全部 繋ぐと、
          役員 が 横断 で 「この 案件 は X で 触れて、 Y で 反応 が 良かった」 と
          意思決定 できる 様 に なります。
        </div>
      </div>
    </div>
  );
}

// ─── スタイル helpers ─────────────────────────
function cardStyle(border = 'rgba(167,139,250,0.4)'): React.CSSProperties {
  return {
    padding: '14px 16px',
    borderRadius: 14,
    background: 'var(--surface)',
    border: `1px solid ${border}`,
    marginBottom: 14,
    color: 'var(--fg)',
  };
}
function titleStyle(): React.CSSProperties {
  return {
    fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: '0 0 4px',
    letterSpacing: '-0.01em',
  };
}
function bodyStyle(): React.CSSProperties {
  return { fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.55, margin: 0 };
}
function primaryButtonStyle(color: string): React.CSSProperties {
  return {
    fontSize: 13, padding: '10px 16px', borderRadius: 10, fontWeight: 900,
    background: `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: '#fff', border: 'none', cursor: 'pointer',
    boxShadow: `0 4px 14px ${color}55`,
  };
}
function errStyle(): React.CSSProperties {
  return {
    marginTop: 8, padding: '8px 10px', borderRadius: 6,
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    fontSize: 11, color: '#DC2626',
  };
}

function cleanFrom(from: string): string {
  // "Name <email>" or "email" を 整形
  const m = from.match(/^"?([^"<]+?)"?\s*<.+>$/);
  return (m ? m[1] : from).trim().slice(0, 40);
}

// ─── AI 分類 + 下書き 生成 ─────────────────────────
async function classifyAndDraft(emails: GmailMessage[]): Promise<Insight[]> {
  // メール を コンパクト 化
  const compact = emails.map((e, i) => ({
    idx: i,
    id: e.id,
    from: e.from,
    subject: e.subject,
    snippet: (e.snippet || e.body.slice(0, 200)).slice(0, 240),
  }));

  // 1 回 で 分類 + 返信 必要 のは draft も
  const prompt = `あなた は メール 棚卸し と 返信 下書き の AI 役員 です。
以下 の メール (${emails.length} 通) を 「全部」 分類 して、 返信 必要 (reply) と 案件 候補 (deal) の もの に は 80-180 字 の 丁寧 な 日本語 下書き も 作って ください。

分類 ルール:
- "deal": 新規 案件 / 仕事 依頼 / 紹介 / 見積 依頼
- "urgent": 督促 / 苦情 / 至急 / 期限 切れ
- "reply": 質問 / 返事 を 求めて いる / お礼 を 返したい
- "later": 後で 良い、 但し 重要 性 はある
- "newsletter": ニュース / 自動 配信 / 広告

純 JSON で 返す。 マークダウン 禁止。 形式:
{"items": [
  {"id": "<gmail id>", "category": "deal|urgent|reply|later|newsletter", "reason": "<1 行 で 根拠>", "action": "<役員 提案 1 文>", "draft": "<80-180 字 返信 下書き、 reply/deal のみ>"}
]}

メール:
${compact.map((m) => `[id=${m.id}] from=${m.from} subject="${m.subject}" snippet="${m.snippet}"`).join('\n')}`;

  let parsed: { items?: Array<any> } = {};
  try {
    const res = await aiFetch({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'haiku',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const text = j?.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {
    console.error('classifyAndDraft', e);
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const valid: Insight[] = [];
  for (const it of items) {
    if (!it || typeof it.id !== 'string') continue;
    if (!emails.some((e) => e.id === it.id)) continue;
    const cat = ['deal', 'urgent', 'reply', 'later', 'newsletter'].includes(it.category) ? it.category : 'later';
    valid.push({
      msgId: it.id,
      category: cat as Category,
      reason: String(it.reason || '').slice(0, 80) || '判定 中',
      action: it.action ? String(it.action).slice(0, 200) : undefined,
      draft: it.draft ? String(it.draft).slice(0, 800) : undefined,
    });
  }

  // AI が 抜けて も、 入って いない メール は 「後で」 で 全部 拾う
  for (const e of emails) {
    if (!valid.some((v) => v.msgId === e.id)) {
      valid.push({
        msgId: e.id,
        category: 'later',
        reason: '自動 分類 抜け — 手動 確認',
      });
    }
  }

  return valid;
}
