import frappe
from frappe.utils.data import today, getdate
from sap_customer_portal import sap_api_utils


@frappe.whitelist()
def clear_customer_cache():
    """Clear all cached data for the current customer"""
    try:
        # Clear for all linked customer codes
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            customer_code = sap_api_utils.get_customer_code_from_user()
            codes = [customer_code] if customer_code else []
        if not codes:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        success = True
        for code in codes:
            ok = sap_api_utils.clear_cache_for_customer(code)
            success = success and bool(ok)
        
        return {
            "success": success,
            "message": "Cache cleared" if success else "Failed to clear cache for some customers"
        }
        
    except Exception as e:
        frappe.log_error(f"Error clearing customer cache: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error clearing cache: {str(e)}"
        }

@frappe.whitelist()
def get_customer_balance():
    """Get customer balance directly from SAP B1"""
    try:
        _current_user = frappe.session.user
        
        customer_code = sap_api_utils.get_customer_code_from_user()
        
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Check SAP settings first
        settings = sap_api_utils.get_sap_b1_settings()
        if not settings:
            return {
                "error": True,
                "message": "SAP B1 settings not configured"
            }
        
        
        # Fetch balance from SAP
        balance_data = sap_api_utils.get_customer_balance_from_sap(customer_code)
        print(f"Balance data: {balance_data}")
        
        if not balance_data:
            return {
                "error": True,
                "message": "Unable to fetch customer balance from SAP"
            }
        
        return {
            "success": True,
            "data": balance_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer balance: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer balance: {str(e)}"
        }

@frappe.whitelist()
def get_customer_orders():
    """Get customer sales orders across all linked customer codes"""
    try:
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        all_orders = []
        for code in codes:
            all_orders.extend(sap_api_utils.get_customer_orders_from_sap(code, limit=500))

        all_orders.sort(key=lambda o: o.get("transaction_date") or "", reverse=True)
        return {"success": True, "data": all_orders}

    except Exception as e:
        frappe.log_error(f"Error fetching customer orders: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer orders: {str(e)}"
        }

@frappe.whitelist()
def get_customer_delivery_notes():
    """Get customer delivery notes across all linked customer codes"""
    try:
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        all_dns = []
        for code in codes:
            all_dns.extend(sap_api_utils.get_customer_delivery_notes_from_sap(code, limit=500))

        all_dns.sort(key=lambda d: d.get("posting_date") or d.get("transaction_date") or "", reverse=True)
        return {"success": True, "data": all_dns}

    except Exception as e:
        frappe.log_error(f"Error fetching customer delivery notes: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer delivery notes: {str(e)}"
        }

@frappe.whitelist()
def get_customer_dashboard_data():
    """Get all customer data for dashboard in one call across linked customer codes"""
    try:
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        balances, invoices, orders, delivery_notes = [], [], [], []
        for code in codes:
            b = sap_api_utils.get_customer_balance_from_sap(code)
            if b:
                balances.append(b)
            invoices.extend(sap_api_utils.get_customer_invoices_from_sap(code, limit=500))
            orders.extend(sap_api_utils.get_customer_orders_from_sap(code, limit=500))
            delivery_notes.extend(sap_api_utils.get_customer_delivery_notes_from_sap(code, limit=500))

        total_current_balance = sum((b.get('current_balance', 0) for b in balances)) if balances else 0
        total_credit_limit = sum((b.get('credit_limit', 0) for b in balances)) if balances else 0
        customer_info = {
            "customer_code": ",".join([b.get("customer_code", "") for b in balances]) if balances else None,
            "customer_name": balances[0].get("customer_name") if balances else None,
            "current_balance": total_current_balance,
            "credit_limit": total_credit_limit,
        }

        total_invoices = len(invoices)
        total_orders = len(orders)
        total_delivery_notes = len(delivery_notes)

        # Compute unreconciled (open) invoices using SAP fields
        # Only two statuses from SAP are used: Open and Closed
        # Remaining amount = grand_total - paid_amount (PaidToDate)
        unreconciled_invoices = []
        unreconciled_total = 0
        for inv in invoices:
            if inv.get('status') == 'Open':
                grand_total = inv.get('grand_total', 0) or 0
                paid_amount = inv.get('paid_amount', inv.get('paid_to_date', 0) or 0) or 0
                remaining = grand_total - paid_amount
                # Treat tiny negatives as zero due to rounding
                remaining = remaining if abs(remaining) > 1e-6 else 0
                if remaining > 0:
                    unreconciled_invoices.append(inv)
                    unreconciled_total += remaining

        today_date = getdate(today())
        overdue_invoices = [inv for inv in unreconciled_invoices if inv.get('due_date') and getdate(inv.get('due_date')) < today_date]
        overdue_total = 0
        for inv in overdue_invoices:
            grand_total = inv.get('grand_total', 0) or 0
            paid_amount = inv.get('paid_amount', inv.get('paid_to_date', 0) or 0) or 0
            remaining = grand_total - paid_amount
            overdue_total += remaining if remaining > 0 else 0

        undelivered_orders = [order for order in orders if order.get('status') == 'Open']
        undelivered_count = len(undelivered_orders)

        unbilled_deliveries = [dn for dn in delivery_notes if dn.get('status') == 'Open']
        unbilled_count = len(unbilled_deliveries)
        unbilled_total = sum(dn.get('grand_total', 0) for dn in unbilled_deliveries)

        return {
            "success": True,
            "data": {
                "customer_info": customer_info,
                "invoices": sorted(invoices, key=lambda i: i.get("posting_date") or "", reverse=True),
                "orders": sorted(orders, key=lambda o: o.get("transaction_date") or "", reverse=True),
                "delivery_notes": sorted(delivery_notes, key=lambda d: d.get("posting_date") or "", reverse=True),
                "summary": {
                    "total_invoices": total_invoices,
                    "total_orders": total_orders,
                    "total_delivery_notes": total_delivery_notes,
                    # New keys reflecting SAP logic
                    "unreconciled_invoices": len(unreconciled_invoices),
                    "unreconciled_total": unreconciled_total,
                    "overdue_invoices": len(overdue_invoices),
                    "overdue_total": overdue_total,
                    # Backward-compatible aliases used by existing frontend
                    "unpaid_invoices": len(unreconciled_invoices),
                    "unpaid_total": unreconciled_total,
                    "undelivered_orders": undelivered_count,
                    "unbilled_deliveries": unbilled_count,
                    "unbilled_total": unbilled_total,
                    "current_balance": total_current_balance,
                    "credit_limit": total_credit_limit,
                }
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer dashboard data: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer dashboard data: {str(e)}"
        }

@frappe.whitelist()
def get_customer_order_detail(doc_num: str = None):
    """Get a single customer sales order with items from SAP B1 by DocNum"""
    try:
        frappe.logger().info(f"[API] get_customer_order_detail called with doc_num: {doc_num}")
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {"error": True, "message": "No customer code found for current user"}
        if not doc_num:
            return {"error": True, "message": "Missing doc_num"}
        frappe.logger().info(f"[API] Fetching order detail for customer_code: {customer_code}, doc_num: {doc_num}")
        detail = sap_api_utils.get_customer_order_detail_from_sap(customer_code, doc_num)
        if not detail:
            return {"error": True, "message": "Order not found"}
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching order detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching order detail: {str(e)}"}


@frappe.whitelist()
def get_customer_delivery_note_detail(doc_num: str = None):
    """Get a single customer delivery note with items from SAP B1 by DocNum"""
    try:
        frappe.logger().info(f"[API] get_customer_delivery_note_detail called with doc_num: {doc_num}")
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {"error": True, "message": "No customer code found for current user"}
        if not doc_num:
            return {"error": True, "message": "Missing doc_num"}
        frappe.logger().info(f"[API] Fetching delivery note detail for customer_code: {customer_code}, doc_num: {doc_num}")
        detail = sap_api_utils.get_customer_delivery_note_detail_from_sap(customer_code, doc_num)
        if not detail:
            return {"error": True, "message": "Delivery note not found"}
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching delivery note detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching delivery note detail: {str(e)}"}

@frappe.whitelist()
def get_customer_payments():
    """Get customer payments across all linked customer codes"""
    try:
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        all_payments = []
        for code in codes:
            all_payments.extend(sap_api_utils.get_customer_payments_from_sap(code, limit=500))

        all_payments.sort(key=lambda p: p.get("posting_date") or "", reverse=True)
        return {"success": True, "data": all_payments}

    except Exception as e:
        frappe.log_error(f"Error fetching customer payments: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer payments: {str(e)}"
        }

@frappe.whitelist()
def get_customer_gl_statement(from_date=None, to_date=None):
    """Get customer statement using GL transactions (OJDT/JDT1) from SAP B1
    
    This uses the GL approach as suggested by the SAP consultant:
    - Fetches JournalEntries with JournalEntryLines filtered by customer
    - Returns raw GL data without calculations (no running balances)
    - Matches the SQL: SELECT from OJDT a INNER JOIN JDT1 b ON a.TransId = b.TransId INNER JOIN OCRD c ON c.CardCode = b.ShortName WHERE c.CardType = 'C'
    """
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        if not from_date or not to_date:
            return {
                "error": True,
                "message": "From date and to date are required"
            }
        
        # Get GL transactions from SAP (OJDT/JDT1 approach)
        gl_transactions = sap_api_utils.get_customer_gl_transactions_from_sap(customer_code, from_date, to_date)
        
        if not gl_transactions:
            return {
                "error": True,
                "message": "No GL transactions found for the given date range"
            }
        
        # Convert GL data to statement format (no calculations, just raw data)
        columns = [
            {"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 100},
            {"label": "Document", "fieldname": "document_number", "fieldtype": "Data", "width": 120},
            {"label": "Base Ref", "fieldname": "base_ref", "fieldtype": "Data", "width": 150},
            {"label": "Account", "fieldname": "account_code", "fieldtype": "Data", "width": 100},
            {"label": "Debit", "fieldname": "debit", "fieldtype": "Currency", "width": 100},
            {"label": "Credit", "fieldname": "credit", "fieldtype": "Currency", "width": 100},
            {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Data", "width": 200}
        ]
        
        # Convert GL transactions to statement rows (no running balance calculation)
        result = []
        total_debit = 0
        total_credit = 0
        
        for transaction in gl_transactions:
            debit_amount = transaction.get('debit', 0) or 0
            credit_amount = transaction.get('credit', 0) or 0
            
            total_debit += debit_amount
            total_credit += credit_amount
            
            result.append([
                transaction.get('date', ''),
                transaction.get('document_number', ''),
                transaction.get('base_ref', ''),
                transaction.get('account_code', ''),
                debit_amount,
                credit_amount,
                transaction.get('remarks', '')
            ])
        
        # Add summary row
        result.append([
            "",  # Empty date
            "PERIOD TOTALS",
            "",  # Empty base ref
            "",  # Empty account code
            total_debit,
            total_credit,
            f"Net: {total_debit - total_credit:,.2f}"
        ])
        
        statement_data = {
            "columns": columns,
            "result": result,
            "message": f"GL Statement for Customer {customer_code}",
            "chart": {},
            "report_summary": [
                {
                    "value": len(gl_transactions),
                    "label": "Total GL Transactions",
                    "datatype": "Int"
                },
                {
                    "value": total_debit,
                    "label": "Total Debits",
                    "datatype": "Currency"
                },
                {
                    "value": total_credit,
                    "label": "Total Credits", 
                    "datatype": "Currency"
                },
                {
                    "value": total_debit - total_credit,
                    "label": "Net Amount",
                    "datatype": "Currency"
                }
            ],
            "customer_code": customer_code,
            "from_date": from_date,
            "to_date": to_date,
            "data_source": "GL_OJDT_JDT1"
        }
        
        return {
            "success": True,
            "data": statement_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_customer_gl_statement: {str(e)}")
        return {
            "error": True,
            "message": f"Failed to fetch GL statement: {str(e)}"
        }


@frappe.whitelist()
def get_customer_statement_from_sap(from_date=None, to_date=None):
    """Get customer statement directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        if not from_date or not to_date:
            return {
                "error": True,
                "message": "From date and to date are required"
            }
        
        # Generate statement from SAP
        statement_data = sap_api_utils.get_customer_statement_from_sap(customer_code, from_date, to_date)
        
        if not statement_data:
            return {
                "error": True,
                "message": "Failed to generate customer statement from SAP"
            }
        
        return {
            "success": True,
            "data": statement_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer statement from SAP: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer statement: {str(e)}"
        }

@frappe.whitelist()
def get_customer_invoices():
    """Get customer invoices across all linked customer codes"""
    try:
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        all_invoices = []
        for code in codes:
            all_invoices.extend(sap_api_utils.get_customer_invoices_from_sap(code, limit=500))

        all_invoices.sort(key=lambda i: i.get("posting_date") or "", reverse=True)
        return {"success": True, "data": all_invoices}

    except Exception as e:
        frappe.log_error(f"Error fetching customer invoices: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer invoices: {str(e)}"
        }


@frappe.whitelist()
def get_invoice_status_summary(period: str = "12months"):
    """Return invoice status amount buckets for the current user's customers.

    period: one of [current, previous, ytd, 3months, 6months, 12months]
    """
    try:
        valid_periods = {"current", "previous", "ytd", "3months", "6months", "12months"}
        if period not in valid_periods:
            period = "12months"

        # Resolve customers
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {"error": True, "message": "No customer code found for current user"}
            codes = [single]

        # Collect invoices with a conservative limit (server aggregates, so keep reasonable bound)
        invoices = []
        for code in codes:
            invoices.extend(sap_api_utils.get_customer_invoices_from_sap(code, limit=500))

        # Filter by period
        today_dt = getdate(today())
        def in_period(inv):
            d = inv.get("posting_date")
            if not d:
                return False
            inv_date = getdate(d)
            if period == "current":
                return inv_date.month == today_dt.month and inv_date.year == today_dt.year
            if period == "previous":
                prev_month = 12 if today_dt.month == 1 else today_dt.month - 1
                prev_year = today_dt.year - 1 if today_dt.month == 1 else today_dt.year
                return inv_date.month == prev_month and inv_date.year == prev_year
            if period == "ytd":
                return inv_date.year == today_dt.year
            if period == "3months":
                # simple approx: 90 days window
                from frappe.utils.data import add_days
                three_months_ago = add_days(today_dt, -90)
                return inv_date >= three_months_ago and inv_date <= today_dt
            if period == "6months":
                from frappe.utils.data import add_days
                six_months_ago = add_days(today_dt, -180)
                return inv_date >= six_months_ago and inv_date <= today_dt
            # 12months
            from frappe.utils.data import add_days
            twelve_months_ago = add_days(today_dt, -365)
            return inv_date >= twelve_months_ago and inv_date <= today_dt

        filtered = [inv for inv in invoices if in_period(inv)] or invoices

        # Group by status and sum grand_total
        status_totals = {}
        for inv in filtered:
            status = inv.get("status") or ""
            if not isinstance(status, str):
                status = str(status)
            amount = inv.get("grand_total")
            try:
                amount = float(amount or 0)
            except Exception:
                amount = 0.0
            status_totals[status] = status_totals.get(status, 0.0) + amount

        total_amount = sum(status_totals.values()) if status_totals else 0.0

        # Color map aligned with frontend
        color_map = {
            "Closed": "#10b981",
            "Open": "#f59e0b",
            "Paid": "#10b981",
            "Unpaid": "#f59e0b",
            "Overdue": "#ef4444",
            "Cancelled": "#6b7280",
            "Draft": "#6366f1",
            "Return": "#8b5cf6",
            "Submitted": "#3b82f6",
        }

        buckets = []
        if total_amount > 0:
            for k, v in status_totals.items():
                buckets.append({
                    "name": k,
                    "value": v,
                    "percentage": (v / total_amount) * 100.0,
                    "total": total_amount,
                    "color": color_map.get(k, "#94a3b8"),
                })

        return {"success": True, "data": {"period": period, "buckets": buckets, "total": total_amount}}
    except Exception as e:
        frappe.log_error(f"Error building invoice status summary: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error building invoice status summary: {str(e)}"}

@frappe.whitelist()
def get_customer_invoice_detail(doc_num: str = None):
    """Get a single customer invoice with items from SAP B1 by DocNum"""
    
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {"error": True, "message": "No customer code found for current user"}
        if not doc_num:
            return {"error": True, "message": "Missing doc_num"}
        detail = sap_api_utils.get_customer_invoice_detail_from_sap(customer_code, doc_num)
        if not detail:
            return {"error": True, "message": "Invoice not found"}
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching invoice detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching invoice detail: {str(e)}"}


@frappe.whitelist()
def get_user_companies():
    """
    Get list of companies available to the current user
    This is a whitelisted method that respects user permissions
    """
    try:
        # Get companies that the user has access to
        companies = frappe.get_all(
            "Company",
            fields=["name", "company_name"],
            order_by="name"
        )
        
        return {
            "companies": companies,
            "success": True
        }
    except Exception as e:
        frappe.log_error(f"Error in get_user_companies: {str(e)}")
        return {
            "companies": [],
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_user_default_company():
    """
    Get the user's default company from their invoice data
    This ensures we use the same company context as the customer's actual data
    """
    try:
        # Get current user
        user = frappe.session.user
        
        # Try to get company from user's invoices first
        invoices = frappe.get_all(
            "Sales Invoice",
            filters={
                "docstatus": 1,
                "owner": user
            },
            fields=["company"],
            limit=1,
            order_by="creation desc"
        )
        
        if invoices and invoices[0].company:
            return {
                "company": invoices[0].company,
                "success": True
            }
        
        # Fallback: Get first available company
        companies = frappe.get_all(
            "Company",
            fields=["name"],
            limit=1,
            order_by="name"
        )
        
        if companies:
            return {
                "company": companies[0].name,
                "success": True
            }
        
        return {
            "company": None,
            "success": False,
            "error": "No company found"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_user_default_company: {str(e)}")
        return {
            "company": None,
            "success": False,
            "error": str(e)
        }
