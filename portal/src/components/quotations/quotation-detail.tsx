"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Download, ClipboardCheck, FileText, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor, isPastDue, getDaysRemaining } from "@/lib/utils"
import { Link, useParams } from "react-router-dom"
import { useCurrency } from "@/context/currency-context"
import { Quotation, getDocumentByName } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function QuotationDetail() {
  const { id } = useParams()
  const { currency } = useCurrency()
  const [quotation, setQuotation] = useState<Quotation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchQuotationDetail() {
      if (!id) return

      try {
        setLoading(true)
        const data = await getDocumentByName<Quotation>("Quotation", id)
        setQuotation(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch quotation details:', err)
        setError("Could not load quotation details. Please try again later.")
        setQuotation(null)
      } finally {
        setLoading(false)
      }
    }

    fetchQuotationDetail()
  }, [id])

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
            <Link to="/quotations">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">Quotation Details</h2>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!quotation) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link to="/quotations">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">Quotation Not Found</h2>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h3 className="text-lg font-medium">The requested quotation could not be found</h3>
              <p className="text-muted-foreground mt-2">Please check the quotation ID and try again</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isExpired = isPastDue(quotation.valid_till);
  const daysLeft = getDaysRemaining(quotation.valid_till);
  const isActive = !isExpired && quotation.status.toLowerCase() !== 'cancelled' && 
                  quotation.status.toLowerCase() !== 'lost' && quotation.status.toLowerCase() !== 'ordered';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link to="/quotations">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <h2 className="text-2xl font-bold">Quotation {quotation.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {isActive && (
            <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Accept Quote
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quotation Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Quotation #</dt>
                <dd className="text-base font-semibold">{quotation.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={getStatusColor(quotation.status)}>{quotation.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Issue Date</dt>
                <dd className="text-base">{formatDate(quotation.transaction_date)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Valid Till</dt>
                <dd className={`text-base ${isExpired ? "text-red-500" : ""}`}>
                  {formatDate(quotation.valid_till)}
                  {isExpired ? 
                    <span className="ml-2 text-xs">(Expired)</span> : 
                    <span className="ml-2 text-xs">({daysLeft} days left)</span>
                  }
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Currency</dt>
                <dd className="text-base">{quotation.currency}</dd>
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
                <dd className="text-base font-semibold">{quotation.party_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Total Amount</dt>
                <dd className="text-base font-bold">
                  {formatCurrency(quotation.grand_total, quotation.currency)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quote Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotation.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.item_code}</p>
                      <p className="text-sm text-gray-500">{item.item_name}</p>
                      {item.description && <p className="text-xs text-gray-400">{item.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.rate, quotation.currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount, quotation.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-6 flex flex-col items-end space-y-2">
            <div className="flex w-full justify-between border-t pt-2 md:w-1/2">
              <span className="text-base font-bold">Total:</span>
              <span className="text-base font-bold">{formatCurrency(quotation.grand_total, quotation.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isExpired ? (
        <Card className="bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <FileText className="h-10 w-10 text-amber-500" />
              <div>
                <h3 className="text-lg font-semibold">Quote Expired</h3>
                <p className="text-sm text-muted-foreground">
                  This quotation has expired. Please contact us for a new quote if you're still interested.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        quotation.status.toLowerCase() === 'open' && (
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <ClipboardCheck className="h-10 w-10 text-blue-500" />
                  <div>
                    <h3 className="text-lg font-semibold">Ready for Acceptance</h3>
                    <p className="text-sm text-muted-foreground">
                      This quote is valid for {Math.abs(daysLeft)} more days, until {formatDate(quotation.valid_till)}.
                    </p>
                  </div>
                </div>
                <Button>Accept Quote</Button>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}

