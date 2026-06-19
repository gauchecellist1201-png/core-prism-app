import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KnowledgeItem, Persona, AppSettings } from '../types/identity';
import AgentProposalCard from './AgentProposalCard';
import EmptyState from './EmptyState';
import { StudioIntro } from './StudioIntro';
import ContextualUpgradeCard from './ContextualUpgradeCard';
import { isAuthorized as isAuthorizedFn, loadBillingUser } from '../lib/billing';
import { sortRisksByPriority } from '../lib/riskPriority';
import { summarizeMeeting, stripCaptions } from '../lib/meetingSummarize';
import MeetingRecorder from './MeetingRecorder';
import {
  proposeKnowledgeUses, refineKnowledgeUse, expandKnowledgeUse,
  KNOWLEDGE_USE_LABEL, type KnowledgeUseKind, type KnowledgeUseProposal,
} from '../lib/analyzeKnowledge';

const USE_ICON: Record<KnowledgeUseKind, string> = {
  summary: '📋', action: '✅', share: '📤', decision: '⚖️', content: '✍️',
};

// ── 取込進捗 4 セグメント ─────────────────────────────────
// parsing(0-25) → tagging(25-50) → summarizing(50-85) → extracting(85-100) → done
type IngestStage = 'parsing' | 'tagging' | 'summarizing' | 'extracting' | 'done';
const STAGE_ORDER: IngestStage[] = ['parsing', 'tagging', 'summarizing', 'extracting'];
const STAGE_LABEL: Record<IngestStage, string> = {
  parsing:     'ファイル解析中…',
  tagging:     'タグ生成中…',
  summarizing: 'AI 要約生成中…',
  extracting:  '数字を抽出中…',
  done:        '完了',
};

function normalizeStage(s: KnowledgeItem['analysisStatus']): IngestStage | null {
  if (!s) return null;
  if (s === 'error') return null;
  if (s === 'pending') return 'parsing';   // 旧データ互換
  if (s === 'done') return 'done';
  return s as IngestStage;
}

function KnowledgeProgressBar({ status, accent }: { status: KnowledgeItem['analysisStatus']; accent: string }) {
  const stage = normalizeStage(status);
  if (!stage) return null;
  const currentIdx = stage === 'done' ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage);
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs flex-1" style={{ color: stage === 'done' ? 'rgba(255,255,255,0.55)' : accent }}>
          {stage === 'done' ? STAGE_LABEL.done : `🧠 ${STAGE_LABEL[stage]}`}
        </p>
        <p className="text-[10px] text-fg-subtle tabular-nums">
          {Math.min(currentIdx + (stage === 'done' ? 0 : 1), STAGE_ORDER.length)}/{STAGE_ORDER.length}
        </p>
      </div>
      <div className="flex gap-1" aria-hidden>
        {STAGE_ORDER.map((s, i) => {
          const done = stage === 'done' || i < currentIdx;
          const active = stage !== 'done' && i === currentIdx;
          return (
            <div
              key={s}
              className="flex-1 rounded-full overflow-hidden"
              style={{
                height: 4,
                background: done ? accent : active ? `${accent}55` : 'rgba(255,255,255,0.08)',
              }}
            >
              {active && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ height: '100%', width: '60%', background: accent }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="pt-3">
      <p className="text-xs tracking-wider mb-1.5" style={{ color }}>{title}</p>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-white/85 text-xs leading-relaxed flex gap-2">
            <span style={{ color }}>·</span>
            <span className="flex-1">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * リスク専用セクション: 重要度順 (致命的→重大→注意→参考) で並び替え、
 * 各項目に色付きラベルを付けて見やすくする (オーナー指示 2026-06-03)
 */
function RiskSection({ title, items }: { title: string; items: string[] }) {
  const sorted = sortRisksByPriority(items);
  if (sorted.length === 0) return null;
  return (
    <div className="pt-3">
      <p className="text-xs tracking-wider mb-2" style={{ color: '#f87171' }}>{title}</p>
      <ul className="space-y-1.5">
        {sorted.map((r, i) => (
          <li
            key={i}
            className="text-xs leading-relaxed flex items-start gap-2 rounded-md px-2 py-1.5"
            style={{
              background: `${r.color}14`,
              borderLeft: `3px solid ${r.color}`,
            }}
          >
            <span
              className="flex-shrink-0 rounded font-bold tracking-wider"
              style={{
                background: r.color,
                color: '#fff',
                fontSize: 9,
                padding: '2px 6px',
                lineHeight: 1.3,
                minWidth: 38,
                textAlign: 'center',
              }}
            >
              {r.label}
            </span>
            <span className="flex-1" style={{ color: '#fff', opacity: 0.9 }}>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  persona: Persona;
  settings: AppSettings;
  items: KnowledgeItem[];
  onAddFile: (file: File) => Promise<KnowledgeItem>;
  onAddNote: (title: string, content: string) => KnowledgeItem;
  onDelete: (id: string) => void;
  onReanalyze?: (id: string) => Promise<void>;
  onClose: () => void;
}

interface BatchProgress {
  total: number;
  done: number;
  current: string;
  failed: string[];
}

const SUPPORTED_EXT = new Set([
  'pdf','docx','pptx','xlsx','xls','csv','txt','md','markdown','json','html','htm',
  'xml','yaml','yml','log','tsv','png','jpg','jpeg','gif','webp','svg',
]);

async function walkEntry(entry: any): Promise<File[]> {
  if (entry.isFile) {
    return await new Promise<File[]>((resolve) => {
      entry.file((file: File) => resolve([file]), () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const allEntries: any[] = [];
    // readEntries returns up to 100 at a time, loop until empty
    const readBatch = (): Promise<void> => new Promise((resolve) => {
      reader.readEntries(async (entries: any[]) => {
        if (entries.length === 0) resolve();
        else { allEntries.push(...entries); readBatch().then(resolve); }
      }, () => resolve());
    });
    await readBatch();
    const files: File[] = [];
    for (const e of allEntries) {
      const sub = await walkEntry(e);
      files.push(...sub);
    }
    return files;
  }
  return [];
}

function isSupported(name: string): boolean {
  const ext = name.toLowerCase().split('.').pop() || '';
  return SUPPORTED_EXT.has(ext);
}

export default function KnowledgeBase({ persona, settings, items, onAddFile, onAddNote, onDelete, onReanalyze, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'propose' | 'list' | 'add-file' | 'add-note'>(items.length > 0 ? 'propose' : 'add-file');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedItem, setUploadedItem] = useState<KnowledgeItem | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const meetingInputRef = useRef<HTMLInputElement>(null);
  const [meetingProcessing, setMeetingProcessing] = useState<string | null>(null);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingDone, setMeetingDone] = useState<string | null>(null);
  const [showRecorder, setShowRecorder] = useState(false);

  // 取り込み成功トーストは 4 秒で自動的に消す（うるさくしない）
  useEffect(() => {
    if (!meetingDone) return;
    const t = setTimeout(() => setMeetingDone(null), 4000);
    return () => clearTimeout(t);
  }, [meetingDone]);

  // ── 先回り提案: AI が「この資料こう活かせます」を 3 案先出し ──
  const [proposals, setProposals] = useState<KnowledgeUseProposal[]>([]);
  const [proposalsBusy, setProposalsBusy] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // ── 横断インサイト: 全資料を一度に読んで「気づき」を抽出 (オーナー指示 2026-05-28) ──
  const [crossBusy, setCrossBusy] = useState(false);
  const runCrossInsight = useCallback(async () => {
    if (items.length === 0) return;
    setCrossBusy(true);
    try {
      const digest = items.slice(0, 40).map((k, i) => {
        const sum = k.analysis?.summary || k.content.slice(0, 160);
        return `${i + 1}. ${k.title}: ${sum.slice(0, 180)}`;
      }).join('\n');
      const sys = `あなたは経営参謀です。バラバラの資料を横断して読み、1 件ずつ見てるだけでは気づけない
「点と点をつなぐ気づき」を出します。やさしい日本語、専門用語は使わない。
返答は本文のみ (JSON 不要)。以下の 3 ブロックを短く:

【見えてきたパターン】3 行
散らばった資料に共通する流れ・繰り返し・方向性。

【見落としているかもしれない機会】3 行
資料同士を組み合わせると見える、まだ手をつけてない事業チャンス。

【今すぐ確かめるべき問い】3 つ
この資料群から、社長が今週中に答えを出すべき問い。`;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.preferredModel,
          max_tokens: 1500,
          system: sys,
          messages: [{ role: 'user', content: `# 事業: ${persona.name}\n\n# 蓄積資料 ${items.length} 件 (抜粋)\n${digest}\n\n上記を横断して、点をつなぐ気づきを出してください。` }],
        }),
      });
      if (!res.ok) throw new Error('AI エラー');
      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      if (text.trim()) setResult({ title: `🔮 ${items.length} 件の資料を横断した気づき`, body: text.trim() });
    } catch {
      setResult({ title: '横断インサイト', body: 'いま混み合っているようです。少し待ってからもう一度お試しください。' });
    } finally {
      setCrossBusy(false);
    }
  }, [items, persona.name, settings.preferredModel]);

  const loadProposals = useCallback(async () => {
    if (items.length === 0) return;
    setProposalsBusy(true);
    setProposalError(null);
    setResult(null);
    try {
      const list = await proposeKnowledgeUses({ settings, persona, knowledge: items });
      setProposals(list);
    } catch (e) {
      setProposalError(e instanceof Error ? e.message : String(e));
    } finally {
      setProposalsBusy(false);
    }
  }, [settings, persona, items]);

  // 起動時に 1 回だけ自動で活用提案を取りに行く
  useEffect(() => {
    if (items.length > 0) loadProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = useCallback(async (idx: number) => {
    const p = proposals[idx];
    if (!p) return;
    setBusyIdx(idx);
    setProposalError(null);
    try {
      const body = await expandKnowledgeUse({ settings, persona, proposal: p, knowledge: items });
      setResult({ title: p.title, body });
    } catch (e) {
      setProposalError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyIdx(null);
    }
  }, [proposals, settings, persona, items]);

  const handleRefine = useCallback(async (idx: number, instruction: string) => {
    const p = proposals[idx];
    if (!p) return;
    setBusyIdx(idx);
    setProposalError(null);
    try {
      const refined = await refineKnowledgeUse({ settings, persona, proposal: p, instruction, knowledge: items });
      setProposals(prev => prev.map((x, i) => (i === idx ? refined : x)));
    } catch (e) {
      setProposalError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyIdx(null);
    }
  }, [proposals, settings, persona, items]);

  const handleCopyResult = useCallback(() => {
    if (!result) return;
    navigator.clipboard?.writeText(result.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => { /* クリップボード非対応でも表示は残るので無視 */ });
  }, [result]);

  const handleFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const item = await onAddFile(file);
      setUploadedItem(item);
      setTimeout(() => { setUploadedItem(null); setTab('list'); }, 2000);
    } finally {
      setIsUploading(false);
    }
  }, [onAddFile]);

  const handleBatch = useCallback(async (files: File[]) => {
    const supported = files.filter(f => isSupported(f.name));
    if (supported.length === 0) return;
    setBatchProgress({ total: supported.length, done: 0, current: '', failed: [] });
    const failed: string[] = [];
    for (let i = 0; i < supported.length; i++) {
      const f = supported[i];
      setBatchProgress({ total: supported.length, done: i, current: f.name, failed: [...failed] });
      try {
        await onAddFile(f);
      } catch (err) {
        failed.push(f.name);
      }
    }
    setBatchProgress({ total: supported.length, done: supported.length, current: '', failed });
    setTimeout(() => {
      setBatchProgress(null);
      setTab('list');
    }, 2500);
  }, [onAddFile]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items;
    const allFiles: File[] = [];
    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      // Folder + file drop
      const entryPromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry();
        if (entry) entryPromises.push(walkEntry(entry));
      }
      const results = await Promise.all(entryPromises);
      results.forEach(r => allFiles.push(...r));
    } else {
      // Fallback to flat file list
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        allFiles.push(e.dataTransfer.files[i]);
      }
    }
    if (allFiles.length === 1) {
      handleFile(allFiles[0]);
    } else if (allFiles.length > 1) {
      handleBatch(allFiles);
    }
  }, [handleFile, handleBatch]);

  const handleMultipleSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr: File[] = [];
    for (let i = 0; i < files.length; i++) arr.push(files[i]);
    if (arr.length === 1) handleFile(arr[0]);
    else handleBatch(arr);
  }, [handleFile, handleBatch]);

  // ── 会議録画 → AI 要約 → ナレッジ追加 (オーナー指示 2026-06-03) ──
  const handleMeetingFile = useCallback(async (file: File) => {
    setMeetingError(null);
    setMeetingDone(null);
    setMeetingProcessing('文字起こしを読み込み中');
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let transcript = '';
      if (ext === 'vtt' || ext === 'srt' || ext === 'txt') {
        // 字幕 / プレーンテキストは直接読む
        transcript = await file.text();
        transcript = stripCaptions(transcript);
      } else {
        // 音声/動画は Gemini で文字起こし (audioTranscribe.ts を流用)
        setMeetingProcessing('AI で文字起こし中 (1-3 分)');
        const { transcribeAudioFile } = await import('../lib/audioTranscribe');
        transcript = await transcribeAudioFile(file);
      }
      if (!transcript || transcript.length < 50) {
        throw new Error('会議の内容を読み取れませんでした。字幕ファイル (.vtt / .srt) があればそちらをお使いください。');
      }
      setMeetingProcessing('AI で要約中');
      const summary = await summarizeMeeting({
        transcript,
        fileName: file.name,
        date: new Date().toISOString(),
      });
      // ナレッジに登録 (addNote 経由で content + title)
      const noteContent = [
        `【会議要約】${summary.title}`,
        `日時: ${new Date(summary.date).toLocaleString('ja-JP')}`,
        `ソース: ${summary.source}`,
        summary.participants.length ? `参加者: ${summary.participants.join(' / ')}` : '',
        '',
        '## 1 行サマリ',
        summary.analysis.summary,
        '',
        '## 決定事項',
        ...summary.keyDecisions.map(d => `- ${d}`),
        '',
        '## アクション',
        ...summary.actionItems.map(a =>
          `- ${a.text}${a.owner ? ` (${a.owner})` : ''}${a.due ? ` ▶ ${a.due}` : ''}`
        ),
        '',
        summary.openQuestions.length ? '## 持ち越し論点' : '',
        ...summary.openQuestions.map(q => `- ${q}`),
        '',
        '## 元の文字起こし',
        transcript.slice(0, 8000) + (transcript.length > 8000 ? '\n…(以下省略)' : ''),
      ].filter(Boolean).join('\n');

      onAddNote(`📹 ${summary.title}`, noteContent);
      setMeetingProcessing(null);
      setMeetingDone(`「${summary.title}」をナレッジに取り込みました`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '会議の取り込みに失敗しました';
      setMeetingProcessing(null);
      setMeetingError(msg);
    }
  }, [onAddNote]);

  const handleSaveNote = () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    onAddNote(noteTitle, noteContent);
    setNoteTitle('');
    setNoteContent('');
    setTab('list');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const sourceIcon = (type: string) => ({ file: '📄', note: '🗒', url: '🔗', auto: '🤖' }[type] ?? '📄');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative ml-auto w-full max-w-lg h-full flex flex-col"
        style={{ background: '#0e0e18', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2">
            <span style={{ color: persona.accentColor }}>{persona.icon}</span>
            <div>
              <p className="text-fg text-sm font-light">{persona.name}</p>
              <p className="text-neutral-600 text-xs">ナレッジベース · {items.length}件</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-600 hover:text-fg-subtle text-xl flex items-center justify-center" style={{ minWidth: 44, minHeight: 44 }} aria-label="閉じる">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {[['propose', '✨ 活かし方'], ['list', '一覧'], ['add-file', 'ファイル追加'], ['add-note', 'ノート追加']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as typeof tab)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: tab === id ? persona.accentColorLight : 'transparent',
                color: tab === id ? persona.accentColor : '#4a4a6a',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 pt-3">
            <StudioIntro
              id="knowledge"
              accent={persona.accentColor}
              iconKey="knowledge"
              what="資料(PDF・議事録・メモ)を入れておくと、AI がそれを覚えて、これからの提案や下書きに自動で活かす場所です。"
              tryThis="「資料を追加」を押して、手元の PDF やメモを 1 枚入れてみる。"
              example="業界レポートを 1 枚入れる → そこから使える提案・戦略・気をつける点を AI が抜き出してくれます。"
              sampleLabel="入れると出ます"
              samplePreview={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.66rem', lineHeight: 1.35 }}>
                  <span style={{ color: persona.accentColor, fontWeight: 700 }}>● 提案 3 件</span>
                  <span style={{ opacity: 0.85 }}>● 戦略 2 件</span>
                  <span style={{ opacity: 0.7 }}>● 気をつける点 1 件</span>
                </div>
              }
            />
          </div>
          {/* 文脈型アップグレード提案 — 成果物 (ナレッジ) が貯まってきた人向け */}
          {items.length >= 20 && (() => {
            const user = loadBillingUser();
            const isOnFreePlan = !isAuthorizedFn() || (user?.plan === 'free');
            if (!isOnFreePlan) return null;
            return (
              <div className="p-3">
                <ContextualUpgradeCard
                  trigger="artifact-volume"
                  planName="標準プラン"
                  context={`${persona.name}に ${items.length} 件の資料がたまっています。`}
                  dismissKey={`kb-artifact-${persona.id}`}
                  accent={persona.accentColor}
                  onUpgrade={() => { window.location.href = '/pricing'; }}
                />
              </div>
            );
          })()}
          <AnimatePresence mode="wait">
            {tab === 'propose' && (
              <motion.div key="propose" className="p-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {items.length === 0 ? (
                  <EmptyState
                    iconKey="knowledge"
                    title="ナレッジはまだ空っぽです"
                    description={'PDF・議事録・メモを 1 枚入れるだけで、AI が「こう活かせます」を 3 つ提案します。\n資料は何度も再利用され、別の案件にも自動で効きます。'}
                    ctaLabel="資料を追加する"
                    onCta={() => setTab('add-file')}
                    accent={persona.accentColor}
                    preview="📕 業界レポート.pdf　→ 提案 3 件、戦略 2 件、リスク 1 件を抽出"
                  />
                ) : result ? (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium flex-1 min-w-0">{result.title}</p>
                      <button
                        onClick={() => setResult(null)}
                        className="text-xs text-white/60 hover:text-white flex-shrink-0"
                      >← 提案にもどる</button>
                    </div>
                    <div
                      className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap text-white/85"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', maxHeight: '52vh', overflowY: 'auto' }}
                    >
                      {result.body}
                    </div>
                    <button
                      onClick={handleCopyResult}
                      className="w-full py-2.5 rounded-lg text-sm font-medium"
                      style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                    >{copied ? '✓ コピーしました' : '📋 まるごとコピー'}</button>
                  </motion.div>
                ) : proposalsBusy ? (
                  <div className="text-center py-12">
                    <motion.div
                      animate={{ scale: [1, 1.12, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        width: 60, height: 60, borderRadius: '50%', margin: '0 auto 0.9rem',
                        background: `radial-gradient(circle, ${persona.accentColor} 0%, ${persona.accentColor}55 60%, transparent 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                      }}
                    >🧠</motion.div>
                    <p className="text-white text-sm font-medium">AI が資料の活かし方を考えています…</p>
                  </div>
                ) : (
                  <>
                    {/* 横断インサイト — 全資料を一度に読んで点をつなぐ (オーナー指示 2026-05-28) */}
                    {items.length >= 2 && (
                      <button
                        onClick={runCrossInsight}
                        disabled={crossBusy}
                        className="w-full py-3 rounded-xl text-sm font-bold mb-1"
                        style={{
                          background: `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}cc)`,
                          color: '#fff', border: 'none', cursor: crossBusy ? 'wait' : 'pointer',
                          boxShadow: `0 8px 20px ${persona.accentColor}44`, opacity: crossBusy ? 0.6 : 1,
                        }}
                      >
                        {crossBusy ? '🧠 全資料を横断して考え中…' : `🔮 ${items.length} 件を横断して「気づき」を出す`}
                      </button>
                    )}
                    <p className="text-white/60 text-xs leading-relaxed">
                      ためた {items.length} 件の資料から、AI が「こう活かせます」を先に提案します。
                      よければ <strong style={{ color: persona.accentColor }}>✓ 承認</strong> で成果物まで作ります。
                    </p>
                    <AnimatePresence>
                      {proposals.map((p, i) => (
                        <AgentProposalCard
                          key={p.title + i}
                          icon={USE_ICON[p.kind] || '✨'}
                          title={p.title}
                          reason={p.reason}
                          accentColor={persona.accentColor}
                          draft={p.hook}
                          meta={`活用: ${KNOWLEDGE_USE_LABEL[p.kind]}${p.sourceTitle ? ` ／ 資料: ${p.sourceTitle}` : ''}`}
                          approveLabel="✓ 承認して成果物を作る"
                          busy={busyIdx === i}
                          onApprove={() => handleApprove(i)}
                          onRefine={(ins) => handleRefine(i, ins)}
                          onDismiss={() => setProposals(prev => prev.filter((_, idx) => idx !== i))}
                        />
                      ))}
                    </AnimatePresence>

                    {proposals.length === 0 && !proposalError && (
                      <div className="text-center py-8">
                        <p className="text-neutral-500 text-sm mb-3">提案がまだありません</p>
                        <button
                          onClick={loadProposals}
                          className="text-xs px-4 py-2 rounded-lg font-medium"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                        >🔄 AI に考えてもらう</button>
                      </div>
                    )}

                    {proposalError && (
                      <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
                        <p className="text-red-300 text-xs">うまくいきませんでした: {proposalError}</p>
                        <button
                          onClick={loadProposals}
                          className="text-xs px-3 py-1.5 rounded-lg text-red-200"
                          style={{ border: '1px solid rgba(248,113,113,0.4)' }}
                        >🔄 もう一度ためす</button>
                      </div>
                    )}

                    {proposals.length > 0 && (
                      <button
                        onClick={loadProposals}
                        disabled={busyIdx !== null}
                        className="w-full py-2.5 rounded-lg text-xs font-medium"
                        style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                      >🔄 別の 3 案を出してもらう</button>
                    )}

                    <button
                      onClick={() => setTab('list')}
                      className="w-full text-xs text-white/45 hover:text-white/70 pt-1"
                    >▸ 自分で資料を1件ずつ見る</button>
                  </>
                )}
              </motion.div>
            )}

            {tab === 'list' && (
              <motion.div key="list" className="p-4 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {items.length === 0 ? (
                  <EmptyState
                    iconKey="folder"
                    title="一覧はまだ空っぽです"
                    description={'ここには取り込んだ資料が並びます。PDF、画像、議事録、メモ、なんでも入ります。\n中身は AI が要約してくれるので、長い資料も読み返しが楽になります。'}
                    ctaLabel="資料を追加する"
                    onCta={() => setTab('add-file')}
                    accent={persona.accentColor}
                    preview="📊 4月の事業計画.pptx (24 枚)　→ 要約済み"
                  />
                ) : (
                  items.map(item => {
                    const isOpen = expanded === item.id;
                    return (
                      <motion.div
                        key={item.id}
                        className="rounded-xl group"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <button
                          className="w-full p-3 text-left"
                          onClick={() => setExpanded(isOpen ? null : item.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <span className="text-base flex-shrink-0">{item.fileKind === 'image' ? '🖼' : sourceIcon(item.sourceType)}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-light truncate">{item.title}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {item.fileKind && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider"
                                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
                                      {item.fileKind}
                                    </span>
                                  )}
                                  <p className="text-white/50 text-xs">{item.chunks.length}チャンク</p>
                                  {item.pages && <p className="text-white/50 text-xs">{item.pages}ページ</p>}
                                  {item.fileSize && <p className="text-white/50 text-xs">{formatSize(item.fileSize)}</p>}
                                  <p className="text-white/50 text-xs">
                                    {new Date(item.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                  </p>
                                </div>
                                {item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {item.tags.map(tag => (
                                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
                                        style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* 分析ステータス */}
                                <div className="mt-2">
                                  {item.analysisStatus && item.analysisStatus !== 'done' && item.analysisStatus !== 'error' && (
                                    <KnowledgeProgressBar status={item.analysisStatus} accent={persona.accentColor} />
                                  )}
                                  {item.analysisStatus === 'error' && (
                                    <p className="text-xs text-red-400">分析エラー: {item.analysisError}</p>
                                  )}
                                  {item.analysisStatus === 'done' && item.analysis?.summary && (
                                    <p className="text-xs text-white/70 mt-1 line-clamp-2">{item.analysis.summary}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-white/50 text-sm flex-shrink-0">{isOpen ? '▾' : '▸'}</span>
                          </div>
                        </button>

                        {/* 展開: 分析結果 */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                {item.analysis ? (
                                  <>
                                    {item.analysis.insights.length > 0 && (
                                      <Section title="💡 重要ポイント" color={persona.accentColor} items={item.analysis.insights} />
                                    )}
                                    {item.analysis.strategy.length > 0 && (
                                      <Section title="🎯 戦略提案" color={persona.accentColor} items={item.analysis.strategy} />
                                    )}
                                    {item.analysis.actions.length > 0 && (
                                      <Section title="✓ アクション" color="#34d399" items={item.analysis.actions} />
                                    )}
                                    {item.analysis.risks.length > 0 && (
                                      <RiskSection title="⚠ リスク (重要度順)" items={item.analysis.risks} />
                                    )}
                                  </>
                                ) : (item.analysisStatus === 'done' || item.analysisStatus === 'error' || !item.analysisStatus) && (
                                  <p className="pt-3 text-white/60 text-xs">分析結果はまだありません</p>
                                )}
                                <div className="flex items-center gap-2 pt-2">
                                  {onReanalyze && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onReanalyze(item.id); }}
                                      className="text-xs px-3 py-1.5 rounded-lg transition-all"
                                      style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                                    >
                                      🔄 再分析
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                    className="text-xs px-3 py-1.5 rounded-lg text-white/60 hover:text-red-400 transition-all"
                                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}

            {tab === 'add-file' && (
              <motion.div key="add-file" className="p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {batchProgress ? (
                  <motion.div className="py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-4xl text-center mb-3">
                      {batchProgress.done === batchProgress.total ? '✅' : '🧠'}
                    </p>
                    <p className="text-fg text-base text-center font-medium">
                      {batchProgress.done === batchProgress.total
                        ? `${batchProgress.total} ファイル取り込み完了`
                        : `${batchProgress.done} / ${batchProgress.total} 処理中…`}
                    </p>
                    {batchProgress.current && (
                      <p className="text-fg-muted text-xs text-center mt-1 truncate px-4">
                        現在: {batchProgress.current}
                      </p>
                    )}
                    <div className="mt-4 mx-auto h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', maxWidth: '300px' }}>
                      <motion.div
                        className="h-full"
                        style={{ background: persona.accentColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                      />
                    </div>
                    {batchProgress.failed.length > 0 && (
                      <div className="mt-4 p-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
                        <p className="text-red-400 text-xs">
                          失敗 {batchProgress.failed.length}: {batchProgress.failed.slice(0, 3).join(', ')}{batchProgress.failed.length > 3 ? ' 他...' : ''}
                        </p>
                      </div>
                    )}
                  </motion.div>
                ) : uploadedItem ? (
                  <motion.div className="text-center py-16" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                    <p className="text-4xl mb-3">✅</p>
                    <p style={{ color: '#34d399' }} className="text-sm">追加完了</p>
                    <p className="text-fg-muted text-xs mt-1">{uploadedItem.title}</p>
                    <p className="text-fg-subtle text-xs">{uploadedItem.chunks.length}チャンクに分割</p>
                  </motion.div>
                ) : (
                  <>
                    <div
                      className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all mb-3"
                      style={{
                        borderColor: isDragging ? persona.accentColor : 'rgba(255,255,255,0.08)',
                        background: isDragging ? persona.accentColorLight : 'rgba(255,255,255,0.01)',
                      }}
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <p className="text-3xl">⏳</p>
                        </motion.div>
                      ) : (
                        <>
                          <p className="text-4xl mb-3">📂</p>
                          <p className="text-white text-base font-medium mb-1">フォルダごとドロップ可能</p>
                          <p className="text-white/70 text-xs">複数ファイル / フォルダ全体を一括取込 (再帰的)</p>
                          <p className="text-white/50 text-[10px] mt-2">PDF · Word · Excel · PowerPoint · CSV · 画像 · テキスト系</p>
                        </>
                      )}
                    </div>

                    {/* ファイル選択 + フォルダ選択ボタン */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 text-sm py-2.5 rounded-lg font-medium transition-all"
                        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                      >📄 ファイルを選択 (複数可)</button>
                      <button
                        onClick={() => folderInputRef.current?.click()}
                        className="flex-1 text-sm py-2.5 rounded-lg font-medium transition-all"
                        style={{ background: persona.accentColorLight, border: `1px solid ${persona.accentColor}50`, color: persona.accentColor }}
                      >📁 フォルダを選択</button>
                    </div>

                    {/* 会議の取り込み (オーナー指示 2026-06-03)
                        ① ブラウザで直接録音 (無料 Meet/Zoom でも OK)
                        ② ファイル取込 (録画済の人向け) */}
                    <button
                      onClick={() => setShowRecorder(true)}
                      className="w-full text-sm py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${persona.accentColor}, #E84B97)`,
                        border: 'none',
                        color: '#fff',
                        marginTop: 8,
                        boxShadow: `0 6px 18px ${persona.accentColor}44`,
                      }}
                    >
                      🎤 いま会議中? 録音して AI 要約
                    </button>
                    <p className="text-fg-muted text-xs text-center" style={{ marginTop: 6 }}>
                      Google Meet 無料・Zoom 無料・対面会議 すべて OK・マイクで聞かせるだけ
                    </p>

                    <button
                      onClick={() => meetingInputRef.current?.click()}
                      disabled={!!meetingProcessing}
                      className="w-full text-sm py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${persona.accentColor}40`,
                        color: 'var(--fg)',
                        marginTop: 10,
                      }}
                    >
                      {meetingProcessing
                        ? <>🧠 {meetingProcessing}…</>
                        : <>📁 録画済のファイルから取り込み</>}
                    </button>
                    <p className="text-fg-muted text-xs text-center" style={{ marginTop: 6 }}>
                      .vtt / .srt (字幕) or .mp4 / .m4a (音声/動画) を選択 → AI が要約 → ナレッジに
                    </p>

                    {/* 取り込み失敗 — 黙らせず、その場で「もう一度」復旧できるように (オーナールール: 復旧ボタン必須) */}
                    <AnimatePresence>
                      {meetingError && (
                        <motion.div
                          key="meeting-error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="rounded-xl p-3 flex flex-col gap-2"
                          style={{ marginTop: 10, background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.4)' }}
                          role="alert"
                        >
                          <p className="text-xs leading-relaxed" style={{ color: '#fda4af' }}>
                            ⚠ {meetingError}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setMeetingError(null); meetingInputRef.current?.click(); }}
                              className="flex-1 text-xs py-2 rounded-lg font-bold transition-all"
                              style={{ background: '#f43f5e', color: '#fff', minHeight: 40 }}
                            >🔄 もう一度ファイルを選ぶ</button>
                            <button
                              onClick={() => setMeetingError(null)}
                              className="text-xs px-3 rounded-lg transition-all"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--fg)', minHeight: 40 }}
                              aria-label="閉じる"
                            >✕</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 取り込み成功 — 成功も黙らない (4 秒で自動的に消える) */}
                    <AnimatePresence>
                      {meetingDone && (
                        <motion.div
                          key="meeting-done"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="rounded-xl p-3 flex items-center gap-2"
                          style={{ marginTop: 10, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.4)' }}
                          role="status"
                        >
                          <span className="text-sm">✓</span>
                          <p className="text-xs leading-relaxed flex-1" style={{ color: '#86efac' }}>{meetingDone}</p>
                          <button
                            onClick={() => setTab('list')}
                            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                            style={{ background: 'rgba(34,197,94,0.2)', color: '#86efac' }}
                          >一覧で見る</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input
                      ref={meetingInputRef}
                      type="file"
                      accept=".vtt,.srt,.txt,.mp4,.m4a,.webm,.mov,.wav,.mp3"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleMeetingFile(f);
                        e.target.value = '';
                      }}
                    />

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.xls,.pptx,.csv,.txt,.md,.markdown,.json,.html,.htm,.xml,.yaml,.yml,.log,.tsv,.png,.jpg,.jpeg,.gif,.webp,.svg"
                      className="hidden"
                      onChange={e => handleMultipleSelect(e.target.files)}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-ignore - webkitdirectory not in standard types
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={e => handleMultipleSelect(e.target.files)}
                    />

                    <div
                      className="p-3 rounded-xl"
                      style={{ background: `${persona.accentColor}10`, border: `1px solid ${persona.accentColor}30` }}
                    >
                      <p className="text-xs text-white/80 leading-relaxed">
                        🧠 <strong style={{ color: persona.accentColor }}>AI が自動で読み取り・分析</strong>:<br />
                        · 全形式からテキスト抽出 (PDF/PPTX/DOCX/XLSX/画像)<br />
                        · 要約・戦略・アクション・リスクを自動生成<br />
                        · <strong>決算書を入れると収支パネルが自動更新</strong> (新機能)
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {tab === 'add-note' && (
              <motion.div key="add-note" className="p-4 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div>
                  <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">タイトル</p>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={e => setNoteTitle(e.target.value)}
                    placeholder="例：Q1戦略メモ、会議議事録..."
                    className="w-full bg-transparent text-fg text-sm font-light outline-none border-b py-2"
                    style={{ borderColor: noteTitle ? persona.accentColor : 'rgba(255,255,255,0.1)' }}
                    autoFocus
                  />
                </div>
                <div>
                  <p className="text-neutral-600 text-xs tracking-wider uppercase mb-2">内容</p>
                  <textarea
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                    placeholder="この人格のAIが参照するナレッジを入力してください。&#10;会議メモ、戦略メモ、マニュアル、参考情報など何でもOKです。"
                    className="w-full bg-transparent text-fg text-sm font-light outline-none resize-none leading-relaxed"
                    style={{ minHeight: '200px' }}
                    rows={10}
                  />
                </div>
                <motion.button
                  onClick={handleSaveNote}
                  disabled={!noteTitle.trim() || !noteContent.trim()}
                  className="w-full py-3 rounded-xl text-sm font-light transition-all"
                  style={{
                    background: noteTitle && noteContent
                      ? `linear-gradient(135deg, ${persona.accentColor}, ${persona.accentColor}99)`
                      : 'rgba(255,255,255,0.05)',
                    color: noteTitle && noteContent ? '#0a0a0f' : '#2a2a4a',
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  ナレッジを保存
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* 会議録音 (オーナー指示 2026-06-03: 無料 Meet/Zoom でも使えるように) */}
      <AnimatePresence>
        {showRecorder && (
          <MeetingRecorder
            accentColor={persona.accentColor}
            onClose={() => setShowRecorder(false)}
            onSavedToKnowledge={(title, content) => {
              onAddNote(title, content);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
