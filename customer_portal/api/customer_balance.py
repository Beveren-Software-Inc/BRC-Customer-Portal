import frappe
from frappe.utils.data import today, getdate
from customer_portal import sap_api_utils


@frappe.whitelist()
def clear_customer_cache():
    """Clear all cached data for the current customer"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        success = sap_api_utils.clear_cache_for_customer(customer_code)
        
        return {
            "success": success,
            "message": f"Cache cleared for customer {customer_code}" if success else "Failed to clear cache"
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
        current_user = frappe.session.user
        frappe.logger().info(f"Getting customer balance for user: {current_user}")
        
        customer_code = sap_api_utils.get_customer_code_from_user()
        frappe.logger().info(f"Customer code: {customer_code}")
        
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
        
        frappe.logger().info(f"SAP settings available: {bool(settings)}")
        
        # Fetch balance from SAP
        balance_data = sap_api_utils.get_customer_balance_from_sap(customer_code)
        frappe.logger().info(f"Balance data: {balance_data}")
        
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
    """Get customer sales orders directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch orders from SAP
        orders = sap_api_utils.get_customer_orders_from_sap(customer_code, limit=500)
        
        return {
            "success": True,
            "data": orders
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer orders: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer orders: {str(e)}"
        }

@frappe.whitelist()
def get_customer_delivery_notes():
    """Get customer delivery notes directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch delivery notes from SAP
        delivery_notes = sap_api_utils.get_customer_delivery_notes_from_sap(customer_code, limit=500)
        
        return {
            "success": True,
            "data": delivery_notes
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer delivery notes: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer delivery notes: {str(e)}"
        }

@frappe.whitelist()
def get_customer_dashboard_data():
    """Get all customer data for dashboard in one call"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch all data from SAP
        balance_data = sap_api_utils.get_customer_balance_from_sap(customer_code)
        invoices = sap_api_utils.get_customer_invoices_from_sap(customer_code, limit=500)
        orders = sap_api_utils.get_customer_orders_from_sap(customer_code, limit=500)
        delivery_notes = sap_api_utils.get_customer_delivery_notes_from_sap(customer_code, limit=500)
        
        frappe.logger().info(f"[Dashboard] Fetched {len(delivery_notes)} delivery notes for customer {customer_code}")
        
        # Calculate summary statistics
        total_invoices = len(invoices)
        total_orders = len(orders)
        total_delivery_notes = len(delivery_notes)
        
        # Calculate unpaid invoices total (Open invoices from SAP)
        unpaid_invoices = [inv for inv in invoices if inv.get('status') == 'Open']
        unpaid_total = sum(inv.get('outstanding_amount', 0) for inv in unpaid_invoices)
        
        # Calculate overdue invoices
        today_date = getdate(today())
        overdue_invoices = [inv for inv in unpaid_invoices 
                           if inv.get('due_date') and getdate(inv.get('due_date')) < today_date]
        overdue_total = sum(inv.get('outstanding_amount', 0) for inv in overdue_invoices)
        
        # Calculate undelivered orders (Open sales orders from SAP)
        undelivered_orders = [order for order in orders if order.get('status') == 'Open']
        undelivered_count = len(undelivered_orders)
        
        # Calculate unbilled deliveries (Open delivery notes from SAP)
        unbilled_deliveries = [dn for dn in delivery_notes if dn.get('status') == 'Open']
        unbilled_count = len(unbilled_deliveries)
        unbilled_total = sum(dn.get('grand_total', 0) for dn in unbilled_deliveries)
        
        return {
            "success": True,
            "data": {
                "customer_info": balance_data,
                "invoices": invoices,
                "orders": orders,
                "delivery_notes": delivery_notes,
                "summary": {
                    "total_invoices": total_invoices,
                    "total_orders": total_orders,
                    "total_delivery_notes": total_delivery_notes,
                    "unpaid_invoices": len(unpaid_invoices),
                    "unpaid_total": unpaid_total,
                    "overdue_invoices": len(overdue_invoices),
                    "overdue_total": overdue_total,
                    "undelivered_orders": undelivered_count,
                    "unbilled_deliveries": unbilled_count,
                    "unbilled_total": unbilled_total,
                    "current_balance": balance_data.get('current_balance', 0) if balance_data else 0,
                    "credit_limit": balance_data.get('credit_limit', 0) if balance_data else 0
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
def get_customer_delivery_notes():
    """Get customer delivery notes directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch delivery notes from SAP
        delivery_notes = sap_api_utils.get_customer_delivery_notes_from_sap(customer_code, limit=500)
        
        return {
            "success": True,
            "data": delivery_notes
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer delivery notes: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer delivery notes: {str(e)}"
        }

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
    """Get customer payments directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch payments from SAP
        payments = sap_api_utils.get_customer_payments_from_sap(customer_code, limit=500)
        
        return {
            "success": True,
            "data": payments
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer payments: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer payments: {str(e)}"
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
    """Get customer invoices directly from SAP B1"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {
                "error": True,
                "message": "No customer code found for current user"
            }
        
        # Fetch invoices from SAP
        invoices = sap_api_utils.get_customer_invoices_from_sap(customer_code, limit=500)
        
        return {
            "success": True,
            "data": invoices
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer invoices: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer invoices: {str(e)}"
        }

@frappe.whitelist()
def get_customer_invoice_detail(doc_num: str = None):
    """Get a single customer invoice with items from SAP B1 by DocNum"""
    try:
        frappe.logger().info(f"[API] get_customer_invoice_detail called with doc_num: {doc_num}")
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {"error": True, "message": "No customer code found for current user"}
        if not doc_num:
            return {"error": True, "message": "Missing doc_num"}
        frappe.logger().info(f"[API] Fetching invoice detail for customer_code: {customer_code}, doc_num: {doc_num}")
        detail = sap_api_utils.get_customer_invoice_detail_from_sap(customer_code, doc_num)
        if not detail:
            return {"error": True, "message": "Invoice not found"}
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching invoice detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching invoice detail: {str(e)}"}
