'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { formatIntegerViInput, parseViFloat } from '@/utils/format';

import { CRYPTO_LIST } from './donate-dialog/donate-types';
import type { CryptoItem, NetworkOption } from './donate-dialog/donate-types';
import { BankTab } from './donate-dialog/bank-tab';
import { CryptoTab } from './donate-dialog/crypto-tab';
import { CryptoDetailTab } from './donate-dialog/crypto-detail-tab';

type DonateTab = 'bank' | 'crypto';

interface DonateDialogProps {
  open: boolean;
  onClose: () => void;
  initialAmount?: number;
  initialTab?: DonateTab;
  initialCryptoId?: string | null;
  initialNetwork?: string | null;
  onAmountUpdate?: (amount: number) => void;
  onTabUpdate?: (tab: DonateTab) => void;
  onCryptoUpdate?: (crypto: CryptoItem, network: NetworkOption | null) => void;
}

function normalizeDonateParam(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeNetworkParam(value: string): string {
  const normalizedValue = normalizeDonateParam(value);
  const aliases: Record<string, string> = {
    bep20: 'bsc',
    erc20: 'ethereum',
    trc20: 'tron',
  };

  return aliases[normalizedValue] ?? normalizedValue;
}

function findCryptoByParam(value?: string | null): CryptoItem | null {
  if (!value) return null;

  const normalizedValue = normalizeDonateParam(value);
  return (
    CRYPTO_LIST.find(
      (crypto) =>
        normalizeDonateParam(crypto.id) === normalizedValue ||
        normalizeDonateParam(crypto.symbol) === normalizedValue ||
        normalizeDonateParam(crypto.name) === normalizedValue
    ) ?? null
  );
}

function getDefaultNetwork(crypto: CryptoItem): NetworkOption | null {
  if (!crypto.networks || crypto.networks.length === 0) {
    return null;
  }

  return (
    crypto.networks.find(
      (network) =>
        normalizeNetworkParam(network.networkName) === normalizeNetworkParam(crypto.network)
    ) ?? crypto.networks[0]
  );
}

function findNetworkByParam(crypto: CryptoItem, value?: string | null): NetworkOption | null {
  const defaultNetwork = getDefaultNetwork(crypto);

  if (!value || !crypto.networks || crypto.networks.length === 0) {
    return defaultNetwork;
  }

  const normalizedValue = normalizeDonateParam(value);
  return (
    crypto.networks.find(
      (network) =>
        normalizeNetworkParam(network.networkName) === normalizeNetworkParam(normalizedValue)
    ) ?? defaultNetwork
  );
}

export function DonateDialog({
  open,
  onClose,
  initialAmount = 0,
  initialTab = 'bank',
  initialCryptoId = null,
  initialNetwork = null,
  onAmountUpdate,
  onTabUpdate,
  onCryptoUpdate,
}: DonateDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DonateTab>(initialTab);
  const [amount, setAmount] = useState<number>(initialAmount);
  const [inputVal, setInputVal] = useState<string>(
    initialAmount > 0 ? formatIntegerViInput(initialAmount.toString()) : ''
  );
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoItem | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [bankCopied, setBankCopied] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!selectedCrypto) {
      setSelectedNetwork(null);
      return;
    }

    setSelectedNetwork((currentNetwork) => {
      if (
        currentNetwork &&
        selectedCrypto.networks?.some(
          (network) =>
            normalizeNetworkParam(network.networkName) ===
            normalizeNetworkParam(currentNetwork.networkName)
        )
      ) {
        return currentNetwork;
      }

      return getDefaultNetwork(selectedCrypto);
    });
  }, [selectedCrypto]);

  useEffect(() => {
    if (!open) {
      setSelectedCrypto(null);
      setSearchQuery('');
      setActiveTab('bank');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setAmount(initialAmount);
    setInputVal(initialAmount > 0 ? formatIntegerViInput(initialAmount.toString()) : '');
    setActiveTab(initialTab);

    if (initialTab === 'crypto') {
      const crypto = findCryptoByParam(initialCryptoId);
      setSelectedCrypto(crypto);
      setSelectedNetwork(crypto ? findNetworkByParam(crypto, initialNetwork) : null);
    } else {
      setSelectedCrypto(null);
      setSelectedNetwork(null);
    }
  }, [initialAmount, initialCryptoId, initialNetwork, initialTab, open]);

  const filteredCryptoList = CRYPTO_LIST.filter(
    (crypto) =>
      crypto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAmountChange = (val: string) => {
    const formatted = formatIntegerViInput(val);
    setInputVal(formatted);
    const num = parseViFloat(formatted);
    if (!isNaN(num) && num >= 0) {
      setAmount(num);
      onAmountUpdate?.(num);
    } else if (val === '') {
      setAmount(0);
      onAmountUpdate?.(0);
    }
  };

  const handleSelectOption = (value: number) => {
    setAmount(value);
    setInputVal(formatIntegerViInput(value.toString()));
    onAmountUpdate?.(value);
  };

  const handleTabChange = (tab: DonateTab) => {
    setActiveTab(tab);

    if (tab === 'bank') {
      setSelectedCrypto(null);
      setSelectedNetwork(null);
    }

    onTabUpdate?.(tab);
  };

  const handleSelectCrypto = (crypto: CryptoItem) => {
    const network = getDefaultNetwork(crypto);
    setSelectedCrypto(crypto);
    setSelectedNetwork(network);
    onCryptoUpdate?.(crypto, network);
  };

  const handleSelectNetwork = (network: NetworkOption) => {
    setSelectedNetwork(network);

    if (selectedCrypto) {
      onCryptoUpdate?.(selectedCrypto, network);
    }
  };

  const handleBackToCryptoList = () => {
    setSelectedCrypto(null);
    setSelectedNetwork(null);
    onTabUpdate?.('crypto');
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleBankCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setBankCopied(true);
      setTimeout(() => setBankCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy bank details: ', err);
    }
  };

  const tabs = [
    { id: 'bank', label: t('donate.tabs.bank', 'VietQR Transfer') },
    { id: 'crypto', label: t('donate.tabs.crypto', 'Cryptocurrency (Crypto)') },
  ];

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="border-border bg-card/95 text-foreground no-scrollbar max-h-[92vh] max-w-[480px] overflow-y-auto rounded-2xl border p-6 shadow-2xl backdrop-blur-xl focus:outline-none focus-visible:outline-none sm:max-w-[800px]">
        <AnimatePresence mode="wait">
          {!selectedCrypto ? (
            <motion.div
              key="main-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* Dialog Header */}
              <DialogHeader className="flex flex-col items-center pb-2 text-center">
                <DialogTitle className="flex flex-col items-center gap-2">
                  {/* Beating Heart Icon */}
                  <motion.div
                    animate={{ scale: [1, 1.12, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      className="size-6"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </motion.div>
                  <span className="mt-2 bg-gradient-to-r from-red-400 via-pink-500 to-rose-500 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
                    {t('donate.title', 'Thank you so much for your support! ❤️')}
                  </span>
                </DialogTitle>
                <p className="text-muted-foreground/80 mt-1 max-w-[340px] text-xs leading-relaxed">
                  {t(
                    'donate.subtitle',
                    'Your support keeps me motivated to maintain and update the project.'
                  )}
                </p>
              </DialogHeader>

              {/* Tab Switcher */}
              <div className="bg-card-alt/80 border-border/80 relative flex rounded-xl border p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id as DonateTab)}
                    className={cn(
                      'relative flex-1 cursor-pointer rounded-lg border-none bg-transparent py-2 text-xs font-bold transition-colors duration-300 outline-none',
                      activeTab === tab.id
                        ? 'text-accent'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {activeTab === tab.id && (
                      <motion.span
                        layoutId="active-donate-tab"
                        className="bg-card border-border/60 absolute inset-0 rounded-lg border shadow-sm"
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Body */}
              <AnimatePresence mode="wait">
                {activeTab === 'bank' ? (
                  <motion.div
                    key="bank-tab"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="w-full"
                  >
                    <BankTab
                      amount={amount}
                      inputVal={inputVal}
                      onAmountChange={handleAmountChange}
                      onSelectOption={handleSelectOption}
                      onBankCopy={handleBankCopy}
                      bankCopied={bankCopied}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="crypto-tab"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                    className="flex w-full flex-col"
                  >
                    <CryptoTab
                      searchQuery={searchQuery}
                      setSearchQuery={setSearchQuery}
                      filteredCryptoList={filteredCryptoList}
                      onSelectCrypto={handleSelectCrypto}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="crypto-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex w-full flex-col"
            >
              <CryptoDetailTab
                selectedCrypto={selectedCrypto}
                selectedNetwork={selectedNetwork}
                setSelectedNetwork={handleSelectNetwork}
                onBack={handleBackToCryptoList}
                copied={copied}
                onCopy={handleCopy}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
