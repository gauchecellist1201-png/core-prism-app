import { describe, it, expect } from 'vitest';
import {
  webmFallbackAdvice, isIOSLike, isIOSSafari, isPhoneLike, WEBM_KEEP_NOTE,
} from '../webmFallback';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 EdgiOS/120.0 Mobile/15E148 Safari/604.1',
  ipadOS:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

describe('端末の見分け', () => {
  it('iPhone は、どのブラウザでも iOS として扱う', () => {
    expect(isIOSLike(UA.iphoneSafari)).toBe(true);
    expect(isIOSLike(UA.iphoneChrome)).toBe(true);
    expect(isIOSLike(UA.iphoneFirefox)).toBe(true);
  });

  it('iPadOS は Macintosh を名乗るので、指で触れる時だけ iOS と見る', () => {
    expect(isIOSLike(UA.ipadOS, 5)).toBe(true);
    expect(isIOSLike(UA.ipadOS, 0)).toBe(false);   // 本物の Mac を iPad にしない
  });

  it('iOS 版 Chrome / Firefox / Edge は「Safari」を名乗るが Safari 本体ではない', () => {
    expect(isIOSSafari(UA.iphoneSafari)).toBe(true);
    expect(isIOSSafari(UA.iphoneChrome)).toBe(false);
    expect(isIOSSafari(UA.iphoneFirefox)).toBe(false);
    expect(isIOSSafari(UA.iphoneEdge)).toBe(false);
  });

  it('Android と iPhone はスマホ、パソコンはスマホではない', () => {
    expect(isPhoneLike(UA.androidChrome)).toBe(true);
    expect(isPhoneLike(UA.iphoneSafari)).toBe(true);
    expect(isPhoneLike(UA.macChrome)).toBe(false);
    expect(isPhoneLike(UA.windowsChrome)).toBe(false);
  });
});

describe('MP4 で書き出せなかった時の案内', () => {
  it('iPhone の Chrome では、Safari へ渡す道を押せる形で出す', () => {
    const a = webmFallbackAdvice(UA.iphoneChrome);
    expect(a.kind).toBe('ios-other-browser');
    expect(a.showCopyLink).toBe(true);
    expect(a.steps.join(' ')).toContain('Safari');
  });

  it('iPhone の Safari では、もう一度 Safari へ送らない（同じ所へ戻すのは案内ではない）', () => {
    const a = webmFallbackAdvice(UA.iphoneSafari);
    expect(a.kind).toBe('phone');
    expect(a.showCopyLink).toBe(false);
  });

  it('★ スマホには、パソコン専用ソフト (HandBrake) を一度も出さない', () => {
    const phones = [UA.iphoneSafari, UA.iphoneChrome, UA.androidChrome];
    phones.forEach(ua => {
      const a = webmFallbackAdvice(ua);
      expect(a.showDesktopConverter).toBe(false);
      expect(a.steps.join(' ')).not.toContain('HandBrake');
    });
    // iPadOS (Macintosh を名乗る) も同じ扱い
    const pad = webmFallbackAdvice(UA.ipadOS, 5);
    expect(pad.steps.join(' ')).not.toContain('HandBrake');
  });

  it('パソコンでは、これまでどおり変換ソフトまで案内する', () => {
    [UA.macChrome, UA.macSafari, UA.windowsChrome].forEach(ua => {
      const a = webmFallbackAdvice(ua);
      expect(a.kind).toBe('desktop');
      expect(a.showDesktopConverter).toBe(true);
      expect(a.showCopyLink).toBe(false);
    });
  });

  it('★ どの端末でも、その場で実行できる手順が必ず 1 つ以上ある（行き止まりを作らない）', () => {
    Object.values(UA).forEach(ua => {
      [0, 5].forEach(touch => {
        const a = webmFallbackAdvice(ua, touch);
        expect(a.steps.length).toBeGreaterThan(0);
        expect(a.headline.length).toBeGreaterThan(0);
        a.steps.forEach(s => expect(s.trim()).not.toBe(''));
      });
    });
  });

  it('WebM のまま保存できることは、どの端末でも必ず伝える', () => {
    expect(WEBM_KEEP_NOTE).toContain('WebM');
    expect(WEBM_KEEP_NOTE).toContain('ダウンロード');
  });
});
