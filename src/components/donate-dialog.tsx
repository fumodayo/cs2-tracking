"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FaCoffee } from "react-icons/fa";
import { FaCopy, FaCheck, FaBowlFood, FaBowlRice } from "react-icons/fa6";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";

interface NetworkOption {
  networkName: string;
  address: string;
  icon?: React.ReactNode;
  color?: string;
}

type CryptoItem = {
  id: string;
  name: string;
  symbol: string;
  network: string;
  address: string;
  iconUrl: string;
  color: string;
  networks?: NetworkOption[];
};

const CRYPTO_LIST: CryptoItem[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    network: "Bitcoin",
    address: "bc1qsjd2k4y35d2vxdq2csgh7l785fh850kz75sa6x",
    iconUrl: "/assets/crypto/bitcoin.png",
    color: "bg-[#F7931A]",
  },
  {
    id: "bch",
    name: "Bitcoin Cash",
    symbol: "BCH",
    network: "Bitcoin Cash",
    address: "bitcoincash:qq0xq568gwl89mn3c40gjj2mnp9n6yg83ss9wvp8uu",
    iconUrl: "/assets/crypto/bitcoin-cash.png",
    color: "bg-[#8DC351]",
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    network: "ERC20",
    address: "0xa0478E54042340aaDee067B3378a4dB1b371E359",
    iconUrl: "/assets/crypto/ethereum.png",
    color: "bg-[#627EEA]",
  },
  {
    id: "ltc",
    name: "Litecoin",
    symbol: "LTC",
    network: "Litecoin",
    address: "abc_ltc_mock_address_asdfg67890",
    iconUrl: "/assets/crypto/litecoin.png",
    color: "bg-[#A6A9AA]",
  },
  {
    id: "usdc",
    name: "USDC",
    symbol: "USDC",
    network: "ERC20",
    address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
    iconUrl: "/assets/crypto/usdc.png",
    color: "bg-[#2775CA]",
    networks: [
      {
        networkName: "Solana",
        address: "3ML8YfJzVTBiydSKvdWAM5NLGFqiwE91noADFgg54u8b",
        icon: <img src="/assets/crypto/solana.png" alt="Solana" className="size-3.5 object-contain" />,
        color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
      },
      {
        networkName: "Ethereum",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="size-3.5">
            <g fillRule="evenodd">
              <circle cx="50%" cy="50%" r="50%" fill="#627EEA"></circle>
              <g fill="#FFF">
                <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z"></path>
                <path d="M16.498 4 9 16.22l7.498-3.35z"></path>
                <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z"></path>
                <path d="M16.498 27.995v-6.028L9 17.616z"></path>
                <path fillOpacity=".2" d="m16.498 20.573 7.497-4.353-7.497-3.348z"></path>
                <path fillOpacity=".602" d="m9 16.22 7.498 4.353v-7.701z"></path>
              </g>
            </g>
          </svg>
        ),
        color: "bg-[#627EEA]",
      },
      {
        networkName: "BSC",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" className="size-3.5">
            <circle cx="15" cy="15" r="15" fill="#F0B90B"></circle>
            <path fill="#fff" d="M8.86 7.37 15 4l6.14 3.37-2.257 1.245L15 6.49l-3.883 2.125zm12.28 4.25-2.257-1.245L15 12.499l-3.883-2.124L8.86 11.62v2.49l3.883 2.124v4.25L15 21.729l2.257-1.245v-4.25l3.883-2.125zm0 6.739v-2.49l-2.257 1.245v2.49zm1.603.88-3.883 2.125v2.49l6.14-3.37v-6.74l-2.257 1.245zm-2.258-9.744 2.258 1.245v2.49L25 11.983v-2.49L22.743 8.25zm-7.742 12.77v2.49L15 26l2.257-1.245v-2.49L15 23.51zM8.86 18.36l2.257 1.245v-2.49L8.86 15.87zm3.883-8.864L15 10.74l2.257-1.245L15 8.25zM7.257 10.74l2.258-1.245L7.257 8.25 5 9.495v2.49l2.257 1.244zm0 4.25L5 13.743v6.74l6.14 3.37v-2.49l-3.883-2.125z"></path>
          </svg>
        ),
        color: "bg-[#F3BA2F]",
      },
      {
        networkName: "Polygon",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 507.91 446.91" className="size-3.5 fill-[#8247E5]">
            <path d="M384.58,136.59c-9.28-5.3-21.22-5.3-31.83,0l-74.26,43.77L228.1,208.2,155.16,252c-9.28,5.3-21.22,5.3-31.83,0l-57-34.48a32.33,32.33,0,0,1-15.92-27.85V123.33c0-10.61,5.31-21.22,15.92-27.85l57-33.15c9.28-5.31,21.22-5.31,31.83,0l57,34.48a32.31,32.31,0,0,1,15.92,27.85v43.76l50.39-29.18V94.16c0-10.61-5.3-21.22-15.91-27.85L156.48,4c-9.28-5.31-21.21-5.31-31.82,0L15.91,67.63C5.3,72.94,0,83.55,0,94.16V218.81C0,229.42,5.3,240,15.91,246.66L123.33,309c9.28,5.31,21.22,5.31,31.83,0l72.94-42.44,50.39-29.17,72.94-42.44c9.28-5.3,21.22-5.3,31.83,0l57,33.16A32.32,32.32,0,0,1,456.19,256v66.3c0,10.61-5.3,21.22-15.91,27.85l-55.7,33.16c-9.28,5.3-21.22,5.3-31.83,0l-57-33.16a32.32,32.32,0,0,1-15.91-27.85V279.82L229.42,309v43.76c0,10.61,5.31,21.22,15.92,27.85l107.41,62.33c9.29,5.31,21.22,5.31,31.83,0L492,380.6a32.32,32.32,0,0,0,15.91-27.85v-126c0-10.61-5.3-21.22-15.91-27.85Z"/>
          </svg>
        ),
        color: "bg-[#8247E5]",
      },
    ],
  },
  {
    id: "usdt",
    name: "USDT",
    symbol: "USDT",
    network: "TRC20",
    address: "TYepTnkRXsT5j4LJTKWfyLM9rH3jVKZfz6",
    iconUrl: "/assets/crypto/usdt.png",
    color: "bg-[#26A17B]",
    networks: [
      {
        networkName: "Solana",
        address: "7xKX1v3TGYGmdn43Wf1cPpZ9QFDksvKkPpd7gS2HpxFz",
        icon: <img src="/assets/crypto/solana.png" alt="Solana" className="size-3.5 object-contain" />,
        color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
      },
      {
        networkName: "Ethereum",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 32 32" className="size-3.5">
            <g fillRule="evenodd">
              <circle cx="50%" cy="50%" r="50%" fill="#627EEA"></circle>
              <g fill="#FFF">
                <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z"></path>
                <path d="M16.498 4 9 16.22l7.498-3.35z"></path>
                <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z"></path>
                <path d="M16.498 27.995v-6.028L9 17.616z"></path>
                <path fillOpacity=".2" d="m16.498 20.573 7.497-4.353-7.497-3.348z"></path>
                <path fillOpacity=".602" d="m9 16.22 7.498 4.353v-7.701z"></path>
              </g>
            </g>
          </svg>
        ),
        color: "bg-[#627EEA]",
      },
      {
        networkName: "BSC",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 30" className="size-3.5">
            <circle cx="15" cy="15" r="15" fill="#F0B90B"></circle>
            <path fill="#fff" d="M8.86 7.37 15 4l6.14 3.37-2.257 1.245L15 6.49l-3.883 2.125zm12.28 4.25-2.257-1.245L15 12.499l-3.883-2.124L8.86 11.62v2.49l3.883 2.124v4.25L15 21.729l2.257-1.245v-4.25l3.883-2.125zm0 6.739v-2.49l-2.257 1.245v2.49zm1.603.88-3.883 2.125v2.49l6.14-3.37v-6.74l-2.257 1.245zm-2.258-9.744 2.258 1.245v2.49L25 11.983v-2.49L22.743 8.25zm-7.742 12.77v2.49L15 26l2.257-1.245v-2.49L15 23.51zM8.86 18.36l2.257 1.245v-2.49L8.86 15.87zm3.883-8.864L15 10.74l2.257-1.245L15 8.25zM7.257 10.74l2.258-1.245L7.257 8.25 5 9.495v2.49l2.257 1.244zm0 4.25L5 13.743v6.74l6.14 3.37v-2.49l-3.883-2.125z"></path>
          </svg>
        ),
        color: "bg-[#F3BA2F]",
      },
      {
        networkName: "Tron",
        address: "TYepTnkRXsT5j4LJTKWfyLM9rH3jVKZfz6",
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 15 14" className="size-3.5">
            <path fill="#EF0027" d="M7.875 14a7 7 0 1 0 0-14 7 7 0 0 0 0 14"></path>
            <path fill="#fff" d="M10.47 4.337 4.156 3.175l3.323 8.361 4.63-5.64zm-.101.512.966.918-2.642.478zm-2.25 1.3L5.335 3.84l4.55.838zm-.198.409-.454 3.754L5.019 4.15zm.42.199 2.926-.53-3.356 4.088z"></path>
          </svg>
        ),
        color: "bg-[#EC0928]",
      },
      {
        networkName: "Polygon",
        address: "0x6a910b59D14F0043956a399701A0FD8D657680D3",
        icon: (
          <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAOCAYAAADwikbvAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJNSURBVHgBZVJNSFRRGD3f9948Z8Sf8qcQtZpoISYqows17GflxmhVi/YFLtoEJhFEkiT0Q7VRklq6aCFBroKiNDVIU2JgNqFRMYE1Nuj8z7z7bve+mTHTC5d377vnnO+ecz/CrjHevnJEAOcFc6+U5HeYow5j2SGaGvzYPEcgWcTSTuJY2/KQJAwKMqoVGHpKYuTX7EiiZ6lY7upwqCX+H3msbummJGO4AESRXFwXRQTRjMXi7NB8U4w1caI92APwLX2ff1MTCOUHPTg5UAvvftPdg+hURpYMbFceb1uac8g4IShPcKuB0XW5Fk19lVj9kEBzXwVmJjbwaTqhziidROaA+aRjqdK2uccpEE2fgYbuckS+5uDvKsPUtTAi320EX8XRe6kai9NJjfNajtVn2sLwSzdCQtVRL85cr0c67iAazqoKgLDhinrLjYIVuN7JsBrMrAKYuqr61gfK8Hs1gzf31vXVcPHpYbT2V8IqYxwK+LDwPOYKaRFIIU2DZFiC1ZMSadX0lnCJOl02CV8Wkqhr8eH95Do2N2SerINjXiO9fRwIzqsf3VXHfOgfbcCPlRQq6j3IZiRejvxCKqFCZC6E6ZL/ZJMlx920H3aunAY8r1XahlXhQcu5fYh8y2FtMYWsveu9lYgjcX90tnFwu0kedIZGBOOGspAHa9CeZmGdzawtEv13VZMYRXL3z5p3Vl1rUjI6lF+f9iwLlfIhcY6YX0QjmxceLTfH9/S2HrdbP/u5tPSKshBQidWo22wJySHV2JN35hvf7sT+BfhCACn5p+vOAAAAAElFTkSuQmCC"
            alt="Polygon"
            className="size-3.5 object-contain"
          />
        ),
        color: "bg-[#8247E5]",
      },
    ],
  },
  {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    network: "TRC20",
    address: "abc_tron_mock_address_mnbvc445566",
    iconUrl: "/assets/crypto/tron.png",
    color: "bg-[#EC0928]",
  },
  {
    id: "bnb",
    name: "Binance Coin",
    symbol: "BNB",
    network: "BEP20",
    address: "abc_bnb_mock_address_lkjhg778899",
    iconUrl: "/assets/crypto/binance-coin.png",
    color: "bg-[#F3BA2F]",
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    network: "Solana",
    address: "abc_sol_mock_address_poiuy001122",
    iconUrl: "/assets/crypto/solana.png",
    color: "bg-gradient-to-tr from-[#9945FF] to-[#14F195]",
  },
  {
    id: "xrp",
    name: "Ripple",
    symbol: "XRP",
    network: "Ripple",
    address: "abc_xrp_mock_address_mnbvc12345",
    iconUrl: "/assets/crypto/ripple.png",
    color: "bg-[#00AAE4]",
  },
  {
    id: "doge",
    name: "Dogecoin",
    symbol: "DOGE",
    network: "Dogecoin",
    address: "abc_doge_mock_address_doge667788",
    iconUrl: "/assets/crypto/dogecoin.png",
    color: "bg-[#C2A633]",
  },
];

interface DonateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function DonateDialog({ open, onClose }: DonateDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number>(20000);
  const [inputVal, setInputVal] = useState<string>("20000");
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoItem | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (selectedCrypto) {
      if (selectedCrypto.networks && selectedCrypto.networks.length > 0) {
        const defaultNet =
          selectedCrypto.networks.find(
            (n) => n.networkName.toLowerCase() === selectedCrypto.network.toLowerCase()
          ) || selectedCrypto.networks[0];
        setSelectedNetwork(defaultNet);
      } else {
        setSelectedNetwork(null);
      }
    } else {
      setSelectedNetwork(null);
    }
  }, [selectedCrypto]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredCryptoList = CRYPTO_LIST.filter(crypto =>
    crypto.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    crypto.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scrollCarousel = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 240;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Synchronize input inputVal string with amount state
  const handleAmountChange = (val: string) => {
    setInputVal(val);
    const num = parseInt(val.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num >= 0) {
      setAmount(num);
    } else if (val === "") {
      setAmount(0);
    }
  };

  const handleSelectOption = (value: number) => {
    setAmount(value);
    setInputVal(value.toString());
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const options = [
    {
      value: 10000,
      label: t("donate.option.coffee", "Cốc Cafe"),
      priceText: "10K",
      icon: <FaCoffee className="size-5" />,
      colorClass: "text-[#DDB892] group-hover:text-[#E6CCB2]",
    },
    {
      value: 20000,
      label: t("donate.option.pho", "Tô Phở"),
      priceText: "20K",
      icon: <FaBowlFood className="size-5" />,
      colorClass: "text-[#F1A7A7] group-hover:text-[#FFBDBD]",
    },
    {
      value: 50000,
      label: t("donate.option.chickenRice", "Cơm Gà"),
      priceText: "50K",
      icon: <FaBowlRice className="size-5" />,
      colorClass: "text-[#F9C74F] group-hover:text-[#F9D06F]",
    },
  ];

  const vietQrUrl = `https://img.vietqr.io/image/techcombank-1310200188-compact2.png?amount=${amount}&addInfo=${encodeURIComponent("Nuoi tui")}&accountName=${encodeURIComponent("BUI SON THAI")}`;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="max-w-[480px] border border-border bg-card p-6 text-foreground">
          <DialogHeader className="flex flex-col items-center border-b border-border pb-4 text-center">
            <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
              <span>{t("donate.title", "Cảm ơn bạn nhiều vì đã ủng hộ! ❤️")}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Bank Option Card */}
          <div className="mt-4 flex flex-col items-center rounded-xl border border-border bg-card-alt p-5 shadow-sm transition hover:border-[color-mix(in_srgb,var(--border)_80%,var(--accent))]">
            <div className="text-center">
              <p className="text-sm tracking-wider text-muted-foreground uppercase font-semibold">
                {t("donate.bankTitle", "Quét mã để chuyển tiền đến")}
              </p>
              <h3 className="mt-1 text-lg font-extrabold text-foreground">BUI SON THAI</h3>
              <p className="text-sm font-mono text-muted-foreground">Techcombank • 1310 2001 88</p>
            </div>

            {/* Dynamic VietQR Image Container */}
            <div className="relative mt-5 flex size-80 items-center justify-center rounded-xl border border-border bg-white p-3 shadow-lg shadow-black/20 transition-transform duration-300 hover:scale-[1.02]">
              {/* Corner borders for premium styling */}
              <div className="absolute -top-[1px] -left-[1px] h-3.5 w-3.5 rounded-tl-xl border-t-2 border-l-2 border-accent" />
              <div className="absolute -top-[1px] -right-[1px] h-3.5 w-3.5 rounded-tr-xl border-t-2 border-r-2 border-accent" />
              <div className="absolute -bottom-[1px] -left-[1px] h-3.5 w-3.5 rounded-bl-xl border-b-2 border-l-2 border-accent" />
              <div className="absolute -bottom-[1px] -right-[1px] h-3.5 w-3.5 rounded-br-xl border-b-2 border-r-2 border-accent" />

              <img
                src={vietQrUrl}
                alt="Techcombank VietQR"
                className="size-full rounded-lg object-contain"
                loading="lazy"
              />
            </div>

            {/* 3 Quick Options */}
            <div className="mt-5 grid w-full grid-cols-3 gap-3">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectOption(opt.value)}
                  className={cn(
                    "group flex flex-col items-center justify-center rounded-xl border p-3 transition-all duration-300 active:scale-95 cursor-pointer relative overflow-hidden",
                    amount === opt.value
                      ? "border-accent bg-accent/10 text-accent shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                      : "border-border bg-card/60 text-foreground hover:border-[color-mix(in_srgb,var(--border)_70%,var(--accent)_30%)] hover:bg-card"
                  )}
                >
                  {amount === opt.value && (
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
                  )}

                  <div className={cn(
                    "mb-2 flex size-10 items-center justify-center rounded-full bg-card-surface shadow-inner group-hover:scale-105 transition duration-300",
                    amount === opt.value ? "text-accent" : opt.colorClass
                  )}>
                    {opt.icon}
                  </div>

                  <span className="text-sm font-bold tracking-tight">
                    {opt.label}
                  </span>

                  <span className="mt-0.5 text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {opt.priceText}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Amount Input */}
            <div className="mt-4 w-full">
              <label htmlFor="custom-amount" className="text-sm font-semibold text-muted-foreground">
                {t("donate.amountLabel", "Số tiền muốn chuyển khoản (VNĐ)")}
              </label>
              <div className="relative mt-1">
                <Input
                  id="custom-amount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputVal === "0" ? "" : Number(inputVal.replace(/\D/g, "")).toLocaleString("vi-VN")}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder={t("donate.amountPlaceholder", "Nhập số tiền...")}
                  className="border border-border bg-card-alt pr-12 text-base text-foreground focus:border-accent/40 focus:ring-accent/10"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm font-bold text-muted-foreground/60">
                  VND
                </span>
              </div>
            </div>
          </div>

          {/* Divider & Header */}
          <div className="my-5 flex items-center justify-between border-t border-border pt-5">
            <div className="text-left">
              <h3 className="text-base font-extrabold tracking-tight text-foreground">
                {t("donate.cryptoTitle", "Cryptocurrency")}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                {t("donate.cryptoSubtitle", "Chọn loại tiền điện tử bạn muốn nạp")}
              </p>
            </div>

            {/* Carousel Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollCarousel("left")}
                className="flex size-7 items-center justify-center rounded-lg border border-border bg-card-alt text-muted-foreground hover:border-[color-mix(in_srgb,var(--border)_70%,var(--accent))] hover:bg-card hover:text-foreground active:scale-95 transition-all cursor-pointer"
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel("right")}
                className="flex size-7 items-center justify-center rounded-lg border border-border bg-card-alt text-muted-foreground hover:border-[color-mix(in_srgb,var(--border)_70%,var(--accent))] hover:bg-card hover:text-foreground active:scale-95 transition-all cursor-pointer"
                aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground/80" />
            <Input
              type="text"
              placeholder={t("donate.searchPlaceholder", "Tìm kiếm đồng tiền...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full border border-border bg-card-alt pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-accent/40 focus:ring-accent/10"
            />
          </div>

          {/* Crypto Selection Carousel */}
          {filteredCryptoList.length === 0 ? (
            <div className="flex h-[112px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-card-alt/30 text-center text-xs text-muted-foreground">
              {t("donate.noCryptoFound", "Không tìm thấy đồng tiền tương ứng")}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="no-scrollbar flex w-full gap-3 overflow-x-auto scroll-smooth pb-1"
            >
              {filteredCryptoList.map((crypto) => (
                <button
                  key={crypto.id}
                  type="button"
                  onClick={() => setSelectedCrypto(crypto)}
                  className="group flex w-[104px] h-[106px] flex-shrink-0 flex-col items-center justify-between rounded-xl border border-[#2b3245]/40 bg-[#1c2029] overflow-hidden transition-all duration-300 hover:border-accent hover:bg-[#202531] cursor-pointer"
                >
                  <div className="flex-1 w-full flex items-center justify-center p-3">
                    <img
                      src={crypto.iconUrl}
                      alt={crypto.name}
                      className="size-11 object-contain transition-all duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="w-full py-1.5 bg-[#14171f] border-t border-[#2b3245]/40 text-center">
                    <span className="block truncate px-1 text-[11px] font-bold tracking-tight text-[#9ca3af] group-hover:text-white transition-colors">
                      {crypto.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Secondary Sub-modal for Crypto Details */}
      <Dialog open={!!selectedCrypto} onOpenChange={(val) => !val && setSelectedCrypto(null)}>
        <DialogContent className="max-w-[440px] border border-border bg-card p-6 text-foreground">
          {selectedCrypto && (
            <>
              <DialogHeader className="flex flex-col items-center border-b border-border pb-4 text-center">
                <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
                  <span>
                    {t("donate.cryptoDepositTitle", "Nạp tiền bằng {{name}}", {
                      name: selectedCrypto.name,
                    })}
                  </span>
                  <div className="flex size-7 items-center justify-center rounded-full overflow-hidden">
                    <img src={selectedCrypto.iconUrl} alt={selectedCrypto.name} className="size-full object-contain" />
                  </div>
                </DialogTitle>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t(
                    "donate.cryptoDepositDesc",
                    "Bạn sẽ chuyển {{symbol}} trực tiếp đến địa chỉ ví bên dưới.",
                    { symbol: selectedCrypto.symbol }
                  )}
                </p>
              </DialogHeader>

              <div className="mt-4 flex flex-col items-center">
                {/* Mock Crypto Wallet QR Code */}
                <div className="relative flex size-52 items-center justify-center rounded-xl border border-border bg-white p-3 shadow-md shadow-black/10">
                  {/* Corner borders for premium styling */}
                  <div className="absolute -top-[1px] -left-[1px] h-3.5 w-3.5 rounded-tl-xl border-t-2 border-l-2 border-accent" />
                  <div className="absolute -top-[1px] -right-[1px] h-3.5 w-3.5 rounded-tr-xl border-t-2 border-r-2 border-accent" />
                  <div className="absolute -bottom-[1px] -left-[1px] h-3.5 w-3.5 rounded-bl-xl border-b-2 border-l-2 border-accent" />
                  <div className="absolute -bottom-[1px] -right-[1px] h-3.5 w-3.5 rounded-br-xl border-b-2 border-r-2 border-accent" />

                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      selectedNetwork ? selectedNetwork.address : selectedCrypto.address
                    )}&color=2e3440`}
                    alt={`${selectedCrypto.name} address QR`}
                    className="size-full rounded-lg object-contain"
                    loading="lazy"
                  />
                </div>

                {/* Available Network */}
                {selectedCrypto.networks && selectedCrypto.networks.length > 0 ? (
                  <div className="mt-4 flex w-full flex-col gap-2 text-left">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("donate.availableNetworks", "AVAILABLE NETWORKS")}
                    </span>
                    <div className="flex items-center gap-1 rounded-full border border-border bg-black/25 p-1 w-fit max-w-full overflow-x-auto no-scrollbar">
                      {selectedCrypto.networks.map((net) => {
                        const isSelected = selectedNetwork?.networkName === net.networkName;
                        return (
                          <button
                            key={net.networkName}
                            type="button"
                            onClick={() => setSelectedNetwork(net)}
                            className={cn(
                              "relative flex h-[34px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all cursor-pointer select-none group/net whitespace-nowrap outline-none border border-transparent bg-transparent duration-300",
                              isSelected
                                ? "text-accent"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {/* Active Pill Background */}
                            {isSelected && (
                              <motion.span
                                layoutId="active-net-pill"
                                className="absolute inset-0 rounded-full border border-accent/24 bg-accent/12 shadow-sm"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                              />
                            )}

                            <span className="relative z-10 flex items-center gap-2">
                              {net.icon ? (
                                <span
                                  className={cn(
                                    "flex size-3.5 items-center justify-center transition-all duration-200",
                                    isSelected
                                      ? "opacity-100 scale-100"
                                      : "opacity-60 grayscale-[10%] group-hover/net:opacity-95"
                                  )}
                                >
                                  {net.icon}
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "size-2 rounded-full transition-all duration-200",
                                    isSelected
                                      ? "scale-100"
                                      : "opacity-60 group-hover/net:opacity-95"
                                  )}
                                  style={{
                                    backgroundColor: net.color || "var(--color-accent)"
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
                  <div className="mt-4 flex w-full flex-col gap-2 text-left">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {t("donate.availableNetworks", "AVAILABLE NETWORKS")}
                    </span>
                    <div className="flex items-center gap-1 rounded-full border border-border bg-black/25 p-1 w-fit max-w-full">
                      <div className="flex items-center gap-2 rounded-full border border-accent/24 bg-accent/12 px-4 py-1.5 text-xs font-bold text-accent shadow-sm">
                        <div className={cn("size-2 rounded-full", selectedCrypto.color)} style={{ backgroundColor: selectedCrypto.color }} />
                        <span>{selectedCrypto.network}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deposit Address Box */}
                <div className="mt-4 w-full text-left">
                  <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {t("donate.depositAddress", "DEPOSIT ADDRESS")}
                  </span>
                  <div
                    onClick={() => handleCopy(selectedNetwork ? selectedNetwork.address : selectedCrypto.address)}
                    className="relative mt-1.5 flex items-center justify-between rounded-lg border border-border bg-card-alt px-4 py-3 cursor-pointer hover:border-border/60 hover:bg-card hover:shadow-sm active:scale-[0.99] transition-all duration-200 group/address select-none"
                  >
                    {/* Tooltip */}
                    <AnimatePresence>
                      {copied && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.95 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2.5 -translate-x-1/2 rounded-md border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-stone-200 shadow-xl"
                        >
                          Copied to clipboard!
                          <div className="absolute top-full left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-0.5 rotate-45 border-r border-b border-stone-800 bg-stone-900" />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <span className="break-all font-mono text-sm leading-relaxed text-foreground pr-2">
                      {selectedNetwork ? selectedNetwork.address : selectedCrypto.address}
                    </span>

                    <div
                      className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground group-hover/address:text-foreground transition-all ml-3 flex-shrink-0"
                    >
                      {copied ? (
                        <>
                          <FaCheck className="size-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <FaCopy className="size-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Warning note */}
                <div className="mt-4 rounded-xl border border-warning/20 bg-warning/5 p-4 text-muted-foreground">
                  <p className="text-sm font-bold text-warning">
                    ⚠️ {t("donate.warningLabel", "Chỉ gửi {{name}} đến địa chỉ này", {
                      name: selectedCrypto.name,
                    })}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    {t(
                      "donate.warningDesc",
                      "Chỉ gửi {{name}} sử dụng mạng lưới {{network}}. Gửi bất kỳ tài sản nào khác sẽ dẫn đến mất mát vĩnh viễn.",
                      {
                        name: selectedCrypto.name,
                        network: selectedNetwork ? selectedNetwork.networkName : selectedCrypto.network,
                      }
                    )}
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
