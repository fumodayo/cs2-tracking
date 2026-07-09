'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { FaCopy, FaCheck } from 'react-icons/fa6';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import type { CryptoItem, NetworkOption } from './donate-types';
import QRCode from 'qrcode';

interface CryptoDetailTabProps {
  selectedCrypto: CryptoItem;
  selectedNetwork: NetworkOption | null;
  setSelectedNetwork: (net: NetworkOption) => void;
  onBack: () => void;
  copied: boolean;
  onCopy: (text: string) => void;
}

export function CryptoDetailTab({
  selectedCrypto,
  selectedNetwork,
  setSelectedNetwork,
  onBack,
  copied,
  onCopy,
}: CryptoDetailTabProps) {
  const { t } = useTranslation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const activeRef = React.useRef<HTMLButtonElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const address = selectedNetwork ? selectedNetwork.address : selectedCrypto.address;

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [selectedNetwork]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    const handleMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
      hasDragged = false;
    };

    const handleMouseLeave = () => {
      isDown = false;
    };

    const handleMouseUp = () => {
      isDown = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 3) {
        hasDragged = true;
      }
      el.scrollLeft = scrollLeft - walk;
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (hasDragged) {
        e.stopPropagation();
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('click', handleClickCapture, true);

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('click', handleClickCapture, true);
    };
  }, []);

  useEffect(() => {
    if (address) {
      QRCode.toDataURL(address, {
        margin: 1,
        width: 512,
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('Error generating Crypto QR:', err));
    }
  }, [address]);

  return (
    <div className="flex w-full flex-col">
      {/* Phần đầu với nút quay lại */}
      <div className="border-border mb-4 flex items-center justify-between border-b pb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-xs font-bold transition outline-none"
        >
          <ChevronLeft className="size-4" />
          <span>{t('donate.back', 'Back')}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-foreground text-xs font-extrabold">
            {selectedCrypto.name} ({selectedCrypto.symbol})
          </span>
          <div className="flex size-6 items-center justify-center overflow-hidden rounded-full">
            <img
              src={selectedCrypto.iconUrl}
              alt={selectedCrypto.name}
              className="size-full object-contain"
            />
          </div>
        </div>
      </div>

      {/* Lưới hai cột */}
      <div className="grid w-full grid-cols-1 items-start gap-6 sm:grid-cols-2">
        {/* Cột trái: network và địa chỉ */}
        <div className="flex flex-col gap-5 text-left">
          {/* Các network khả dụng */}
          {selectedCrypto.networks && selectedCrypto.networks.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                {t('donate.availableNetworks', 'Available Networks')}
              </span>
              <div
                ref={containerRef}
                className="border-border bg-card-alt/60 no-scrollbar flex w-fit max-w-full cursor-grab items-center gap-1.5 overflow-x-auto rounded-full border p-1 select-none active:cursor-grabbing"
              >
                {selectedCrypto.networks.map((net) => {
                  const isSelected = selectedNetwork?.networkName === net.networkName;
                  return (
                    <button
                      key={net.networkName}
                      ref={isSelected ? activeRef : undefined}
                      type="button"
                      onClick={() => setSelectedNetwork(net)}
                      className={cn(
                        'group/net relative flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent bg-transparent px-3.5 text-xs font-bold whitespace-nowrap transition-all duration-300 outline-none select-none',
                        isSelected ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="active-net-pill"
                          className="border-accent/20 bg-accent/10 absolute inset-0 rounded-full border shadow-sm"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-2">
                        {net.icon ? (
                          <span
                            className={cn(
                              'flex size-3.5 items-center justify-center transition-all duration-200',
                              isSelected ? 'scale-100 opacity-100' : 'opacity-60 grayscale-[10%]'
                            )}
                          >
                            {net.icon}
                          </span>
                        ) : (
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: net.color || 'var(--color-accent)',
                            }}
                          />
                        )}
                        <span>{net.networkName}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                {t('donate.availableNetworks', 'Available Networks')}
              </span>
              <div className="border-border bg-card-alt/60 flex w-fit max-w-full items-center gap-1 rounded-full border p-1">
                <div className="border-accent/20 bg-accent/10 text-accent flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-sm">
                  <div className={cn('size-2 rounded-full', selectedCrypto.color)} />
                  <span>{selectedCrypto.network}</span>
                </div>
              </div>
            </div>
          )}

          {/* Khung địa chỉ nạp */}
          <div className="w-full">
            <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              {t('donate.depositAddress', 'Deposit Address')}
            </span>
            <button
              type="button"
              onClick={() => onCopy(address)}
              className="border-border bg-card-alt/50 hover:border-accent/40 hover:bg-card-alt group/address relative mt-2 flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200 select-none hover:shadow-sm active:scale-[0.99]"
            >
              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="border-border bg-card text-foreground pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap shadow-xl"
                  >
                    {t('donate.copied', 'Copied')}
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="text-foreground pr-2 font-mono text-xs leading-relaxed break-all">
                {address}
              </span>

              <div className="text-muted-foreground group-hover/address:text-foreground ml-3 flex flex-shrink-0 items-center gap-1.5 text-xs font-bold transition-all">
                {copied ? (
                  <>
                    <FaCheck className="size-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <FaCopy className="size-3" />
                    <span>Copy</span>
                  </>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Cột phải: mã QR và cảnh báo */}
        <div className="flex w-full flex-col items-center gap-4">
          {/* Mã QR */}
          <div className="border-border group/crypto-qr relative flex size-48 items-center justify-center rounded-2xl border bg-white p-3 shadow-md shadow-black/5 transition hover:scale-[1.02] sm:size-52">
            <div className="border-accent absolute -top-[1px] -left-[1px] h-3.5 w-3.5 rounded-tl-xl border-t-2 border-l-2" />
            <div className="border-accent absolute -top-[1px] -right-[1px] h-3.5 w-3.5 rounded-tr-xl border-t-2 border-r-2" />
            <div className="border-accent absolute -bottom-[1px] -left-[1px] h-3.5 w-3.5 rounded-bl-xl border-b-2 border-l-2" />
            <div className="border-accent absolute -right-[1px] -bottom-[1px] h-3.5 w-3.5 rounded-br-xl border-r-2 border-b-2" />

            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt={t('donate.cryptoAddressQrAlt', '{{name}} address QR Code', {
                  name: selectedCrypto.name,
                })}
                className="size-full rounded-lg object-contain"
              />
            ) : (
              <div className="dark:bg-stone-850 size-full animate-pulse rounded-lg bg-stone-100" />
            )}
          </div>

          {/* Ghi chú cảnh báo */}
          <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
              ⚠️{' '}
              {t('donate.warningLabel', 'Only send {{name}} to this address', {
                name: selectedCrypto.name,
              })}
            </p>
            <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
              {t(
                'donate.warningDesc',
                'Only send {{name}} using the {{network}} network. Sending any other asset will result in permanent loss.',
                {
                  name: selectedCrypto.name,
                  network: selectedNetwork ? selectedNetwork.networkName : selectedCrypto.network,
                }
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
