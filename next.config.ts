import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The match route reads data/jobs.json at runtime via fs. Next's file tracer
  // sees the path.join but cannot resolve the dynamic argument, so include
  // the data file explicitly for the function bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/match": ["./data/jobs.json"],
  },
};

export default nextConfig;
