import { Award, TrendingUp, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatDateVi } from '@/utils/date';

export interface TierInfo {
  code: string;
  display_name: string;
  quota_requests_per_month: number;
  rate_requests_per_minute: number;
}

export interface UsageInfo {
  requests_this_month: number;
  requests_limit: number;
  requests_remaining: number;
  percentage_used: number;
  reset_date: string;
}

export function CS2CapPlanOverview({ tier }: { tier?: TierInfo | null }) {
  const { t, i18n } = useTranslation();

  const getTierDisplayName = (displayName?: string) => {
    if (!displayName) return i18n.language === 'vi' ? 'MIỄN PHÍ' : 'FREE';
    const upper = displayName.toUpperCase();
    if (upper === 'FREE') return i18n.language === 'vi' ? 'MIỄN PHÍ' : 'FREE';
    return displayName;
  };

  return (
    <div className="grid grid-cols-2 gap-3.5">
      <div className="flex items-center gap-3 rounded-xl border border-stone-800/80 bg-stone-950/45 p-3.5 shadow-sm transition hover:border-stone-700/60">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <Award className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] leading-none font-bold tracking-wider text-stone-500 uppercase">
            {t('cs2cap.currentPlan', 'Current plan')}
          </span>
          <span className="text-foreground mt-1 block truncate font-sans text-sm leading-none font-black tracking-wide uppercase">
            {getTierDisplayName(tier?.display_name)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-stone-800/80 bg-stone-950/45 p-3.5 shadow-sm transition hover:border-stone-700/60">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400">
          <Zap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block font-mono text-[10px] leading-none font-bold tracking-wider text-stone-500 uppercase">
            {t('cs2cap.requestsPerMin', 'Reqs/min')}
          </span>
          <span className="text-foreground mt-1 block truncate font-sans text-sm leading-none font-black tracking-wide">
            {tier?.rate_requests_per_minute || 20} {t('cs2cap.reqMinSuffix', 'req/m')}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CS2CapUsageStats({ usage }: { usage: UsageInfo }) {
  const { t, i18n } = useTranslation();

  const formatNumber = (num: number) => {
    return num.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US');
  };

  return (
    <div className="space-y-3 rounded-xl border border-stone-800/80 bg-stone-950/20 p-4 shadow-sm">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-stone-400">
          <TrendingUp className="text-accent size-4" />
          {t('cs2cap.reqUsed', 'Used')}: {formatNumber(usage.requests_this_month)} /{' '}
          {formatNumber(usage.requests_limit)} {t('cs2cap.reqSuffix', 'req')}
        </span>
        <span className="border-accent/20 bg-accent/10 text-accent rounded-full border px-2 py-0.5 font-black">
          {usage.percentage_used.toFixed(1)}%
        </span>
      </div>

      <div className="border-stone-850/50 relative h-2.5 w-full overflow-hidden rounded-full border bg-stone-950">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 shadow-[0_0_12px_rgba(59,130,246,0.3)] transition-all duration-500 ease-out"
          style={{
            width: `${Math.min(usage.percentage_used, 100)}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between pt-0.5 text-[11px] text-stone-500">
        <span className="font-medium">
          {t('cs2cap.reqRemaining', 'Remaining')}: {formatNumber(usage.requests_remaining)}
        </span>
        <span className="font-medium">
          {t('cs2cap.resetDate', 'Reset date')}: {formatDateVi(usage.reset_date)}
        </span>
      </div>
    </div>
  );
}
