// ============================================================
// ErrorBoundary — 画面が落ちても「真っ白」にしない最後の砦
// React の描画中に出たエラーをここで受け止め、
// やさしい日本語の復旧画面 + 必ず動く復旧ボタンを出す。
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { triggerHaptic } from '../lib/haptic';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  /** 「もう一度ひらく」で +1。children を強制再マウントする key */
  retryKey: number;
  showDetail: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', retryKey: 0, showDetail: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error?.message || '不明なエラー' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // console.error は errorCapture がフックしているのでここでログが残る
    console.error('[ErrorBoundary]', error?.message, info?.componentStack);
    try { triggerHaptic('error'); } catch { /* 振動非対応端末は無視 */ }
  }

  // 同じ画面をもう一度だけ描き直す (再読み込みより速い)
  private handleRetry = () => {
    this.setState((s) => ({
      hasError: false,
      message: '',
      showDetail: false,
      retryKey: s.retryKey + 1,
    }));
  };

  // アプリ全体を読み込み直す
  private handleReload = () => {
    window.location.reload();
  };

  // 最初の画面 (ホーム) に戻る
  private handleHome = () => {
    try {
      window.location.hash = '';
      window.location.href = window.location.origin + window.location.pathname;
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      // key を変えると、落ちた画面のツリーが丸ごと作り直される
      return <div key={this.state.retryKey} style={{ display: 'contents' }}>{this.props.children}</div>;
    }

    const btnBase: React.CSSProperties = {
      width: '100%',
      borderRadius: 14,
      padding: '0.95rem 1rem',
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      border: 'none',
      WebkitTapHighlightColor: 'transparent',
      touchAction: 'manipulation',
    };

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(120% 90% at 50% 0%, #1B1430 0%, #0E0E12 55%, #0A0A0D 100%)',
          padding:
            'calc(env(safe-area-inset-top) + 1.5rem) 1.25rem calc(env(safe-area-inset-bottom) + 1.5rem)',
          overflowY: 'auto',
          color: '#F0EFF2',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>
          {/* プリズムのかけら — 落ちても「壊れた」ではなく「ひと休み」の絵 */}
          <div
            style={{
              width: 76,
              height: 76,
              margin: '0 auto 1.1rem',
              borderRadius: 22,
              background:
                'linear-gradient(135deg, #2E6FFF 0%, #8E5CFF 50%, #E84B97 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow:
                '0 12px 36px rgba(142, 92, 255, 0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            🌙
          </div>

          <h1 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 0.5rem', color: '#FFFFFF' }}>
            この画面でひと休みしました
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'rgba(240,239,242,0.72)',
              margin: '0 0 1.4rem',
            }}
          >
            うまく表示できませんでした。<br />
            あなたのデータは消えていません。<br />
            下のボタンですぐに戻れます。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                ...btnBase,
                background: 'linear-gradient(135deg, #2E6FFF, #8E5CFF)',
                color: '#FFFFFF',
                boxShadow: '0 8px 22px rgba(46,111,255,0.4)',
              }}
            >
              この画面をもう一度ひらく
            </button>
            <button
              onClick={this.handleReload}
              style={{
                ...btnBase,
                background: 'rgba(255,255,255,0.08)',
                color: '#F0EFF2',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              アプリを読み込み直す
            </button>
            <button
              onClick={this.handleHome}
              style={{
                ...btnBase,
                background: 'transparent',
                color: 'rgba(240,239,242,0.6)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              最初の画面に戻る
            </button>
          </div>

          {/* くわしく — 沈黙させない。原因を知りたい人だけ開ける */}
          <button
            onClick={() => this.setState((s) => ({ showDetail: !s.showDetail }))}
            style={{
              marginTop: '1.3rem',
              background: 'transparent',
              border: 'none',
              color: 'rgba(240,239,242,0.4)',
              fontSize: 12,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {this.state.showDetail ? 'くわしくを閉じる' : 'くわしく (原因を見る)'}
          </button>
          {this.state.showDetail && (
            <pre
              style={{
                marginTop: '0.6rem',
                padding: '0.7rem 0.85rem',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                fontSize: 11,
                lineHeight: 1.55,
                color: 'rgba(255,184,192,0.85)',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {this.state.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
