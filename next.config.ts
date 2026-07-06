import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools indicator so it can't appear in the build-time OG screenshot.
  devIndicators: false,
};

export default nextConfig;
