import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// マスターキー: 環境変数の有無に関わらず常に有効
const MASTER_KEY = 'GAUCHE2026';

// 有効な招待コード（Vercel環境変数 VITE_INVITE_CODES から取得、カンマ区切り）
// 例: VITE_INVITE_CODES=FRIEND01,CORE2026
function getValidCodes(): string[] {
  const raw = import.meta.env.VITE_INVITE_CODES ?? '';
  const fromEnv = raw
    ? raw.split(',').map((c: string) => c.trim().toUpperCase()).filter(Boolean)
    : [];
  return Array.from(new Set([MASTER_KEY, ...fromEnv]));
}

const STORAGE_KEY = 'core_invite_accepted';

export function isInviteAccepted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

interface Props {
  onAccepted: () => void;
}

export default function InviteGate({ onAccepted }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;

    setChecking(true);
    setError('');

    // 少し間を置いてブルートフォースを防ぐ
    await new Promise(r => setTimeout(r, 600));

    const valid = getValidCodes();
    if (valid.includes(code.trim().toUpperCase())) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setChecking(false);
      onAccepted();
    } else {
      setError('招待コードが正しくありません');
      setChecking(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >

      <motion.div
        className="relative z-10 text-center max-w-sm w-full px-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Logo */}
        <p className="text-prism text-5xl font-extralight mb-1">
          CORE
        </p>
        <p className="text-fg-subtle text-xs tracking-widest uppercase mb-12">Prism OS</p>

        <h2 className="text-fg text-lg font-extralight mb-2">招待コードを入力</h2>
        <p className="text-fg-subtle text-xs mb-8 leading-relaxed">
          このアプリは招待制です。<br />
          GAUCHEから受け取ったコードを入力してください。
        </p>

        <form onSubmit={handleSubmit}>
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl mb-3"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${error ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value); setError(''); }}
              placeholder="招待コード"
              className="flex-1 bg-transparent text-fg text-sm font-mono tracking-widest outline-none text-center uppercase"
              autoFocus
              maxLength={20}
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                className="text-red-400 text-xs mb-3"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!code.trim() || checking}
            className="w-full py-3 rounded-xl text-sm font-light transition-all duration-200"
            style={{
              background: code.trim() && !checking
                ? 'linear-gradient(120deg, #2E6FFF, #E84B97, #8E5CFF, #FF7A1A, #D9A41A)'
                : 'var(--surface-3)',
              color: code.trim() && !checking ? '#fff' : 'var(--fg-subtle)',
            }}
            whileHover={code.trim() && !checking ? { scale: 1.01 } : {}}
            whileTap={code.trim() && !checking ? { scale: 0.99 } : {}}
          >
            {checking ? '確認中...' : '入場する →'}
          </motion.button>
        </form>

        <p className="text-fg-subtle text-xs mt-8">
          招待コードをお持ちでない方は
          <a
            href="mailto:gauche.cellist1201@gmail.com"
            className="underline ml-1 text-fg-muted"
          >
            こちら
          </a>
        </p>
      </motion.div>
    </motion.div>
  );
}
