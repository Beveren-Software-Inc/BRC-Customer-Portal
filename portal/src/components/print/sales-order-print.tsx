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
  
  // Calculate subtotal and net total
  const subtotal = order.items.reduce((sum, item) => sum + item.amount, 0);
  const netTotal = order.net_total || subtotal;
  const taxAmount = order.total_taxes_and_charges || 0;
  const taxRate = 15; // Default tax rate
  
  // Format currency with commas and 2 decimal places
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount);
  };
  
  // Format date as dd/MM/yy
  const formatDateShort = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };
  
  return (
    <div className="print-container">
      {showPrintButton && (
        <button onClick={handlePrint} className="print-button print-hide">
          Print / Save as PDF
        </button>
      )}
      
      <div className="print-document">
        {/* Header Section - Sales Order Design */}
        <div style={{ 
          display: "flex", 
          marginBottom: "15px",
          fontSize: "11px"
        }}>
          {/* Left Column: Logo and BRC Address */}
          <div style={{ flex: "0 0 41%", paddingRight: "15px" }}>
            {order.brc_logo_url ? (
              <img 
                src={order.brc_logo_url}
                alt="BRC Logo"
                style={{ height: "50px", marginBottom: "10px", maxWidth: "100%" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div style={{ height: "50px", marginBottom: "10px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>BRC Logo</div>
            )}
            
            <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222" }}>
              <strong>BRC Industrial Saudi</strong><br />
              JJM4242<br />
              22423 JEDDAH<br />
              SAUDI ARABIA
            </div>
            
            <div style={{ marginTop: "10px", fontSize: "10px", color: "#888" }}>Customer Address</div>
            <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222", marginTop: "5px" }}>
              <strong>{order.customer_name || order.customer}</strong><br />
              {order.address_display ? (
                order.address_display.split(', ').map((line, i, arr) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : "-"}
            </div>
          </div>
          
          {/* Right Column: Order Info */}
          <div style={{ flex: "0 0 59%" }}>
            {/* Row 1: Copy | Order Confirmation */}
            <div style={{ 
              display: "flex", 
              alignItems: "center",
              borderBottom: "1px solid #0070c0",
              paddingBottom: "6px",
              marginBottom: "6px"
            }}>
              <span style={{ fontSize: "12px", color: "#888" }}>Copy</span>
              <span style={{ 
                display: "inline-block",
                width: "4px",
                height: "28px",
                backgroundColor: "#f7b500",
                margin: "0 12px",
                borderRadius: "2px"
              }}></span>
              <span style={{ fontSize: "20px", fontWeight: "700", color: "#222" }}>Order Confirmation</span>
            </div>
            
            {/* Row 2: Document Number, Date, Page */}
            <div style={{ 
              display: "flex",
              borderBottom: "1px solid #0070c0",
              paddingBottom: "6px",
              marginBottom: "6px"
            }}>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Document Number</span>
                <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{order.name || "-"}</span>
              </div>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Document Date</span>
                <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{formatDateShort(order.transaction_date)}</span>
              </div>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Page</span>
                <span style={{ fontSize: "12px", color: "#222", display: "block" }}>1/1</span>
              </div>
            </div>
            
            {/* Row 3: Customer Number, VAT Number */}
            <div style={{ 
              display: "flex",
              borderBottom: "1px solid #0070c0",
              paddingBottom: "6px",
              marginBottom: "6px"
            }}>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Customer Number</span>
                <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{order.customer || "-"}</span>
              </div>
              <div style={{ flex: "1" }}>
                <span style={{ fontSize: "10px", color: "#888", display: "block" }}>VAT Number - Business Partner</span>
                <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{order.customer_tax_id || order.tax_id || "-"}</span>
              </div>
            </div>
            
            {/* Row 4: Your Reference */}
            <div style={{ 
              borderBottom: "1px solid #0070c0",
              paddingBottom: "6px",
              marginBottom: "6px"
            }}>
              <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Your Reference</span>
              <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{order.po_no || "-"}</span>
            </div>
            
            {/* Row 5: Your Contact */}
            <div style={{ 
              borderBottom: "1px solid #0070c0",
              paddingBottom: "6px",
              marginBottom: "6px"
            }}>
              <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Your Contact</span>
              <span style={{ fontSize: "12px", color: "#222", display: "block" }}>{order.contact_person || "-"}</span>
            </div>
            
            {/* Row 6: Delivery Address */}
            <div style={{ marginLeft: "2px" }}>
              <span style={{ fontSize: "10px", color: "#888", display: "block" }}>Delivery Address</span>
              <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222", marginTop: "5px" }}>
                <strong>{order.customer_name || order.customer}</strong><br />
                {order.shipping_address_display ? (
                  order.shipping_address_display.split(', ').map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))
                ) : order.address_display ? (
                  order.address_display.split(', ').map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))
                ) : "-"}
              </div>
            </div>
          </div>
        </div>
        
        {/* Blue Line */}
        <div style={{ 
          borderTop: "1px solid #0070c0",
          marginTop: "10px",
          marginBottom: "8px"
        }}></div>
        
        {/* Below Header: Delivery Date, Cancellation Date, Currency */}
        <div style={{ 
          display: "flex",
          marginTop: "8px",
          marginBottom: "8px",
          fontSize: "11px"
        }}>
          <div style={{ flex: "1" }}>
            <span style={{ fontSize: "10px", color: "#888", marginRight: "4px" }}>Delivery Date:</span>
            <span style={{ fontSize: "11px", color: "#222", marginRight: "16px" }}>{formatDateShort(order.delivery_date)}</span>
          </div>
          <div style={{ flex: "1" }}>
            <span style={{ fontSize: "10px", color: "#888", marginRight: "4px" }}>Cancellation Date:</span>
            <span style={{ fontSize: "11px", color: "#222", marginRight: "16px" }}>{formatDateShort(order.valid_till)}</span>
          </div>
          <div style={{ flex: "1" }}>
            <span style={{ fontSize: "10px", color: "#888", marginRight: "4px" }}>Currency:</span>
            <span style={{ fontSize: "11px", color: "#222", marginRight: "16px" }}>{order.currency || "SAR"}</span>
            {order.carry_over && (
              <>
                <span style={{ fontSize: "10px", color: "#f7b500", fontWeight: "bold", marginRight: "4px" }}>Carry Over:</span>
                <span style={{ fontSize: "11px", color: "#f7b500" }}>{order.currency} {formatCurrency(order.carry_over)}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Blue Line */}
        <div style={{ 
          borderTop: "1px solid #0070c0",
          marginTop: "8px",
          marginBottom: "8px"
        }}></div>
        
        {/* Items Table */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: "10px",
          marginBottom: "0",
          border: "1px solid #d1d5db"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f3f6fa" }}>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "5%" }}>#</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "40%" }}>Description</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "10%", textAlign: "right" }}>Quantity</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "10%" }}>UoM</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "10%", textAlign: "right" }}>Price</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "10%", textAlign: "right" }}>Tax %</th>
              <th style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", fontWeight: "bold", width: "15%", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px" }}>
                  {String(index + 1).padStart(3, '0')}
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px" }}>
                  <div style={{ fontWeight: "bold", fontSize: "12px", color: "#222" }}>{item.item_name || item.description || "-"}</div>
                  <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
                    Item Code: {item.item_code || "-"}<br />
                    Delivery Date: {formatDateShort((item as any).delivery_date || order.delivery_date)}
                  </div>
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", textAlign: "right" }}>
                  {Math.round(item.qty || 0)}
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px" }}>
                  {item.uom || "-"}
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", textAlign: "right" }}>
                  {formatCurrency(item.rate || 0)}
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", textAlign: "right" }}>
                  {formatCurrency(taxRate)}
                </td>
                <td style={{ border: "1px solid #d1d5db", padding: "6px 4px", fontSize: "12px", textAlign: "right" }}>
                  {formatCurrency(item.amount || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Blue Line */}
        <div style={{ 
          borderTop: "1px solid #0070c0",
          marginTop: "8px",
          marginBottom: "8px"
        }}></div>
        
        {/* Summary and Tax Details */}
        <div style={{ display: "flex", marginTop: "8px" }}>
          <div style={{ flex: "0 0 58%" }}>
            {/* Tax Details Table */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "500", marginBottom: "4px", display: "block" }}>Tax Details</span>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "8px",
                border: "1px solid #d1d5db"
              }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f6fa" }}>
                    <th style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "500", color: "#888", textAlign: "right" }}>Tax %</th>
                    <th style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "500", color: "#888", textAlign: "right" }}>Net</th>
                    <th style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "500", color: "#888", textAlign: "right" }}>Tax</th>
                    <th style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "500", color: "#888", textAlign: "right" }}>Gross</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", textAlign: "right" }}>{formatCurrency(taxRate)}</td>
                    <td style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", textAlign: "right" }}>{order.currency} {formatCurrency(netTotal)}</td>
                    <td style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", textAlign: "right" }}>{order.currency} {formatCurrency(taxAmount)}</td>
                    <td style={{ border: "1px solid #d1d5db", padding: "2px 6px", fontSize: "10px", fontWeight: "bold", textAlign: "right" }}>{order.currency} {formatCurrency(order.grand_total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "500", marginRight: "6px" }}>Payment Term:</span>
              <span style={{ fontSize: "10px", color: "#222", fontWeight: "bold", marginRight: "18px" }}>90 days</span>
            </div>
            
            <div style={{ marginBottom: "8px" }}>
              <span style={{ fontSize: "10px", color: "#888", fontWeight: "500", marginRight: "6px" }}>Additional Expenses:</span>
              <span style={{ fontSize: "10px", color: "#222", fontWeight: "bold", marginRight: "18px" }}>
                Shipping Type: {order.shipping_type || "-"}
              </span>
            </div>
          </div>
          
          <div style={{ flex: "0 0 42%", marginLeft: "15px" }}>
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "9px",
              marginTop: "18px"
            }}>
              <span style={{ color: "#888", fontWeight: "500", flex: "1 1 60%" }}>Order Subtotal:</span>
              <span style={{ color: "#222", fontWeight: "bold", flex: "1 1 40%", textAlign: "right" }}>
                SAR {formatCurrency(netTotal)}
              </span>
            </div>
            <div style={{ 
              borderTop: "1px solid #0070c0",
              marginTop: "2px",
              marginBottom: "2px"
            }}></div>
            
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "9px"
            }}>
              <span style={{ color: "#888", fontWeight: "500", flex: "1 1 60%" }}>Total Before Tax:</span>
              <span style={{ color: "#222", fontWeight: "bold", flex: "1 1 40%", textAlign: "right" }}>
                SAR {formatCurrency(netTotal)}
              </span>
            </div>
            <div style={{ 
              borderTop: "1px solid #0070c0",
              marginTop: "2px",
              marginBottom: "2px"
            }}></div>
            
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "9px"
            }}>
              <span style={{ color: "#888", fontWeight: "500", flex: "1 1 60%" }}>Total Tax Amount:</span>
              <span style={{ color: "#222", fontWeight: "bold", flex: "1 1 40%", textAlign: "right" }}>
                SAR {formatCurrency(taxAmount)}
              </span>
            </div>
            <div style={{ 
              borderTop: "1px solid #0070c0",
              marginTop: "2px",
              marginBottom: "2px"
            }}></div>
            
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "9px"
            }}>
              <span style={{ color: "#888", fontWeight: "500", flex: "1 1 60%" }}>Total Amount:</span>
              <span style={{ color: "#222", fontWeight: "bold", flex: "1 1 40%", textAlign: "right" }}>
                SAR {formatCurrency(order.grand_total)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        <div style={{ 
          marginTop: "12px",
          fontSize: "11px",
          color: "#222"
        }}>
          {order.remarks ? (
            <>
              {order.remarks}<br />
            </>
          ) : null}
          {order.allow_partial_delivery && (
            <>
              <strong>Allow Partial Delivery</strong><br />
            </>
          )}
          <strong>Confirmation of Sales Order</strong>
        </div>
        
        {/* Signature Section */}
        <div style={{ 
          display: "flex",
          marginTop: "12px"
        }}>
          <div style={{ flex: "1" }}>
            <div style={{ 
              borderBottom: "1.5px solid #0070c0",
              width: "160px",
              display: "inline-block",
              marginRight: "18px",
              height: "18px"
            }}></div>
            <span style={{ marginLeft: "8px", fontSize: "11px" }}>Signature</span>
          </div>
          <div style={{ flex: "1" }}>
            <div style={{ 
              borderBottom: "1.5px solid #0070c0",
              width: "160px",
              display: "inline-block",
              marginRight: "18px",
              height: "18px"
            }}></div>
            <span style={{ marginLeft: "8px", fontSize: "11px" }}>Date</span>
          </div>
        </div>
        
        {/* Blue Line */}
        <div style={{ 
          borderTop: "1px solid #0070c0",
          marginTop: "8px",
          marginBottom: "8px"
        }}></div>
        
        {/* Footer Grid */}
        <div style={{ 
          display: "flex",
          marginTop: "16px",
          fontSize: "10px",
          color: "#888"
        }}>
          <div style={{ flex: "1" }}>
            CEO:<br />
            Tax Official:<br />
            Headquarters:<br />
            Website:
          </div>
          <div style={{ flex: "1" }}>
            Phone:<br />
            Fax:<br />
            E-Mail:<br />
            Tax No.:<br />
            Tax ID No.:
          </div>
          <div style={{ flex: "1" }}>
            Bank Name:<br />
            Bank Account:<br />
            Bank Code:<br />
            Swift/BIC Code:<br />
            IBAN:
          </div>
        </div>
        
        {/* Date/Time Footer */}
        <div style={{ 
          textAlign: "right",
          fontSize: "11px",
          color: "#888",
          marginTop: "8px"
        }}>
          {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

export default SalesOrderPrint;
