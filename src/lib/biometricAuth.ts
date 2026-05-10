// ============================================================
// biometricAuth — Face ID / Touch ID / Passkeys (WebAuthn) 簡易ラッパー
// ブラウザの Credential Management API を使い、デバイスの生体認証で
// パスワードを呼び出す。サーバ側 challenge は不要なシンプル設計。
// ============================================================

const KEY_BIOMETRIC_ENABLED = 'core_biometric_enabled_v1';
const KEY_PASSKEY_ID = 'core_passkey_credential_id_v1';

/** Face ID / Touch ID / Windows Hello が使える環境か */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(KEY_BIOMETRIC_ENABLED) === 'true';
}

/**
 * ユーザー登録時に呼ぶ。Face ID で credential を登録し、id を保存
 * 失敗してもアプリは動くので throw しない (false を返す)
 */
export async function registerBiometric(opts: { email: string; displayName?: string }): Promise<boolean> {
  if (!(await isBiometricAvailable())) return false;
  try {
    // ランダム challenge (本来はサーバ生成だが、簡易版なのでクライアント乱数)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(opts.email);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'CORE',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: opts.email,
          displayName: opts.displayName || opts.email,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // 内蔵 Face ID / Touch ID
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // credential.id を保存しておく (次回認証で使う)
    const id = credential.id;
    localStorage.setItem(KEY_PASSKEY_ID, id);
    localStorage.setItem(KEY_BIOMETRIC_ENABLED, 'true');
    return true;
  } catch (e) {
    console.warn('Biometric registration failed:', e);
    return false;
  }
}

/**
 * ログイン時に呼ぶ。Face ID で本人確認 → true なら成功
 */
export async function authenticateBiometric(): Promise<boolean> {
  if (!isBiometricEnabled()) return false;
  if (!(await isBiometricAvailable())) return false;
  try {
    const id = localStorage.getItem(KEY_PASSKEY_ID);
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const allowCredentials = id
      ? [{
          id: base64urlToUint8Array(id) as BufferSource,
          type: 'public-key' as const,
          transports: ['internal'] as AuthenticatorTransport[],
        }]
      : undefined;

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId: window.location.hostname,
        allowCredentials: allowCredentials as PublicKeyCredentialDescriptor[] | undefined,
        userVerification: 'required',
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    return !!assertion;
  } catch (e) {
    console.warn('Biometric authentication failed:', e);
    return false;
  }
}

/** 解除 */
export function disableBiometric() {
  localStorage.removeItem(KEY_BIOMETRIC_ENABLED);
  localStorage.removeItem(KEY_PASSKEY_ID);
}

// ─── helpers ─────────────────
function base64urlToUint8Array(base64url: string): Uint8Array {
  try {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  } catch {
    return new Uint8Array();
  }
}
