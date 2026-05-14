// ============================================================
// HealthAutoSyncModal — Apple Health → Iris 自動連携セットアップ
// iOS ショートカット用のレシピ + トークン発行
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { absoluteIngestUrl, ensureHealthToken, pullIngestedDays, pushTestMetric, clearHealthToken } from '../../lib/healthIngest';
import type { IrisBackgroundDef } from '../../iris/irisStyle';
import { IRIS_FONTS } from '../../iris/irisStyle';

interface Props {
  bg: IrisBackgroundDef;
  open: boolean;
  onClose: () => void;
  onPulled?: (count: number) => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function HealthAutoSyncModal({ bg, open, onClose, onPulled }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [token, setToken] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [testDetail, setTestDetail] = useState<string>('');
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'ok' | 'err'>('idle');
  const [pullCount, setPullCount] = useState<number>(0);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const ingestUrl = useMemo(() => absoluteIngestUrl(), []);

  useEffect(() => {
    if (!open) return;
    // モーダルを開いた段階でトークンを確保
    const t = ensureHealthToken();
    setToken(t);
    setStep(1);
    setTestStatus('idle');
    setPullStatus('idle');
    setConfigured(null);
  }, [open]);

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField((cur) => (cur === field ? null : cur)), 1500);
    } catch { /* ignore */ }
  };

  const runConnectionTest = async () => {
    if (!token) return;
    setTestStatus('sending');
    setTestDetail('');
    try {
      const r = await pushTestMetric(token, { steps: 0, restingHR: 60, sleepHours: 0 });
      if (r.ok || r.status === 202) {
        setTestStatus('ok');
        setConfigured(!!r.body?.configured);
        setTestDetail(
          r.body?.configured
            ? `サーバー保存 OK (Upstash 接続済み) · ${r.body?.accepted ?? 1} 件受領`
            : `エンドポイント到達 OK · ただし永続化 OFF (運用者が UPSTASH_REDIS_REST_URL/TOKEN を設定する必要あり)`,
        );
      } else {
        setTestStatus('err');
        setTestDetail(`HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 160)}`);
      }
    } catch (e: any) {
      setTestStatus('err');
      setTestDetail(String(e?.message || e));
    }
  };

  const runPull = async () => {
    if (!token) return;
    setPullStatus('pulling');
    try {
      const r = await pullIngestedDays(token);
      setConfigured(r.configured);
      if (r.error) {
        setPullStatus('err');
      } else {
        setPullCount(r.daysFetched);
        setPullStatus('ok');
        onPulled?.(r.daysFetched);
      }
    } catch {
      setPullStatus('err');
    }
  };

  if (!open) return null;

  // ショートカット手順テキスト (コピー可能)
  const shortcutRecipe = `[ Iris ヘルス自動同期 - iOS ショートカット レシピ ]

1. iPhone で「ショートカット」アプリを開く
2. 右上「+」→ 新規ショートカット
3. 以下のアクションを順番に追加:

   ① ヘルスケアサンプルを検索 (Find Health Samples)
      - サンプルタイプ: 歩数
      - 期間: 今日

   ② 数値を合計 (Sum)
      入力: 上記のヘルスケアサンプル
      → 結果を 変数「today_steps」 に保存

   ③ ヘルスケアサンプルを検索
      - サンプルタイプ: 安静時心拍数
      - 期間: 今日
      - 並べ替え: 終了日 降順
      - 制限: 1
      → 結果を 変数「resting_hr」 に保存

   ④ ヘルスケアサンプルを検索
      - サンプルタイプ: 心拍変動 (HRV SDNN)
      - 期間: 今日
      - 並べ替え: 終了日 降順
      - 制限: 1
      → 変数「hrv」

   ⑤ ヘルスケアサンプルを検索
      - サンプルタイプ: 睡眠分析
      - 期間: 昨夜
      - 結果の継続時間(時間)合計
      → 変数「sleep_hours」

   ⑥ ヘルスケアサンプルを検索
      - サンプルタイプ: エクササイズ時間
      - 期間: 今日 合計
      → 変数「active_min」

   ⑦ 辞書を作成
      キー: source        値: "ios-shortcut"
      キー: steps         値: today_steps
      キー: restingHR     値: resting_hr
      キー: hrv           値: hrv
      キー: sleepHours    値: sleep_hours
      キー: activeMinutes 値: active_min

   ⑧ URL の内容を取得 (Get Contents of URL)
      URL:    ${ingestUrl}
      Method: POST
      Headers:
        Content-Type:    application/json
        X-Health-Token:  ${token}
      Request Body: JSON (辞書)

   ⑨ 通知を表示
      "Iris に同期しました ✦"

4. 完了したらこのショートカットを保存
5. 「オートメーション」タブから「毎日 朝 7:00 に実行」を追加
   - アクション: 上記ショートカットを実行
   - 「実行前に尋ねる」を OFF

完成! 毎朝 Iris にデータが自動で届きます。
`;

  // 共通スタイル
  const cardStyle: React.CSSProperties = {
    background: bg.card,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 14,
    padding: '1.1rem 1.25rem',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.65rem', letterSpacing: '0.25em', color: bg.accent, fontWeight: 700,
  };
  const monoBox: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,0.05)',
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 10,
    padding: '0.55rem 0.7rem',
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: '0.78rem',
    wordBreak: 'break-all',
    color: bg.ink,
  };
  const btn = (variant: 'primary' | 'ghost'): React.CSSProperties => ({
    padding: '0.55rem 1.05rem',
    borderRadius: 999,
    fontSize: '0.82rem',
    fontWeight: 700,
    border: variant === 'primary' ? 'none' : `1px solid ${bg.cardBorder}`,
    background: variant === 'primary' ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'transparent',
    color: variant === 'primary' ? '#fff' : bg.ink,
    cursor: 'pointer',
    fontFamily: IRIS_FONTS.body,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(20,18,30,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '4vh 1rem',
        overflowY: 'auto',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640,
          background: bg.background,
          borderRadius: 20,
          padding: '1.5rem 1.5rem 1.25rem',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          fontFamily: IRIS_FONTS.body,
          color: bg.ink,
          border: `1px solid ${bg.cardBorder}`,
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem' }}>
          <div>
            <p style={labelStyle}>AUTO SYNC SETUP</p>
            <h2 style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: '1.55rem', fontWeight: 500, margin: '0.3rem 0 0.2rem',
              color: bg.ink,
            }}>
              Apple Health を毎朝、自動で。
            </h2>
            <p style={{ fontSize: '0.8rem', color: bg.inkSoft, lineHeight: 1.7 }}>
              iOS のショートカットアプリを使って、ZIP を書き出す手間ゼロで Iris にデータを届けます。
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: bg.inkSoft, fontSize: '1.4rem', lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        {/* ステップインジケータ */}
        <div style={{ display: 'flex', gap: 6, marginBottom: '1.2rem' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: n <= step ? bg.accent : `${bg.accent}25`,
              transition: 'background 0.25s',
            }} />
          ))}
        </div>

        {/* STEP 1 — トークン発行 */}
        {step === 1 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={cardStyle}>
              <p style={labelStyle}>STEP 1 / 5</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.2rem', margin: '0.3rem 0 0.5rem', fontWeight: 500 }}>
                あなた専用のトークンを発行
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, lineHeight: 1.75, marginBottom: '0.7rem' }}>
                このトークンが Iris とあなたの iPhone を結ぶ鍵になります。<strong style={{ color: bg.ink }}>他人と共有しないでください。</strong>
              </p>
              <div style={monoBox}>
                <span style={{ flex: 1 }}>{token || '生成中...'}</span>
                <button onClick={() => copy(token, 'token')} style={btn('ghost')}>
                  {copiedField === 'token' ? 'コピー済' : 'コピー'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => { clearHealthToken(); const t = ensureHealthToken(); setToken(t); }} style={btn('ghost')}>
                新しいトークンを再発行
              </button>
              <button onClick={() => setStep(2)} style={btn('primary')}>次へ →</button>
            </div>
          </div>
        )}

        {/* STEP 2 — エンドポイント URL */}
        {step === 2 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={cardStyle}>
              <p style={labelStyle}>STEP 2 / 5</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.2rem', margin: '0.3rem 0 0.5rem', fontWeight: 500 }}>
                送信先 URL とヘッダ
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, marginBottom: '0.7rem' }}>
                iOS ショートカットの「URL の内容を取得」アクションで使う設定です。
              </p>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginBottom: 4 }}>URL</p>
              <div style={monoBox}>
                <span style={{ flex: 1 }}>{ingestUrl}</span>
                <button onClick={() => copy(ingestUrl, 'url')} style={btn('ghost')}>
                  {copiedField === 'url' ? '✓' : 'コピー'}
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft, margin: '0.7rem 0 4px' }}>Method</p>
              <div style={monoBox}><span>POST</span></div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft, margin: '0.7rem 0 4px' }}>Header: X-Health-Token</p>
              <div style={monoBox}>
                <span style={{ flex: 1 }}>{token}</span>
                <button onClick={() => copy(token, 'token2')} style={btn('ghost')}>
                  {copiedField === 'token2' ? '✓' : 'コピー'}
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: bg.inkSoft, margin: '0.7rem 0 4px' }}>Header: Content-Type</p>
              <div style={monoBox}><span>application/json</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => setStep(1)} style={btn('ghost')}>← 戻る</button>
              <button onClick={() => setStep(3)} style={btn('primary')}>次へ →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — ショートカットの作り方 */}
        {step === 3 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={cardStyle}>
              <p style={labelStyle}>STEP 3 / 5</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.2rem', margin: '0.3rem 0 0.5rem', fontWeight: 500 }}>
                ショートカットを作る
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, marginBottom: '0.7rem', lineHeight: 1.75 }}>
                以下のレシピを iPhone の「ショートカット」アプリで組み立ててください。
                全文コピーして、メモアプリ等に貼って iPhone と共有すると組みやすいです。
              </p>
              <button onClick={() => copy(shortcutRecipe, 'recipe')} style={{ ...btn('primary'), width: '100%', marginBottom: '0.7rem' }}>
                {copiedField === 'recipe' ? '✓ レシピをコピー済' : 'レシピを全文コピー'}
              </button>
              <details style={{ ...cardStyle, padding: '0.75rem 0.9rem', marginTop: 4 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.82rem', color: bg.ink, fontWeight: 600 }}>レシピを開く</summary>
                <pre style={{
                  marginTop: '0.7rem',
                  fontSize: '0.72rem',
                  lineHeight: 1.65,
                  color: bg.inkSoft,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                }}>
                  {shortcutRecipe}
                </pre>
              </details>
              <p style={{ fontSize: '0.75rem', color: bg.inkSoft, marginTop: '0.7rem', lineHeight: 1.7 }}>
                ヒント: 最初の 1 回だけ iPhone でレシピを組めば、あとはオートメーションが毎朝勝手に動きます。
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => setStep(2)} style={btn('ghost')}>← 戻る</button>
              <button onClick={() => setStep(4)} style={btn('primary')}>次へ (接続テスト) →</button>
            </div>
          </div>
        )}

        {/* STEP 4 — 接続テスト */}
        {step === 4 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={cardStyle}>
              <p style={labelStyle}>STEP 4 / 5</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.2rem', margin: '0.3rem 0 0.5rem', fontWeight: 500 }}>
                接続を試す
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, marginBottom: '0.85rem', lineHeight: 1.75 }}>
                ショートカットを実行する前に、ブラウザからエンドポイントに到達できるか試します。
                成功すればトークンは正しく登録されています。
              </p>
              <button onClick={runConnectionTest} disabled={testStatus === 'sending'} style={{ ...btn('primary'), width: '100%' }}>
                {testStatus === 'sending' ? '送信中…' : 'テスト送信 (steps:0, HR:60)'}
              </button>
              {testStatus === 'ok' && (
                <div style={{
                  marginTop: '0.7rem',
                  padding: '0.7rem 0.85rem',
                  background: `${bg.accent}1c`,
                  border: `1px solid ${bg.accent}55`,
                  borderRadius: 10,
                  fontSize: '0.8rem',
                  color: bg.ink,
                  lineHeight: 1.7,
                }}>
                  ✓ 成功 — {testDetail}
                </div>
              )}
              {testStatus === 'err' && (
                <div style={{
                  marginTop: '0.7rem',
                  padding: '0.7rem 0.85rem',
                  background: '#FEE2E2',
                  color: '#991B1B',
                  borderRadius: 10,
                  fontSize: '0.8rem',
                  lineHeight: 1.65,
                }}>
                  ✕ 失敗 — {testDetail}
                  <br />
                  <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>復旧: ① ページを再読み込み ② token を再発行 (STEP 1) ③ ネットワーク接続を確認</span>
                </div>
              )}
              {configured === false && testStatus === 'ok' && (
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: '0.6rem', lineHeight: 1.7 }}>
                  ※ 永続化が OFF の場合、ショートカットは届きますが Iris に蓄積されません。
                  Vercel ダッシュボードで <code>UPSTASH_REDIS_REST_URL</code> と <code>UPSTASH_REDIS_REST_TOKEN</code> を設定してください
                  (Upstash 無料枠で OK)。
                </p>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => setStep(3)} style={btn('ghost')}>← 戻る</button>
              <button onClick={() => setStep(5)} style={btn('primary')} disabled={testStatus !== 'ok'}>次へ →</button>
            </div>
          </div>
        )}

        {/* STEP 5 — 取り込み */}
        {step === 5 && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={cardStyle}>
              <p style={labelStyle}>STEP 5 / 5</p>
              <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.2rem', margin: '0.3rem 0 0.5rem', fontWeight: 500 }}>
                サーバーから取り込み
              </h3>
              <p style={{ fontSize: '0.82rem', color: bg.inkSoft, marginBottom: '0.85rem', lineHeight: 1.75 }}>
                ショートカットを 1 回でも実行していれば、ここから直近のデータを Iris に取り込めます。
                今後は Iris を開くたびに自動で取得されます。
              </p>
              <button onClick={runPull} disabled={pullStatus === 'pulling'} style={{ ...btn('primary'), width: '100%' }}>
                {pullStatus === 'pulling' ? '取得中…' : 'サーバーから取り込む'}
              </button>
              {pullStatus === 'ok' && (
                <div style={{
                  marginTop: '0.7rem',
                  padding: '0.7rem 0.85rem',
                  background: `${bg.accent}1c`,
                  border: `1px solid ${bg.accent}55`,
                  borderRadius: 10,
                  fontSize: '0.85rem',
                  color: bg.ink,
                  lineHeight: 1.7,
                }}>
                  ✓ {pullCount} 日分を取り込みました
                  {pullCount === 0 && ' — まだショートカットからデータが届いていないようです。iPhone でショートカットを 1 度実行してから再試行してください。'}
                </div>
              )}
              {pullStatus === 'err' && (
                <div style={{ marginTop: '0.7rem', padding: '0.7rem 0.85rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 10, fontSize: '0.82rem' }}>
                  ✕ 取得に失敗しました — ネットワークを確認してください
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => setStep(4)} style={btn('ghost')}>← 戻る</button>
              <button onClick={onClose} style={btn('primary')}>完了</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
