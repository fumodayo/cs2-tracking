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

// Custom high-quality circular SVG flags
export const UKFlag = () => (
  <span className="fi fi-gb fis size-5 rounded-full inline-block overflow-hidden shrink-0 border border-border shadow-sm" />
);

export const VietnamFlag = () => (
  <span className="fi fi-vn fis size-5 rounded-full inline-block overflow-hidden shrink-0 border border-border shadow-sm" />
);

export const USFlag = () => (
  <span className="fi fi-us fis size-5 rounded-full inline-block overflow-hidden shrink-0 border border-border shadow-sm" />
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
                <div className="px-3 pb-2 pt-1 text-[13px] font-bold text-foreground">
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
          className="flex h-9 cursor-pointer items-center gap-0 sm:gap-2 rounded-lg border border-border bg-surface px-2.5 sm:px-3 text-xs font-semibold text-foreground transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95"
        >
          {activeFlag}
          <span className="hidden sm:inline">{langLabel}</span>
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
                <div className="flex flex-col gap-1">
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
                    <span>{lang === "en" ? "Vietnamese" : "Tiếng Việt"}</span>
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
