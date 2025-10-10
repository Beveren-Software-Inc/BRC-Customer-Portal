"use client"

import { useState, useEffect, useRef } from "react"
import { SalesOrder, getDocumentByName } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Download, Printer, XCircle } from "lucide-react"
import SalesOrderPrint from "./sales-order-print"
import { toast } from "@/components/ui/use-toast"

interface PrintPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
}

export default function PrintPreviewDialog({ isOpen, onClose, orderId }: PrintPreviewDialogProps) {
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const printContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function fetchOrderDetail() {
      if (!orderId || !isOpen) return;

      try {
        setLoading(true);
        const data = await getDocumentByName<SalesOrder>("Sales Order", orderId);
        setOrder(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch order details:', err);
        setError("Could not load order details. Please try again later.");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    fetchOrderDetail();
  }, [orderId, isOpen]);

  const handlePrint = () => {
    // Create a dedicated print window with controlled CSS
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Could not open print window. Please check your pop-up settings.",
        duration: 3000,
      });
      return;
    }
    
    // Get the stylesheet URL
    const stylesheets = Array.from(document.styleSheets)
      .filter(sheet => sheet.href && sheet.href.includes('print-style.css'))
      .map(sheet => sheet.href);

    // Use the current origin if no stylesheet was found
    const stylesheetUrl = stylesheets.length > 0 
      ? stylesheets[0]
      : `${window.location.origin}/src/components/print/print-style.css`;
    
    // Get the HTML content
    const content = printContentRef.current ? printContentRef.current.innerHTML : '';
    
    // Create the print document
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print - Sales Order ${orderId}</title>
        <link rel="stylesheet" href="${stylesheetUrl}" type="text/css">
        <style>
          @page { 
            size: A4; 
            margin: 15mm; 
          }
          
          body { 
            margin: 0; 
            padding: 0; 
            background-color: white; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          }
          
          /* Basic container styles */
          .print-container { 
            padding: 0; 
            width: 100%; 
            max-width: 100%; 
          }
          
          .print-document { 
            padding: 0; 
            background-color: white;
          }
          
          /* Fix table to be more natural and readable */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            table-layout: auto;
          }
          
          .items-table th, .items-table td {
            padding: 6px 10px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
          }
          
          .items-table .text-right {
            text-align: right;
            white-space: nowrap;
          }
          
          .order-totals {
            width: 40%;
            margin-left: auto;
            padding-right: 10px;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${content}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              // window.close();
            }, 500);
          }
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
    toast({
      title: "Print Started",
      description: "The document is being prepared in a new tab.",
      duration: 3000,
    });
  };

  const handleDownloadPDF = () => {
    // Same improved print functionality, just with different messaging
    handlePrint();
    
    toast({
      title: "PDF Creation Started",
      description: "Choose 'Save as PDF' in the print dialog",
      duration: 3000,
    });
  };

  // Add an invisible iframe for print (alternative approach)
  useEffect(() => {
    if (!isOpen || !order || !iframeRef.current || !printContentRef.current) return;
    
    try {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || (iframe.contentWindow?.document);
      
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Print - Sales Order ${orderId}</title>
            <link rel="stylesheet" href="${window.location.origin}/src/components/print/print-style.css">
          </head>
          <body>
            <div class="print-container">
              ${printContentRef.current.innerHTML}
            </div>
          </body>
          </html>
        `);
        doc.close();
      }
    } catch (error) {
      console.error("Failed to prepare iframe content:", error);
    }
  }, [order, isOpen, orderId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-[900px] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-gray-950 p-4 border-b print-hide">
          <div className="flex justify-between items-center">
            <DialogTitle>Document Preview</DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrint}
                disabled={loading || !!error}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button 
                variant="default" 
                onClick={handleDownloadPDF}
                disabled={loading || !!error}
              >
                <Download className="mr-2 h-4 w-4" />
                Save as PDF
              </Button>
              <Button 
                variant="ghost" 
                onClick={onClose}
              >
                <XCircle className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="p-6 overflow-y-auto print-content">
          {loading ? (
            <div className="flex items-center justify-center h-96 print-hide">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading preview...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center print-hide">
              <XCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load preview</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : order ? (
            <div ref={printContentRef} className="print-preview-wrapper">
              <SalesOrderPrint 
                order={order}
                showPrintButton={false} 
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center print-hide">
              <XCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Order not found</h3>
              <p className="text-muted-foreground">The requested order could not be found</p>
            </div>
          )}
        </div>
        
        {/* Hidden iframe for print alternative */}
        <iframe 
          ref={iframeRef} 
          style={{ 
            position: 'absolute', 
            width: '0', 
            height: '0', 
            border: '0',
            visibility: 'hidden' 
          }} 
          title="Print Frame"
        />
      </DialogContent>
    </Dialog>
  );
}