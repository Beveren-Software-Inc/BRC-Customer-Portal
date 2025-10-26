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
        
        # Get statement data from SAP JL Entry
        from sap_customer_portal.api.customer_balance import get_customer_statement_from_jl_entry
        
        # Convert dates to strings for the API
        from_date_str = from_date.strftime('%Y-%m-%d')
        to_date_str = to_date.strftime('%Y-%m-%d')
        
        # Get customer code for JL Entry lookup
        from sap_customer_portal import sap_api_utils
        customer_code = customer  # Use the customer parameter
        
        if not customer_code:
            frappe.throw(_("Unable to determine customer code"))
        
        # Get JL Entry statement data
        statement_response = get_customer_statement_from_jl_entry(from_date=from_date_str, to_date=to_date_str)
        
        if not statement_response or not statement_response.get('success'):
            frappe.throw(_("No data found for the given date range"))
        
        sap_statement_data = statement_response.get('data')
        
        if not sap_statement_data or not sap_statement_data.get('transactions'):
            frappe.throw(_("No data found for the given date range"))
        
        # Convert JL Entry data to the expected format for PDF preview
        columns = [
            {"label": "Date", "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
            {"label": "Type", "fieldname": "type", "fieldtype": "Data", "width": 120},
            {"label": "Number", "fieldname": "number", "fieldtype": "Data", "width": 150},
            {"label": "Description", "fieldname": "description", "fieldtype": "Data", "width": 200},
            {"label": "Debit", "fieldname": "debit", "fieldtype": "Currency", "width": 100},
            {"label": "Credit", "fieldname": "credit", "fieldtype": "Currency", "width": 100},
            {"label": "Balance", "fieldname": "balance", "fieldtype": "Currency", "width": 100}
        ]
        
        # Process JL Entry statement data
        result = []
        
        # JL Entry data already has calculated balance
        transactions = sap_statement_data.get('transactions', [])
        
        for transaction in transactions:
            result.append([
                transaction.get('date', ''),
                transaction.get('type', ''),
                transaction.get('number', ''),
                transaction.get('description', ''),
                transaction.get('debit', 0) or 0,
                transaction.get('credit', 0) or 0,
                transaction.get('balance', 0) or 0
            ])
        
        # Get closing balance from the last transaction or from summary
        closing_balance = sap_statement_data.get('closing_balance', 0)
        if transactions and len(transactions) > 0:
            closing_balance = transactions[-1].get('balance', 0)
        
        # Add closing balance row
        result.append([
            "",  # Empty date
            "Closing Balance",
            "",  # Empty number
            "",  # Empty description
            "",  # Empty debit
            "",  # Empty credit
            closing_balance
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
                    "value": closing_balance,
                    "label": "Closing Balance",
                    "datatype": "Currency"
                }
            ]
        }
        
        # Get customer and company details
        customer_doc = frappe.get_doc("Customer", customer)
        company_doc = frappe.get_doc("Company", company)
        
        # Get result data (transactions + closing balance row)
        result_data = result
        
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


