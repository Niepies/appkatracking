"use client";

/**
 * Dolna nawigacja – Dashboard ↔ Odkrywaj
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clapperboard, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stats", label: "Statystyki", icon: BarChart2 },
  { href: "/browse", label: "Odkrywaj", icon: Clapperboard },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-30 border-t",
      "bg-white dark:bg-gray-900",
      "border-gray-100 dark:border-gray-800"
    )}>
      <div className="max-w-md mx-auto flex">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors text-xs font-medium",
                active
                  ? "text-blue-500"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
