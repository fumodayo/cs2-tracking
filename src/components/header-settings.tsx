'use client';

import React, { useState, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/i18n/config';
import { cn } from '@/utils/cn';
import { useIsMobile } from '@/hooks/use-is-mobile';

import { Button } from '@/components/ui/button';
const springTransition = {
  type: 'spring',
  stiffness: 380,
  damping: 26,
} as const;

// Custom high-quality circular SVG flags using inline SVGs for offline capability & CDN-independence
export const UKFlag = ({ className = 'size-5' }: { className?: string }) => (
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

export const VietnamFlag = ({ className = 'size-5' }: { className?: string }) => (
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

export const USFlag = ({ className = 'size-5' }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn(
      'inline-block shrink-0 overflow-hidden rounded-full border border-stone-800/10 shadow-sm dark:border-stone-700/30',
      className
    )}
  >
    <rect width="30" height="30" fill="#fff" />
    <path
      d="M0,2.3h30 M0,6.9h30 M0,11.5h30 M0,16.1h30 M0,20.7h30 M0,25.3h30 M0,30h30"
      stroke="#B22234"
      strokeWidth="2.3"
    />
    <rect width="14" height="16.1" fill="#3C3B6E" />
    <polygon
      points="7,8 7.5,9.5 9,9.5 7.8,10.5 8.2,12 7,11 5.8,12 6.2,10.5 5,9.5 6.5,9.5"
      fill="#fff"
    />
  </svg>
);

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheme();
    }
  };

  return (
    <Popover.Root
      open={isMobile ? false : isOpen}
      onOpenChange={(open) => {
        if (!isMobile) setIsOpen(open);
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleButtonClick}
          className="border-border bg-surface text-foreground hover:border-accent flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border p-0 transition-all duration-300 outline-none hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 md:size-10"
          aria-label={t('auth.changeTheme', 'Change Theme')}
          title={t('auth.changeTheme', 'Change Theme')}
        >
          {theme === 'dark' ? (
            <Moon className="size-4 md:size-[20px]" />
          ) : (
            <Sun className="size-4 md:size-[20px]" />
          )}
        </Button>
      </Popover.Trigger>

      <AnimatePresence>
        {isOpen && (
          <Popover.Portal forceMount>
            <Popover.Content
              align="end"
              side="bottom"
              sideOffset={8}
              className="z-50 outline-none"
              forceMount
              asChild
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={springTransition}
                className="border-border bg-surface shadow-soft w-[180px] rounded-xl border p-2.5 text-left select-none"
              >
                <div className="text-foreground px-3 pt-1 pb-2 text-[13px] font-bold">
                  {t('auth.changeTheme', 'Change Theme')}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTheme('dark');
                      setIsOpen(false);
                    }}
                    className={cn(
                      'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                      theme === 'dark' && 'bg-surface-hover'
                    )}
                  >
                    <i className="size-4 shrink-0 rounded-full bg-[#181A20] shadow-sm ring-1 ring-stone-700/80" />
                    <span>{t('auth.darkTheme', 'Dark Mode')}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTheme('light');
                      setIsOpen(false);
                    }}
                    className={cn(
                      'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                      theme === 'light' && 'bg-surface-hover'
                    )}
                  >
                    <i className="size-4 shrink-0 rounded-full bg-[#ffffff] shadow-sm ring-1 ring-stone-200/20" />
                    <span>{t('auth.lightTheme', 'Light Mode')}</span>
                  </Button>
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const isMobile = useIsMobile();

  useEffect(() => {
    setLang(i18n.language as 'vi' | 'en');
  }, [i18n.language]);

  const activeFlag =
    lang === 'vi' ? (
      <VietnamFlag className="size-5 md:size-[22px]" />
    ) : (
      <UKFlag className="size-5 md:size-[22px]" />
    );
  const langLabel = lang === 'vi' ? 'Ti\u1ebfng Vi\u1ec7t' : 'English';

  const handleLangChange = (newLang: 'vi' | 'en') => {
    setLang(newLang);
    changeLanguage(newLang);
    setIsOpen(false);
  };

  const toggleLanguage = () => {
    const nextLang = lang === 'vi' ? 'en' : 'vi';
    setLang(nextLang);
    changeLanguage(nextLang);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (isMobile) {
      e.preventDefault();
      e.stopPropagation();
      toggleLanguage();
    }
  };

  return (
    <Popover.Root
      open={isMobile ? false : isOpen}
      onOpenChange={(open) => {
        if (!isMobile) setIsOpen(open);
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleButtonClick}
          className="border-border bg-surface text-foreground hover:border-accent flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border p-0 transition-all duration-300 outline-none hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 md:size-10"
          aria-label={t('auth.changeLanguage', 'Change Language')}
          title={langLabel}
        >
          {activeFlag}
        </Button>
      </Popover.Trigger>

      <AnimatePresence>
        {isOpen && (
          <Popover.Portal forceMount>
            <Popover.Content
              align="end"
              side="bottom"
              sideOffset={8}
              className="z-50 outline-none"
              forceMount
              asChild
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={springTransition}
                className="border-border bg-surface shadow-soft w-[180px] rounded-xl border p-2.5 text-left select-none"
              >
                <div className="text-foreground px-3 pt-1 pb-2 text-[13px] font-bold">
                  {t('auth.changeLanguage', 'Change Language')}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange('en')}
                    className={cn(
                      'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                      lang === 'en' && 'bg-surface-hover'
                    )}
                  >
                    <UKFlag />
                    <span>English</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange('vi')}
                    className={cn(
                      'text-foreground hover:bg-surface-hover flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150',
                      lang === 'vi' && 'bg-surface-hover'
                    )}
                  >
                    <VietnamFlag />
                    <span>{lang === 'en' ? 'Vietnamese' : 'Ti\u1ebfng Vi\u1ec7t'}</span>
                  </Button>
                </div>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}

export { LanguageSelector as LanguageCurrencySelector };
