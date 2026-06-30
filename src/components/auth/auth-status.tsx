"use client";

import { useState, useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "./use-session";
import { useTheme } from "@/components/theme-provider";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Palette, LogOut, ChevronRight, LogIn, Key, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { CS2CapModal } from "./cs2cap-modal";

const springTransition = {
  type: "spring",
  stiffness: 380,
  damping: 26,
} as const;
const slideTransition = { duration: 0.15, ease: "easeOut" } as const;

// Custom high-performance circular flags using inline SVGs for offline capability & CDN-independence
const UKFlag = ({ className = "size-5.5" }: { className?: string }) => (
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

const VietnamFlag = ({ className = "size-5.5" }: { className?: string }) => (
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
  const [activeSubmenu, setActiveSubmenu] = useState<
    "none" | "language" | "theme"
  >("none");

  // Interactive language state
  const [lang, setLang] = useState<"vi" | "en">(i18n.language as "vi" | "en");

  // Load language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("cs2t_lang");
    if (savedLang === "vi" || savedLang === "en") {
      setLang(savedLang);
    }
  }, []);

  const handleLangChange = (newLang: "vi" | "en", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLang(newLang);
    changeLanguage(newLang);
  };

  const handleThemeChange = (
    newTheme: "light" | "dark",
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setTheme(newTheme);
  };

  // Close submenu when popover closes
  useEffect(() => {
    if (!isOpen) setActiveSubmenu("none");
  }, [isOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      queryClient.clear();
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="h-10 w-10 animate-pulse rounded-full border border-border bg-surface-muted" />
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
          "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 lg:gap-2.5 rounded-lg bg-accent px-3.5 lg:px-5.5 text-xs font-bold text-accent-foreground shadow-md shadow-accent/10 transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-95 whitespace-nowrap",
          (!googleConfigured || redirecting) && "pointer-events-none opacity-50",
        )}
      >
        {redirecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogIn className="size-4" strokeWidth={2.5} />
        )}
        <span className="hidden lg:inline">{t("auth.loginGmail")}</span>
      </a>
    );
  }

  const profileName = user.name;
  const profileEmail = user.email;
  const profileImage =
    user.image ||
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80";

  // Initials fallback
  const initials = profileName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2.5">
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            className="group relative flex size-10 cursor-pointer items-center justify-center rounded-full border border-border bg-surface transition-all duration-300 outline-none hover:border-accent hover:shadow-[0_0_12px_rgba(59,130,246,0.15)] active:scale-95 p-0"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt={t("auth.avatarAlt", "{{name}}'s profile avatar", { name: profileName })}
                className="size-full rounded-full object-cover transition duration-300 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-full items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-foreground transition duration-300 group-hover:scale-105">
                {initials}
              </div>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-success shadow-sm" />
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
                  if (
                    event.target &&
                    (event.target as HTMLElement).closest(".submenu-content")
                  ) {
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
                  className="relative w-[240px] overflow-visible rounded-xl border border-border bg-surface p-1.5 text-left shadow-soft select-none"
                >
                  {/* Google User Info Header (Avatar, Username, Email) */}
                  <div className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition duration-150 hover:bg-surface-hover/40">
                    <div className="relative size-10 shrink-0">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt={t("auth.avatarAlt", "{{name}}'s profile avatar", { name: profileName })}
                          className="size-full rounded-full border border-border object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center rounded-full border border-border bg-surface-muted text-xs font-bold text-foreground">
                          {initials}
                        </div>
                      )}
                      <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-success" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate text-sm leading-tight font-bold text-foreground">
                        {profileName}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] leading-none font-medium text-muted-foreground">
                        {profileEmail}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="mx-1 my-1.5 h-px bg-border/70" />

                  {/* CS2Cap API Key / Rate Limit Modal Trigger */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCs2capOpen(true);
                      setIsOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-foreground transition-all duration-200 outline-none hover:bg-surface-hover"
                  >
                    <Key className="size-4 text-muted-foreground" />
                    <span>{t("auth.rateLimitAndKey")}</span>
                  </Button>

                  {/* Divider */}
                  <div className="mx-1 my-1.5 h-px bg-border/70" />

                  {/* Change Language Item */}
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu("language")}
                    onMouseLeave={() => setActiveSubmenu("none")}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSubmenu(
                          activeSubmenu === "language" ? "none" : "language",
                        );
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 outline-none",
                        "text-foreground hover:bg-surface-hover",
                        activeSubmenu === "language" &&
                        "bg-surface-hover",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Globe className="size-4 text-muted-foreground" />
                        <span>{t("auth.changeLanguage")}</span>
                      </div>
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Button>

                    {/* Change Language Submenu (Exactly Like Screenshot, Opening to the Right) */}
                    <AnimatePresence>
                      {activeSubmenu === "language" && (
                        <motion.div
                          initial={{ opacity: 0, x: -8, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -8, scale: 0.95 }}
                          transition={slideTransition}
                          className="submenu-content absolute top-0 left-[calc(100%+8px)] z-50 min-w-[170px] flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-soft"
                        >
                          {/* Invisible Hover Bridge */}
                          <div className="absolute top-0 -left-2 h-full w-2 bg-transparent" />
                           <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => handleLangChange("en", e)}
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                              lang === "en" && "bg-surface-hover",
                            )}
                          >
                            <UKFlag />
                            <span>{t("common.english")}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => handleLangChange("vi", e)}
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                              lang === "vi" && "bg-surface-hover",
                            )}
                          >
                            <VietnamFlag />
                            <span>{t("common.vietnamese")}</span>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Change Theme Item */}
                  <div
                    className="relative mt-0.5"
                    onMouseEnter={() => setActiveSubmenu("theme")}
                    onMouseLeave={() => setActiveSubmenu("none")}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSubmenu(
                          activeSubmenu === "theme" ? "none" : "theme",
                        );
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all duration-200 outline-none",
                        "text-foreground hover:bg-surface-hover",
                        activeSubmenu === "theme" &&
                        "bg-surface-hover",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Palette className="size-4 text-muted-foreground" />
                        <span>{t("auth.changeTheme")}</span>
                      </div>
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    </Button>

                    {/* Change Theme Submenu */}
                    <AnimatePresence>
                      {activeSubmenu === "theme" && (
                        <motion.div
                          initial={{ opacity: 0, x: -8, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -8, scale: 0.95 }}
                          transition={slideTransition}
                          className="submenu-content absolute top-0 left-[calc(100%+8px)] z-50 min-w-[170px] flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-soft"
                        >
                          {/* Invisible Hover Bridge */}
                          <div className="absolute top-0 -left-2 h-full w-2 bg-transparent" />
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => handleThemeChange("dark", e)}
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                              theme === "dark" && "bg-surface-hover",
                            )}
                          >
                            <i className="size-3.5 rounded-full bg-[#181A20] shadow-sm border border-stone-850 dark:border-stone-700 shrink-0" />
                            <span>{t("auth.darkTheme")}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => handleThemeChange("light", e)}
                            className={cn(
                              "flex w-full cursor-pointer items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-xs font-bold text-foreground transition duration-150 hover:bg-surface-hover",
                              theme === "light" && "bg-surface-hover",
                            )}
                          >
                            <i className="size-3.5 rounded-full bg-[#ffffff] shadow-sm border border-stone-300 dark:border-stone-800 shrink-0" />
                            <span>{t("auth.lightTheme")}</span>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Space / Divider */}
                  <div className="mx-1 my-1.5 h-px bg-border/70" />

                  {/* Logout (Exact Red Danger Theme) */}
                  {user ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loggingOut}
                      onClick={handleLogout}
                      className="flex w-full cursor-pointer items-center justify-start gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold text-danger transition duration-150 outline-none hover:bg-danger-muted hover:text-danger disabled:opacity-50"
                    >
                      <LogOut className="size-4 text-danger" />
                      <span>{t("auth.logout")}</span>
                    </Button>
                  ) : (
                    <a
                      href="/api/auth/google"
                      aria-disabled={!googleConfigured}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-bold transition duration-150 outline-none",
                        googleConfigured
                          ? "text-accent hover:bg-accent/10"
                          : "pointer-events-none text-muted-foreground",
                      )}
                    >
                      <LogIn className="size-4" />
                      <span>{t("auth.loginGmail")}</span>
                    </a>
                  )}
                </motion.div>
              </Popover.Content>
            </Popover.Portal>
          )}
        </AnimatePresence>
      </Popover.Root>
      <CS2CapModal
        open={cs2capOpen}
        onOpenChange={setCs2capOpen}
        mode="member"
      />
    </div>
  );
}
