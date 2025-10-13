"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  FileText,
  Calendar,
  Loader2,
  RefreshCw,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  downloadCustomerStatement,
  getCustomerStatementData,
  getSapCustomerStatement,
  CustomerStatementFilter,
} from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "react-i18next";

export default function CustomerStatementList() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statementData, setStatementData] = useState<any>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [format, setFormat] = useState<"PDF" | "Excel">("PDF");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);

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

  const formatCurrency = (amount: number, currency: string = 'SAR') => {
    if (typeof amount !== 'number') return '0.00';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  };

  const { t } = useTranslation();

  // Define fields to fetch for orders and invoices (including customer_name)
  const salesOrderFields = ["name", "customer", "customer_name"];
  const salesInvoiceFields = ["name", "customer", "customer_name"];

  // Use the centralized useApi hook to fetch data (same as navbar)
  const { 
    data: orders = [], 
    isLoading: ordersLoading
  } = useApi("Sales Order", salesOrderFields);

  const {
    data: invoices = [],
    isLoading: invoicesLoading
  } = useApi("Sales Invoice", salesInvoiceFields);
  
  // Process customer info from orders and invoices to get both code and name
  useEffect(() => {
    // If either data is still loading, wait until both are loaded
    if (ordersLoading || invoicesLoading) return;
    
    // Combine all customer info from both orders and invoices
    const customerInfo = new Map<string, string>(); // Map of customer code -> customer name
    
    orders.forEach(order => {
      if (order.customer) {
        const customerName = (order as any).customer_name || order.customer;
        customerInfo.set(order.customer, customerName);
      }
    });
    
    invoices.forEach(invoice => {
      if (invoice.customer) {
        const customerName = invoice.customer_name || invoice.customer;
        customerInfo.set(invoice.customer, customerName);
      }
    });
    
    // If there's only one unique customer, use that info
    if (customerInfo.size === 1) {
      const [customerCode, customerNameOnly] = Array.from(customerInfo.entries())[0];
      setCustomerCode(customerCode);
      setCustomerName(`${customerCode}: ${customerNameOnly}`);
    } else if (customerInfo.size > 1) {
      // Multiple customers: use the first one (avoid "All Customers")
      const [firstCode, firstName] = Array.from(customerInfo.entries())[0];
      setCustomerCode(firstCode);
      setCustomerName(`${firstCode}: ${firstName}`);
    } else {
      setCustomerCode(""); // No customers
      setCustomerName(t("Customer"));
    }
  }, [orders, invoices, ordersLoading, invoicesLoading, t]);

  // Set default dates (last 12 months)
  useEffect(() => {
    const today = new Date();
    const lastYear = new Date(
      today.getFullYear() - 1,
      today.getMonth(),
      today.getDate()
    );

    setToDate(today.toISOString().split("T")[0]);
    setFromDate(lastYear.toISOString().split("T")[0]);
  }, []);

  // Auto-fetch data when customer code and dates are available
  useEffect(() => {
    if (customerCode && fromDate && toDate) {
      handleFetchStatementData();
    }
  }, [customerCode, fromDate, toDate]);

  const handleFetchStatementData = async () => {
    if (!fromDate || !toDate) {
      return;
    }

    // Check if customer code is available
    if (!customerCode) {
      setShowCustomerDialog(true);
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      toast({
        variant: "destructive",
        title: "Invalid Date Range",
        description: "From date cannot be later than to date",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log("Fetching customer statement from SAP...");
      const data = await getSapCustomerStatement(fromDate, toDate);
      console.log("SAP Customer statement data:", data);
      
      if (data && data.transactions) {
        setStatementData(data);
        toast({
          title: "Statement Generated",
          description: `Found ${data.transactions.length} transactions for the selected period.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "No Data Found",
          description: "No transactions found for the selected customer and date range.",
        });
      }
    } catch (error) {
      console.error("Failed to fetch statement data:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not fetch customer statement data. Please try again.";
      toast({
        variant: "destructive",
        title: "Fetch Failed",
        description: errorMessage,
      });
      setStatementData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateStatement = async () => {
    if (!fromDate || !toDate) {
      toast({
        variant: "destructive",
        title: "Missing Dates",
        description: "Please select both from and to dates",
      });
      return;
    }

    // Check if customer code is available
    if (!customerCode) {
      setShowCustomerDialog(true);
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      toast({
        variant: "destructive",
        title: "Invalid Date Range",
        description: "From date cannot be later than to date",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const filters: CustomerStatementFilter = {
        from_date: fromDate,
        to_date: toDate,
        customer: customerCode,
      };

      await downloadCustomerStatement(filters, format);

      toast({
        title: "Statement Generated",
        description:
          format === "PDF"
            ? "Customer statement print preview has been opened in a new window"
            : `Customer statement has been downloaded as ${format}`,
      });
    } catch (error) {
      console.error("Failed to generate statement:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Could not generate customer statement. Please try again.";
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const renderStatementPreview = () => {
    // Don't show preview if no customer code is available
    if (!customerCode) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mr-2 opacity-50" />
          <span>{t('Loading customer information...')}</span>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">
            {t('Loading statement data...')}
          </span>
        </div>
      );
    }

    if (!statementData || !statementData.transactions) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mr-2 opacity-50" />
          <span>{t('No statement data available')}</span>
        </div>
      );
    }

    const { transactions, customer_name, opening_balance, closing_balance, summary } = statementData;

    if (!transactions || transactions.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mr-2 opacity-50" />
          <span>{t('No transactions found for the selected period')}</span>
        </div>
      );
    }

    // Debug: Log the data structure to understand what we're working with
    console.log("SAP Statement data:", { transactions, customer_name, opening_balance, closing_balance });
    console.log("First transaction:", transactions[0]);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{t('Statement Preview')}</h3>
          <div className="text-sm text-muted-foreground">
            {transactions.length} {t('transaction', { count: transactions.length })} {t('found')}
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[120px]">Number</TableHead>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="w-[100px] text-right">Debit</TableHead>
                  <TableHead className="w-[100px] text-right">Credit</TableHead>
                  <TableHead className="w-[120px] text-right">Balance</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell>{transaction.document_type}</TableCell>
                    <TableCell>{transaction.document_number}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.debit > 0 ? formatCurrency(transaction.debit, transaction.currency) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {transaction.credit > 0 ? formatCurrency(transaction.credit, transaction.currency) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(transaction.balance, transaction.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        transaction.status === 'Completed' ? 'default' : 
                        transaction.status === 'Cancelled' ? 'destructive' : 
                        transaction.status === 'Balance' ? 'outline' : 
                        'secondary'
                      }>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {transactions.length > 500 && (
            <div className="p-3 bg-muted text-sm text-muted-foreground text-center">
              {t('Showing first 500 rows of {count} total rows. Download for complete data.', { count: transactions.length })}
            </div>
          )}
        </div>

        {/* Statement Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">{t('Total Invoices')}</p>
            <p className="text-2xl font-bold text-blue-900">
              {summary?.total_invoices || 0}
            </p>
            <p className="text-xs text-blue-500">
              {formatCurrency(summary?.total_invoice_amount || 0, transactions[0]?.currency || 'SAR')}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">{t('Total Payments')}</p>
            <p className="text-2xl font-bold text-green-900">
              {summary?.total_payments || 0}
            </p>
            <p className="text-xs text-green-500">
              {formatCurrency(summary?.total_payment_amount || 0, transactions[0]?.currency || 'SAR')}
            </p>
          </div>
          <div className="bg-amber-50 p-4 rounded-lg">
            <p className="text-sm text-amber-600">{t('Opening Balance')}</p>
            <p className="text-2xl font-bold text-amber-900">
              {formatCurrency(opening_balance, transactions[0]?.currency || 'SAR')}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">{t('Closing Balance')}</p>
            <p className="text-2xl font-bold text-purple-900">
              {formatCurrency(closing_balance, transactions[0]?.currency || 'SAR')}
            </p>
            <p className={`text-xs ${closing_balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
              {closing_balance >= 0 ? t('Amount Due') : t('Credit Balance')}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('Customer Statement')}</h1>
          <p className="text-muted-foreground">{t('Generate and download customer account statements')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('Generate Statement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
            {/* Customer Information - Takes up 6 columns (50% width) */}
            <div className="col-span-1 md:col-span-3 lg:col-span-6 space-y-2">
              <Label htmlFor="customer">{t('Customer')}</Label>
              <Input
                id="customer"
                value={customerName || t("Loading...")}
                readOnly
                className="bg-muted font-medium"
              />
            </div>

            {/* From Date - Takes up 2 columns */}
            <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-2">
              <Label htmlFor="from-date">{t('From Date')}</Label>
              <div className="relative">
                <Input
                  id="from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* To Date - Takes up 2 columns */}
            <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-2">
              <Label htmlFor="to-date">{t('To Date')}</Label>
              <div className="relative">
                <Input
                  id="to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="pl-10"
                />
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Format Selection - Takes up 2 columns (smallest) */}
            <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-2">
              <Label htmlFor="format">{t('Format')}</Label>
              <Select
                value={format}
                onValueChange={(value: "PDF" | "Excel") => setFormat(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Excel">{t('Excel')}</SelectItem>
                  <SelectItem value="PDF">{t('PDF')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generate and Refresh Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              onClick={handleFetchStatementData}
              disabled={isLoading || !fromDate || !toDate}
              variant="outline"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Loading...')}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('Refresh Data')}
                </>
              )}
            </Button>

            <Button
              onClick={handleGenerateStatement}
              disabled={isGenerating || !fromDate || !toDate}
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('Generating...')}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {format === "PDF" ? t('Print Preview') : t('Download Excel')}
                </>
              )}
            </Button>
          </div>

          {/* Info Section */}
          <div className="border-t pt-4 space-y-2">
            <h4 className="font-medium text-sm">{t('Statement Information:')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • {t('Customer statements show all transactions including invoices, payments, and adjustments...')}
              </li>
              <li>
                • {t('You can export PDF (print preview) or Excel formats of the Customer Statement')}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Statement Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {t('Statement Preview')}
          </CardTitle>
        </CardHeader>
        <CardContent>{renderStatementPreview()}</CardContent>
      </Card>

      {/* Customer Selection Dialog */}
      <Dialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('Customer Information Loading')}
            </DialogTitle>
            <DialogDescription>
              {t('Please wait while we load your customer information. If this issue persists, please contact support.')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowCustomerDialog(false)}>{t('Got it')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
