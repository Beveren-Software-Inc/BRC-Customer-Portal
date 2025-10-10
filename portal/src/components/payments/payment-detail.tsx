"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, CreditCard, Receipt } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"
import { useCurrency } from "@/context/currency-context"

export default function PaymentDetail() {
  const { id } = useParams()
  const { currency } = useCurrency()

  // Mock data for a single payment
  const paymentData = {
    id,
    date: "2023-03-20",
    status: "Completed",
    amount: 1850.0,
    invoiceId: "INV-2023-002",
    customerName: "Global Industries Ltd",
    customerEmail: "accounts@globalindustries.com",
    customerPhone: "+1 (555) 987-6543",
    method: "Credit Card",
    cardType: "Visa",
    cardLast4: "4242",
    reference: "CC-7890",
    transactionId: "txn_1234567890",
    notes: "Payment for March 2023 invoice",
    receiptSent: true,
    receiptEmail: "accounts@globalindustries.com",
    receiptDate: "2023-03-20",
  }

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Payment ID</dt>
                <dd className="text-base font-semibold">{paymentData.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={getStatusColor(paymentData.status)}>{paymentData.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Date</dt>
                <dd className="text-base">{formatDate(paymentData.date)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Amount</dt>
                <dd className="text-base font-semibold">{formatCurrency(paymentData.amount, currency)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Invoice</dt>
                <dd className="text-base">
                  <Link to={`/sales-invoices/${paymentData.invoiceId}`} className="text-blue-600 hover:underline">
                    {paymentData.invoiceId}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Reference</dt>
                <dd className="text-base">{paymentData.reference}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Transaction ID</dt>
                <dd className="text-base font-mono text-sm">{paymentData.transactionId}</dd>
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
                <dd className="text-base font-semibold">{paymentData.customerName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                <dd className="text-base">{paymentData.customerEmail}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                <dd className="text-base">{paymentData.customerPhone}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

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
                <p className="font-medium">{paymentData.method}</p>
                {paymentData.method === "Credit Card" && (
                  <p className="text-sm text-muted-foreground">
                    {paymentData.cardType} ending in {paymentData.cardLast4}
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
                <p className="font-medium">Receipt {paymentData.receiptSent ? "Sent" : "Not Sent"}</p>
                {paymentData.receiptSent && (
                  <>
                    <p className="text-sm text-muted-foreground">Sent to: {paymentData.receiptEmail}</p>
                    <p className="text-sm text-muted-foreground">Date: {formatDate(paymentData.receiptDate)}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{paymentData.notes}</p>
        </CardContent>
      </Card>
    </div>
  )
}

