'use client';

import React from 'react';
import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatVND } from '@/utils/format';
import type { SteamAccountDto } from '@/lib/api-client/steam-accounts-api';

interface AccountWalletProps {
  account: SteamAccountDto;
}

export function AccountWallet({ account }: AccountWalletProps) {
  const { t } = useTranslation();

  if (!account.walletBalance) return null;

  const isVnd =
    account.walletBalance.toLowerCase().includes('đ') ||
    account.walletBalance.toLowerCase().includes('vnd') ||
    account.walletBalance.toLowerCase().includes('₫');

  const balanceText = account.walletBalance
    .replace(/Chờ xử lý/gi, t('common.pending', 'Pending'))
    .replace(/Pending/gi, t('common.pending', 'Pending'));

  return (
    <div className="mt-1 flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/18 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.04)] sm:mt-1.5 sm:px-2 sm:text-[11px]">
      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
      <Wallet className="size-3 shrink-0 opacity-85" />
      <span>
        {t('common.wallet', 'Wallet')}: {balanceText}
      </span>
      {account.walletBalanceVnd !== undefined && account.walletBalanceVnd !== null && !isVnd && (
        <span className="text-[10px] font-normal text-stone-400">
          (~{formatVND(account.walletBalanceVnd)})
        </span>
      )}
    </div>
  );
}
