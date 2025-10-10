"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, FileText, FileIcon as FilePdf, FileImage, FileArchive } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface DocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  document: {
    id: string
    name: string
    type: string
    size: string
    date: string
    category: string
    url?: string
  } | null
}

export default function DocumentViewer({ isOpen, onClose, document }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && document) {
      // Simulate loading the document
      const timer = setTimeout(() => {
        setLoading(false)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setLoading(true)
    }
  }, [isOpen, document])

  if (!document) return null

  // Function to get file icon
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "pdf":
        return <FilePdf className="h-8 w-8 text-red-500" />
      case "xlsx":
      case "xls":
      case "csv":
        return <FileText className="h-8 w-8 text-green-500" />
      case "docx":
      case "doc":
        return <FileText className="h-8 w-8 text-blue-500" />
      case "jpg":
      case "png":
      case "gif":
        return <FileImage className="h-8 w-8 text-purple-500" />
      case "zip":
      case "rar":
        return <FileArchive className="h-8 w-8 text-amber-500" />
      default:
        return <FileText className="h-8 w-8 text-gray-500" />
    }
  }

  // Render document preview based on type
  const renderDocumentPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )
    }

    switch (document.type.toLowerCase()) {
      case "pdf":
        return (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 h-[400px] flex flex-col items-center justify-center">
            <FilePdf className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">PDF Document</p>
            <p className="text-xs text-muted-foreground">Preview not available. Please download to view.</p>
          </div>
        )
      case "jpg":
      case "png":
      case "gif":
        return (
          <div className="h-[400px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-md p-4">
            <img
              src={document.url || `/placeholder.svg?height=400&width=600`}
              alt={document.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )
      case "xlsx":
      case "xls":
      case "csv":
        return (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 h-[400px] flex flex-col items-center justify-center">
            <FileText className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Spreadsheet Document</p>
            <p className="text-xs text-muted-foreground">Preview not available. Please download to view.</p>
          </div>
        )
      case "docx":
      case "doc":
        return (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 h-[400px] flex flex-col items-center justify-center">
            <FileText className="h-16 w-16 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Word Document</p>
            <p className="text-xs text-muted-foreground">Preview not available. Please download to view.</p>
          </div>
        )
      case "zip":
      case "rar":
        return (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 h-[400px] flex flex-col items-center justify-center">
            <FileArchive className="h-16 w-16 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">Archive File</p>
            <p className="text-xs text-muted-foreground">Preview not available. Please download to view.</p>
          </div>
        )
      default:
        return (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-md p-8 h-[400px] flex flex-col items-center justify-center">
            <FileText className="h-16 w-16 text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">{document.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">{document.type.toUpperCase()} Document</p>
            <p className="text-xs text-muted-foreground">Preview not available. Please download to view.</p>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getFileIcon(document.type)}
            <span>{document.name}</span>
          </DialogTitle>
          <DialogDescription>
            {document.type.toUpperCase()} • {document.size} • Uploaded on {formatDate(document.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">{renderDocumentPreview()}</div>

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Category: {document.category}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
            <Button>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

