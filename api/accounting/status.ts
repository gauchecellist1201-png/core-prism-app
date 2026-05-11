// 会計サービス (freee / MF / 弥生) の env 設定状況を返す
export const config = { runtime: 'edge' };

export default async function handler() {
  const data = {
    freee: { configured: !!process.env.FREEE_CLIENT_ID && !!process.env.FREEE_CLIENT_SECRET },
    mf:    { configured: !!process.env.MF_CLIENT_ID && !!process.env.MF_CLIENT_SECRET },
    yayoi: { configured: !!process.env.YAYOI_CLIENT_ID && !!process.env.YAYOI_CLIENT_SECRET },
  };
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
