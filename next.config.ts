import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  serverExternalPackages: ["@pdf-lib/fontkit", "pdf-lib"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
