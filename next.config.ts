import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Routes that read data files at runtime via fs. Next's tracer does resolve
  // these path.join calls today (verified against the .nft.json manifests),
  // but the whole product breaks if that ever regresses, so the routes that
  // depend on it are declared explicitly. If you add another reader of
  // data/jobs.json or data/jobs-meta.json, add it here too.
  outputFileTracingIncludes: {
    "/api/match": ["./data/jobs.json"],
    "/api/cron/daily-digest": ["./data/jobs.json"],
    "/dashboard": ["./data/jobs-meta.json"],
  },
};

export default nextConfig;
