import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/(.*)",
        destination: "http://localhost:3001/$1",
      },
    ];
  },
};

export default nextConfig;