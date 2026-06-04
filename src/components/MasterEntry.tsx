// ============================================================
// MasterEntry — オーナー専用「全機能解放」画面
// /master URL で表示。マスターキー + Claude API キーを入力すると
// localStorage に保存され、以降すべてのAIリクエストが Claude API 直叩きになる
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { resetCircuit } from '../lib/apiQueue';
import { confirmAction } from '../lib/confirmDialog';

const MASTER_KEY_STORAGE = 'core_master_key_v1';
const CLAUDE_KEY_STORAGE = 'core_claude_api_key_v1';
const EXPECTED_MASTER = 'GAUCHE2026';

export default function MasterEntry() {
  const [master, setMaster] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [showClaude, setShowClaude] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    setMaster(localStorage.getItem(MASTER_KEY_STORAGE) || '');
    setClaudeKey(localStorage.getItem(CLAUDE_KEY_STORAGE) || '');
  }, []);

  const isMasterValid = master === EXPECTED_MASTER;
  const claudeValid = useMemo(() => /^sk-ant-[\w-]{20,}/.test(claudeKey.trim()), [claudeKey]);

  const handleSave = () => {
    if (master.trim()) {
      localStorage.setItem(MASTER_KEY_STORAGE, master.trim());
    } else {
      localStorage.removeItem(MASTER_KEY_STORAGE);
    }
    if (claudeKey.trim()) {
      localStorage.setItem(CLAUDE_KEY_STORAGE, claudeKey.trim());
    } else {
      localStorage.removeItem(CLAUDE_KEY_STORAGE);
    }
    // 保存と同時に Gemini 由来の Circuit Breaker を解除 (マスター経路は別)
    resetCircuit();
    setSavedAt(Date.now());
  };

  const handleClear = async () => {
    if (!(await confirmAction({ title: 'マスター設定を全て解除しますか?', body: '保存されたマスターキーと Claude API キーが消えます。', tone: 'danger', okLabel: '解除する' }))) return;
    localStorage.removeItem(MASTER_KEY_STORAGE);
    localStorage.removeItem(CLAUDE_KEY_STORAGE);
    setMaster('');
    setClaudeKey('');
    setTestStatus('idle');
    setTestMessage('');
    setSavedAt(Date.now());
  };

  const handleTest = async () => {
    handleSave(); // 先に保存
    setTestStatus('testing');
    setTestMessage('Claude API に接続中…');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-master-key': master.trim(),
          ...(claudeKey.trim() ? { 'x-claude-api-key': claudeKey.trim() } : {}),
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 80,
          system: 'Reply ONLY with the word "OK" — nothing else.',
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j?.error?.message || j?.userMessage || j?.message || detail;
        } catch { /* ignore */ }
        setTestStatus('fail');
        setTestMessage(detail);
        return;
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text || '';
      setTestStatus('ok');
      setTestMessage(`✓ Claude API 接続 OK (応答: "${text.slice(0, 30)}")`);
    } catch (e) {
      setTestStatus('fail');
      setTestMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const goToApp = (brand?: 'prism' | 'iris') => {
    handleSave();
    setTimeout(() => {
      if (brand === 'iris') {
        window.location.href = '/iris?app=1';
      } else {
        window.location.href = '/?app=1';
      }
    }, 200);
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at 30% 20%, rgba(168,85,247,0.18), transparent 50%), radial-gradient(circle at 70% 80%, rgba(244,63,94,0.18), transparent 50%), #050510',
        color: '#fff',
        padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px max(16px, env(safe-area-inset-bottom, 16px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(15,15,25,0.7)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: 'clamp(20px, 5vw, 32px) clamp(16px, 5vw, 28px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 44,
              marginBottom: 8,
              filter: 'drop-shadow(0 0 16px rgba(255,180,80,0.6))',
            }}
          >
            👑
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              background:
                'linear-gradient(135deg, #ff6b6b, #f59e0b, #fbbf24, #84cc16, #10b981, #06b6d4, #8b5cf6, #ec4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 100%',
              backgroundClip: 'text',
            }}
          >
            CORE Master Mode
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            オーナー専用 · Claude API で全機能をフル解放
          </p>
        </div>

        {/* マスターキー */}
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
            }}
          >
            Master Key
          </label>
          <input
            type="password"
            value={master}
            onChange={e => setMaster(e.target.value)}
            placeholder="GAUCHE2026"
            autoComplete="off"
            style={{
              width: '100%',
              marginTop: 6,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${isMasterValid ? 'rgba(132,204,22,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: '#fff',
              fontSize: 16,
              fontFamily: 'monospace',
              outline: 'none',
              letterSpacing: '0.05em',
            }}
          />
          {isMasterValid && (
            <p style={{ fontSize: 11, color: '#a3e635', marginTop: 4 }}>
              ✓ マスターキー一致 — Claude API 経路が有効になります
            </p>
          )}
        </div>

        {/* Claude API キー */}
        <div style={{ marginBottom: 22 }}>
          <label
            style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Claude API Key</span>
            <button
              type="button"
              onClick={() => setShowClaude(s => !s)}
              style={{
                fontSize: 12,
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                textTransform: 'none',
                letterSpacing: 0,
                padding: '6px 8px',
                minHeight: 32,
              }}
            >
              {showClaude ? '隠す' : '表示'}
            </button>
          </label>
          <input
            type={showClaude ? 'text' : 'password'}
            value={claudeKey}
            onChange={e => setClaudeKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%',
              marginTop: 6,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${claudeValid ? 'rgba(132,204,22,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: '#fff',
              fontSize: 16,
              fontFamily: 'monospace',
              outline: 'none',
            }}
          />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
            {claudeValid
              ? '✓ 有効な形式の API キー — リクエストごとに直接 Anthropic へ送信されます'
              : 'console.anthropic.com の API キーを貼り付けてください (sk-ant-... で始まる)'}
          </p>
        </div>

        {/* 状態バッジ */}
        <div
          style={{
            background: isMasterValid
              ? 'linear-gradient(135deg, rgba(132,204,22,0.15), rgba(34,197,94,0.1))'
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isMasterValid ? 'rgba(132,204,22,0.3)' : 'rgba(255,255,255,0.08)'}`,
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 22,
          }}
        >
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: isMasterValid ? '#a3e635' : '#fbbf24' }}>
              {isMasterValid ? '👑 マスターモード ON' : '⚙ 通常モード'}
            </strong>
            <br />
            {isMasterValid
              ? `すべての AI リクエストは ${claudeValid ? '入力された Claude API キー' : 'サーバ側 (Vercel env) の Claude キー'} 経由で実行されます。Gemini 経由のクオータ制限は完全にバイパスされます。`
              : 'ユーザー全般と同じ Gemini API 経由で動作中。マスターキーを入力すると Claude API 経路に切替わります。'}
          </p>
        </div>

        {/* アクション */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316, #f59e0b)',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
            }}
          >
            {savedAt && Date.now() - savedAt < 2000 ? '✓ 保存しました' : '保存'}
          </button>
          <button
            onClick={handleTest}
            disabled={!isMasterValid || testStatus === 'testing'}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background:
                testStatus === 'ok'
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : testStatus === 'fail'
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: !isMasterValid || testStatus === 'testing' ? 'not-allowed' : 'pointer',
              opacity: !isMasterValid ? 0.4 : 1,
            }}
          >
            {testStatus === 'testing' ? '接続中…' : testStatus === 'ok' ? '✓ 接続成功' : testStatus === 'fail' ? '× 失敗' : '接続テスト'}
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            解除
          </button>
        </div>

        {/* テスト結果 */}
        {testStatus !== 'idle' && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 12,
              lineHeight: 1.6,
              background:
                testStatus === 'ok'
                  ? 'rgba(34,197,94,0.12)'
                  : testStatus === 'fail'
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(255,255,255,0.04)',
              border: `1px solid ${
                testStatus === 'ok'
                  ? 'rgba(34,197,94,0.35)'
                  : testStatus === 'fail'
                  ? 'rgba(239,68,68,0.35)'
                  : 'rgba(255,255,255,0.1)'
              }`,
              color:
                testStatus === 'ok'
                  ? '#a3e635'
                  : testStatus === 'fail'
                  ? '#fca5a5'
                  : 'rgba(255,255,255,0.7)',
            }}
          >
            {testMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => goToApp('prism')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background:
                'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(236,72,153,0.3))',
              border: '1px solid rgba(168,85,247,0.4)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ▸ Prism へ進む
          </button>
          <button
            onClick={() => goToApp('iris')}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 12,
              background:
                'linear-gradient(135deg, rgba(236,72,153,0.3), rgba(244,63,94,0.3))',
              border: '1px solid rgba(236,72,153,0.4)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ▸ Iris へ進む
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <a
            href="/master/ai-stats"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#a7f3d0',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            📊 AI 使用量ダッシュボード
          </a>
          <a
            href="/master/ai-cost"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.35)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            💸 AI コスト試算
          </a>
          <a
            href="/master/secrets-health"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(167,139,250,0.12)',
              border: '1px solid rgba(167,139,250,0.35)',
              color: '#ddd6fe',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            🔑 Secrets Health
          </a>
          <a
            href="/master/onboard-funnel"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.35)',
              color: '#c7d2fe',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            📊 オンボ ファネル
          </a>
          <a
            href="/master/revenue-dashboard"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.35)',
              color: '#a7f3d0',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            💴 12ヶ月 売上 + MRR
          </a>
          <a
            href="/master/roadmap-votes"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(236,72,153,0.12)',
              border: '1px solid rgba(236,72,153,0.35)',
              color: '#fbcfe8',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            ♡ ロードマップ 投票
          </a>
          <a
            href="/master/web-vitals"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.35)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            🎚️ Web Vitals
          </a>
          <a
            href="/master/audit-log"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(148,163,184,0.12)',
              border: '1px solid rgba(148,163,184,0.35)',
              color: '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            📜 認証履歴
          </a>
          <a
            href="/master/cashflow-forecast"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.35)',
              color: '#a5f3fc',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            🌊 資金繰り 60日
          </a>
          <a
            href="/master/stripe-status"
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.35)',
              color: '#c7d2fe',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            💳 Stripe 接続診断
          </a>
        </div>

        <p
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
            marginTop: 18,
            lineHeight: 1.6,
          }}
        >
          API キーはこのブラウザの localStorage にのみ保存されます。
          <br />
          サーバには送信されません。共有 PC では「解除」を必ず押してください。
        </p>
      </motion.div>
    </div>
  );
}
