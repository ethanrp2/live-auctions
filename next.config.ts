import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  skipProxyUrlNormalize: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fkatfnvscuvfejhdblks.supabase.co",
      },
    ],
  },
};

export default nextConfig;
