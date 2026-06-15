import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { parseSteamCookies, buildSteamCookie } from "@/infrastructure/steam";

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
      <DialogContent className="sm:max-w-md border-stone-800 bg-stone-950 text-stone-100">
        <DialogHeader>
          <DialogTitle className="text-stone-200">
            {t("dashboard.addAccount") || "Thêm tài khoản Steam"}
          </DialogTitle>
          <DialogDescription className="text-stone-500 text-xs">
            Nhập link profile Steam public và cookie steamLoginSecure (nếu cần quét hòm đồ riêng tư/đang giữ giao dịch).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-stone-400">
              Link Profile Steam
            </label>
            <input
              name="steamUrl"
              type="text"
              required
              placeholder={t("dashboard.steamUrlPlaceholder")}
              disabled={isPending}
              className="h-10 w-full rounded-md border border-stone-800 bg-stone-900/50 px-3 text-sm text-stone-100 transition-colors outline-none placeholder:text-stone-600 focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-400">
                Cookie steamLoginSecure (Tùy chọn)
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  // Dispatch custom event to trigger guide modal if needed, or simply handle it elsewhere
                  window.dispatchEvent(new CustomEvent("show-cookie-guide"));
                }}
                className="text-[10px] text-blue-400 hover:underline cursor-pointer"
              >
                Cách lấy Cookie?
              </button>
            </div>
            <div className="relative w-full">
              <input
                name="steamCookie"
                type={showModalSecureCookie ? "text" : "password"}
                placeholder={t("dashboard.cookiePlaceholder")}
                disabled={isPending}
                className="h-10 w-full rounded-md border border-stone-800 bg-stone-900/50 pl-3 pr-10 text-sm text-stone-100 transition-colors outline-none placeholder:text-stone-600 focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => setShowModalSecureCookie(!showModalSecureCookie)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
              >
                {showModalSecureCookie ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setModalUseFamilyView(!modalUseFamilyView)}
            className="flex w-full items-center justify-between h-9 px-3 text-xs font-semibold text-stone-400 hover:bg-stone-900/30 hover:text-stone-300"
          >
            <span>Tài khoản sử dụng Family View</span>
            {modalUseFamilyView ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>

          <AnimatePresence initial={false}>
            {modalUseFamilyView && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-3.5 border-l border-stone-800 pl-3.5 pb-1 mt-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-stone-400">
                      steamparental (Tùy chọn)
                    </label>
                    <div className="relative w-full">
                      <input
                        name="steamparental"
                        type={showModalSecureParental ? "text" : "password"}
                        placeholder="Nhập steamparental..."
                        disabled={isPending}
                        className="h-10 w-full rounded-md border border-stone-800 bg-stone-900/50 pl-3 pr-10 text-sm text-stone-100 transition-colors outline-none placeholder:text-stone-600 focus:border-accent focus:ring-1 focus:ring-accent/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalSecureParental(!showModalSecureParental)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                      >
                        {showModalSecureParental ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-stone-400">
                      sessionid (Tùy chọn)
                    </label>
                    <div className="relative w-full">
                      <input
                        name="sessionid"
                        type={showModalSecureSessionId ? "text" : "password"}
                        placeholder="Nhập sessionid..."
                        disabled={isPending}
                        className="h-10 w-full rounded-md border border-stone-800 bg-stone-900/50 pl-3 pr-10 text-sm text-stone-100 transition-colors outline-none placeholder:text-stone-600 focus:border-accent focus:ring-1 focus:ring-accent/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalSecureSessionId(!showModalSecureSessionId)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                      >
                        {showModalSecureSessionId ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 px-4 text-sm font-semibold"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              className="h-10 px-4 text-sm font-semibold"
            >
              {isPending
                ? t("dashboard.linking") || "Đang liên kết..."
                : t("dashboard.link") || "Liên kết"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
