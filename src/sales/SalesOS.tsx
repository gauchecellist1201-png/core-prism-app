// ============================================================
// CORE Studio Sales OS — シェル
//
// 目的は営業管理ではなく営業成果。開いた瞬間に「今日、誰に、何を」が出る。
// タブ: 今日 / 企業 / 追客 / レポート
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { NAV_H, RADIUS, T } from './theme';
import { Btn, Card, ErrorNote, Field, Spinner } from './ui';
import { ApiError, clearKey, fetchConfig, getKey, setKey, type SalesConfig } from './api';
import TodayView from './views/TodayView';
import CompaniesView from './views/CompaniesView';
import FollowupsView from './views/FollowupsView';
import ReportView from './views/ReportView';
import CompanyDetail from './views/CompanyDetail';

type Tab = 'today' | 'companies' | 'followups' | 'report';

const TABS: Array<{ id: Tab; label: string; sub: string }> = [
  { id: 'today', label: '今日', sub: 'やること' },
  { id: 'companies', label: '企業', sub: '営業先' },
  { id: 'followups', label: '追客', sub: '期限' },
  { id: 'report', label: 'レポート', sub: '学習' },
];

export default function SalesOS() {
  const [key, setKeyState] = useState<string>(getKey);
  const [keyInput, setKeyInput] = useState('');
  const [cfg, setCfg] = useState<SalesConfig | null>(null);
  const [cfgErr, setCfgErr] = useState<string>('');
  // 401 のときに key state を書き換えると「key に依存する効果が key を変える」
  // 循環になるので、締め出されたことは別の旗で持つ。
  const [authFailed, setAuthFailed] = useState(false);
  const [booted, setBooted] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [openId, setOpenId] = useState<string | null>(null);
  // 一覧側に「変わったよ」を伝えるための世代番号
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev(v => v + 1), []);

  // 効果の中で同期的に setState しない (await のあとだけで触る)
  const loadConfig = useCallback(async () => {
    // key は state ではなく保存先から読む。効果が key state に依存すると
    // 「key を読む効果が key を書く」循環になる。
    if (!getKey()) return;
    try {
      const c = await fetchConfig();
      setCfg(c);
      setCfgErr('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setAuthFailed(true); return; }
      setCfgErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBooted(true);
    }
  }, []);

  // 初回の読み込みだけ。合言葉を入れた直後は下のボタンから直接呼ぶ
  // (効果が key state に依存すると、そのstateを書き換える処理と循環する)
  useEffect(() => { void loadConfig(); }, [loadConfig]);

  // ---- 合言葉 ----
  if (!key || authFailed) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.3em', color: T.gold, fontWeight: 800 }}>CORE STUDIO</div>
            <h1 style={{ fontSize: 22, margin: '8px 0 6px', fontWeight: 900, letterSpacing: '-0.01em' }}>Sales OS</h1>
            <div style={{ fontSize: 12.5, color: T.mute, lineHeight: 1.8 }}>
              {authFailed ? '合言葉が違います。もう一度入れてください。' : 'オーナー専用です。合言葉を入れてください。'}
            </div>
          </div>
          <Card>
            <Field
              label="合言葉" value={keyInput} onChange={setKeyInput} type="password"
              placeholder="合言葉"
            />
            <Btn
              variant="primary" full
              onClick={() => {
                const k = keyInput.trim();
                if (!k) return;
                setKey(k);
                setKeyState(k);
                setAuthFailed(false);
                setCfgErr('');
                setKeyInput('');
                void loadConfig();
              }}
            >
              開く
            </Btn>
          </Card>
        </div>
      </div>
    );
  }

  const conflicts = cfg?.priceConflicts ?? [];

  return (
    <div style={{ minHeight: '100svh', background: T.bg }}>
      {/* ヘッダー */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40, background: 'rgba(8,9,12,0.92)',
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${T.line}`,
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 14px', height: 52,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.26em', color: T.gold, fontWeight: 800 }}>CORE STUDIO</div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.01em' }}>Sales OS</div>
          </div>
          <Btn small variant="quiet" href="/studio/film" newTab>料金ページ</Btn>
          <Btn
            small variant="quiet"
            onClick={() => { clearKey(); setKeyState(''); setCfg(null); setAuthFailed(false); }}
            title="合言葉を消して閉じる"
          >
            ロック
          </Btn>
        </div>
      </header>

      <main style={{
        maxWidth: 1080, margin: '0 auto',
        padding: `14px 14px calc(${NAV_H}px + env(safe-area-inset-bottom) + 20px)`,
      }}>
        {/* 価格の食い違い警告 — 消えるまで出し続ける。
            ただし1画面目を丸ごと潰すと「今日やること」が折り目の下に落ちるので、
            既定は1行。中身は押したときだけ開く。 */}
        {conflicts.length > 0 && (
          <div style={{
            background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.4)',
            borderRadius: RADIUS.md, padding: '8px 10px', marginBottom: 12,
          }}>
            <button
              type="button"
              onClick={() => setConflictOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 36,
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#FCA5A5', flex: 1, minWidth: 0 }}>
                金額が公開ページと食い違っています ({conflicts.length}件)
              </span>
              <span style={{ fontSize: 11.5, color: '#FCA5A5', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {conflictOpen ? '閉じる' : '詳しく'}
              </span>
            </button>
            {conflictOpen && (
              <div style={{ marginTop: 6 }}>
                {conflicts.map(c => (
                  <div key={c.product} style={{ fontSize: 12, color: '#FCA5A5', lineHeight: 1.85 }}>
                    ・{c.product} — {c.message}
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: T.mute, marginTop: 8, lineHeight: 1.8 }}>
                  揃うまで、AIが書くメール・電話トークには金額を入れません。
                </div>
              </div>
            )}
          </div>
        )}

        {cfg?.security?.usingDefaultKey && (
          <div style={{ marginBottom: 12 }}>
            <ErrorNote>
              合言葉が既定値のままです。この文字列は公開済みで、知っている人は誰でも
              この営業先データを読み書きできます。Vercel の環境変数に MASTER_KEY を
              設定してください (設定するとこの警告は消えます)。
              変更したら、この画面では新しい合言葉を入れ直してください。
              他のアプリ (Prism / Iris など) は端末側の定数
              src/lib/billing.ts も合わせて更新が必要です。
            </ErrorNote>
          </div>
        )}

        {cfg?.storage.configured === false && (
          <div style={{ marginBottom: 14 }}>
            <ErrorNote>
              保存先 (Upstash Redis) が未設定です。登録しても保存されません。
            </ErrorNote>
          </div>
        )}

        {cfgErr ? (
          <ErrorNote onRetry={() => void loadConfig()}>{cfgErr}</ErrorNote>
        ) : !cfg ? (
          // 読み終わったのに cfg が無い = 失敗している。ぐるぐるを回し続けない。
          booted
            ? <ErrorNote onRetry={() => void loadConfig()}>設定を読み込めませんでした。</ErrorNote>
            : <Spinner label="準備しています…" />
        ) : openId ? (
          <CompanyDetail
            id={openId}
            cfg={cfg}
            onBack={() => setOpenId(null)}
            onChanged={bump}
            onDeleted={() => { setOpenId(null); bump(); }}
          />
        ) : tab === 'today' ? (
          <TodayView rev={rev} onOpen={setOpenId} onGoCompanies={() => setTab('companies')} />
        ) : tab === 'companies' ? (
          <CompaniesView rev={rev} onOpen={setOpenId} onChanged={bump} />
        ) : tab === 'followups' ? (
          <FollowupsView rev={rev} onOpen={setOpenId} />
        ) : (
          <ReportView rev={rev} />
        )}
      </main>

      {/* 下部ナビ */}
      <nav style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: 'rgba(8,9,12,0.96)', backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${T.line}`, paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex' }}>
          {TABS.map(t => {
            const active = !openId && tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setOpenId(null); setTab(t.id); window.scrollTo({ top: 0 }); }}
                style={{
                  flex: 1, minWidth: 0, minHeight: NAV_H, background: 'transparent',
                  border: 'none', borderTop: `2px solid ${active ? T.gold : 'transparent'}`,
                  color: active ? T.gold : T.mute, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  padding: '0 4px',
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{t.label}</span>
                <span style={{ fontSize: 9.5, color: active ? T.gold : T.faint, fontWeight: 700 }}>{t.sub}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
