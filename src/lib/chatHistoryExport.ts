// ============================================================
// chatHistoryExport.ts — MobileGeminiDashboard 履歴の txt / md エクスポート
//
// オーナー指示 (2026-06-04 第 16 波 LLL):
//   「現在のチャットを txt で出力」と「全履歴 (全ペルソナ) を md で出力」
//   をペルソナごとに保存できる UI 用ヘルパー。
//
// STORAGE_KEY (MobileGeminiDashboard): core_mobile_gemini_v1:<personaId>
// ============================================================

const STORAGE_KEY = 'core_mobile_gemini_v1';

interface Msg {
  id: string;
  kind: 'user' | 'ai' | 'plan' | 'system';
  text?: string;
  ts: number;
  agentKey?: string;
}

function loadByPersona(personaId: string): Msg[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${personaId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function listAllPersonaKeys(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEY}:`)) {
        ids.push(k.slice(STORAGE_KEY.length + 1));
      }
    }
  } catch { /* */ }
  return ids;
}

function ts(t: number): string {
  return new Date(t).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function speaker(m: Msg): string {
  if (m.kind === 'user') return 'YOU';
  if (m.kind === 'ai') return 'AI';
  if (m.kind === 'plan') return 'PLAN';
  return 'SYS';
}

function toTxt(msgs: Msg[], heading: string): string {
  const lines: string[] = [];
  lines.push(heading);
  lines.push('='.repeat(Math.min(heading.length, 60)));
  lines.push('');
  for (const m of msgs) {
    lines.push(`[${ts(m.ts)}] ${speaker(m)}${m.agentKey ? ` (${m.agentKey})` : ''}`);
    lines.push(m.text || '');
    lines.push('');
  }
  return lines.join('\n');
}

function toMd(allByPersona: Record<string, Msg[]>): string {
  const parts: string[] = [];
  parts.push(`# CORE Prism チャット履歴 (全ペルソナ)`);
  parts.push('');
  parts.push(`出力日時: ${new Date().toISOString()}`);
  parts.push('');
  for (const [pid, msgs] of Object.entries(allByPersona)) {
    parts.push(`## ペルソナ: \`${pid}\` (${msgs.length} 件)`);
    parts.push('');
    if (msgs.length === 0) {
      parts.push('_(履歴なし)_');
      parts.push('');
      continue;
    }
    for (const m of msgs) {
      const head = `**${ts(m.ts)} — ${speaker(m)}${m.agentKey ? ` _${m.agentKey}_` : ''}**`;
      parts.push(head);
      parts.push('');
      parts.push((m.text || '').replace(/^/gm, '> '));
      parts.push('');
    }
  }
  return parts.join('\n');
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob(['﻿', content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** 現在のペルソナのチャットを txt でダウンロード */
export function downloadCurrentChatTxt(personaId: string, personaName: string): void {
  const msgs = loadByPersona(personaId);
  const heading = `${personaName} (${personaId}) — チャット履歴 ${msgs.length} 件 / 出力 ${new Date().toLocaleString('ja-JP')}`;
  const filename = `core-prism_chat_${personaName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  download(filename, toTxt(msgs, heading), 'text/plain');
}

/** 全ペルソナの全履歴を md で出力 */
export function downloadAllChatsMd(): void {
  const ids = listAllPersonaKeys();
  const all: Record<string, Msg[]> = {};
  for (const id of ids) all[id] = loadByPersona(id);
  const filename = `core-prism_chat_all_${new Date().toISOString().slice(0, 10)}.md`;
  download(filename, toMd(all), 'text/markdown');
}
