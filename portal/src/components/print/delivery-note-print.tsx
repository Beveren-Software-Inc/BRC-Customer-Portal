import React from "react";
import { DeliveryNote } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
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

  
  // Generate QR code data
  const qrCodeData = JSON.stringify({
    deliveryNote: deliveryNote.name,
    date: deliveryNote.posting_date,
    customer: deliveryNote.customer
  });
  
  return (
    <div className="print-container">
      {showPrintButton && (
        <button onClick={handlePrint} className="print-button print-hide">
          Print / Save as PDF
        </button>
      )}
      
      <div className="print-document">
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
          {/* Left Column: BRC Logo and Address */}
          <div style={{ flex: "0 0 32%", marginRight: "15px" }}>
            <div style={{ marginBottom: "8px" }}>
              {deliveryNote.brc_logo_url ? (
                <img 
                  src={deliveryNote.brc_logo_url}
                  alt="BRC Logo"
                  style={{ height: "50px", maxWidth: "100%" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ height: "50px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>BRC Logo</div>
              )}
            </div>
            
            <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222" }}>
              <strong>BRC Industrial Saudia Co.</strong><br />
              P.O Box 5489 Jeddah 21422 - Saudi Arabia<br />
              C.R.: 4030008649<br />
              COC: 1712<br />
              Tel: Jeddah (012) 6355666 / 6358145/67/78<br />
              Tel: Riyadh (011) 4620703 / 4602692<br />
              Tel: Dammam (013) 8082954<br />
              Fax: Jeddah (012) 6375474<br />
              Fax: Dammam (013) 8124103<br />
              www.brc.com.sa<br />
              email: brcsales@brc.com.sa
            </div>
          </div>
          
          {/* Center Column: Title */}
          <div style={{ flex: "0 0 32%", textAlign: "center" }}>
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              fontSize: "16px",
              fontWeight: "bold"
            }}>
              <span>Delivery Note</span>
              <span style={{ direction: "rtl" }}>سند التسليم</span>
            </div>
            
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
              fontSize: "11px"
            }}>
              <strong style={{ fontSize: "10px" }}>Delivery No:</strong>
              <span style={{ margin: "0 10px", fontSize: "11px" }}>{deliveryNote.name || "-"}</span>
              <span style={{ direction: "rtl", fontSize: "10px" }}>رقم التسليم</span>
            </div>
            
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px"
            }}>
              <strong style={{ fontSize: "10px" }}>Date:</strong>
              <span style={{ margin: "0 10px", fontSize: "11px" }}>{formatDate(deliveryNote.posting_date)}</span>
              <span style={{ direction: "rtl", fontSize: "10px" }}>التاريخ</span>
            </div>
          </div>
          
          {/* Right Column: Vision 2030 Logo and Arabic Address */}
          <div style={{ flex: "0 0 32%", textAlign: "right", paddingLeft: "10px" }}>
            <div style={{ marginBottom: "8px", textAlign: "right", display: "flex", justifyContent: "flex-end" }}>
              {deliveryNote.vision2030_logo_url ? (
                <img 
                  src={deliveryNote.vision2030_logo_url}
                  alt="Vision 2030 Logo"
                  style={{ height: "50px", maxWidth: "100%", marginLeft: "auto" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ height: "50px", backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", marginLeft: "auto" }}>Vision 2030</div>
              )}
            </div>
            
            <div style={{ fontSize: "11px", lineHeight: "1.4", color: "#222", direction: "rtl", textAlign: "right" }}>
              <strong>شركة بي آر سي الصناعية السعودية المحدودة</strong><br />
              ص.ب 5489 جدة 21422 - المملكة العربية السعودية<br />
              س.ت: 4030008649<br />
              1712<br />
              هاتف: جدة (012) 6355666 / 6358145/67/78<br />
              هاتف: الرياض (011) 4620703 / 4602692<br />
              هاتف: الدمام (013) 8082954<br />
              فاكس: جدة (012) 6375474<br />
              فاكس: الدمام (013) 8124103<br />
              www.brc.com.sa<br />
              email: brcsales@brc.com.sa
            </div>
          </div>
        </div>
        
        {/* Horizontal Line */}
        <hr style={{ borderTop: "2px solid #333", margin: "20px 0" }} />
        
        {/* Customer Information Table */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "20px",
          fontSize: "11px",
          border: "1px solid #ddd"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Customer / العميل</th>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Ship To / شحن إلى</th>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Your Order No / رقم طلبكم</th>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Date / التاريخ</th>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Our Ref. No / مرجعنا رقم</th>
              <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Notes / ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ border: "1px solid #ddd", padding: "8px", verticalAlign: "top" }}>
                <div style={{ marginBottom: "5px", fontWeight: "bold" }}>{deliveryNote.customer_name || deliveryNote.customer || "-"}</div>
                <div style={{ fontSize: "10px", whiteSpace: "pre-wrap" }}>
                  {deliveryNote.address_display || "-"}
                </div>
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px", verticalAlign: "top" }}>
                <div style={{ fontSize: "10px", whiteSpace: "pre-wrap" }}>
                  {deliveryNote.shipping_address_display || deliveryNote.address_display || "-"}
                </div>
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {deliveryNote.po_no || "-"}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {formatDate(deliveryNote.posting_date)}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                {deliveryNote.customer_po_no || "-"}
              </td>
              <td style={{ border: "1px solid #ddd", padding: "8px", fontSize: "10px" }}>
                Based on Sales Orders {deliveryNote.sales_order || "-"}
              </td>
            </tr>
          </tbody>
        </table>
        
        {/* Items Table */}
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "20px",
          border: "1px solid #ddd"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5" }}>
              <th style={{ border: "1px solid #ddd", padding: "8px", fontSize: "11px", fontWeight: "bold" }}>
                Part no.<br />
                <span style={{ direction: "rtl", fontSize: "11px" }}>رقم القطعة</span>
              </th>
              <th style={{ border: "1px solid #ddd", padding: "8px", fontSize: "11px", fontWeight: "bold" }}>
                Description<br />
                <span style={{ direction: "rtl", fontSize: "11px" }}>الوصف</span>
              </th>
              <th style={{ border: "1px solid #ddd", padding: "8px", fontSize: "11px", fontWeight: "bold", textAlign: "right" }}>
                Quantity<br />
                <span style={{ direction: "rtl", fontSize: "11px" }}>الكمية</span>
              </th>
              <th style={{ border: "1px solid #ddd", padding: "8px", fontSize: "11px", fontWeight: "bold" }}>
                Unit<br />
                <span style={{ direction: "rtl", fontSize: "11px" }}>الوحدة</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {deliveryNote.items.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #ddd", padding: "8px", fontSize: "10px" }}>{item.item_code || "-"}</td>
                <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left", fontSize: "10px" }}>
                  {item.description || item.item_name || "-"}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "right", fontSize: "10px" }}>
                  {Math.round(item.qty || 0).toLocaleString()}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "8px", fontSize: "10px" }}>{item.uom || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Bottom Section with QR and Signature */}
        <div style={{ display: "flex", marginTop: "40px" }}>
          {/* Left Section - Receiver Details */}
          <div style={{ flex: "0 0 33%" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "9px" }}>RECEIVED BY: </strong>
                <span style={{ margin: "0 10px", fontSize: "9px" }}>{deliveryNote.sap_receiver_name || "-"}</span>
                <span style={{ direction: "rtl", fontSize: "9px" }}>استلم من</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "9px" }}>SIGNATURE:</strong>
                <span style={{ direction: "rtl", fontSize: "9px" }}>التوقيع</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "9px" }}>STAMP:</strong>
                <span style={{ direction: "rtl", fontSize: "9px" }}>الختم</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "9px" }}>Date:</strong>
                <span style={{ direction: "rtl", fontSize: "9px" }}>التاريخ</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong style={{ fontSize: "9px" }}>MOBILE:</strong>
                <span style={{ direction: "rtl", fontSize: "9px" }}>الجوال</span>
              </div>
            </div>
          </div>
          
          {/* Center Section - QR Code */}
          <div style={{ flex: "0 0 33%", textAlign: "center" }}>
            {deliveryNote.qr_code ? (
              <img 
                src={`data:image/png;base64,${deliveryNote.qr_code}`}
                alt="QR Code"
                style={{ width: "100px", height: "100px" }}
              />
            ) : (
              <div style={{ display: "inline-block", padding: "8px", border: "1px solid #E5E7EB", borderRadius: "4px" }}>
                <QRCodeSVG 
                  value={qrCodeData}
                  size={100}
                  level="M"
                  includeMargin={false}
                />
              </div>
            )}
          </div>
          
          {/* Right Section - Driver Details */}
          <div style={{ flex: "0 0 33%" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "9px" }}>CARRIER:</strong>
                <span style={{ margin: "0 10px", fontSize: "9px" }}>{deliveryNote.sap_carrier || "-"}</span>
                <span style={{ direction: "rtl", fontSize: "9px" }}>الناقل</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "9px" }}>DRIVER NAME:</strong>
                <span style={{ margin: "0 10px", fontSize: "9px" }}>{deliveryNote.sap_driver_name || "-"}</span>
                <span style={{ direction: "rtl", fontSize: "9px" }}>اسم السائق</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "9px" }}>TRUCK NO:</strong>
                <span style={{ margin: "0 10px", fontSize: "9px" }}>{deliveryNote.sap_truck_no || "-"}</span>
                <span style={{ direction: "rtl", fontSize: "9px" }}>رقم الشاحنة</span>
              </div>
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "9px" }}>MOBILE NO:</strong>
                <span style={{ margin: "0 10px", fontSize: "9px" }}>{deliveryNote.sap_mobile_no || "-"}</span>
                <span style={{ direction: "rtl", fontSize: "9px" }}>رقم الجوال</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Notes */}
        <div style={{ marginTop: "30px", fontSize: "11px", color: "#222" }}>
          <strong>Important Note:</strong> - Any discrepancies should be notified in writing within 48 hours of delivery.<br />
          <span style={{ marginLeft: "100px" }}>- All material will remain the property of company until the invoice paid in full</span><br />
          <span style={{ marginLeft: "100px" }}>- Payments received will be receipted against oldest invoices outstanding if details of which invoice are being paid are not provided with payment.</span>
        </div>
      </div>
    </div>
  );
};

export default DeliveryNotePrint;
