/* eslint-disable react-refresh/only-export-components */
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";

export type Currency = "USD" | "VND";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (value: number | null | undefined) => string;
  usdToVndRate: number;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const STORAGE_KEY = "cs2t_currency";
const USD_TO_VND_RATE = 25000; // Standard exchange rate for display

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("VND");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "USD" || saved === "VND") {
      setCurrencyState(saved);
    }
  }, []);

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem(STORAGE_KEY, newCurrency);
  };

  const formatCurrency = useMemo(() => {
    return (value: number | null | undefined): string => {
      if (value === null || value === undefined || Number.isNaN(value)) {
        return "Chưa có";
      }

      if (currency === "USD") {
        const usdValue = value / USD_TO_VND_RATE;
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
        }).format(usdValue);
      } else {
        return new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(value);
      }
    };
  }, [currency]);

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      formatCurrency,
      usdToVndRate: USD_TO_VND_RATE,
    }),
    [currency, formatCurrency],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used inside CurrencyProvider");
  }
  return context;
}
