// ============================================================
// ApiErrorCard — AI エラーをポップに表示し、解消手順をガイド
// dismiss すると同じエラーは 60 秒間 (sessionStorage) 再表示しない
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waves, Key, Wifi, AlertTriangle, Settings as SettingsIcon, RotateCcw, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  /** エラーメッセージ。null/空なら何も出さない */
  error: string | null | undefined;
  /** 設定モーダルを開くハンドラ (マスターモード切替へ誘導) */
  onOpenSettings?: () => void;
  /** 表示位置の調整 (default はフルワイド) */
  className?: string;
  /** ダーク/ライト自動 (transparent 背景に対して読みやすく) */
  variant?: 'dark' | 'light' | 'auto';
  /** 指定すると「もう一度ためす」ボタンを出し、押すと再実行する */
  onRetry?: () => void;
}

const DISMISS_KEY = 'core_api_error_dismissed_until_v1';

function isDismissedNow(error: string): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const map: Record<string, number> = JSON.parse(raw);
    const sig = signature(error);
    const until = map[sig];
    return !!until && until > Date.now();
  } catch { return false; }
}

function dismissFor(error: string, durationMs = 60_000) {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[signature(error)] = Date.now() + durationMs;
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function signature(error: string): string {
  // 数字・URL を取り除いて識別子化
  return error.toLowerCase().replace(/\d+/g, '#').replace(/https?:\/\/\S+/g, '').slice(0, 80);
}

function classifyError(error: string): {
  kind: 'quota' | 'auth' | 'network' | 'validation' | 'other';
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  steps: string[];
} {
  const e = error.toLowerCase();
  // バリデーション系 (「〜してください」「〜が必要です」「〜ませんでした」など)
  // retry しても直らない or 「もう一度話す」など別アクションが必要 → 案内のみ
  if (/してください。?$|入力してください|選択してください|指定してください|貼り付けてください|登録してね|必要です|認識されませんでした|まだ.*ません/i.test(error.trim())) {
    return {
      kind: 'validation', Icon: Info, iconColor: '#7B61FF',
      title: 'もう一歩で完了です',
      steps: [],
    };
  }
  if (/quota|混みあって|rate|429|503|no_ai_key|無料の AI 鍵/i.test(error)) {
    return {
      kind: 'quota', Icon: Waves, iconColor: '#5BA8FF',
      title: 'AI 鍵を 1 分で登録すれば動きます',
      steps: [
        '右上の歯車 → 「API キー」タブを開く',
        '「無料で取得 →」を押し、Google アカウントでログイン',
        '「Create API key」を押して出てきた AIzaSy... を貼り付け',
        '保存後、すぐ全 AI 機能が使えます (¥0)',
      ],
    };
  }
  if (/api key|unauthorized|forbidden|認証/i.test(error)) {
    return {
      kind: 'auth', Icon: Key, iconColor: '#FACC15',
      title: 'API キーが無効になっています',
      steps: [
        '右上の歯車 → 「API キー」タブを開く',
        '登録済みのキーを 1 度削除して保存 (空欄でも OK)',
        '無料の Gemini キーを取得して貼り付け (1 分、¥0)',
        '保存後、「もう一度ためす」を押す',
      ],
    };
  }
  if (/network|fetch|offline|connection/i.test(e)) {
    return {
      kind: 'network', Icon: Wifi, iconColor: '#4ADE80',
      title: 'ネットワークが不安定です',
      steps: ['Wi-Fi / モバイル通信を確認', '再接続後にもう一度送信', 'ページ再読み込みも有効'],
    };
  }
  return {
    kind: 'other', Icon: AlertTriangle, iconColor: '#FFA94D',
    title: 'AI が応答しませんでした',
    steps: [
      '60 秒ほど待ってから、もう一度ためしてみてください',
      'それでも応答がないときは、設定 → API キーで自分の Claude / Gemini キーを 1 つ登録すると即座に使えるようになります (無料の Google AI Studio で取得可能)',
      '解消しないときは gauche.cellist1201@gmail.com までメールください',
    ],
  };
}

/** ライトテーマかどうかを判定 (data-theme="light" or prefers-color-scheme: light) */
function useEffectiveLight(variant: 'dark' | 'light' | 'auto'): boolean {
  const [light, setLight] = useState<boolean>(() => {
    if (variant !== 'auto') return variant === 'light';
    if (typeof document === 'undefined') return false;
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light') return true;
    if (attr === 'dark') return false;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
  });
  useEffect(() => {
    if (variant !== 'auto') { setLight(variant === 'light'); return; }
    const compute = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light') return true;
      if (attr === 'dark') return false;
      return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
    };
    setLight(compute());
    const obs = new MutationObserver(() => setLight(compute()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    const onMq = () => setLight(compute());
    mq?.addEventListener?.('change', onMq);
    return () => { obs.disconnect(); mq?.removeEventListener?.('change', onMq); };
  }, [variant]);
  return light;
}

export default function ApiErrorCard({ error, onOpenSettings, className, variant = 'auto', onRetry }: Props) {
  const [version, setVersion] = useState(0); // 再描画用
  const isLight = useEffectiveLight(variant);
  const visible = !!error && !isDismissedNow(error);

  // sessionStorage の TTL 切れに合わせて 5 秒ごとに再評価
  useEffect(() => {
    if (!error) return;
    const t = setInterval(() => setVersion(v => v + 1), 5000);
    return () => clearInterval(t);
  }, [error]);

  if (!visible || !error) return null;

  const c = classifyError(error);
  const isValidation = c.kind === 'validation';

  // 色: auto は data-theme / prefers-color-scheme を見て決定。バリデーションは紫の「ヒント」トーン
  const bg = isValidation
    ? (isLight ? 'rgba(245, 243, 255, 0.96)' : 'rgba(34, 26, 58, 0.92)')
    : isLight
      ? 'rgba(255, 245, 240, 0.96)'
      : 'rgba(48, 12, 18, 0.92)';
  const fg = isValidation
    ? (isLight ? '#2E1A6E' : '#E8E2FF')
    : isLight ? '#7B0E29' : '#FFEAEC';
  const fgDim = isValidation
    ? (isLight ? '#5A4A9C' : '#BFB4F0')
    : isLight ? '#9C3A5C' : '#FFB8C0';
  const border = isValidation
    ? (isLight ? 'rgba(123, 97, 255, 0.30)' : 'rgba(191, 180, 240, 0.30)')
    : isLight ? 'rgba(225, 48, 108, 0.35)' : 'rgba(255, 184, 192, 0.30)';

  const handleDismiss = () => {
    dismissFor(error, 60_000);
    setVersion(v => v + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={c.kind + version}
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={className}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          padding: '0.85rem 1rem',
          margin: '0.5rem 0.75rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(10px)',
          color: fg,
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg, ${c.iconColor}, ${c.iconColor}cc)`,
            boxShadow: `0 4px 12px ${c.iconColor}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            <c.Icon size={17} color="#FFFFFF" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: isValidation ? '0.2rem' : '0.35rem' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: fg, margin: 0 }}>{isValidation ? error : c.title}</p>
              <button
                onClick={handleDismiss}
                title="60 秒間、表示しない"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: fgDim, fontSize: 18, lineHeight: 1, padding: '0 4px',
                  borderRadius: 6,
                }}
              >×</button>
            </div>
            {!isValidation && (
              <ol style={{
                margin: '0 0 0.4rem', padding: '0 0 0 1.1rem',
                fontSize: 12, color: fgDim, lineHeight: 1.65,
              }}>
                {c.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
            {!isValidation && (onRetry || (c.kind === 'quota' && onOpenSettings)) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                {onRetry && (
                  <button
                    onClick={() => onRetry()}
                    style={{
                      background: `linear-gradient(135deg, ${c.iconColor}, ${c.iconColor}cc)`,
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: 999, padding: '0.46rem 1.05rem',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      boxShadow: `0 4px 12px ${c.iconColor}55`,
                    }}
                  ><RotateCcw size={13} strokeWidth={2.6} /> もう一度ためす</button>
                )}
                {c.kind === 'quota' && onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid ' + border,
                      color: fg,
                      borderRadius: 999, padding: '0.46rem 0.95rem',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    }}
                  ><SettingsIcon size={13} strokeWidth={2.2} /> マスターモードにする</button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
