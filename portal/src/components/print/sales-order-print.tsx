import React from "react";
import { SalesOrder } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import "./print-style.css";

interface SalesOrderPrintProps {
  order: SalesOrder;
  showPrintButton?: boolean;
}

export const SalesOrderPrint = ({ 
  order,
  showPrintButton = true
}: SalesOrderPrintProps) => {
  
  const handlePrint = () => {
    window.print();
  };
  
  // Calculate subtotal
  const subtotal = order.items.reduce((sum, item) => sum + item.amount, 0);
  
  // Format currency with commas and 2 decimal places
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };
  
  // Extract company name from order data or use default
  const companyName = order.company || "Your Company";
  
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
            {order.company_email && <p>{order.company_email}</p>}
          </div>
        </header>
        
        {/* Document Title */}
        <div className="document-title">
          <h2>Sales Order</h2>
          <div className="document-number">{order.name}</div>
        </div>
        
        {/* Order Info */}
        <div className="order-meta">
          <div className="order-meta-grid">
            <div>
              <strong>Customer:</strong>
              <p>{order.customer}</p>
              {order.customer_address && <p className="meta-address">{order.customer_address}</p>}
            </div>
            
            <div>
              <strong>Order Date:</strong>
              <p>{formatDate(order.transaction_date)}</p>
              
              <strong>Delivery Date:</strong>
              <p>{order.delivery_date ? formatDate(order.delivery_date) : "Not specified"}</p>
            </div>
            
            <div>
              <strong>Status:</strong>
              <p className={`status-badge status-${order.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                {order.status}
              </p>
              
              <strong>Currency:</strong>
              <p>{order.currency}</p>
            </div>
          </div>
        </div>
        
        {/* Fixed Table Structure - Removed fixed column widths */}
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
            {order.items.map((item, index) => (
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
                  {order.currency} {formatCurrency(item.rate)}
                </td>
                <td className="text-right">
                  {order.currency} {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Totals */}
        <div className="order-totals">
          <div className="totals-row">
            <span>Subtotal:</span>
            <span>{order.currency} {formatCurrency(subtotal)}</span>
          </div>
          
          <div className="totals-row">
            <span>Taxes & Charges:</span>
            <span>{order.currency} {formatCurrency(order.total_taxes_and_charges || 0)}</span>
          </div>
          
          <div className="totals-row grand-total">
            <span>TOTAL:</span>
            <span>{order.currency} {formatCurrency(order.grand_total)}</span>
          </div>
        </div>
        
        {/* Notes & Terms */}
        <div className="order-notes">
          {order.terms && (
            <>
              <h3>Terms and Conditions</h3>
              <p>{order.terms}</p>
            </>
          )}
          
          {order.notes && (
            <>
              <h3>Notes</h3>
              <p>{order.notes}</p>
            </>
          )}
        </div>
        
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

export default SalesOrderPrint;