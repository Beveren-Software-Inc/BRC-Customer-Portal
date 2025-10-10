"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Search } from "lucide-react"
import { formatDate, getStatusColor } from "@/lib/utils"
import { Link } from "react-router-dom"
import { DataTablePagination } from "../ui/data-table-pagination"

// Mock data for support tickets
const supportTicketsData = [
  {
    id: "TKT-2023-001",
    date: "2023-03-20",
    subject: "Order delivery delay",
    priority: "Medium",
    status: "Open",
    lastUpdate: "2023-03-20",
    category: "Delivery",
  },
  {
    id: "TKT-2023-002",
    date: "2023-03-18",
    subject: "Invoice discrepancy",
    priority: "High",
    status: "In Progress",
    lastUpdate: "2023-03-19",
    category: "Billing",
  },
  {
    id: "TKT-2023-003",
    date: "2023-03-17",
    subject: "Product quality issue",
    priority: "High",
    status: "Open",
    lastUpdate: "2023-03-19",
    category: "Product",
  },
  {
    id: "TKT-2023-004",
    date: "2023-03-15",
    subject: "Return request for damaged item",
    priority: "Medium",
    status: "In Progress",
    lastUpdate: "2023-03-18",
    category: "Returns",
  },
  {
    id: "TKT-2023-005",
    date: "2023-03-12",
    subject: "Account access problem",
    priority: "Low",
    status: "Resolved",
    lastUpdate: "2023-03-14",
    category: "Account",
  },
  {
    id: "TKT-2023-006",
    date: "2023-03-10",
    subject: "Missing items in order",
    priority: "High",
    status: "Open",
    lastUpdate: "2023-03-15",
    category: "Delivery",
  },
  {
    id: "TKT-2023-007",
    date: "2023-03-08",
    subject: "Payment not reflected in account",
    priority: "Medium",
    status: "Resolved",
    lastUpdate: "2023-03-12",
    category: "Billing",
  },
  {
    id: "TKT-2023-008",
    date: "2023-03-05",
    subject: "Wrong product delivered",
    priority: "High",
    status: "Closed",
    lastUpdate: "2023-03-10",
    category: "Delivery",
  },
]

export default function SupportTicketsList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)

  // Filter and sort data
  const filteredData = supportTicketsData.filter((ticket) => {
    const matchesSearch =
      ticket.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || ticket.status.toLowerCase() === statusFilter.toLowerCase()

    return matchesSearch && matchesStatus
  })

  // Paginate data
  const paginatedData = filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  // Map priority to badge variant
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "high":
        return "destructive"
      case "medium":
        return "warning"
      case "low":
        return "info"
      default:
        return "default"
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search tickets..."
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Update</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">
                          <Link to={`/support-tickets/${ticket.id}`} className="text-blue-600 hover:underline">
                            {ticket.id}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(ticket.date)}</TableCell>
                        <TableCell>{ticket.subject}</TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(ticket.lastUpdate)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/support-tickets/${ticket.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        No tickets found
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

