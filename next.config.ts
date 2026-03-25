import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Silence known harmless warnings
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;