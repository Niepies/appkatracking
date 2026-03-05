"use client";

/**
 * Wrapper kliencki dla Dashboard.
 * Używa next/dynamic z ssr:false – eliminuje niezgodność hooków Zustand
 * między renderem SSR (pusty store) a hydratacją klienta (dane z localStorage).
 */
import dynamic from "next/dynamic";

const DashboardDynamic = dynamic(
  () => import("@/components/dashboard/dashboard").then((m) => m.Dashboard),
  { ssr: false, loading: () => null }
);

export function DashboardClient() {
  return <DashboardDynamic />;
}
