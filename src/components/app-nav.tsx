"use client";

import { BarChart3, FileSearch, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/portfolio", label: "Quản lý case", icon: BarChart3 },
  { href: "/post-analysis", label: "Phân tích bài viết", icon: FileSearch },
  { href: "/inventory-scanner", label: "Quét hòm đồ", icon: Search },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/portfolio" className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-100">
          CS2 Tracker
        </Link>

        <div className="flex items-center gap-1 rounded-md border border-stone-800 bg-stone-900/70 p-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center justify-center gap-2 rounded px-3 text-sm font-medium transition ${
                  active ? "bg-amber-400 text-stone-950" : "text-stone-300 hover:bg-stone-800 hover:text-stone-50"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
