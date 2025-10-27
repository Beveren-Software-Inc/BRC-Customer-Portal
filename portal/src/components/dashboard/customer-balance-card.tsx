import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { useCurrency } from "@/context/currency-context";

interface CustomerBalanceCardProps {
  customerBalance: {
    customer_code: string;
    customer_name: string;
    current_balance: number;
    credit_limit: number;
    balance: number;
    balance_fc: number;
  } | null;
  loading?: boolean;
}

export default function CustomerBalanceCard({ customerBalance, loading }: CustomerBalanceCardProps) {
  const { currency } = useCurrency();
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Customer Balance</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-1"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!customerBalance) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Customer Balance</CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Unable to load balance</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { current_balance, customer_name, customer_code } = customerBalance;
  const displayCurrency = (customerBalance as any)?.currency || currency || 'SAR';
  console.log("Display Currency:", displayCurrency);
  // Calculate balance status
  const balanceStatus = current_balance > 0 ? 'positive' : current_balance < 0 ? 'negative' : 'zero';
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Customer Balance</CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Customer Info */}
          {/* <div className="text-xs text-muted-foreground">
            <p className="font-medium">{customer_name}</p>
          </div> */}
          
          {/* Current Balance */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              {/* <span className="text-sm font-medium">Current Balance</span> */}
              <div className="flex items-center space-x-1">
                {balanceStatus === 'positive' && <TrendingUp className="h-3 w-3 text-green-500" />}
                {balanceStatus === 'negative' && <TrendingDown className="h-3 w-3 text-red-500" />}
                <span className={`text-lg font-bold ${
                  balanceStatus === 'positive' ? 'text-green-600' : 
                  balanceStatus === 'negative' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {formatCurrency(current_balance)}
                </span>
              </div>
            </div>
            
            {/* Balance Status Badge */}
            <div className="flex justify-end">
              <Badge 
                variant={balanceStatus === 'positive' ? 'default' : balanceStatus === 'negative' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {balanceStatus === 'positive' ? 'Credit' : balanceStatus === 'negative' ? 'Debit' : 'Zero Balance'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
