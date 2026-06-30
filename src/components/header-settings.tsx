"use client";

import React, { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n/config";
import { cn } from "@/utils/cn";

import { Button } from "@/components/ui/button";
const springTransition = {
  type: "spring",
  stiffness: 380,
  damping: 26,
} as const;

// Custom high-quality circular SVG flags using inline SVGs for offline capability & CDN-independence
export const UKFlag = ({ className = "size-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn("inline-block shrink-0 rounded-full border border-stone-800/10 dark:border-stone-700/30 shadow-sm overflow-hidden", className)}
  >
    <rect width="30" height="30" fill="#012169" />
    <path d="M0,0 L30,30 M30,0 L0,30" stroke="#fff" strokeWidth="4" />
    <path d="M0,0 L15,15 M30,0 L15,15 M15,15 L0,30 M15,15 L30,30" stroke="#C8102E" strokeWidth="1.5" />
    <path d="M15,0 v30 M0,15 h30" stroke="#fff" strokeWidth="6" />
    <path d="M15,0 v30 M0,15 h30" stroke="#C8102E" strokeWidth="3.6" />
  </svg>
);

export const VietnamFlag = ({ className = "size-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn("inline-block shrink-0 rounded-full border border-stone-800/10 dark:border-stone-700/30 shadow-sm overflow-hidden", className)}
  >
    <rect width="30" height="30" fill="#da251d" />
    <path
      d="M15,6 L20.29,22.28 L6.44,12.22 L23.56,12.22 L9.71,22.28 Z"
      fill="#ffff00"
    />
  </svg>
);

export const USFlag = ({ className = "size-5" }: { className?: string }) => (
  <svg
    viewBox="0 0 30 30"
    className={cn("inline-block shrink-0 rounded-full border border-stone-800/10 dark:border-stone-700/30 shadow-sm overflow-hidden", className)}
  >
    <rect width="30" height="30" fill="#fff" />
    <path d="M0,2.3h30 M0,6.9h30 M0,11.5h30 M0,16.1h30 M0,20.7h30 M0,25.3h30 M0,30h30" stroke="#B22234" strokeWidth="2.3" />
    <rect width="14" height="16.1" fill="#3C3B6E" />
    <polygon points="7,8 7.5,9.5 9,9.5 7.8,10.5 8.2,12 7,11 5.8,12 6.2,10.5 5,9.5 6.5,9.5" fill="#fff" />
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
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 p-0"
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
                <div className="px-3 pb-2 pt-1 text-[13px] font-bold text-foreground">
                  {t("auth.changeTheme", "Change Theme")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTheme("dark");
                      setIsOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                      theme === "dark" && "bg-surface-hover"
                    )}
                  >
                    <i className="size-4 shrink-0 rounded-full bg-[#181A20] shadow-sm ring-1 ring-stone-700/80" />
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
                      "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                      theme === "light" && "bg-surface-hover"
                    )}
                  >
                    <i className="size-4 shrink-0 rounded-full bg-[#ffffff] shadow-sm ring-1 ring-stone-200/20" />
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
  const langLabel = lang === "vi" ? "Ti\u1ebfng Vi\u1ec7t" : "English";

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
          className="flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-bold text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95"
        >
          {activeFlag}
          <span className="hidden md:inline">{langLabel}</span>
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
                <div className="px-3 pb-2 pt-1 text-[13px] font-bold text-foreground">
                  {t("auth.changeLanguage", "Change Language")}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange("en")}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                      lang === "en" && "bg-surface-hover"
                    )}
                  >
                    <UKFlag />
                    <span>English</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleLangChange("vi")}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                      lang === "vi" && "bg-surface-hover"
                    )}
                  >
                    <VietnamFlag />
                    <span>{lang === "en" ? "Vietnamese" : "Ti\u1ebfng Vi\u1ec7t"}</span>
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
