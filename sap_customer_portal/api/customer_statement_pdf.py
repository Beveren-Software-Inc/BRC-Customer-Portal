import frappe
from frappe import _
from frappe.utils import getdate
from sap_customer_portal.api.customer_statement import (
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
        
        # Get statement data using SAP data for consistency with preview
        # This ensures PDF preview shows the same chronological order as the page preview
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
        
        # Convert SAP data to the expected format for PDF preview
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
        
        # Get customer and company details
        customer_doc = frappe.get_doc("Customer", customer)
        company_doc = frappe.get_doc("Company", company)
        
        # Calculate closing balance safely
        result_data = statement_data.get("result", [])
        closing_balance = 0
        if result_data and len(result_data) > 0:
            # The closing balance is in the last row, 5th column (index 5)
            try:
                closing_balance = result_data[-1][5] if len(result_data[-1]) > 5 else 0
            except (IndexError, TypeError):
                closing_balance = 0
        
        # Prepare data for HTML template
        pdf_data = {
            "customer": customer,
            "customer_name": customer_doc.customer_name,
            "company": company,
            "company_name": company_doc.company_name,
            "from_date": from_date,
            "to_date": to_date,
            "columns": statement_data.get("columns", []),
            "data": result_data,
            "closing_balance": closing_balance
        }
        
        # Generate print-friendly HTML using the existing function
        html_content = generate_statement_html(pdf_data)
        
  
        return {
            "html_content": html_content,
            "success": True
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_statement_pdf_preview: {str(e)}")
        frappe.throw(_("Failed to generate PDF preview. Please try again or contact support."))


