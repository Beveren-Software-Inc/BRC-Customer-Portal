"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Download, Search } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils"
import { Link } from "react-router-dom"
import { DataTablePagination } from "../ui/data-table-pagination"
import { useCurrency } from "@/context/currency-context"

// Mock data for payments
const paymentsData = [
  {
    id: "PMT-2023-001",
    date: "2023-03-19",
    invoiceId: "INV-2023-002",
    status: "Completed",
    amount: 1850.0,
    customer: "Global Industries Ltd",
    method: "Credit Card",
    reference: "CC-7890",
  },
  {
    id: "PMT-2023-002",
    date: "2023-03-17",
    invoiceId: "INV-2023-005",
    status: "Completed",
    amount: 3560.0,
    customer: "Innovate Partners",
    method: "Bank Transfer",
    reference: "BT-4567",
  },
  {
    id: "PMT-2023-003",
    date: "2023-03-15",
    invoiceId: "INV-2023-008",
    status: "Completed",
    amount: 4250.0,
    customer: "Alliance Group",
    method: "PayPal",
    reference: "PP-2345",
  },
  {
    id: "PMT-2023-004",
    date: "2023-03-12",
    invoiceId: "INV-2023-006",
    status: "Processing",
    amount: 2820.0,
    customer: "First Choice Supplies",
    method: "Bank Transfer",
    reference: "BT-5678",
  },
  {
    id: "PMT-2023-005",
    date: "2023-03-11",
    invoiceId: "INV-2023-006",
    status: "Completed",
    amount: 2820.0,
    customer: "First Choice Supplies",
    method: "Check",
    reference: "CHK-1234",
  },
  {
    id: "PMT-2023-006",
    date: "2023-03-09",
    invoiceId: "INV-2023-003",
    status: "Failed",
    amount: 4720.0,
    customer: "Tech Solutions Inc",
    method: "Credit Card",
    reference: "CC-9012",
  },
  {
    id: "PMT-2023-007",
    date: "2023-03-05",
    invoiceId: "INV-2023-007",
    status: "Processing",
    amount: 1980.0,
    customer: "Premier Products",
    method: "Bank Transfer",
    reference: "BT-6789",
  },
  {
    id: "PMT-2023-008",
    date: "2023-03-02",
    invoiceId: "INV-2023-001",
    status: "Refunded",
    amount: 1625.0,
    customer: "Acme Corporation",
    method: "Credit Card",
    reference: "CC-3456",
  },
]

export default function PaymentsList() {
  const { currency } = useCurrency()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)

  // Filter and sort data
  const filteredData = paymentsData.filter((payment) => {
    const matchesSearch =
      payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || payment.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

   const sortedData = filteredData.sort((a, b) => {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
});

  // Paginate data
  const paginatedData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search payments..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          <Link to={`/payments/${payment.id}`} className="text-blue-600 hover:underline">
                            {payment.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link to={`/sales-invoices/${payment.invoiceId}`} className="text-blue-600 hover:underline">
                            {payment.invoiceId}
                          </Link>
                        </TableCell>
                        <TableCell>{payment.customer}</TableCell>
                        <TableCell>{formatDate(payment.date)}</TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(payment.status)}>{payment.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(payment.amount, currency)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/payments/${payment.id}`}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        No payments found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination
              pageSize={pageSize}
              setPageSize={setPageSize}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalCount={filteredData.length}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

