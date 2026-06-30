"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FaCoffee } from "react-icons/fa";
import { FaCopy, FaCheck, FaBowlFood, FaBowlRice } from "react-icons/fa6";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    const charCode = str.charCodeAt(c);
    crc ^= (charCode << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  let hex = (crc & 0xFFFF).toString(16).toUpperCase();
  return hex.padStart(4, "0");
}

function generateVietQRString({
  bin,
  accountNo,
  amount,
  memo
}: {
  bin: string;
  accountNo: string;
  amount?: number;
  memo?: string;
}): string {
  const parts: string[] = [];
  parts.push("000201");
  parts.push("010212");
  
  const bankInfoParts: string[] = [];
  bankInfoParts.push(`00${String(bin.length).padStart(2, "0")}${bin}`);
  bankInfoParts.push(`01${String(accountNo.length).padStart(2, "0")}${accountNo}`);
  const bankInfoStr = bankInfoParts.join("");
  
  const merchantInfoParts: string[] = [];
  merchantInfoParts.push("0010A000000727");
  merchantInfoParts.push(`01${String(bankInfoStr.length).padStart(2, "0")}${bankInfoStr}`);
  merchantInfoParts.push("0208QRIBFTTA");
  const merchantInfoStr = merchantInfoParts.join("");
  
  parts.push(`38${String(merchantInfoStr.length).padStart(2, "0")}${merchantInfoStr}`);
  parts.push("5303704");
  
  if (amount && amount > 0) {
    const amountStr = String(amount);
    parts.push(`54${String(amountStr.length).padStart(2, "0")}${amountStr}`);
  }
  
  parts.push("5802VN");
  
  if (memo) {
    const cleanMemo = memo
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9 ]/g, "");
    const memoPart = `08${String(cleanMemo.length).padStart(2, "0")}${cleanMemo}`;
    parts.push(`62${String(memoPart.length).padStart(2, "0")}${memoPart}`);
  }
  
  const preCrcStr = parts.join("") + "6304";
  const checksum = crc16(preCrcStr);
  return preCrcStr + checksum;
}

interface BankTabProps {
  amount: number;
  inputVal: string;
  onAmountChange: (val: string) => void;
  onSelectOption: (value: number) => void;
  onBankCopy: (text: string) => void;
  bankCopied: boolean;
}

export function BankTab({
  amount,
  inputVal,
  onAmountChange,
  onSelectOption,
  onBankCopy,
  bankCopied,
}: BankTabProps) {
  const { t } = useTranslation();
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    const vietQrStr = generateVietQRString({
      bin: "970407",
      accountNo: "1310200188",
      amount: amount,
      memo: "Nuoi tui",
    });

    QRCode.toDataURL(vietQrStr, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error("Error generating VietQR:", err));
  }, [amount]);

  const options = [
    {
      value: 10000,
      label: t("donate.option.coffee", "Cup of Coffee"),
      priceText: "10K",
      icon: <FaCoffee className="size-4" />,
      colorClass: "text-[#DDB892] group-hover:text-[#E6CCB2]",
    },
    {
      value: 20000,
      label: t("donate.option.pho", "Bowl of Pho"),
      priceText: "20K",
      icon: <FaBowlFood className="size-4" />,
      colorClass: "text-[#F1A7A7] group-hover:text-[#FFBDBD]",
    },
    {
      value: 50000,
      label: t("donate.option.chickenRice", "Chicken Rice"),
      priceText: "50K",
      icon: <FaBowlRice className="size-4" />,
      colorClass: "text-[#F9C74F] group-hover:text-[#F9D06F]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full items-start">
      {/* Left Column: Card & Selection */}
      <div className="flex flex-col gap-4">
        {/* Bank Card (Debit Card Style) */}
        <div className="relative w-full rounded-2xl border border-border/80 bg-gradient-to-br from-card-alt to-card-surface p-5 shadow-lg overflow-hidden group/card">
          <div className="absolute -right-24 -top-24 size-48 rounded-full bg-accent/5 blur-3xl group-hover/card:bg-accent/10 transition-colors duration-500" />
          
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-accent uppercase">
                Techcombank
              </span>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground opacity-90">
                  BUI SON THAI
                </span>
                <button
                  type="button"
                  onClick={() => onBankCopy("BUI SON THAI")}
                  className="inline-flex size-5 items-center justify-center rounded bg-foreground/5 text-muted-foreground hover:text-foreground active:scale-95 transition cursor-pointer"
                  title={t("donate.copyName", "Copy Name")}
                >
                  <FaCopy className="size-2.5" />
                </button>
              </div>
            </div>
            {/* Simulated Chip SVG */}
            <div className="w-9 h-7 rounded bg-gradient-to-r from-amber-400/20 via-amber-400/40 to-amber-400/20 border border-amber-400/30 flex flex-col justify-between p-1 opacity-85">
              <div className="h-[1.5px] bg-amber-400/40 w-full" />
              <div className="h-[1.5px] bg-amber-400/40 w-full" />
              <div className="h-[1.5px] bg-amber-400/40 w-full" />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground block leading-none mb-1 font-bold uppercase tracking-wider">
                {t("donate.bankCard.accountNo", "Account Number")}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-foreground">
                  1310 2001 88
                </span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => onBankCopy("1310200188")}
                    className="inline-flex size-6 items-center justify-center rounded-lg bg-accent/10 text-accent hover:bg-accent/20 active:scale-95 transition cursor-pointer"
                  >
                    {bankCopied ? (
                      <FaCheck className="size-3 text-emerald-400" />
                    ) : (
                      <FaCopy className="size-3" />
                    )}
                  </button>
                  <AnimatePresence>
                    {bankCopied && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border border-border bg-card px-2.5 py-1 text-[10px] font-bold whitespace-nowrap text-foreground shadow-xl shadow-black/20"
                      >
                        {t("donate.copied", "Copied")}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-extrabold tracking-tight text-muted-foreground uppercase">
                DEBIT
              </span>
            </div>
          </div>
        </div>

        {/* 3 Quick Options */}
        <div className="grid grid-cols-3 gap-2.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectOption(opt.value)}
              className={cn(
                "group flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden",
                amount === opt.value
                  ? "border-accent bg-accent/5 text-accent shadow-[0_0_15px_rgba(59,130,246,0.12)]"
                  : "border-border/80 bg-card-alt/40 text-foreground hover:border-accent/40 hover:bg-card-alt"
              )}
            >
              {amount === opt.value && (
                <motion.div
                  layoutId="active-option-bar"
                  className="absolute inset-x-0 top-0 h-[2.5px] bg-accent"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}

              <div className={cn(
                "mb-1.5 flex size-8 items-center justify-center rounded-full bg-card shadow-inner group-hover:scale-110 transition duration-300",
                amount === opt.value ? "text-accent" : opt.colorClass
              )}>
                 {opt.icon}
              </div>

              <span className="text-[10px] font-bold tracking-tight">
                {opt.label}
              </span>

              <span className="mt-0.5 text-[9px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                {opt.priceText}
              </span>
            </button>
          ))}
        </div>

        {/* Custom Input */}
        <div className="w-full text-left">
          <label htmlFor="custom-amount" className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            {t("donate.amountLabel", "Transfer amount")}
          </label>
          <div className="relative mt-1.5">
            <Input
              id="custom-amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputVal === "0" ? "" : inputVal}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={t("donate.amountPlaceholder", "Enter amount...")}
              className="h-10 border border-border/80 bg-card-alt/40 pr-12 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-accent/60 focus:ring-accent/10 focus-visible:ring-accent/10 rounded-xl"
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-xs font-extrabold text-muted-foreground/50 tracking-wider">
              VND
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Large QR Code */}
      <div className="flex flex-col items-center justify-center h-full py-1">
        {/* QR Code Container */}
        <div className="relative flex size-64 sm:size-72 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-lg shadow-black/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group/qr">
          <div className="absolute -top-[1.5px] -left-[1.5px] h-4 w-4 rounded-tl-xl border-t-2 border-l-2 border-accent transition-all duration-300 group-hover/qr:size-5" />
          <div className="absolute -top-[1.5px] -right-[1.5px] h-4 w-4 rounded-tr-xl border-t-2 border-r-2 border-accent transition-all duration-300 group-hover/qr:size-5" />
          <div className="absolute -bottom-[1.5px] -left-[1.5px] h-4 w-4 rounded-bl-xl border-b-2 border-l-2 border-accent transition-all duration-300 group-hover/qr:size-5" />
          <div className="absolute -bottom-[1.5px] -right-[1.5px] h-4 w-4 rounded-br-xl border-b-2 border-r-2 border-accent transition-all duration-300 group-hover/qr:size-5" />

          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Techcombank VietQR"
              className="size-full rounded-xl object-contain transition-transform duration-300 group-hover/qr:scale-[0.98]"
            />
          ) : (
            <div className="size-full animate-pulse bg-stone-100 dark:bg-stone-800 rounded-xl" />
          )}
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="bg-black/85 backdrop-blur-sm text-[9px] font-bold text-white px-2.5 py-1 rounded-full border border-white/10 tracking-wide uppercase opacity-0 group-hover/qr:opacity-100 transition-opacity duration-300 select-none">
              {t("donate.scanToPay", "Scan to pay")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
