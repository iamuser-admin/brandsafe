import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / node-only packages out of the bundle (run from node_modules).
  serverExternalPackages: ["better-sqlite3", "twelvelabs-js"],
  // TwelveLabs thumbnails + HLS posters are served from their CDN.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
