import frappe
from frappe import _
from frappe.utils import getdate


def get_customer_company(customer):
    """
    Get the company from the customer's invoices
    
    Args:
        customer (str): Customer ID
        
    Returns:
        str: Company name
    """
    try:
        # Get company from customer's sales invoices
        companies = frappe.get_all(
            "Sales Invoice",
            filters={"customer": customer, "docstatus": 1},
            fields=["company"],
            limit=1
        )
        
        if companies:
            return companies[0].company
            
        # Fallback: get from sales orders if no invoices
        companies = frappe.get_all(
            "Sales Order", 
            filters={"customer": customer, "docstatus": 1},
            fields=["company"],
            limit=1
        )
        
        if companies:
            return companies[0].company
            
        # Final fallback: get default company
        default_company = frappe.db.get_single_value("Global Defaults", "default_company")
        if default_company:
            return default_company
            
        # If no default company, get first available company
        companies = frappe.get_all("Company", fields=["name"], limit=1)
        if companies:
            return companies[0].name
            
        frappe.throw(_("No company found for customer statement"))
        
    except Exception as e:
        frappe.log_error(f"Error getting customer company: {str(e)}")
        frappe.throw(_("Unable to determine company for customer statement"))


def validate_customer_access(customer):
    """
    Validate that the current user has access to this customer's data
    This ensures customers can only see their own statements
    
    Args:
        customer (str): Customer ID to validate access for
    """
    # Get current user
    user = frappe.session.user
    
    # Skip validation for Administrator and System Manager
    if user == "Administrator" or "System Manager" in frappe.get_roles():
        return
        
    # For portal users, check if they have access to this customer
    if frappe.session.user_type == "Website User":
        # Get the customer linked to current user
        user_customer = frappe.db.get_value("User", user, "customer")
        
        if user_customer != customer:
            frappe.throw(_("You can only access your own customer statement data"))
    
    # For internal users, they should have Customer role or similar
    # Additional validation can be added here if needed


@frappe.whitelist()
def get_customer_list():
    """
    Get list of customers available to the current user for customer statements.
    This respects user permissions and returns appropriate customers based on user role.
    """
    try:
        user = frappe.session.user
        roles = frappe.get_roles(user)
        
        if user == "Administrator" or "System Manager" in roles:
            # Administrator and System Manager see all customers
            customers = frappe.get_all("Customer", fields=["name", "customer_name"])
        else:
            # For other users, get customers they have access to via Portal User
            portal_users = frappe.get_all(
                "Portal User",
                filters={"user": user, "parenttype": "Customer"},
                fields=["parent"]
            )
            customer_names = [pu.parent for pu in portal_users]
            
            if customer_names:
                customers = frappe.get_all(
                    "Customer",
                    filters={"name": ["in", customer_names]},
                    fields=["name", "customer_name"]
                )
            else:
                customers = []
        
        # Format the response
        result = []
        for customer in customers:
            result.append({
                "customer": customer.name,
                "customer_name": customer.customer_name or customer.name
            })
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_list: {str(e)}")
        return []


@frappe.whitelist()
def download_customer_statement(customer=None, from_date=None, to_date=None, company=None, file_format="PDF"):
    """
    Download customer statement in Excel/PDF format
    This method generates and returns the file for download
    
    Args:
        customer (str): Customer ID
        from_date (str): Start date
        to_date (str): End date
        company (str): Company (optional)
        file_format (str): "Excel" or "PDF"
        
    Returns:
        File download response
    """
    try:
        # Validate parameters (reuse the same validation logic)
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
        
        # Get statement data using SAP data for consistency with preview
        # This ensures downloads show the same chronological order as the preview
        from sap_customer_portal.sap_api_utils import get_customer_statement_from_sap, get_customer_code_from_user
        
        # Get customer code for SAP lookup
        customer_code = None
        try:
            customer_code = get_customer_code_from_user()
        except:
            # Fallback: try to get customer code from customer parameter
            customer_code = customer
        
        if not customer_code:
            frappe.throw(_("Unable to determine customer code for SAP lookup"))
        
        # Get SAP statement data
        sap_statement_data = get_customer_statement_from_sap(customer_code, from_date, to_date)
        
        if not sap_statement_data:
            frappe.throw(_("No data found for the given date range"))
        
        # Convert SAP data to the expected format for downloads
        columns = [
            {"label": "Date", "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
            {"label": "Ref Document", "fieldname": "voucher_type", "fieldtype": "Data", "width": 120},
            {"label": "Ref ID", "fieldname": "voucher_no", "fieldtype": "Dynamic Link", "width": 150},
            {"label": "Debit", "fieldname": "debit", "fieldtype": "Currency", "width": 100},
            {"label": "Credit", "fieldname": "credit", "fieldtype": "Currency", "width": 100},
            {"label": "Balance", "fieldname": "balance", "fieldtype": "Currency", "width": 100},
            {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Data", "width": 200}
        ]
        
        # Process SAP statement data
        result = []
        running_balance = sap_statement_data.get('opening_balance', 0)
        
        # SAP data is already sorted chronologically, so we can use it directly
        transactions = sap_statement_data.get('transactions', [])
        
        for transaction in transactions:
            running_balance += (transaction.get('debit', 0) or 0) - (transaction.get('credit', 0) or 0)
            
            result.append([
                transaction.get('date', ''),
                transaction.get('document_type', ''),
                transaction.get('document_number', ''),
                transaction.get('debit', 0) or 0,
                transaction.get('credit', 0) or 0,
                running_balance,
                transaction.get('remarks', '')
            ])
        
        # Add closing balance row
        result.append([
            "",  # Empty date
            "Closing Balance",
            "",  # Empty ref id
            "",  # Empty debit
            "",  # Empty credit
            running_balance,
            ""   # Empty remarks
        ])
        
        statement_data = {
            "columns": columns,
            "result": result,
            "message": f"Customer Statement for {customer}",
            "chart": {},
            "report_summary": [
                {
                    "value": len(result),
                    "label": "Total Transactions",
                    "datatype": "Int"
                },
                {
                    "value": running_balance,
                    "label": "Closing Balance",
                    "datatype": "Currency"
                }
            ]
        }
        
        if file_format.lower() == "pdf":
            # Create PDF content
            try:
                from frappe.utils.pdf import get_pdf
                
                # Get customer details
                customer_doc = frappe.get_doc("Customer", customer)
                company_doc = frappe.get_doc("Company", company)
                
                # Prepare data for PDF template
                pdf_data = {
                    "customer": customer,
                    "customer_name": customer_doc.customer_name,
                    "company": company,
                    "company_name": company_doc.company_name,
                    "from_date": from_date,
                    "to_date": to_date,
                    "columns": columns,
                    "data": result,
                    "closing_balance": result[-1][5] if result else 0  # Last row, balance column
                }
                
                # Generate HTML for PDF
                html_content = generate_statement_html(pdf_data)
                
                # Debug: Print HTML content for troubleshooting
                print(f"\n\nPDF HTML Content Length: {len(html_content)}\n\n")
                
                # Generate PDF with proper options
                pdf_content = get_pdf(html_content, {
                    "page-size": "A4",
                    "orientation": "landscape",
                    "margin-top": "0.5in",
                    "margin-right": "0.5in",
                    "margin-bottom": "0.5in",
                    "margin-left": "0.5in",
                    "encoding": "UTF-8",
                    "no-outline": None
                })
                
                # Set response for PDF download
                frappe.local.response.filename = f"customer_statement_{customer}_{from_date}_{to_date}.pdf"
                frappe.local.response.filecontent = pdf_content
                frappe.local.response.type = "download"
                frappe.local.response.headers = {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": f"attachment; filename=customer_statement_{customer}_{from_date}_{to_date}.pdf"
                }
                
                print(f"\n\nPDF Generated Successfully - Size: {len(pdf_content)} bytes\n\n")
                
            except Exception as e:
                frappe.log_error(f"PDF generation error: {str(e)}")
                print(f"\n\nPDF Error: {str(e)}\n\n")
                frappe.throw(_("Failed to generate PDF. Please try Excel format."))
        else:
            # Create Excel content
            try:
                import pandas as pd
                import io
                
                # Create header row
                header = [col.get("label", col.get("fieldname", "")) for col in columns]
                
                # Create DataFrame
                df = pd.DataFrame(result, columns=header)
                
                # Create Excel file in memory
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, sheet_name='Customer Statement', index=False)
                
                content = output.getvalue()
                output.close()
                
                frappe.local.response.filename = f"customer_statement_{customer}_{from_date}_{to_date}.xlsx"
                frappe.local.response.filecontent = content
                frappe.local.response.type = "binary"
                frappe.local.response.headers = {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": f"attachment; filename=customer_statement_{customer}_{from_date}_{to_date}.xlsx"
                }
            except ImportError:
                frappe.throw(_("Excel export requires pandas. Please contact administrator."))
        
    except Exception as e:
        frappe.log_error(f"Error in download_customer_statement: {str(e)}")
        frappe.throw(_("Failed to download customer statement. Please try again or contact support."))


def generate_statement_html(data):
    """
    Generate HTML content for PDF export
    
    Args:
        data (dict): Statement data including customer, company, and transaction details
        
    Returns:
        str: HTML content for PDF generation
    """
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Customer Statement</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                margin: 20px;
                font-size: 12px;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }}
            .company-name {{
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
            }}
            .statement-title {{
                font-size: 16px;
                font-weight: bold;
                margin-top: 10px;
            }}
            .customer-info {{
                margin-bottom: 20px;
            }}
            .info-row {{
                margin-bottom: 5px;
            }}
            .label {{
                font-weight: bold;
                display: inline-block;
                width: 120px;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
            }}
            th, td {{
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }}
            th {{
                background-color: #f5f5f5;
                font-weight: bold;
            }}
            .currency {{
                text-align: right;
            }}
            .closing-row {{
                background-color: #f0f0f0;
                font-weight: bold;
            }}
            .footer {{
                margin-top: 30px;
                font-size: 10px;
                color: #666;
                text-align: center;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">{data['company_name']}</div>
            <div class="statement-title">Customer Statement</div>
        </div>
        
        <div class="customer-info">
            <div class="info-row">
                <span class="label">Customer:</span>
                {data['customer']} - {data['customer_name']}
            </div>
            <div class="info-row">
                <span class="label">Period:</span>
                {data['from_date']} to {data['to_date']}
            </div>
            <div class="info-row">
                <span class="label">Generated:</span>
                {frappe.utils.now()}
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
            # Format currency columns
            if data['columns'][i]['fieldtype'] == 'Currency' and isinstance(cell, (int, float)) and cell != "":
                formatted_cell = f"SAR {cell:,.2f}"
                html += f'<td class="currency">{formatted_cell}</td>'
            elif cell == "":
                html += '<td></td>'
            else:
                # Handle multi-line remarks
                if isinstance(cell, str) and '\n' in cell:
                    formatted_cell = cell.replace('\n', '<br>')
                    html += f'<td>{formatted_cell}</td>'
                else:
                    html += f'<td>{cell}</td>'
        
        html += '</tr>'
    
    html += f"""
            </tbody>
        </table>
        
        <div class="footer">
            <p>This statement was generated automatically on {frappe.utils.now()}</p>
        </div>
    </body>
    </html>
    """
    
    return html


@frappe.whitelist()
def get_portal_settings():
    """
    Get portal settings that customers can access
    This method provides portal configuration without permission issues
    
    Returns:
        dict: Portal settings with only necessary fields
    """
    try:
        # Get portal settings with system permissions
        settings = frappe.get_doc("Customer Portal Settings")
        
        # Return only the fields customers need
        return {
            "name": settings.name,
            "portal_logo": settings.portal_logo,
            "portal_icon": settings.portal_icon,
            "company_name": settings.company_name,
            "allow_download_files": settings.allow_download_files,
            "download_format": settings.download_format or "PDF"
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting portal settings: {str(e)}")
        # Return default settings if there's an error
        return {
            "name": "Customer Portal Settings",
            "portal_logo": "",
            "portal_icon": "",
            "company_name": "Company",
            "allow_download_files": 1,
            "download_format": "PDF"
        }
