'use client';

import React, { useState, useEffect } from 'react';
import { TbClock, TbCircleCheck } from 'react-icons/tb';
import { formatDateTimeVi } from '@/utils/date';
import { useTranslation } from 'react-i18next';

interface TradeHoldBadgeProps {
  tradeHoldUntil: string | Date | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export function TradeHoldBadge({
  tradeHoldUntil,
  className = '',
  size = 'md',
}: TradeHoldBadgeProps) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!tradeHoldUntil) {
      setTimeLeft(null);
      return;
    }

    const targetTime = new Date(tradeHoldUntil).getTime();
    if (isNaN(targetTime)) {
      setTimeLeft(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diffMs = targetTime - now;

      if (diffMs <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        return;
      }

      setIsExpired(false);
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;

      if (diffMs > oneDay) {
        const days = Math.floor(diffMs / oneDay);
        const hours = Math.floor((diffMs % oneDay) / oneHour);
        setTimeLeft(
          t('portfolio.holdCountdownDaysHours', 'Hold {{days}}d {{hours}}h', { days, hours })
        );
      } else if (diffMs > oneHour) {
        const hours = Math.floor(diffMs / oneHour);
        const minutes = Math.floor((diffMs % oneHour) / (60 * 1000));
        setTimeLeft(
          t('portfolio.holdCountdownHoursMinutes', 'Hold {{hours}}h {{minutes}}m', {
            hours,
            minutes,
          })
        );
      } else {
        const minutes = Math.floor(diffMs / (60 * 1000));
        const seconds = Math.floor((diffMs % (60 * 1000)) / 1000);
        setTimeLeft(
          t('portfolio.holdCountdownMinutesSeconds', 'Hold {{minutes}}m {{seconds}}s', {
            minutes,
            seconds,
          })
        );
      }
    };

    // Cập nhật ban đầu
    updateCountdown();

    // Xác định tốc độ interval: còn dưới 1 giờ thì 1s, ngược lại 10s là đủ
    const diffMs = targetTime - Date.now();
    const intervalMs = diffMs < 60 * 60 * 1000 ? 1000 : 10000;

    const timer = setInterval(updateCountdown, intervalMs);
    return () => clearInterval(timer);
  }, [tradeHoldUntil, t]);

  if (!tradeHoldUntil) return null;

  const exactTimeStr = t('portfolio.holdUntilTime', 'Hold ends at: {{time}}', {
    time: formatDateTimeVi(tradeHoldUntil),
  });
  const sizeClasses =
    size === 'sm' ? 'px-1.5 py-0.5 text-[9px] gap-1' : 'px-2 py-1 text-[10px] gap-1.5';

  if (isExpired) {
    return (
      <span
        title={exactTimeStr}
        aria-label={`${t('portfolio.tradeableNow', 'Tradeable now')}. ${exactTimeStr}`}
        className={`inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 font-bold text-emerald-400 select-none ${sizeClasses} ${className}`}
      >
        <TbCircleCheck className={size === 'sm' ? 'size-2.5' : 'size-3.5'} />
        {t('portfolio.tradeableNow', 'Tradeable now')}
      </span>
    );
  }

  if (!timeLeft) return null;

  return (
    <span
      title={exactTimeStr}
      aria-label={`${timeLeft}. ${exactTimeStr}`}
      className={`inline-flex items-center rounded border border-rose-500/20 bg-rose-500/10 font-bold text-rose-400 uppercase select-none ${sizeClasses} ${className}`}
    >
      <TbClock className={`${size === 'sm' ? 'size-2.5' : 'size-3.5'} animate-pulse`} />
      {timeLeft}
    </span>
  );
}
