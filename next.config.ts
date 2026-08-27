import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/run-pipeline": ["./prompts/*.md"],
  },
};

export default nextConfig;
