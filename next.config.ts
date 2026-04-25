import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Force workspace root to this app, otherwise Turbopack picks up
    // /Users/yann/package-lock.json and resolves modules at the wrong level.
    root: path.resolve("."),
  },
  // iPhone Personal Hotspot subnets vary (192.0.0.x, 172.20.10.x, etc.).
  allowedDevOrigins: [
    "192.0.0.2",
    "172.20.10.2",
    "192.168.1.49",
    "*.local",
  ],
};

export default nextConfig;
