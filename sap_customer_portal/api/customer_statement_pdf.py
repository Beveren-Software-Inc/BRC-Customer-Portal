import frappe
from frappe import _
from frappe.utils import getdate
from sap_customer_portal.api.customer_statement import (
    get_customer_statement_data, 
    get_customer_company, 
    validate_customer_access,
    generate_statement_html
)

@frappe.whitelist()
def get_customer_statement_pdf_preview(customer=None, from_date=None, to_date=None, company=None):
    """
    Generate PDF preview content for customer statement that can be opened in browser
    
    Args:
        customer (str): Customer ID
        from_date (str): Start date
        to_date (str): End date
        company (str): Company (optional)
        
    Returns:
        dict: HTML content for PDF preview
    """
    try:
        # Validate parameters
        if not customer:
            frappe.throw(_("Customer is required"))
        if not from_date or not to_date:
            frappe.throw(_("From date and to date are required"))
            
        # Validate date format and range
        try:
            from_date = getdate(from_date)
            to_date = getdate(to_date)
        except Exception:
            frappe.throw(_("Invalid date format"))
            
        if from_date > to_date:
            frappe.throw(_("From date cannot be later than to date"))
        
        # Get company if not provided
        if not company:
            company = get_customer_company(customer)
            
        # Validate customer access
        validate_customer_access(customer)
        
        # Get statement data
        statement_data = get_customer_statement_data(customer, from_date, to_date, company)
        
        if not statement_data or not statement_data.get("result"):
            frappe.throw(_("No data found for the given date range"))
        
        # Get customer and company details
        customer_doc = frappe.get_doc("Customer", customer)
        company_doc = frappe.get_doc("Company", company)
        
        # Prepare data for HTML template
        pdf_data = {
            "customer": customer,
            "customer_name": customer_doc.customer_name,
            "company": company,
            "company_name": company_doc.company_name,
            "from_date": from_date,
            "to_date": to_date,
            "columns": statement_data.get("columns", []),
            "data": statement_data.get("result", []),
            "closing_balance": statement_data.get("result", [])[-1][5] if statement_data.get("result") else 0
        }
        
        # Generate print-friendly HTML
        html_content = generate_print_preview_html(pdf_data)
        
        return {
            "html_content": html_content,
            "success": True
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_statement_pdf_preview: {str(e)}")
        frappe.throw(_("Failed to generate PDF preview. Please try again or contact support."))


def generate_print_preview_html(data):
    from sap_customer_portal.utils import _get_logo_path
    _logo_path = _get_logo_path()
    """
    Generate HTML content optimized for print preview
    
    Args:
        data (dict): Statement data including customer, company, and transaction details
        
    Returns:
        str: HTML content for print preview
    """
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Customer Statement - {data['customer']}</title>
        <style>
            @media print {{
                body {{ margin: 0; }}
                .no-print {{ display: none; }}
            }}
            
            body {{
                font-family: Arial, sans-serif;
                margin: 20px;
                font-size: 11px;
                line-height: 1.4;
            }}
            
            .print-header {{
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #f8f9fa;
                padding: 10px 20px;
                border-bottom: 1px solid #dee2e6;
                z-index: 1000;
            }}
            
            .print-content {{
                margin-top: 80px;
            }}
            
            .header {{
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
            }}
            
            .company-name {{
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 8px;
                color: #333;
            }}
            
            .statement-title {{
                font-size: 14px;
                font-weight: bold;
                margin-top: 10px;
                color: #666;
            }}
            
            .customer-info {{
                margin-bottom: 25px;
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
            }}
            
            .info-row {{
                margin-bottom: 8px;
                display: flex;
            }}
            
            .label {{
                font-weight: bold;
                min-width: 120px;
                color: #495057;
            }}
            
            .value {{
                flex: 1;
                color: #212529;
            }}
            
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
                font-size: 10px;
            }}
            
            th, td {{
                border: 1px solid #dee2e6;
                padding: 8px 6px;
                text-align: left;
                vertical-align: top;
            }}
            
            th {{
                background-color: #e9ecef;
                font-weight: bold;
                color: #495057;
                font-size: 9px;
                text-transform: uppercase;
            }}
            
            .currency {{
                text-align: right;
                font-family: 'Courier New', monospace;
            }}
            
            .closing-row {{
                background-color: #f8f9fa;
                font-weight: bold;
                border-top: 2px solid #495057;
            }}
            
            .footer {{
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #dee2e6;
                font-size: 9px;
                color: #6c757d;
                text-align: center;
            }}
            
            .print-button {{
                background-color: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                margin-right: 10px;
            }}
            
            .print-button:hover {{
                background-color: #0056b3;
            }}
            
            .close-button {{
                background-color: #6c757d;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }}
            
            .close-button:hover {{
                background-color: #545b62;
            }}
            
            .date-cell {{
                white-space: nowrap;
            }}
            
            .remarks-cell {{
                max-width: 200px;
                word-wrap: break-word;
            }}
        </style>
        
        <script>
            function printStatement() {{
                window.print();
            }}
            
            function closePreview() {{
                window.close();
            }}
        </script>
    </head>
    <body>
        <div class="print-header no-print">
            <button class="print-button" onclick="printStatement()">🖨️ Print Statement</button>
            <button class="close-button" onclick="closePreview()">✕ Close</button>
        </div>
        
        <div class="print-content">
            <div class="header">
                <div style="display: flex; justify-content: center; align-items: center; margin-bottom: 10px;">
                    <img width="200px" height="100px" src="{_logo_path}" alt="Company Logo" class="logo">
                </div>
                <div class="company-name">{data['company_name']}</div>
                <div class="statement-title">Customer Statement</div>
            </div>
            
            <div class="customer-info">
                <div class="info-row">
                    <span class="label">Customer:</span>
                    <span class="value">{data['customer']} - {data['customer_name']}</span>
                </div>
                <div class="info-row">
                    <span class="label">Statement Period:</span>
                    <span class="value">{data['from_date']} to {data['to_date']}</span>
                </div>
                <div class="info-row">
                    <span class="label">Generated On:</span>
                    <span class="value">{frappe.utils.now()}</span>
                </div>
                <div class="info-row">
                    <span class="label">Closing Balance:</span>
                    <span class="value">SAR {data['closing_balance']:,.2f}</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
    """
    
    # Add column headers
    for col in data['columns']:
        html += f"<th>{col['label']}</th>"
    
    html += """
                    </tr>
                </thead>
                <tbody>
    """
    
    # Add data rows
    for row in data['data']:
        row_class = 'closing-row' if row[1] == 'Closing Balance' else ''
        html += f'<tr class="{row_class}">'
        
        for i, cell in enumerate(row):
            # Get column info
            col_type = data['columns'][i]['fieldtype'] if i < len(data['columns']) else 'Data'
            col_name = data['columns'][i]['fieldname'] if i < len(data['columns']) else ''
            
            # Apply appropriate CSS class
            css_class = ""
            if col_type == 'Currency':
                css_class = "currency"
            elif col_name == 'posting_date':
                css_class = "date-cell"
            elif col_name == 'remarks':
                css_class = "remarks-cell"
            
            # Format cell content
            if col_type == 'Currency' and isinstance(cell, (int, float)) and cell != "":
                formatted_cell = f"SAR {cell:,.2f}"
                html += f'<td class="{css_class}">{formatted_cell}</td>'
            elif cell == "":
                html += f'<td class="{css_class}"></td>'
            else:
                # Handle multi-line remarks
                if isinstance(cell, str) and '\n' in cell:
                    formatted_cell = cell.replace('\n', '<br>')
                    html += f'<td class="{css_class}">{formatted_cell}</td>'
                else:
                    html += f'<td class="{css_class}">{cell}</td>'
        
        html += '</tr>'
    
    html += f"""
                </tbody>
            </table>
            
            <div class="footer">
                <p>This statement was generated automatically on {frappe.utils.now()}</p>
                <p>For any queries regarding this statement, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html
