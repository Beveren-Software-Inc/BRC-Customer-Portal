"use client";

import React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Download,
  BarChart3,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { DashboardCharts } from "./dashboard-charts";
import { formatDate, getStatusColor } from "@/lib/utils";
import { useCurrency } from "@/context/currency-context";
import { DualCurrencyDisplay } from "@/components/ui/currency-display";
import { useApi } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { getMonthlySalesOrderStats, MonthlySalesOrderStat, getCustomerDashboardData } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import CustomerAging from "../sales-invoices/customer_ageing";
import CustomerBalanceCard from "./customer-balance-card";
// DebugSap removed per request

// Define types for our data structures
interface SummaryItem {
  title: string;
  value: number;
  count: string;
  icon: React.ReactNode;
  color: string;
  textColor: string;
  currency?: string;
}

interface Activity {
  id: string;
  date: string;
  type: string;
  status: string;
  amount: number;
  currency?: string;
}

export default function Dashboard() {
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // State for dashboard data with proper types
  const [summaryData, setSummaryData] = useState<SummaryItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Add state for chart time range and type
  const [salesTimeRange, setSalesTimeRangeRaw] = useState<
    "current" | "previous" | "ytd" | "3months" | "6months" | "12months"
  >("12months");
  const setSalesTimeRange = (v: string) => {
    setSalesTimeRangeRaw(v as "current" | "previous" | "ytd" | "3months" | "6months" | "12months");
  };
  const [salesChartType, setSalesChartType] = useState<"bar" | "line">("bar");

  // Map time range to months
  const timeRangeToMonths: Record<string, number> = {
    current: 1,
    previous: 1,
    ytd: new Date().getMonth() + 1,
    "3months": 3,
    "6months": 6,
    "12months": 12,
  };

  // Use React Query for monthly sales order stats
  const {
    data: salesStatsRaw = [],
    isLoading: salesStatsLoading,
    isError: salesStatsIsError,
    error: salesStatsErrorObj,
    refetch: refetchSalesStats,
  } = useQuery<MonthlySalesOrderStat[], Error>({
    queryKey: ["monthly-sales-order-stats", salesTimeRange],
    queryFn: () => getMonthlySalesOrderStats(timeRangeToMonths[salesTimeRange]),
    staleTime: 30000,
    refetchOnMount: true,
    retry: 2,
  });
  const salesStatsError = salesStatsIsError ? (salesStatsErrorObj?.message || "Failed to load stats") : null;

  // Define fields to fetch for each document type
  const salesOrderFields = [
    "name",
    "transaction_date",
    "grand_total",
    "currency",
    "status",
  ];

  const salesInvoiceFields = [
    "name",
    "posting_date",
    "grand_total",
    "outstanding_amount",
    "currency",
    "status",
    "is_return",
    "return_against",
  ];

  const quotationFields = [
    "name",
    "transaction_date",
    "grand_total",
    "currency",
    "status",
  ];

  const deliveryNoteFields = [
    "name",
    "posting_date",
    "status",
    "grand_total",
    "currency",
  ];

  // Fetch SAP dashboard data - this single call contains all needed data:
  // - Customer balance
  // - Invoices (recent 50)
  // - Orders (recent 50)
  // - Delivery notes (recent 50)
  // - Summary counts (unpaid, undelivered, unbilled)
  const {
    data: sapDashboardData,
    isLoading: sapDataLoading,
    isError: sapDataError,
    refetch: refetchSapData,
  } = useQuery({
    queryKey: ["sap-dashboard-data"],
    queryFn: getCustomerDashboardData,
    staleTime: 1000 * 60 * 60, // 60 minutes
    refetchOnMount: true,
    retry: 1, // Reduced retries for faster failure on timeout
    retryDelay: 2000, // 2 second delay between retries
    // Graceful degradation: return partial data even if query fails
    throwOnError: false, // Don't throw - allow partial rendering
  });

  // Extract SAP data from dashboard data using useMemo to prevent infinite loops
  const { salesOrders, invoices, deliveryNotes, quotations, ordersLoading, invoicesLoading, deliveriesLoading, quotationsLoading, ordersError, invoicesError, deliveriesError, quotationsError, refetchOrders, refetchInvoices, refetchDeliveries, refetchQuotations } = useMemo(() => {
    return {
      salesOrders: sapDashboardData?.orders || [],
      invoices: sapDashboardData?.invoices || [],
      deliveryNotes: sapDashboardData?.delivery_notes || [],
      quotations: [], // SAP doesn't provide quotations in dashboard data
      ordersLoading: sapDataLoading,
      invoicesLoading: sapDataLoading,
      deliveriesLoading: sapDataLoading,
      quotationsLoading: false, // No quotations from SAP
      ordersError: sapDataError,
      invoicesError: sapDataError,
      deliveriesError: sapDataError,
      quotationsError: false, // No quotations from SAP
      refetchOrders: refetchSapData,
      refetchInvoices: refetchSapData,
      refetchDeliveries: refetchSapData,
      refetchQuotations: () => Promise.resolve(), // No quotations to refetch
    };
  }, [sapDashboardData, sapDataLoading, sapDataError, refetchSapData]);

  // Build MonthlySalesOrderStat from SAP orders (fallback to API when SAP data missing)
  const salesStats: MonthlySalesOrderStat[] = useMemo(() => {
    try {
      const sourceOrders = Array.isArray(sapDashboardData?.orders) ? sapDashboardData.orders : [];
      if (!sourceOrders.length) {
        return Array.isArray(salesStatsRaw) ? salesStatsRaw : [];
      }

      const monthsToShowMap: Record<string, number> = {
        current: 1,
        previous: 1,
        ytd: new Date().getMonth() + 1,
        "3months": 3,
        "6months": 6,
        "12months": 12,
      };
      const monthsToShow = monthsToShowMap[salesTimeRange] ?? 12;

      // Determine base date
      let maxDate = new Date(0);
      sourceOrders.forEach((o: any) => {
        const ds = o.transaction_date || o.posting_date;
        if (!ds) return;
        const d = new Date(ds);
        if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
      });
      const now = new Date();
      const baseDate = maxDate > now ? maxDate : now;

      // Create buckets for required months (YYYY-MM)
      const buckets: Record<string, { month: string; order_amount: number; amount_paid: number; currency: string }>
        = {};
      for (let i = 0; i < monthsToShow; i++) {
        const dt = new Date(baseDate);
        dt.setMonth(dt.getMonth() - i, 1);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        buckets[key] = { month: key, order_amount: 0, amount_paid: 0, currency: 'SAR' };
      }

      // Lower bound date for range
      const rangeStart = new Date(baseDate);
      rangeStart.setMonth(rangeStart.getMonth() - (monthsToShow - 1), 1);

      // Aggregate
      sourceOrders.forEach((o: any) => {
        const ds = o.transaction_date || o.posting_date;
        if (!ds) return;
        const d = new Date(ds);
        if (isNaN(d.getTime())) return;
        if (d < rangeStart || d > baseDate) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!buckets[key]) return;
        
        buckets[key].order_amount += o.grand_total || 0;
        buckets[key].currency = o.currency || buckets[key].currency;
        
        // If order is Closed, it means fully delivered and invoiced, so count as paid
        if (o.status === 'Closed') {
          buckets[key].amount_paid += o.grand_total || 0;
        }
      });

      // To array and sort ascending by month
      const result = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
      return result;
    } catch (e) {
      return Array.isArray(salesStatsRaw) ? salesStatsRaw : [];
    }
  }, [sapDashboardData, salesTimeRange, salesStatsRaw]);

  // Determine overall loading state
  const loading =
    ordersLoading || invoicesLoading || quotationsLoading || deliveriesLoading;

  // Force refresh function for all data
  const refreshAllData = useCallback(() => {
    // Invalidate all queries to force a fresh fetch
    queryClient.invalidateQueries({ queryKey: ["Sales Order"] });
    queryClient.invalidateQueries({ queryKey: ["Sales Invoice"] });
    queryClient.invalidateQueries({ queryKey: ["Quotation"] });
    queryClient.invalidateQueries({ queryKey: ["Delivery Note"] });

    // Also trigger individual refetches
    Promise.all([
      refetchOrders(),
      refetchInvoices(),
      refetchQuotations(),
      refetchDeliveries(),
    ])
      .then(() => {})
      .catch((error) => {
        console.error("Error refreshing data:", error);
      });
  }, [
    queryClient,
    refetchOrders,
    refetchInvoices,
    refetchQuotations,
    refetchDeliveries,
  ]);

  // Function to handle viewing a document - Navigate to appropriate detail page
  const handleViewDocument = useCallback(
    (documentType: string, documentId: string) => {
      let path = "/";

      // Determine the path based on document type
      switch (documentType) {
        case "Sales Order":
          path = `/sales-orders/${documentId}`;
          break;
        case "Invoice":
          path = `/sales-invoices/${documentId}`;
          break;
        case "Quotation":
          path = `/quotations/${documentId}`;
          break;
        case "Delivery Note":
          path = `/delivery-notes/${documentId}`;
          break;
        default:
          console.warn(`Unknown document type: ${documentType}`);
          return; // Don't navigate if type is unknown
      }

      // Navigate to the document detail page
      window.location.href = path;
    },
    []
  );

  // Function to handle downloading a document as PDF
  const handleDownloadDocument = useCallback(
    (documentType: string, documentId: string) => {
      try {
        // Map the document type to its Frappe doctype
        let doctype = "";
        switch (documentType) {
          case "Sales Order":
            doctype = "Sales%20Order";
            break;
          case "Invoice":
            doctype = "Sales%20Invoice";
            break;
          case "Quotation":
            doctype = "Quotation";
            break;
          case "Delivery Note":
            doctype = "Delivery%20Note";
            break;
          default:
            console.warn(`Unknown document type for download: ${documentType}`);
            return; // Don't try to download if type is unknown
        }

        // Use Frappe's native print functionality
        // const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=${doctype}&name=${documentId}`;
        const url = `/printview?doctype=${doctype}&name=${documentId}&trigger_print=1`;

        // Open in a new tab
        window.open(url, "_blank");
      } catch (error) {
        console.error(
          `Download failed for ${documentType} ${documentId}:`,
          error
        );
      }
    },
    []
  );

  // Primitive keys to avoid effect thrashing on new array identities
  const sapDashboardOrdersLen = Array.isArray(sapDashboardData?.orders) ? sapDashboardData.orders.length : 0;
  const sapDashboardInvoicesLen = Array.isArray(sapDashboardData?.invoices) ? sapDashboardData.invoices.length : 0;
  const sapDashboardDeliveriesLen = Array.isArray(sapDashboardData?.delivery_notes) ? sapDashboardData.delivery_notes.length : 0;
  const erpOrdersLen = Array.isArray(salesOrders) ? salesOrders.length : 0;
  const erpInvoicesLen = Array.isArray(invoices) ? invoices.length : 0;
  const erpDeliveriesLen = Array.isArray(deliveryNotes) ? deliveryNotes.length : 0;
  const hasSapSummary = Boolean(sapDashboardData && sapDashboardData.summary);
  const hasSapData = Boolean(sapDashboardData);

  // Process dashboard data progressively as sources resolve; debounce with rAF
  useEffect(() => {
    let rafId: number | null = null;
    try {
      const run = () => {
        setError(null);

        // Use SAP dashboard data if available, otherwise fall back to ERPNext data
        // Graceful degradation: work with partial data if some fields are missing
        let processedData;
        if (sapDashboardData) {
          // Use SAP dashboard data (contains all needed data: invoices, orders, delivery_notes, summary)
          // Handle cases where some data might be missing due to partial failures/timeouts
          processedData = {
            invoices: sapDashboardData.invoices || [],
            salesOrders: sapDashboardData.orders || [],
            deliveryNotes: sapDashboardData.delivery_notes || [],
            quotations: [], // SAP doesn't provide quotations in this endpoint
            summary: sapDashboardData.summary || null
          };
        } else {
          // Fallback to ERPNext data only if SAP dashboard data is not available
          processedData = {
            invoices: invoices || [],
            salesOrders: salesOrders || [],
            deliveryNotes: deliveryNotes || [],
            quotations: quotations || [],
            summary: null
          };
        }

      // Process data based on source (SAP or ERPNext)
      let undeliveredOrders, unpaidInvoices, unpaidInvoicesTotal, unbilledDeliveries, unbilledDeliveriesTotal;
      
      if (processedData.summary) {
        // Use SAP summary data
        undeliveredOrders = processedData.summary.undelivered_orders || 0;
        unpaidInvoices = processedData.summary.unpaid_invoices || 0;
        unpaidInvoicesTotal = processedData.summary.unpaid_total || 0;
        unbilledDeliveries = processedData.summary.unbilled_deliveries || 0;
        unbilledDeliveriesTotal = processedData.summary.unbilled_total || 0;
      } else {
        // Process ERPNext data (fallback)
        // For SAP orders, treat status !== 'Closed' as undelivered/open
        undeliveredOrders = processedData.salesOrders.filter((order: any) => {
          const status = String(order.status || '').toLowerCase();
          return status === 'to deliver and bill' || status === 'open' || status === 'to deliver';
        });

        unpaidInvoices = processedData.invoices.filter(
          (invoice) => {
            // Include invoices that are 'Unpaid' or 'Overdue'
            const isUnpaidOrOverdue = invoice.status === "Unpaid" || invoice.status === "Overdue";
            
            // These will have negative outstanding amounts and should reduce the balance
            const isUnlinkedReturn = invoice.is_return && 
                                    !invoice.return_against && 
                                    invoice.outstanding_amount < 0;
            return isUnpaidOrOverdue || isUnlinkedReturn;
          }
        );

        unpaidInvoicesTotal = unpaidInvoices.reduce(
          (sum, inv) => {
            // For regular invoices, add the outstanding amount
            // For return invoices (negative outstanding amounts), they reduce the total
            return sum + (inv.outstanding_amount || inv.grand_total || 0);
          },
          0
        );

        unbilledDeliveries = processedData.deliveryNotes.filter(
          (delivery) => delivery.status === "To Bill"
        );

        unbilledDeliveriesTotal = unbilledDeliveries.reduce(
          (sum, delivery) => sum + (delivery.grand_total || 0),
          0
        );
      }

      // Create recent activities from all document types
      const recentInvoiceActivities = processedData.invoices.map((inv) => ({
        id: inv.name,
        date: inv.posting_date,
        type: "Invoice",
        status: inv.status,
        amount: inv.grand_total || 0,
        currency: inv.currency,
      }));

      const recentOrderActivities = processedData.salesOrders.map((order) => ({
        id: order.name,
        date: order.transaction_date || order.posting_date,
        type: "Sales Order",
        status: order.status,
        amount: order.grand_total || 0,
        currency: order.currency,
      }));

      const recentQuoteActivities = processedData.quotations.map((quote) => ({
        id: quote.name,
        date: quote.transaction_date,
        type: "Quotation",
        status: quote.status,
        amount: quote.grand_total || 0,
        currency: quote.currency,
      }));

      const recentDeliveryActivities = processedData.deliveryNotes.map((delivery) => ({
        id: delivery.name,
        date: delivery.posting_date,
        type: "Delivery Note",
        status: delivery.status,
        amount: delivery.grand_total || 0,
        currency: delivery.currency,
      }));

      // Combine and sort activities by date (newest first)
      const allActivities = [
        ...recentInvoiceActivities,
        ...recentOrderActivities,
        ...recentQuoteActivities,
        ...recentDeliveryActivities,
      ]
        .filter((activity) => activity.date) // Filter out activities with missing dates
        .sort((a, b) => {
          // Safely convert dates and compare
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            return 0;
          }
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5); // Get top 5 most recent

      // Format summary data with your requested cards
      const summary = [
        {
          title: "Open Orders",
          value: typeof undeliveredOrders === 'number' ? undeliveredOrders : undeliveredOrders.length,
          count: typeof undeliveredOrders === 'number' ? undeliveredOrders.toString() : undeliveredOrders.length.toString(),
          icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
          color: "bg-amber-100 dark:bg-amber-900",
          textColor: "text-amber-800 dark:text-amber-300",
        },
        {
          title: "Open Deliveries",
          value: unbilledDeliveriesTotal,
          count: typeof unbilledDeliveries === 'number' ? unbilledDeliveries.toString() : unbilledDeliveries.length.toString(),
          icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
          color: "bg-blue-100 dark:bg-blue-900",
          textColor: "text-blue-800 dark:text-blue-300",
          currency: "SAR",
        },
        {
          title: "Open Invoices",
          value: typeof processedData?.summary?.unreconciled_total === 'number' ? processedData.summary.unreconciled_total : unpaidInvoicesTotal,
          count: typeof processedData?.summary?.unreconciled_invoices === 'number' 
            ? String(processedData.summary.unreconciled_invoices) 
            : (typeof unpaidInvoices === 'number' ? unpaidInvoices.toString() : unpaidInvoices.length.toString()),
          icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />,
          color: "bg-red-100 dark:bg-red-900",
          textColor: "text-red-800 dark:text-red-300",
          currency: "SAR",
        },
        
      ];

        // Only update state if values actually changed to prevent re-render loops
        const summaryChanged = JSON.stringify(summaryData) !== JSON.stringify(summary);
        const activitiesChanged = JSON.stringify(recentActivities) !== JSON.stringify(allActivities);
        if (summaryChanged) {
          setSummaryData(summary);
        }
        if (activitiesChanged) {
          setRecentActivities(allActivities);
        }
      };
      rafId = window.requestAnimationFrame(run);
    } catch (err: unknown) {
      console.error("Error processing dashboard data:", err);
      // Properly handle unknown error type
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load dashboard data");
      }
    }
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [sapDashboardData, sapDashboardOrdersLen, sapDashboardInvoicesLen, sapDashboardDeliveriesLen, erpOrdersLen, erpInvoicesLen, erpDeliveriesLen, hasSapSummary, hasSapData, salesOrders, invoices, deliveryNotes, quotations]);

  // Separate effect to handle first load completion
  useEffect(() => {
    if (!loading && isFirstLoad) {
      setIsFirstLoad(false);
    }
  }, [loading]);

  // Handle any API errors
  useEffect(() => {
    if (ordersError || invoicesError || quotationsError || deliveriesError) {
      setError("Failed to fetch data from the server. Please try again later.");
    }
  }, [ordersError, invoicesError, quotationsError, deliveriesError]);

  // Special combined loading state (no longer blocks whole page)
  const isLoading = loading || isFirstLoad;

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-12 bg-red-50 rounded-lg border border-red-100">
        <AlertCircle className="h-16 w-16 text-red-500 mb-6" />
        <h3 className="text-xl font-semibold text-red-800 mb-2">
          {t('Dashboard Data Unavailable')}
        </h3>
        <p className="text-red-600 mb-6 text-center max-w-lg">
          {typeof error === "string" && error.includes("Failed to fetch")
            ? "We couldn't connect to the ERPNext system. This might be due to network issues or the server may be temporarily unavailable."
            : error}
        </p>
        <Button
          className="bg-red-600 hover:bg-red-700"
          onClick={refreshAllData}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('Refresh Dashboard')}
        </Button>
      </div>
    );
  }

  // Check if all summary card values are zero
  const hasNoSummaryData = summaryData.every(
    (item) =>
      (typeof item.value === "number" && item.value === 0) ||
      (typeof item.count === "string" && item.count === "0")
  );

  // Check if there's activity data
  const hasNoActivityData = recentActivities.length === 0;

  // Combined check for any data
  const hasNoData = hasNoSummaryData && hasNoActivityData;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Empty state for no data at all */}
      {/* {hasNoData && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="bg-yellow-50 p-5 rounded-full mb-6">
              <AlertTriangle className="h-12 w-12 text-yellow-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {t('No Dashboard Data')}
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-md mb-6">
              {t('There\'s currently no activity data available for your dashboard. This usually happens when your account is new or there haven\'t been any recent transactions.')}
            </p>
            <Button onClick={refreshAllData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('Refresh Dashboard')}
            </Button>
          </CardContent>
        </Card>
      )} */}

      {/* Debug components removed per request */}

      {/* Summary Cards Section including Customer Balance */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Customer Balance as a first card to align sizes */}
        <CustomerBalanceCard 
          customerBalance={sapDashboardData?.customer_info || null}
          loading={sapDataLoading}
        />
        {sapDataLoading && summaryData.length === 0 && (
          <>
            <Card className="border-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 w-32 bg-muted rounded" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-7 w-16 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </CardContent>
            </Card>
            <Card className="border-none hidden sm:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 w-32 bg-muted rounded" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-7 w-16 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </CardContent>
            </Card>
            <Card className="border-none hidden lg:block">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  <div className="h-4 w-32 bg-muted rounded" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-7 w-16 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </CardContent>
            </Card>
          </>
        )}
        {summaryData.map((item) => {
          // Determine click handler and navigation target
          let onClick: (() => void) | undefined = undefined;
          let clickable = false;
          if (item.title === "Open Orders") {
            onClick = () => navigate("/sales-orders", { state: { initialStatus: ["open"] } });
            clickable = true;
          } else if (item.title === "Open Deliveries") {
            onClick = () => navigate("/delivery-notes", { state: { initialStatus: ["open"] } });
            clickable = true;
          } else if (item.title === "Open Invoices") {
            onClick = () => navigate("/sales-invoices", { state: { initialStatus: ["open"] } });
            clickable = true;
          }
          return (
            <Card
              key={item.title}
              className={`${item.color} border-none ${clickable ? 'cursor-pointer hover:shadow-lg transition' : ''}`}
              onClick={clickable && onClick ? onClick : undefined}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? 'button' : undefined}
              aria-label={clickable ? `View ${item.title}` : undefined}
              onKeyDown={clickable && onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { onClick(); } } : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium ${item.textColor}`}>{t(item.title)}</CardTitle>
                {item.icon}
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${item.textColor}`}>
                  {item.title === "Open Invoices" || item.title === "Open Deliveries" ? (
                    <DualCurrencyDisplay amount={item.value} currency={item.currency || currency || "SAR"} />
                  ) : (
                    item.value.toString()
                  )}
                </div>
                <p className={`text-xs ${item.textColor} opacity-80`}>
                  {item.count} {item.count === "1" ? t(item.title.toLowerCase().replace(/s$/, "")) : t(item.title.toLowerCase())}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts section - Only show if there's activity data */}
      {!hasNoActivityData && (
        <Card>
          <CardHeader>
            <CardTitle>{t('Analytics Dashboard')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <DashboardCharts
              salesStats={salesStats}
              salesStatsLoading={salesStatsLoading}
              salesStatsError={salesStatsError}
              salesTimeRange={salesTimeRange}
              setSalesTimeRange={setSalesTimeRange}
              salesChartType={salesChartType}
              setSalesChartType={setSalesChartType}
              invoices={invoices}
              invoicesLoading={invoicesLoading as any}
              invoicesError={invoicesError as any}
            />
          </CardContent>
        </Card>

      )}

       <Card>
          <CardHeader>
            <CardTitle>{t('Customer Ageing')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <CustomerAging />
          </CardContent>
        </Card>

      
      {/* Recent Activities section */}
      <Card>
        <CardHeader>
          <CardTitle>{t('Recent Activities')}</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {recentActivities.length > 0 ? (
            <>
              {/* Mobile card view - shown on small screens only */}
              <div className="block sm:hidden">
                {recentActivities.map((activity, index) => (
                  <div
                    key={`mobile-${activity.id}-${index}`}
                    className="p-4 border-b last:border-b-0"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        {(() => {
                          let docPath = "#";
                          switch (activity.type) {
                            case "Sales Order":
                              docPath = `/sales-orders/${activity.id}`;
                              break;
                            case "Invoice":
                              docPath = `/sales-invoices/${activity.id}`;
                              break;
                            case "Quotation":
                              docPath = `/quotations/${activity.id}`;
                              break;
                            case "Delivery Note":
                              docPath = `/delivery-notes/${activity.id}`;
                              break;
                          }
                          return (
                            <div className="font-medium">
                              <Link to={docPath} className="text-blue-600 hover:underline">
                                {activity.id}
                              </Link>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {formatDate(activity.date)}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-between items-center">
                      <div className="text-xs py-1 px-2 rounded-full bg-muted">
                        {activity.type}
                      </div>
                      <div className="text-sm font-medium">
                        <DualCurrencyDisplay amount={activity.amount} currency={activity.currency || "SAR"} />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleViewDocument(activity.type, activity.id)
                        }
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        {t('View')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadDocument(activity.type, activity.id)
                        }
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {t('Download')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view - hidden on mobile */}
              <div className="hidden sm:block overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Date')}</TableHead>
                      <TableHead>{t('Document ID')}</TableHead>
                      <TableHead>{t('Type')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead className="text-right">{t('Amount')}</TableHead>
                      <TableHead className="text-right">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivities.map((activity, index) => (
                      <TableRow key={`${activity.id}-${index}`}> 
                        <TableCell>{formatDate(activity.date)}</TableCell>
                        <TableCell>
                          {(() => {
                            let docPath = "#";
                            switch (activity.type) {
                              case "Sales Order":
                                docPath = `/sales-orders/${activity.id}`;
                                break;
                              case "Invoice":
                                docPath = `/sales-invoices/${activity.id}`;
                                break;
                              case "Quotation":
                                docPath = `/quotations/${activity.id}`;
                                break;
                              case "Delivery Note":
                                docPath = `/delivery-notes/${activity.id}`;
                                break;
                            }
                            return (
                              <Link to={docPath} className="text-blue-600 hover:underline">
                                {activity.id}
                              </Link>
                            );
                          })()}
                        </TableCell>
                        <TableCell>{activity.type}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(activity.status)}>
                            {activity.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Only show backend currency */}
                          <span className="text-sm font-medium">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: activity.currency || "SAR",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(activity.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDocument(activity.type, activity.id)}
                              title={`${t('View')} ${activity.type}`}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">{t('View')}</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadDocument(activity.type, activity.id)}
                              title={`${t('Download')} ${activity.type} PDF`}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only">{t('Download')}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="bg-blue-50 p-5 rounded-full mb-4">
                <Clock className="h-12 w-12 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('No Recent Activity')}
              </h3>
              <p className="text-sm text-gray-500 text-center max-w-md mb-6">
                {t('There hasn\'t been any recent activity in your account. Your latest transactions, orders, quotes, and deliveries will appear here as they occur.')}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={refreshAllData}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('Refresh')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
