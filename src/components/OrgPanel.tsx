// ============================================================
// OrgPanel — 組織 (ワークスペース) メンバー管理
// Owner/Admin: 招待・ロール変更・削除
// Member: メンバー一覧のみ閲覧
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrg, inviteMember, changeRole, removeMember, type OrgRole } from '../lib/org';
import { isSupabaseConfigured } from '../lib/supabase';

interface Props {
  brand: 'iris' | 'prism';
  onClose: () => void;
}

export default function OrgPanel({ brand, onClose }: Props) {
  const { members, invitations, tenant, myRole, loading, refresh } = useOrg();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const accent = brand === 'iris' ? '#E1306C' : '#0033A0';
  const grad = brand === 'iris'
    ? 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)'
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  const canManage = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  const handleInvite = async () => {
    if (!inviteEmail.includes('@')) {
      setMsg({ kind: 'err', text: '有効なメールアドレスを入力してください' });
      return;
    }
    setBusy(true);
    const r = await inviteMember({ email: inviteEmail, role: inviteRole, brand });
    setBusy(false);
    setMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    if (r.ok) {
      setInviteEmail('');
      refresh();
    }
  };

  const handleRoleChange = async (membershipId: string, role: OrgRole) => {
    setBusy(true);
    const r = await changeRole(membershipId, role);
    setBusy(false);
    setMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    if (r.ok) refresh();
  };

  const handleRemove = async (membershipId: string, email: string | null) => {
    if (!confirm(`${email || 'このメンバー'} を組織から削除しますか?`)) return;
    setBusy(true);
    const r = await removeMember(membershipId);
    setBusy(false);
    setMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    if (r.ok) refresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 24, padding: '1.5rem',
          maxWidth: 560, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto',
          fontFamily: 'Inter, -apple-system, sans-serif', color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accent, fontWeight: 700, textTransform: 'uppercase' }}>
              {brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · 組織
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0' }}>
              {tenant?.name || 'ワークスペース'}
            </h2>
            {myRole && (
              <span style={{
                display: 'inline-block', marginTop: '0.4rem',
                background: grad, color: '#fff',
                padding: '0.2rem 0.65rem', borderRadius: 999,
                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                あなた: {myRole}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: '0.9rem',
          }}>✕</button>
        </div>

        {!isSupabaseConfigured && (
          <div style={{
            padding: '1rem', borderRadius: 12, marginBottom: '1rem',
            background: '#FEF3C7', border: '1px solid #FCD34D', fontSize: '0.85rem', color: '#92400E',
          }}>
            ⚠ Supabase 未接続のためチーム機能はオフラインです。<br />
            個人ワークスペースとして利用できます。
          </div>
        )}

        {/* 招待フォーム */}
        {canManage && isSupabaseConfigured && (
          <div style={{
            padding: '1.1rem', borderRadius: 16,
            background: `${accent}0a`, border: `1px solid ${accent}33`,
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.7rem' }}>新規メンバーを招待</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <input
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{
                  flex: 1, padding: '0.6rem 0.9rem', borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as OrgRole)}
                style={{
                  padding: '0.6rem 0.9rem', borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.9rem',
                  background: '#fff', cursor: 'pointer',
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                {isOwner && <option value="owner">Owner</option>}
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={busy || !inviteEmail}
              style={{
                width: '100%', background: grad, color: '#fff',
                border: 'none', borderRadius: 999,
                padding: '0.7rem', fontSize: '0.9rem', fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy || !inviteEmail ? 0.6 : 1,
              }}
            >
              {busy ? '送信中…' : '招待メールを送る'}
            </button>
          </div>
        )}

        {/* メッセージ */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                padding: '0.7rem 1rem', borderRadius: 10, marginBottom: '1rem',
                fontSize: '0.85rem',
                background: msg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
                border: msg.kind === 'ok' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                color: msg.kind === 'ok' ? '#166534' : '#9B1B30',
              }}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* メンバー一覧 */}
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8A8593', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
          メンバー ({members.length})
        </div>
        {loading ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#8A8593' }}>読み込み中…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#8A8593', fontSize: '0.85rem' }}>
            まだメンバーがいません
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {members.map(m => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', borderRadius: 12,
                background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.email || '(招待中)'} {m.is_self && <span style={{ color: accent }}>(あなた)</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#8A8593' }}>
                    参加: {new Date(m.joined_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                {isOwner && !m.is_self ? (
                  <>
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value as OrgRole)}
                      disabled={busy}
                      style={{
                        padding: '0.3rem 0.5rem', borderRadius: 8,
                        border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.8rem',
                        background: '#fff', cursor: 'pointer', marginRight: '0.4rem',
                      }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      onClick={() => handleRemove(m.id, m.email)}
                      disabled={busy}
                      title="削除"
                      style={{
                        background: 'transparent', border: '1px solid rgba(200,16,46,0.3)',
                        color: '#DC2626', borderRadius: 8, padding: '0.3rem 0.55rem',
                        fontSize: '0.8rem', cursor: 'pointer',
                      }}
                    >✕</button>
                  </>
                ) : (
                  <span style={{
                    background: m.role === 'owner' ? grad : 'rgba(0,0,0,0.06)',
                    color: m.role === 'owner' ? '#fff' : '#5A5562',
                    padding: '0.25rem 0.65rem', borderRadius: 999,
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    {m.role}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 保留中の招待 */}
        {invitations.length > 0 && (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#8A8593', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
              保留中の招待 ({invitations.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{
                  padding: '0.6rem 0.9rem', borderRadius: 10,
                  background: '#FFFBEB', border: '1px solid #FCD34D',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.85rem',
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{inv.email}</div>
                    <div style={{ fontSize: '0.72rem', color: '#8A8593' }}>
                      {inv.role} · 期限 {new Date(inv.expires_at).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
