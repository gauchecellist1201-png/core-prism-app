// ============================================================
// 会計サービス連携 (freee / マネーフォワード) — 双方向 API 連携
// Phase 1: OAuth 接続 UI + 接続状態表示 (env 未設定なら接続不可)
// Phase 2 (予約): 売上自動同期、請求書取込、勘定科目マッピング
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { notifyInApp } from '../lib/inAppNotify';

type ProviderId = 'freee' | 'mf' | 'yayoi';

interface Provider {
  id: ProviderId;
  name: string;
  initials: string;
  color: string;
  oauthUrl: string;
  envHint: string;
  features: string[];
}

const PROVIDERS: Provider[] = [
  {
    id: 'freee',
    name: 'freee 会計',
    initials: 'fr',
    color: '#00B58E',
    oauthUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
    envHint: 'FREEE_CLIENT_ID + FREEE_CLIENT_SECRET',
    features: ['売上自動同期 (請求書 → freee 取引)', '勘定科目マッピング (UI 上で 1:1)', '月次 P&L を CORE 内に表示'],
  },
  {
    id: 'mf',
    name: 'マネーフォワード クラウド',
    initials: 'MF',
    color: '#FFA500',
    oauthUrl: 'https://api.biz.moneyforward.com/authorize',
    envHint: 'MF_CLIENT_ID + MF_CLIENT_SECRET',
    features: ['仕訳自動連携 (双方向)', '銀行口座データ取込', '部門別 P&L レポート'],
  },
  {
    id: 'yayoi',
    name: '弥生会計オンライン',
    initials: '弥',
    color: '#2E6FD9',
    oauthUrl: 'https://api.yayoi-kk.co.jp/oauth/authorize',
    envHint: 'YAYOI_CLIENT_ID + YAYOI_CLIENT_SECRET',
    features: ['取引データ取込', '消費税自動計算'],
  },
];

const STORAGE_KEY = 'core_accounting_connections_v1';

interface Connection {
  provider: ProviderId;
  connectedAt: string;
  status: 'connected' | 'pending' | 'error';
}

function loadConnections(): Connection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConnections(list: Connection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {/* ignore */}
}

export default function AccountingIntegration() {
  const [connections, setConnections] = useState<Connection[]>(() => loadConnections());
  const [oauthStatus, setOauthStatus] = useState<Record<ProviderId, 'idle' | 'checking'>>({} as any);
  const [envAvailable, setEnvAvailable] = useState<Record<ProviderId, boolean>>({} as any);
  // 状態取得が「通信障害」で失敗したのか「未設定 (404 等)」なのかを区別する
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'ok' | 'network-error'>('idle');

  // env 設定確認 (公開エンドポイント /api/accounting/status を叩く想定)
  const checkStatus = useCallback(async () => {
    setFetchState('loading');
    try {
      const res = await fetchWithTimeout('/api/accounting/status', {}, 12000);
      if (res.ok) {
        const data = await res.json();
        setEnvAvailable({
          freee: !!data.freee?.configured,
          mf: !!data.mf?.configured,
          yayoi: !!data.yayoi?.configured,
        });
        setFetchState('ok');
      } else if (res.status === 404) {
        // エンドポイント未実装は「未設定」と同義扱い (障害ではない)
        setFetchState('ok');
      } else {
        // 5xx 等のサーバー側の一時不調 — 通信障害として扱う
        setFetchState('network-error');
      }
    } catch {
      // TypeError 等 (ネットワーク断・CORS・DNS 失敗) は通信障害
      setFetchState('network-error');
    }
  }, []);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  const isConnected = (id: ProviderId) => connections.some(c => c.provider === id && c.status === 'connected');

  const handleConnect = (p: Provider) => {
    if (!envAvailable[p.id]) {
      notifyInApp({ kind: 'info', title: `${p.name} との連携は準備中です`, body: '使えるようになり次第アプリ内でお知らせします。' });
      return;
    }
    setOauthStatus(s => ({ ...s, [p.id]: 'checking' }));
    // 本番では /api/accounting/<provider>/connect へリダイレクト → OAuth flow
    window.location.href = `/api/accounting/${p.id}/connect`;
  };

  const handleDisconnect = (id: ProviderId) => {
    const next = connections.filter(c => c.provider !== id);
    setConnections(next);
    saveConnections(next);
    // 本番では /api/accounting/<provider>/disconnect も叩く
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-fg-muted">
        会計サービスと API 連携 — 売上台帳・請求書・経費が双方向に自動同期されます
      </p>

      {fetchState === 'network-error' && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: 12, padding: '0.7rem 0.9rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="text-fg text-sm font-medium" style={{ margin: 0 }}>連携状況を一時的に取得できませんでした</p>
            <p className="text-xs text-fg-muted" style={{ margin: '2px 0 0' }}>
              通信状況を確認して、もう一度お試しください。
            </p>
          </div>
          <button
            type="button"
            onClick={checkStatus}
            disabled={(fetchState as string) === 'loading'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.45)',
              color: '#FBBF24', padding: '0.4rem 0.85rem', borderRadius: 999,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}
          >
            <RotateCcw size={12} />再読み込み
          </button>
        </div>
      )}

      <div className="space-y-2">
        {PROVIDERS.map(p => {
          const connected = isConnected(p.id);
          const available = envAvailable[p.id];
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'var(--surface-3)',
                border: `1px solid ${connected ? p.color + '88' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '0.9rem 1rem',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    style={{
                      position: 'relative',
                      width: 40, height: 40, borderRadius: 12,
                      background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)`,
                      boxShadow: `0 6px 16px ${p.color}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
                      color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em',
                      flexShrink: 0,
                    }}
                  >
                    {p.initials}
                    {connected && (
                      <span style={{
                        position: 'absolute', right: -3, bottom: -3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#10B981', border: '2px solid var(--surface-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={9} color="#fff" strokeWidth={3.5} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-fg text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-fg-muted">
                      {connected
                        ? '接続中 (双方向同期 ON)'
                        : available
                          ? '未接続 (タップして OAuth 開始)'
                          : '準備中 — 近日対応予定'}
                    </p>
                  </div>
                </div>
                {connected ? (
                  <button
                    onClick={() => handleDisconnect(p.id)}
                    style={{
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--fg-muted)', padding: '0.4rem 0.85rem',
                      borderRadius: 999, fontSize: 12, cursor: 'pointer',
                    }}>
                    解除
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(p)}
                    disabled={oauthStatus[p.id] === 'checking'}
                    style={{
                      background: available ? p.color : 'var(--surface-3)',
                      color: available ? '#fff' : 'var(--fg-muted)',
                      border: `1px solid ${available ? p.color : 'var(--border)'}`,
                      padding: '0.45rem 1rem', borderRadius: 999,
                      fontSize: 12, fontWeight: 700, cursor: available ? 'pointer' : 'not-allowed',
                      opacity: available ? 1 : 0.6,
                    }}
                  >
                    {oauthStatus[p.id] === 'checking' ? '接続中…' : (available ? '接続する →' : '準備中')}
                  </button>
                )}
              </div>
              <ul style={{ margin: '0.6rem 0 0 0.25rem', padding: 0, listStyle: 'none' }}>
                {p.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.7 }}>
                    <span style={{ color: p.color, marginRight: 6 }}>·</span>{f}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-fg-muted leading-relaxed pt-2">
        <strong className="text-fg">Phase 2 (6/15 予定)</strong>: 売上台帳に登録した請求書が freee / MF にも自動で取引として記録、また会計側で起こった仕訳が CORE 側の P&L レポートにも反映される双方向同期を完成させます。
      </p>
    </div>
  );
}
