"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Download, Search, AlertCircle } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor, isPastDue } from "@/lib/utils"
import { Link } from "react-router-dom"
import { DataTablePagination } from "../ui/data-table-pagination"
import { useCurrency } from "@/context/currency-context"
import { Quotation, getQuotations } from "@/lib/api"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

export default function QuotationsList() {
  const { currency } = useCurrency()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchQuotations() {
      try {
        setLoading(true)
        const data = await getQuotations()
        
        if (Array.isArray(data) && data.length > 0 && data[0] !== undefined) {
          setQuotations(data)
        } else {
          console.error("Received invalid quotation data:", data)
          setError("No valid quotation data received. Please try again later.")
          setQuotations([])
        }
      } catch (err) {
        console.error("Failed to fetch quotations:", err)
        setError("Could not load quotation data. Please try again later.")
        setQuotations([])
      } finally {
        setLoading(false)
      }
    }

    fetchQuotations()
  }, [])

  const filteredData = quotations.filter((quotation) => {
    if (!quotation) return false;
    
    const matchesSearch =
      quotation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quotation.party_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || 
      (quotation.status?.toLowerCase() === statusFilter.toLowerCase())

    return matchesSearch && matchesStatus
  })

  const paginatedData = filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Quotations</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search quotations..."
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
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Valid Till</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedData.length > 0 ? (
                    paginatedData.map((quotation) => {
                      const isExpired = isPastDue(quotation.valid_till);
                      
                      return (
                        <TableRow key={quotation.name}>
                          <TableCell className="font-medium">
                            <Link to={`/quotations/${quotation.name}`} className="text-blue-600 hover:underline">
                              {quotation.name}
                            </Link>
                          </TableCell>
                          <TableCell>{quotation.party_name}</TableCell>
                          <TableCell>{formatDate(quotation.transaction_date)}</TableCell>
                          <TableCell className={isExpired ? "text-red-500" : ""}>
                            {formatDate(quotation.valid_till)}
                            {isExpired && <span className="text-xs ml-1">(Expired)</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusColor(quotation.status)}>{quotation.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(quotation.grand_total, quotation.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <Link to={`/quotations/${quotation.name}`}>
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
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">
                        No quotations found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && (
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
  )
}

