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
import { Eye, Search, Package, Download, RefreshCw, Loader2, FileSignature } from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { DataTablePagination } from "../ui/data-table-pagination";
import { DeliveryNote, getSapDeliveryNotes, getSapDeliveryNoteDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DualCurrencyDisplay } from "@/components/ui/currency-display";
import { toast } from "@/components/ui/use-toast";
import DeliveryNotePrintPreviewDialog from "@/components/print/delivery-note-print-preview-dialog";
import { useTranslation } from "react-i18next";
import { MultiSelectDropdown } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

export default function DeliveryNotesList() {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [selectedDeliveryNoteForPrint, setSelectedDeliveryNoteForPrint] =
    useState<DeliveryNote | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null);

  // Fetch Delivery Notes from SAP using React Query for proper caching
  const {
    data: deliveries = [],
    isLoading: loading,
    isError,
    error,
    refetch,
  } = useQuery<DeliveryNote[], Error>({
    queryKey: ["sap-delivery-notes"],
    queryFn: getSapDeliveryNotes,
    staleTime: 1000 * 60 * 60, // 60 minutes
    refetchOnMount: true,
    retry: 2,
  });
  
  if (isError) {
    console.error("Failed to fetch delivery notes:", error);
    toast({
      variant: "destructive",
      title: "Error Loading Deliveries",
      description:
        error?.message || "Could not load delivery data. Please try again later.",
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
        title: t("Refreshing Deliveries"),
        description: "Fetching the latest delivery notes from SAP...",
        duration: 2000,
      });
    } catch (error) {
      console.error("Failed to refresh delivery notes:", error);
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh delivery notes. Please try again.",
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
  const filteredData = deliveries.filter((note: DeliveryNote) => {
    const searchLower = (searchTerm || "").toLowerCase();
    const matchesSearch =
      !searchLower ||
      String(note.name || '').toLowerCase().includes(searchLower) ||
      String(note.customer || '').toLowerCase().includes(searchLower) ||
      String(note.po_no || '').toLowerCase().includes(searchLower);
    const matchesStatus =
      statusFilter === "all" ||
      statusFilterArray.includes(String(note.status || '').toLowerCase());
    return matchesSearch && matchesStatus;
  });

  console.log("Delivery Notes List Debug:", {
    loading,
    deliveries: deliveries.length,
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

  const openDeliveryPrint = async (deliveryNoteId: string) => {
    try {
      setPrintLoadingId(deliveryNoteId);
      const detail = await getSapDeliveryNoteDetail(deliveryNoteId);
      if (!detail) {
        toast({
          variant: "destructive",
          title: t("Print Failed"),
          description: t("Could not load delivery note details."),
        });
        return;
      }
      setSelectedDeliveryNoteForPrint(detail);
      setIsPrintDialogOpen(true);
    } catch (error) {
      console.error("Failed to open print dialog:", error);
      toast({
        variant: "destructive",
        title: t("Print Failed"),
        description: t("There was a problem preparing the print preview."),
      });
    }
    finally {
      setPrintLoadingId(null);
    }
  };

  // Status options for delivery notes (matching SAP B1 statuses)
  const statusOptions = [
    { value: "open", label: t("Open") },
    { value: "closed", label: t("Closed") },
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      <DeliveryNotePrintPreviewDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        deliveryNote={selectedDeliveryNoteForPrint}
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('Delivery Notes')}</CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="sr-only">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t('Search delivery notes...')}
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
                {loading ? (
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
                  paginatedData.map((delivery: DeliveryNote) => (
                    <div
                      key={delivery.name}
                      className="p-4 border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Link
                            to={`/delivery-notes/${delivery.name}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {delivery.name}
                          </Link>
                          <div className="text-sm text-muted-foreground mt-1 truncate max-w-[200px]">
                            {delivery.customer}
                          </div>
                          {delivery.po_no ? (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {t('PO')}: {delivery.po_no}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant={getStatusColor(delivery.status)}>
                          {delivery.status}
                        </Badge>
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <span className="font-medium mr-1">{t('Delivered:')}</span>{" "}
                          {formatDate(delivery.posting_date)}
                        </div>
                        <div className="text-sm font-medium">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: delivery.currency || "SAR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(delivery.grand_total)}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end gap-2 flex-wrap">
                        {delivery.attachment_entry ? (
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/method/sap_customer_portal.api.customer_balance.get_delivery_note_attachment?doc_num=${encodeURIComponent(delivery.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileSignature className="h-3.5 w-3.5 mr-1" />
                              {t('Signature')}
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/delivery-notes/${delivery.name}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {t('View')}
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeliveryPrint(delivery.name)}
                          disabled={printLoadingId === delivery.name}
                        >
                          {printLoadingId === delivery.name ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              {t('Preparing...')}
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5 mr-1" />
                              {t('Download')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-green-50 p-4 rounded-full mb-4">
                      <Package className="h-10 w-10 text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {t('No delivery notes found')}
                    </h3>
                    {searchTerm || statusFilter !== "all" ? (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('We couldn\'t find any delivery notes matching your current filters. Try adjusting your search criteria or clearing filters.')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                        {t('There are no delivery notes in your account yet. Delivery notes will appear here once they\'ve been created for your orders.')}
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
                      <TableHead>{t('Delivery ID')}</TableHead>
                      <TableHead className="hidden lg:table-cell">{t('PO Reference')}</TableHead>
                      <TableHead>{t('Customer')}</TableHead>
                      <TableHead>{t('Delivery Date')}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t('Return')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead className="text-center">{t('Signature')}</TableHead>
                      <TableHead className="text-right">{t('Value')}</TableHead>
                      <TableHead className="text-right">{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array(5)
                        .fill(0)
                        .map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-5 w-8 mx-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                          </TableRow>
                        ))
                    ) : paginatedData.length > 0 ? (
                      paginatedData.map((delivery: DeliveryNote) => (
                        <TableRow key={delivery.name}>
                          <TableCell className="font-medium">
                            <Link
                              to={`/delivery-notes/${delivery.name}`}
                              className="text-blue-600 hover:underline"
                            >
                              {delivery.name}
                            </Link>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {delivery.po_no || '—'}
                          </TableCell>
                          <TableCell>{delivery.customer}</TableCell>
                          <TableCell>
                            {formatDate(delivery.posting_date)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {delivery.is_return ? (
                              <Badge variant="destructive">{t('Return')}</Badge>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(delivery.status)}>
                              {delivery.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {delivery.attachment_entry ? (
                              <a
                                href={`/api/method/sap_customer_portal.api.customer_balance.get_delivery_note_attachment?doc_num=${encodeURIComponent(delivery.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center text-muted-foreground hover:text-primary"
                                title={t('View signed delivery note')}
                              >
                                <FileSignature className="h-4 w-4" />
                                <span className="sr-only">{t('View signature')}</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DualCurrencyDisplay
                              amount={delivery.grand_total}
                              currency={delivery.currency}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/delivery-notes/${delivery.name}`}>
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">{t('View')}</span>
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeliveryPrint(delivery.name)}
                                disabled={printLoadingId === delivery.name}
                              >
                                {printLoadingId === delivery.name ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                                <span className="sr-only">{t('Download PDF')}</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9}>
                          <div className="flex flex-col items-center justify-center py-12">
                            <div className="bg-green-50 p-4 rounded-full mb-4">
                              <Package className="h-10 w-10 text-green-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {t('No delivery notes found')}
                            </h3>
                            {searchTerm || statusFilter !== "all" ? (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('We couldn\'t find any delivery notes matching your current filters. Try adjusting your search criteria or clearing filters.')}
                              </p>
                            ) : (
                              <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                                {t('There are no delivery notes in your account yet. Delivery notes will appear here once they\'ve been created for your orders.')}
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

            {!loading && filteredData.length > 0 && (
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
