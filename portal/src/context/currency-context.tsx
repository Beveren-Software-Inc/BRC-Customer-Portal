"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

type CurrencyContextType = {
  currency: string
  setCurrency: (currency: string) => void
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState("USD")

  // Load currency from localStorage on component mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem("preferred-currency")
    if (savedCurrency) {
      setCurrency(savedCurrency)
    }
  }, [])

  // Save currency to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("preferred-currency", currency)
  }, [currency])

  return <CurrencyContext.Provider value={{ currency, setCurrency }}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return context
}

interface CurrencySettings {
  allowSecondCurrency: boolean;
  setAllowSecondCurrency: (val: boolean) => void;
  secondCurrency: string;
  setSecondCurrency: (val: string) => void;
  exchangeRate: number;
  setExchangeRate: (val: number) => void;
}

const CurrencySettingsContext = createContext<CurrencySettings | undefined>(undefined);

export const CurrencySettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allowSecondCurrency, setAllowSecondCurrency] = useState(false);
  const [secondCurrency, setSecondCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(3.75);

  return (
    <CurrencySettingsContext.Provider
      value={{
        allowSecondCurrency,
        setAllowSecondCurrency,
        secondCurrency,
        setSecondCurrency,
        exchangeRate,
        setExchangeRate,
      }}
    >
      {children}
    </CurrencySettingsContext.Provider>
  );
};

export const useCurrencySettings = () => {
  const ctx = useContext(CurrencySettingsContext);
  if (!ctx) throw new Error("useCurrencySettings must be used within CurrencySettingsProvider");
  return ctx;
};

