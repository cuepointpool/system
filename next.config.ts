import type { NextConfig } from "next";

// Security response headers are applied at the edge (CloudFront response
// headers policy) and by nginx on the origin — see DEPLOY-AWS.md. Keeping
// them out of next.config avoids emitting each header twice.
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
