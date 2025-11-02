"use client"

import { useRef } from "react"
import { DeliveryNote } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, Printer, XCircle } from "lucide-react"
import DeliveryNotePrint from "./delivery-note-print"
import { toast } from "@/components/ui/use-toast"

interface DeliveryNotePrintPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryNote: DeliveryNote | null;
}

export default function DeliveryNotePrintPreviewDialog({ isOpen, onClose, deliveryNote }: DeliveryNotePrintPreviewDialogProps) {
  const printContentRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        <title>Print - Delivery Note ${deliveryNote?.name || ''}</title>
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-[900px] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-white dark:bg-gray-950 p-4 border-b print-hide">
          <div className="flex justify-between items-center">
            <DialogTitle>Delivery Note Preview</DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handlePrint}
                disabled={!deliveryNote}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button 
                variant="default" 
                onClick={handleDownloadPDF}
                disabled={!deliveryNote}
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
          {deliveryNote ? (
            <div ref={printContentRef} className="print-preview-wrapper">
              <DeliveryNotePrint 
                deliveryNote={deliveryNote}
                showPrintButton={false} 
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center print-hide">
              <XCircle className="h-16 w-16 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Delivery Note not found</h3>
              <p className="text-muted-foreground">The requested delivery note could not be found</p>
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