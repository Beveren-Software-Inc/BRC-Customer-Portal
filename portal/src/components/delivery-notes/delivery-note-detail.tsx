"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  AlertCircle,
  CalendarIcon,
  UserCircle,
  TruckIcon,
  Download,
} from "lucide-react";
import { formatDate, getStatusColor } from "@/lib/utils";
import { Link, useParams } from "react-router-dom";
import { DeliveryNote, getSapDeliveryNoteDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DualCurrencyDisplay } from "@/components/ui/currency-display";
import { toast } from "@/components/ui/use-toast";
import DeliveryNotePrintPreviewDialog from "@/components/print/delivery-note-print-preview-dialog";
import { useTranslation } from "react-i18next";

export default function DeliveryNoteDetail() {
  const { id } = useParams();
  const [delivery, setDelivery] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const { t } = useTranslation();

  // Utility function to convert HTML tags to formatted text
  const formatAddressText = (address: string) => {
    if (!address) return "";

    // Replace <br> tags with line breaks and clean up HTML entities
    return address
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<p>/gi, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
      .replace(/\n\s*\n/g, "\n") // Replace multiple consecutive newlines with single newline
      .trim();
  };

  useEffect(() => {
    async function fetchDeliveryDetail() {
      if (!id) return;

      try {
        setLoading(true);
        console.log("Fetching delivery note detail for ID:", id);
        const data = await getSapDeliveryNoteDetail(id);
        console.log("Fetched delivery note data:", data);
        setDelivery(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch delivery details:", err);
        setError("Could not load delivery details. Please try again later.");
        setDelivery(null);
      } finally {
        setLoading(false);
      }
    }

    fetchDeliveryDetail();
  }, [id]);

  const downloadDeliveryNotePDF = () => {
    if (!id) return;

    try {
      // Use Frappe's native print functionality
      // const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Delivery%20Note&name=${id}`;
      const url = `/printview?doctype=Delivery%20Note&name=${id}&trigger_print=1`;

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

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/delivery-notes">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Delivery Details')}</h2>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('Error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/delivery-notes">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Delivery Not Found')}</h2>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">
                {t('The requested delivery could not be found')}
              </h3>
              <p className="text-muted-foreground mt-2">
                {t('Please check the delivery ID and try again')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const billingPercentage = delivery.per_billed ? delivery.per_billed : 0;
  // Commented out unused variables since status cards are commented out
  // const installationPercentage = delivery.per_installed ? delivery.per_installed : 0;
  // const returnedPercentage = delivery.per_returned ? delivery.per_returned : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Print Preview Dialog */}
      <DeliveryNotePrintPreviewDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        deliveryNoteId={id || ""}
      />

      {/* Header with back button, status and download button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="h-9 w-9 rounded-full"
          >
            <Link to="/delivery-notes">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {t('Delivery Note')} {delivery.name}
              <Badge
                variant={getStatusColor(delivery.status)}
                className="ml-2 text-sm"
              >
                {delivery.status}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Posting Date')}: {formatDate(delivery.posting_date)}
            </p>
          </div>
        </div>

        {/* Add download button */}
        <div>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={downloadDeliveryNotePDF}
          >
            <Download className="h-4 w-4" />
            {t('Download PDF')}
          </Button>
        </div>
      </div>

      {/* Delivery Summary Card */}
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                <CalendarIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Delivery Date')}
                </p>
                <p className="text-base font-semibold">
                  {formatDate(delivery.posting_date)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                <UserCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Customer')}
                </p>
                <p className="text-base font-semibold">{delivery.customer}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Currency')}: {delivery.currency}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                <TruckIcon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Delivery Status')}
                </p>
                <p className="text-base font-semibold">{delivery.status}</p>
                {delivery.shipping_address && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {t('Shipping to')}:{" "}
                    {
                      formatAddressText(delivery.shipping_address).split(
                        "\n"
                      )[0]
                    }
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Cards Section - Commented out as requested */}
      {/*
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        Billing Status Card
        Installation Status Card
        Return Status Card
      </div>
      */}

      {/* Items Table */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base">
            {delivery.status.toLowerCase() === "completed"
              ? t('Delivered Items')
              : t('Delivery Items')}
          </CardTitle>
          <CardDescription>
            {delivery.items.length} {delivery.items.length === 1 ? t('item') : t('items')}
            {delivery.status.toLowerCase() === "completed"
              ? t('delivered')
              : delivery.status.toLowerCase() === "to bill"
              ? t('in transit')
              : t('in this delivery note')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>{t('Item')}</TableHead>
                <TableHead className="text-center">{t('UOM')}</TableHead>
                <TableHead className="text-right">{t('Qty')}</TableHead>
                <TableHead className="text-right">{t('Rate')}</TableHead>
                <TableHead className="text-right">{t('Amount')}</TableHead>
                {delivery.items.some((item) => item.against_sales_order) && (
                  <TableHead>{t('Sales Order')}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {delivery.items.map((item, index) => (
                <TableRow key={index} className="h-[48px]">
                  <TableCell>
                    <div className="py-1">
                      <p className="font-medium text-sm">
                        <span className="font-semibold">
                          {item.item_code}:{" "}
                        </span>
                        {item.item_name}
                      </p>
                      {item.description &&
                        item.description !== item.item_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.uom}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">
                    <DualCurrencyDisplay
                      amount={item.rate}
                      currency={delivery.currency}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DualCurrencyDisplay
                      amount={item.amount}
                      currency={delivery.currency}
                    />
                  </TableCell>
                  {delivery.items.some((item) => item.against_sales_order) && (
                    <TableCell>
                      {item.against_sales_order && (
                        <Link
                          to={`/sales-orders/${item.against_sales_order}`}
                          className="text-blue-600 hover:underline"
                        >
                          {item.against_sales_order}
                        </Link>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Delivery summary - taxes and total */}
          <div className="border-t p-4">
            <div className="flex flex-col gap-2 ml-auto w-full sm:w-72 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('Subtotal')}:</span>
                <DualCurrencyDisplay
                  amount={delivery.items.reduce(
                    (sum, item) => sum + item.amount,
                    0
                  )}
                  currency={delivery.currency}
                  className="items-end"
                />
              </div>

              {/* Add taxes and charges */}
              <div className="flex justify-between py-1 border-t border-dashed">
                <span className="text-muted-foreground">{t('Taxes & Charges')}:</span>
                <DualCurrencyDisplay
                  amount={delivery.total_taxes_and_charges || 0}
                  currency={delivery.currency}
                  className="items-end"
                />
              </div>

              <div className="flex justify-between py-2 border-t font-semibold">
                <span>{t('Total')}:</span>
                <DualCurrencyDisplay
                  amount={delivery.grand_total}
                  currency={delivery.currency}
                  className="items-end"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {delivery.status.toLowerCase() === "completed" ? (
        <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
          <CardContent className="py-4 px-5">
            <div className="flex items-center space-x-4">
              <TruckIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="text-base font-medium">{t('Delivery Completed')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('All items have been successfully delivered to the destination.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="py-4 px-5">
            <div className="flex items-center space-x-4">
              <TruckIcon className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <h3 className="text-base font-medium">{t('Delivery In Progress')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {billingPercentage < 100
                    ? t('This delivery is being processed and will be billed soon.')
                    : t('This delivery has been processed and is awaiting completion.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {delivery.shipping_address && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              {t('Shipping Details')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="space-y-2 max-w-2xl">
              <div className="border p-4 rounded-md bg-muted/20">
                <p className="text-sm whitespace-pre-wrap">
                  {formatAddressText(delivery.shipping_address)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
