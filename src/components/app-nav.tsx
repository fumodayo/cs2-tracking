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
import { Tooltip } from "@/components/ui/tooltip";

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
  const { user, isAdmin } = useSession();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin
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
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 md:gap-3 lg:gap-4 px-3 sm:px-4 lg:px-8">
        {/* Left Side: Brand Logo & Text */}
        <div className="flex-1 flex items-center justify-start min-w-max">
          <Link
            href="/portfolio"
            className="flex items-center gap-2.5 text-sm lg:text-base font-black tracking-[0.18em] text-foreground uppercase whitespace-nowrap"
          >
            <img src="/favicon.svg" alt="CS2 Tracker Logo" className="size-7 object-contain" />
            <span className="hidden lg:inline">CS2 Tracker</span>
          </Link>
        </div>

        {/* Center: Navigation Menu */}
        <div
          className="flex items-center gap-1 md:gap-1.5 rounded-xl border border-border/80 bg-surface-muted/30 p-1.5 backdrop-blur-sm flex-shrink-0"
          onMouseLeave={() => setHoveredHref(null)}
        >
          <AnimatePresence>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <Tooltip key={item.href} content={t(item.labelKey)} side="bottom">
                  <Link
                    href={item.href}
                    onMouseEnter={() => setHoveredHref(item.href)}
                    onFocus={() => setHoveredHref(item.href)}
                    onBlur={() => setHoveredHref(null)}
                    className={cn(
                      "group relative inline-flex h-10 items-center justify-center gap-1.5 md:gap-2 rounded-lg px-3 md:px-4 lg:px-5 text-xs lg:text-[13px] font-bold transition-all duration-200 outline-none whitespace-nowrap",
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
                        className="absolute inset-0 rounded-lg bg-accent/8"
                        transition={activeTransition}
                      />
                    )}

                    <Icon className="relative z-10 size-4.5 transition-transform duration-200 group-hover:scale-105" />
                    <span className="relative z-10 hidden md:inline">
                      {t(item.labelKey)}
                    </span>
                  </Link>
                </Tooltip>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Right Side: Action Buttons & Avatar */}
        <div className="flex-1 flex items-center justify-end gap-1.5 md:gap-2.5 min-w-max">
          <Tooltip content={t("nav.donate", "Donate")} side="bottom">
            <Button
              onClick={() => setDonateOpen(true)}
              variant="outline"
              size="sm"
              className="flex h-10 items-center gap-1.5 md:gap-2 rounded-xl border border-border bg-surface px-3 md:px-4 lg:px-5 text-xs font-bold text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 whitespace-nowrap"
            >
              <FaHeart className="size-3.5 text-rose-500 fill-current animate-pulse shrink-0" />
              <span className="hidden lg:inline">{t("nav.donate", "Donate")}</span>
            </Button>
          </Tooltip>
          {!user && (
            <div className="flex items-center gap-1.5 shrink-0">
              <LanguageSelector />
              <ThemeSelector />
            </div>
          )}
          <AuthStatus />
        </div>
      </nav>
      <DonateDialog open={donateOpen} onClose={() => setDonateOpen(false)} />
    </header>
  );
}
