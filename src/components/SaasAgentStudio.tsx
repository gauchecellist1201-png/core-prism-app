import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, AppSettings } from '../types/identity';
import {
  runSaasTask,
  inferSaasIntent,
  TARGET_LABELS,
  TARGET_EMOJI,
  TARGET_PERMISSIONS,
  type SaasTarget,
  type SaasAction,
  type SaasTaskResult,
  type SaasIntent,
} from '../lib/saasAgent';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import ApiErrorCard from './ApiErrorCard';
import { StudioIntro } from './StudioIntro';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

// ─── デモシナリオ (新 SaaS にも 1 件ずつ) ──────────────────────────────────────
const DEMO_SCENARIOS: {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  target: SaasTarget;
  action: SaasAction;
  payload: string;
}[] = [
  {
    id: 'notion-postmortem',
    emoji: '📝',
    label: 'Notion: 今週のポストモーテムを追加',
    desc: '振り返りを Notion DB に自動記録',
    target: 'notion', action: 'append',
    payload:
      '今週 (2026-05-18～2026-05-24) のポストモーテムを Notion の「振り返り」データベースに追加してください。\n' +
      'タイトル: API レイテンシ増大 / 原因: DB インデックス欠落 / 対策: 複合インデックス追加 + P99 監視\n' +
      '重大度: Medium / 担当: エンジニアチーム',
  },
  {
    id: 'linear-bug',
    emoji: '📐',
    label: 'Linear: バグを Issue に登録',
    desc: '報告内容を Linear に Issue 化',
    target: 'linear', action: 'create',
    payload:
      'Linear の Engineering チームに以下のバグを Issue として登録してください。\n' +
      'タイトル: ログイン直後にダッシュボードが空表示\n' +
      '優先度: High / 再現手順: 1) /login 2) Google でサインイン 3) ダッシュボードが 2 秒間真っ白\n' +
      'ラベル: bug, frontend',
  },
  {
    id: 'asana-tasks',
    emoji: '✅',
    label: 'Asana: 議事録から ToDo を 5 件作成',
    desc: '会議の宿題を担当者付きで Asana に',
    target: 'asana', action: 'create',
    payload:
      '昨日の経営会議の議事録から、以下 5 件を Asana プロジェクト「経営定例」のタスクとして作成してください。\n' +
      '1) 売上 KPI のダッシュボード化 (担当: 鈴木 / 期限: 6/3)\n' +
      '2) 採用面談スロット 5 枠追加 (担当: 田中 / 期限: 5/28)\n' +
      '3) 銀行融資の事前面談予約 (担当: 井出 / 期限: 5/30)\n' +
      '4) プロダクト価格改定の社内 FAQ 作成 (担当: 佐藤 / 期限: 6/1)\n' +
      '5) コアバリューのスライド作成 (担当: 山田 / 期限: 6/5)',
  },
  {
    id: 'gdocs-minutes',
    emoji: '📄',
    label: 'Google Docs: 議事録を新規作成',
    desc: 'テンプレ付きで Docs に保存',
    target: 'gdocs', action: 'create',
    payload:
      'Google Docs に「2026-05-24 経営定例議事録」を新規作成してください。\n' +
      'フォルダ: 経営定例 / 章立て: アジェンダ, 決定事項, ToDo, 次回まで\n' +
      '本文: 売上進捗 +12%、採用は今月 3 名内定、来週から SaaS 連携の本番運用開始',
  },
  {
    id: 'calendly-link',
    emoji: '📅',
    label: 'Calendly: 商談の招待リンク発行',
    desc: '30 分商談用の URL を生成',
    target: 'calendly', action: 'create',
    payload:
      'Calendly で「30 分 商談 (新規顧客)」イベントタイプの招待 URL を発行してください。\n' +
      '宛先: tanaka@acme.co.jp、用途: 提案資料の説明、希望時間帯: 平日 13-17 時',
  },
  {
    id: 'hubspot-contacts',
    emoji: '🤝',
    label: 'HubSpot: 議事録から Contact + Deal',
    desc: 'CRM に出席者を一括登録',
    target: 'hubspot', action: 'create',
    payload:
      '先日の商談ミーティングをもとに HubSpot に Contact を作成してください。\n' +
      '出席者: 田中 太郎 (tanaka@acme.co.jp, ACME 営業部長) / 佐藤 花子 (sato@acme.co.jp, ACME CTO)\n' +
      'その後 Deal「ACME 導入提案 ¥5,000,000」を作成しステージ「提案中」で紐付け。',
  },
];

const TARGET_OPTIONS: { value: SaasTarget; label: string }[] = (
  Object.keys(TARGET_LABELS) as SaasTarget[]
).map(t => ({ value: t, label: `${TARGET_EMOJI[t]} ${TARGET_LABELS[t]}` }));

const ACTION_OPTIONS: { value: SaasAction; label: string }[] = [
  { value: 'create', label: '作成 (create)' },
  { value: 'update', label: '更新 (update)' },
  { value: 'append', label: '追記 (append)' },
  { value: 'search', label: '検索 (search)' },
  { value: 'send',   label: '送信 / 下書き (send)' },
];

const MCP_CONNECTOR_HINT: Record<SaasTarget, string> = {
  notion:   'claude.ai → 設定 → 統合 → Notion を ON',
  slack:    'claude.ai → 設定 → 統合 → Slack を ON',
  linear:   'claude.ai → 設定 → 統合 → Linear を ON',
  asana:    'claude.ai → 設定 → 統合 → Asana を ON',
  trello:   'claude.ai → 設定 → 統合 → Trello を ON',
  jira:     'claude.ai → 設定 → 統合 → Atlassian (Jira) を ON',
  airtable: 'claude.ai → 設定 → 統合 → Airtable を ON',
  gdocs:    'claude.ai → 設定 → 統合 → Google Workspace (Docs/Drive) を ON',
  discord:  'claude.ai → 設定 → 統合 → Discord を ON',
  calendly: 'claude.ai → 設定 → 統合 → Calendly を ON',
  hubspot:  'claude.ai → 設定 → 統合 → HubSpot を ON',
  gmail:    'claude.ai → 設定 → 統合 → Gmail を ON',
  gdrive:   'claude.ai → 設定 → 統合 → Google Drive を ON',
  wix:      'claude.ai → 設定 → 統合 → Wix を ON',
};

export default function SaasAgentStudio({ persona, settings, onClose }: Props) {
  const queue = useAgentTaskQueue();

  // モード: 'nl' (自然言語) | 'form' (詳細入力)
  const [mode, setMode]   = useState<'nl' | 'form'>('nl');
  const [step, setStep]   = useState<'input' | 'plan' | 'guide'>('input');
  const [nlText, setNlText] = useState('');
  const [target, setTarget] = useState<SaasTarget>('notion');
  const [action, setAction] = useState<SaasAction>('create');
  const [payload, setPayload] = useState('');
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SaasTaskResult | null>(null);
  const [intent, setIntent] = useState<SaasIntent | null>(null);
  const [copied, setCopied] = useState<'plan' | 'script' | null>(null);
  const [delegated, setDelegated] = useState(false);

  const handleDemoSelect = useCallback((s: typeof DEMO_SCENARIOS[number]) => {
    setMode('form');
    setTarget(s.target);
    setAction(s.action);
    setPayload(s.payload);
    setIntent(null);
  }, []);

  const handleInferAndGenerate = useCallback(async () => {
    if (!nlText.trim()) { setError('やりたいことを 1 行で入力してください'); return; }
    setBusy(true); setError(null); setIntent(null);
    try {
      const inferred = await inferSaasIntent(nlText, settings);
      setIntent(inferred);
      setTarget(inferred.target);
      setAction(inferred.action);
      setPayload(inferred.payload);
      const r = await runSaasTask(inferred.target, inferred.action, inferred.payload, settings);
      setResult(r);
      setDelegated(false);
      setStep('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [nlText, settings]);

  const handleGenerate = useCallback(async () => {
    if (!payload.trim()) { setError('やりたいことを入力してください'); return; }
    setBusy(true); setError(null);
    try {
      const r = await runSaasTask(target, action, payload, settings);
      setResult(r);
      setDelegated(false);
      setStep('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [target, action, payload, settings]);

  const copyText = useCallback(async (text: string, kind: 'plan' | 'script') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  const handleDelegateToCoo = useCallback(() => {
    if (!result) return;
    const targetLabel = TARGET_LABELS[result.target];
    queue.propose({
      title: `${TARGET_EMOJI[result.target]} ${targetLabel} で「${(payload.split('\n')[0] || '').slice(0, 40)}」を実行`,
      summary: `SaaS エージェントが生成した ${result.estimatedSteps} ステップの実行プランを COO が ${targetLabel} 上で代行します。`,
      why: '反復作業を AI に任せ、オーナーは確認と判断のみに集中できます。',
      expected: `${targetLabel} 側で完了報告 + 実行ログをこのアプリに記録`,
      dueDays: 1,
      steps: [
        { cxo: 'COO', label: `${targetLabel} のコネクター接続を確認` },
        { cxo: 'COO', label: `MCP スクリプトを ${targetLabel} で順次実行` },
        { cxo: 'CDS', label: '実行ログを集計し、エラー / スキップ件数を可視化' },
        { cxo: 'CEO', label: '完了報告と次のアクション提案を生成' },
      ],
    });
    setDelegated(true);
    setTimeout(() => setDelegated(false), 3000);
  }, [result, payload, queue]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-2xl flex flex-col overflow-hidden md:rounded-2xl rounded-t-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="min-w-0">
            <p className="text-fg text-base font-semibold truncate">🤖 SaaS エージェント</p>
            <p className="text-fg-muted text-xs mt-0.5 truncate">
              Notion / Slack / Linear など 14 サービスを 1 行依頼で代理操作
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-surface-3 text-fg-muted hover:text-fg flex-shrink-0"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 md:gap-2 px-4 md:px-5 py-2.5 md:py-3 flex-shrink-0 overflow-x-auto" style={{ borderBottom: '1px solid var(--border)' }}>
          {(['input', 'plan', 'guide'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: step === s ? persona.accentColor : (
                    (['input', 'plan', 'guide'] as const).indexOf(step) > i
                      ? persona.accentColor + '60'
                      : 'var(--surface-3)'
                  ),
                  color: step === s ? '#fff' : 'var(--fg-muted)',
                }}
              >
                {i + 1}
              </div>
              <span className="text-xs whitespace-nowrap" style={{ color: step === s ? persona.accentColor : 'var(--fg-muted)' }}>
                {s === 'input' ? '依頼入力' : s === 'plan' ? '実行プラン' : 'Claude で実行'}
              </span>
              {i < 2 && <span className="text-fg-subtle text-xs">→</span>}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: INPUT ── */}
            {step === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <StudioIntro
                  id="saas-agent"
                  accent={persona.accentColor}
                  emoji="🤖"
                  what="14 種類の SaaS を「お願いごと 1 行」で代わりに操作してもらえる場所です。"
                  tryThis="自然言語タブに「Notion に今日の議事録を追加」と書いて「AI に推定させて実行」を押すだけ。"
                  example="入力 →AI が SaaS / 操作 / パラメータを推定 →5 ステップの実行プラン + Claude にコピペ用のスクリプトを完成。"
                  sampleLabel="出来上がる実行プラン"
                  samplePreview={
                    <div
                      style={{
                        width: 160,
                        background: 'var(--surface)',
                        color: 'var(--fg)',
                        borderRadius: 6,
                        padding: '7px 8px',
                        fontSize: 7,
                        lineHeight: 1.45,
                        boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
                        border: `1px solid ${persona.accentColor}40`,
                      }}
                      aria-label="実行プランのサンプル"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span style={{ fontSize: 9 }}>📝</span>
                        <span style={{ fontWeight: 800, fontSize: 7.5, letterSpacing: '0.02em' }}>
                          Notion に追加する
                        </span>
                      </div>
                      <div style={{ fontSize: 5.5, opacity: 0.7, marginBottom: 4 }}>
                        対象: Notion / 操作: append
                      </div>
                      {[
                        { n: 1, t: 'API トークンを確認' },
                        { n: 2, t: 'DB「振り返り」を検索' },
                        { n: 3, t: '新規ページを作成' },
                        { n: 4, t: 'プロパティを設定' },
                        { n: 5, t: '本文をブロックで挿入' },
                      ].map(s => (
                        <div
                          key={s.n}
                          style={{
                            display: 'flex', gap: 4, alignItems: 'flex-start',
                            marginBottom: 1.5, fontSize: 6,
                          }}
                        >
                          <span
                            style={{
                              flexShrink: 0, width: 9, height: 9, borderRadius: '50%',
                              background: `${persona.accentColor}30`, color: persona.accentColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 5.5, fontWeight: 800,
                            }}
                          >
                            {s.n}
                          </span>
                          <span style={{ opacity: 0.88 }}>{s.t}</span>
                        </div>
                      ))}
                      <div
                        style={{
                          marginTop: 4, paddingTop: 3,
                          borderTop: '1px dashed var(--border)',
                          fontSize: 5.5, opacity: 0.65, textAlign: 'right',
                        }}
                      >
                        Claude にコピペで実行 →
                      </div>
                    </div>
                  }
                />

                {/* Mode toggle */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                  {(['nl', 'form'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: mode === m ? persona.accentColor : 'transparent',
                        color: mode === m ? '#fff' : 'var(--fg-muted)',
                      }}
                    >
                      {m === 'nl' ? '🗣️ 自然言語で依頼' : '🛠 詳細を選んで依頼'}
                    </button>
                  ))}
                </div>

                {/* ── 自然言語モード ── */}
                {mode === 'nl' && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-fg text-sm font-medium mb-2">🗣️ やりたいことを 1 行で</p>
                      <textarea
                        value={nlText}
                        onChange={e => setNlText(e.target.value)}
                        placeholder="やりたいことを書いてください (例: Notion の議事録 DB に今日のメモを追加) — 他にも Linear にバグを Issue 化 / Asana に ToDo を 5 件作って / Calendly の商談 URL 発行 など"
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg text-sm text-fg resize-none"
                        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', minHeight: 88 }}
                      />
                      <p className="text-fg-subtle text-xs mt-1.5">
                        AI が対象 SaaS と操作・必要パラメータを推定し、そのまま実行プランを生成します。
                      </p>
                    </div>

                    {intent && (
                      <div
                        className="p-3 rounded-xl text-xs"
                        style={{
                          background: persona.accentColorLight,
                          border: `1px solid ${persona.accentColor}40`,
                          color: 'var(--fg)',
                        }}
                      >
                        <p>
                          <span className="font-semibold">AI 推定:</span>{' '}
                          {TARGET_EMOJI[intent.target]} {TARGET_LABELS[intent.target]} / {intent.action}
                          <span className="ml-2 text-fg-muted">({intent.confidence})</span>
                        </p>
                        {intent.rationale && (
                          <p className="text-fg-muted mt-1">理由: {intent.rationale}</p>
                        )}
                      </div>
                    )}

                    <ApiErrorCard error={error} onRetry={handleInferAndGenerate} variant="auto" />

                    <motion.button
                      onClick={handleInferAndGenerate}
                      disabled={busy || !nlText.trim()}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                      style={{
                        background: busy || !nlText.trim()
                          ? 'var(--surface-3)'
                          : `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)`,
                        color: busy || !nlText.trim() ? 'var(--fg-muted)' : '#fff',
                        minHeight: 48,
                      }}
                      whileHover={!busy && nlText.trim() ? { scale: 1.01 } : {}}
                      whileTap={!busy && nlText.trim() ? { scale: 0.99 } : {}}
                    >
                      {busy ? 'いまの状況を読み取り、プランを組み立てています…' : '✨ AI に推定させて実行プラン生成'}
                    </motion.button>
                  </div>
                )}

                {/* ── 詳細モード (デモ + 手動指定) ── */}
                {mode === 'form' && (
                  <>
                    {/* Demo scenarios */}
                    <div>
                      <p className="text-fg text-sm font-medium mb-2">💡 デモシナリオから選ぶ</p>
                      <div className="space-y-2">
                        {DEMO_SCENARIOS.map(s => (
                          <motion.button
                            key={s.id}
                            onClick={() => handleDemoSelect(s)}
                            className="w-full text-left p-3 rounded-xl transition-all"
                            style={{
                              background: payload === s.payload ? persona.accentColorLight : 'var(--surface-3)',
                              border: `1px solid ${payload === s.payload ? persona.accentColor + '60' : 'var(--border)'}`,
                              minHeight: 48,
                            }}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <p className="text-fg text-sm font-medium">{s.emoji} {s.label}</p>
                            <p className="text-fg-muted text-xs mt-0.5">{s.desc}</p>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                      <span className="text-fg-muted text-xs">または手動指定</span>
                      <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                    </div>

                    {/* Target + Action selectors */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-fg-muted text-xs mb-1">対象 SaaS</p>
                        <select
                          value={target}
                          onChange={e => setTarget(e.target.value as SaasTarget)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm text-fg"
                          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', minHeight: 44, fontSize: 16 }}
                        >
                          {TARGET_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-fg-muted text-xs mb-1">操作</p>
                        <select
                          value={action}
                          onChange={e => setAction(e.target.value as SaasAction)}
                          className="w-full px-3 py-2.5 rounded-lg text-sm text-fg"
                          style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', minHeight: 44, fontSize: 16 }}
                        >
                          {ACTION_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Permissions note */}
                    <div
                      className="p-2.5 rounded-lg text-xs"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                    >
                      <p>
                        <span style={{ color: persona.accentColor }}>✓ できること:</span> {TARGET_PERMISSIONS[target].does}
                      </p>
                      <p className="mt-0.5">
                        <span style={{ color: '#a0a0c0' }}>× 取得しません:</span> {TARGET_PERMISSIONS[target].doesNot}
                      </p>
                    </div>

                    {/* Payload textarea */}
                    <div>
                      <p className="text-fg-muted text-xs mb-1">やりたいことを自然語で入力</p>
                      <textarea
                        value={payload}
                        onChange={e => setPayload(e.target.value)}
                        placeholder={`例: 今週の商談を HubSpot に 5 件作って、それぞれ「提案中」ステージに設定してください。`}
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg text-sm text-fg resize-none"
                        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', fontSize: 16 }}
                      />
                    </div>

                    <ApiErrorCard error={error} onRetry={handleGenerate} variant="auto" />

                    <motion.button
                      onClick={handleGenerate}
                      disabled={busy || !payload.trim()}
                      className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
                      style={{
                        background: busy || !payload.trim()
                          ? 'var(--surface-3)'
                          : `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)`,
                        color: busy || !payload.trim() ? 'var(--fg-muted)' : '#fff',
                        minHeight: 48,
                      }}
                      whileHover={!busy && payload.trim() ? { scale: 1.01 } : {}}
                      whileTap={!busy && payload.trim() ? { scale: 0.99 } : {}}
                    >
                      {busy ? '実行プランを組み立てています…' : '✨ 実行プランを生成'}
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}

            {/* ── STEP 2: PLAN ── */}
            {step === 'plan' && result && (
              <motion.div
                key="plan"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg text-sm font-medium">
                    {TARGET_EMOJI[result.target]} {TARGET_LABELS[result.target]} — {result.estimatedSteps} ステップ
                  </p>
                  <button
                    onClick={() => setStep('input')}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-surface-3 text-fg-muted"
                  >
                    ← 戻る
                  </button>
                </div>

                {/* Execution Plan */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg text-sm font-medium">📋 実行プラン</p>
                    <button
                      onClick={() => copyText(result.planMarkdown, 'plan')}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        background: copied === 'plan' ? persona.accentColorLight : 'var(--surface)',
                        border: `1px solid ${copied === 'plan' ? persona.accentColor + '60' : 'var(--border)'}`,
                        color: copied === 'plan' ? persona.accentColor : 'var(--fg-muted)',
                      }}
                    >
                      {copied === 'plan' ? '✓ コピー済み' : '📋 コピー'}
                    </button>
                  </div>
                  <pre
                    className="text-fg-muted text-xs whitespace-pre-wrap font-mono leading-relaxed"
                    style={{ maxHeight: '200px', overflowY: 'auto' }}
                  >
                    {result.planMarkdown}
                  </pre>
                </div>

                {/* MCP Script — 大きな「Claude にコピー」ボタン */}
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: `${persona.accentColor}0a`,
                    border: `1px solid ${persona.accentColor}30`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-fg text-sm font-medium">🤖 Claude チャット用スクリプト</p>
                  </div>
                  <pre
                    className="text-xs whitespace-pre-wrap font-mono leading-relaxed mb-3"
                    style={{ color: persona.accentColor, maxHeight: '160px', overflowY: 'auto' }}
                  >
                    {result.mcpScript}
                  </pre>
                  <motion.button
                    onClick={() => copyText(result.mcpScript, 'script')}
                    className="w-full py-3.5 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2"
                    style={{
                      background: copied === 'script' ? persona.accentColor : `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}dd)`,
                      color: '#fff',
                      minHeight: 52,
                      boxShadow: copied === 'script' ? 'none' : `0 4px 16px ${persona.accentColor}40`,
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {copied === 'script' ? '✓ コピー済み！Claude に貼り付けて下さい' : '📋 Claude にコピー'}
                  </motion.button>
                </div>

                {/* AgentTaskQueue 委任 */}
                <motion.button
                  onClick={handleDelegateToCoo}
                  disabled={delegated}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  style={{
                    background: delegated ? '#4ade8030' : 'var(--surface-3)',
                    color: delegated ? '#4ade80' : 'var(--fg)',
                    border: `1px solid ${delegated ? '#4ade8060' : 'var(--border)'}`,
                    minHeight: 48,
                  }}
                  whileHover={!delegated ? { scale: 1.01 } : {}}
                  whileTap={!delegated ? { scale: 0.99 } : {}}
                >
                  {delegated
                    ? '✓ COO に委任しました (AgentTeamMonitor で進捗確認)'
                    : '🏃 このプランを COO に委任 (AgentTaskQueue へ提案)'}
                </motion.button>

                <motion.button
                  onClick={() => setStep('guide')}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)`, minHeight: 48 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Claude チャットで実行する方法を見る →
                </motion.button>
              </motion.div>
            )}

            {/* ── STEP 3: GUIDE ── */}
            {step === 'guide' && result && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-fg text-sm font-medium">🚀 Claude チャットで実行する手順</p>
                  <button
                    onClick={() => setStep('plan')}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-surface-3 text-fg-muted"
                  >
                    ← プランに戻る
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      step: 1,
                      title: 'MCP コネクターを有効化',
                      desc: `${MCP_CONNECTOR_HINT[result.target]}`,
                      emoji: '🔌',
                    },
                    {
                      step: 2,
                      title: 'Claude チャットを開く',
                      desc: 'claude.ai/new で新しいチャットを開いてください。',
                      emoji: '💬',
                    },
                    {
                      step: 3,
                      title: 'スクリプトを貼り付けて送信',
                      desc: '「Claude にコピー」ボタンでコピーしたテキストをチャットに貼り付けて送信すると、AI が MCP ツールを呼び出して自動実行します。',
                      emoji: '📋',
                    },
                  ].map(item => (
                    <div
                      key={item.step}
                      className="flex gap-3 p-3 rounded-xl"
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: persona.accentColorLight, color: persona.accentColor }}
                      >
                        {item.step}
                      </div>
                      <div>
                        <p className="text-fg text-sm font-medium">{item.emoji} {item.title}</p>
                        <p className="text-fg-muted text-xs mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  className="p-3 rounded-xl text-xs"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                >
                  <p className="font-medium text-fg mb-1">⚡ Phase 7 ロードマップ</p>
                  <p>将来は Vercel プロキシ経由で MCP-over-HTTP を直接呼び出し、このアプリ内で SaaS 操作が完結する予定です。</p>
                </div>

                {/* Re-copy button */}
                <motion.button
                  onClick={() => copyText(result.mcpScript, 'script')}
                  className="w-full py-3.5 rounded-xl font-bold text-base transition-all"
                  style={{
                    background: copied === 'script' ? persona.accentColor : `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}dd)`,
                    color: '#fff',
                    minHeight: 52,
                    boxShadow: copied === 'script' ? 'none' : `0 4px 16px ${persona.accentColor}40`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {copied === 'script' ? '✓ コピー済み！' : '📋 Claude にもう一度コピー'}
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
