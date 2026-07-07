import type { TFunction } from 'i18next';
import { TbPackage } from 'react-icons/tb';

import type { PortfolioTableRow } from '../portfolio-table-model';

type StorageUnitDetail = NonNullable<PortfolioTableRow['storageUnitDetails']>[number];
type AccountOption = {
  steamId64: string;
  name: string;
};

type StorageUnitAllocationSectionProps = {
  storageUnitDetails?: StorageUnitDetail[];
  accounts: AccountOption[];
  t: TFunction;
};

export function StorageUnitAllocationSection({
  storageUnitDetails,
  accounts,
  t,
}: StorageUnitAllocationSectionProps) {
  if (!storageUnitDetails || storageUnitDetails.length === 0) return null;

  return (
    <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-stone-500 uppercase">
        <TbPackage className="size-3.5 text-stone-400" />
        {t('portfolio.storageUnitAllocation', 'Stored in Storage Unit')}
      </div>
      <div className="grid gap-2">
        {storageUnitDetails.map((storageUnit) => {
          const account = accounts.find((item) => item.steamId64 === storageUnit.steamId64);
          const accountName = account ? account.name : '';

          return (
            <div
              key={storageUnit.storageUnitId}
              className="flex items-center justify-between rounded-xl border border-stone-800/40 bg-stone-950/20 px-3 py-2.5 transition duration-200 hover:bg-stone-900/10"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-stone-300">
                <span className="flex size-5.5 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                  <TbPackage className="size-3" />
                </span>
                <span className="truncate">{storageUnit.storageUnitName}</span>
                {accountName && (
                  <span className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 truncate rounded border border-sky-500/10 bg-sky-500/5 px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-sky-400">
                    {accountName}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-xs font-extrabold text-amber-400">
                {storageUnit.quantity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
