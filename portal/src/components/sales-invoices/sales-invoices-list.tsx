"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Download, Search, Receipt, RefreshCw } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { DataTablePagination } from "../ui/data-table-pagination";
import { SalesInvoice, getSapInvoices } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DualCurrencyDisplay } from "@/components/ui/currency-display";
import { toast } from "@/components/ui/use-toast";
import InvoicePrintPreviewDialog from "@/components/print/invoice-print-preview-dialog";
import { useTranslation } from "react-i18next";
import { MultiSelectDropdown } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import CustomerAging from "@/components/sales-invoices/customer_ageing";

export default function InvoicesList() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<
    string | null
  >(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  // Fetch Invoices from SAP using React Query for proper caching
  const {
    data: invoices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SalesInvoice[], Error>({
    queryKey: ["sap-invoices"],
    queryFn: getSapInvoices,
    staleTime: 1000 * 60 * 60, // 60 minutes
    refetchOnMount: true,
    retry: 2,
  });
  
  if (isError) {
    console.error("Failed to fetch invoices:", error);
    toast({
      variant: "destructive",
      title: "Error Loading Invoices",
      description:
        error?.message || "Could not load invoice data. Please try again later.",
    });
  }

  const handleRefresh = async () => {
    try {
      // Clear cache first to ensure fresh SAP data
      await fetch('/api/method/sap_customer_portal.api.customer_balance.clear_customer_cache');
      console.log("Cache cleared successfully");
      
      // Refetch data
      await refetch();
      
      toast({
        title: t("Refreshing Invoices"),
        description: "Fetching the latest invoices from SAP...",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to refresh invoices:", error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh invoices. Please try again.",
      });
    }
  };

  // Parse status from query string on mount
  useEffect(() => {
    if (location.state && Array.isArray(location.state.initialStatus)) {
      setStatusFilter(location.state.initialStatus.join(","));
    }
  }, [location.state]);

  // Support comma-separated status filter
  const statusFilterArray = statusFilter === "all" ? [] : statusFilter.split(",").map(s => s.trim().toLowerCase());

  const filteredData = (invoices || []).filter((invoice) => {
    if (!invoice) return false;
    const matchesSearch =
      String(invoice.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(invoice.customer || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      statusFilterArray.includes(String(invoice.status || '').toLowerCase());
    return matchesSearch && matchesStatus;
  });

  console.log("Invoices List Debug:", {
    isLoading,
    invoices: invoices.length,
    filteredData: filteredData.length,
    searchTerm,
    statusFilter,
    error: error?.message
  });

  const sortedData = filteredData.sort((a, b) => {
  return new Date(b.posting_date).getTime() - new Date(a.posting_date).getTime();
});

  const paginatedData = sortedData.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const downloadInvoicePDF = (invoiceId: string) => {
    try {
      // Use Frappe's native print functionality
      // const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Invoice&name=${invoiceId}`;
      const url = `/printview?doctype=Sales%20Invoice&name=${invoiceId}&trigger_print=1`;

      // Open in a new tab
      window.open(url, "_blank");

      toast({
        title: "Print View Opened",
        description: "The PDF document opened in a new tab",
        duration: 3000,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        variant: "destructive",
        title: "Print Failed",
        description:
          "There was a problem opening the print view. Please try again.",
        duration: 5000,
      });
    }
  };

  // Status options for sales invoices (matching SAP B1 statuses)
  const statusOptions = [
    { value: "open", label: t("Open") },
    { value: "closed", label: t("Closed") },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
    
<CustomerAging />
  
       
      {selectedInvoiceForPrint && (
        <InvoicePrintPreviewDialog
          isOpen={isPrintDialogOpen}
          onClose={() => setIsPrintDialogOpen(false)}
          invoiceId={selectedInvoiceForPrint}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('Invoices')}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('Search invoices...')}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <MultiSelectDropdown
                options={statusOptions}
                selected={statusFilterArray}
                onChange={arr => setStatusFilter(arr.length ? arr.join(",") : "all")}
                placeholder={t('Filter by status')}
                className="w-full sm:w-64"
                selectAllLabel={t('Select All')}
                clearAllLabel={t('Clear All')}
              />
            </div>

            <div className="rounded-md border">
              {/* Mobile card view - shown on small screens only */}
              <div className="block sm:hidden">
                {isLoading ? (
                  Array(pageSize)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="p-4 border-b last:border-b-0">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-24" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <div className="mt-3 flex justify-between">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                    ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((invoice) => (
                    <div
                      key={invoice.name}
                      className="p-4 border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Link
                            to={`/sales-invoices/${invoice.name}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {invoice.name}
                          </Link>
                          {invoice.is_return ? (
                            <span className="ml-2 inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 uppercase">
                              {t('Return')}
                            </span>
                          ) : null}
                          <div className="text-sm text-muted-foreground mt-1 truncate max-w-[200px]">
                            {invoice.customer}
                          </div>
                        </div>
                        <Badge variant={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-between text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <span className="font-medium mr-1">{t('Issue:')}</span>{" "}
                          {formatDate(invoice.posting_date)}
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium mr-1">{t('Due:')}</span>{" "}
                          {formatDate(invoice.due_date)}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <div className="text-sm font-medium">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: invoice.currency || "SAR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(invoice.grand_total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.outstanding_amount > 0 ? (
                            <span className="text-amber-600 font-medium">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: invoice.currency || "SAR",
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(invoice.outstanding_amount)}{" "}
                              {t('outstanding')}
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium">
                              {t('Fully paid')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/sales-invoices/${invoice.name}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {t('View')}
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoicePDF(invoice.name)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          {t('Download')}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-blue-50 p-4 rounded-full mb-4">
                      <Receipt className="h-10 w-10 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {t('No invoices found')}
                    </h3>
                    {searchTerm || statusFilter !== "all" ? (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('We couldn\'t find any invoices matching your current filters. Try adjusting your search criteria or clearing filters.')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('There are no invoices in your account yet. Invoices will appear here once they\'ve been created for your account.')}
                      </p>
                    )}
                    {(searchTerm || statusFilter !== "all") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("all");
                        }}
                      >
                        {t('Clear Filters')}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop table view - hidden on mobile */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Invoice ID')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('Customer')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('Issue Date')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('Due Date')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('Return')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead className="text-center">{t('Grand Total')}</TableHead>
                      <TableHead className="text-center">{t('Outstanding')}</TableHead>
                      <TableHead className="text-center">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(pageSize)
                        .fill(0)
                        .map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-16" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="h-5 w-20 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="h-5 w-16 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map((invoice) => (
                        <TableRow key={invoice.name}>
                          <TableCell className="font-medium">
                            <Link
                              to={`/sales-invoices/${invoice.name}`}
                              className="text-blue-600 hover:underline"
                            >
                              {invoice.name}
                            </Link>
                          </TableCell>
                          <TableCell>{invoice.customer}</TableCell>
                          <TableCell>
                            {formatDate(invoice.posting_date)}
                          </TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {invoice.is_return ? (
                              <Badge variant="destructive">{t('Return')}</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <DualCurrencyDisplay
                              amount={invoice.grand_total}
                              currency={invoice.currency}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <DualCurrencyDisplay
                              amount={invoice.outstanding_amount}
                              currency={invoice.currency}
                              className={`${
                                invoice.outstanding_amount > 0
                                  ? "text-amber-600"
                                  : "text-green-600"
                              }`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/sales-invoices/${invoice.name}`}>
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">{t('View')}</span>
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => downloadInvoicePDF(invoice.name)}
                              >
                                <Download className="h-4 w-4" />
                                <span className="sr-only">{t('Download PDF')}</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="bg-blue-50 p-4 rounded-full mb-4">
                              <Receipt className="h-10 w-10 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {t('No invoices found')}
                            </h3>
                            {searchTerm || statusFilter !== "all" ? (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('We couldn\'t find any invoices matching your current filters. Try adjusting your search criteria or clearing filters.')}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('There are no invoices in your account yet. Invoices will appear here once they\'ve been created for your account.')}
                              </p>
                            )}
                            {(searchTerm || statusFilter !== "all") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSearchTerm("");
                                  setStatusFilter("all");
                                }}
                              >
                                {t('Clear Filters')}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {!isLoading && filteredData.length > 0 && (
              <DataTablePagination
                pageSize={pageSize}
                setPageSize={setPageSize}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalCount={filteredData.length}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
