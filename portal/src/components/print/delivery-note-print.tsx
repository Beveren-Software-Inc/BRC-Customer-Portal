import React from "react";
import { DeliveryNote } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import "./print-style.css";

interface DeliveryNotePrintProps {
  deliveryNote: DeliveryNote;
  showPrintButton?: boolean;
}

export const DeliveryNotePrint = ({ 
  deliveryNote,
  showPrintButton = true
}: DeliveryNotePrintProps) => {
  
  const handlePrint = () => {
    window.print();
  };
  
  // Calculate subtotal
  const subtotal = deliveryNote.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Format currency with commas and 2 decimal places
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };
  
  // Extract company name from deliveryNote data or use default
  const companyName = deliveryNote.company || "Your Company";
  
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
            {deliveryNote.company_email && <p>{deliveryNote.company_email}</p>}
          </div>
        </header>
        
        {/* Document Title */}
        <div className="document-title">
          <h2>Delivery Note</h2>
          <div className="document-number">{deliveryNote.name}</div>
        </div>
        
        {/* Delivery Info */}
        <div className="order-meta">
          <div className="order-meta-grid">
            <div>
              <strong>Customer:</strong>
              <p>{deliveryNote.customer}</p>
              {deliveryNote.shipping_address && <p className="meta-address">{deliveryNote.shipping_address}</p>}
            </div>
            
            <div>
              <strong>Delivery Date:</strong>
              <p>{formatDate(deliveryNote.posting_date)}</p>
            </div>
            
            <div>
              <strong>Status:</strong>
              <p className={`status-badge status-${deliveryNote.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                {deliveryNote.status}
              </p>
              
              <strong>Currency:</strong>
              <p>{deliveryNote.currency}</p>
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
            {deliveryNote.items.map((item, index) => (
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
                  {deliveryNote.currency} {formatCurrency(item.rate)}
                </td>
                <td className="text-right">
                  {deliveryNote.currency} {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Totals */}
        <div className="order-totals">
          <div className="totals-row">
            <span>Subtotal:</span>
            <span>{deliveryNote.currency} {formatCurrency(subtotal)}</span>
          </div>
          
          <div className="totals-row">
            <span>Taxes & Charges:</span>
            <span>{deliveryNote.currency} {formatCurrency(deliveryNote.total_taxes_and_charges || 0)}</span>
          </div>
          
          <div className="totals-row grand-total">
            <span>TOTAL:</span>
            <span>{deliveryNote.currency} {formatCurrency(deliveryNote.grand_total)}</span>
          </div>
        </div>
        
        {/* Notes & Terms */}
        {deliveryNote.terms && (
          <div className="order-notes">
            <h3>Terms and Conditions</h3>
            <p>{deliveryNote.terms}</p>
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

export default DeliveryNotePrint;