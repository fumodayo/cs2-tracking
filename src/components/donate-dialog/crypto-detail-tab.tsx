"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { FaCopy, FaCheck } from "react-icons/fa6";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";
import type { CryptoItem, NetworkOption } from "./donate-types";
import QRCode from "qrcode";

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const activeRef = React.useRef<HTMLButtonElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const address = selectedNetwork ? selectedNetwork.address : selectedCrypto.address;

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
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

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("mousedown", handleMouseDown);
    el.addEventListener("mouseleave", handleMouseLeave);
    el.addEventListener("mouseup", handleMouseUp);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("click", handleClickCapture, true);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("mousedown", handleMouseDown);
      el.removeEventListener("mouseleave", handleMouseLeave);
      el.removeEventListener("mouseup", handleMouseUp);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  useEffect(() => {
    if (address) {
      QRCode.toDataURL(address, {
        margin: 1,
        width: 512,
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("Error generating Crypto QR:", err));
    }
  }, [address]);

  return (
    <div className="flex flex-col w-full">
      {/* Header with Back button */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer bg-transparent border-none outline-none"
        >
          <ChevronLeft className="size-4" />
          <span>{t("donate.back", "Back")}</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-foreground">
            {selectedCrypto.name} ({selectedCrypto.symbol})
          </span>
          <div className="flex size-6 items-center justify-center rounded-full overflow-hidden">
            <img src={selectedCrypto.iconUrl} alt={selectedCrypto.name} className="size-full object-contain" />
          </div>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full items-start">
        {/* Left Column: Networks & Address */}
        <div className="flex flex-col gap-5 text-left">
          {/* Available Networks */}
          {selectedCrypto.networks && selectedCrypto.networks.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t("donate.availableNetworks", "Available Networks")}
              </span>
              <div
                ref={containerRef}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card-alt/60 p-1 w-fit max-w-full overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
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
                        "relative flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-all cursor-pointer select-none group/net whitespace-nowrap outline-none border border-transparent bg-transparent duration-300",
                        isSelected
                          ? "text-accent"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {isSelected && (
                        <motion.span
                          layoutId="active-net-pill"
                          className="absolute inset-0 rounded-full border border-accent/20 bg-accent/10 shadow-sm"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-2">
                        {net.icon ? (
                          <span className={cn(
                            "flex size-3.5 items-center justify-center transition-all duration-200",
                            isSelected ? "opacity-100 scale-100" : "opacity-60 grayscale-[10%]"
                          )}>
                            {net.icon}
                          </span>
                        ) : (
                          <span
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: net.color || "var(--color-accent)",
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
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {t("donate.availableNetworks", "Available Networks")}
              </span>
              <div className="flex items-center gap-1 rounded-full border border-border bg-card-alt/60 p-1 w-fit max-w-full">
                <div className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent shadow-sm">
                  <div className={cn("size-2 rounded-full", selectedCrypto.color)} />
                  <span>{selectedCrypto.network}</span>
                </div>
              </div>
            </div>
          )}

          {/* Deposit Address Box */}
          <div className="w-full">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {t("donate.depositAddress", "Deposit Address")}
            </span>
            <button
              type="button"
              onClick={() => onCopy(address)}
              className="relative mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-card-alt/50 px-4 py-3 cursor-pointer hover:border-accent/40 hover:bg-card-alt hover:shadow-sm active:scale-[0.99] transition-all duration-200 group/address select-none"
            >
              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-foreground shadow-xl"
                  >
                    {t("donate.copied", "Copied")}
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="break-all font-mono text-xs leading-relaxed text-foreground pr-2">
                {address}
              </span>

              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground group-hover/address:text-foreground transition-all ml-3 flex-shrink-0">
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

        {/* Right Column: QR Code & Warning */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* QR Code */}
          <div className="relative flex size-48 sm:size-52 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-md shadow-black/5 group/crypto-qr transition hover:scale-[1.02]">
            <div className="absolute -top-[1px] -left-[1px] h-3.5 w-3.5 rounded-tl-xl border-t-2 border-l-2 border-accent" />
            <div className="absolute -top-[1px] -right-[1px] h-3.5 w-3.5 rounded-tr-xl border-t-2 border-r-2 border-accent" />
            <div className="absolute -bottom-[1px] -left-[1px] h-3.5 w-3.5 rounded-bl-xl border-b-2 border-l-2 border-accent" />
            <div className="absolute -bottom-[1px] -right-[1px] h-3.5 w-3.5 rounded-br-xl border-b-2 border-r-2 border-accent" />

            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt={t("donate.cryptoAddressQrAlt", "{{name}} address QR Code", { name: selectedCrypto.name })}
                className="size-full rounded-lg object-contain"
              />
            ) : (
              <div className="size-full animate-pulse bg-stone-100 dark:bg-stone-850 rounded-lg" />
            )}
          </div>

          {/* Warning note */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left w-full">
            <p className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
              ⚠️ {t("donate.warningLabel", "Only send {{name}} to this address", {
                name: selectedCrypto.name,
              })}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
              {t(
                "donate.warningDesc",
                "Only send {{name}} using the {{network}} network. Sending any other asset will result in permanent loss.",
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
