import React, { useState, useEffect } from 'react';
import {
  Loader2,
  Search,
  ChevronDown,
  Trash2,
  AlertCircle,
  ShoppingBag,
  Wallet,
  ExternalLink,
} from 'lucide-react';
import { proxySteamUrl } from '@/utils/url';
import { useTranslation } from 'react-i18next';
import { AccountEntry } from '../types';
import {
  formatVND,
  formatProgressDetail,
  translateScanProgressMessage,
  translateAccountError,
  isCookieCredentialError,
  isFamilyViewAccountError,
  isPrivateInventoryAccountError,
  STEAM_PRIVACY_SETTINGS_URL,
} from '../utils';
import { AccountCookieConfig } from './account-cookie-config';
import { toast } from '@/stores';

interface CookieStatus {
  status: 'idle' | 'loading' | 'live' | 'expired' | 'error';
  message?: string;
}

export interface AccountCardProps {
  acc: AccountEntry;
  index: number;
  isExpandedAccId: boolean;
  onToggleExpandAccId: () => void;
  isAnyScanPending: boolean;
  onScan: (accountId: string) => void;
  onCancelScan?: (accountId: string) => void;
  onRemove: (accountId: string) => void;
  onUpdateUrl: (accountId: string, url: string) => void;
  onUpdateCookie: (accountId: string, cookie: string) => void;
  onUpdateSessionId: (accountId: string, sessionId: string) => void;
  onOpenGuide: () => void;
}

export function AccountCard({
  acc,
  index,
  isExpandedAccId,
  onToggleExpandAccId,
  isAnyScanPending,
  onScan,
  onCancelScan,
  onRemove,
  onUpdateUrl,
  onUpdateCookie,
  onUpdateSessionId,
  onOpenGuide,
}: AccountCardProps) {
  const { t } = useTranslation();
  const [showCookies, setShowCookies] = useState(false);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | undefined>(undefined);
  const [checkCooldown, setCheckCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (checkCooldown > 0) {
      timer = setInterval(() => {
        setCheckCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [checkCooldown]);

  const handleCheckCookie = async (accountId: string, steamUrl: string, steamCookie: string) => {
    if (!steamUrl.trim()) {
      toast.error(t('inventoryScanner.toastEnterUrl'));
      return;
    }
    if (!steamCookie.trim()) {
      toast.error(t('inventoryScanner.toastEnterCookie'));
      return;
    }

    setCookieStatus({ status: 'loading' });

    try {
      const res = await fetch('/api/portfolio/accounts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steamUrl: steamUrl.trim(),
          steamCookie: steamCookie.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.isValid) {
        setCookieStatus({ status: 'live' });
        toast.success(t('inventoryScanner.toastCookieValid'));
      } else if (data.isExpired) {
        setCookieStatus({
          status: 'expired',
          message: data.message
            ? translateAccountError(data.message, t)
            : t('inventoryScanner.cookieExpiredStatus'),
        });
        toast.error(t('inventoryScanner.toastCookieExpired'));
      } else {
        setCookieStatus({
          status: 'error',
          message: data.message
            ? translateAccountError(data.message, t)
            : t('inventoryScanner.cookieCheckErrorStatus'),
        });
        toast.error(
          data.message
            ? translateAccountError(data.message, t)
            : t('inventoryScanner.cookieCheckErrorDesc')
        );
      }
    } catch {
      setCookieStatus({ status: 'error', message: t('inventoryScanner.cannotConnectServer') });
      toast.error(t('inventoryScanner.toastConnectionError'));
    }

    setCheckCooldown(5);
  };

  const accountErrorMessage = translateAccountError(acc.error, t);
  const hasFamilyViewError = isFamilyViewAccountError(acc.error);
  const hasCookieError = isCookieCredentialError(acc.error);
  const showPrivacySettingsLink =
    isPrivateInventoryAccountError(acc.error) || (!acc.steamCookie && acc.status !== 'scanning');

  const isCookieInvalid =
    !!hasCookieError || cookieStatus?.status === 'error' || cookieStatus?.status === 'expired';

  const isCookiesExpanded =
    showCookies || !!acc.steamCookie || isCookieInvalid || hasFamilyViewError;

  return (
    <div className="group hover:border-stone-750 flex flex-col gap-3 rounded-md border border-stone-800 bg-stone-950/40 p-3.5 transition-all duration-200">
      {/* Header Row */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-stretch lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-800 bg-stone-900 text-xs font-semibold text-stone-400 shadow-inner ring-1 ring-white/5">
            {acc.result?.profile?.avatarUrl ? (
              <img
                src={proxySteamUrl(acc.result.profile.avatarUrl)}
                alt={t('steamAccounts.avatarAlt', "{{name}}'s Steam avatar", {
                  name:
                    acc.result.profile.name ||
                    t('inventoryScanner.accountNumber', { index: index + 1 }),
                })}
                className="size-full object-cover"
              />
            ) : (
              <span>#{index + 1}</span>
            )}
            {acc.status === 'done' && (
              <div className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-stone-950 bg-emerald-500" />
            )}
          </div>
          <div className="flex min-w-0 flex-col items-start">
            <h3 className="text-stone-250 flex flex-wrap items-center gap-1 text-xs font-bold">
              {acc.result?.profile?.name ? (
                <span
                  className="max-w-[120px] truncate text-stone-100 sm:max-w-[200px] md:max-w-[120px] lg:max-w-[180px]"
                  title={acc.result.profile.name}
                >
                  {acc.result.profile.name}
                </span>
              ) : (
                <span className="text-stone-300">
                  {t('inventoryScanner.accountNumber', { index: index + 1 })}
                </span>
              )}
              {acc.status === 'scanning' && (
                <span className="py-0.2 animate-pulse rounded bg-blue-500/5 px-1 text-[9px] font-bold text-blue-400">
                  {t('inventoryScanner.scanning')}
                </span>
              )}
              {acc.status === 'error' && (
                <span className="py-0.2 rounded bg-red-50 px-1 text-[9px] font-bold text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20">
                  {t('inventoryScanner.error')}
                </span>
              )}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-stone-500">
                {acc.result
                  ? `${acc.result.totalQuantity} ${t('inventoryScanner.itemUnit', 'items')} · ${formatVND(acc.result.totalPrice)}`
                  : !acc.url.trim()
                    ? t('inventoryScanner.notLinked')
                    : t('inventoryScanner.readyToScan')}
              </span>
              {acc.result &&
                acc.result?.walletBalance &&
                (() => {
                  const displayWallet = acc.result.walletBalance
                    .replace(/Chờ xử lý/gi, t('common.pending', 'Pending'))
                    .replace(/Pending/gi, t('common.pending', 'Pending'));
                  return (
                    <div
                      className="py-0.2 flex items-center gap-1 rounded border border-emerald-500/15 bg-emerald-500/10 px-1 text-[9px] font-bold text-emerald-400"
                      title={t('inventoryScanner.steamWalletBalance', { balance: displayWallet })}
                    >
                      <Wallet className="size-2.5 shrink-0" />
                      <span>{t('inventoryScanner.walletShort', { balance: displayWallet })}</span>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-start gap-1.5 sm:justify-end md:justify-start lg:justify-end">
          <button
            type="button"
            onClick={() => {
              if (acc.status === 'scanning') {
                onCancelScan?.(acc.id);
              } else {
                onScan(acc.id);
              }
            }}
            disabled={acc.status !== 'scanning' && (isAnyScanPending || !acc.url.trim())}
            className={`inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-semibold transition-all duration-200 focus:outline-none ${
              acc.status === 'scanning'
                ? 'border border-red-500/35 bg-red-950/20 text-red-300 hover:bg-red-950/30 active:scale-98'
                : 'bg-accent text-accent-foreground hover:bg-accent-hover active:scale-98 disabled:cursor-not-allowed disabled:opacity-40'
            }`}
            title={
              acc.status === 'scanning'
                ? t('inventoryScanner.stopScan')
                : t('inventoryScanner.scanThisAccount')
            }
          >
            {acc.status === 'scanning' ? (
              <Loader2 className="size-3 animate-spin text-red-400" />
            ) : (
              <Search className="size-3" />
            )}
            <span>
              {acc.status === 'scanning' ? t('inventoryScanner.stop') : t('inventoryScanner.scan')}
            </span>
          </button>

          {acc.result && (
            <button
              type="button"
              onClick={onToggleExpandAccId}
              title={
                isExpandedAccId ? t('inventoryScanner.collapse') : t('inventoryScanner.details')
              }
              className="flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md border border-stone-800 bg-stone-900/40 px-2 text-[10px] font-medium text-stone-400 hover:bg-stone-900/80 hover:text-stone-300 focus:outline-none"
            >
              <span>
                {isExpandedAccId ? t('inventoryScanner.collapse') : t('inventoryScanner.details')}
              </span>
              <ChevronDown
                className={`size-3 transition-transform duration-300 ${
                  isExpandedAccId ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
          )}

          <button
            type="button"
            onClick={() => onRemove(acc.id)}
            disabled={acc.status === 'scanning'}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-stone-500 transition-all hover:bg-red-500/10 hover:text-red-400 focus:outline-none disabled:opacity-50"
            title={t('inventoryScanner.removeAccount')}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Warning/Error Badges */}
      {(acc.result?.marketScanWarning ||
        isCookieInvalid ||
        hasFamilyViewError ||
        (!acc.steamCookie && acc.status !== 'scanning')) && (
        <div className="flex flex-wrap gap-1">
          {hasFamilyViewError ? (
            <span
              className="cursor-help rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
              title={accountErrorMessage}
            >
              {t('inventoryScanner.familyViewErrorBadge')}
            </span>
          ) : isCookieInvalid ? (
            <span
              className="cursor-help rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300"
              title={
                cookieStatus?.message ||
                accountErrorMessage ||
                t('inventoryScanner.cookieExpiredTooltip')
              }
            >
              {t('inventoryScanner.cookieErrorExpired')}
            </span>
          ) : acc.result?.marketScanWarning || (!acc.steamCookie && acc.status !== 'scanning') ? (
            <span
              className="cursor-help rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
              title={t('inventoryScanner.missingCookieWarningTooltip')}
            >
              {t('inventoryScanner.missingCookieWarning')}
            </span>
          ) : null}
          {showPrivacySettingsLink && (
            <a
              href={STEAM_PRIVACY_SETTINGS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 transition-colors hover:border-blue-400 hover:text-blue-900 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:text-blue-200"
              title={t('inventoryScanner.openSteamPrivacySettings', 'Open Steam Privacy Settings')}
            >
              {t('inventoryScanner.setInventoryPublic', 'Set Inventory Public')}
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Inputs Grid */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder={t('inventoryScanner.urlPlaceholder')}
            value={acc.url}
            onChange={(e) => {
              setCookieStatus(undefined);
              onUpdateUrl(acc.id, e.target.value);
            }}
            disabled={acc.status === 'scanning'}
            className={`text-stone-150 w-full rounded border bg-stone-950/80 py-1.5 pr-20 pl-3 text-xs placeholder-stone-600 transition-all duration-200 focus:ring-1 focus:ring-blue-500/30 focus:outline-none disabled:opacity-50 ${
              acc.status === 'error'
                ? 'border-red-300 bg-red-50/70 focus:border-red-500 dark:border-red-500/30 dark:bg-red-950/5'
                : acc.status === 'done'
                  ? 'border-emerald-500/20 bg-emerald-950/5 focus:border-emerald-500'
                  : 'focus:border-stone-750 border-stone-800'
            }`}
          />
          <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1">
            {acc.status === 'scanning' && (
              <Loader2 className="size-3.5 animate-spin text-blue-400" />
            )}
            {acc.status === 'done' && (
              <span
                className="max-w-[4.5rem] truncate rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400"
                title={acc.result?.profile?.name}
              >
                {acc.result?.profile?.name ?? t('inventoryScanner.scanned')}
              </span>
            )}
            {acc.status === 'error' && <AlertCircle className="size-3.5 text-red-400" />}
          </div>
        </div>

        {/* Collapsible Cookie Section via Sub-component */}
        <AccountCookieConfig
          acc={acc}
          isCookieInvalid={isCookieInvalid}
          hasFamilyViewError={hasFamilyViewError}
          isExpanded={isCookiesExpanded}
          onToggleExpand={() => setShowCookies((prev) => !prev)}
          onUpdateCookie={(val) => {
            setCookieStatus(undefined);
            onUpdateCookie(acc.id, val);
          }}
          onUpdateSessionId={(val) => {
            setCookieStatus(undefined);
            onUpdateSessionId(acc.id, val);
          }}
          cookieStatus={cookieStatus}
          checkCooldown={checkCooldown}
          onCheckCookie={handleCheckCookie}
          onOpenGuide={onOpenGuide}
        />
      </div>

      {/* Progress Message */}
      {acc.status === 'scanning' && acc.progress ? (
        <div className="rounded border border-blue-500/10 bg-blue-500/5 p-2.5">
          <div className="flex items-center justify-between gap-3 text-[10px]">
            <span className="truncate font-semibold text-blue-200">
              {translateScanProgressMessage(acc.progress.message, t, acc.progress.detail)}
            </span>
            <span className="shrink-0 font-bold text-blue-400 tabular-nums">
              {Math.round(acc.progress.percent)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full border border-stone-800 bg-stone-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, acc.progress.percent))}%` }}
            />
          </div>
          {acc.progress.detail ? (
            <p className="mt-1 truncate font-mono text-[9px] text-stone-500">
              {formatProgressDetail(acc.progress.detail, t)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Expanded Details inside the card */}
      {acc.result && (
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isExpandedAccId
              ? 'mt-3 grid-rows-[1fr] opacity-100'
              : 'pointer-events-none mt-0 grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded border border-stone-800 bg-stone-950/60 p-3 shadow-inner">
              {acc.result.items.length > 0 ? (
                <div className="max-h-48 scrollbar-thin scrollbar-thumb-stone-800 space-y-1.5 overflow-y-auto pr-1">
                  {[...acc.result.items]
                    .sort((a, b) => b.total - a.total)
                    .map((item, idx) => (
                      <div
                        key={`${item.caseItem.marketHashName}__hold_${item.holdDays || 0}__${idx}`}
                        className="flex items-center justify-between rounded px-2 py-1 text-[11px] transition-colors hover:bg-stone-900/60"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-stone-800 bg-stone-900 shadow-sm">
                            {item.caseItem.imageUrl ? (
                              <img
                                src={proxySteamUrl(item.caseItem.imageUrl)}
                                alt={item.caseItem.name}
                                className="size-5 object-contain"
                              />
                            ) : (
                              <ShoppingBag className="size-3 text-stone-600" />
                            )}
                          </div>
                          <span
                            className="truncate font-medium text-stone-300"
                            title={item.caseItem.name}
                          >
                            {item.caseItem.name}
                          </span>
                          {item.holdDays && item.holdDays > 0 ? (
                            <span className="ml-1 shrink-0 rounded border border-red-500/10 bg-red-500/5 px-1 py-0.5 text-[8px] font-bold text-red-400">
                              {t('inventoryScanner.holdDays', { count: item.holdDays })}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pl-1.5">
                          <span className="font-medium text-stone-500">×{item.quantity}</span>
                          <span className="font-bold text-emerald-400">
                            {formatVND(item.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="py-2.5 text-center text-[10px] text-stone-500">
                  {t('inventoryScanner.noPricedItems')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
