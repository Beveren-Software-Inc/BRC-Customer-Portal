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
import {
  Eye,
  Search,
  Download,
  FileText,
  ClipboardList,
  CalendarIcon,
  RefreshCw,
} from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { DataTablePagination } from "../ui/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { DualCurrencyDisplay } from "@/components/ui/currency-display";
import { toast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PrintPreviewDialog from "@/components/print/sales-order-print-preview-dialog";
import { SalesOrder, getSapSalesOrders } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { MultiSelectDropdown } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

export default function SalesOrdersList() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<
    string | null
  >(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  // Fetch Sales Orders from SAP instead of ERPNext
  const {
    data: orders = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SalesOrder[], Error>({
    queryKey: ["sap-sales-orders"],
    queryFn: getSapSalesOrders,
    staleTime: 300000,
    refetchOnMount: true,
    retry: 2,
  });
  
  if (isError) {
    console.error("Failed to fetch orders:", error);
    toast({
      variant: "destructive",
      title: "Error Loading Orders",
      description:
        error?.message || "Could not load order data. Please try again later.",
    });
  }

  // Reset filters on first mount to ensure all orders show
  useEffect(() => {
    setStatusFilter("all");
    setSearchTerm("");
  }, []);

  // Parse status from query string on mount
  useEffect(() => {
    if (location.state && Array.isArray(location.state.initialStatus)) {
      const allowed = ["open", "closed"];
      const normalized = location.state.initialStatus
        .map((s: string) => (s || "").toLowerCase().trim())
        .filter((s: string) => allowed.includes(s));
      if (normalized.length) {
        setStatusFilter(normalized.join(","));
      } else {
        // Ignore ERPNext-specific statuses and show all
        setStatusFilter("all");
      }
    }
  }, [location.state]);

  // Support multi-select status filter
  // Support multi-select status filter
const statusFilterArray =
  statusFilter === "all"
    ? []
    : statusFilter.split(",").map((s) => s.trim().toLowerCase());

const filteredData = (orders || []).filter((order) => {
  if (!order) return false;
  const searchLower = (searchTerm || "").toLowerCase();
  const nameStr = (order as any).name != null ? String((order as any).name) : ""; // DocNum from SAP can be numeric
  const customerStr = (order as any).customer != null ? String((order as any).customer) : "";
  const statusStr = (order as any).status != null ? String((order as any).status) : "";

  const matchesSearch =
    nameStr.toLowerCase().includes(searchLower) ||
    customerStr.toLowerCase().includes(searchLower);
  const matchesStatus =
    statusFilter === "all" ||
    statusFilterArray.includes(statusStr.toLowerCase());
  return matchesSearch && matchesStatus;
});

// ✅ Sort by transaction_date (latest first)
const sortedData = filteredData.sort((a, b) => {
  return new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime();
});

const paginatedData = sortedData.slice(
  currentPage * pageSize,
  (currentPage + 1) * pageSize
);

  // Determine filtered/paginated data before render
  const isEmptyAfterLoad = !isLoading && (Array.isArray(filteredData) ? filteredData.length === 0 : true);

  const downloadOrder = async (orderId: string) => {
    try {
      // Use Frappe's native print functionality for PDF only
      // const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Order&name=${orderId}`;
      const url = `/printview?doctype=Sales%20Order&name=${orderId}&trigger_print=1`;

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

  // Status options for sales orders (SAP B1 statuses)
  const statusOptions = [
    { value: "open", label: t("Open") },
    { value: "closed", label: t("Closed") },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      {selectedOrderForPrint && (
        <PrintPreviewDialog
          isOpen={isPrintDialogOpen}
          onClose={() => setIsPrintDialogOpen(false)}
          orderId={selectedOrderForPrint}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('Sales Orders')}</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
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
                  placeholder={t('Search orders...')}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="font-medium mr-2">{t('Status')}:</label>
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
            </div>

            <div className="rounded-md border">
              {isLoading && (
                <div className="p-4">
                  {Array(pageSize).fill(0).map((_, i) => (
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
                  ))}
                </div>
              )}
              {/* Mobile card view - shown on small screens only */}
              <div className="block sm:hidden">
                {!isLoading && paginatedData.length > 0 ? (
                  paginatedData.map((order) => (
                    <div
                      key={order.name}
                      className="p-4 border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Link
                            to={`/sales-orders/${order.name}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {order.name}
                          </Link>
                          <div className="text-sm text-muted-foreground mt-1 truncate max-w-[200px]">
                            {order.customer}
                          </div>
                        </div>
                        <Badge variant={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                          {formatDate(order.transaction_date)}
                        </div>
                        <div className="text-sm font-medium">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: order.currency || "SAR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(order.grand_total)}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/sales-orders/${order.name}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadOrder(order.name)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (!isLoading && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-amber-50 p-4 rounded-full mb-4">
                      <ClipboardList className="h-10 w-10 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {t('No orders found')}
                    </h3>
                    {searchTerm || statusFilter !== "all" ? (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('We couldn\'t find any sales orders matching your current filters. Try adjusting your search criteria or clearing filters.')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('There are no sales orders in your account yet. Orders will appear here once they\'ve been created for your account.')}
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
                ))}
              </div>

              {/* Desktop table view - hidden on mobile */}
              <div className="hidden sm:block overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Order ID')}</TableHead>
                      <TableHead className="hidden md:table-cell">{t('Customer')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('Order Date')}</TableHead>
                      {/* <TableHead className="text-right">{t('Qty')}</TableHead> */}
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">{t('Total Amount')}</TableHead>
                      <TableHead className="text-right">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!isLoading && paginatedData.length > 0 ? (
                      paginatedData.map((order) => (
                        <TableRow key={`${order.name}`}>
                          <TableCell className="font-medium">
                            <Link
                              to={`/sales-orders/${order.name}`}
                              className="text-blue-600 hover:underline"
                            >
                              {order.name}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="max-w-[200px] truncate">
                              {order.customer}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatDate(order.transaction_date)}
                          </TableCell>
                          {/* <TableCell className="text-right">
                            {order.total_qty || 0}
                          </TableCell> */}
                          <TableCell>
                            <Badge variant={getStatusColor(order.status)}>
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right hidden sm:table-cell">
                            <DualCurrencyDisplay
                              amount={order.grand_total}
                              currency={order.currency}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center space-x-1">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/sales-orders/${order.name}`}>
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">View</span>
                                </Link>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => downloadOrder(order.name)}
                              >
                                <Download className="h-4 w-4" />
                                <span className="sr-only">Download</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (!isLoading && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="bg-amber-50 p-4 rounded-full mb-4">
                              <ClipboardList className="h-10 w-10 text-amber-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {t('No orders found')}
                            </h3>
                            {searchTerm || statusFilter !== "all" ? (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('We couldn\'t find any sales orders matching your current filters. Try adjusting your search criteria or clearing filters.')}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('There are no sales orders in your account yet. Orders will appear here once they\'ve been created for your account.')}
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
                    ))}
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
