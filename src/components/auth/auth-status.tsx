'use client';

import { useState, useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from './use-session';
import { useTheme } from '@/components/theme-provider';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Palette, LogOut, ChevronRight, LogIn, Key, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { CS2CapModal } from './cs2cap-modal';

const springTransition = {
  type: 'spring',
  stiffness: 380,
  damping: 26,
} as const;
const slideTransition = { duration: 0.15, ease: 'easeOut' } as const;

// Custom high-performance circular flags using inline SVGs for offline capability & CDN-independence
const UKFlag = ({ className = 'size-5.5' }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn(
      'inline-block shrink-0 overflow-hidden rounded-full border border-stone-800/10 shadow-sm dark:border-stone-700/30',
      className
    )}
  >
    <rect width="30" height="30" fill="#012169" />
    <path d="M0,0 L30,30 M30,0 L0,30" stroke="#fff" strokeWidth="4" />
    <path
      d="M0,0 L15,15 M30,0 L15,15 M15,15 L0,30 M15,15 L30,30"
      stroke="#C8102E"
      strokeWidth="1.5"
    />
    <path d="M15,0 v30 M0,15 h30" stroke="#fff" strokeWidth="6" />
    <path d="M15,0 v30 M0,15 h30" stroke="#C8102E" strokeWidth="3.6" />
  </svg>
);

const VietnamFlag = ({ className = 'size-5.5' }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn(
      'inline-block shrink-0 overflow-hidden rounded-full border border-stone-800/10 shadow-sm dark:border-stone-700/30',
      className
    )}
  >
    <rect width="30" height="30" fill="#da251d" />
    <path d="M15,6 L20.29,22.28 L6.44,12.22 L23.56,12.22 L9.71,22.28 Z" fill="#ffff00" />
  </svg>
);

export function AuthStatus() {
  const { user, googleConfigured, loading } = useSession();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const queryClient = useQueryClient();

  // Popover open state
  const [isOpen, setIsOpen] = useState(false);
  const [cs2capOpen, setCs2capOpen] = useState(false);

  // Active submenu: "none" | "language" | "theme"
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'language' | 'theme'>('none');

  // Interactive language state
  const [lang, setLang] = useState<'vi' | 'en'>(i18n.language as 'vi' | 'en');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem('cs2t_lang');
    if (savedLang === 'vi' || savedLang === 'en') {
      setLang(savedLang);
    }
  }, []);

  const handleLangChange = (newLang: 'vi' | 'en', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLang(newLang);
    changeLanguage(newLang);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTheme(newTheme);
  };

  // Close submenu when popover closes
  useEffect(() => {
    if (!isOpen) setActiveSubmenu('none');
  }, [isOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      queryClient.clear();
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="border-border bg-surface-muted h-10 w-10 animate-pulse rounded-full border" />
    );
  }

  if (!user) {
    return (
      <a
        href="/api/auth/google"
        onClick={(e) => {
          if (!googleConfigured || redirecting) {
            e.preventDefault();
            return;
          }
          setRedirecting(true);
        }}
        aria-disabled={!googleConfigured || redirecting}
        className={cn(
          'bg-accent text-accent-foreground shadow-accent/10 hover:bg-accent-hover hover:shadow-accent/20 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center gap-0 rounded-xl p-0 text-xs font-bold whitespace-nowrap shadow-md transition-all hover:shadow-lg active:scale-95 md:h-10 md:w-auto md:gap-1.5 md:rounded-lg md:px-3.5 lg:gap-2.5 lg:px-5.5',
          (!googleConfigured || redirecting) && 'pointer-events-none opacity-50'
        )}
      >
        {redirecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" strokeWidth={2.5} />
        )}
        <span className="hidden lg:inline">{t('auth.loginGmail')}</span>
      </a>
    );
  }

  const profileName = user.name;
  const profileEmail = user.email;
  const profileImage =
    user.image ||
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80';

  // Initials fallback
  const initials = profileName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2.5">
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            className="group border-border bg-surface hover:border-accent relative flex size-8 cursor-pointer items-center justify-center rounded-full border p-0 transition-all duration-300 outline-none hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 md:size-10"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt={t('auth.avatarAlt', "{{name}}'s profile avatar", { name: profileName })}
                className="size-full rounded-full object-cover transition duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="bg-surface-muted text-foreground flex size-full items-center justify-center rounded-full text-xs font-bold transition duration-300 group-hover:scale-105">
                {initials}
              </div>
            )}
            <span className="border-surface bg-success absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 shadow-sm" />
          </Button>
        </Popover.Trigger>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <Popover.Portal forceMount>
              <Popover.Content
                align="end"
                side="bottom"
                sideOffset={8}
                className="z-50 outline-none"
                onInteractOutside={(event) => {
                  // Radix swallowing fix: do not close Popover or swallow click if clicking on the absolute submenu
                  if (event.target && (event.target as HTMLElement).closest('.submenu-content')) {
                    event.preventDefault();
                  }
                }}
                asChild
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={springTransition}
                  className="border-border bg-surface shadow-soft relative w-[240px] overflow-visible rounded-xl border p-1.5 text-left select-none"
                >
                  {/* Google User Info Header (Avatar, Username, Email) */}
                  <div className="hover:bg-surface-hover/40 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition duration-150">
                    <div className="relative size-10 shrink-0">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt={t('auth.avatarAlt', "{{name}}'s profile avatar", {
                            name: profileName,
                          })}
                          className="border-border size-full rounded-full border object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="border-border bg-surface-muted text-foreground flex size-full items-center justify-center rounded-full border text-xs font-bold">
                          {initials}
                        </div>
                      )}
                      <span className="border-surface bg-success absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="text-foreground truncate text-sm leading-tight font-bold">
                        {profileName}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-[11px] leading-none font-medium">
                        {profileEmail}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="bg-border/70 mx-1 my-1.5 h-px" />

                  {/* CS2Cap API Key / Rate Limit Modal Trigger */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCs2capOpen(true);
                      setIsOpen(false);
                    }}
                    className="text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 outline-none"
                  >
                    <Key className="text-muted-foreground size-4" />
                    <span>{t('auth.rateLimitAndKey')}</span>
                  </Button>

                  {/* Divider */}
                  <div className="bg-border/70 mx-1 my-1.5 h-px" />

                  {/* Change Language Item */}
                  {!isMobile ? (
                    <div
                      className="relative"
                      onMouseEnter={() => setActiveSubmenu('language')}
                      onMouseLeave={() => setActiveSubmenu('none')}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveSubmenu(activeSubmenu === 'language' ? 'none' : 'language');
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 outline-none',
                          'text-foreground hover:bg-surface-hover',
                          activeSubmenu === 'language' && 'bg-surface-hover'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe className="text-muted-foreground size-4" />
                          <span>{t('auth.changeLanguage')}</span>
                        </div>
                        <ChevronRight className="text-muted-foreground size-3.5" />
                      </Button>

                      {/* Change Language Submenu (Exactly Like Screenshot, Opening to the Right) */}
                      <AnimatePresence>
                        {activeSubmenu === 'language' && (
                          <motion.div
                            initial={{ opacity: 0, x: -8, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -8, scale: 0.95 }}
                            transition={slideTransition}
                            className="submenu-content border-border bg-surface shadow-soft absolute top-0 left-[calc(100%+8px)] z-50 flex min-w-[170px] flex-col gap-1.5 rounded-xl border p-1.5"
                          >
                            {/* Invisible Hover Bridge */}
                            <div className="absolute top-0 -left-2 h-full w-2 bg-transparent" />
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => handleLangChange('en', e)}
                              className={cn(
                                'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                                lang === 'en' && 'bg-surface-hover'
                              )}
                            >
                              <UKFlag />
                              <span>{t('common.english')}</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => handleLangChange('vi', e)}
                              className={cn(
                                'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                                lang === 'vi' && 'bg-surface-hover'
                              )}
                            >
                              <VietnamFlag />
                              <span>{t('common.vietnamese')}</span>
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 px-3 py-1.5 text-xs select-none">
                      <div className="text-muted-foreground flex items-center gap-2 pb-0.5 font-semibold">
                        <Globe className="size-3.5" />
                        <span>{t('auth.changeLanguage')}</span>
                      </div>
                      <div className="bg-surface-muted/50 border-border/40 grid grid-cols-2 gap-1 rounded-lg border p-1">
                        <button
                          type="button"
                          onClick={(e) => handleLangChange('vi', e)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition',
                            lang === 'vi'
                              ? 'bg-background text-foreground border-border/20 border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <VietnamFlag className="size-3.5" />
                          <span>{t('common.vietnamese')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleLangChange('en', e)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition',
                            lang === 'en'
                              ? 'bg-background text-foreground border-border/20 border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <UKFlag className="size-3.5" />
                          <span>{t('common.english')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Change Theme Item */}
                  {!isMobile ? (
                    <div
                      className="relative mt-0.5"
                      onMouseEnter={() => setActiveSubmenu('theme')}
                      onMouseLeave={() => setActiveSubmenu('none')}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveSubmenu(activeSubmenu === 'theme' ? 'none' : 'theme');
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 outline-none',
                          'text-foreground hover:bg-surface-hover',
                          activeSubmenu === 'theme' && 'bg-surface-hover'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <Palette className="text-muted-foreground size-4" />
                          <span>{t('auth.changeTheme')}</span>
                        </div>
                        <ChevronRight className="text-muted-foreground size-3.5" />
                      </Button>

                      {/* Change Theme Submenu */}
                      <AnimatePresence>
                        {activeSubmenu === 'theme' && (
                          <motion.div
                            initial={{ opacity: 0, x: -8, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -8, scale: 0.95 }}
                            transition={slideTransition}
                            className="submenu-content border-border bg-surface shadow-soft absolute top-0 left-[calc(100%+8px)] z-50 flex min-w-[170px] flex-col gap-1.5 rounded-xl border p-1.5"
                          >
                            {/* Invisible Hover Bridge */}
                            <div className="absolute top-0 -left-2 h-full w-2 bg-transparent" />
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => handleThemeChange('dark', e)}
                              className={cn(
                                'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                                theme === 'dark' && 'bg-surface-hover'
                              )}
                            >
                              <i className="border-stone-850 size-3.5 shrink-0 rounded-full border bg-[#181A20] shadow-sm dark:border-stone-700" />
                              <span>{t('auth.darkTheme')}</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={(e) => handleThemeChange('light', e)}
                              className={cn(
                                'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                                theme === 'light' && 'bg-surface-hover'
                              )}
                            >
                              <i className="size-3.5 shrink-0 rounded-full border border-stone-300 bg-[#ffffff] shadow-sm dark:border-stone-800" />
                              <span>{t('auth.lightTheme')}</span>
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="mt-1 flex flex-col gap-1.5 px-3 py-1.5 text-xs select-none">
                      <div className="text-muted-foreground flex items-center gap-2 pb-0.5 font-semibold">
                        <Palette className="size-3.5" />
                        <span>{t('auth.changeTheme')}</span>
                      </div>
                      <div className="bg-surface-muted/50 border-border/40 grid grid-cols-2 gap-1 rounded-lg border p-1">
                        <button
                          type="button"
                          onClick={(e) => handleThemeChange('light', e)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition',
                            theme === 'light'
                              ? 'bg-background text-foreground border-border/20 border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <i className="size-3 shrink-0 rounded-full border border-stone-300 bg-[#ffffff] shadow-sm dark:border-stone-800" />
                          <span>{t('auth.lightThemeShort', 'Sáng')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleThemeChange('dark', e)}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-semibold transition',
                            theme === 'dark'
                              ? 'bg-background text-foreground border-border/20 border shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <i className="border-stone-850 size-3 shrink-0 rounded-full border bg-[#181A20] shadow-sm dark:border-stone-700" />
                          <span>{t('auth.darkThemeShort', 'Tối')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Space / Divider */}
                  <div className="bg-border/70 mx-1 my-1.5 h-px" />

                  {/* Logout (Exact Red Danger Theme) */}
                  {user ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loggingOut}
                      onClick={handleLogout}
                      className="text-danger hover:bg-danger-muted hover:text-danger flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150 outline-none disabled:opacity-50"
                    >
                      <LogOut className="text-danger size-4" />
                      <span>{t('auth.logout')}</span>
                    </Button>
                  ) : (
                    <a
                      href="/api/auth/google"
                      aria-disabled={!googleConfigured}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150 outline-none',
                        googleConfigured
                          ? 'text-accent hover:bg-accent/10'
                          : 'text-muted-foreground pointer-events-none'
                      )}
                    >
                      <LogIn className="size-4" />
                      <span>{t('auth.loginGmail')}</span>
                    </a>
                  )}
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          )}
        </AnimatePresence>
      </Popover.Root>
      <CS2CapModal open={cs2capOpen} onOpenChange={setCs2capOpen} mode="member" />
    </div>
  );
}
