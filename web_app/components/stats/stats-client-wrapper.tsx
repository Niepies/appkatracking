"use client";

import dynamic from "next/dynamic";

const StatsClientLazy = dynamic(
  () => import("@/components/stats/stats-client").then((m) => ({ default: m.StatsClient })),
  { ssr: false }
);

export function StatsClientWrapper() {
  return <StatsClientLazy />;
}
