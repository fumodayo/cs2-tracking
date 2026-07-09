import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { parseSteamCookies, buildSteamCookie } from '@/utils/steam-cookies';
import { AccountEntry } from '../types';
import { toast } from '@/stores';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip';

interface CookieStatus {
  status: 'idle' | 'loading' | 'live' | 'expired' | 'error';
  message?: string;
}

interface AccountCookieConfigProps {
  acc: AccountEntry;
  isCookieInvalid: boolean;
  hasFamilyViewError?: boolean;
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
  hasFamilyViewError = false,
  isExpanded,
  onToggleExpand,
  onUpdateCookie,
  onUpdateSessionId,
  cookieStatus,
  checkCooldown,
  onCheckCookie,
  onOpenGuide,
}: AccountCookieConfigProps) {
  const { t } = useTranslation();
  const [cookieInput, setCookieInput] = useState('');
  const [parentalInput, setParentalInput] = useState('');
  const [sessionInput, setSessionInput] = useState('');

  const [showSecureCookie, setShowSecureCookie] = useState(false);
  const [showSecureParental, setShowSecureParental] = useState(false);
  const [showSecureSessionId, setShowSecureSessionId] = useState(false);

  const [isFamilyViewEnabled, setIsFamilyViewEnabled] = useState(false);

  // Đồng bộ giá trị ban đầu từ acc khi mở
  useEffect(() => {
    if (isExpanded) {
      if (acc.steamCookie) {
        const parsed = parseSteamCookies(acc.steamCookie);
        setCookieInput(parsed.steamLoginSecure || '');
        setParentalInput(parsed.steamparental || '');
        if (parsed.steamparental || parsed.sessionid || acc.steamSessionId || hasFamilyViewError) {
          setIsFamilyViewEnabled(true);
        }
      } else {
        setCookieInput('');
        setParentalInput('');
        if (hasFamilyViewError) {
          setIsFamilyViewEnabled(true);
        }
      }
      setSessionInput(
        acc.steamSessionId ||
          (acc.steamCookie ? parseSteamCookies(acc.steamCookie).sessionid || '' : '')
      );
    }
  }, [isExpanded, acc.steamCookie, acc.steamSessionId, hasFamilyViewError]);

  const syncToParent = (
    cookie: string,
    parental: string,
    session: string,
    familyEnabled: boolean
  ) => {
    const sSessionId = familyEnabled ? session.trim() : '';
    const sParental = familyEnabled ? parental.trim() : '';

    if (sSessionId !== (acc.steamSessionId || '')) {
      onUpdateSessionId(sSessionId);
    }

    // Trích token sạch nếu user dán nguyên chuỗi cookie
    const parsedCookie = parseSteamCookies(cookie.trim());
    const cleanCookieToken = parsedCookie.steamLoginSecure || cookie.trim();

    const fullCookie = cleanCookieToken
      ? buildSteamCookie(cleanCookieToken, sSessionId, sParental)
      : '';

    if (fullCookie !== (acc.steamCookie || '')) {
      onUpdateCookie(fullCookie);
    }
  };

  const handleSaveCookie = (silent = false) => {
    if (!cookieInput.trim() && (parentalInput.trim() || sessionInput.trim())) {
      if (!silent) toast.error(t('inventoryScanner.toastEnterSecureBeforeOthers'));
      return;
    }

    const sSessionId = isFamilyViewEnabled ? sessionInput.trim() : '';
    const sParental = isFamilyViewEnabled ? parentalInput.trim() : '';

    if (sSessionId !== (acc.steamSessionId || '')) {
      onUpdateSessionId(sSessionId);
    }

    const parsedCookie = parseSteamCookies(cookieInput.trim());
    const cleanCookieToken = parsedCookie.steamLoginSecure || cookieInput.trim();

    const fullCookie = cleanCookieToken
      ? buildSteamCookie(cleanCookieToken, sSessionId, sParental)
      : '';

    onUpdateCookie(fullCookie);
    if (!silent) {
      if (fullCookie) {
        toast.success(t('inventoryScanner.toastCookieUpdated'));
      } else {
        toast.success(t('inventoryScanner.toastCookieCleared'));
      }
    }
  };

  return (
    <div
      className={`rounded border transition-all duration-200 ${
        hasFamilyViewError
          ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/10'
          : isCookieInvalid
            ? 'border-red-300 bg-red-50 dark:border-red-500/25 dark:bg-red-950/5'
            : 'border-stone-800 bg-stone-950/20'
      }`}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full cursor-pointer items-center justify-between rounded-t px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition-colors hover:bg-stone-900/20 hover:text-stone-300 focus:outline-none"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full transition-all duration-300 ${
              hasFamilyViewError
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)]'
                : isCookieInvalid
                  ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                  : acc.steamCookie
                    ? 'bg-blue-500'
                    : 'bg-stone-600'
            }`}
          />
          <span
            className={
              hasFamilyViewError
                ? 'font-bold text-amber-700 dark:text-amber-300'
                : isCookieInvalid
                  ? 'font-bold text-red-700 dark:text-red-300'
                  : ''
            }
          >
            {t('inventoryScanner.cookieConfig')}
          </span>
        </span>
        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="cookie-config-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-stone-850/40 mt-1 space-y-2.5 border-t p-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`cookie-secure-input-${acc.id}`}
                      className="block text-[9px] font-bold tracking-wider text-stone-500"
                    >
                      <span className="opacity-75">steamLoginSecure</span>
                      <span className="ml-1 font-bold text-red-500">*</span>
                    </label>
                    {cookieStatus && (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                          cookieStatus.status === 'live'
                            ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                            : cookieStatus.status === 'expired'
                              ? 'border border-red-500/20 bg-red-500/10 text-red-400'
                              : cookieStatus.status === 'error'
                                ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                                : 'bg-stone-500/10 text-stone-400'
                        }`}
                      >
                        <span
                          className={`size-1 rounded-full ${
                            cookieStatus.status === 'live'
                              ? 'bg-emerald-400'
                              : cookieStatus.status === 'expired'
                                ? 'bg-red-400'
                                : cookieStatus.status === 'error'
                                  ? 'bg-amber-400'
                                  : 'bg-stone-400'
                          }`}
                        />
                        {cookieStatus.status === 'loading'
                          ? t('inventoryScanner.checking')
                          : cookieStatus.status === 'live'
                            ? t('inventoryScanner.live')
                            : cookieStatus.status === 'expired'
                              ? t('inventoryScanner.expired')
                              : cookieStatus.status === 'error'
                                ? t('inventoryScanner.error')
                                : t('inventoryScanner.unknown')}
                      </span>
                    )}
                    {cookieStatus?.message && (
                      <span className="text-[10px] text-stone-500" title={cookieStatus.message}>
                        {cookieStatus.status === 'expired' || cookieStatus.status === 'error' ? (
                          <AlertCircle className="size-3 text-red-400" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip
                      content={
                        <button
                          type="button"
                          onClick={onOpenGuide}
                          className="cursor-pointer text-[10px] font-semibold text-blue-400 underline hover:text-blue-300"
                        >
                          {t('inventoryScanner.howToGetCookie', 'Hướng dẫn lấy mã')}
                        </button>
                      }
                      side="top"
                      align="end"
                    >
                      <button
                        type="button"
                        onClick={onOpenGuide}
                        className="cursor-pointer rounded p-1 text-stone-500 transition-colors hover:bg-stone-900/30 hover:text-blue-400"
                        aria-label={t('inventoryScanner.howToGetCookie', 'Hướng dẫn lấy mã')}
                      >
                        <HelpCircle className="size-3.5" />
                      </button>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative w-full">
                    <input
                      id={`cookie-secure-input-${acc.id}`}
                      type={showSecureCookie ? 'text' : 'password'}
                      placeholder={t('inventoryScanner.enterSecurePlaceholder')}
                      value={cookieInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCookieInput(val);
                        syncToParent(val, parentalInput, sessionInput, isFamilyViewEnabled);
                      }}
                      disabled={acc.status === 'scanning'}
                      className="w-full rounded border border-stone-800 bg-stone-950 py-1.5 pr-7 pl-2 text-xs text-stone-300 placeholder-stone-500 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecureCookie((prev) => !prev)}
                      className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-stone-500 hover:text-stone-300 focus:outline-none"
                    >
                      {showSecureCookie ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsFamilyViewEnabled((prev) => !prev)}
                    className="flex h-7 w-full cursor-pointer items-center justify-between rounded-md px-2 text-[10px] font-semibold text-stone-400 transition-colors hover:bg-stone-900/30 hover:text-stone-300"
                  >
                    <span>{t('inventoryScanner.familyView')}</span>
                    {isFamilyViewEnabled ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </Button>

                  <AnimatePresence initial={false}>
                    {isFamilyViewEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-3 pb-1">
                          <div>
                            <label
                              htmlFor={`parental-input-${acc.id}`}
                              className="mb-1.5 block text-[9px] font-bold tracking-wider text-stone-500"
                            >
                              <span className="opacity-75">
                                {t('inventoryScanner.steamparentalLabel', 'Mã steamparental')}
                              </span>
                            </label>
                            <div className="relative w-full">
                              <input
                                id={`parental-input-${acc.id}`}
                                type={showSecureParental ? 'text' : 'password'}
                                placeholder={t('inventoryScanner.enterParentalPlaceholder')}
                                value={parentalInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setParentalInput(val);
                                  syncToParent(cookieInput, val, sessionInput, isFamilyViewEnabled);
                                }}
                                disabled={acc.status === 'scanning'}
                                className="w-full rounded border border-stone-800 bg-stone-950 py-1.5 pr-7 pl-2 text-xs text-stone-300 placeholder-stone-500 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none disabled:opacity-50"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecureParental((prev) => !prev)}
                                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-stone-500 hover:text-stone-300 focus:outline-none"
                              >
                                {showSecureParental ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor={`session-input-${acc.id}`}
                              className="mb-1.5 block text-[9px] font-bold tracking-wider text-stone-500"
                            >
                              <span className="opacity-75">
                                {t('inventoryScanner.sessionidLabel', 'Mã sessionid')}
                              </span>
                            </label>
                            <div className="relative w-full">
                              <input
                                id={`session-input-${acc.id}`}
                                type={showSecureSessionId ? 'text' : 'password'}
                                placeholder={t('inventoryScanner.enterSessionPlaceholder')}
                                value={sessionInput}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSessionInput(val);
                                  syncToParent(
                                    cookieInput,
                                    parentalInput,
                                    val,
                                    isFamilyViewEnabled
                                  );
                                }}
                                disabled={acc.status === 'scanning'}
                                className="w-full rounded border border-stone-800 bg-stone-950 py-1.5 pr-7 pl-2 text-xs text-stone-300 placeholder-stone-500 transition-colors focus:border-stone-700 focus:ring-1 focus:ring-stone-800 focus:outline-none disabled:opacity-50"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecureSessionId((prev) => !prev)}
                                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-stone-500 hover:text-stone-300 focus:outline-none"
                              >
                                {showSecureSessionId ? (
                                  <EyeOff className="size-3.5" />
                                ) : (
                                  <Eye className="size-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="border-stone-850/20 mt-3 flex items-center justify-end gap-2 border-t pt-2.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    cookieStatus?.status === 'loading' ||
                    checkCooldown > 0 ||
                    acc.status === 'scanning'
                  }
                  onClick={() => {
                    if (!cookieInput.trim()) {
                      toast.error(t('inventoryScanner.toastEnterSecureToCheck'));
                      return;
                    }
                    handleSaveCookie(true);
                    onCheckCookie(
                      acc.id,
                      acc.url,
                      buildSteamCookie(
                        cookieInput.trim(),
                        isFamilyViewEnabled ? sessionInput.trim() : '',
                        isFamilyViewEnabled ? parentalInput.trim() : ''
                      )
                    );
                  }}
                  className="h-7 cursor-pointer rounded border border-blue-500/20 bg-blue-500/10 px-4 text-[10px] font-bold text-blue-400 transition-all hover:border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-300 disabled:opacity-50"
                  title={t('inventoryScanner.checkCookieTooltip')}
                >
                  {cookieStatus?.status === 'loading' ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : checkCooldown > 0 ? (
                    <span>{checkCooldown}s</span>
                  ) : (
                    <span>{t('inventoryScanner.check')}</span>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
