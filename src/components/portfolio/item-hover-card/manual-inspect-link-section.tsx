import type { TFunction } from 'i18next';

type FindStatus = 'idle' | 'success' | 'error';

type ManualInspectLinkSectionProps = {
  manualInspectLink: string;
  onManualInspectLinkChange: (value: string) => void;
  onManualInspect: () => void;
  onAutoFind: () => void;
  isInspecting: boolean;
  isFindingLink: boolean;
  findStatus: FindStatus;
  inspectError: string | null;
  t: TFunction;
};

function SpinnerIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ManualInspectLinkSection({
  manualInspectLink,
  onManualInspectLinkChange,
  onManualInspect,
  onAutoFind,
  isInspecting,
  isFindingLink,
  findStatus,
  inspectError,
  t,
}: ManualInspectLinkSectionProps) {
  return (
    <div className="mb-5 space-y-3 border-b border-stone-800/60 pb-5 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold tracking-wider text-stone-500 uppercase">
          {t('inventoryScanner.patternInfo', 'Thông tin Pattern')}
        </div>
        <button
          onClick={onAutoFind}
          disabled={isFindingLink || isInspecting}
          className="text-blue-450 hover:text-blue-350 flex items-center gap-1 text-[10px] font-semibold disabled:opacity-50"
        >
          {isFindingLink ? (
            <>
              <SpinnerIcon className="text-blue-450 h-3 w-3 animate-spin" />
              {t('portfolio.findingLink', 'Đang tìm...')}
            </>
          ) : (
            t('portfolio.autoFindInspectLink', 'Tự động tìm link')
          )}
        </button>
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-900/60 p-3.5">
        <div className="text-center text-[11px] leading-relaxed text-stone-300">
          {t(
            'portfolio.noInspectLinkPrompt',
            'Dán Inspect Link từ Steam để kiểm tra Pattern & Overpay:'
          )}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="steam://rungame/730/... +csgo_econ_action_preview%20..."
            value={manualInspectLink}
            onChange={(event) => onManualInspectLinkChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-stone-800 bg-stone-950 px-3 text-xs text-stone-200 transition-all placeholder:text-stone-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none"
          />
          <button
            onClick={onManualInspect}
            disabled={isInspecting || !manualInspectLink.trim()}
            className="bg-blue-650 flex h-8 w-full items-center justify-center rounded-lg text-xs font-bold text-white shadow-md transition-all hover:bg-blue-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isInspecting ? (
              <span className="flex items-center justify-center gap-1.5">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-white" />
                {t('inventoryScanner.scanningPattern', 'Đang kiểm tra...')}
              </span>
            ) : (
              t('inventoryScanner.inspectPatternButton', 'Kiểm tra Pattern')
            )}
          </button>
        </div>
        {findStatus === 'error' && (
          <div className="mt-1 text-center text-[10px] font-semibold text-amber-400">
            {t(
              'portfolio.autoFindNotFound',
              'Không tìm thấy Inspect Link trong dữ liệu scan kho đồ của bạn. Hãy quét lại kho đồ hoặc dán thủ công.'
            )}
          </div>
        )}
        {findStatus === 'success' && (
          <div className="mt-1 text-center text-[10px] font-semibold text-emerald-400">
            {t('portfolio.autoFindSuccess', 'Đã tìm thấy link! Đang tiến hành kiểm tra...')}
          </div>
        )}
        {inspectError && (
          <div className="mt-1 text-center text-[10px] font-semibold text-red-400">
            {t(`inventoryScanner.apiErrors.${inspectError}`, inspectError)}
          </div>
        )}
      </div>
    </div>
  );
}
