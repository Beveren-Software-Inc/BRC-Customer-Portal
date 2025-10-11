"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  LineChartIcon,
  PieChartIcon,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useCurrencySettings } from "@/context/currency-context";
import type { MonthlySalesOrderStat } from "@/lib/api";
import { useTranslation } from "react-i18next";

// -----------------------------
// Helper Types
// -----------------------------
interface MonthData {
  monthKey: string;
  monthName: string;
  year: number;
  month: number | string;
  total: number;
  orders: number;
  currency: string;
}

interface MonthStats {
  month: string;
  order_amount: number;
  amount_paid: number;
  currency: string;
}

// -----------------------------
// Currency Formatting Helpers
// -----------------------------
const formatDualCurrency = (value: number, primaryCurrency: string = "SAR") => {
  const exchangeRate = 3.75;
  if (primaryCurrency === "USD") {
    const sarValue = value * exchangeRate;
    return {
      primary: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value),
      secondary: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "SAR",
      }).format(sarValue),
      raw: value,
      secondaryRaw: sarValue,
    };
  } else {
    const usdValue = value / exchangeRate;
    return {
      primary: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "SAR",
      }).format(value),
      secondary: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(usdValue),
      raw: value,
      secondaryRaw: usdValue,
    };
  }
};

const formatTooltipCurrency = (
  value: number,
  primaryCurrency: string = "SAR",
  showSecond: boolean = false,
  secondCurrency: string = "USD",
  exchangeRate: number = 3.75
) => {
  if (typeof value !== "number") return value;
  let primaryFormatted: string, secondaryFormatted: string;
  if (primaryCurrency === secondCurrency) {
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: primaryCurrency,
    }).format(value);
    secondaryFormatted = "";
  } else if (primaryCurrency === "USD" && secondCurrency === "SAR") {
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
    secondaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
    }).format(value * exchangeRate);
  } else if (primaryCurrency === "SAR" && secondCurrency === "USD") {
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
    }).format(value);
    secondaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value / exchangeRate);
  } else {
    // fallback
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: primaryCurrency,
    }).format(value);
    secondaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: secondCurrency,
    }).format(primaryCurrency === "USD" ? value * exchangeRate : value / exchangeRate);
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        minWidth: "120px",
      }}
    >
      <span style={{ fontWeight: "bold" }}>{primaryFormatted}</span>
      {showSecond && secondaryFormatted && (
        <span style={{ fontSize: "11px", color: "#71717a" }}>{secondaryFormatted}</span>
      )}
    </div>
  );
};

// -----------------------------
// Custom Tooltip Components
// -----------------------------
const CustomSalesTooltip = ({ active, payload, label, allowSecondCurrency, secondCurrency, exchangeRate }: any) => {
  if (!active || !payload || !payload.length) return null;
  const displayedEntries = new Set();
  return (
    <div
      className="custom-tooltip bg-background border border-border rounded-md shadow-md p-3"
      style={{ minWidth: "220px" }}
    >
      <p className="font-medium mb-2">{`Month: ${label}`}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          if (displayedEntries.has(entry.name)) return null;
          displayedEntries.add(entry.name);
          return (
            <div key={`item-${index}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span
                    className="inline-block w-3 h-3 rounded-sm mr-2"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">{entry.name}:</span>
                </div>
                <span className="font-medium ml-4">
                  {entry.name === "Order Count"
                    ? entry.value.toLocaleString()
                    : formatTooltipCurrency(entry.value, "SAR", allowSecondCurrency, secondCurrency, exchangeRate)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CustomInvoiceTooltip = ({ active, payload, allowSecondCurrency, secondCurrency, exchangeRate }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  const total = data.payload?.total || 0;
  const value = data.value || 0;
  let percentValue = 0;
  if (total > 0) {
    percentValue = (value / total) * 100;
  } else if (typeof data.percent === "number" && !isNaN(data.percent)) {
    percentValue = data.percent * 100;
  }
  const percentage = percentValue.toFixed(1);
  return (
    <div
      className="custom-tooltip bg-background border border-border rounded-md shadow-md p-3"
      style={{ minWidth: "200px" }}
    >
      <div className="flex items-center mb-2">
        <span
          className="inline-block w-3 h-3 rounded-sm mr-2"
          style={{ backgroundColor: data.payload.color }}
        />
        <p className="font-medium">{data.name}</p>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Amount:</span>
          <span className="font-medium">
            {formatTooltipCurrency(data.value, "SAR", allowSecondCurrency, secondCurrency, exchangeRate)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Percentage:</span>
          <span className="font-medium">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};

// Add fetcher for Frappe whitelisted function
async function fetchMonthlySalesOrderStats(params: { months: number }) {
  // Get CSRF token from global variable (set by Frappe template)
  const csrfToken = (window as any).csrf_token;
  
  const headers: Record<string, string> = { 
    "Content-Type": "application/json" 
  };
  
  if (csrfToken) {
    headers['X-Frappe-CSRF-Token'] = csrfToken;
  }
  
  const res = await fetch("/api/method/customer_portal.utils.get_monthly_sales_order_stats", {
    method: "POST",
    headers,
    credentials: "include", // Include cookies for authentication
    body: JSON.stringify(params),
  });
  console.log("Maniac:", params);
  const data = await res.json();
  if (data.message) return data.message;
  if (data.result) return data.result;
  throw new Error(data._server_messages || "Failed to fetch stats");
}

export interface DashboardChartsProps {
  salesStats: MonthlySalesOrderStat[];
  salesStatsLoading: boolean;
  salesStatsError: string | null;
  salesTimeRange: string;
  setSalesTimeRange: (v: string) => void;
  salesChartType: "bar" | "line";
  setSalesChartType: (v: "bar" | "line") => void;
}

// Add a helper to format YYYY-MM to 'Mon YY'
function formatMonthLabel(month: string) {
  if (!month) return month;
  const [year, m] = month.split("-");
  if (!year || !m) return month;
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleString("default", { month: "short" }) + " '" + year.slice(-2);
}

export function DashboardCharts({
  salesStats,
  salesStatsLoading,
  salesStatsError,
  salesTimeRange,
  setSalesTimeRange,
  salesChartType,
  setSalesChartType,
}: DashboardChartsProps) {
  // Chart filter states.
  const [invoiceTimeRange, setInvoiceTimeRange] = useState<
    "current" | "previous" | "ytd" | "3months" | "6months" | "12months"
  >("12months");

  // Processed chart data states.
  const [salesData, setSalesData] = useState<MonthData[]>([]);
  const [invoiceData, setInvoiceData] = useState<Record<string, any[]>>({
    current: [],
    previous: [],
    ytd: [],
  });

  // Define fields to fetch for each document type
  const salesOrderFields = [
    "name",
    "grand_total",
    "transaction_date",
    "currency",
    "status",
  ];

  const salesInvoiceFields = [
    "name",
    "grand_total",
    "posting_date",
    "currency",
    "status",
    "items", // Explicitly include items field for Purchase History chart
  ];

  // Use SAP data from dashboard instead of ERPNext
  const orders = salesStats || []; // Use sales stats data for orders
  const invoices: any[] = []; // No invoice data from SAP in charts for now
  
  // Set loading and error states
  const ordersLoading = salesStatsLoading;
  const invoicesLoading = false; // No invoice data loading
  const ordersError = salesStatsError;
  const invoicesError = null; // No invoice data errors

  // Loading and error states
  const chartsLoading = {
    sales: ordersLoading,
    invoice: invoicesLoading,
  };

  const chartsError = {
    sales: ordersError ? "Failed to load sales data" : null,
    invoice: invoicesError ? "Failed to load invoice data" : null,
  };

  const { allowSecondCurrency, secondCurrency, exchangeRate } = useCurrencySettings();

  // Map time range to months
  const timeRangeToMonths: Record<string, number> = {
    current: 1,
    previous: 1,
    ytd: new Date().getMonth() + 1,
    "3months": 3,
    "6months": 6,
    "12months": 12,
  };

  // -----------------------------
  // Process Sales Orders Data
  // -----------------------------
  const processSalesData = useCallback(
    (orderData: any[], timeRange: string) => {
      try {
        let monthsToShow: number;
        let dateFilter: ((order: any) => boolean) | null = null;

        // Handle different time ranges
        switch (timeRange) {
          case "current":
            monthsToShow = 1;
            dateFilter = (order) => {
              if (!order.transaction_date) return false;
              const orderDate = new Date(order.transaction_date);
              if (isNaN(orderDate.getTime())) return false;
              const today = new Date();
              return (
                orderDate.getMonth() === today.getMonth() &&
                orderDate.getFullYear() === today.getFullYear()
              );
            };
            break;
          case "previous":
            monthsToShow = 1;
            dateFilter = (order) => {
              if (!order.transaction_date) return false;
              const orderDate = new Date(order.transaction_date);
              if (isNaN(orderDate.getTime())) return false;
              const today = new Date();
              const prevMonth =
                today.getMonth() === 0 ? 11 : today.getMonth() - 1;
              const prevYear =
                today.getMonth() === 0
                  ? today.getFullYear() - 1
                  : today.getFullYear();
              return (
                orderDate.getMonth() === prevMonth &&
                orderDate.getFullYear() === prevYear
              );
            };
            break;
          case "ytd":
            const today = new Date();
            monthsToShow = today.getMonth() + 1; // From January to current month
            dateFilter = (order) => {
              if (!order.transaction_date) return false;
              const orderDate = new Date(order.transaction_date);
              if (isNaN(orderDate.getTime())) return false;
              return orderDate.getFullYear() === today.getFullYear();
            };
            break;
          case "3months":
            monthsToShow = 3;
            break;
          case "6months":
            monthsToShow = 6;
            break;
          case "12months":
          case "fullYear":
            monthsToShow = 12;
            break;
          default:
            monthsToShow = 6;
        }

        // Filter orders based on time range if dateFilter is set
        let filteredOrderData = orderData;
        if (dateFilter) {
          filteredOrderData = orderData.filter(dateFilter);
        } else {
          // For relative periods (3months, 6months, 12months), filter by date range
          const today = new Date();
          const monthsAgo = new Date();
          monthsAgo.setMonth(today.getMonth() - monthsToShow);
          filteredOrderData = orderData.filter((order) => {
            if (!order.transaction_date) return false;
            const orderDate = new Date(order.transaction_date);
            if (isNaN(orderDate.getTime())) return false;
            return orderDate >= monthsAgo && orderDate <= today;
          });
        }

        // Use a safer approach with Date type
        let maxDate = new Date(0); // Initialize to Unix epoch

        filteredOrderData.forEach((order) => {
          const dateStr = order.transaction_date;
          if (!dateStr) return;
          const orderDate = new Date(dateStr);
          if (!isNaN(orderDate.getTime()) && orderDate > maxDate) {
            maxDate = orderDate;
          }
        });

        const now = new Date();
        // Initialize baseDate to now
        let baseDate = now;
        // If maxDate was found and is later than now, use maxDate
        if (maxDate > now) {
          baseDate = maxDate;
        }

        let monthsData: MonthData[] = [];
        const monthMap: Record<string, MonthData> = {};

        // Create month buckets counting backwards from the base date.
        for (let i = 0; i < monthsToShow; i++) {
          const date = new Date(baseDate);
          date.setMonth(date.getMonth() - i);
          date.setDate(1);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
          const entry: MonthData = {
            monthKey,
            monthName: date.toLocaleString("default", { month: "short" }),
            year: date.getFullYear(),
            month: date.getMonth(),
            total: 0,
            orders: 0,
            currency: "SAR",
          };
          monthsData.push(entry);
          monthMap[monthKey] = entry;
        }

        // Sort buckets in chronological order (oldest first).
        monthsData.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return typeof a.month === "number" && typeof b.month === "number"
            ? a.month - b.month
            : 0;
        });

        // Process each order.
        if (Array.isArray(filteredOrderData) && filteredOrderData.length > 0) {
          filteredOrderData.forEach((order) => {
            const dateStr = order.transaction_date;
            if (!dateStr) return;
            const orderDate = new Date(dateStr);
            const monthKey = `${orderDate.getFullYear()}-${(
              orderDate.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}`;
            if (monthMap[monthKey]) {
              monthMap[monthKey].total += order.grand_total || 0;
              monthMap[monthKey].orders += 1;
              monthMap[monthKey].currency = order.currency || "SAR";
            } else {
              console.log()
            }
          });
        }

        // Adjust bucket labels if the range spans multiple years.
        const hasMultipleYears =
          new Set(monthsData.map((m) => m.year)).size > 1;
        monthsData = monthsData.map((m) => ({
          ...m,
          month: hasMultipleYears ? `${m.monthName} ${m.year}` : m.monthName,
        }));

        setSalesData(monthsData);
      } catch (error) {
        console.error("Error processing sales orders data:", error);
      }
    },
    []
  );

  // -----------------------------
  // Process Invoice, Product, Delivery Data (wrapped in useCallback)
  // -----------------------------
  const processInvoiceData = useCallback((invoiceData: any[]) => {
    try {
      const periods: Record<string, (invoice: any) => boolean> = {
        current: (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          return (
            invDate.getMonth() === today.getMonth() &&
            invDate.getFullYear() === today.getFullYear()
          );
        },
        previous: (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          const prevMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1;
          const prevYear =
            today.getMonth() === 0
              ? today.getFullYear() - 1
              : today.getFullYear();
          return (
            invDate.getMonth() === prevMonth &&
            invDate.getFullYear() === prevYear
          );
        },
        ytd: (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          return invDate.getFullYear() === today.getFullYear();
        },
        "3months": (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(today.getMonth() - 3);
          return invDate >= threeMonthsAgo && invDate <= today;
        },
        "6months": (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(today.getMonth() - 6);
          return invDate >= sixMonthsAgo && invDate <= today;
        },
        "12months": (invoice) => {
          if (!invoice.posting_date) return false;
          const invDate = new Date(invoice.posting_date);
          if (isNaN(invDate.getTime())) return false;
          const today = new Date();
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(today.getMonth() - 12);
          return invDate >= twelveMonthsAgo && invDate <= today;
        },
      };

      const colorMap: Record<string, string> = {
        Paid: "#10b981",
        Unpaid: "#f59e0b",
        Overdue: "#ef4444",
        Cancelled: "#6b7280",
        Draft: "#6366f1",
        Return: "#8b5cf6",
        Submitted: "#3b82f6",
      };

      const processedData: Record<string, any[]> = {};

      Object.entries(periods).forEach(([period, filterFn]) => {
        const filteredInvoices = invoiceData.filter(filterFn);

        if (filteredInvoices.length === 0) {
          processedData[period] = [];
          return;
        }

        const statusGroups: Record<string, number> = {};
        filteredInvoices.forEach((invoice) => {
          if (!invoice.status) return; // Skip invoices without status
          if (!statusGroups[invoice.status]) {
            statusGroups[invoice.status] = 0;
          }
          statusGroups[invoice.status] += invoice.grand_total || 0;
        });

        const totalAmount = Object.values(statusGroups).reduce(
          (sum, value) => sum + value,
          0
        );

        if (totalAmount === 0) {
          processedData[period] = [];
          return;
        }

        processedData[period] = Object.entries(statusGroups).map(
          ([status, value]) => ({
            name: status,
            value,
            percentage: (value / totalAmount) * 100,
            total: totalAmount,
            color: colorMap[status] || "#94a3b8",
          })
        );
      });

      setInvoiceData(processedData);
    } catch (error) {
      console.error("Error processing invoice status data:", error);
      // Set default empty data in case of error
      setInvoiceData({
        current: [],
        previous: [],
        ytd: [],
        "3months": [],
        "6months": [],
        "12months": [],
      });
    }
  }, []);

  // -----------------------------
  // useEffect hooks to trigger data processing
  // -----------------------------
  useEffect(() => {
    if (orders && orders.length > 0) {
      processSalesData(orders, salesTimeRange);
    }
  }, [orders, salesTimeRange, processSalesData]);

  useEffect(() => {
    if (invoices && invoices.length > 0) {
      processInvoiceData(invoices);
    }
  }, [invoices, processInvoiceData]);

  const handleInvoiceTimeRangeChange = (value: string) => {
    setInvoiceTimeRange(value as any);
  };

  const ChartLoading = () => (
    <div className="h-[300px] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  const ChartError = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div className="h-[300px] flex flex-col items-center justify-center text-red-500">
      <p className="mb-4">Error: {message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" /> Retry
      </Button>
    </div>
  );

  const refreshChartData = async (chartType: string) => {
    switch (chartType) {
      case "sales":
        refetchOrders();
        break;
      case "invoice":
        refetchInvoices();
        break;
    }
  };

  // Custom tooltip for new chart
  const CustomPaidTooltip = ({ active, payload, label, allowSecondCurrency, secondCurrency, exchangeRate }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="custom-tooltip bg-background border border-border rounded-md shadow-md p-3" style={{ minWidth: "220px" }}>
        <p className="font-medium mb-2">{`Month: ${label}`}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="inline-block w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm">{entry.name}:</span>
                </div>
                <span className="font-medium ml-4">
                  {formatTooltipCurrency(entry.value, "SAR", allowSecondCurrency, secondCurrency, exchangeRate)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Monthly Sales Orders Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base">{t('Monthly Sales Orders')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={salesTimeRange}
                onValueChange={setSalesTimeRange}
                defaultValue="12months"
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue placeholder={t("Time range")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12months">{t('Last 12 Months')}</SelectItem>
                  <SelectItem value="6months">{t('Last 6 Months')}</SelectItem>
                  <SelectItem value="3months">{t('Last 3 Months')}</SelectItem>
                  <SelectItem value="ytd">{t('Year to Date')}</SelectItem>
                  <SelectItem value="current">{t('Current Month')}</SelectItem>
                  <SelectItem value="previous">{t('Previous Month')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button
                  variant={salesChartType === "bar" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-l-md"
                  onClick={() => setSalesChartType("bar")}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="sr-only">Bar Chart</span>
                </Button>
                <Button
                  variant={salesChartType === "line" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-r-md"
                  onClick={() => setSalesChartType("line")}
                >
                  <LineChartIcon className="h-4 w-4" />
                  <span className="sr-only">Line Chart</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {salesStatsLoading ? (
            <ChartLoading />
          ) : salesStatsError ? (
            <ChartError message={salesStatsError} onRetry={() => {}} />
          ) : (
            <div className="h-[300px]">
              <div className="sr-only">
                {`Time Range: ${salesTimeRange}, Data Points: ${salesStats.length}`}
              </div>
              <ResponsiveContainer width="100%" height="100%" key={`sales-chart-${salesTimeRange}-${salesChartType}-${salesStats.length}`}>
                {salesChartType === "bar" ? (
                  <BarChart data={salesStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatMonthLabel} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", notation: "compact", maximumFractionDigits: 1, }).format(value)} />
                    <Tooltip content={<CustomPaidTooltip allowSecondCurrency={allowSecondCurrency} secondCurrency={secondCurrency} exchangeRate={exchangeRate} />} />
                    <Legend />
                    <Bar name="Order Amount" dataKey="order_amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar name="Paid Amount" dataKey="amount_paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={salesStats} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatMonthLabel} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => { const { primary } = formatDualCurrency(value, "SAR"); return primary; }} />
                    <Tooltip content={<CustomPaidTooltip allowSecondCurrency={allowSecondCurrency} secondCurrency={secondCurrency} exchangeRate={exchangeRate} />} />
                    <Legend />
                    <Line type="monotone" name="Order Amount" dataKey="order_amount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" name="Paid Amount" dataKey="amount_paid" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Status Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base">{t('Invoice Status')}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={invoiceTimeRange}
                onValueChange={handleInvoiceTimeRangeChange}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue placeholder={t("Period")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12months">{t('Last 12 Months')}</SelectItem>
                  <SelectItem value="6months">{t('Last 6 Months')}</SelectItem>
                  <SelectItem value="3months">{t('Last 3 Months')}</SelectItem>
                  <SelectItem value="ytd">{t('Year to Date')}</SelectItem>
                  <SelectItem value="current">{t('Current Month')}</SelectItem>
                  <SelectItem value="previous">{t('Previous Month')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refreshChartData("invoice")}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartsLoading.invoice ? (
            <ChartLoading />
          ) : chartsError.invoice ? (
            <ChartError
              message={chartsError.invoice}
              onRetry={() => refreshChartData("invoice")}
            />
          ) : (
            <div className="h-[300px]">
              {!invoiceData[invoiceTimeRange] ||
              invoiceData[invoiceTimeRange].length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      No invoice data available for {invoiceTimeRange} period
                    </p>
                    {/* <p className="text-xs mt-1">Debug: {JSON.stringify(invoiceData)}</p> */}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={invoiceData[invoiceTimeRange] || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }: any) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {(invoiceData[invoiceTimeRange] || []).map(
                        (entry, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )
                      )}
                    </Pie>
                    <Tooltip content={<CustomInvoiceTooltip allowSecondCurrency={allowSecondCurrency} secondCurrency={secondCurrency} exchangeRate={exchangeRate} />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase History Chart */}
      {/* <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base">Your Purchase History</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={productTimeRange}
                onValueChange={handleProductTimeRangeChange}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  <SelectItem value="previous">Previous Month</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button
                  variant={productChartType === "pie" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-l-md"
                  onClick={() => setProductChartType("pie")}
                >
                  <PieChartIcon className="h-4 w-4" />
                  <span className="sr-only">Pie Chart</span>
                </Button>
                <Button
                  variant={productChartType === "bar" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-r-md"
                  onClick={() => setProductChartType("bar")}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="sr-only">Bar Chart</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartsLoading.product ? (
            <ChartLoading />
          ) : chartsError.product ? (
            <ChartError
              message={chartsError.product}
              onRetry={() => refreshChartData("product")}
            />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {productChartType === "pie" ? (
                  <PieChart>
                    <Pie
                      data={productCategoryData[productTimeRange] || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }: any) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {(productCategoryData[productTimeRange] || []).map(
                        (entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )
                      )}
                    </Pie>
                    <Tooltip content={<CustomProductTooltip />} />
                    <Legend />
                  </PieChart>
                ) : (
                  <BarChart
                    data={productCategoryData[productTimeRange] || []}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => {
                        const { primary } = formatDualCurrency(value, "SAR");
                        return primary;
                      }}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip content={<CustomProductTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {(productCategoryData[productTimeRange] || []).map(
                        (entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        )
                      )}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* Delivery Performance Chart */}
      {/* <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <CardTitle className="text-base">Delivery Performance</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select
                value={deliveryTimeRange}
                onValueChange={handleDeliveryTimeRangeChange}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">{t('3 Months')}</SelectItem>
                  <SelectItem value="6months">{t('6 Months')}</SelectItem>
                  <SelectItem value="12months">{t('12 Months')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button
                  variant={deliveryChartType === "bar" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-l-md"
                  onClick={() => setDeliveryChartType("bar")}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="sr-only">Bar Chart</span>
                </Button>
                <Button
                  variant={deliveryChartType === "line" ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8 rounded-none rounded-r-md"
                  onClick={() => setDeliveryChartType("line")}
                >
                  <LineChartIcon className="h-4 w-4" />
                  <span className="sr-only">Line Chart</span>
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartsLoading.delivery ? (
            <ChartLoading />
          ) : chartsError.delivery ? (
            <ChartError
              message={chartsError.delivery}
              onRetry={() => refreshChartData("delivery")}
            />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                {deliveryChartType === "bar" ? (
                  <BarChart
                    data={deliveryPerformanceData[deliveryTimeRange] || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomDeliveryTooltip />} />
                    <Legend />
                    <Bar
                      name="On Time"
                      dataKey="onTime"
                      stackId="a"
                      fill="#10b981"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      name="Delayed"
                      dataKey="delayed"
                      stackId="a"
                      fill="#ef4444"
                      radius={[0, 0, 0, 0]}
                    />
                  </BarChart>
                ) : (
                  <LineChart
                    data={deliveryPerformanceData[deliveryTimeRange] || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomDeliveryTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      name="On Time"
                      dataKey="onTime"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      name="Delayed"
                      dataKey="delayed"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card> */}
    </div>
  );
}
