"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, CreditCard, Receipt } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"
import { useCurrency } from "@/context/currency-context"
import { useQuery } from "@tanstack/react-query"
import { getSapCustomerPayments } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

export default function PaymentDetail() {
  const { id } = useParams()
  const { currency } = useCurrency()

  const { data: payments = [], isLoading, isError } = useQuery<any[], Error>({
    queryKey: ["sap-payments"],
    queryFn: getSapCustomerPayments,
    staleTime: 1000 * 60 * 60, // 60 minutes
    refetchOnMount: true,
    retry: 2,
  })

  const payment = useMemo(() => {
    if (!id) return null
    return (payments || []).find(p => String(p.name) === String(id)) || null
  }, [payments, id])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link to="/payments">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">Payment Details</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Receipt
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-5 w-40" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-5 w-40" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && !payment && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">The requested payment could not be found.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!!payment && (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Payment ID</dt>
                <dd className="text-base font-semibold">{payment.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={getStatusColor(payment.status)}>{payment.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Date</dt>
                <dd className="text-base">{formatDate(payment.posting_date)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Amount</dt>
                <dd className="text-base font-semibold">{formatCurrency(payment.amount, currency)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Invoice</dt>
                <dd className="text-base">
                  {/* Not available in SAP IncomingPayments result; hide if absent */}
                  <span className="text-muted-foreground">N/A</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Reference</dt>
                <dd className="text-base">{payment.transfer_reference || payment.remarks || payment.journal_remarks || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Transaction ID</dt>
                <dd className="text-base font-mono text-sm">{payment.name}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Customer</dt>
                <dd className="text-base font-semibold">{payment.customer_name || payment.customer}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                <dd className="text-base">-</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                <dd className="text-base">-</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
      )}

      {!!payment && (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-3">
                <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{payment.payment_type || 'Transfer'}</p>
                {payment.transfer_account && (
                  <p className="text-sm text-muted-foreground">
                    Account: {payment.transfer_account}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receipt Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-gray-100 dark:bg-gray-800 p-3">
                <Receipt className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Receipt Status</p>
                <p className="text-sm text-muted-foreground">{payment.cancelled === 'tYES' ? 'Cancelled' : 'Completed'}</p>
                {payment.transfer_date && (
                  <p className="text-sm text-muted-foreground">Date: {formatDate(payment.transfer_date)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {!!payment && (
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{payment.journal_remarks || payment.comments || '-'}</p>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

