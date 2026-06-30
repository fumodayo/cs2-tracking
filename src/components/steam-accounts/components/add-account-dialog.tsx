import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, ChevronDown, Loader2 } from "lucide-react";
import { FaSteam } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseSteamCookies, buildSteamCookie } from "@/utils/steam-cookies";
import { cn } from "@/utils/cn";

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { steamUrl: string; steamCookie: string }) => void;
  isPending: boolean;
}

export function AddAccountDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: AddAccountDialogProps) {
  const { t } = useTranslation();
  const [showModalSecureCookie, setShowModalSecureCookie] = useState(false);
  const [showModalSecureParental, setShowModalSecureParental] = useState(false);
  const [showModalSecureSessionId, setShowModalSecureSessionId] = useState(false);
  const [modalUseFamilyView, setModalUseFamilyView] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = String(formData.get("steamUrl") ?? "");
    const loginSecure = String(formData.get("steamCookie") ?? "").trim();
    const parental = modalUseFamilyView ? String(formData.get("steamparental") ?? "").trim() : "";
    const sessionId = modalUseFamilyView ? String(formData.get("sessionid") ?? "").trim() : "";

    let cookie = "";
    if (loginSecure) {
      const parsed = parseSteamCookies(loginSecure);
      const finalLoginSecure = parsed.steamLoginSecure || loginSecure;
      const finalParental = parental || (modalUseFamilyView ? (parsed.steamparental || "") : "");
      const finalSessionId = sessionId || (modalUseFamilyView ? (parsed.sessionid || "") : "");
      cookie = buildSteamCookie(finalLoginSecure, finalSessionId, finalParental);
    }

    if (url.trim()) {
      onSubmit({
        steamUrl: url,
        steamCookie: cookie,
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md border border-stone-800 bg-gradient-to-b from-stone-900/98 to-stone-950 text-stone-100 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl p-6">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex p-2 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-emerald-500/5 border border-accent/20 text-accent shadow-[0_0_15px_rgba(59,130,246,0.08)]">
              <FaSteam className="size-5.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-extrabold tracking-tight text-stone-200">
                {t("steamAccounts.addAccountTitle")}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-stone-400 mt-0.5 leading-relaxed">
                {t("steamAccounts.addAccountDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-extrabold tracking-[0.06em] text-stone-400 uppercase pl-0.5">
              {t("steamAccounts.steamProfileLinkLabel")}
            </label>
            <input
              name="steamUrl"
              type="text"
              required
              placeholder={t("dashboard.steamUrlPlaceholder")}
              disabled={isPending}
              className="h-10 w-full rounded-xl border border-stone-800 bg-stone-950/30 px-3.5 text-sm text-stone-100 transition-all outline-none placeholder:text-stone-700 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:bg-stone-950/70"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <label className="text-[10px] font-extrabold tracking-[0.06em] text-stone-400 uppercase">
                {t("steamAccounts.steamCookieSecureLabel")}
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent("show-cookie-guide"));
                }}
                className="text-[10px] font-extrabold text-accent/80 hover:text-accent hover:underline cursor-pointer transition-colors"
              >
                {t("dashboard.howToGetCookie")}
              </button>
            </div>
            <div className="relative w-full">
              <input
                name="steamCookie"
                type={showModalSecureCookie ? "text" : "password"}
                placeholder={t("dashboard.cookiePlaceholder")}
                disabled={isPending}
                className="h-10 w-full rounded-xl border border-stone-800 bg-stone-950/30 pl-3.5 pr-10 text-sm text-stone-100 transition-all outline-none placeholder:text-stone-700 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:bg-stone-950/70"
              />
              <button
                type="button"
                onClick={() => setShowModalSecureCookie(!showModalSecureCookie)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200"
              >
                {showModalSecureCookie ? (
                  <EyeOff className="size-4.5" />
                ) : (
                  <Eye className="size-4.5" />
                )}
              </button>
            </div>
          </div>

          <div className={cn(
            "border rounded-xl overflow-hidden transition-all duration-300",
            modalUseFamilyView ? "border-stone-800 bg-stone-950/40 shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]" : "border-stone-850/60 bg-stone-900/5"
          )}>
            <button
              type="button"
              onClick={() => setModalUseFamilyView(!modalUseFamilyView)}
              className="flex w-full items-center justify-between h-10 px-4 text-xs font-bold text-stone-400 hover:bg-stone-900/15 hover:text-stone-300 transition-colors cursor-pointer"
            >
              <span>{t("inventoryScanner.familyView")}</span>
              <ChevronDown className={cn("size-4 transition-transform duration-200", modalUseFamilyView && "rotate-180")} />
            </button>

            <AnimatePresence initial={false}>
              {modalUseFamilyView && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                >
                  <div className="flex flex-col gap-3.5 p-4 border-t border-stone-800 bg-stone-950/20">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-extrabold tracking-[0.06em] text-stone-400 uppercase pl-0.5">
                        {t("inventoryScanner.steamparentalOpt")}
                      </label>
                      <div className="relative w-full">
                        <input
                          name="steamparental"
                          type={showModalSecureParental ? "text" : "password"}
                          placeholder={t("inventoryScanner.enterParentalPlaceholder")}
                          disabled={isPending}
                          className="h-10 w-full rounded-xl border border-stone-800 bg-stone-950/30 pl-3.5 pr-10 text-sm text-stone-100 transition-all outline-none placeholder:text-stone-700 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:bg-stone-950/70"
                        />
                        <button
                          type="button"
                          onClick={() => setShowModalSecureParental(!showModalSecureParental)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200"
                        >
                          {showModalSecureParental ? (
                            <EyeOff className="size-4.5" />
                          ) : (
                            <Eye className="size-4.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-extrabold tracking-[0.06em] text-stone-400 uppercase pl-0.5">
                        {t("inventoryScanner.sessionidOpt")}
                      </label>
                      <div className="relative w-full">
                        <input
                          name="sessionid"
                          type={showModalSecureSessionId ? "text" : "password"}
                          placeholder={t("inventoryScanner.enterSessionPlaceholder")}
                          disabled={isPending}
                          className="h-10 w-full rounded-xl border border-stone-800 bg-stone-950/30 pl-3.5 pr-10 text-sm text-stone-100 transition-all outline-none placeholder:text-stone-700 focus:border-accent/40 focus:ring-2 focus:ring-accent/10 focus:bg-stone-950/70"
                        />
                        <button
                          type="button"
                          onClick={() => setShowModalSecureSessionId(!showModalSecureSessionId)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-200"
                        >
                          {showModalSecureSessionId ? (
                            <EyeOff className="size-4.5" />
                          ) : (
                            <Eye className="size-4.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end gap-2.5 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 rounded-xl border border-stone-800 hover:bg-stone-900/60 font-bold px-5 text-[10px] tracking-wider uppercase transition-colors cursor-pointer"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              className="h-10 rounded-xl bg-accent hover:bg-accent-hover font-bold text-white px-5 text-[10px] tracking-wider uppercase transition-all duration-300 shadow-[0_4px_15px_rgba(59,130,246,0.15)] hover:shadow-[0_4px_20px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {isPending
                ? t("steamAccounts.linking")
                : t("dashboard.link")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
