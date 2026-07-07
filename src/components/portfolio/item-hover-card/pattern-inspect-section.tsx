import type { TFunction } from 'i18next';

import type { PortfolioTableRow } from '../portfolio-table-model';
import { ManualInspectLinkSection } from './manual-inspect-link-section';
import { PatternInfoDetails } from './pattern-info-details';

type FindStatus = 'idle' | 'success' | 'error';

type PatternInspectSectionProps = {
  item: PortfolioTableRow;
  relatedRows: PortfolioTableRow[];
  buffPricesCny?: Record<string, number>;
  buffCnyToVndRate?: number;
  isInspecting: boolean;
  inspectError: string | null;
  onInspect: () => void;
  manualInspectLink: string;
  onManualInspectLinkChange: (value: string) => void;
  onManualInspect: () => void;
  onAutoFind: () => void;
  isFindingLink: boolean;
  findStatus: FindStatus;
  t: TFunction;
};

function SpinnerIcon() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function PatternInspectSection({
  item,
  relatedRows,
  buffPricesCny,
  buffCnyToVndRate,
  isInspecting,
  inspectError,
  onInspect,
  manualInspectLink,
  onManualInspectLinkChange,
  onManualInspect,
  onAutoFind,
  isFindingLink,
  findStatus,
  t,
}: PatternInspectSectionProps) {
  if (relatedRows.length > 1 || item.itemType !== 'skin') return null;

  if (item.inspectLink) {
    return (
      <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
        <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
        </div>

        {!item.patternInfo ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-stone-800 bg-stone-900/60 p-3.5 text-center">
            <div className="text-[11px] leading-relaxed text-stone-300">
              {t(
                'portfolio.patternInspectPrompt',
                'Vật phẩm này có link inspect từ Steam. Bạn có muốn quét Pattern & Overpay không?'
              )}
            </div>
            <button
              onClick={onInspect}
              disabled={isInspecting}
              className="bg-blue-650 flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold text-white shadow-md transition-all hover:bg-blue-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              {isInspecting ? (
                <span className="flex items-center justify-center gap-1.5">
                  <SpinnerIcon />
                  {t('inventoryScanner.scanningPattern', 'Đang kiểm tra...')}
                </span>
              ) : (
                t('inventoryScanner.inspectPatternButton', 'Kiểm tra Pattern')
              )}
            </button>
            {inspectError && (
              <div className="mt-1 text-[10px] font-semibold text-red-400">
                {t(`inventoryScanner.apiErrors.${inspectError}`, inspectError)}
              </div>
            )}
          </div>
        ) : (
          <PatternInfoDetails
            patternInfo={item.patternInfo}
            marketHashName={item.case.marketHashName}
            buffPricesCny={buffPricesCny}
            buffCnyToVndRate={buffCnyToVndRate}
            t={t}
          />
        )}
      </div>
    );
  }

  if (item.patternInfo) {
    return (
      <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
        <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
        </div>
        <PatternInfoDetails
          patternInfo={item.patternInfo}
          marketHashName={item.case.marketHashName}
          buffPricesCny={buffPricesCny}
          buffCnyToVndRate={buffCnyToVndRate}
          t={t}
        />
      </div>
    );
  }

  return (
    <ManualInspectLinkSection
      manualInspectLink={manualInspectLink}
      onManualInspectLinkChange={onManualInspectLinkChange}
      onManualInspect={onManualInspect}
      onAutoFind={onAutoFind}
      isInspecting={isInspecting}
      isFindingLink={isFindingLink}
      findStatus={findStatus}
      inspectError={inspectError}
      t={t}
    />
  );
}
