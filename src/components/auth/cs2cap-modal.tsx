'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Loader2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast, toastStore } from '@/stores';
import { useSession } from './use-session';
import {
  getLocalApiKey,
  saveLocalApiKey,
  removeLocalApiKey,
} from '@/components/inventory-scanner/utils';
import {
  CS2CapPlanOverview,
  CS2CapUsageStats,
  type TierInfo,
  type UsageInfo,
} from './cs2cap-modal-sections';
import {
  CS2CapApiKeyForm,
  CS2CapGuestKeyCard,
  CS2CapMemberKeysList,
  CS2CapModeNotice,
} from './cs2cap-modal-key-sections';

interface AccountData {
  user_id: string;
  email: string;
  display_name: string;
  tier_info: TierInfo;
  usage: UsageInfo;
}

interface CS2CapKey {
  prefix: string;
  isActive: boolean;
}

interface CS2CapData {
  hasCustomKey: boolean;
  keyPrefix: string | null;
  keys: CS2CapKey[];
  account: AccountData | null;
}

interface CS2CapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'member' | 'guest' | 'auto';
}

export function CS2CapModal({ open, onOpenChange, mode = 'auto' }: CS2CapModalProps) {
  const { t } = useTranslation();
  const { user, loading: sessionLoading } = useSession();

  // Trạng thái dữ liệu khi đã đăng nhập
  const [data, setData] = useState<CS2CapData | null>(null);

  // Trạng thái dữ liệu khách
  const [guestKeyPrefix, setGuestKeyPrefix] = useState<string | null>(null);
  const [guestAccount, setGuestAccount] = useState<AccountData | null>(null);
  const [hasDefaultKey, setHasDefaultKey] = useState<boolean | null>(null);
  const [defaultAccount, setDefaultAccount] = useState<AccountData | null>(null);

  // Trạng thái form và loader
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trạng thái dialog xác nhận xóa
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  // Tính mode
  const isMember = mode === 'member' || (mode === 'auto' && !!user);

  // Fetch dữ liệu cho chế độ khách
  const fetchGuestAccountData = useCallback(
    async (key: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/user/cs2cap/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: key }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message
              ? t(
                  `cs2cap.errors.${json.message}`,
                  t('cs2cap.failedToGetAccountInfo', 'Failed to get account info from CS2Cap.')
                )
              : t('cs2cap.failedToGetAccountInfo', 'Failed to get account info from CS2Cap.')
          );
        }
        setGuestAccount(json.account);
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : t('cs2cap.connectionOrKeyError', 'Connection error or API Key is inactive.');
        setError(msg ? t(`cs2cap.errors.${msg}`, msg) : msg);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [t]
  );

  // Fetch dữ liệu cho chế độ đã đăng nhập
  const fetchInfo = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/user/cs2cap');
        if (!res.ok) {
          throw new Error(t('cs2cap.failedToLoadInfo', 'Failed to load info'));
        }
        const json = await res.json();
        setData(json);
        setApiKey('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(
          msg ? t(`cs2cap.errors.${msg}`, msg) : t('cs2cap.failedToLoadInfo', 'Failed to load info')
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [t]
  );

  // Nạp dữ liệu phù hợp khi mount hoặc mở
  useEffect(() => {
    if (!open || (mode === 'auto' && sessionLoading)) return;

    if (isMember) {
      fetchInfo();
    } else {
      // Kiểm tra server có key mặc định và lấy dữ liệu tài khoản tương ứng
      fetch('/api/user/cs2cap/status')
        .then((r) => r.json())
        .then((d) => {
          setHasDefaultKey(Boolean(d?.hasDefaultKey));
          setDefaultAccount(d?.account ?? null);
        })
        .catch(() => {
          setHasDefaultKey(false);
          setDefaultAccount(null);
        });

      const saved = getLocalApiKey();
      if (saved) {
        setGuestKeyPrefix(saved.slice(0, 12) + '•'.repeat(24));
        fetchGuestAccountData(saved);
      } else {
        setGuestKeyPrefix(null);
        setGuestAccount(null);
        setLoading(false);
      }
      setApiKey('');
    }
  }, [open, isMember, sessionLoading, mode, fetchInfo, fetchGuestAccountData]);

  // Xử lý lưu (thêm key mới)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setSaving(true);
    const toastId = toast.loading(t('common.saving', 'Saving...'));
    try {
      if (isMember) {
        const res = await fetch('/api/user/cs2cap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message
              ? t(`cs2cap.errors.${json.message}`, t('cs2cap.invalidKey', 'Invalid API Key'))
              : t('cs2cap.invalidKey', 'Invalid API Key')
          );
        }

        toastStore.update(toastId, {
          type: 'success',
          title: t('cs2cap.saveSuccess', 'Saved API Key successfully!'),
          duration: 3000,
        });

        setData({
          hasCustomKey: json.hasCustomKey,
          keyPrefix: json.keyPrefix,
          keys: json.keys,
          account: json.account,
        });
        setApiKey('');
      } else {
        const res = await fetch('/api/user/cs2cap/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.message
              ? t(
                  `cs2cap.errors.${json.message}`,
                  t('cs2cap.invalidKeyCheck', 'Invalid API Key. Please verify it.')
                )
              : t('cs2cap.invalidKeyCheck', 'Invalid API Key. Please verify it.')
          );
        }

        saveLocalApiKey(apiKey.trim());
        setGuestKeyPrefix(apiKey.trim().slice(0, 12) + '•'.repeat(24));
        setGuestAccount(json.account);
        setApiKey('');

        toastStore.update(toastId, {
          type: 'success',
          title: t('cs2cap.configureSuccess', 'Configured API Key successfully!'),
          description: t(
            'cs2cap.keyEncryptedLocal',
            'Your key is stored only for this browser session.'
          ),
          duration: 4000,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('cs2cap.invalidKey', 'Invalid API Key');
      toastStore.update(toastId, {
        type: 'error',
        title: t('cs2cap.invalidKey', 'Invalid API Key'),
        description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Xử lý đổi key active (chỉ khi đã đăng nhập)
  const handleSelect = async (keyPrefix: string) => {
    setSaving(true);
    const toastId = toast.loading(t('cs2cap.switchingKey', 'Switching active API key...'));
    try {
      const res = await fetch('/api/user/cs2cap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'select', keyPrefix }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message);
      }

      toastStore.update(toastId, {
        type: 'success',
        title: t('cs2cap.switchedKeySuccess', 'Switched active API Key.'),
        duration: 3000,
      });

      setData({
        hasCustomKey: json.hasCustomKey,
        keyPrefix: json.keyPrefix,
        keys: json.keys,
        account: json.account,
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('cs2cap.switchKeyError', 'Failed to switch active API Key');
      toastStore.update(toastId, {
        type: 'error',
        title: t('cs2cap.switchKeyError', 'Failed to switch active API Key'),
        description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Mở modal xác nhận xóa key
  const confirmDelete = (keyPrefix?: string) => {
    if (isMember) {
      if (keyPrefix) {
        setKeyToDelete(keyPrefix);
        setConfirmOpen(true);
      }
    } else {
      setConfirmOpen(true);
    }
  };

  // Xử lý sau khi xác nhận xóa
  const handleDeleteConfirm = async () => {
    setConfirmOpen(false);
    if (isMember) {
      if (!keyToDelete) return;
      setSaving(true);
      const toastId = toast.loading(t('cs2cap.deletingKey', 'Deleting...'));
      try {
        const res = await fetch('/api/user/cs2cap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'delete', keyPrefix: keyToDelete }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message);
        }

        toastStore.update(toastId, {
          type: 'success',
          title: t('cs2cap.deleteKeySuccess', 'Deleted API Key successfully.'),
          duration: 3000,
        });

        setData({
          hasCustomKey: json.hasCustomKey,
          keyPrefix: json.keyPrefix,
          keys: json.keys,
          account: json.account,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : t('cs2cap.deleteKeyError', 'Failed to delete API Key');
        toastStore.update(toastId, {
          type: 'error',
          title: t('cs2cap.deleteKeyError', 'Failed to delete API Key'),
          description: msg ? t(`cs2cap.errors.${msg}`, msg) : msg,
          duration: 4000,
        });
      } finally {
        setSaving(false);
        setKeyToDelete(null);
      }
    } else {
      removeLocalApiKey();
      setGuestKeyPrefix(null);
      setGuestAccount(null);
      toast.success(t('cs2cap.deleteLocalKeySuccess', 'Deleted custom API Key.'));
    }
  };

  const account = isMember ? data?.account : guestAccount;
  const usage = account?.usage;
  const tier = account?.tier_info;

  // Cho khách dùng key hệ thống mặc định (không có key local)
  const defaultUsage = !isMember && !guestKeyPrefix ? defaultAccount?.usage : null;
  const defaultTier = !isMember && !guestKeyPrefix ? defaultAccount?.tier_info : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <Shield className="text-accent size-5.5" />
              {isMember
                ? t('cs2cap.modalTitle', 'Configure API Key (Member)')
                : t('cs2cap.modalTitleGuest', 'Configure API Key (Guest)')}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {isMember
                ? t('cs2cap.modalDesc', 'Configure your API Key to use CS2Cap services.')
                : t(
                    'cs2cap.modalDescGuest',
                    'Since you are not logged in, this key is kept only for this browser session to fetch direct prices from BUFF163.'
                  )}
            </DialogDescription>
          </DialogHeader>

          {sessionLoading || loading ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3">
              <Loader2 className="text-accent size-8 animate-spin" />
              <span className="text-sm text-stone-400">{t('common.loading', 'Loading...')}</span>
            </div>
          ) : error ? (
            <div className="flex h-56 flex-col items-center justify-center gap-3 px-4 text-center">
              <AlertCircle className="text-danger size-10" />
              <p className="text-sm font-semibold text-stone-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  isMember
                    ? fetchInfo(true)
                    : guestKeyPrefix && fetchGuestAccountData(guestKeyPrefix, true)
                }
                className="border-stone-850 mt-2 cursor-pointer bg-stone-900/40"
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              <CS2CapModeNotice t={t} isMember={isMember} hasCustomKey={data?.hasCustomKey} />

              {/* Default System Key badge for Guest (no local key, but server has default) */}
              {!isMember && !guestKeyPrefix && hasDefaultKey && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Lock className="size-4" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-mono text-[9px] leading-none font-bold tracking-wider text-stone-500 uppercase">
                        {t('cs2cap.defaultSystemKey', 'System default key')}
                      </span>
                      <span className="mt-0.5 font-mono text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400">
                        {t('cs2cap.defaultSystemKeyActive', 'Active — shared quota')}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {t('cs2cap.statusActive', 'Active')}
                  </span>
                </div>
              )}

              {/* 1. Plan Overview Cards */}
              {((isMember && data) ||
                (!isMember && guestKeyPrefix) ||
                (!isMember && !guestKeyPrefix && defaultTier)) && (
                <CS2CapPlanOverview tier={tier ?? defaultTier} />
              )}

              {/* 2. Usage Stats — personal key (member or guest with local key) */}
              {usage && <CS2CapUsageStats usage={usage} />}

              {/* 2b. Usage Stats — default system key (guest, no local key) */}
              {!isMember && !guestKeyPrefix && defaultUsage && (
                <CS2CapUsageStats usage={defaultUsage} />
              )}

              {/* 3. API Key List and Input Form */}
              <div className="space-y-3.5 pt-2">
                {!isMember && guestKeyPrefix && (
                  <CS2CapGuestKeyCard
                    t={t}
                    guestKeyPrefix={guestKeyPrefix}
                    saving={saving}
                    onDelete={() => confirmDelete()}
                  />
                )}

                {isMember && data?.keys && (
                  <CS2CapMemberKeysList
                    t={t}
                    keys={data.keys}
                    saving={saving}
                    onSelect={handleSelect}
                    onDelete={confirmDelete}
                  />
                )}

                <CS2CapApiKeyForm
                  t={t}
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  showKey={showKey}
                  setShowKey={setShowKey}
                  saving={saving}
                  onSubmit={handleSave}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for deleting Key */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <AlertCircle className="size-5 text-rose-500" />
              {t('cs2cap.confirmDeleteTitle', 'Confirm API Key Deletion?')}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {t(
                'cs2cap.confirmDeleteDesc',
                'Are you sure you want to delete this API Key? The system will revert to the default shared key or other key in the list (if any). This action cannot be undone.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              className="cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteConfirm}
              className="cursor-pointer font-bold"
            >
              {t('common.confirmDelete', 'Confirm Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
