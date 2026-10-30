import React from "react";
import { SalesInvoice } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
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
  
  // Generate QR code data with invoice information
  const qrCodeData = JSON.stringify({
    invoice: invoice.name,
    date: invoice.posting_date,
    total: invoice.grand_total,
    currency: invoice.currency || 'SAR',
    customer: invoice.customer
  });
  
  return (
    <div className="print-container">
      {showPrintButton && (
        <button onClick={handlePrint} className="print-button print-hide">
          Print / Save as PDF
        </button>
      )}
      
      <div className="print-document">
        {/* Header Section - Matching ERPNext Template */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "flex-start",
          borderBottom: "2px solid #000",
          paddingBottom: "15px",
          marginBottom: "20px"
        }}>
          {/* Left Column - English Company Info */}
          <div style={{ flex: "0 0 33%", fontSize: "11px", lineHeight: "1.4" }}>
            <strong>BRC INDUSTRIAL SAUDIA CO.</strong><br />
            Industrial City 1 - Phase 1<br />
            Jeddah - Saudi Arabia<br />
            Tel.: Jeddah (012) 6355666 / 6358145/67/78<br />
            Tel.: Riyadh (011) 4620703 / 4602692<br />
            Tel.: Dammam (013) 8082954<br />
            VAT: 300188735800003<br />
            CR: 4030008649
          </div>
          
          {/* Center Column - Logos and Title */}
          <div style={{ 
            flex: "0 0 33%", 
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center",
              gap: "20px",
              marginBottom: "10px"
            }}>
              {invoice.brc_logo_url ? (
                <img 
                  src={invoice.brc_logo_url}
                  alt="BRC Logo"
                  style={{ maxWidth: "100px", height: "auto" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ width: "100px", height: "60px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#999" }}>
                  BRC Logo
                </div>
              )}
              {invoice.vision2030_logo_url ? (
                <img 
                  src={invoice.vision2030_logo_url}
                  alt="Vision 2030 Logo"
                  style={{ maxWidth: "80px", height: "auto" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ width: "80px", height: "50px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: "#999" }}>
                  Vision 2030
                </div>
              )}
            </div>
            <div>
              <div style={{ 
                fontSize: "16px", 
                fontWeight: "bold",
                direction: "rtl",
                marginBottom: "5px"
              }}>
                فاتورة ضريبية
              </div>
              <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                Tax Invoice
              </div>
            </div>
          </div>
          
          {/* Right Column - Arabic Company Info */}
          <div style={{ 
            flex: "0 0 33%", 
            fontSize: "11px", 
            lineHeight: "1.4",
            textAlign: "right",
            direction: "rtl"
          }}>
            شركة بي آر سي الصناعية السعودية المحدودة<br />
            المدينة الصناعية الأولى - المرحلة الأولى<br />
            جدة - المملكة العربية السعودية<br />
            هاتف: (012) 6355666 / 6358145/67/78<br />
            هاتف: (011) 4620703 / 4602692<br />
            هاتف: (013) 8082954<br />
            الرقم الضريبي: 300188735800003<br />
            السجل التجاري: 4030008649
          </div>
        </div>
        
        {/* Main Info Table */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "20px",
          fontSize: "11px"
        }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px", width: "25%" }}>
                <div style={{ marginBottom: "5px" }}>
                  <strong>Customer No.</strong>
                  <div dir="rtl" lang="ar" style={{ fontWeight: 700, marginTop: "2px" }}>
                    رقم العميل
                  </div>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.customer || "-"}</div>
              </td>
              <td style={{ padding: "8px", width: "25%" }}>
                <div style={{ marginBottom: "5px" }}>
                  <strong>Customer Name</strong>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.customer_name || "-"}</div>
                <div dir="rtl" lang="ar" style={{ fontWeight: 700, marginTop: "6px" }}>
                  اسم العميل
                </div>
                {invoice.customer_arabic_name && (
                  <div dir="rtl" lang="ar" style={{ margin: "5px 0", textAlign: "right", fontWeight: 600 }}>
                    {invoice.customer_arabic_name}
                  </div>
                )}
              </td>
              <td style={{ padding: "8px", width: "25%" }}></td>
              <td style={{ padding: "8px", width: "25%" }}></td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Invoice No.</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>رقم الفاتورة</span>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.name || "-"}</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Invoice Date</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>تاريخ الفاتورة</span>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.posting_date ? formatDate(invoice.posting_date) : "-"}</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Due Date</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>تاريخ الاستحقاق</span>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Order No.</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>رقم الطلب</span>
                </div>
                <div style={{ margin: "5px 0" }}>-</div>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>VAT No.</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>الرقم الضريبي</span>
                </div>
                <div style={{ margin: "5px 0" }}>{invoice.customer_tax_id || invoice.tax_id || "300188735800003"}</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>PO No.</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>رقم أمر الشراء</span>
                </div>
                <div style={{ margin: "5px 0" }}>-</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>PO Date</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>تاريخ أمر الشراء</span>
                </div>
                <div style={{ margin: "5px 0" }}>-</div>
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Shipment Date</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>تاريخ الشحن</span>
                </div>
                <div style={{ margin: "5px 0" }}>-</div>
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px", verticalAlign: "top" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Delivery Address</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>عنوان التسليم</span>
                </div>
                <div style={{ fontSize: "11px", marginTop: "5px", whiteSpace: "pre-wrap" }}>
                  {invoice.shipping_address_display || invoice.address_display || "-"}
                </div>
              </td>
              <td style={{ padding: "8px", verticalAlign: "top" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <strong>Customer Address</strong>
                  <span style={{ direction: "rtl", fontSize: "11px" }}>عنوان العميل</span>
                </div>
                <div style={{ fontSize: "11px", marginTop: "5px", whiteSpace: "pre-wrap" }}>
                  {invoice.address_display || "-"}
                </div>
              </td>
              <td colSpan={2} style={{ padding: "8px", verticalAlign: "top" }}>
                <div>
                  <span style={{ borderBottom: "1px solid #ddd", display: "block", paddingBottom: "3px", marginBottom: "5px" }}>
                    <strong>Payment Term</strong> / <span style={{ direction: "rtl" }}>شروط الدفع</span>: 30 Days
                  </span>
                  <span style={{ borderBottom: "1px solid #ddd", display: "block", paddingBottom: "3px", marginBottom: "5px" }}>
                    <strong>Delivery Term</strong> / <span style={{ direction: "rtl" }}>شروط التسليم</span>: Ex-Works
                  </span>
                  <span style={{ borderBottom: "1px solid #ddd", display: "block", paddingBottom: "3px", marginBottom: "5px" }}>
                    <strong>Ref. No.</strong> / <span style={{ direction: "rtl" }}>إشارتكم</span>: {invoice.comments ? invoice.comments.substring(0, 20) : "-"}
                  </span>
                  <span style={{ display: "block", paddingBottom: "3px" }}>
                    <strong>Project Name</strong> / <span style={{ direction: "rtl" }}>اسم المشروع</span>: -
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        
        {/* Items Table */}
        <table className="items-table" style={{ 
          marginTop: "20px",
          border: "1px solid #ddd",
          borderCollapse: "collapse",
          width: "100%"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                Code<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>كود</span>
              </th>
              <th style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                Description<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>الوصف</span>
              </th>
              <th className="text-right" style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                Qty<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>الكمية</span>
              </th>
              <th className="text-right" style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                Price<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>السعر</span>
              </th>
              <th className="text-right" style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                VAT %<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>ضريبة %</span>
              </th>
              <th className="text-right" style={{ 
                border: "1px solid #ddd", 
                padding: "8px",
                backgroundColor: "#f5f5f5"
              }}>
                Amount S.R.<br />
                <span style={{ direction: "rtl", fontSize: "12px" }}>المبلغ ر.س</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.item_code || "-"}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                  <div className="item-name">{item.item_name || item.description || "-"}</div>
                  {item.description && item.description !== item.item_name && (
                    <div className="item-description">{item.description}</div>
                  )}
                  {item.arabic_description && (
                    <div className="item-description" dir="rtl" lang="ar" style={{ textAlign: "right", marginTop: "4px", fontWeight: 500 }}>
                      {item.arabic_description}
                    </div>
                  )}
                </td>
                <td className="text-right" style={{ border: "1px solid #ddd", padding: "8px" }}>{Math.round(item.qty || 0)}</td>
                <td className="text-right" style={{ border: "1px solid #ddd", padding: "8px" }}>{formatCurrency(item.rate || 0)}</td>
                <td className="text-right" style={{ border: "1px solid #ddd", padding: "8px" }}>15%</td>
                <td className="text-right" style={{ border: "1px solid #ddd", padding: "8px" }}>{formatCurrency(item.amount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* QR Code and Totals Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "25px" }}>
          {/* QR Code on the left */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ 
              display: "inline-block", 
              padding: "8px", 
              border: "1px solid #E5E7EB", 
              borderRadius: "4px",
              backgroundColor: "#FFFFFF"
            }}>
              <QRCodeSVG 
                value={qrCodeData}
                size={80}
                level="M"
                includeMargin={false}
              />
            </div>
            <p style={{ marginTop: "4px", fontSize: "10px", color: "#6B7280" }}>Invoice QR Code</p>
          </div>
          
          {/* Totals on the right */}
          <div className="order-totals">
            <div className="totals-row">
              <div style={{ width: "60%" }}>
                <span style={{ direction: "rtl", display: "block", fontSize: "11px" }}>دفعة مقدمة (خصم)</span>
                <span>Down Payment (Deduct)</span>
              </div>
              <div style={{ width: "40%", textAlign: "right" }}>
                {formatCurrency(invoice.paid_amount || 0)}
              </div>
            </div>
            
            <div className="totals-row">
              <div style={{ width: "60%" }}>
                <span style={{ direction: "rtl", display: "block", fontSize: "11px" }}>إجمالي قيمة الفاتورة</span>
                <span>Sub Total Amount</span>
              </div>
              <div style={{ width: "40%", textAlign: "right" }}>
                {formatCurrency(subtotal)}
              </div>
            </div>
            
            <div className="totals-row">
              <div style={{ width: "60%" }}>
                <span style={{ direction: "rtl", display: "block", fontSize: "11px" }}>إجمالي الفاتورة بدون الضريبة</span>
                <span>Total Exclusive VAT</span>
              </div>
              <div style={{ width: "40%", textAlign: "right" }}>
                {formatCurrency(subtotal - (invoice.total_taxes_and_charges || 0))}
              </div>
            </div>
            
            <div className="totals-row">
              <div style={{ width: "60%" }}>
                <span style={{ direction: "rtl", display: "block", fontSize: "11px" }}>إجمالي الضريبة</span>
                <span>Total VAT</span>
              </div>
              <div style={{ width: "40%", textAlign: "right" }}>
                {formatCurrency(invoice.total_taxes_and_charges || 0)}
              </div>
            </div>
            
            <div className="totals-row grand-total">
              <div style={{ width: "60%" }}>
                <span style={{ direction: "rtl", display: "block", fontSize: "11px" }}>قيمة الفاتورة</span>
                <span>Invoice Amount</span>
              </div>
              <div style={{ width: "40%", textAlign: "right" }}>
                {formatCurrency(invoice.grand_total)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Signature Section */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          marginTop: "30px",
          marginBottom: "20px",
          fontSize: "11px"
        }}>
          <div style={{ flex: "1" }}>
            <strong>Received By / استلم من:</strong>
          </div>
          <div style={{ flex: "1" }}>
            <strong>Signature / التوقيع:</strong>
          </div>
          <div style={{ flex: "1" }}>
            <strong>Date / التاريخ:</strong>
          </div>
          <div style={{ flex: "1" }}>
            <strong>Mobile / الجوال:</strong>
          </div>
        </div>
        
        {/* Footer Notes */}
        <div style={{ 
          marginTop: "30px",
          marginBottom: "15px",
          fontSize: "10px",
          lineHeight: "1.6"
        }}>
          <strong>Important Note:</strong><br />
          - Any discrepancies should be notified in writing within 48 hours of delivery<br />
          - All material will remain the property of company until the invoice paid in full<br />
          - Payments received will be receipted against oldest invoices outstanding if details of which invoice are being paid are not provided with payment
        </div>
        
        {/* Footer Bottom */}
        <div style={{ 
          textAlign: "right",
          fontSize: "10px",
          borderTop: "1px solid #ddd",
          paddingTop: "10px",
          marginTop: "20px"
        }}>
          www.brc.com.sa &nbsp; | &nbsp; brcsales@brc.com.sa
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;