import React from 'react';
import { useCurrencySettings } from '@/context/currency-context';

export interface DualCurrencyProps {
  amount: number;
  currency?: string;
  className?: string;
}

export function DualCurrencyDisplay({ amount, currency = 'SAR', className = '' }: DualCurrencyProps) {
  const { allowSecondCurrency, secondCurrency, exchangeRate } = useCurrencySettings();

  // Handle null/undefined amounts
  if (amount === null || amount === undefined) {
    return <span>-</span>;
  }

  // Always show backend currency
  const primaryAmount = amount;
  const primaryCurrency = currency;

  // Only show second currency if enabled and different from backend
  const showSecond = allowSecondCurrency && secondCurrency && secondCurrency !== primaryCurrency;
  let secondaryAmount = 0;
  let secondaryCurrency = '';
  if (showSecond) {
    secondaryCurrency = secondCurrency;
    secondaryAmount = amount * exchangeRate;
  }

  // Format both currencies
  const primaryFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: primaryCurrency,
  }).format(primaryAmount);

  let secondaryFormatted = '';
  if (showSecond) {
    secondaryFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: secondaryCurrency,
    }).format(secondaryAmount);
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <span className="font-medium">{primaryFormatted}</span>
      {showSecond && (
        <div className='text-xs text-zinc-500 pb-2'>
          <span>{secondaryFormatted}</span>
        </div>
      )}
    </div>
  );
}
