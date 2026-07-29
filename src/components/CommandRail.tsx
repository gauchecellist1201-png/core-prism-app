import { useEffect, useRef, useState } from 'react';

/**
 * CommandRail — 画面右端の中央に固定される「COMMAND」タブ（コマンドセンターの入口）。
 *
 * ★2026-07-29 本文かぶりの根治（バックログ 3_Prism.md 最優先）
 *   375px 実機で、この帯（幅 44px）が本文カードの右端 42px を覆っていた。
 *   ブリーフの見出し「田島コーヒーとの年間契約を…」の文字が帯の下に隠れて読めない
 *   （本番で elementFromPoint により機械確認：見出しの 38 点が帯に覆われていた）。
 *
 *   直し方は BottomChatDock と同じ「実測して CSS 変数に流す」方式に揃えた。
 *   このタブが自分の幅を --prism-rail-w に書き込み、本文側（.cp-main-scroll）は
 *   その分だけ右に余白を空ける。決め打ちの px は使わない（幅を変えても崩れない）。
 *
 *   本文から奪う横幅を最小にするため、狭い画面では虫めがねアイコンを畳んで
 *   幅 22px まで細くする。代わりに縦を長くして、押しやすさは落とさない。
 */
export default function CommandRail({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [narrow, setNarrow] = useState<boolean>(
    () => (typeof window !== 'undefined' ? window.innerWidth < 768 : false),
  );

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 自分の実測幅を CSS 変数へ。本文はこの値ぶんだけ右に余白を空ける。
  useEffect(() => {
    const root = document.documentElement;
    document.body.dataset.prismCommandRail = '1';
    const measure = () => {
      const w = ref.current?.getBoundingClientRect().width ?? 0;
      root.style.setProperty('--prism-rail-w', `${Math.round(w)}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && ref.current) ro.observe(ref.current);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      delete document.body.dataset.prismCommandRail;
      root.style.removeProperty('--prism-rail-w');
    };
  }, []);

  return (
    <button
      ref={ref}
      onClick={onOpen}
      aria-label="プリズム コマンド センター を 開く"
      data-explain-id="prism-mark"
      className="prism-command-rail"
      title="プリズム コマンド センター"
      style={{
        position: 'fixed',
        top: '50%', right: 0,
        transform: 'translateY(-50%)',
        zIndex: 38,
        // 縦書き "COMMAND" (7文字) + アイコンが 64px に収まらず 5px 切れていた(実測 2026-07-26)。
        // 中身に合わせて伸ばし、文字を絶対に欠けさせない。
        width: narrow ? 22 : 44,
        // ★狭い画面は minHeight ではなく height で縦を伸ばす。
        //   index.css の「inline で幅22〜40pxの小さいボタンは min-height:0 !important にして
        //   ::after で44pxの当たり判定を足す」共通ルールに、この帯も一致してしまうため
        //   min-height だと無視される(本番で computed 0px を実測)。
        //   height なら効き、22px 幅でも 132px の縦長で押しやすい。
        minHeight: narrow ? undefined : 64,
        height: narrow ? 132 : undefined,
        paddingTop: 10, paddingBottom: 10,
        background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
        color: '#fff',
        border: 'none',
        borderTopLeftRadius: narrow ? 10 : 14,
        borderBottomLeftRadius: narrow ? 10 : 14,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4,
        boxShadow: '-6px 0 22px rgba(99,102,241,0.45)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
      }}
    >
      {!narrow && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      )}
      <span style={{ fontSize: narrow ? 9 : 8, fontWeight: 900, letterSpacing: '0.04em', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>COMMAND</span>
    </button>
  );
}
