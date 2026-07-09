import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SellSelectedLoadingOverlay() {
  const { t } = useTranslation();

  return (
    <div className="bg-card/90 absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md transition-all duration-300">
      <Loader2 className="mb-3 size-10 animate-spin text-blue-400" />
      <p className="font-mono text-sm font-black tracking-widest text-stone-200 uppercase">
        {t('portfolio.updatingPortfolio', 'Updating Portfolio...')}
      </p>
      <p className="mt-1 font-mono text-xs text-stone-500">
        {t('portfolio.syncingData', 'Synchronizing data with the server...')}
      </p>
    </div>
  );
}
