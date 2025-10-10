import React from "react";
import { SalesInvoice } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import "./print-style.css";

interface InvoicePrintProps {
  invoice: SalesInvoice;
  showPrintButton?: boolean;
}

export const InvoicePrint = ({ 
  invoice,
  showPrintButton = true
}: InvoicePrintProps) => {
  
  const handlePrint = () => {
    window.print();
  };
  
  // Calculate subtotal
  const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Format currency with commas and 2 decimal places
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };
  
  // Extract company name from invoice data or use default
  const companyName = invoice.company || "Your Company";
  
  return (
    <div className="print-container">
      {showPrintButton && (
        <button onClick={handlePrint} className="print-button print-hide">
          Print / Save as PDF
        </button>
      )}
      
      <div className="print-document">
        {/* Simplified Header */}
        <header className="print-header">
          <div className="company-info-centered">
            <h1>{companyName}</h1>
            {invoice.company_email && <p>{invoice.company_email}</p>}
          </div>
        </header>
        
        {/* Document Title */}
        <div className="document-title">
          <h2>Invoice</h2>
          <div className="document-number">{invoice.name}</div>
        </div>
        
        {/* Invoice Info */}
        <div className="order-meta">
          <div className="order-meta-grid">
            <div>
              <strong>Customer:</strong>
              <p>{invoice.customer}</p>
              {invoice.customer_address && <p className="meta-address">{invoice.customer_address}</p>}
            </div>
            
            <div>
              <strong>Invoice Date:</strong>
              <p>{formatDate(invoice.posting_date)}</p>
              
              <strong>Due Date:</strong>
              <p>{invoice.due_date ? formatDate(invoice.due_date) : "Not specified"}</p>
            </div>
            
            <div>
              <strong>Status:</strong>
              <p className={`status-badge status-${invoice.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                {invoice.status}
              </p>
              
              <strong>Currency:</strong>
              <p>{invoice.currency}</p>
            </div>
          </div>
        </div>
        
        {/* Fixed Table Structure */}
        <table className="items-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th className="text-right">Quantity</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{item.item_code}</td>
                <td>
                  <div className="item-name">{item.item_name}</div>
                  {item.description && item.description !== item.item_name && (
                    <div className="item-description">{item.description}</div>
                  )}
                </td>
                <td className="text-right">{item.qty}</td>
                <td className="text-right">
                  {invoice.currency} {formatCurrency(item.rate)}
                </td>
                <td className="text-right">
                  {invoice.currency} {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Totals */}
        <div className="order-totals">
          <div className="totals-row">
            <span>Subtotal:</span>
            <span>{invoice.currency} {formatCurrency(subtotal)}</span>
          </div>
          
          <div className="totals-row">
            <span>Taxes & Charges:</span>
            <span>{invoice.currency} {formatCurrency(invoice.total_taxes_and_charges || 0)}</span>
          </div>
          
          <div className="totals-row grand-total">
            <span>TOTAL:</span>
            <span>{invoice.currency} {formatCurrency(invoice.grand_total)}</span>
          </div>
          
          {invoice.outstanding_amount !== undefined && (
            <>
              <div className="totals-row">
                <span>Amount Paid:</span>
                <span>{invoice.currency} {formatCurrency(invoice.grand_total - invoice.outstanding_amount)}</span>
              </div>
              
              <div className="totals-row grand-total">
                <span>Balance Due:</span>
                <span>{invoice.currency} {formatCurrency(invoice.outstanding_amount)}</span>
              </div>
            </>
          )}
        </div>
        
        {/* Notes & Terms */}
        {(invoice.terms || invoice.notes) && (
          <div className="order-notes">
            {invoice.terms && (
              <>
                <h3>Terms and Conditions</h3>
                <p>{invoice.terms}</p>
              </>
            )}
            
            {invoice.notes && (
              <>
                <h3>Notes</h3>
                <p>{invoice.notes}</p>
              </>
            )}
          </div>
        )}
        
        {/* Add clear div to ensure footer spacing */}
        <div style={{ clear: "both", marginBottom: "20px" }}></div>
        
        {/* Footer */}
        <footer className="print-footer">
          <p>Thank you for your business!</p>
          <p className="text-muted">This is a computer-generated document. No signature is required.</p>
        </footer>
      </div>
    </div>
  );
};

export default InvoicePrint;