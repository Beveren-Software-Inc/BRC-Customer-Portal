"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Download, Search, FileText, FileIcon as FilePdf, FileImage, FileArchive } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { DataTablePagination } from "../ui/data-table-pagination"
import DocumentViewer from "./document-viewer"

// Mock data for documents
const documentsData = [
  {
    id: "DOC-2023-001",
    name: "Product Catalog 2023",
    type: "pdf",
    size: "4.2 MB",
    date: "2023-03-15",
    category: "Marketing",
    shared: true,
  },
  {
    id: "DOC-2023-002",
    name: "Invoice Summary Q1 2023",
    type: "xlsx",
    size: "1.8 MB",
    date: "2023-03-10",
    category: "Finance",
    shared: true,
  },
  {
    id: "DOC-2023-003",
    name: "Company Brochure",
    type: "pdf",
    size: "3.5 MB",
    date: "2023-03-05",
    category: "Marketing",
    shared: true,
  },
  {
    id: "DOC-2023-004",
    name: "Technical Specifications",
    type: "docx",
    size: "1.2 MB",
    date: "2023-02-28",
    category: "Technical",
    shared: false,
  },
  {
    id: "DOC-2023-005",
    name: "Product Images Package",
    type: "zip",
    size: "25.6 MB",
    date: "2023-02-25",
    category: "Marketing",
    shared: true,
  },
  {
    id: "DOC-2023-006",
    name: "Sales Training Manual",
    type: "pdf",
    size: "8.3 MB",
    date: "2023-02-20",
    category: "Sales",
    shared: false,
  },
  {
    id: "DOC-2023-007",
    name: "Customer Feedback Summary",
    type: "xlsx",
    size: "2.1 MB",
    date: "2023-02-15",
    category: "Customer Service",
    shared: true,
  },
  {
    id: "DOC-2023-008",
    name: "Product Assembly Instructions",
    type: "pdf",
    size: "5.7 MB",
    date: "2023-02-10",
    category: "Technical",
    shared: true,
  },
]

export default function DocumentsList() {
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize, setPageSize] = useState(5)
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  // Filter and sort data
  const filteredData = documentsData.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === "all" || doc.category.toLowerCase() === categoryFilter.toLowerCase()

    return matchesSearch && matchesCategory
  })

  // Paginate data
  const paginatedData = filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)

  // Function to get file icon
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
        return <FilePdf className="h-4 w-4 text-red-500" />
      case "xlsx":
      case "xls":
      case "csv":
        return <FileText className="h-4 w-4 text-green-500" />
      case "docx":
      case "doc":
        return <FileText className="h-4 w-4 text-blue-500" />
      case "jpg":
      case "png":
      case "gif":
        return <FileImage className="h-4 w-4 text-purple-500" />
      case "zip":
      case "rar":
        return <FileArchive className="h-4 w-4 text-amber-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const handleViewDocument = (doc: any) => {
    setSelectedDocument(doc)
    setIsViewerOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search documents..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="customer service">Customer Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Document ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {getFileIcon(doc.type)}
                            <button
                              onClick={() => handleViewDocument(doc)}
                              className="ml-2 text-blue-600 hover:underline text-left"
                            >
                              {doc.name}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>{doc.id}</TableCell>
                        <TableCell>{doc.category}</TableCell>
                        <TableCell className="uppercase">{doc.type}</TableCell>
                        <TableCell>{doc.size}</TableCell>
                        <TableCell>{formatDate(doc.date)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleViewDocument(doc)}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
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
                      <TableCell colSpan={7} className="text-center py-6">
                        No documents found
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

      <DocumentViewer isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)} document={selectedDocument} />
    </div>
  )
}

