"use client";

import React, { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun, Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n/config";
import { useCurrency, type Currency } from "@/components/currency-provider";
import { cn } from "@/utils/cn";

import { Button } from "@/components/ui/button";
const springTransition = {
  type: "spring",
  stiffness: 380,
  damping: 26,
} as const;

// Custom high-quality circular SVG flags
export const UKFlag = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0 rounded-full border border-border shadow-sm"
  >
    <defs>
      <clipPath id="uk-clip-nav">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#uk-clip-nav)">
      <rect width="24" height="24" fill="#00247d" />
      <line x1="0" y1="0" x2="24" y2="24" stroke="#ffffff" strokeWidth="3" />
      <line x1="24" y1="0" x2="0" y2="24" stroke="#ffffff" strokeWidth="3" />
      <line x1="0" y1="0" x2="24" y2="24" stroke="#cf142b" strokeWidth="1.2" />
      <line x1="24" y1="0" x2="0" y2="24" stroke="#cf142b" strokeWidth="1.2" />
      <line x1="12" y1="0" x2="12" y2="24" stroke="#ffffff" strokeWidth="4.5" />
      <line x1="0" y1="12" x2="24" y2="12" stroke="#ffffff" strokeWidth="4.5" />
      <line x1="12" y1="0" x2="12" y2="24" stroke="#cf142b" strokeWidth="2.7" />
      <line x1="0" y1="12" x2="24" y2="12" stroke="#cf142b" strokeWidth="2.7" />
    </g>
  </svg>
);

export const VietnamFlag = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0 rounded-full border border-border shadow-sm"
  >
    <circle cx="12" cy="12" r="12" fill="#da251d" />
    <polygon
      fill="#ffff00"
      points="12,5.5 13.5,10 18.2,10 14.4,12.8 15.8,17.3 12,14.5 8.2,17.3 9.6,12.8 5.8,10 10.5,10"
    />
  </svg>
);

export const USFlag = () => (
  <svg
    viewBox="0 0 24 24"
    className="size-5 shrink-0 rounded-full border border-border shadow-sm"
  >
    <defs>
      <clipPath id="us-clip-nav">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
    </defs>
    <g clipPath="url(#us-clip-nav)">
      <rect width="24" height="24" fill="#bb133e" />
      <rect width="24" height="1.85" y="1.85" fill="#ffffff" />
      <rect width="24" height="1.85" y="5.54" fill="#ffffff" />
      <rect width="24" height="1.85" y="9.23" fill="#ffffff" />
      <rect width="24" height="1.85" y="12.92" fill="#ffffff" />
      <rect width="24" height="1.85" y="16.61" fill="#ffffff" />
      <rect width="24" height="1.85" y="20.3" fill="#ffffff" />
      <rect width="12" height="12.92" fill="#002147" />
      <circle cx="2" cy="2" r="0.5" fill="#ffffff" />
      <circle cx="4" cy="2" r="0.5" fill="#ffffff" />
      <circle cx="6" cy="2" r="0.5" fill="#ffffff" />
      <circle cx="8" cy="2" r="0.5" fill="#ffffff" />
      <circle cx="10" cy="2" r="0.5" fill="#ffffff" />
      <circle cx="3" cy="4.23" r="0.5" fill="#ffffff" />
      <circle cx="5" cy="4.23" r="0.5" fill="#ffffff" />
      <circle cx="7" cy="4.23" r="0.5" fill="#ffffff" />
      <circle cx="9" cy="4.23" r="0.5" fill="#ffffff" />
      <circle cx="2" cy="6.46" r="0.5" fill="#ffffff" />
      <circle cx="4" cy="6.46" r="0.5" fill="#ffffff" />
      <circle cx="6" cy="6.46" r="0.5" fill="#ffffff" />
      <circle cx="8" cy="6.46" r="0.5" fill="#ffffff" />
      <circle cx="10" cy="6.46" r="0.5" fill="#ffffff" />
      <circle cx="3" cy="8.69" r="0.5" fill="#ffffff" />
      <circle cx="5" cy="8.69" r="0.5" fill="#ffffff" />
      <circle cx="7" cy="8.69" r="0.5" fill="#ffffff" />
      <circle cx="9" cy="8.69" r="0.5" fill="#ffffff" />
      <circle cx="2" cy="10.92" r="0.5" fill="#ffffff" />
      <circle cx="4" cy="10.92" r="0.5" fill="#ffffff" />
      <circle cx="6" cy="10.92" r="0.5" fill="#ffffff" />
      <circle cx="8" cy="10.92" r="0.5" fill="#ffffff" />
      <circle cx="10" cy="10.92" r="0.5" fill="#ffffff" />
    </g>
  </svg>
);

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95"
          aria-label="Toggle Theme Options"
        >
          {theme === "dark" ? (
            <Moon className="size-[20px]" />
          ) : (
            <Sun className="size-[20px]" />
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
                className="w-[180px] rounded-xl border border-border bg-surface p-2.5 text-left shadow-soft select-none"
              >
                <div className="px-2 pb-2 text-[13px] font-bold text-foreground">
                  {t("auth.changeTheme", "Change Theme")}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTheme("dark");
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition duration-150 hover:bg-surface-hover",
                      theme === "dark"
                        ? "bg-accent/12 text-accent border border-accent/20 shadow-sm hover:bg-accent/15"
                        : "border border-transparent text-stone-400 hover:text-stone-200"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full border border-border transition-all",
                        theme === "dark"
                          ? "border-accent bg-surface shadow-sm"
                          : "bg-transparent",
                      )}
                    >
                      {theme === "dark" && (
                        <span className="size-2 rounded-full bg-accent" />
                      )}
                    </span>
                    <span>{t("auth.darkTheme", "Dark Mode")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTheme("light");
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-semibold transition duration-150 hover:bg-surface-hover",
                      theme === "light"
                        ? "bg-accent/12 text-accent border border-accent/20 shadow-sm hover:bg-accent/15"
                        : "border border-transparent text-stone-400 hover:text-stone-200"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-full border border-border transition-all",
                        theme === "light"
                          ? "border-accent bg-surface shadow-sm"
                          : "bg-transparent",
                      )}
                    >
                      {theme === "light" && (
                        <span className="size-2 rounded-full bg-accent" />
                      )}
                    </span>
                    <span>{t("auth.lightTheme", "Light Mode")}</span>
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
  const [lang, setLang] = useState<"vi" | "en">("vi");

  useEffect(() => {
    setLang(i18n.language as "vi" | "en");
  }, [i18n.language]);

  const activeFlag = lang === "vi" ? <VietnamFlag /> : <UKFlag />;
  const langLabel = lang === "vi" ? "Tiếng Việt" : "English";

  const handleLangChange = (newLang: "vi" | "en") => {
    setLang(newLang);
    changeLanguage(newLang);
    setIsOpen(false);
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95"
        >
          {activeFlag}
          <span>{langLabel}</span>
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
                className="w-[180px] rounded-xl border border-border bg-surface p-2 text-left shadow-soft select-none"
              >
                <div className="flex flex-col gap-1">
                  <div className="px-2 pb-1.5 pt-1 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                    {t("auth.changeLanguage", "Change Language")}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange("en")}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold transition duration-150 hover:bg-surface-hover",
                      lang === "en"
                        ? "bg-accent/8 border border-accent/15 text-foreground"
                        : "border border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <UKFlag />
                      <span>English</span>
                    </div>
                    {lang === "en" && <Check className="size-3.5 text-accent shrink-0" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange("vi")}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold transition duration-150 hover:bg-surface-hover",
                      lang === "vi"
                        ? "bg-accent/8 border border-accent/15 text-foreground"
                        : "border border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <VietnamFlag />
                      <span>Tiếng Việt</span>
                    </div>
                    {lang === "vi" && <Check className="size-3.5 text-accent shrink-0" />}
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
