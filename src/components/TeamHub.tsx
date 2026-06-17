// ============================================================
// TeamHub — チームコラボ管理 UI (Phase 5-2)
// ============================================================
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkspace } from '../hooks/useWorkspace';
import { StudioIntro } from './StudioIntro';
import type { MemberRole } from '../types/team';

const INVITE_BASE_URL = 'https://core-prism-app.vercel.app';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  editor: '編集者',
  viewer: '閲覧者',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner:  '#c9a96e',
  admin:  '#7c6fcf',
  editor: '#5dade2',
  viewer: '#58d68d',
};

interface Props {
  accentColor: string;
  onClose: () => void;
}

function loadMyEmail(): string {
  try {
    const raw = localStorage.getItem('core_billing_user_v1');
    if (raw) { const u = JSON.parse(raw); if (u?.email) return u.email; }
  } catch { /* */ }
  return '';
}

export default function TeamHub({ accentColor, onClose }: Props) {
  const {
    workspace,
    activeInvites,
    createWorkspace,
    generateInvite,
    removeMember,
    changeRole,
    revokeInvite,
  } = useWorkspace();

  const myEmail = loadMyEmail();
  const memberLimit = 5;

  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('editor');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  const handleCreateWorkspace = useCallback(() => {
    if (!workspaceName.trim()) return;
    createWorkspace(workspaceName.trim());
    setWorkspaceName('');
  }, [workspaceName, createWorkspace]);

  const handleGenerateInvite = useCallback(() => {
    const currentCount = workspace?.members.length ?? 1;
    if (currentCount >= memberLimit) {
      setUpgradeMsg(`現在は最大 ${memberLimit} 名まで招待できます。Pro/Studio プランで上限が拡張されます。`);
      return;
    }
    generateInvite(inviteRole, 7);
  }, [workspace, memberLimit, generateInvite, inviteRole]);

  const copyInviteLink = useCallback((code: string) => {
    const link = `${INVITE_BASE_URL}/?invite=${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    });
  }, []);

  const handleSnapshot = useCallback(() => {
    try {
      const snap = {
        timestamp: new Date().toISOString(),
        workspace,
        personas: localStorage.getItem('core_personas_v1'),
        knowledge: localStorage.getItem('core_knowledge_v1'),
      };
      localStorage.setItem('core_workspace_shared_snapshot_v1', JSON.stringify(snap));
      setSnapshotMsg('スナップショットを保存しました。メンバーが「同期」ボタンで取り込めます。');
      setTimeout(() => setSnapshotMsg(null), 4000);
    } catch {
      setSnapshotMsg('スナップショットの保存に失敗しました。');
    }
  }, [workspace]);

  const handleSyncSnapshot = useCallback(() => {
    try {
      const raw = localStorage.getItem('core_workspace_shared_snapshot_v1');
      if (!raw) { setSnapshotMsg('同期するスナップショットがありません。'); return; }
      const snap = JSON.parse(raw);
      if (snap.personas) localStorage.setItem('core_personas_v1', snap.personas);
      if (snap.knowledge) localStorage.setItem('core_knowledge_v1', snap.knowledge);
      setSnapshotMsg(`スナップショット (${new Date(snap.timestamp).toLocaleString('ja-JP')}) を取り込みました。リロードで反映されます。`);
      setTimeout(() => { setSnapshotMsg(null); window.location.reload(); }, 3000);
    } catch {
      setSnapshotMsg('同期に失敗しました。');
    }
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
      <motion.div
        className="relative w-full sm:max-w-xl max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: '#0e0e18', border: '1px solid rgba(255,255,255,0.1)' }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">👥</span>
            <h2 className="text-white font-semibold text-base">チームハブ</h2>
            {workspace && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${accentColor}22`, color: accentColor }}>
                {workspace.name}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all text-lg"
          >×</button>
        </div>

        <div className="p-5 space-y-6">
          <StudioIntro
            id="team-hub"
            accent={accentColor}
            iconKey="team"
            what="ひとつのワークスペースを家族や仲間と一緒に使う場所です。同じナレッジ(資料)と AI を共有して、別々のアカウントから触れます。"
            tryThis="「ワークスペースを作成」→「招待リンクを作る」を押す → 相手にコピーして送るだけで参加できます。"
            example="あなた (オーナー) + 編集者 2 名 + 閲覧者 2 名 = 最大 5 名まで同じデータを共有。"
            sampleLabel="作れる招待リンク"
            samplePreview={
              <div
                style={{
                  fontSize: 8,
                  lineHeight: 1.5,
                  color: 'var(--fg)',
                  padding: '6px 6px',
                }}
                aria-label="招待リンクのサンプル"
              >
                <div style={{ opacity: 0.6, marginBottom: 2 }}>編集者として招待 · 7 日間有効</div>
                <div
                  style={{
                    background: 'var(--surface-1)',
                    borderRadius: 4,
                    padding: '3px 5px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 7,
                    color: accentColor,
                    wordBreak: 'break-all',
                  }}
                >
                  core-prism-app.vercel.app/?invite=AB7K
                </div>
                <div style={{ opacity: 0.6, marginTop: 3 }}>📋 コピーして相手に送るだけ</div>
              </div>
            }
          />

          {/* メンバー数表示 */}
          <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-white/60">
              メンバー: <span className="text-white font-medium">{workspace?.members.length ?? 1} 名</span>
              {' / 上限 '}
              <span className="text-white font-medium">{memberLimit} 名</span>
            </span>
            <span className="text-white/40 text-xs">Phase 5-3 で Vercel KV 同期予定</span>
          </div>

          {/* ワークスペース未作成 */}
          {!workspace && (
            <div className="space-y-3">
              <p className="text-white/70 text-sm">ワークスペースを作成してチームを招待できます。</p>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  placeholder="ワークスペース名 (例: Gauche Studio)"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateWorkspace(); }}
                />
                <button
                  onClick={handleCreateWorkspace}
                  disabled={!workspaceName.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: accentColor }}
                >
                  作成
                </button>
              </div>
            </div>
          )}

          {workspace && (
            <>
              {/* メンバー一覧 */}
              <div className="space-y-2">
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">メンバー</h3>
                {workspace.members.map(member => {
                  const isMe = member.email === myEmail;
                  const myRole = workspace.members.find(m => m.email === myEmail)?.role;
                  const canEdit = myRole === 'owner' || myRole === 'admin';
                  return (
                    <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${accentColor}30`, color: accentColor }}>
                        {member.displayName[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium truncate">{member.displayName}</span>
                          {isMe && <span className="text-xs text-white/40">(あなた)</span>}
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `${ROLE_COLORS[member.role]}20`, color: ROLE_COLORS[member.role] }}>
                            {ROLE_LABELS[member.role]}
                          </span>
                        </div>
                        <p className="text-white/40 text-xs truncate">{member.email}</p>
                      </div>
                      {canEdit && !isMe && member.role !== 'owner' && (
                        <div className="flex items-center gap-1">
                          <select
                            className="text-xs rounded px-1.5 py-1 outline-none"
                            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none' }}
                            value={member.role}
                            onChange={e => changeRole(member.id, e.target.value as MemberRole)}
                          >
                            <option value="admin">管理者</option>
                            <option value="editor">編集者</option>
                            <option value="viewer">閲覧者</option>
                          </select>
                          <button
                            onClick={() => removeMember(member.id)}
                            className="text-xs px-2 py-1 rounded transition-all hover:bg-red-500/20 text-red-400"
                          >✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 招待リンク生成 */}
              <div className="space-y-3">
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">招待リンクを生成</h3>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value as MemberRole)}
                  >
                    <option value="admin">管理者として招待</option>
                    <option value="editor">編集者として招待</option>
                    <option value="viewer">閲覧者として招待</option>
                  </select>
                  <button
                    onClick={handleGenerateInvite}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 whitespace-nowrap"
                    style={{ background: accentColor }}
                  >
                    🔗 生成
                  </button>
                </div>
              </div>

              {/* 有効な招待一覧 */}
              {activeInvites.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider">未使用の招待</h3>
                  {activeInvites.map(invite => {
                    const link = `${INVITE_BASE_URL}/?invite=${invite.code}`;
                    const expiresIn = Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86400000);
                    const isCopied = copiedCode === invite.code;
                    return (
                      <div key={invite.code} className="flex items-center gap-2 p-2.5 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/80 text-xs font-mono truncate">{link}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ background: `${ROLE_COLORS[invite.role]}20`, color: ROLE_COLORS[invite.role] }}>
                              {ROLE_LABELS[invite.role]}
                            </span>
                            <span className="text-white/40 text-xs">あと {expiresIn} 日</span>
                          </div>
                        </div>
                        <button
                          onClick={() => copyInviteLink(invite.code)}
                          className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium flex-shrink-0"
                          style={{
                            background: isCopied ? '#22c55e22' : `${accentColor}22`,
                            color: isCopied ? '#22c55e' : accentColor,
                          }}
                        >
                          {isCopied ? '✓ コピー済' : 'コピー'}
                        </button>
                        <button
                          onClick={() => revokeInvite(invite.code)}
                          className="text-xs px-2 py-1.5 rounded-lg transition-all hover:bg-red-500/20 text-red-400"
                        >✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* データ共有スナップショット (デモ) */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowSnapshot(s => !s)}
                  className="flex items-center gap-2 text-white/60 text-xs hover:text-white/80 transition-colors"
                >
                  <span>{showSnapshot ? '▾' : '▸'}</span>
                  <span>データ共有 (スナップショット / デモ)</span>
                </button>
                <AnimatePresence>
                  {showSnapshot && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 rounded-xl space-y-2"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p className="text-white/50 text-xs">
                          オーナーがスナップショット作成 → メンバーが同期ボタンで取り込む簡易デモ。本番同期は Phase 5-3 で実装します。
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSnapshot}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: `${accentColor}22`, color: accentColor }}
                          >
                            📸 スナップショット作成
                          </button>
                          <button
                            onClick={handleSyncSnapshot}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            🔄 同期
                          </button>
                        </div>
                        {snapshotMsg && (
                          <p className="text-xs" style={{ color: accentColor }}>{snapshotMsg}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* アップグレード促進 */}
        <AnimatePresence>
          {upgradeMsg && (
            <motion.div
              className="mx-5 mb-5 p-4 rounded-xl"
              style={{ background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)' }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-yellow-300 text-sm">{upgradeMsg}</p>
              <button
                className="mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{ background: '#c9a96e', color: '#0a0a10' }}
                onClick={() => setUpgradeMsg(null)}
              >
                閉じる
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
