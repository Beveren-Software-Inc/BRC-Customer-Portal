"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Download, Search, RefreshCw, Loader2 } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { Link } from "react-router-dom"
import { DataTablePagination } from "../ui/data-table-pagination"
import { useCurrency } from "@/context/currency-context"
import { useQuery } from "@tanstack/react-query"
import { getSapCustomerPayments } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"
import { useTranslation } from "react-i18next"

export default function PaymentsList() {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // Fetch payments data from SAP
  const {
    data: paymentsData = [],
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ["sap-payments"],
    queryFn: getSapCustomerPayments,
    staleTime: 1000 * 60 * 60, // 60 minutes
    retry: 2,
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Data Refreshed",
        description: "Payment data has been refreshed successfully.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: "Failed to refresh payment data. Please try again.",
      });
    }
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currencyCode: string = 'SAR') => {
    if (typeof amount !== 'number') return '0.00';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `${amount.toFixed(2)} ${currencyCode}`;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('Payments')}</h1>
            <p className="text-muted-foreground">{t('View your payment history')}</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">{t('Failed to load payments')}</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('Try Again')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter payments based on search and status
  const filteredPayments = paymentsData.filter((payment: any) => {
    const matchesSearch = 
      payment.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.transfer_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.comments?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.journal_remarks?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || payment.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / pageSize);
  const startIndex = currentPage * pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Payments')}</h1>
          <p className="text-muted-foreground">{t('View your payment history')}</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          disabled={isRefetching}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          {t('Refresh')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('Payment History')}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {t('Total')}: {filteredPayments.length} {t('payments')}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder={t('Search payments...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('Filter by status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Status')}</SelectItem>
                <SelectItem value="completed">{t('Completed')}</SelectItem>
                <SelectItem value="cancelled">{t('Cancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{t('Loading payments...')}</span>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Payment #')}</TableHead>
                      <TableHead>{t('Date')}</TableHead>
                      <TableHead>{t('Customer')}</TableHead>
                      <TableHead>{t('Amount')}</TableHead>
                      <TableHead>{t('Transfer Date')}</TableHead>
                      <TableHead>{t('Reference')}</TableHead>
                      <TableHead>{t('Status')}</TableHead>
                      <TableHead>{t('Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {t('No payments found')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPayments.map((payment: any) => (
                        <TableRow key={payment.name}>
                          <TableCell className="font-medium">{payment.name}</TableCell>
                          <TableCell>{formatDate(payment.posting_date)}</TableCell>
                          <TableCell>{payment.customer_name}</TableCell>
                          <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                          <TableCell>{formatDate(payment.transfer_date)}</TableCell>
                          <TableCell>{payment.transfer_reference || t('N/A')}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === 'Completed' ? 'default' : payment.status === 'Cancelled' ? 'destructive' : 'secondary'}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/payments/${payment.name}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <DataTablePagination
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    pageSize={pageSize}
                    setPageSize={setPageSize}
                    totalCount={filteredPayments.length}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

