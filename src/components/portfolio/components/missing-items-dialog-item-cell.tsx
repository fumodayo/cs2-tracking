import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { proxySteamUrl } from '@/utils/url';
import type { ExtraItem, MissingItem } from '../missing-items-dialog-types';

type MissingItemsDialogItemCellProps = {
  item: MissingItem | ExtraItem;
  tone: 'missing' | 'extra';
};

export function MissingItemsDialogItemCell({ item, tone }: MissingItemsDialogItemCellProps) {
  const { t } = useTranslation();
  const accountToneClass =
    tone === 'missing'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/10 dark:bg-amber-500/5 dark:text-amber-400'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/10 dark:bg-emerald-500/5 dark:text-emerald-400';

  return (
    <div className="flex items-center gap-4">
      {item.imageUrl ? (
        <img
          src={proxySteamUrl(item.imageUrl)}
          alt={item.caseName}
          className="bg-background border-stone-850 size-12 shrink-0 rounded-lg border object-contain shadow-inner"
        />
      ) : (
        <div className="bg-background border-stone-850 flex size-12 shrink-0 items-center justify-center rounded-lg border shadow-inner">
          <Archive className="size-5 text-stone-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className="text-foreground truncate text-sm leading-tight font-bold"
          title={item.caseName}
        >
          {item.caseName}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-stone-500" title={item.marketHashName}>
          {item.marketHashName}
        </p>
        {item.accounts && item.accounts.length > 0 && (
          <p
            className={`mt-1.5 inline-block rounded border px-2 py-0.5 text-xs font-semibold ${accountToneClass}`}
          >
            {t('missingItemsDialog.accountBreakdown', 'Account: {{details}}', {
              details: item.accounts
                .map(
                  (account) =>
                    `${account.name} (${account.change > 0 ? `+${account.change}` : account.change})`
                )
                .join(', '),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
