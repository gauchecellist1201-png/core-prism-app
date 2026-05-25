import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings, Persona } from '../types/identity';
import { estimateMonthlyCost } from '../hooks/useClaude';
import { OPENAI_VOICE_OPTIONS, isOpenAITTSConfigured, type OpenAIVoice } from '../lib/ttsOpenAI';
import { resetOnboarding } from '../lib/onboarding';
import IntegrationsHub from './IntegrationsHub';
import BillingDashboard from './BillingDashboard';
import OrgPanel from './OrgPanel';
import { useBillingUser } from '../lib/billing';
import { INDUSTRY_LIST, type IndustryId } from '../prism/industryPacks';
import { isSoundEnabled, setSoundEnabled, playChime, tactileTap } from '../lib/haptic';
import { isTelemetryOptedIn, setTelemetryOptIn } from '../lib/errorCapture';
import { confirmAction } from '../lib/confirmDialog';

interface Props {
  settings: AppSettings;
  onSave: (s: Partial<AppSettings>) => void;
  onClose: () => void;
  onResetStats: () => void;
  /** ペルソナ一覧 (省略可。あれば「人格」タブで一覧+編集ボタン表示) */
  personas?: Persona[];
  /** 編集ボタン押下時の handler。クリック後 SettingsModal は閉じ、PersonaCreator が edit mode で開く */
  onEditPersona?: (id: string) => void;
}

// オーナー指示 (2026-05-15): Sonnet/Opus は Studio (¥29,800/月以上) 限定。
// 一般プランは Haiku のみ。サーバー側 (api/ai.ts) でも強制ガード済。
const MODELS = [
  { id: 'claude-haiku-4-5', name: 'Haiku 4.5', note: '速くて軽い (全プラン)', input: 1.0, output: 5.0 },
  { id: 'claude-sonnet-4-5', name: 'Sonnet 4.5', note: 'バランス型 (Studio 限定)', input: 3.0, output: 15.0, studioOnly: true },
  { id: 'claude-opus-4-5', name: 'Opus 4.5', note: '最高性能 (Studio 限定)', input: 5.0, output: 25.0, studioOnly: true },
];

// ── 5 タブ構造 ───────────────────────────────────────
type Tab = 'basic' | 'ai' | 'integrations' | 'privacy' | 'other';
const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'ai', label: 'AI' },
  { id: 'integrations', label: '連携' },
  { id: 'privacy', label: 'プライバシー' },
  { id: 'other', label: 'その他' },
];

// ── 「最近変えた」を localStorage で track ──────────────
const RECENT_KEY = 'core_settings_recent_v1';
const RECENT_MAX = 5;

interface RecentEntry {
  id: string;     // 設定行 ID (例: 'theme', 'tone')
  tab: Tab;       // 飛び先タブ
  label: string;  // 表示用ラベル
  at: number;     // 触った時刻 (UNIX ms)
}

function getRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function pushRecent(entry: Omit<RecentEntry, 'at'>): void {
  try {
    const prev = getRecent().filter(e => e.id !== entry.id);
    const next: RecentEntry[] = [{ ...entry, at: Date.now() }, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* */ }
}

// ── 検索の対象 (フラット化) ──────────────────────────
interface SearchableRow {
  id: string;
  tab: Tab;
  label: string;
  desc: string;
  keywords: string;
}

const SEARCH_INDEX: SearchableRow[] = [
  { id: 'userName', tab: 'basic', label: 'お名前', desc: 'AI が呼びかけるときに使う名前', keywords: 'name namae 名前 ニックネーム' },
  { id: 'owner', tab: 'basic', label: 'Owner モード', desc: '全機能解放のオーナーキー', keywords: 'owner master オーナー 鍵' },
  { id: 'language', tab: 'basic', label: '表示言語', desc: 'UI の言語 (日本語 / 英語 / 中国語)', keywords: 'language ja en zh 言語' },
  { id: 'sound', tab: 'basic', label: '効果音', desc: 'タップ音・完了チャイム', keywords: 'sound chime 音 効果音' },
  { id: 'fontSize', tab: 'basic', label: 'フォントサイズ', desc: '画面全体の文字サイズ', keywords: 'font size 文字 フォント' },
  { id: 'reduceMotion', tab: 'basic', label: 'アニメーションを控えめに', desc: '動きを減らす (酔いやすい方向け)', keywords: 'motion animation reduce アニメーション 動き' },
  { id: 'tour', tab: 'basic', label: 'ガイドツアーを再表示', desc: 'オンボーディングを最初から', keywords: 'tour guide ガイド ツアー オンボーディング' },
  { id: 'org', tab: 'basic', label: '組織', desc: 'メンバー招待・ロール管理', keywords: 'organization team org 組織 招待' },
  { id: 'plan', tab: 'basic', label: 'プラン', desc: 'サブスクリプションプラン', keywords: 'plan billing プラン 課金' },

  { id: 'tone', tab: 'ai', label: 'AI の文体', desc: 'やさしく / プロ調 / カジュアル', keywords: 'tone 文体 やさしい' },
  { id: 'model', tab: 'ai', label: '優先モデル', desc: 'Haiku / Sonnet / Opus', keywords: 'model haiku sonnet opus モデル' },
  { id: 'industry', tab: 'ai', label: '業種', desc: 'AI 提案を業界に最適化', keywords: 'industry 業種 業界' },
  { id: 'apiKey', tab: 'ai', label: 'AI キー (Gemini / Claude)', desc: '無料 Gemini キーで AI を動かす', keywords: 'api key gemini claude キー' },
  { id: 'voiceTTS', tab: 'ai', label: '音声読み上げ', desc: 'AI 応答を声で再生', keywords: 'voice tts 音声 読み上げ' },
  { id: 'personas', tab: 'ai', label: '人格 (Persona)', desc: '登録済みの人格を編集', keywords: 'persona 人格 ペルソナ' },

  { id: 'integrations', tab: 'integrations', label: '連携 (Gmail / Calendar / Stripe / Notion)', desc: '外部サービスとつなぐ', keywords: 'integration gmail calendar stripe notion 連携' },

  { id: 'telemetry', tab: 'privacy', label: 'エラー報告を送る (匿名)', desc: '画面エラーを匿名でチームに送る', keywords: 'telemetry error 匿名 エラー' },
  { id: 'errorLog', tab: 'privacy', label: '不具合ログを見る', desc: '直近 50 件のエラー履歴', keywords: 'log error ログ 不具合' },
  { id: 'cloudSync', tab: 'privacy', label: 'クラウド同期', desc: '(準備中)', keywords: 'cloud sync 同期' },
  { id: 'deleteKeys', tab: 'privacy', label: 'API キーを削除', desc: '保存中の AI キーを全削除', keywords: 'delete api key 削除' },

  { id: 'version', tab: 'other', label: 'バージョン情報', desc: 'アプリのバージョン', keywords: 'version バージョン' },
  { id: 'usage', tab: 'other', label: '使用統計', desc: 'メッセージ数・トークン・コスト', keywords: 'usage stats 統計 使用量' },
  { id: 'resetStats', tab: 'other', label: '使用統計をリセット', desc: '集計をゼロから', keywords: 'reset リセット 統計' },
  { id: 'feedback', tab: 'other', label: 'フィードバックを送る', desc: '改善のお願い', keywords: 'feedback フィードバック' },
];

// ── ファジー検索 (簡易) ──────────────────────────────
function fuzzyFilter(q: string, rows: SearchableRow[]): SearchableRow[] {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/);
  return rows.filter(r => {
    const hay = `${r.label} ${r.desc} ${r.keywords}`.toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}

// ── localStorage で track する UI 設定 ──────────────
const FONT_SIZE_KEY = 'core_ui_font_size_v1';
const REDUCE_MOTION_KEY = 'core_ui_reduce_motion_v1';
type FontSize = 'sm' | 'md' | 'lg';

function getFontSize(): FontSize {
  try { return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) || 'md'; } catch { return 'md'; }
}
function setFontSize(v: FontSize): void {
  try {
    localStorage.setItem(FONT_SIZE_KEY, v);
    document.documentElement.style.setProperty('--app-font-scale', v === 'sm' ? '0.92' : v === 'lg' ? '1.10' : '1');
  } catch { /* */ }
}
function getReduceMotion(): boolean {
  try { return localStorage.getItem(REDUCE_MOTION_KEY) === '1'; } catch { return false; }
}
function setReduceMotion(v: boolean): void {
  try {
    localStorage.setItem(REDUCE_MOTION_KEY, v ? '1' : '0');
    document.documentElement.dataset.reduceMotion = v ? '1' : '0';
  } catch { /* */ }
}

export default function SettingsModal({ settings, onSave, onClose, onResetStats, personas, onEditPersona }: Props) {
  const [apiKey, setApiKey] = useState(settings.claudeApiKey);
  const [model, setModel] = useState(settings.preferredModel);
  const [userName, setUserName] = useState(settings.userName);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showOrg, setShowOrg] = useState(false);
  const { user: billingUser } = useBillingUser();
  const [aiTone, setAiTone] = useState<'gentle' | 'professional' | 'casual'>(settings.aiTone || 'gentle');
  const [industry, setIndustry] = useState<IndustryId | ''>(settings.industry || '');
  const [voiceEnabled, setVoiceEnabled] = useState(settings.voiceEnabled !== false);
  const [uiLanguage, setUiLanguage] = useState<'ja' | 'en' | 'zh'>(settings.uiLanguage || 'ja');
  const [openaiVoice, setOpenaiVoice] = useState<OpenAIVoice>((settings as any).openaiVoice || 'nova');
  const openaiAvailable = isOpenAITTSConfigured();
  const [telemetryOptIn, setTelemetryOptInState] = useState(isTelemetryOptedIn());
  const [fontSize, setFontSizeState] = useState<FontSize>(getFontSize());
  const [reduceMotion, setReduceMotionState] = useState<boolean>(getReduceMotion());

  const [tab, setTab] = useState<Tab>('basic');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>(getRecent());

  const monthlyEst = estimateMonthlyCost(20, 800, 400, model);
  const jpy150 = (n: number) => Math.round(n * 150);

  // 「設定を触った」の記録ヘルパー
  const track = (id: string) => {
    const row = SEARCH_INDEX.find(r => r.id === id);
    if (!row) return;
    pushRecent({ id: row.id, tab: row.tab, label: row.label });
    setRecent(getRecent());
  };

  // 検索結果
  const searchResults = useMemo(() => fuzzyFilter(query, SEARCH_INDEX), [query]);
  const searching = query.trim().length > 0;

  // 検索結果クリックで対象タブへ
  const jumpTo = (row: SearchableRow) => {
    setTab(row.tab);
    setQuery('');
    track(row.id);
  };

  // モーダル開いたとき (検索で) 「/」キーでフォーカス
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSave = () => {
    onSave({
      claudeApiKey: apiKey,
      preferredModel: model as AppSettings['preferredModel'],
      userName,
      aiTone,
      voiceEnabled,
      uiLanguage,
      industry: (industry || undefined) as AppSettings['industry'],
      ...({ openaiVoice } as any),
    });
    onClose();
  };

  // ── 危険操作: 全 API キー削除 ──────────────────────
  const handleDeleteAllKeys = async () => {
    const ok = await confirmAction({
      title: '保存中の API キーを全削除しますか?',
      body: 'Gemini / Claude / OpenAI など、この端末に保存しているキーを消します。AI 機能は一時的に使えなくなります。',
      tone: 'danger',
      okLabel: '全部削除する',
    });
    if (!ok) return;
    try {
      localStorage.removeItem('core_gemini_api_key_v1');
      localStorage.removeItem('core_openai_api_key_v1');
    } catch { /* */ }
    setApiKey('');
    onSave({ claudeApiKey: '' });
    track('deleteKeys');
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg m-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#12121a',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: 'calc(100dvh - 2rem)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-fg text-sm font-light tracking-wide">環境設定</p>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl" style={{ minWidth: 44, minHeight: 44 }} aria-label="閉じる">×</button>
        </div>

        {/* 検索バー */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-3 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              minHeight: 40,
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>⌕</span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="設定を検索… (例: 文体、言語、API)"
              className="flex-1 bg-transparent text-fg outline-none"
              style={{ fontSize: 16, minHeight: 40 }} /* 16px+ で iOS auto-zoom 防止 */
              aria-label="設定を検索"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-neutral-600 hover:text-fg-subtle"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 4 }}
                aria-label="検索をクリア"
              >×</button>
            )}
          </div>
        </div>

        {/* タブ列 */}
        {!searching && (
          <div
            className="flex gap-1 px-5 pt-1 pb-0 flex-shrink-0"
            style={{ overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); tactileTap(); }}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  background: tab === id ? 'rgba(201,169,110,0.12)' : 'transparent',
                  color: tab === id ? '#c9a96e' : '#4a4a6a',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  minHeight: 36,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 「最近変えた」 — 検索中・基本タブ以外でも有用なので常時 (空のときは出さない) */}
        {!searching && recent.length > 0 && (
          <div className="px-5 pt-3 pb-1 flex-shrink-0">
            <p className="text-neutral-700 text-[10px] tracking-wider uppercase mb-1.5">最近変えた設定</p>
            <div className="flex gap-1.5 flex-wrap">
              {recent.map(r => (
                <button
                  key={r.id}
                  onClick={() => { setTab(r.tab); track(r.id); }}
                  className="text-[11px] px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: 'rgba(201,169,110,0.06)',
                    border: '1px solid rgba(201,169,110,0.18)',
                    color: '#c9a96e',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 本文 */}
        <div className="p-5 space-y-4 flex-1" style={{ minHeight: '320px', overflowY: 'auto' }}>
          {searching ? (
            <SearchResults results={searchResults} onJump={jumpTo} />
          ) : (
            <AnimatePresence mode="wait">
              {tab === 'basic' && (
                <motion.div key="basic" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <SettingRow label="お名前" desc="AI が呼びかけるときに使う名前">
                    <input
                      type="text"
                      value={userName}
                      onChange={e => { setUserName(e.target.value); track('userName'); }}
                      placeholder="あなたのお名前"
                      className="bg-transparent text-fg text-sm font-light outline-none border-b py-1 text-right"
                      style={{ borderColor: 'rgba(255,255,255,0.1)', minWidth: 140, fontSize: 16 }}
                    />
                  </SettingRow>

                  <MasterModeBox onChange={() => track('owner')} />

                  <SettingRow label="表示言語" desc="UI の言語">
                    <select
                      value={uiLanguage}
                      onChange={e => { setUiLanguage(e.target.value as 'ja' | 'en' | 'zh'); track('language'); }}
                      className="bg-transparent text-fg text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', fontSize: 16 }}
                    >
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                    </select>
                  </SettingRow>

                  <SoundToggleBox onChange={() => track('sound')} />

                  <SettingRow label="フォントサイズ" desc="画面全体の文字サイズ">
                    <div className="flex gap-1" role="radiogroup" aria-label="フォントサイズ">
                      {(['sm', 'md', 'lg'] as FontSize[]).map(s => (
                        <button
                          key={s}
                          role="radio"
                          aria-checked={fontSize === s}
                          onClick={() => { setFontSize(s); setFontSizeState(s); track('fontSize'); }}
                          className="px-2.5 py-1 rounded-md text-xs"
                          style={{
                            background: fontSize === s ? 'rgba(201,169,110,0.18)' : 'rgba(255,255,255,0.04)',
                            color: fontSize === s ? '#c9a96e' : 'rgba(255,255,255,0.6)',
                            border: `1px solid ${fontSize === s ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.08)'}`,
                            minHeight: 32,
                          }}
                        >
                          {s === 'sm' ? '小' : s === 'md' ? '中' : '大'}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <ToggleRow
                    label="アニメーションを控えめに"
                    desc="動きを減らす（酔いやすい方向け）"
                    on={reduceMotion}
                    onChange={(v) => { setReduceMotion(v); setReduceMotionState(v); track('reduceMotion'); }}
                  />

                  {/* 組織 + プラン */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setShowOrg(true); track('org'); }}
                      className="p-3 rounded-xl text-left transition-colors"
                      style={{
                        background: 'rgba(99,102,241,0.08)',
                        border: '1px solid rgba(99,102,241,0.2)',
                      }}
                    >
                      <div className="text-fg text-sm font-semibold">🏛️ 組織</div>
                      <div className="text-fg-muted text-xs mt-0.5">メンバー招待・ロール管理</div>
                    </button>
                    <button
                      onClick={() => { setShowBilling(true); track('plan'); }}
                      disabled={!billingUser}
                      className="p-3 rounded-xl text-left transition-colors disabled:opacity-40"
                      style={{
                        background: 'rgba(225,48,108,0.08)',
                        border: '1px solid rgba(225,48,108,0.2)',
                      }}
                    >
                      <div className="text-fg text-sm font-semibold">💳 プラン</div>
                      <div className="text-fg-muted text-xs mt-0.5">
                        {billingUser ? `現在: ${billingUser.plan}` : '登録後に利用可'}
                      </div>
                    </button>
                  </div>

                  <SettingRow label="ガイドツアーを再表示" desc="オンボーディングを最初から">
                    <motion.button
                      onClick={async () => {
                        const ok = await confirmAction({ title: 'ガイドを最初から表示しますか?', body: 'ページがリロードされます。' });
                        if (!ok) return;
                        resetOnboarding();
                        track('tour');
                        window.location.reload();
                      }}
                      className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '1px solid rgba(201,169,110,0.3)', minHeight: 32 }}
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    >
                      再表示
                    </motion.button>
                  </SettingRow>
                </motion.div>
              )}

              {tab === 'ai' && (
                <motion.div key="ai" className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* AI トーン (最重要なので最上部) */}
                  <CollapsibleSection title="AI の文体" defaultOpen>
                    <p className="text-fg-muted text-xs mb-3">提案・要約・返信ドラフトの語り口</p>
                    <div className="space-y-2">
                      {([
                        { v: 'gentle', t: '🌸 やさしく (推奨)', d: '一文短く、専門用語に必ず日本語補足' },
                        { v: 'professional', t: '💼 プロ調', d: '簡潔・論理的、断定的' },
                        { v: 'casual', t: '☕ カジュアル', d: 'フランクで親しみやすい' },
                      ] as const).map(opt => (
                        <button
                          key={opt.v}
                          onClick={() => { setAiTone(opt.v); track('tone'); }}
                          className="w-full text-left p-3 rounded-xl transition-all"
                          style={{
                            background: aiTone === opt.v ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${aiTone === opt.v ? 'rgba(180,124,252,0.50)' : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <p className="text-fg text-sm font-light">{opt.t}</p>
                          <p className="text-fg-muted text-xs mt-0.5">{opt.d}</p>
                        </button>
                      ))}
                    </div>
                  </CollapsibleSection>

                  {/* API キー */}
                  <CollapsibleSection title="AI キー (Gemini / Claude)" defaultOpen>
                    <ApiKeySetupBox
                      apiKey={apiKey}
                      setApiKey={(v) => { setApiKey(v); track('apiKey'); }}
                      apiKeyVisible={apiKeyVisible}
                      setApiKeyVisible={setApiKeyVisible}
                    />
                  </CollapsibleSection>

                  {/* モデル選択 */}
                  <CollapsibleSection title="優先モデル">
                    <p className="text-neutral-600 text-xs mb-2">20通/日の使用量で試算</p>
                    <div className="space-y-2">
                      {MODELS.map(m => {
                        const est = estimateMonthlyCost(20, 800, 400, m.id);
                        return (
                          <motion.button
                            key={m.id}
                            onClick={() => { setModel(m.id as typeof model); track('model'); }}
                            className="w-full text-left p-3 rounded-xl transition-all"
                            style={{
                              background: model === m.id ? 'rgba(201,169,110,0.08)' : 'rgba(255,255,255,0.02)',
                              border: `1px solid ${model === m.id ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.05)'}`,
                            }}
                            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-fg text-sm font-light">{m.name}</p>
                                <p className="text-neutral-500 text-xs">{m.note}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-light" style={{ color: '#c9a96e' }}>
                                  ¥{jpy150(est.usd)}/月
                                </p>
                                <p className="text-neutral-700 text-xs">${m.input}/${m.output} per MTok</p>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.1)' }}>
                      <p className="text-xs" style={{ color: '#c9a96e' }}>
                        選択中: {MODELS.find(m => m.id === model)?.name} — 月額 約¥{jpy150(monthlyEst.usd)}
                      </p>
                    </div>
                  </CollapsibleSection>

                  {/* 業種 */}
                  <CollapsibleSection title="業種">
                    <p className="text-fg-muted text-xs mb-3">業種を選ぶと AI がその業界の言葉で具体的に提案します</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {INDUSTRY_LIST.map(ind => (
                        <button
                          key={ind.id}
                          onClick={() => { setIndustry(ind.id); track('industry'); }}
                          className="text-left p-2.5 rounded-lg transition-all"
                          style={{
                            background: industry === ind.id ? 'rgba(201,169,110,0.10)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${industry === ind.id ? 'rgba(201,169,110,0.45)' : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{ind.emoji}</span>
                            <p className="text-fg text-xs font-medium">{ind.label}</p>
                          </div>
                          <p className="text-fg-muted text-[10px] mt-0.5 leading-snug">{ind.shortDescription}</p>
                        </button>
                      ))}
                    </div>
                    {industry && (
                      <button
                        onClick={() => { setIndustry(''); track('industry'); }}
                        className="text-[11px] text-neutral-600 hover:text-fg-subtle"
                      >
                        選択を解除する
                      </button>
                    )}
                  </CollapsibleSection>

                  {/* 音声読み上げ */}
                  <CollapsibleSection title="音声読み上げ">
                    <div className="p-3 rounded-xl mb-3" style={{
                      background: openaiAvailable ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${openaiAvailable ? 'rgba(180,124,252,0.40)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <p className="text-fg text-xs font-medium mb-1">
                        {openaiAvailable ? '🎤 OpenAI TTS が有効' : '🔒 ブラウザ標準音声で再生'}
                      </p>
                      <p className="text-fg-muted text-[11px] leading-relaxed">
                        {openaiAvailable
                          ? '自然な音声で読み上げます'
                          : 'VITE_OPENAI_API_KEY 設定で自然な音声に切替'}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={e => { setVoiceEnabled(e.target.checked); track('voiceTTS'); }}
                      />
                      <span className="text-fg text-sm">音声読み上げを有効にする</span>
                    </label>
                    {openaiAvailable && voiceEnabled && (
                      <div className="mt-3">
                        <p className="text-neutral-600 text-[11px] tracking-wider uppercase mb-2">声を選ぶ</p>
                        <div className="grid grid-cols-2 gap-2">
                          {OPENAI_VOICE_OPTIONS.map(v => (
                            <button
                              key={v.value}
                              onClick={() => { setOpenaiVoice(v.value); track('voiceTTS'); }}
                              className="text-left p-2.5 rounded-lg transition-all"
                              style={{
                                background: openaiVoice === v.value ? 'rgba(180,124,252,0.10)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${openaiVoice === v.value ? 'rgba(180,124,252,0.50)' : 'rgba(255,255,255,0.06)'}`,
                              }}
                            >
                              <p className="text-fg text-xs font-medium">{v.label}</p>
                              <p className="text-fg-muted text-[10px] mt-0.5">{v.tone}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleSection>

                  {/* 人格 */}
                  <CollapsibleSection title="人格 (Persona)">
                    <p className="text-xs text-fg-muted mb-2">登録済みの人格 (アイコン・名前・色の編集)</p>
                    {(!personas || personas.length === 0) ? (
                      <div className="text-xs text-fg-muted p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        まだ人格が作成されていません。ダッシュボードから「人格を追加」してください。
                      </div>
                    ) : personas.map(p => (
                      <div key={p.id}
                        className="flex items-center gap-3 p-3 rounded-xl mb-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: p.accentColor, color: '#0A0814',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, fontWeight: 700, flexShrink: 0,
                        }}>
                          {p.icon || '✦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-fg truncate">{p.name}</p>
                          <p className="text-xs text-fg-muted truncate">{p.subtitle || '—'}</p>
                        </div>
                        <button
                          onClick={() => { track('personas'); onEditPersona?.(p.id); }}
                          className="text-xs px-3 py-1.5 rounded-lg"
                          style={{
                            background: 'rgba(201,169,110,0.14)',
                            color: '#c9a96e',
                            border: '1px solid rgba(201,169,110,0.25)',
                            cursor: 'pointer',
                            minHeight: 32,
                          }}
                        >
                          編集
                        </button>
                      </div>
                    ))}
                  </CollapsibleSection>
                </motion.div>
              )}

              {tab === 'integrations' && (
                <motion.div key="integ" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-fg-muted text-xs leading-relaxed">
                    Gmail / Calendar / Stripe / Notion などをつなぐと AI が情報を活用できます。
                  </p>
                  <IntegrationsHub />
                </motion.div>
              )}

              {tab === 'privacy' && (
                <motion.div key="privacy" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <label
                    className="flex items-start gap-3 p-3 rounded-xl cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', minHeight: 44 }}
                  >
                    <input
                      type="checkbox"
                      checked={telemetryOptIn}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setTelemetryOptInState(v);
                        setTelemetryOptIn(v);
                        track('telemetry');
                      }}
                      style={{ width: 18, height: 18, accentColor: '#A78BFA', cursor: 'pointer', marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="text-fg text-sm font-medium">エラー報告を送る (匿名)</div>
                      <div className="text-fg-muted text-[11px] mt-1 leading-relaxed">
                        画面エラーを匿名でチームに送り、改善に使います。入力内容・メアドは送りません。
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() => { window.dispatchEvent(new CustomEvent('core:open-error-log')); track('errorLog'); }}
                    className="w-full text-left p-3 rounded-xl transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <div className="text-fg text-sm font-medium">不具合ログを見る</div>
                    <div className="text-fg-muted text-[11px] mt-1">画面で起きたエラーを直近 50 件まで保存</div>
                  </button>

                  {/* クラウド同期 (準備中) */}
                  <div
                    className="p-3 rounded-xl flex items-center justify-between gap-3"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      opacity: 0.65,
                    }}
                  >
                    <div>
                      <div className="text-fg text-sm font-medium">クラウド同期</div>
                      <div className="text-fg-muted text-[11px] mt-1">複数端末で設定を同期</div>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >準備中</span>
                  </div>

                  {/* 危険操作: API キー削除 */}
                  <button
                    type="button"
                    onClick={handleDeleteAllKeys}
                    className="w-full text-left p-3 rounded-xl transition-colors"
                    style={{
                      background: 'rgba(248,113,113,0.06)',
                      border: '1px solid rgba(248,113,113,0.25)',
                      cursor: 'pointer',
                      minHeight: 44,
                    }}
                  >
                    <div className="text-sm font-medium" style={{ color: '#F87171' }}>API キーを削除</div>
                    <div className="text-fg-muted text-[11px] mt-1">保存中の Gemini / Claude キーを全部消す</div>
                  </button>
                </motion.div>
              )}

              {tab === 'other' && (
                <motion.div key="other" className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* 使用統計 */}
                  <CollapsibleSection title="使用統計" defaultOpen>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: '総メッセージ数', value: `${settings.usageStats.totalMessages}通` },
                        { label: '総トークン数', value: `${(settings.usageStats.totalTokensUsed / 1000).toFixed(1)}K` },
                        { label: 'API使用コスト', value: `$${settings.usageStats.estimatedCostUsd.toFixed(4)}` },
                        { label: '円換算', value: `¥${Math.round(settings.usageStats.estimatedCostUsd * 150)}` },
                      ].map(item => (
                        <div key={item.label} className="p-2.5 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                        >
                          <p className="text-neutral-600 text-[10px] mb-1">{item.label}</p>
                          <p className="text-fg text-sm font-extralight">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-neutral-700 text-[10px]">
                      集計開始: {new Date(settings.usageStats.lastReset).toLocaleDateString('ja-JP')}
                    </p>
                    <button
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: '使用統計をリセットしますか?',
                          body: 'これまでに記録したメッセージ数・トークン・コストを 0 にします。',
                          tone: 'danger',
                          okLabel: 'リセットする',
                        });
                        if (!ok) return;
                        onResetStats();
                        track('resetStats');
                      }}
                      className="mt-2 w-full text-left p-3 rounded-xl"
                      style={{
                        background: 'rgba(248,113,113,0.06)',
                        border: '1px solid rgba(248,113,113,0.25)',
                        cursor: 'pointer',
                        minHeight: 44,
                      }}
                    >
                      <div className="text-sm font-medium" style={{ color: '#F87171' }}>使用統計をリセット</div>
                      <div className="text-fg-muted text-[11px] mt-1">集計を最初からやり直す</div>
                    </button>
                  </CollapsibleSection>

                  {/* モデル料金 */}
                  <CollapsibleSection title="モデル別料金 (参考)">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-neutral-700">
                          <td>モデル</td><td className="text-right">Input</td><td className="text-right">Output</td>
                        </tr>
                      </thead>
                      <tbody className="text-fg-subtle">
                        {MODELS.map(m => (
                          <tr key={m.id}>
                            <td className="py-0.5">{m.name}</td>
                            <td className="text-right">${m.input}/MTok</td>
                            <td className="text-right">${m.output}/MTok</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-neutral-700 text-[10px] mt-2">キャッシュ読込: 90% 引き</p>
                  </CollapsibleSection>

                  {/* バージョン情報 */}
                  <div className="p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <p className="text-neutral-600 text-[10px] mb-0.5">バージョン</p>
                    <p className="text-fg text-sm font-light">CORE Prism / Iris</p>
                    <p className="text-fg-muted text-[11px] mt-0.5">
                      {new Date().getFullYear()} 株式会社CORE
                    </p>
                  </div>

                  {/* フィードバック */}
                  <button
                    type="button"
                    onClick={() => { window.dispatchEvent(new CustomEvent('core:open-feedback')); track('feedback'); }}
                    className="w-full text-left p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', minHeight: 44 }}
                  >
                    <div className="text-fg text-sm font-medium">フィードバックを送る</div>
                    <div className="text-fg-muted text-[11px] mt-1">「ここ使いづらい」を直接届ける</div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 px-5 pb-5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-600 hover:text-fg-subtle transition-colors" style={{ minHeight: 40 }}>
            キャンセル
          </button>
          <motion.button
            onClick={handleSave}
            className="px-6 py-2 rounded-lg text-sm font-light"
            style={{ background: 'linear-gradient(135deg, #c9a96e, #a07840)', color: '#0a0a0f', minHeight: 40 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          >
            保存
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showBilling && <BillingDashboard key="bd" onClose={() => setShowBilling(false)} />}
        {showOrg && (
          <OrgPanel
            key="op"
            brand={typeof window !== 'undefined' && window.location.pathname.startsWith('/iris') ? 'iris' : 'prism'}
            onClose={() => setShowOrg(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── 共通: 3 列の設定行 (ラベル + 説明 + コントロール右寄せ) ──
function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 p-3 rounded-xl transition-colors hover:bg-white/[0.03]"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', minHeight: 56 }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-fg text-sm">{label}</p>
        {desc && <p className="text-neutral-600 text-xs mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ── トグル行 ─────────────────────────────────
function ToggleRow({ label, desc, on, onChange }: { label: string; desc?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <SettingRow label={label} desc={desc}>
      <button
        onClick={() => { onChange(!on); tactileTap(); }}
        aria-label={`${label}を${on ? 'オフ' : 'オン'}にする`}
        aria-pressed={on}
        className="relative flex-shrink-0 rounded-full transition-colors"
        style={{
          width: 46, height: 26,
          background: on ? 'linear-gradient(135deg, #c9a96e, #a07840)' : 'rgba(255,255,255,0.12)',
        }}
      >
        <motion.span
          className="absolute rounded-full"
          style={{ top: 3, left: 3, width: 20, height: 20, background: '#fff' }}
          animate={{ x: on ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      </button>
    </SettingRow>
  );
}

// ── 折り畳みセクション ──────────────────────
function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <button
        onClick={() => { setOpen(o => !o); tactileTap(); }}
        className="w-full flex items-center justify-between p-3 transition-colors"
        style={{ cursor: 'pointer', background: 'transparent', minHeight: 44 }}
        aria-expanded={open}
      >
        <p className="text-fg text-sm font-medium">{title}</p>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}
        >›</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 検索結果一覧 ─────────────────────────────
function SearchResults({ results, onJump }: { results: SearchableRow[]; onJump: (row: SearchableRow) => void }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-10 text-fg-muted text-sm">
        該当する設定が見つかりません
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-neutral-700 text-[10px] tracking-wider uppercase mb-1">検索結果 {results.length} 件</p>
      {results.map(r => (
        <button
          key={r.id}
          onClick={() => onJump(r)}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', minHeight: 56, cursor: 'pointer' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-fg text-sm">{r.label}</p>
            <p className="text-neutral-600 text-xs mt-0.5">{r.desc}</p>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'rgba(201,169,110,0.10)', color: '#c9a96e', border: '1px solid rgba(201,169,110,0.25)' }}
          >
            {TABS.find(t => t.id === r.tab)?.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── AI キー設定ボックス ──────────────────────
function ApiKeySetupBox({
  apiKey, setApiKey, apiKeyVisible, setApiKeyVisible,
}: {
  apiKey: string;
  setApiKey: (s: string) => void;
  apiKeyVisible: boolean;
  setApiKeyVisible: (b: boolean) => void;
}) {
  const GEMINI_KEY = 'core_gemini_api_key_v1';
  const [geminiKey, setGeminiKeyState] = useState<string>(() => {
    try { return localStorage.getItem(GEMINI_KEY) || ''; } catch { return ''; }
  });
  const [geminiVisible, setGeminiVisible] = useState(false);
  const [saved, setSaved] = useState<'gemini' | 'claude' | null>(null);

  const saveGemini = (v: string) => {
    setGeminiKeyState(v);
    try {
      if (v) localStorage.setItem(GEMINI_KEY, v);
      else localStorage.removeItem(GEMINI_KEY);
    } catch { /* */ }
    if (v) { setSaved('gemini'); setTimeout(() => setSaved(null), 2000); }
  };

  const hasGemini = !!geminiKey;
  const hasClaude = !!apiKey && apiKey !== 'proxy';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 状態表示 */}
      <div style={{
        padding: '0.85rem 1rem', borderRadius: 14,
        background: hasGemini || hasClaude
          ? 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(74,222,128,0.06))'
          : 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(248,113,113,0.06))',
        border: `1px solid ${hasGemini || hasClaude ? 'rgba(16,185,129,0.30)' : 'rgba(251,191,36,0.30)'}`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)', marginBottom: 2 }}>
          {hasGemini || hasClaude ? '✓ AI 鍵が登録済み' : '⚠ AI 鍵が未登録 — AI 機能が使えません'}
        </p>
        <p style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.65 }}>
          {hasGemini || hasClaude
            ? `${[hasGemini && 'Gemini', hasClaude && 'Claude'].filter(Boolean).join(' / ')} で AI が動作`
            : '無料の Gemini キーを 1 分で取得 → 下に貼り付けるだけ'}
        </p>
      </div>

      {/* Gemini 鍵 (おすすめ・無料) */}
      <div style={{
        padding: '1rem', borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg)' }}>
            🌟 Gemini キー <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700, marginLeft: 6 }}>無料・おすすめ</span>
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 11, fontWeight: 800, padding: '6px 12px', borderRadius: 999,
              background: 'linear-gradient(135deg, #4285F4, #34A853)',
              color: '#fff', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >無料で取得 →</a>
        </div>
        <p style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.65, marginBottom: 8 }}>
          aistudio.google.com で Google アカウントでログイン → 「Create API key」→ <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 4, fontFamily: 'monospace' }}>AIzaSy...</code> を下に貼り付け
        </p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <input
            type={geminiVisible ? 'text' : 'password'}
            value={geminiKey}
            onChange={(e) => saveGemini(e.target.value.trim())}
            placeholder="AIzaSy..."
            className="flex-1 bg-transparent text-fg font-mono outline-none"
            style={{ minHeight: 28, fontSize: 16 }}
          />
          <button onClick={() => setGeminiVisible(!geminiVisible)}
            className="text-neutral-600 text-xs hover:text-fg-subtle"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {geminiVisible ? '隠す' : '表示'}
          </button>
        </div>
        {saved === 'gemini' && (
          <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700, marginTop: 6 }}>
            ✓ 保存しました — もう AI 機能が使えます
          </p>
        )}
      </div>

      {/* Claude 鍵 (有料・高品質) */}
      <details style={{ fontSize: 12 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--fg-muted)', padding: 4 }}>
          🎯 Claude キーを登録 (有料・高品質) — 上級者向け
        </summary>
        <div style={{ marginTop: 8, padding: '0.85rem 1rem', borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.65, marginBottom: 8 }}>
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer"
              style={{ color: '#A78BFA', textDecoration: 'underline' }}>console.anthropic.com</a> で
            「Settings → API Keys → Create Key」→ <code>sk-ant-...</code> を貼り付け
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
            <input type={apiKeyVisible ? 'text' : 'password'} value={apiKey === 'proxy' ? '' : apiKey}
              onChange={e => setApiKey(e.target.value.trim())}
              placeholder="sk-ant-..."
              className="flex-1 bg-transparent text-fg font-mono outline-none"
              style={{ fontSize: 16 }}
            />
            <button onClick={() => setApiKeyVisible(!apiKeyVisible)}
              className="text-neutral-600 text-xs hover:text-fg-subtle"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              {apiKeyVisible ? '隠す' : '表示'}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

// 効果音の ON/OFF
function SoundToggleBox({ onChange }: { onChange?: () => void }) {
  const [on, setOn] = useState(() => isSoundEnabled());
  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) playChime('success');
    else tactileTap();
    onChange?.();
  };
  return (
    <ToggleRow
      label="効果音"
      desc={on ? 'タップ・完了でやわらかな音' : '音を消しています（振動だけ残ります）'}
      on={on}
      onChange={() => toggle()}
    />
  );
}

function MasterModeBox({ onChange }: { onChange?: () => void }) {
  // Phase D: マスターモード → Owner ロールに改名。
  const KEY = 'core_master_key_v1';
  const [code, setCode] = useState(() => localStorage.getItem(KEY) || '');
  const [edit, setEdit] = useState(false);
  const isOwner = code === 'GAUCHE2026';

  const apply = () => {
    localStorage.setItem(KEY, code);
    setEdit(false);
    onChange?.();
    setTimeout(() => window.location.reload(), 200);
  };
  const clear = async () => {
    const ok = await confirmAction({
      title: 'Owner モードを解除しますか?',
      body: '全機能アクセスが切れます。再度有効にするにはキーの入力が必要です。',
      tone: 'danger',
      okLabel: '解除する',
    });
    if (!ok) return;
    localStorage.removeItem(KEY);
    setCode('');
    setEdit(false);
    onChange?.();
    setTimeout(() => window.location.reload(), 200);
  };

  return (
    <div className="p-4 rounded-xl" style={{
      background: isOwner
        ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,107,53,0.10))'
        : 'rgba(255,255,255,0.03)',
      border: `1px solid ${isOwner ? 'rgba(255,215,0,0.35)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-fg text-sm font-medium">
          {isOwner ? '👑 Owner モード ON (Claude API · 全機能解放)' : '⚙ Owner モード'}
        </p>
        {isOwner && (
          <button onClick={clear}
            className="text-xs px-2 py-1 rounded-full"
            style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171', border: '1px solid rgba(248,113,113,0.3)' }}>
            解除
          </button>
        )}
      </div>
      {isOwner ? (
        <p className="text-fg-muted text-xs leading-relaxed">
          ワークスペースの Owner として全機能アクセス中。AI は Anthropic Claude で動作。
        </p>
      ) : edit ? (
        <div className="space-y-2">
          <input
            type="text" value={code} onChange={e => setCode(e.target.value)}
            placeholder="Owner キーを入力"
            className="w-full bg-transparent text-fg font-mono outline-none border-b py-2"
            style={{ borderColor: 'rgba(255,255,255,0.1)', fontSize: 16 }}
          />
          <div className="flex gap-2">
            <button onClick={apply} disabled={!code.trim()}
              className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #FFD60A, #FF8A1A)', color: '#1F1A2E', fontWeight: 700 }}>
              適用 (リロード)
            </button>
            <button onClick={() => { setCode(''); setEdit(false); }}
              className="text-xs px-3 py-1.5 rounded-full text-fg-muted">
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEdit(true)} className="text-xs text-fg-muted hover:text-fg-subtle underline">
          Owner キーを入力 →
        </button>
      )}
    </div>
  );
}
