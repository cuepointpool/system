import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Security response headers are applied at the edge (CloudFront response
// headers policy) and by nginx on the origin — see DEPLOY-AWS.md. Keeping
// them out of next.config avoids emitting each header twice.
export default function config(phase: string): NextConfig {
  return {
    poweredByHeader: false,
    experimental: {
      // `next dev` forks a fresh Node process for every dynamic route it
      // checks (tournaments, games…). On a busy Windows machine that fork
      // sometimes fails and dev dies with "Jest worker encountered 2 child
      // process exceptions". Worker threads run inside the dev server
      // instead. Dev only — production builds are unchanged.
      workerThreads: phase === PHASE_DEVELOPMENT_SERVER,
    },
  };
}
