import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的サイトとして書き出す場合は `output: "export"` を有効化
  // (フォーム API 等サーバー機能を使う案件ではコメントアウトのまま)
  // output: "export",
  reactStrictMode: true,
};

export default nextConfig;
