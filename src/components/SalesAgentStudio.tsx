import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, X, Sparkles, Mic, FolderOpen, Gift, Brain, RefreshCw,
  PartyPopper, Lightbulb, Mail, Pencil, Check, Inbox, Copy, Send,
  Hand, Headphones, Shield, Handshake, type LucideIcon,
} from 'lucide-react';
import { IconBadge, IconChip } from './icons';
import type { Persona, AppSettings, KnowledgeItem } from '../types/identity';
import { useSalesAgent } from '../hooks/useSalesAgent';
import { pickTodaysCompanies, type AiPick } from '../lib/salesAgentMatch';
import { generateApproachEmail } from '../lib/salesAgent';
import { isGmailConfigured, isGmailConnected, connectGmail, fetchInbox, createGmailDraft, loadGmailUser } from '../lib/gmail';
import { extractProspectsFromInbox, qualifyProspects, type QualifiedProspect } from '../lib/salesGmailProspects';
import { todaySeed } from '../data/companies-jp';
import { useCopyButton } from '../hooks/useCopyButton';
import ApiErrorCard from './ApiErrorCard';
import AILoadingState from './AILoadingState';
import AISuccessBurst from './AISuccessBurst';
import { StudioIntro } from './StudioIntro';
import SampleDataCTA from './SampleDataCTA';
import DelegateToAgentTeamBanner from './DelegateToAgentTeamBanner';
import { isDemoActive } from '../lib/onboarding';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import { aiFetch } from '../lib/aiFetch';
import StudioBackButton from './StudioBackButton';

interface Props {
  persona: Persona;
  settings: AppSettings;
  /** ナレッジ (自社商材の自動取り込み元) — オーナー指示 2026-06-02 */
  knowledge?: KnowledgeItem[];
  onClose: () => void;
}

type Tab = 'today' | 'gmail' | 'history' | 'product' | 'script';

interface SalesScript {
  opening: string;            // 掴みの一言
  hearing: string[];          // ヒアリング質問
  pitch: string;              // 提案の核
  objections: Array<{ q: string; a: string }>; // 想定反論 + 切り返し
  closing: string;            // クロージング
}

interface CachedPicks {
  seed: number;
  personaId: string;
  picks: AiPick[];
  approvedIds: string[];   // 採用済の companyId
  rejectedIds: string[];   // 却下済の companyId
}

const CACHE_KEY = 'core_sales_today_picks_v2';

function loadCache(): CachedPicks | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveCache(c: CachedPicks) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* */ }
}

const SIZE_LABEL: Record<AiPick['size'], string> = {
  large: '大手',
  mid: '中堅',
  startup: 'スタートアップ',
};

export default function SalesAgentStudio({ persona, settings, knowledge = [], onClose }: Props) {
  const sa = useSalesAgent();
  const queue = useAgentTaskQueue();
  const approachCopy = useCopyButton();
  const scriptCopy = useCopyButton();
  const [tab, setTab] = useState<Tab>('today');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pick' | 'edit' | null>(null);

  const ownProduct = sa.getOwnProduct(persona.id);
  const myLeads = useMemo(() => sa.getLeadsForPersona(persona.id), [sa.leads, persona.id]);

  // ─── 商談台本 + 反論対応 (オーナー指示 2026-05-28) ───
  const [scriptTarget, setScriptTarget] = useState('');
  const [script, setScript] = useState<SalesScript | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const generateScript = useCallback(async () => {
    if (!scriptTarget.trim()) { setError('商談相手や状況を 1 行で入れてください'); return; }
    setScriptBusy(true); setError(null);
    try {
      const sys = `あなたは一流の法人営業コーチです。日本のビジネス慣習に沿った、自然で押しつけがましくない商談台本を作ります。
返答は JSON のみ (コードブロックなし):
{
  "opening": "最初の掴みの一言 (堅すぎず、相手の関心に触れる。1-2 文)",
  "hearing": ["相手の課題を引き出す質問 1", "質問 2", "質問 3"],
  "pitch": "提案の核 — 相手の課題にどう効くかを 2-3 文で",
  "objections": [
    { "q": "想定される反論・断り文句 1", "a": "それへの自然な切り返し (1-2 文)" },
    { "q": "反論 2", "a": "切り返し 2" },
    { "q": "反論 3 (価格系)", "a": "切り返し 3" }
  ],
  "closing": "次の一歩につなげるクロージング (1-2 文)"
}
やさしい日本語。専門用語・横文字は避ける。具体的に。`;
      const userPrompt = `## 自社の商材\n${ownProduct || '(未登録 — 一般的な提案として作成)'}\n\n## 商談相手 / 状況\n${scriptTarget}\n\n上記の商談で使える台本と反論対応を作ってください。`;
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1800, system: sys, messages: [{ role: 'user', content: userPrompt }] }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `AI エラー: ${res.status}`); }
      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI の返答を読み取れませんでした');
      const p = JSON.parse(m[0]);
      setScript({
        opening: p.opening || '',
        hearing: Array.isArray(p.hearing) ? p.hearing : [],
        pitch: p.pitch || '',
        objections: Array.isArray(p.objections) ? p.objections : [],
        closing: p.closing || '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '台本を作れませんでした');
    } finally {
      setScriptBusy(false);
    }
  }, [scriptTarget, ownProduct]);

  // ─── Gmail から営業先を発掘 (NoimosAI 型) ─────────
  const [gmailConnected, setGmailConnected] = useState(() => isGmailConnected());
  const [prospects, setProspects] = useState<QualifiedProspect[]>([]);
  const [gmailBusy, setGmailBusy] = useState<'connect' | 'scan' | null>(null);
  const [gmailStep, setGmailStep] = useState('');
  const [draftedEmails, setDraftedEmails] = useState<Record<string, boolean>>({});
  const [draftingEmail, setDraftingEmail] = useState<string | null>(null);
  const [dismissedProspects, setDismissedProspects] = useState<string[]>([]);

  const connectGmailFlow = useCallback(async () => {
    setGmailBusy('connect'); setError(null);
    try {
      await connectGmail();
      setGmailConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gmail 連携に失敗しました');
    } finally { setGmailBusy(null); }
  }, []);

  const scanInboxForProspects = useCallback(async () => {
    if (!ownProduct?.trim()) {
      setTab('product');
      setError('まず「自社の商材」を登録してください。何を売るかが分からないと、営業先の相性を判定できません。');
      return;
    }
    setGmailBusy('scan'); setError(null); setProspects([]);
    try {
      setGmailStep('受信メールを読み込んでいます…');
      const messages = await fetchInbox(40);
      if (!messages.length) {
        setError('直近14日の受信メールが見つかりませんでした。やり取りのあるメールが必要です。');
        return;
      }
      setGmailStep('差出人から営業先候補を抽出しています…');
      const self = loadGmailUser()?.email;
      const raw = extractProspectsFromInbox(messages, self);
      if (!raw.length) {
        setError('営業先になりそうな差出人が見つかりませんでした（自動配信・通知メールは除外しています）。');
        return;
      }
      setGmailStep(`${raw.length}社の相性を AI が判定しています…`);
      const qualified = await qualifyProspects({ settings, ownProduct, prospects: raw });
      setProspects(qualified);
    } catch (e) {
      setError(e instanceof Error ? e.message : '営業先の発掘に失敗しました');
    } finally { setGmailBusy(null); setGmailStep(''); }
  }, [ownProduct, settings]);

  // 候補1社に最適な営業メールを作り、Gmail に「下書き」として保存(送信はしない=安全)
  const draftEmailForProspect = useCallback(async (p: QualifiedProspect) => {
    setDraftingEmail(p.email); setError(null);
    try {
      const lead = sa.addLead(persona.id, {
        companyName: p.companyGuess,
        contactName: p.isPersonal ? p.name : undefined,
        email: p.email,
        score: p.fit,
        scoreReason: p.fitReason,
        stage: 'new',
        source: 'gmail-prospect',
        notes: `直近件名: ${p.lastSubject || '(なし)'}`,
      });
      const draft = await generateApproachEmail({
        settings, persona, lead, ownProduct,
        goal: `${p.angle || '相手の課題に自社商材がどう効くか'}を軸に、返信をもらう`,
      });
      const subject = draft.subject || `${p.companyGuess}様へのご提案`;
      await createGmailDraft({ to: p.email, subject, body: draft.body });
      sa.addApproach({
        leadId: lead.id, type: 'email',
        subject, body: draft.body, tone: draft.tone,
        hitProbability: draft.hitProbability, status: 'draft',
        generatedAt: new Date().toISOString(),
      });
      setDraftedEmails(prev => ({ ...prev, [p.email]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'メール下書きの作成に失敗しました');
    } finally { setDraftingEmail(null); }
  }, [settings, persona, ownProduct, sa]);

  // ─── 今日のピックアップ ─────────
  const [picks, setPicks] = useState<AiPick[]>([]);
  const [doneKey, setDoneKey] = useState(0);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  // 起動時にキャッシュから復元 (同じ日 & 同じペルソナのみ)
  useEffect(() => {
    const cache = loadCache();
    const seed = todaySeed();
    if (cache && cache.seed === seed && cache.personaId === persona.id) {
      setPicks(cache.picks);
      setApprovedIds(cache.approvedIds || []);
      setRejectedIds(cache.rejectedIds || []);
    } else {
      setPicks([]);
      setApprovedIds([]);
      setRejectedIds([]);
    }
  }, [persona.id]);

  // 状態が変わったらキャッシュへ
  useEffect(() => {
    if (picks.length === 0) return;
    saveCache({
      seed: todaySeed(),
      personaId: persona.id,
      picks,
      approvedIds,
      rejectedIds,
    });
  }, [picks, approvedIds, rejectedIds, persona.id]);

  // ─── AI に「今日の 5 社」を選ばせる ──────────
  const runPick = useCallback(async (replace: boolean) => {
    if (!ownProduct?.trim()) {
      setTab('product');
      setError('まず自社の商材タブで「うちの商品・サービス」を登録してね');
      return;
    }
    setBusy('pick'); setError(null);
    try {
      const exclude = replace ? [...approvedIds, ...rejectedIds, ...picks.map(p => p.companyId)] : [...approvedIds, ...rejectedIds];
      const result = await pickTodaysCompanies({
        settings,
        persona,
        ownProduct,
        excludeIds: exclude,
      });
      setPicks(result);
      if (result.length > 0) setDoneKey(k => k + 1); // 選定完了のごほうび演出
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [ownProduct, settings, persona, approvedIds, rejectedIds, picks]);

  // ─── 承認 → リード追加 + アプローチ下書き保存 ──────────
  const handleApprove = useCallback((pick: AiPick) => {
    // 重複防止: 同じ companyId が既に承認済なら何もしない
    if (approvedIds.includes(pick.companyId)) return;
    // 1) リード追加
    const lead = sa.addLead(persona.id, {
      companyName: pick.companyName,
      contactName: '担当者様',
      contactRole: '',
      notes: `AI ピックアップ: ${pick.reason}`,
      score: pick.matchScore,
      scoreReason: pick.reason,
      stage: 'approached',
      source: 'ai-pick',
    });
    // 2) アプローチ (メール下書き) 保存 → シャドー秘書がここから処理
    sa.addApproach({
      leadId: lead.id,
      type: 'email',
      subject: pick.emailSubject,
      body: pick.emailBody,
      tone: '先回り提案',
      hitProbability: pick.matchScore,
      status: 'draft',
      generatedAt: new Date().toISOString(),
    });
    setApprovedIds(prev => [...prev, pick.companyId]);
  }, [sa, persona.id, approvedIds]);

  const handleReject = useCallback((pick: AiPick) => {
    setRejectedIds(prev => [...prev, pick.companyId]);
  }, []);

  const startEdit = useCallback((pick: AiPick) => {
    setEditingId(pick.companyId);
    setEditDraft({ subject: pick.emailSubject, body: pick.emailBody });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingId) return;
    setPicks(prev => prev.map(p =>
      p.companyId === editingId
        ? { ...p, emailSubject: editDraft.subject.trim(), emailBody: editDraft.body.trim() }
        : p
    ));
    setEditingId(null);
  }, [editingId, editDraft]);

  // 表示用: 却下/承認したものは出さない
  const visiblePicks = useMemo(
    () => picks.filter(p => !approvedIds.includes(p.companyId) && !rejectedIds.includes(p.companyId)),
    [picks, approvedIds, rejectedIds]
  );

  // ─── 自社の商材タブ ──────
  const [productDraft, setProductDraft] = useState(ownProduct);
  const [productSavedMsg, setProductSavedMsg] = useState<string | null>(null);
  const [extractBusy, setExtractBusy] = useState(false);
  useEffect(() => setProductDraft(ownProduct), [ownProduct]);

  // ─── ナレッジから自社商材を自動取込 (オーナー指示 2026-06-02) ───
  // 「いちいち入力させない」: 蓄積資料を AI が読んで商材説明を 5-10 行で自動生成
  const extractFromKnowledge = useCallback(async () => {
    if (knowledge.length === 0) {
      setError('まずナレッジに資料を 1 件以上入れてください。');
      return;
    }
    setExtractBusy(true);
    setError(null);
    try {
      const digest = knowledge.slice(0, 25).map((k, i) => {
        const sum = k.analysis?.summary || k.content.slice(0, 200);
        return `${i + 1}. ${k.title}\n   ${sum.slice(0, 240)}`;
      }).join('\n\n');
      const sys = `あなたは経営参謀です。蓄積された資料から「この事業者の自社商材」を抽出し、
営業相手探しに使える形に整理します。

返答は JSON のみ:
{
  "summary": "5〜10 行のプレーンテキスト (改行 \\n で区切る)。フォーマット:\\n弊社の商材: ○○\\n価格: ○○\\nコア機能: ○○\\nターゲット: ○○\\n強み: ○○"
}

ルール:
- 資料に書かれた事実だけを使う (作り話禁止)
- やさしい日本語、専門用語は避ける
- 価格やターゲットが資料に無ければ「(資料に記載なし)」と書く`;
      const userMsg = `# 事業: ${persona.name} (${persona.subtitle || ''})\n\n# 資料 ${knowledge.length} 件 (主要 ${Math.min(25, knowledge.length)} 件)\n\n${digest}\n\n上記から自社商材の説明を JSON で抽出してください。`;
      const res = await aiFetch({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.preferredModel,
          max_tokens: 1500,
          system: sys,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `取込エラー: ${res.status}`);
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI の返答を読み取れませんでした');
      const parsed = JSON.parse(m[0]);
      const summary = String(parsed.summary || '').trim();
      if (!summary) throw new Error('資料から商材情報を抽出できませんでした。');
      setProductDraft(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : '取込に失敗しました');
    } finally {
      setExtractBusy(false);
    }
  }, [knowledge, persona, settings.preferredModel]);
  const saveProduct = () => {
    if (!productDraft.trim()) {
      setError('まず商材の内容を入れてください (5〜10 行で OK)');
      return;
    }
    sa.setOwnProduct(persona.id, productDraft);
    setError(null);
    setProductSavedMsg('保存しました。AI が「今日の 5 社」を探しています…');
    // AgentTeamMonitor に進捗を出す (CSO がメインで動く)
    queue.propose({
      title: '今日の 5 社を選び、提案メールまで下書き',
      summary: `登録した商材から、合いそうな企業 5 社を CSO が選定。各社に合わせた提案メール下書きまで一気通貫で用意します。`,
      why: '保存した商材情報は、毎日の営業先発掘に使う。手作業で 5 社探すと半日かかる所を AI が即出す。',
      expected: '今日の 5 社 + 各社向け件名 + 本文下書き (60〜120 字)',
      dueDays: 1,
      steps: [
        { cxo: 'CSO', label: '商材内容を分析、ターゲット業種・規模を抽出' },
        { cxo: 'CDS', label: '社内データから条件に合う 5 社を選定' },
        { cxo: 'CSO', label: '各社向けの件名と本文 (先回り提案) を下書き' },
      ],
    });
    // 自動で「今日の5社」タブへ移動 + AI ピックを即発火
    // (オーナー指示 2026-05-26: 保存しても何も起きないのは感動が無い)
    setTimeout(() => {
      setTab('today');
      runPick(false);
      setProductSavedMsg(null);
    }, 800);
  };

  // ─── 履歴タブ: 採用済リードと送信履歴 ──────
  const approvedLeadCount = myLeads.filter(l => l.source === 'ai-pick').length;
  const draftCount = sa.approaches.filter(a => myLeads.some(l => l.id === a.leadId)).length;

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1100px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <StudioBackButton onClick={onClose} />
            <IconBadge icon={Target} color={persona.accentColor} size={40} variant="soft" />
            <div className="min-w-0">
              <p className="cp-h2 truncate">商談 AI エージェント</p>
              <p className="cp-meta truncate">AI が今日の 5 社を選び、提案文まで先回りで用意します</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm" aria-label="閉じる"><X size={16} strokeWidth={2.4} /></button>
        </div>

        <DelegateToAgentTeamBanner
          taskTitle="5 社に CSO が提案文を書く"
          suggestedCxos={['CSO', 'CMO']}
          why="営業の手を止めないよう、AI 会社が今日の 5 社に個別最適化した提案文を用意します"
          expected="5 社それぞれに合わせた送付可能な提案文ドラフト"
        />

        <div className="cp-modal-tabs">
          {([
            { id: 'today',   icon: Sparkles,   label: '今日の5社' },
            { id: 'gmail',   icon: Inbox,      label: 'Gmailから営業先' },
            { id: 'script',  icon: Mic,        label: '商談台本' },
            { id: 'history', icon: FolderOpen, label: `採用済 (${approvedLeadCount})` },
            { id: 'product', icon: Gift,       label: '自社の商材' },
          ] as { id: Tab; icon: LucideIcon; label: string }[]).map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null); }}
              className="cp-modal-tab" data-active={tab === t.id}
              style={{ color: tab === t.id ? persona.accentColor : undefined, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconChip icon={t.icon} color={tab === t.id ? persona.accentColor : 'currentColor'} size={16} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          <ApiErrorCard error={error} onRetry={() => runPick(false)} variant="auto" />
          <AILoadingState
            active={busy === 'pick'}
            label="AI が営業先を選定しています"
            stages={[
              '自社の商材を読み込み',
              '日本企業 300+ 社からマッチング',
              '優先順位を計算',
              '提案文の下書きを作成',
            ]}
            brand="prism"
            skeletonLines={6}
          />
          <AILoadingState
            active={busy === 'edit'}
            label="提案文を書き直しています"
            stages={['指示を読み込み', '相手の文脈を整理', 'トーンを調整']}
            brand="prism"
            skeletonLines={4}
          />
          <AISuccessBurst trigger={doneKey} brand="prism" label="今日の候補がそろいました" />

          <StudioIntro
            id="sales-agent"
            accent={persona.accentColor}
            icon={Target}
            what="営業先を探す → 提案文を書く までを AI が先回りで終わらせておく場所です。"
            tryThis="「今日の 5 社を選ぶ」を押すと、AI が候補 + 件名 + 本文まで用意します。"
            example="「中堅メーカーの DX 担当」に響くメール 5 通を、朝の 10 秒で完成。"
            sampleLabel="出来上がる今日の 1 社"
            samplePreview={
              <div
                style={{
                  width: 160,
                  background: 'var(--surface)',
                  color: 'var(--fg)',
                  borderRadius: 8,
                  padding: '8px 9px',
                  fontSize: 7,
                  lineHeight: 1.45,
                  boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
                  border: `1px solid ${persona.accentColor}40`,
                }}
                aria-label="今日のピックアップのサンプル"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 8 }}>株式会社サンプル</span>
                  <span
                    style={{
                      background: `${persona.accentColor}24`,
                      color: persona.accentColor,
                      borderRadius: 4,
                      padding: '1px 4px',
                      fontSize: 5,
                      fontWeight: 700,
                    }}
                  >
                    中堅
                  </span>
                </div>
                <div style={{ fontSize: 5.5, opacity: 0.7, marginBottom: 4 }}>
                  製造業 / 従業員 320 名 / DX 推進中
                </div>
                <div
                  style={{
                    background: `${persona.accentColor}14`,
                    borderLeft: `2px solid ${persona.accentColor}`,
                    padding: '3px 5px',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 5, opacity: 0.65, marginBottom: 1 }}>件名</div>
                  <div style={{ fontSize: 6, fontWeight: 700 }}>
                    DX 推進 1 段目の手間、半分にしませんか
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 5.5,
                    opacity: 0.85,
                    background: 'var(--surface-3)',
                    padding: '3px 5px',
                    borderRadius: 3,
                  }}
                >
                  ◯◯ 様、初めてご連絡いたします。DX 推進中とのこと…
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: 'flex',
                    gap: 3,
                    fontSize: 5.5,
                  }}
                >
                  <span style={{ flex: 1, textAlign: 'center', background: `${persona.accentColor}20`, color: persona.accentColor, padding: '2px 0', borderRadius: 3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Check size={6} strokeWidth={3} /> 採用
                  </span>
                  <span style={{ flex: 1, textAlign: 'center', background: 'var(--surface-3)', opacity: 0.7, padding: '2px 0', borderRadius: 3 }}>
                    却下
                  </span>
                </div>
              </div>
            }
          />

          {/* ─── 今日のピックアップ ─── */}
          {tab === 'today' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div className="min-w-0">
                    <p className="cp-h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <IconChip icon={Sparkles} color={persona.accentColor} size={18} />
                      AI が選んだ 今日の 5 社
                    </p>
                    <p className="cp-meta">
                      あなたの「自社の商材」をもとに、日本企業 {300}+ 社の中から AI が先回りで選びました。
                      気に入ったら「採用」、違うなと思ったら「却下」、文面を変えたいときは「直す」を押してください。
                    </p>
                  </div>
                  <div className="cp-row" style={{ gap: 6, flexShrink: 0 }}>
                    <button onClick={() => runPick(false)} disabled={busy === 'pick'}
                      className="cp-btn cp-btn-primary"
                      style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      {busy === 'pick' ? (
                        <><Brain size={16} strokeWidth={2.4} /><span>AI が選定中…</span></>
                      ) : picks.length === 0 ? (
                        <><Sparkles size={16} strokeWidth={2.4} /><span>今日アプローチする 5 社 + 営業文を AI に作ってもらう</span></>
                      ) : (
                        <><RefreshCw size={16} strokeWidth={2.4} /><span>別の 5 社で作り直してもらう</span></>
                      )}
                    </button>
                  </div>
                </div>
                {!ownProduct?.trim() && (
                  <p className="cp-tiny" style={{ color: '#FBBF24' }}>
                    まだ自社の商材が未登録です。「自社の商材」タブで一度だけ書いておくと、毎日 AI が自動で合う企業を探します。
                  </p>
                )}
              </div>

              {/* 5 社カード */}
              {visiblePicks.length === 0 && picks.length === 0 && (
                <div className="cp-empty">
                  <p className="cp-empty-icon"><Target size={34} strokeWidth={1.6} color={persona.accentColor} /></p>
                  <p>まだピックアップがありません</p>
                  <p className="cp-meta">上の「今日アプローチする 5 社 + 営業文を AI に作ってもらう」を押すと、AI が 5 社と営業文を用意します</p>
                  {!isDemoActive() && (
                    <div style={{ marginTop: 14 }}>
                      <SampleDataCTA
                        accent={persona.accentColor}
                        hint="サンプルの自社商材と 5 社のピックアップが入り、営業 AI の「攻め先選定」をすぐ体験できます"
                      />
                    </div>
                  )}
                </div>
              )}

              {visiblePicks.length === 0 && picks.length > 0 && (
                <div className="cp-empty">
                  <p className="cp-empty-icon"><PartyPopper size={34} strokeWidth={1.6} color={persona.accentColor} /></p>
                  <p>今日の 5 社、全部さばき終わりました</p>
                  <p className="cp-meta">上の「別の 5 社で作り直してもらう」で次の候補を出せます</p>
                </div>
              )}

              <AnimatePresence>
                {visiblePicks.map((p, idx) => {
                  const isEditing = editingId === p.companyId;
                  return (
                    <motion.div
                      key={p.companyId}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, x: -20 }}
                      transition={{ delay: idx * 0.06 }}
                      className="cp-card-section cp-stack-sm"
                      style={{ borderColor: persona.accentColor + '30' }}
                    >
                      {/* ヘッダー */}
                      <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div className="cp-row min-w-0" style={{ gap: 10 }}>
                          <div
                            className="rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              width: 44, height: 44,
                              background: `linear-gradient(135deg, ${persona.accentColor}33, ${persona.accentColor}11)`,
                              color: persona.accentColor,
                              fontWeight: 700,
                              fontSize: '1.1rem',
                              border: `1px solid ${persona.accentColor}44`,
                            }}
                          >
                            {p.companyName.slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <p className="cp-h3 truncate">{p.companyName}</p>
                            <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                              <span className="cp-pill" style={{ borderColor: persona.accentColor, color: persona.accentColor }}>
                                {p.industry}
                              </span>
                              <span className="cp-pill">{SIZE_LABEL[p.size]}</span>
                              <span className="cp-pill">{p.region}</span>
                            </div>
                          </div>
                        </div>
                        <div className="cp-row" style={{ flexShrink: 0 }}>
                          <span className="cp-pill" style={{
                            color: p.matchScore >= 80 ? '#10B981' : p.matchScore >= 60 ? '#F59E0B' : '#9088A8',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                          }}>
                            合致度 {p.matchScore}
                          </span>
                        </div>
                      </div>

                      {/* 理由 */}
                      <div className="cp-card" style={{ background: persona.accentColorLight, borderColor: persona.accentColor + '55' }}>
                        <p className="cp-tiny" style={{ color: persona.accentColor, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lightbulb size={13} strokeWidth={2.2} /> AI がこの企業を選んだ理由</p>
                        <p className="cp-body" style={{ color: 'var(--fg)' }}>{p.reason}</p>
                      </div>

                      {/* 提案文プレビュー / 編集 */}
                      {!isEditing ? (
                        <div className="cp-stack-sm">
                          <p className="cp-tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Mail size={13} strokeWidth={2.2} /> 提案文ドラフト</p>
                          <div className="cp-card">
                            <p className="cp-meta" style={{ marginBottom: 6 }}>件名: <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{p.emailSubject}</span></p>
                            <pre className="cp-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{p.emailBody}</pre>
                          </div>
                        </div>
                      ) : (
                        <div className="cp-stack-sm">
                          <p className="cp-tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Pencil size={13} strokeWidth={2.2} /> 文面を直す</p>
                          <input value={editDraft.subject} onChange={e => setEditDraft({ ...editDraft, subject: e.target.value })}
                            placeholder="件名" className="cp-input" />
                          <textarea value={editDraft.body} onChange={e => setEditDraft({ ...editDraft, body: e.target.value })}
                            rows={8} className="cp-textarea" />
                          <div className="cp-row" style={{ gap: 6 }}>
                            <button onClick={saveEdit} className="cp-btn cp-btn-primary"
                              style={{ background: persona.accentColor, color: '#0a0a0f' }}>保存</button>
                            <button onClick={() => setEditingId(null)} className="cp-btn cp-btn-ghost">取消</button>
                          </div>
                        </div>
                      )}

                      {/* 操作 3 ボタン */}
                      {!isEditing && (
                        <div className="cp-row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button onClick={() => handleReject(p)}
                            className="cp-btn cp-btn-ghost cp-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><X size={14} strokeWidth={2.4} /> 却下</button>
                          <button onClick={() => startEdit(p)}
                            className="cp-btn cp-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Pencil size={14} strokeWidth={2.4} /> 直す</button>
                          <button onClick={() => handleApprove(p)}
                            className="cp-btn cp-btn-primary cp-btn-sm"
                            style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Check size={14} strokeWidth={2.6} /> 採用 → メール下書きを保存
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          )}

          {/* ─── Gmail から営業先を発掘 ─── */}
          {tab === 'gmail' && (
            <>
              <div className="cp-card-section cp-stack-sm">
                <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                  <div className="min-w-0">
                    <p className="cp-h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <IconChip icon={Inbox} color={persona.accentColor} size={18} />
                      Gmail のやり取りから営業先を見つける
                    </p>
                    <p className="cp-meta">
                      受信メールの差出人（実在の会社・担当者）から、自社商材の営業先になりそうな相手を AI が選び、
                      それぞれに最適な営業メールを作って Gmail の<strong>下書き</strong>に入れます（送信はしません。中身を確認して Gmail から送れます）。
                    </p>
                  </div>
                  <div className="cp-row" style={{ gap: 6, flexShrink: 0 }}>
                    {!isGmailConfigured() ? (
                      <p className="cp-tiny" style={{ color: '#FBBF24' }}>Gmail 連携が未設定です（管理者に VITE_GOOGLE_CLIENT_ID の設定を依頼してください）。</p>
                    ) : !gmailConnected ? (
                      <button onClick={connectGmailFlow} disabled={gmailBusy === 'connect'}
                        className="cp-btn cp-btn-primary"
                        style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        <Mail size={16} strokeWidth={2.4} /><span>{gmailBusy === 'connect' ? '連携中…' : 'Gmail を連携する'}</span>
                      </button>
                    ) : (
                      <button onClick={scanInboxForProspects} disabled={gmailBusy === 'scan'}
                        className="cp-btn cp-btn-primary"
                        style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                        {gmailBusy === 'scan'
                          ? <><Brain size={16} strokeWidth={2.4} /><span>探しています…</span></>
                          : <><Sparkles size={16} strokeWidth={2.4} /><span>受信メールから営業先を探す</span></>}
                      </button>
                    )}
                  </div>
                </div>
                {!ownProduct?.trim() && (
                  <p className="cp-tiny" style={{ color: '#FBBF24' }}>
                    まだ自社の商材が未登録です。「自社の商材」タブで一度だけ書いておくと、相性を正しく判定できます。
                  </p>
                )}
                {gmailBusy === 'scan' && gmailStep && (
                  <p className="cp-tiny" style={{ color: persona.accentColor }}>{gmailStep}</p>
                )}
              </div>

              {gmailConnected && prospects.length === 0 && gmailBusy !== 'scan' && (
                <div className="cp-empty">
                  <p className="cp-empty-icon"><Inbox size={34} strokeWidth={1.6} color={persona.accentColor} /></p>
                  <p>まだ営業先がありません</p>
                  <p className="cp-meta">「受信メールから営業先を探す」を押すと、やり取りのある会社から候補を出します</p>
                </div>
              )}

              {prospects.filter(p => !dismissedProspects.includes(p.email)).map(p => {
                const drafted = draftedEmails[p.email];
                return (
                  <div key={p.email} className="cp-card-section cp-stack-sm" style={{ borderLeft: `3px solid ${p.fit >= 70 ? '#34D399' : p.fit >= 40 ? persona.accentColor : '#94a3b8'}` }}>
                    <div className="cp-row-between" style={{ gap: 8, alignItems: 'flex-start' }}>
                      <div className="min-w-0">
                        <p className="cp-h3" style={{ marginBottom: 2 }}>
                          {p.companyGuess}
                          {p.recommend && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: '#047857', background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)', borderRadius: 999, padding: '2px 8px' }}>おすすめ</span>}
                        </p>
                        <p className="cp-meta" style={{ wordBreak: 'break-all' }}>{p.email}{p.lastSubject ? ` ・ 直近件名「${p.lastSubject}」` : ''}</p>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#0a0a0f', background: p.fit >= 70 ? '#34D399' : p.fit >= 40 ? '#FBBF24' : '#cbd5e1', borderRadius: 999, padding: '3px 10px' }}>相性 {p.fit}</span>
                    </div>
                    <p className="cp-meta" style={{ lineHeight: 1.6 }}>{p.fitReason}</p>
                    {p.angle && <p className="cp-tiny" style={{ color: persona.accentColor }}>刺さる切り口: {p.angle}</p>}
                    <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {drafted ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#047857', fontWeight: 700, fontSize: 13 }}>
                          <Check size={15} strokeWidth={2.6} /> Gmail に下書きを作成しました（Gmailで確認して送信）
                        </span>
                      ) : (
                        <>
                          <button onClick={() => draftEmailForProspect(p)} disabled={draftingEmail === p.email}
                            className="cp-btn cp-btn-primary"
                            style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {draftingEmail === p.email
                              ? <><Brain size={15} strokeWidth={2.4} /><span>作成中…</span></>
                              : <><Mail size={15} strokeWidth={2.4} /><span>最適な営業メールを作る → Gmail下書き</span></>}
                          </button>
                          <button onClick={() => setDismissedProspects(prev => [...prev, p.email])} className="cp-btn cp-btn-ghost">却下</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ─── 採用済リード ─── */}
          {tab === 'history' && (
            <>
              <div className="cp-card-section">
                <p className="cp-h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <IconChip icon={FolderOpen} color={persona.accentColor} size={18} />
                  採用済のリード
                </p>
                <p className="cp-meta">
                  「採用」したものはここに溜まります。メール下書きは {draftCount} 件保存中。
                  シャドー秘書 (毎朝の自動チェック) がこの一覧から優先度の高い相手に動きます。
                </p>
              </div>

              <div className="cp-stack-sm">
                {myLeads.length === 0 ? (
                  <div className="cp-empty">
                    <p className="cp-empty-icon"><Inbox size={34} strokeWidth={1.6} color={persona.accentColor} /></p>
                    <p>まだ採用したリードはありません</p>
                    <p className="cp-meta">「今日の5社」タブで AI が選んだ企業を「採用」すると、ここに追加されます</p>
                  </div>
                ) : myLeads.map(l => {
                  const drafts = sa.approaches.filter(a => a.leadId === l.id);
                  return (
                    <div key={l.id} className="cp-card cp-stack-sm">
                      <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <div className="min-w-0">
                          <p className="cp-h3 truncate">{l.companyName}</p>
                          {l.scoreReason && (
                            <p className="cp-meta" style={{ textTransform: 'none' }}>{l.scoreReason}</p>
                          )}
                        </div>
                        <div className="cp-row" style={{ flexShrink: 0 }}>
                          <span className="cp-pill" style={{
                            color: l.score >= 80 ? '#10B981' : l.score >= 60 ? '#F59E0B' : '#9088A8',
                            fontWeight: 600,
                          }}>合致度 {l.score}</span>
                          <button onClick={() => sa.removeLead(l.id)} className="cp-btn cp-btn-ghost cp-btn-sm">削除</button>
                        </div>
                      </div>
                      {drafts.length > 0 && (
                        <div className="cp-stack-sm">
                          {drafts.slice(0, 1).map(a => (
                            <div key={a.id} className="cp-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <p className="cp-meta" style={{ marginBottom: 4 }}>件名: <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{a.subject}</span></p>
                              <pre className="cp-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.85rem' }}>{a.body}</pre>
                              <div className="cp-row" style={{ gap: 6, marginTop: 8 }}>
                                <button
                                  onClick={() => approachCopy.copy(`${a.subject}\n\n${a.body}`, '営業文')}
                                  data-copied={approachCopy.copied}
                                  className="cp-btn cp-btn-sm cp-copy-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                >{approachCopy.copied ? <><Check size={13} strokeWidth={2.6} /> コピーしました</> : <><Copy size={13} strokeWidth={2.2} /> コピー</>}</button>
                                <button onClick={() => sa.updateApproach(a.id, { status: 'sent' })}
                                  className="cp-btn cp-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Send size={13} strokeWidth={2.2} /> 送信済みにする</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ─── 商談台本 + 反論対応 ─── */}
          {tab === 'script' && (
            <div className="cp-stack-sm">
              <div className="cp-card-section cp-stack-sm" style={{ background: `${persona.accentColor}10`, border: `1px solid ${persona.accentColor}40` }}>
                <p className="cp-h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <IconChip icon={Mic} color={persona.accentColor} size={18} />
                  商談台本 + 反論対応を AI が作る
                </p>
                <p className="cp-meta">
                  商談相手や状況を 1 行入れると、掴み・ヒアリング・提案・想定反論への切り返し・クロージングまで一気に用意します。
                </p>
                <textarea
                  value={scriptTarget}
                  onChange={e => setScriptTarget(e.target.value)}
                  placeholder={'例: 渋谷の美容室オーナー、忙しくて新ツール導入に慎重。来週訪問予定。\n例: 製造業のDX担当部長、予算は取れてるが社内承認が必要。'}
                  rows={3}
                  className="cp-textarea"
                />
                <button
                  onClick={generateScript}
                  disabled={scriptBusy || !scriptTarget.trim()}
                  className="cp-btn cp-btn-primary"
                  style={{ background: persona.accentColor, color: '#0a0a0f', opacity: (scriptBusy || !scriptTarget.trim()) ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  {scriptBusy ? (
                    <><Brain size={16} strokeWidth={2.4} /><span>台本を作成中…</span></>
                  ) : (
                    <><Mic size={16} strokeWidth={2.4} /><span>30 秒で読める商談台本を AI に書いてもらう</span></>
                  )}
                </button>
              </div>

              <AILoadingState
                active={scriptBusy}
                label="商談台本を組み立てています"
                stages={['相手の立場を分析', '刺さる切り口を選定', '想定反論を洗い出し', '切り返しを用意']}
                brand="prism"
              />

              {script && !scriptBusy && (
                <>
                  <ScriptBlock icon={Hand} title="掴みの一言" accent={persona.accentColor}>
                    <p className="cp-body" style={{ lineHeight: 1.7 }}>{script.opening}</p>
                  </ScriptBlock>

                  <ScriptBlock icon={Headphones} title="ヒアリング (相手の課題を引き出す)" accent={persona.accentColor}>
                    <ol style={{ paddingLeft: 20, margin: 0 }}>
                      {script.hearing.map((h, i) => (
                        <li key={i} style={{ marginBottom: 5, lineHeight: 1.6, fontSize: '0.92rem' }}>{h}</li>
                      ))}
                    </ol>
                  </ScriptBlock>

                  <ScriptBlock icon={Lightbulb} title="提案の核" accent={persona.accentColor}>
                    <p className="cp-body" style={{ lineHeight: 1.7 }}>{script.pitch}</p>
                  </ScriptBlock>

                  <ScriptBlock icon={Shield} title="想定反論 → 切り返し" accent={persona.accentColor}>
                    <div className="cp-stack-sm">
                      {script.objections.map((o, i) => (
                        <div key={i} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--cp-danger-text)', fontWeight: 700 }}>「{o.q}」</p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--fg)' }}>→ {o.a}</p>
                        </div>
                      ))}
                    </div>
                  </ScriptBlock>

                  <ScriptBlock icon={Handshake} title="クロージング" accent={persona.accentColor}>
                    <p className="cp-body" style={{ lineHeight: 1.7 }}>{script.closing}</p>
                  </ScriptBlock>

                  <div className="cp-row" style={{ gap: 6 }}>
                    <button
                      onClick={() => {
                        const full = `【商談台本】\n\n■ 掴み\n${script.opening}\n\n■ ヒアリング\n${script.hearing.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n■ 提案の核\n${script.pitch}\n\n■ 想定反論への切り返し\n${script.objections.map(o => `Q:「${o.q}」\nA: ${o.a}`).join('\n\n')}\n\n■ クロージング\n${script.closing}`;
                        scriptCopy.copy(full, '商談台本');
                      }}
                      data-copied={scriptCopy.copied}
                      className="cp-btn cp-btn-sm cp-copy-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >{scriptCopy.copied ? <><Check size={13} strokeWidth={2.6} /> コピーしました</> : <><Copy size={13} strokeWidth={2.2} /> 台本を全部コピー</>}</button>
                    <button onClick={generateScript} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><RefreshCw size={13} strokeWidth={2.2} /> 別パターンで作り直す</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── 自社の商材 ─── */}
          {tab === 'product' && (
            <div className="cp-card-section cp-stack-sm">
              <p className="cp-h3" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <IconChip icon={Gift} color={persona.accentColor} size={18} />
                自社の商材
              </p>
              <p className="cp-meta">
                AI が「合う企業」を選ぶための土台です。
                {knowledge.length > 0 ? (
                  <> 蓄積済の <strong style={{ color: persona.accentColor }}>{knowledge.length} 件のナレッジ</strong> から自動で取り込めます。</>
                ) : (
                  <> 5〜10 行で何を売っているか書くか、ナレッジに資料を入れると自動取込できます。</>
                )}
              </p>

              {/* ナレッジから自動取込 (オーナー指示 2026-06-02: いちいち入力させない) */}
              {knowledge.length > 0 && (
                <button
                  onClick={extractFromKnowledge}
                  disabled={extractBusy}
                  className="cp-btn"
                  style={{
                    background: extractBusy ? 'var(--surface-3)' : `linear-gradient(135deg, ${persona.accentColor}22, ${persona.accentColor}0a)`,
                    border: `1px solid ${persona.accentColor}55`,
                    color: persona.accentColor,
                    fontWeight: 800,
                    padding: '10px 14px',
                    opacity: extractBusy ? 0.7 : 1,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}
                >
                  {extractBusy ? (
                    <><Brain size={15} strokeWidth={2.4} /><span>ナレッジを読んでいます…</span></>
                  ) : (
                    <><Sparkles size={15} strokeWidth={2.4} /><span>ナレッジ {knowledge.length} 件から自動で取り込む</span></>
                  )}
                </button>
              )}

              <textarea value={productDraft} onChange={e => setProductDraft(e.target.value)}
                placeholder={`ナレッジから取り込むか、自分で書いてもどちらでも OK\n\n例:\n弊社の商材: 飲食店向け予約管理 SaaS\n価格: 月¥9,800〜\nコア機能: 予約一元管理 / 顧客LTV分析 / LINE自動配信\nターゲット: 月50万円以上の売上がある飲食店\n強み: 客単価3,500円以上の店でリピート率を平均15%向上した実績`}
                rows={10} className="cp-textarea" />
              <button onClick={saveProduct} className="cp-btn cp-btn-primary"
                disabled={!!productSavedMsg}
                style={{ background: persona.accentColor, color: '#0a0a0f', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {productSavedMsg ? <><Check size={15} strokeWidth={2.6} /> AI 起動中…</> : '保存 → AI に今日の 5 社を選ばせる'}
              </button>
              {productSavedMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.35)',
                    color: '#34D399', fontSize: 12, fontWeight: 700,
                  }}
                >
                  {productSavedMsg}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// 商談台本の 1 ブロック (掴み / ヒアリング / 提案 / 反論 / クロージング)
function ScriptBlock({ icon: Icon, title, accent, children }: {
  icon: LucideIcon; title: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="cp-card-section" style={{ borderLeft: `3px solid ${accent}` }}>
      <p className="cp-tiny" style={{ color: accent, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} strokeWidth={2.4} /> {title}
      </p>
      {children}
    </div>
  );
}
