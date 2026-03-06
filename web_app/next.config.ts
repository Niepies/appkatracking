import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    // Fix monorepo workspace root detection: point to web_app directory
    root: __dirname,
  },
};

export default nextConfig;
