// ============================================================
// CompanySetupPage — /master/company-setup
// 株式会社CORE 法人設立トラッカー。オーナー専用 (isMasterAuth ゲート、AuditLog.tsx と同じ慣習)。
// ============================================================
import { useState } from 'react';
import { ArrowLeft, Home, ListChecks, Wallet, FileText, Settings as SettingsIcon } from 'lucide-react';
import { isMasterAuth } from '../../lib/billing';
import { useCompanySetup } from './useCompanySetup';
import { COLORS, FONT } from './tokens';
import TodayTab from './components/TodayTab';
import TasksTab from './components/TasksTab';
import PaymentsTab from './components/PaymentsTab';
import DocumentsTab from './components/DocumentsTab';
import SettingsTab from './components/SettingsTab';
import TaskDetailSheet from './components/TaskDetailSheet';

type TabKey = 'today' | 'tasks' | 'payments' | 'documents' | 'settings';

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: 'today', label: '今日', icon: Home },
  { key: 'tasks', label: 'タスク', icon: ListChecks },
  { key: 'payments', label: '支払い', icon: Wallet },
  { key: 'documents', label: '書類', icon: FileText },
  { key: 'settings', label: '設定', icon: SettingsIcon },
];

export default function CompanySetupPage() {
  const [authed] = useState(isMasterAuth);
  const [tab, setTab] = useState<TabKey>('today');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const cs = useCompanySetup();

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.ink, color: COLORS.text, padding: '4rem 1.5rem', fontFamily: FONT }}>
        <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>master key が必要です</h2>
          <p style={{ fontSize: 13.5, color: COLORS.mut, lineHeight: 1.7 }}>
            URL に <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>?master=GAUCHE2026</code> を付けて開くか、コンソールで<br />
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>localStorage.setItem('core_master_key_v1', 'GAUCHE2026')</code> のあと再読込してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.ink, color: COLORS.text, fontFamily: FONT, paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px 16px 8px' }}>
        <a href="/master" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, color: COLORS.mut, fontSize: 13, textDecoration: 'none', marginBottom: 4 }}>
          <ArrowLeft size={14} /> /master へ戻る
        </a>
        <div style={{ fontSize: 10, letterSpacing: '0.24em', color: COLORS.gold, fontWeight: 800, marginTop: 8 }}>CORE · COMPANY SETUP</div>
        <h1 style={{ fontSize: 'clamp(1.3rem, 4.5vw, 1.6rem)', fontWeight: 900, margin: '4px 0 14px' }}>株式会社CORE 設立</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 32px' }}>
        {tab === 'today' && <TodayTab cs={cs} onOpenTask={setOpenTaskId} />}
        {tab === 'tasks' && <TasksTab cs={cs} onOpenTask={setOpenTaskId} />}
        {tab === 'payments' && <PaymentsTab cs={cs} />}
        {tab === 'documents' && <DocumentsTab cs={cs} />}
        {tab === 'settings' && <SettingsTab cs={cs} />}
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(11,14,22,0.92)', backdropFilter: 'blur(14px)',
        borderTop: `1px solid ${COLORS.line}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex' }}>
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? COLORS.gold : COLORS.mut,
                }}
              >
                <Icon size={19} />
                <span style={{ fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {openTaskId && <TaskDetailSheet cs={cs} taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
}
