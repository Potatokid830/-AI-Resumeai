import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mammoth 含原生/大体积依赖，保持外置；PDF 改用 unpdf（Serverless 友好）
  serverExternalPackages: ["mammoth", "unpdf"],
};

export default nextConfig;
