import type { NextConfig } from "next";

// `cacheComponents` is deliberately off: nearly everything here is per-user and
// must be fresh (board, comments), so there is nothing to share between users.
const nextConfig: NextConfig = {};

export default nextConfig;
