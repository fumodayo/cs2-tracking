import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertCircle, HelpCircle, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { parseSteamCookies, buildSteamCookie } from "@/infrastructure/steam";
import { AccountEntry } from "../types";
import { toast } from "@/stores";
import { Button } from "@/components/ui/button";

interface CookieStatus {
  status: "idle" | "loading" | "live" | "expired" | "error";
  message?: string;
}

interface AccountCookieConfigProps {
  acc: AccountEntry;
  isCookieInvalid: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateCookie: (cookie: string) => void;
  onUpdateSessionId: (sessionId: string) => void;
  cookieStatus?: CookieStatus;
  checkCooldown: number;
  onCheckCookie: (accountId: string, steamUrl: string, steamCookie: string) => void;
  onOpenGuide: () => void;
}

export function AccountCookieConfig({
  acc,
  isCookieInvalid,
  isExpanded,
  onToggleExpand,
  onUpdateCookie,
  onUpdateSessionId,
  cookieStatus,
  checkCooldown,
  onCheckCookie,
  onOpenGuide,
}: AccountCookieConfigProps) {
  const [cookieInput, setCookieInput] = useState("");
  const [parentalInput, setParentalInput] = useState("");
  const [sessionInput, setSessionInput] = useState("");

  const [showSecureCookie, setShowSecureCookie] = useState(false);
  const [showSecureParental, setShowSecureParental] = useState(false);
  const [showSecureSessionId, setShowSecureSessionId] = useState(false);

  const [isFamilyViewEnabled, setIsFamilyViewEnabled] = useState(false);

  // Sync initial values from acc when opened
  useEffect(() => {
    if (isExpanded) {
      if (acc.steamCookie) {
        const parsed = parseSteamCookies(acc.steamCookie);
        setCookieInput(parsed.steamLoginSecure || "");
        setParentalInput(parsed.steamparental || "");
        if (parsed.steamparental || parsed.sessionid || acc.steamSessionId) {
          setIsFamilyViewEnabled(true);
        }
      } else {
        setCookieInput("");
        setParentalInput("");
      }
      setSessionInput(acc.steamSessionId || (acc.steamCookie ? parseSteamCookies(acc.steamCookie).sessionid || "" : ""));
    }
  }, [isExpanded, acc.steamCookie, acc.steamSessionId]);

  const handleSaveCookie = () => {
    if (!cookieInput.trim() && (parentalInput.trim() || sessionInput.trim())) {
      toast.error("Vui lòng nhập steamLoginSecure trước khi lưu các cookie khác.");
      return;
    }
    
    const sSessionId = isFamilyViewEnabled ? sessionInput.trim() : "";
    const sParental = isFamilyViewEnabled ? parentalInput.trim() : "";

    if (sSessionId) {
      onUpdateSessionId(sSessionId);
    } else {
      onUpdateSessionId("");
    }

    if (cookieInput.trim()) {
      const fullCookie = buildSteamCookie(
        cookieInput.trim(),
        sSessionId,
        sParental
      );
      onUpdateCookie(fullCookie);
      toast.success("Đã cập nhật cookie thành công.");
    } else {
      onUpdateCookie("");
      toast.success("Đã xóa cấu hình cookie.");
    }
  };

  const hasCookieSet = typeof acc.steamCookie === "string" && acc.steamCookie.trim().length > 0;
  
  const parsed = parseSteamCookies(acc.steamCookie || "");
  const parsedLoginSecure = parsed.steamLoginSecure;
  const parsedParental = parsed.steamparental || "";
  const parsedSessionId = acc.steamSessionId || parsed.sessionid || "";

  const hasUnsavedCookieChange =
    cookieInput !== parsedLoginSecure ||
    parentalInput !== parsedParental ||
    sessionInput !== parsedSessionId;

  const isSavedCookieCheckable = hasCookieSet && !hasUnsavedCookieChange;

  return (
    <div
      className={`rounded border transition-all duration-200 ${
        isCookieInvalid ? "border-red-500/25 bg-red-950/5" : "border-stone-800 bg-stone-950/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between rounded-t px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition-colors hover:bg-stone-900/20 hover:text-stone-300 cursor-pointer focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full transition-all duration-300 ${
              isCookieInvalid
                ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
                : acc.steamCookie
                ? "bg-blue-450 animate-pulse"
                : "bg-stone-600"
            }`}
          />
          <span className={isCookieInvalid ? "font-bold text-red-400" : ""}>
            Cookie Config (Held Items)
          </span>
        </span>
        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="cookie-config-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-1 space-y-2.5 border-t border-stone-850/40 p-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-[9px] font-bold tracking-wider text-stone-500 uppercase">
                      steamLoginSecure (Cookie)
                    </label>
                    {cookieStatus && (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                          cookieStatus.status === "live"
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : cookieStatus.status === "expired"
                            ? "border border-red-500/20 bg-red-500/10 text-red-400"
                            : cookieStatus.status === "error"
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "bg-stone-500/10 text-stone-400"
                        }`}
                      >
                        <span
                          className={`size-1 rounded-full ${
                            cookieStatus.status === "live"
                              ? "animate-pulse bg-emerald-400"
                              : cookieStatus.status === "expired"
                              ? "bg-red-400"
                              : cookieStatus.status === "error"
                              ? "bg-amber-400"
                              : "bg-stone-400"
                          }`}
                        />
                        {cookieStatus.status === "loading"
                          ? "Check..."
                          : cookieStatus.status === "live"
                          ? "Live"
                          : cookieStatus.status === "expired"
                          ? "Hết hạn"
                          : cookieStatus.status === "error"
                          ? "Lỗi"
                          : "Không xác định"}
                      </span>
                    )}
                    {cookieStatus?.message && (
                      <span className="text-[10px] text-stone-500" title={cookieStatus.message}>
                        {cookieStatus.status === "expired" || cookieStatus.status === "error" ? (
                          <AlertCircle className="size-3 text-red-400" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="flex items-center gap-1 text-[9px] font-semibold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    <HelpCircle className="size-2.5" />
                    Lấy Cookie thế nào?
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-grow">
                      <input
                        type={showSecureCookie ? "text" : "password"}
                        placeholder="Nhập steamLoginSecure..."
                        value={cookieInput}
                        onChange={(e) => setCookieInput(e.target.value)}
                        disabled={acc.status === "scanning"}
                        className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-800 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecureCookie((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                      >
                        {showSecureCookie ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={acc.status === "scanning"}
                        onClick={handleSaveCookie}
                        className="h-[26px] cursor-pointer px-2.5 py-1 text-[10px] font-semibold text-stone-300 transition-colors hover:text-stone-100 disabled:opacity-50"
                      >
                        Lưu
                      </Button>
                      {isSavedCookieCheckable && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            cookieStatus?.status === "loading" ||
                            checkCooldown > 0 ||
                            acc.status === "scanning"
                          }
                          onClick={() => {
                            if (!cookieInput.trim()) {
                              toast.error("Vui lòng nhập steamLoginSecure để kiểm tra.");
                              return;
                            }
                            onCheckCookie(
                              acc.id,
                              acc.url,
                              buildSteamCookie(
                                cookieInput.trim(),
                                isFamilyViewEnabled ? sessionInput.trim() : "",
                                isFamilyViewEnabled ? parentalInput.trim() : ""
                              )
                            );
                          }}
                          className="flex h-[26px] min-w-[64px] cursor-pointer items-center justify-center px-2.5 py-1 text-[10px] font-semibold text-stone-300 transition-colors hover:text-stone-100 disabled:opacity-50"
                          title="Kiểm tra xem cookie còn hoạt động không"
                        >
                          {cookieStatus?.status === "loading" ? (
                            <span className="size-3 animate-spin rounded-full border-2 border-stone-400 border-t-transparent" />
                          ) : checkCooldown > 0 ? (
                            <span>{checkCooldown}s</span>
                          ) : (
                            <span>Kiểm tra</span>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsFamilyViewEnabled((prev) => !prev)}
                    className="flex w-full items-center justify-between h-7 px-2 text-[10px] font-semibold text-stone-400 hover:bg-stone-900/30 hover:text-stone-300"
                  >
                    <span>Tài khoản sử dụng Family View</span>
                    {isFamilyViewEnabled ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </Button>

                  <AnimatePresence initial={false}>
                    {isFamilyViewEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-1.5 border-l border-stone-800 pl-2 mt-1 space-y-1.5 pb-1">
                          <div className="relative w-full">
                            <input
                              type={showSecureParental ? "text" : "password"}
                              placeholder="Nhập steamparental (Nếu có bật Family View)..."
                              value={parentalInput}
                              onChange={(e) => setParentalInput(e.target.value)}
                              disabled={acc.status === "scanning"}
                              className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-800 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecureParental((prev) => !prev)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                            >
                              {showSecureParental ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                          <div className="relative w-full">
                            <input
                              type={showSecureSessionId ? "text" : "password"}
                              placeholder="Nhập sessionid (Cần thiết khi có bật Family View)..."
                              value={sessionInput}
                              onChange={(e) => setSessionInput(e.target.value)}
                              disabled={acc.status === "scanning"}
                              className="w-full rounded border border-stone-800 bg-stone-950 pl-2 pr-7 py-1 text-xs text-stone-300 placeholder-stone-700 transition-colors focus:border-stone-700 focus:outline-none focus:ring-1 focus:ring-stone-800 disabled:opacity-50"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecureSessionId((prev) => !prev)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 focus:outline-none cursor-pointer"
                            >
                              {showSecureSessionId ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
