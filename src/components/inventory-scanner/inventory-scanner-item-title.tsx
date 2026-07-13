import { useState } from 'react';
import type { TFunction } from 'i18next';
import { FaSteam } from 'react-icons/fa';

import { CopyButton } from '@/components/ui/actions';

import type { ScanResultItem } from './types';

export function InventoryScannerItemTitle({
  item,
  marketHashName,
  steamMarketUrl,
  buffMarketUrl,
  t,
}: {
  item: ScanResultItem;
  marketHashName: string;
  steamMarketUrl: string;
  buffMarketUrl: string;
  t: TFunction;
}) {
  const [copyFeedbackTrigger, setCopyFeedbackTrigger] = useState(0);

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void navigator.clipboard.writeText(marketHashName);
          setCopyFeedbackTrigger((value) => value + 1);
        }}
        className="inline-flex max-w-[24rem] cursor-pointer items-center gap-1.5 text-left font-semibold text-stone-200 transition-colors hover:text-blue-300 focus:outline-none max-md:max-w-full max-md:whitespace-normal"
        title={t('common.copy', 'Copy')}
      >
        <span className="truncate max-md:line-clamp-2 max-md:text-xs max-md:whitespace-normal">
          {item.caseItem.name}
        </span>
      </button>
      <span className="inline-flex items-center gap-2 max-md:hidden">
        <CopyButton
          value={marketHashName}
          variant="borderless"
          feedbackTrigger={copyFeedbackTrigger}
        />
        <a
          href={steamMarketUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center justify-center text-stone-400 transition-all hover:text-[#171a21] dark:hover:text-stone-100"
          title={t('inventoryScanner.openSteamMarket', 'Open on Steam Market')}
        >
          <FaSteam className="size-3.5" />
        </a>
        <a
          href={buffMarketUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center justify-center text-[10px] font-bold text-stone-400 transition-all select-none hover:text-amber-500 dark:hover:text-amber-400"
          title={t('common.openBuffMarket', 'Open on BUFF.Market')}
        >
          BUFF
        </a>
      </span>
      {item.isManual && (
        <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-blue-400 uppercase">
          {t('common.manual')}
        </span>
      )}
    </div>
  );
}
