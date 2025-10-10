"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, AlertCircle, TruckIcon, CalendarIcon, UserCircle, Wallet, Download, FileText } from "lucide-react"
import { formatDate, getStatusColor } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"
import { SalesOrder } from "@/lib/api"
import { getSapSalesOrderDetail } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { DualCurrencyDisplay } from "@/components/ui/currency-display"
import { toast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import PrintPreviewDialog from "@/components/print/sales-order-print-preview-dialog"
import { useTranslation } from "react-i18next"

export default function SalesOrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    async function fetchOrderDetail() {
      if (!id) return

      try {
        setLoading(true)
        console.log("Fetching order detail for ID:", id)
        const data = await getSapSalesOrderDetail(id)
        console.log("Fetched order data:", data)
        setOrder(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch order details:', err)
        setError("Could not load order details. Please try again later.")
        setOrder(null)
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetail()
  }, [id])

  console.log("Rendering SalesOrderDetail with order:", order, "loading:", loading, "error:", error)
  const downloadOrder = async () => {
    if (!id) return;
    
    try {
      // Use Frappe's native print functionality for PDF only
      // const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales%20Order&name=${id}`;
      const url = `/printview?doctype=Sales%20Order&name=${id}&trigger_print=1`
      
      // Open in a new tab
      window.open(url, '_blank');
      
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
        description: "There was a problem opening the print view. Please try again.",
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
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/sales-orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Order Details')}</h2>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('Error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/sales-orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">{t('Order Not Found')}</h2>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">{t('The requested order could not be found')}</h3>
              <p className="text-muted-foreground mt-2">{t('Please check the order ID and try again')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const deliveryPercentage = order.per_delivered ? order.per_delivered : 0
  const billingPercentage = order.per_billed ? order.per_billed : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Print Preview Dialog */}
      <PrintPreviewDialog 
        isOpen={isPrintDialogOpen}
        onClose={() => setIsPrintDialogOpen(false)}
        orderId={id || ""}
      />
      
      {/* Header with back button and status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-9 w-9 rounded-full">
            <Link to="/sales-orders">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {t('Sales Order')} {order.name}
              <Badge variant={getStatusColor(order.status)} className="ml-2 text-sm">
                {order.status}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{t('Created on')} {formatDate(order.transaction_date)}</p>
          </div>
        </div>
        
        {/* Add download buttons */}
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                {t('Download')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadOrder()}>
                <FileText className="mr-2 h-4 w-4" /> 
                {t('Download as PDF')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Order Summary Card */}
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                <CalendarIcon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Order Date')}</p>
                <p className="text-base font-semibold">{formatDate(order.transaction_date)}</p>
                {order.delivery_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('Expected delivery')}: {formatDate(order.delivery_date)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                <UserCircle className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Customer')}</p>
                <p className="text-base font-semibold">{order.customer}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('Currency')}: {order.currency}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                <Wallet className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('Total Amount')}</p>
                <div className="text-base font-semibold">
                  <DualCurrencyDisplay amount={order.grand_total} currency={order.currency} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Progress */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TruckIcon className="h-4 w-4" />
              {t('Delivery Status')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{deliveryPercentage === 100 ? t('Delivered') : deliveryPercentage > 0 ? t('Partially Delivered') : t('Not Delivered')}</span>
                  <span className="text-sm text-muted-foreground">{deliveryPercentage}%</span>
                </div>
                <Progress 
                  value={deliveryPercentage} 
                  className="h-2" 
                  data-state={deliveryPercentage === 100 ? "complete" : "in-progress"}
                />
                <div className="text-xs text-muted-foreground">
                  {deliveryPercentage === 100 
                    ? t('All items have been delivered') 
                    : deliveryPercentage > 0 
                      ? t('Some items have been delivered') 
                      : t('No items delivered yet')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t('Billing Status')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{billingPercentage === 100 ? t('Fully Billed') : billingPercentage > 0 ? t('Partially Billed') : t('Not Billed')}</span>
                  <span className="text-sm text-muted-foreground">{billingPercentage}%</span>
                </div>
                <Progress 
                  value={billingPercentage} 
                  className="h-2" 
                  data-state={billingPercentage === 100 ? "complete" : "in-progress"}
                />
                <div className="text-xs text-muted-foreground">
                  {billingPercentage === 100 
                    ? t('Order has been fully billed') 
                    : billingPercentage > 0 
                      ? t('Order has been partially billed') 
                      : t('Order has not been billed yet')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <CardTitle className="text-base">{t('Order Items')}</CardTitle>
          <CardDescription>
            {order.items.length} {order.items.length === 1 ? t('item') : t('items')} in this order
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
  <TableHeader className="bg-muted/30">
    <TableRow>
      <TableHead>{t('Item')}</TableHead>
      <TableHead className="text-center hidden sm:table-cell">{t('UOM')}</TableHead>     
      <TableHead className="text-right">{t('Qty')}</TableHead>
      <TableHead className="text-right">{t('Delivered')}</TableHead>
      <TableHead className="text-right">{t('Pending')}</TableHead>
      
      <TableHead className="text-right hidden sm:table-cell">{t('Rate')}</TableHead>
      <TableHead className="text-right">{t('Amount')}</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {order.items.map((item, index) => {
      const delivered = item.delivered_qty || 0
      const pending = ((item.qty || 0) - delivered).toFixed(3)

      return (
        <TableRow key={index} className="h-[48px]">
          <TableCell>
            <div className="py-1">
              <p className="font-medium text-sm">
                <span className="font-semibold">{item.item_code}: </span>
                <span className="truncate max-w-[150px] sm:max-w-none inline-block">{item.item_name}</span>
              </p>
              {item.description && item.description !== item.item_name && (
                <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{item.description}</p>
              )}
            </div>
          </TableCell>
          <TableCell className="text-center hidden sm:table-cell">{item.uom}</TableCell>
          <TableCell className="text-right">{item.qty}</TableCell>
          <TableCell className="text-right">{delivered}</TableCell>
          <TableCell className="text-right">{pending}</TableCell>
          
          <TableCell className="text-right hidden sm:table-cell">
            <DualCurrencyDisplay amount={item.rate} currency={order.currency} />
          </TableCell>
          <TableCell className="text-right">
            <DualCurrencyDisplay 
              amount={item.amount} 
              currency={order.currency} 
              className="text-xs sm:text-base" 
            />
          </TableCell>
        </TableRow>
      )
    })}
  </TableBody>
</Table>

          </div>
          
          {/* Order summary - taxes and total */}
          <div className="border-t p-4">
            <div className="flex flex-col gap-2 ml-auto w-full sm:w-72 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">{t('Subtotal')}:</span>
                <DualCurrencyDisplay 
                  amount={order.items.reduce((sum, item) => sum + item.amount, 0)} 
                  currency={order.currency}
                  className="items-end"
                />
              </div>
              
              {/* Add taxes and charges */}
              <div className="flex justify-between py-1 border-t border-dashed">
                <span className="text-muted-foreground">{t('Taxes & Charges')}:</span>
                <DualCurrencyDisplay 
                  amount={order.total_taxes_and_charges || 0} 
                  currency={order.currency}
                  className="items-end"
                />
              </div>
              
              <div className="flex justify-between py-2 border-t font-semibold">
                <span>{t('Total')}:</span>
                <DualCurrencyDisplay 
                  amount={order.grand_total} 
                  currency={order.currency}
                  className="items-end"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {deliveryPercentage < 100 && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="py-4 px-5">
            <div className="flex items-center space-x-4">
              <TruckIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div>
                <h3 className="text-base font-medium">{t('Delivery Status')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {deliveryPercentage === 0 
                    ? t('Your order is being processed and will be shipped soon.') 
                    : t('Some items have been shipped. The remaining items will be delivered soon.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

