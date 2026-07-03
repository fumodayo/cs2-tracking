'use client';

import { useEffect, useState } from 'react';
import { BarChart3, FileSearch, Search, Bug } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthStatus } from '@/components/auth/auth-status';
import { useSession } from '@/components/auth/use-session';
import { LanguageSelector, ThemeSelector } from '@/components/header-settings';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { FaHeart } from 'react-icons/fa6';
import { Button } from '@/components/ui/button';
import { DonateDialog } from '@/components/donate-dialog';
import { Tooltip } from '@/components/ui/tooltip';

const NAV_ITEMS = [
  { href: '/portfolio', labelKey: 'nav.portfolio', icon: BarChart3 },
  { href: '/post-analysis', labelKey: 'nav.postAnalysis', icon: FileSearch },
  {
    href: '/inventory-scanner',
    labelKey: 'nav.inventoryScanner',
    icon: Search,
  },
] as const;

const activeTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.22,
} as const;
const hoverTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.16,
} as const;

const DONATE_HASH = 'donate';
const DEFAULT_DONATE_AMOUNT = 20000;

function getAmountParam(params: URLSearchParams): string | null {
  return params.get('amount') ?? params.get('a');
}

function getHashFragment(): string {
  const hash = window.location.hash.replace(/^#/, '');

  try {
    return decodeURIComponent(hash).trim();
  } catch {
    return hash.trim();
  }
}

function isDonateHashFragment(fragment: string): boolean {
  const lowerHash = fragment.toLowerCase();

  if (!lowerHash.startsWith(DONATE_HASH)) {
    return false;
  }

  const suffixPrefix = fragment.charAt(DONATE_HASH.length);
  return !suffixPrefix || ['?', '&', '=', ':', '/'].includes(suffixPrefix);
}

function parseDonateAmount(rawAmount: string | null): number {
  if (!rawAmount) return 0;

  const normalized = rawAmount
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/vn\u0111|vnd|\u0111/g, '');

  if (!normalized) return 0;

  const hasThousandSuffix = normalized.endsWith('k');
  const numericPart = hasThousandSuffix ? normalized.slice(0, -1) : normalized;
  const parsedAmount = hasThousandSuffix
    ? Number.parseFloat(numericPart.replace(',', '.')) * 1000
    : Number.parseInt(numericPart.replace(/\D/g, ''), 10);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return 0;
  }

  return Math.round(parsedAmount);
}

function formatDonateAmountParam(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const roundedAmount = Math.round(amount);
  if (roundedAmount % 1000 === 0) {
    return `${roundedAmount / 1000}K`;
  }

  return String(roundedAmount);
}

function buildDonateHash(amount: number): string {
  const amountParam = formatDonateAmountParam(amount);
  return amountParam ? `${DONATE_HASH}?amount=${amountParam}` : DONATE_HASH;
}

function getUrlWithoutDonateParams(): string {
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete('donate');
  searchParams.delete('amount');
  searchParams.delete('a');

  const search = searchParams.toString();
  return `${window.location.pathname}${search ? `?${search}` : ''}`;
}

function updateDonateUrl(amount: number) {
  window.history.replaceState(
    null,
    '',
    `${getUrlWithoutDonateParams()}#${buildDonateHash(amount)}`
  );
}

function getDonateRequestFromLocation(): { amount: number } | null {
  const searchParams = new URLSearchParams(window.location.search);
  const rawHash = getHashFragment();

  if (isDonateHashFragment(rawHash)) {
    const suffix = rawHash.slice(DONATE_HASH.length);
    const suffixPrefix = suffix.charAt(0);
    let rawAmount = getAmountParam(searchParams);

    if (suffixPrefix === '?' || suffixPrefix === '&') {
      rawAmount = getAmountParam(new URLSearchParams(suffix.slice(1))) ?? rawAmount;
    } else if (suffixPrefix === '=' || suffixPrefix === ':' || suffixPrefix === '/') {
      rawAmount = suffix.slice(1) || rawAmount;
    }

    return { amount: parseDonateAmount(rawAmount) };
  }

  const donateParam = searchParams.get('donate');
  if (donateParam !== null) {
    return { amount: parseDonateAmount(getAmountParam(searchParams) ?? donateParam) };
  }

  return null;
}

export function AppNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, isAdmin } = useSession();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState(0);

  useEffect(() => {
    const syncDonateDialogFromUrl = () => {
      const donateRequest = getDonateRequestFromLocation();

      if (!donateRequest) return;

      setDonateAmount(donateRequest.amount);
      setDonateOpen(true);
    };

    syncDonateDialogFromUrl();

    window.addEventListener('hashchange', syncDonateDialogFromUrl);
    window.addEventListener('popstate', syncDonateDialogFromUrl);

    return () => {
      window.removeEventListener('hashchange', syncDonateDialogFromUrl);
      window.removeEventListener('popstate', syncDonateDialogFromUrl);
    };
  }, [pathname]);

  const handleDonateClose = () => {
    setDonateOpen(false);

    const hash = window.location.hash.replace(/^#/, '');
    if (isDonateHashFragment(hash) || new URLSearchParams(window.location.search).has('donate')) {
      window.history.replaceState(null, '', getUrlWithoutDonateParams());
    }
  };

  const handleDonateOpen = () => {
    setDonateAmount(DEFAULT_DONATE_AMOUNT);
    setDonateOpen(true);
    updateDonateUrl(DEFAULT_DONATE_AMOUNT);
  };

  const handleDonateAmountUpdate = (amount: number) => {
    setDonateAmount(amount);

    if (donateOpen) {
      updateDonateUrl(amount);
    }
  };

  const navItems = [
    ...NAV_ITEMS,
    ...(isAdmin
      ? [
          {
            href: '/admin/bug-reports',
            labelKey: 'nav.bugReportsAdmin' as (typeof NAV_ITEMS)[number]['labelKey'],
            icon: Bug,
          },
        ]
      : []),
  ];

  return (
    <header className="border-border bg-surface/90 sticky top-0 z-30 border-b backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-4 md:gap-3 lg:gap-4 lg:px-8">
        {/* Left Side: Brand Logo & Text */}
        <div className="flex min-w-max flex-1 items-center justify-start">
          <Link
            href="/portfolio"
            className="text-foreground flex items-center gap-2.5 text-sm font-black tracking-[0.18em] whitespace-nowrap uppercase lg:text-base"
          >
            <img src="/favicon.svg" alt="CS2 Tracker Logo" className="size-7 object-contain" />
            <span className="hidden lg:inline">CS2 Tracker</span>
          </Link>
        </div>

        {/* Center: Navigation Menu */}
        <div
          className="border-border/80 bg-surface-muted/30 flex flex-shrink-0 items-center gap-1 rounded-xl border p-1.5 backdrop-blur-sm md:gap-1.5"
          onMouseLeave={() => setHoveredHref(null)}
        >
          <AnimatePresence>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Tooltip key={item.href} content={t(item.labelKey)} side="bottom">
                  <Link
                    href={item.href}
                    onMouseEnter={() => setHoveredHref(item.href)}
                    onFocus={() => setHoveredHref(item.href)}
                    onBlur={() => setHoveredHref(null)}
                    className={cn(
                      'group relative inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-all duration-200 outline-none md:gap-2 md:px-4 lg:px-5 lg:text-[13px]',
                      active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {/* Hover Pill Background */}
                    {!active && hoveredHref === item.href && (
                      <motion.span
                        layoutId="hover-pill"
                        className="bg-surface-hover/80 absolute inset-0 rounded-lg"
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
                        className="bg-accent/8 absolute inset-0 rounded-lg"
                        transition={activeTransition}
                      />
                    )}

                    <Icon className="relative z-10 size-4.5 transition-transform duration-200 group-hover:scale-105" />
                    <span className="relative z-10 hidden md:inline">{t(item.labelKey)}</span>
                  </Link>
                </Tooltip>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Right Side: Action Buttons & Avatar */}
        <div className="flex min-w-max flex-1 items-center justify-end gap-1.5 md:gap-2.5">
          <Tooltip content={t('nav.donate', 'Donate')} side="bottom">
            <Button
              onClick={handleDonateOpen}
              variant="outline"
              size="sm"
              className="border-border bg-surface text-foreground hover:border-accent flex h-8 w-8 items-center justify-center rounded-xl border p-0 text-xs font-bold whitespace-nowrap transition-all duration-300 outline-none hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 md:h-10 md:w-auto md:px-4 lg:px-5"
            >
              <FaHeart className="size-4 shrink-0 animate-pulse fill-current text-rose-500 md:size-3.5" />
              <span className="hidden lg:inline">{t('nav.donate', 'Donate')}</span>
            </Button>
          </Tooltip>
          {!user && (
            <div className="flex shrink-0 items-center gap-1.5">
              <LanguageSelector />
              <ThemeSelector />
            </div>
          )}
          <AuthStatus />
        </div>
      </nav>
      <DonateDialog
        open={donateOpen}
        onClose={handleDonateClose}
        initialAmount={donateAmount}
        onAmountUpdate={handleDonateAmountUpdate}
      />
    </header>
  );
}
