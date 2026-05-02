import type { NextConfig } from "next";

// Path-prefix the whole app when reverse-proxied behind nginx at /sendcheck.
// Override with NEXT_PUBLIC_BASE_PATH="" for root-domain hosting (e.g. Vercel).
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : "/sendcheck";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: basePath || undefined,
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
