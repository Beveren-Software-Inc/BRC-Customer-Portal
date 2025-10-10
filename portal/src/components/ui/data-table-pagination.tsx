"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataTablePaginationProps {
  pageSize: number
  setPageSize: (size: number) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  totalCount: number
}

export function DataTablePagination({
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  totalCount,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const startItem = currentPage * pageSize + 1
  const endItem = Math.min((currentPage + 1) * pageSize, totalCount)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
      <div className="text-sm text-muted-foreground">
        Showing {totalCount > 0 ? startItem : 0} to {endItem} of {totalCount} entries
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setCurrentPage(0)
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(0)}
            disabled={currentPage === 0}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages - 1 || totalPages === 0}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage(totalPages - 1)}
            disabled={currentPage === totalPages - 1 || totalPages === 0}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

