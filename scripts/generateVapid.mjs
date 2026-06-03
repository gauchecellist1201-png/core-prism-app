#!/usr/bin/env node
/**
 * generateVapid.mjs — Web Push 用 VAPID 鍵ペア 生成
 *
 * オーナー指示 (2026-06-03 第 10 波 SS): SS. Web Push 通知の土台
 *
 * 使い方:
 *   node scripts/generateVapid.mjs
 *
 * 出力:
 *   PUBLIC_KEY  (URL-safe Base64, 65 bytes uncompressed P-256 公開鍵)
 *   PRIVATE_KEY (URL-safe Base64, 32 bytes P-256 秘密鍵)
 *
 *   下記を Vercel env に登録してください:
 *     VAPID_PUBLIC_KEY  = <上記 PUBLIC_KEY>
 *     VAPID_PRIVATE_KEY = <上記 PRIVATE_KEY>
 *     VAPID_SUBJECT     = mailto:gauche.cellist1201@gmail.com
 */

import { generateKeyPairSync } from 'node:crypto';

function urlBase64(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

// 公開鍵 (uncompressed point: 0x04 + X(32) + Y(32) = 65 bytes)
const publicJwk = publicKey.export({ format: 'jwk' });
const x = Buffer.from(publicJwk.x, 'base64url');
const y = Buffer.from(publicJwk.y, 'base64url');
const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
const PUBLIC_B64URL = urlBase64(uncompressed);

// 秘密鍵 (d, 32 bytes)
const privateJwk = privateKey.export({ format: 'jwk' });
const d = Buffer.from(privateJwk.d, 'base64url');
const PRIVATE_B64URL = urlBase64(d);

console.log('');
console.log('==============================================');
console.log('CORE Prism — VAPID 鍵ペア 生成完了');
console.log('==============================================');
console.log('');
console.log('VAPID_PUBLIC_KEY=' + PUBLIC_B64URL);
console.log('VAPID_PRIVATE_KEY=' + PRIVATE_B64URL);
console.log('VAPID_SUBJECT=mailto:gauche.cellist1201@gmail.com');
console.log('');
console.log('上記 3 つを Vercel Production env に追加してください。');
console.log('VAPID_PRIVATE_KEY は秘密です。公開しないでください。');
console.log('');
