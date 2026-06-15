"use client";

import { useState } from "react";
import { BarChart3, FileSearch, Search, Bug } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AuthStatus } from "@/components/auth/auth-status";
import { useSession } from "@/components/auth/use-session";
import { LanguageSelector, ThemeSelector } from "@/components/header-settings";
import { cn } from "@/utils/cn";
import { useTranslation } from "react-i18next";
import { FaHeart } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { DonateDialog } from "@/components/donate-dialog";

const NAV_ITEMS = [
  { href: "/portfolio", labelKey: "nav.portfolio", icon: BarChart3 },
  { href: "/post-analysis", labelKey: "nav.postAnalysis", icon: FileSearch },
  {
    href: "/inventory-scanner",
    labelKey: "nav.inventoryScanner",
    icon: Search,
  },
] as const;

const activeTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.22,
} as const;
const hoverTransition = {
  type: "tween",
  ease: "easeInOut",
  duration: 0.16,
} as const;

export function AppNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user } = useSession();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  const navItems = [
    ...NAV_ITEMS,
    ...(user?.email === "thaigiui2016@gmail.com"
      ? [
          {
            href: "/admin/bug-reports",
            labelKey: "nav.bugReportsAdmin" as (typeof NAV_ITEMS)[number]["labelKey"],
            icon: Bug,
          },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/portfolio"
          className="text-sm font-semibold tracking-[0.16em] text-foreground uppercase"
        >
          CS2 Tracker
        </Link>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface-muted/30 p-1 backdrop-blur-sm"
            onMouseLeave={() => setHoveredHref(null)}
          >
            <AnimatePresence>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => setHoveredHref(item.href)}
                    onFocus={() => setHoveredHref(item.href)}
                    onBlur={() => setHoveredHref(null)}
                    className={cn(
                      "group relative inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors outline-none",
                      active
                        ? "text-accent"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {/* Hover Pill Background */}
                    {!active && hoveredHref === item.href && (
                      <motion.span
                        layoutId="hover-pill"
                        className="absolute inset-0 rounded-lg bg-surface-hover/80"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={hoverTransition}
                      />
                    )}

                    {/* Active Pill Background */}
                    {active && (
                      <motion.span
                        layoutId="active-pill"
                        className="absolute inset-0 rounded-lg border border-accent/20 bg-accent/8 shadow-[0_2px_12px_rgba(59,130,246,0.06)]"
                        transition={activeTransition}
                      />
                    )}

                    <Icon className="relative z-10 size-4 transition-transform duration-200 group-hover:scale-105" />
                    <span className="relative z-10 hidden sm:inline">
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </AnimatePresence>
          </div>
          <Button
            onClick={() => setDonateOpen(true)}
            variant="outline"
            size="sm"
            className="flex h-9 items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3.5 text-xs font-bold text-rose-500 transition-all duration-300 hover:border-rose-500/40 hover:bg-rose-500/10 active:scale-95"
          >
            <FaHeart className="size-3 text-rose-500 fill-current animate-pulse" />
            <span>{t("nav.donate", "Nuôi tui")}</span>
          </Button>
          {!user && (
            <>
              <LanguageSelector />
              <ThemeSelector />
            </>
          )}
          <AuthStatus />
        </div>
      </nav>
      <DonateDialog open={donateOpen} onClose={() => setDonateOpen(false)} />
    </header>
  );
}
