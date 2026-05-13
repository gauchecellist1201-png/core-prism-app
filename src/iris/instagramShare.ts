// ============================================================
// Iris ▸ Instagram シェアヘルパー
// 「Iris で生成した投稿 → Instagram アプリへポンと飛んで投稿」
//
// 戦略:
//   1. Web Share API (Level 2: files) が使える環境 (iOS Safari 等)
//      → navigator.share({ files, text }) で OS 共有シート起動
//        ユーザーが「Instagram」を選択 → 画像 + キャプション付きで投稿画面へ
//
//   2. Web Share が files 未対応 (一部 Android, デスクトップ)
//      → キャプションをクリップボードにコピー
//      → 画像をダウンロード
//      → instagram://camera URL スキームでアプリ起動 (iOS/Android)
//      → ライブラリから画像選択、キャプションをペースト
//
//   3. Web Share / URL スキーム不可 (デスクトップブラウザ)
//      → クリップボードコピー + 画像ダウンロード + 「Web 版を開く」リンク
// ============================================================

export type InstagramSharePayload = {
  /** 本文 (caption + hashtags + cta を結合したもの) */
  caption: string;
  /** 投稿画像 (任意、Blob or DataURL) */
  image?: Blob | string;
  /** ファイル名のヒント */
  filename?: string;
  /** ストーリー (24h) として共有したいか */
  asStory?: boolean;
};

export type InstagramShareResult = {
  /** 何が成功したか */
  method: 'webshare' | 'urlscheme' | 'clipboard-only' | 'failed';
  /** ユーザー向けの一言メッセージ (toast 用) */
  message: string;
};

/** dataURL → Blob 変換 */
function dataURLtoBlob(dataUrl: string): Blob {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('invalid dataURL');
  const mime = m[1];
  const bin = atob(m[2]);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Blob を File に (Web Share API は File 必須) */
function toFile(image: Blob | string, filename: string): File {
  const blob = typeof image === 'string' ? dataURLtoBlob(image) : image;
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

/** クリップボードに caption をコピー */
async function copyCaption(caption: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(caption);
      return true;
    }
  } catch {/* fall through */}
  // フォールバック: textarea + execCommand
  try {
    const ta = document.createElement('textarea');
    ta.value = caption;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 画像をダウンロード (anchor click) */
function downloadImage(image: Blob | string, filename: string) {
  const blob = typeof image === 'string' ? dataURLtoBlob(image) : image;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** iOS / Android で Instagram アプリを起動 */
function openInstagramApp(asStory = false) {
  // instagram://library?LocalIdentifier= は iOS で写真ライブラリを開ける
  // instagram://story-camera は ストーリー
  // instagram://camera はカメラ (フィード作成)
  const url = asStory ? 'instagram://story-camera' : 'instagram://camera';
  // 5 秒以内に切替されなければ Web 版にフォールバック
  const fallbackTimer = setTimeout(() => {
    window.open('https://www.instagram.com/', '_blank');
  }, 1800);
  // visibilitychange で切替成功検知
  const onHide = () => {
    clearTimeout(fallbackTimer);
    document.removeEventListener('visibilitychange', onHide);
  };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = url;
}

/**
 * 主関数 — Instagram への共有を試みる
 * 失敗しないよう、できる限りの手段を試す
 */
export async function shareToInstagram(payload: InstagramSharePayload): Promise<InstagramShareResult> {
  const { caption, image, asStory = false } = payload;
  const filename = payload.filename || `iris-${Date.now()}.png`;

  // 1) Web Share Level 2 (files) が使えれば最強
  try {
    const navAny = navigator as any;
    if (image && navAny.canShare && navAny.share) {
      const file = toFile(image, filename);
      if (navAny.canShare({ files: [file] })) {
        await navAny.share({
          files: [file],
          text: caption,
          title: 'Iris で生成した投稿',
        });
        return { method: 'webshare', message: '共有シートから Instagram を選んでね' };
      }
    }
    // 画像なし or files 未対応でも text だけなら share できる
    if (navAny.share && !image) {
      await navAny.share({ text: caption });
      return { method: 'webshare', message: '共有先を選んでね' };
    }
  } catch (e: any) {
    // ユーザーがキャンセルした (AbortError) 場合はそれを返す
    if (e?.name === 'AbortError') {
      return { method: 'webshare', message: '共有をキャンセルしました' };
    }
    // それ以外は次の手段へ
  }

  // 2) iOS / Android: 画像ダウンロード + クリップボードコピー + Instagram アプリ起動
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const copied = await copyCaption(caption);
  if (image) downloadImage(image, filename);
  if (isMobile) {
    setTimeout(() => openInstagramApp(asStory), 350);
    return {
      method: 'urlscheme',
      message: copied
        ? 'キャプションをコピー + 画像保存 → Instagram を開きます'
        : '画像を保存しました。Instagram で投稿してね',
    };
  }

  // 3) デスクトップ: コピー + ダウンロードのみ
  return {
    method: copied ? 'clipboard-only' : 'failed',
    message: copied
      ? 'キャプションをコピーしました。スマホで Instagram を開いて貼り付けて'
      : 'コピーに失敗しました。手動でテキストをコピーしてください',
  };
}

/** Iris の draftCopy (caption + hashtags + cta が結合) を caption / hashtags / cta に分解 */
export function splitDraftCopy(draft: string): { caption: string; hashtags: string; cta: string } {
  const blocks = draft.split(/\n{2,}/);
  return {
    caption: blocks[0] || '',
    hashtags: blocks[1] || '',
    cta: blocks[2] || '',
  };
}
