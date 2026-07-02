// ============================================================
// TeamSettings — 「あなたの会社のチーム」管理 UI
//
// オーナー指示 (2026-06-04 第 18 波 QQQ):
//   親 user が他メンバーを 1 タップで招待。
//   メンバー一覧 + 権限変更 + 削除 + 招待リンクコピー。
//
// 保存: localStorage `core_team_members_v1` (本番は Supabase に移行する想定)
// 招待メール: /api/team/invite (Resend 経由)
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Trash2, Copy, Check, Mail, Crown, Pencil, Eye, ArrowRight, X } from 'lucide-react';
import { confirmAction } from '../lib/confirmDialog';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  loadMembers, addInvite, updateRole, removeMember, hardDelete,
  buildInviteUrl, ROLE_META,
  type TeamMember, type TeamRole,
} from '../lib/teamMembers';
import { loadBillingUser } from '../lib/billing';

const ROLE_ICONS: Record<TeamRole, React.ReactNode> = {
  admin:  <Crown size={12} />,
  editor: <Pencil size={12} />,
  viewer: <Eye size={12} />,
};

export default function TeamSettings() {
  const [members, setMembers] = useState<TeamMember[]>(loadMembers);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('editor');
  const [sending, setSending] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 親 user
  const user = loadBillingUser();
  const parentEmail = user?.email || '';

  useEffect(() => {
    setMembers(loadMembers());
  }, []);

  const invite = async () => {
    setErr(null);
    if (!email.includes('@')) { setErr('正しいメールアドレスを入れてください'); return; }
    if (!parentEmail) { setErr('まずご自身のアカウントにサインインしてください'); return; }
    setSending(true);
    try {
      const m = addInvite(email, role, parentEmail);
      const inviteUrl = buildInviteUrl(m.inviteToken || m.id);
      const res = await fetchWithTimeout('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitedBy: parentEmail,
          email,
          role,
          inviteUrl,
          parentBrand: window.location.pathname.startsWith('/iris') ? 'iris' : 'prism',
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setEmail('');
      setMembers(loadMembers());
    } catch (e) {
      setErr((e as Error)?.message || 'ネットワークエラー');
    } finally {
      setSending(false);
    }
  };

  const handleRole = (id: string, r: TeamRole) => {
    updateRole(id, r);
    setMembers(loadMembers());
  };

  const handleRemove = async (id: string) => {
    if (!(await confirmAction({ title: 'このメンバーを削除しますか?', tone: 'danger', okLabel: '削除する' }))) return;
    removeMember(id);
    setMembers(loadMembers());
  };

  const handleHardDelete = (id: string) => {
    hardDelete(id);
    setMembers(loadMembers());
  };

  const copyLink = (token: string) => {
    const url = buildInviteUrl(token);
    navigator.clipboard?.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const visibleMembers = members.filter(m => m.status !== 'removed');
  const removedMembers = members.filter(m => m.status === 'removed');

  return (
    <div style={{ color: 'var(--fg)', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      {/* 招待フォーム */}
      <div style={{
        padding: '1rem 1.1rem',
        borderRadius: 14,
        background: 'rgba(167,139,250,0.06)',
        border: '1px solid rgba(167,139,250,0.2)',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <UserPlus size={16} color="#a78bfa" />
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>メンバーを招待</div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['admin', 'editor', 'viewer'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              style={{
                padding: '6px 12px', borderRadius: 999,
                background: role === r ? `${ROLE_META[r].color}25` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${role === r ? ROLE_META[r].color : 'rgba(255,255,255,0.1)'}`,
                color: role === r ? ROLE_META[r].color : 'var(--fg-muted)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {ROLE_ICONS[r]} {ROLE_META[r].label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 8 }}>
          {ROLE_META[role].desc}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') invite(); }}
            placeholder="メンバーのメールアドレス"
            disabled={sending}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '10px 12px',
              color: 'var(--fg)',
              fontSize: '0.88rem',
              outline: 'none',
            }}
          />
          <button
            onClick={invite}
            disabled={sending || !email.includes('@')}
            style={{
              padding: '10px 16px', borderRadius: 10,
              background: sending || !email.includes('@')
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #a78bfa, #f472b6)',
              color: '#fff', border: 'none',
              fontSize: '0.88rem', fontWeight: 800,
              cursor: sending || !email.includes('@') ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Mail size={13} /> {sending ? '送信中…' : '招待'}
          </button>
        </div>

        {err && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#fda4af' }}>
            {err}
          </div>
        )}
        {!parentEmail && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-muted)' }}>
            ※ 招待元として あなたのメールアドレスが必要です (請求設定 → ログイン)
          </div>
        )}
      </div>

      {/* メンバー一覧 */}
      <div style={{
        padding: '0.5rem 0',
        fontSize: '0.65rem', letterSpacing: '0.2em',
        fontWeight: 800, color: 'var(--fg-muted)',
        marginBottom: 4,
      }}>
        メンバー ({visibleMembers.length})
      </div>
      {visibleMembers.length === 0 && (
        <div style={{
          padding: '20px 16px', textAlign: 'center',
          color: 'var(--fg-muted)', fontSize: '0.85rem',
          background: 'rgba(255,255,255,0.02)', borderRadius: 12,
        }}>
          まだメンバーがいません。上のフォームから招待してください。
        </div>
      )}

      <AnimatePresence initial={false}>
        {visibleMembers.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -8 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 6,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: ROLE_META[m.role].color + '33',
              color: ROLE_META[m.role].color,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800,
              flexShrink: 0,
            }}>
              {m.email.slice(0, 1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, wordBreak: 'break-all' }}>{m.email}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: ROLE_META[m.role].color, fontWeight: 700 }}>
                  {ROLE_ICONS[m.role]} {ROLE_META[m.role].label}
                </span>
                {m.status === 'invited' && <span>· 招待中</span>}
                {m.status === 'active' && <span>· アクティブ</span>}
              </div>
            </div>

            {m.status === 'invited' && m.inviteToken && (
              <button
                onClick={() => copyLink(m.inviteToken!)}
                title="招待リンクをコピー"
                style={{
                  padding: '6px 8px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--fg-muted)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 700,
                }}
              >
                {copiedToken === m.inviteToken ? <><Check size={12} /> コピー済</> : <><Copy size={12} /> リンク</>}
              </button>
            )}

            <select
              value={m.role}
              onChange={(e) => handleRole(m.id, e.target.value as TeamRole)}
              style={{
                padding: '6px 8px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--fg)',
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <option value="admin">管理者</option>
              <option value="editor">編集</option>
              <option value="viewer">閲覧</option>
            </select>

            <button
              onClick={() => handleRemove(m.id)}
              title="削除"
              aria-label="削除"
              style={{
                padding: 6, borderRadius: 8,
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: '#F87171', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {removedMembers.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: '0.65rem', letterSpacing: '0.2em',
            fontWeight: 800, color: 'var(--fg-muted)',
            marginBottom: 6,
          }}>
            削除済 ({removedMembers.length})
          </div>
          {removedMembers.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.02)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12, marginBottom: 4,
            }}>
              <X size={11} />
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{m.email}</span>
              <button
                onClick={() => handleHardDelete(m.id)}
                style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontSize: 10, padding: 4,
                }}
                title="完全に削除"
              >完全削除</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowRight size={11} /> 招待メールは即時送信されます (Resend が設定済の場合)。
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowRight size={11} /> 招待リンクは 招待 のままでも「リンクをコピー」から共有できます。
        </div>
      </div>
    </div>
  );
}
