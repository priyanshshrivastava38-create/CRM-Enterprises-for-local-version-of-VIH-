import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The floating dev badge sits on top of the sidebar profile; hide it.
  devIndicators: false,
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default nextConfig;
