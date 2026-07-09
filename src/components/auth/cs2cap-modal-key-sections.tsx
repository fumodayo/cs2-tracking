import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { Eye, EyeOff, ExternalLink, Info, Key, Loader2, Lock, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';

type CS2CapKey = {
  prefix: string;
  isActive: boolean;
};

export function CS2CapModeNotice({
  t,
  isMember,
  hasCustomKey,
}: {
  t: TFunction;
  isMember: boolean;
  hasCustomKey?: boolean;
}) {
  const message = isMember
    ? hasCustomKey
      ? t('cs2cap.customKeyActive', 'The system is using your personal API Key to update prices.')
      : t(
          'cs2cap.sharedKeyWarning',
          'You are using the shared default system key. Quota limit may apply.'
        )
    : t(
        'cs2cap.guestLocalNotice',
        'Guest API keys are kept only for the current browser session. Sign in with Google to sync keys across all devices.'
      );

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3.5 py-3 transition hover:bg-amber-500/8">
      <Info className="mt-0.5 size-4.5 shrink-0 animate-pulse text-amber-600 dark:text-amber-500" />
      <p className="text-[11px] leading-relaxed font-semibold text-amber-800 dark:text-amber-400/90">
        {message}
      </p>
    </div>
  );
}

export function CS2CapDefaultGuestKeyCard({ t }: { t: TFunction }) {
  return (
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
            {t('cs2cap.defaultSystemKeyActive', 'Active - shared quota')}
          </span>
        </div>
      </div>
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
        {t('cs2cap.statusActive', 'Active')}
      </span>
    </div>
  );
}

export function CS2CapGuestKeyCard({
  t,
  guestKeyPrefix,
  saving,
  onDelete,
}: {
  t: TFunction;
  guestKeyPrefix: string;
  saving: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Lock className="size-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-[9px] leading-none font-bold tracking-wider text-stone-500 uppercase">
            {t('cs2cap.activeGuestKey', 'Active guest key')}
          </span>
          <span className="mt-0.5 truncate font-mono text-xs font-black tracking-wide text-emerald-600 dark:text-emerald-400">
            {guestKeyPrefix}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={saving}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-1.5 text-xs font-bold text-rose-500 transition duration-150 hover:border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
        <span>{t('common.delete', 'Delete')}</span>
      </button>
    </div>
  );
}

export function CS2CapMemberKeysList({
  t,
  keys,
  saving,
  onSelect,
  onDelete,
}: {
  t: TFunction;
  keys: CS2CapKey[];
  saving: boolean;
  onSelect: (keyPrefix: string) => void;
  onDelete: (keyPrefix: string) => void;
}) {
  if (keys.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-stone-400">
        {t('cs2cap.myPersonalApiKeys', 'Your personal API Keys ({{count}})', {
          count: keys.length,
        })}
      </span>
      <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pr-1">
        {keys.map((key) => (
          <div
            key={key.prefix}
            className={cn(
              'flex items-center justify-between rounded-xl border p-3.5 shadow-sm transition-all duration-250',
              key.isActive
                ? 'border-emerald-500/25 bg-emerald-500/5'
                : 'border-stone-800 bg-stone-950/20 hover:border-stone-700/60'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                  key.isActive
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-stone-850 bg-stone-900 text-stone-400'
                )}
              >
                <Lock className="size-4" />
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9px] leading-none font-bold tracking-wider text-stone-500 uppercase">
                  {key.isActive
                    ? t('cs2cap.statusActive', 'Active')
                    : t('cs2cap.statusArchive', 'Archived')}
                </span>
                <span className="mt-0.5 truncate font-mono text-xs font-black tracking-wide text-stone-300">
                  {key.prefix}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              {!key.isActive && (
                <button
                  type="button"
                  onClick={() => onSelect(key.prefix)}
                  disabled={saving}
                  className="border-accent/20 bg-accent/5 hover:bg-accent/15 text-accent cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition duration-150 disabled:opacity-50"
                >
                  {t('cs2cap.useButton', 'Use')}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(key.prefix)}
                disabled={saving}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-500 transition duration-150 hover:border-rose-500/30 hover:bg-rose-500/15 disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CS2CapApiKeyForm({
  t,
  apiKey,
  setApiKey,
  showKey,
  setShowKey,
  saving,
  onSubmit,
}: {
  t: TFunction;
  apiKey: string;
  setApiKey: Dispatch<SetStateAction<string>>;
  showKey: boolean;
  setShowKey: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 pt-1">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="cs2cap-api-key"
            className="flex items-center gap-1.5 text-xs font-bold text-stone-400"
          >
            <Key className="text-accent size-3.5" />
            {t('cs2cap.apiKeyLabel', 'CS2Cap API Key')}
          </label>
          <a
            href="https://cs2cap.com/account/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover flex cursor-pointer items-center gap-1 text-xs font-bold transition-colors hover:underline"
          >
            {t('cs2cap.createKeyLink', 'Get API Key at CS2Cap')}
            <ExternalLink className="size-3" />
          </a>
        </div>

        <div className="flex gap-2">
          <div className="relative flex flex-1 items-center">
            <Input
              id="cs2cap-api-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('cs2cap.apiKeyPlaceholder', 'Enter your cs2cap API key (sk_live_...)')}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              disabled={saving}
              className="w-full pr-10 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 cursor-pointer text-stone-500 transition-colors hover:text-stone-300 focus:outline-none"
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !apiKey.trim()}
            className="h-10 shrink-0 cursor-pointer px-4 text-xs font-semibold"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : t('common.save', 'Save')}
          </Button>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-relaxed font-normal text-stone-500">
          {t(
            'cs2cap.buff163PriceNotice',
            "Usually you don't need a personal API Key. This is only necessary if you want to fetch prices directly from BUFF163 or need more call quota."
          )}
        </p>
      </div>
    </form>
  );
}
