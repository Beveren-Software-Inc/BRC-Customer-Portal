"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, AlertCircle, CalendarIcon, UserCircle, FileText, Wallet, Download } from "lucide-react"
import { formatDate, getStatusColor, isPastDue } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"
import { SalesInvoice, getSapInvoiceDetail } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DualCurrencyDisplay } from "@/components/ui/currency-display"
import { toast } from "@/components/ui/use-toast"
import InvoicePrintPreviewDialog from "@/components/print/invoice-print-preview-dialog"
import { useTranslation } from "react-i18next"

export default function InvoiceDetail() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchInvoiceDetail() {
      if (!id) return

      try {
        setLoading(true)
        console.log("Fetching invoice detail from SAP for ID:", id)
        const data = await getSapInvoiceDetail(id)
        console.log("Fetched invoice detail:", data)
        setInvoice(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch invoice details:', err)
        setError("Could not load invoice details. Please try again later.")
        setInvoice(null)
      } finally {
        setLoading(false)
      }
    }

    fetchInvoiceDetail()
  }, [id])

  const downloadInvoicePDF = () => {
    if (!invoice) {
      toast({
        variant: "destructive",
        title: "Cannot Print",
        description: "Invoice data is not loaded yet. Please wait and try again.",
        duration: 3000,
      });
      return;
    }
    
    // Open print preview dialog with the loaded invoice data
    setIsPrintDialogOpen(true);
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
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/sales-invoices">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Invoice Details')}</h2>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('Error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/sales-invoices">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Invoice Not Found')}</h2>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">{t('The requested invoice could not be found')}</h3>
              <p className="text-muted-foreground mt-2">{t('Please check the invoice ID and try again')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isOverdue = isPastDue(invoice.due_date)
  const isPaid = invoice.outstanding_amount <= 0

  return (
    <div className="flex flex-col gap-6">
      {/* Print Preview Dialog - Updated to use InvoicePrintPreviewDialog with SAP data */}
      <InvoicePrintPreviewDialog
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        invoice={invoice}
      />
      
      {/* Header with back button and status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-9 w-9 rounded-full">
            <Link to="/sales-invoices">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {t('Invoice')} {invoice.name}
              <Badge variant={getStatusColor(invoice.status)} className="ml-2 text-sm">
                {invoice.status}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('Issued on')} {formatDate(invoice.posting_date)}</p>
          </div>
        </div>
        
        {/* Add download button */}
        <div>
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={downloadInvoicePDF}
          >
            <Download className="h-4 w-4" />
            {t('Download PDF')}
          </Button>
        </div>
      </div>

      {/* Invoice Summary Card */}
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-indigo-100 dark:bg-indigo-900 p-2">
                <CalendarIcon className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Invoice Date')}</p>
                <p className="text-base font-semibold">{formatDate(invoice.posting_date)}</p>
                <p className={`text-xs ${isOverdue && !isPaid ? "text-red-500 font-medium" : "text-muted-foreground"} mt-1`}>
                  {t('Due date')}: {formatDate(invoice.due_date)}
                  {isOverdue && !isPaid && <span className="ml-2">(Overdue)</span>}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-indigo-100 dark:bg-indigo-900 p-2">
                <UserCircle className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Customer')}</p>
                <p className="text-base font-semibold">{invoice.customer}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('Currency')}: {invoice.currency}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-indigo-100 dark:bg-indigo-900 p-2">
                <Wallet className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Amount Due')}</p>
                <div className={`text-base font-semibold ${invoice.outstanding_amount > 0 ? "text-amber-600" : "text-green-600"}`}>
                  <DualCurrencyDisplay 
                    amount={invoice.outstanding_amount} 
                    currency={invoice.currency} 
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('Total')}: <span className="font-medium">{new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: invoice.currency,
                  }).format(invoice.grand_total)}</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base">{t('Invoice Items')}</CardTitle>
          <CardDescription>
            {invoice.items.length} {invoice.items.length === 1 ? t('item') : t('items')} in this invoice
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index} className="h-[48px]">
                  <TableCell>
                    <div className="py-1">
                      <p className="font-medium text-sm max-w-[60%] break-words whitespace-normal">
                        {item.item_code}:{" "}{item.item_name}
                      </p>
                      {item.description && item.description !== item.item_name && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[60%] break-words whitespace-normal">{item.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.uom}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">
                    <DualCurrencyDisplay amount={item.rate} currency={invoice.currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DualCurrencyDisplay amount={item.amount} currency={invoice.currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Invoice summary - taxes and total */}
          <div className="border-t p-4">
            <div className="flex flex-col gap-2 ml-auto w-full sm:w-72 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('Subtotal')}:</span>
                <DualCurrencyDisplay 
                  amount={invoice.items.reduce((sum, item) => sum + item.amount, 0)} 
                  currency={invoice.currency}
                  className="items-end"
                />
              </div>
              
              {/* Add taxes and charges */}
              <div className="flex justify-between py-1 border-t border-dashed">
                <span className="text-muted-foreground">{t('Taxes & Charges')}:</span>
                <DualCurrencyDisplay 
                  amount={(typeof invoice.total_taxes_and_charges === 'number' && invoice.total_taxes_and_charges > 0)
                    ? invoice.total_taxes_and_charges
                    : (() => {
                        const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
                        const diff = invoice.grand_total - subtotal;
                        return Math.abs(diff) < 1e-6 ? 0 : diff;
                      })()} 
                  currency={invoice.currency}
                  className="items-end"
                />
              </div>
              
              <div className="flex justify-between py-1 border-t">
                <span className="font-medium">{t('Total')}:</span>
                <DualCurrencyDisplay 
                  amount={invoice.grand_total} 
                  currency={invoice.currency}
                  className="items-end"
                />
              </div>
              
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('Amount Paid')}:</span>
                <DualCurrencyDisplay 
                  amount={invoice.grand_total - invoice.outstanding_amount} 
                  currency={invoice.currency}
                  className="items-end"
                />
              </div>
              
              <div className="flex justify-between py-2 border-t font-semibold">
                <span>{t('Balance Due')}:</span>
                <DualCurrencyDisplay 
                  amount={invoice.outstanding_amount} 
                  currency={invoice.currency}
                  className={`items-end ${invoice.outstanding_amount > 0 ? "text-amber-600" : "text-green-600"}`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.outstanding_amount <= 0 && (
        <Card className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
          <CardContent className="py-4 px-5">
            <div className="flex items-center space-x-4">
              <FileText className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <h3 className="text-base font-medium">{t('Invoice Fully Paid')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('This invoice has been completely paid. Thank you for your business!')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

