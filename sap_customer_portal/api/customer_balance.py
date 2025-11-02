

import frappe
import os
from frappe.utils.data import today, getdate
import sap_customer_portal.sap_api_utils as sap_api_utils

# Dashboard data limits - optimized for initial load performance
# Dashboard uses:
# - Summary: Only needs status counts (can work with subset)
# - Recent Activities: Only shows top 5 most recent items
# - Charts: Can work with reduced dataset
# Reduced from 500 to minimize SAP API calls and response size
DASHBOARD_INVOICE_LIMIT = 50   # Recent invoices for dashboard (full list available on invoice page)
DASHBOARD_ORDER_LIMIT = 50     # Recent orders for dashboard (full list available on orders page)
DASHBOARD_DELIVERY_NOTE_LIMIT = 50  # Recent delivery notes (full list available on delivery notes page)


@frappe.whitelist()
def clear_customer_cache():
    """Clear all cached data for the current customer including dashboard cache"""
    try:
        # Clear dashboard cache for current user
        current_user = frappe.session.user
        dashboard_cache_key = f"dashboard_data_{current_user}"
        try:
            frappe.cache().delete_value(dashboard_cache_key)
            frappe.logger().info(f"Cleared dashboard cache for user {current_user}")
        except Exception as e:
            frappe.logger().warning(f"Error clearing dashboard cache: {str(e)}")
        
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
    """Get customer balance directly from SAP B1 for all linked customer codes"""
    try:
        _current_user = frappe.session.user
        
        # Get all customer codes for current user (handles multiple customers scenario)
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        customer_codes = get_codes() if callable(get_codes) else []
        if not customer_codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {
                    "error": True,
                    "message": "No customer code found for current user"
                }
            customer_codes = [single]
        
        # Check SAP settings first
        settings = sap_api_utils.get_sap_b1_settings()
        if not settings:
            return {
                "error": True,
                "message": "SAP B1 settings not configured"
            }
        
        # Fetch balance from SAP for all linked customers
        all_balances = []
        total_balance = 0
        total_credit_limit = 0
        
        for customer_code in customer_codes:
            balance_data = sap_api_utils.get_customer_balance_from_sap(customer_code)
            if balance_data:
                all_balances.append(balance_data)
                total_balance += balance_data.get('current_balance', 0) or 0
                total_credit_limit += balance_data.get('credit_limit', 0) or 0
        
        if not all_balances:
            return {
                "error": True,
                "message": "Unable to fetch customer balance from SAP"
            }
        
        # Return combined balance data
        combined_balance = {
            'customer_code': ", ".join([b.get("customer_code", "") for b in all_balances]),
            'customer_name': ", ".join([b.get("customer_name", "") for b in all_balances]),
            'current_balance': total_balance,
            'credit_limit': total_credit_limit,
            'currency': all_balances[0].get('currency') or 'SAR'
        }
        
        return {
            "success": True,
            "data": combined_balance
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

def _get_customer_codes_for_dashboard():
    """Get customer codes for current user"""
    get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
    codes = get_codes() if callable(get_codes) else []
    if not codes:
        single = sap_api_utils.get_customer_code_from_user()
        if not single:
            return None
        codes = [single]
    return codes

def _initialize_sap_session():
    """Initialize SAP session and return session cookies"""
    session_cookies = sap_api_utils.get_or_create_sap_session()
    if not session_cookies:
        frappe.logger().error("[Dashboard] Failed to create SAP session")
        return None
    
    session_id_preview = str(session_cookies.get('B1SESSION', 'N/A'))[:20] if hasattr(session_cookies, 'get') else 'N/A'
    frappe.logger().info(f"[Dashboard] SAP session initialized. Session ID: {session_id_preview}...")
    return session_cookies

def _fetch_customer_data_for_code(code, invoice_limit=None, order_limit=None, delivery_note_limit=None):
    """Fetch all data (balance, invoices, orders, delivery notes) for a single customer code
    
    Uses graceful degradation: if one data fetch fails or times out, others continue.
    Uses shorter timeout for dashboard calls to fail faster.
    
    Args:
        code: Customer code
        invoice_limit: Optional limit for invoices (defaults to DASHBOARD_INVOICE_LIMIT)
        order_limit: Optional limit for orders (defaults to DASHBOARD_ORDER_LIMIT)
        delivery_note_limit: Optional limit for delivery notes (defaults to DASHBOARD_DELIVERY_NOTE_LIMIT)
    """
    result = {
        'balance': None,
        'invoices': [],
        'orders': [],
        'delivery_notes': []
    }
    
    # Use dashboard limits by default for faster initial load
    invoice_limit = invoice_limit or DASHBOARD_INVOICE_LIMIT
    order_limit = order_limit or DASHBOARD_ORDER_LIMIT
    delivery_note_limit = delivery_note_limit or DASHBOARD_DELIVERY_NOTE_LIMIT
    
    # Gracefully fetch each data type independently - failures don't block others
    # Fetch balance (always needed, no limit)
    try:
        balance = sap_api_utils.get_customer_balance_from_sap(code, session_cookies=None)
        if balance is not None:
            result['balance'] = balance
    except Exception as e:
        frappe.logger().warning(f"[Dashboard] Failed to fetch balance for {code}: {str(e)}")
        # Continue even if balance fails
    
    # Fetch invoices with reduced limit for dashboard (recent items only)
    try:
        invoices = sap_api_utils.get_customer_invoices_from_sap(code, limit=invoice_limit, session_cookies=None)
        if invoices is not None and isinstance(invoices, list):
            result['invoices'] = invoices
    except Exception as e:
        frappe.logger().warning(f"[Dashboard] Failed to fetch invoices for {code}: {str(e)}")
        # Continue with empty invoices list
    
    # Fetch orders with reduced limit for dashboard (recent items only)
    try:
        orders = sap_api_utils.get_customer_orders_from_sap(code, limit=order_limit, session_cookies=None)
        if orders is not None and isinstance(orders, list):
            result['orders'] = orders
    except Exception as e:
        frappe.logger().warning(f"[Dashboard] Failed to fetch orders for {code}: {str(e)}")
        # Continue with empty orders list
    
    # Fetch delivery notes with reduced limit for dashboard (recent items only)
    try:
        delivery_notes = sap_api_utils.get_customer_delivery_notes_from_sap(code, limit=delivery_note_limit, session_cookies=None)
        if delivery_notes is not None and isinstance(delivery_notes, list):
            result['delivery_notes'] = delivery_notes
    except Exception as e:
        frappe.logger().warning(f"[Dashboard] Failed to fetch delivery notes for {code}: {str(e)}")
        # Continue with empty delivery notes list
    
    return result

def _calculate_customer_info(balances):
    """Calculate customer info from balance data"""
    if not balances:
        return {
            "customer_code": None,
            "customer_name": None,
            "current_balance": 0,
            "credit_limit": 0,
        }
    
    total_balance = sum(b.get('current_balance', 0) or 0 for b in balances)
    total_credit_limit = sum(b.get('credit_limit', 0) or 0 for b in balances)
    
    return {
        "customer_code": ",".join([b.get("customer_code", "") for b in balances]),
        "customer_name": balances[0].get("customer_name") if balances else None,
        "current_balance": total_balance,
        "credit_limit": total_credit_limit,
    }

def _calculate_invoice_summary(invoices):
    """Calculate unreconciled and overdue invoice summaries
    
    Note: Summary is calculated from recent invoices (limited dataset).
    For accurate totals, use the dedicated invoices page which fetches all records.
    """
    unreconciled_invoices = []
    unreconciled_total = 0
    
    # Log status breakdown for debugging
    statuses = {}
    for inv in invoices:
        status = inv.get('status', 'Unknown')
        statuses[status] = statuses.get(status, 0) + 1
    frappe.logger().info(f"[Dashboard] Invoice status breakdown (from {len(invoices)} recent invoices): {statuses}")
    
    # Calculate unreconciled (open with remaining balance) from available invoices
    # Note: This is based on recent invoices only, not all historical records
    for inv in invoices:
        inv_status = str(inv.get('status', '')).strip()
        if inv_status.lower() == 'open':
            grand_total = inv.get('grand_total', 0) or 0
            paid_amount = inv.get('paid_amount', inv.get('paid_to_date', 0) or 0) or 0
            remaining = grand_total - paid_amount
            remaining = remaining if abs(remaining) > 1e-6 else 0  # Handle rounding
            
            if remaining > 0:
                unreconciled_invoices.append(inv)
                unreconciled_total += remaining
    
    # Calculate overdue invoices
    today_date = getdate(today())
    overdue_invoices = []
    overdue_total = 0
    
    for inv in unreconciled_invoices:
        due_date = inv.get('due_date')
        if due_date and getdate(due_date) < today_date:
            overdue_invoices.append(inv)
            grand_total = inv.get('grand_total', 0) or 0
            paid_amount = inv.get('paid_amount', inv.get('paid_to_date', 0) or 0) or 0
            remaining = grand_total - paid_amount
            overdue_total += remaining if remaining > 0 else 0
    
    return {
        'unreconciled_invoices': unreconciled_invoices,
        'unreconciled_total': unreconciled_total,
        'overdue_invoices': overdue_invoices,
        'overdue_total': overdue_total,
    }

def _calculate_order_summary(orders):
    """Calculate undelivered order summary
    
    Note: Summary is calculated from recent orders (limited dataset).
    For accurate totals, use the dedicated orders page which fetches all records.
    """
    # Log status breakdown
    statuses = {}
    for order in orders:
        status = order.get('status', 'Unknown')
        statuses[status] = statuses.get(status, 0) + 1
    frappe.logger().info(f"[Dashboard] Order status breakdown (from {len(orders)} recent orders): {statuses}")
    
    undelivered = [o for o in orders if str(o.get('status', '')).strip().lower() == 'open']
    return {'undelivered_count': len(undelivered)}

def _calculate_delivery_summary(delivery_notes):
    """Calculate unbilled delivery summary
    
    Note: Summary is calculated from recent delivery notes (limited dataset).
    For accurate totals, use the dedicated delivery notes page which fetches all records.
    """
    # Log status breakdown
    statuses = {}
    for dn in delivery_notes:
        status = dn.get('status', 'Unknown')
        statuses[status] = statuses.get(status, 0) + 1
    frappe.logger().info(f"[Dashboard] Delivery note status breakdown (from {len(delivery_notes)} recent notes): {statuses}")
    
    unbilled = [dn for dn in delivery_notes if str(dn.get('status', '')).strip().lower() == 'open']
    unbilled_total = sum(dn.get('grand_total', 0) or 0 for dn in unbilled)
    
    return {
        'unbilled_count': len(unbilled),
        'unbilled_total': unbilled_total,
    }

def _build_dashboard_result(customer_info, invoices, orders, delivery_notes, invoice_summary, order_summary, delivery_summary):
    """Build the final dashboard result structure"""
    return {
        "success": True,
        "data": {
            "customer_info": customer_info,
            "invoices": sorted(invoices, key=lambda i: i.get("posting_date") or "", reverse=True),
            "orders": sorted(orders, key=lambda o: o.get("transaction_date") or "", reverse=True),
            "delivery_notes": sorted(delivery_notes, key=lambda d: d.get("posting_date") or "", reverse=True),
            "summary": {
                "total_invoices": len(invoices),
                "total_orders": len(orders),
                "total_delivery_notes": len(delivery_notes),
                # SAP logic keys
                "unreconciled_invoices": len(invoice_summary['unreconciled_invoices']),
                "unreconciled_total": invoice_summary['unreconciled_total'],
                "overdue_invoices": len(invoice_summary['overdue_invoices']),
                "overdue_total": invoice_summary['overdue_total'],
                # Backward-compatible aliases
                "unpaid_invoices": len(invoice_summary['unreconciled_invoices']),
                "unpaid_total": invoice_summary['unreconciled_total'],
                "undelivered_orders": order_summary['undelivered_count'],
                "unbilled_deliveries": delivery_summary['unbilled_count'],
                "unbilled_total": delivery_summary['unbilled_total'],
                "current_balance": customer_info['current_balance'],
                "credit_limit": customer_info['credit_limit'],
            }
        }
    }


def _enqueue_background_prefetch(codes):
    """Enqueue a background job to prefetch heavier datasets and warm caches.
    Throttled per user via a short-lived cache key to avoid duplicate jobs.
    """
    try:
        user = frappe.session.user
        throttle_key = f"dashboard_prefetch_scheduled_{user}"
        cache = frappe.cache()
        if cache.get_value(throttle_key):
            return
        try:
            cache.set_value(throttle_key, 1, expires_in_sec=900)  # 15 minutes
        except Exception:
            pass

        frappe.enqueue(
            "sap_customer_portal.api.customer_balance._background_prefetch_for_codes",
            queue="long",
            job_name=f"dashboard_prefetch_{user}",
            now=False,
            timeout=900,
            codes=codes,
        )
    except Exception as e:
        frappe.logger().error(f"[Prefetch] Failed to enqueue prefetch job: {str(e)}")


def _background_prefetch_for_codes(codes):
    """Background task: prefetch larger slices to warm caches for subsequent views.
    Best-effort only; errors per dataset are logged and do not stop the job.
    """
    try:
        if not codes:
            return
        frappe.logger().info(f"[Prefetch] Starting background cache warm for {len(codes)} code(s)")
        prefetch_limit = 200
        for code in codes:
            try:
                try:
                    sap_api_utils.get_customer_payments_from_sap(code, limit=prefetch_limit)
                except Exception as e:
                    frappe.logger().warning(f"[Prefetch] Payments prefetch failed for {code}: {str(e)}")

                try:
                    sap_api_utils.get_customer_invoices_from_sap(code, limit=prefetch_limit)
                except Exception as e:
                    frappe.logger().warning(f"[Prefetch] Invoices prefetch failed for {code}: {str(e)}")

                try:
                    sap_api_utils.get_customer_orders_from_sap(code, limit=prefetch_limit)
                except Exception as e:
                    frappe.logger().warning(f"[Prefetch] Orders prefetch failed for {code}: {str(e)}")

                try:
                    sap_api_utils.get_customer_delivery_notes_from_sap(code, limit=prefetch_limit)
                except Exception as e:
                    frappe.logger().warning(f"[Prefetch] Delivery notes prefetch failed for {code}: {str(e)}")
            except Exception as inner_e:
                frappe.logger().warning(f"[Prefetch] Unexpected error for {code}: {str(inner_e)}")
        frappe.logger().info("[Prefetch] Background cache warm completed")
    except Exception as e:
        frappe.logger().error(f"[Prefetch] Background prefetch job failed: {str(e)}")

@frappe.whitelist()
def get_customer_dashboard_data():
    """Get all customer data for dashboard in one call across linked customer codes
    
    Uses extended cache duration (60 minutes) for dashboard data to improve performance.
    """
    try:
        # Check cache first
        current_user = frappe.session.user
        dashboard_cache_key = f"dashboard_data_{current_user}"
        cached_dashboard = sap_api_utils.get_cached_data(
            dashboard_cache_key, 
            cache_duration=sap_api_utils.DASHBOARD_CACHE_DURATION
        )
        
        if cached_dashboard is not None:
            return cached_dashboard
        
        # Get customer codes
        codes = _get_customer_codes_for_dashboard()
        if not codes:
            return {"error": True, "message": "No customer code found for current user"}

        # Initialize SAP session
        session_cookies = _initialize_sap_session()
        if not session_cookies:
            return {"error": True, "message": "Failed to connect to SAP B1"}

        # Fetch all customer data
        frappe.logger().info(f"[Dashboard] Fetching data for {len(codes)} customer(s)")
        balances, invoices, orders, delivery_notes = [], [], [], []
        
        for code in codes:
            data = _fetch_customer_data_for_code(code)
            if data['balance']:
                balances.append(data['balance'])
            invoices.extend(data['invoices'])
            orders.extend(data['orders'])
            delivery_notes.extend(data['delivery_notes'])
        
        frappe.logger().info(f"[Dashboard] Fetched: {len(balances)} balance(s), {len(invoices)} invoice(s), {len(orders)} order(s), {len(delivery_notes)} delivery note(s)")
        
        # Calculate summaries
        customer_info = _calculate_customer_info(balances)
        invoice_summary = _calculate_invoice_summary(invoices)
        order_summary = _calculate_order_summary(orders)
        delivery_summary = _calculate_delivery_summary(delivery_notes)
        
        # Build result
        result = _build_dashboard_result(
            customer_info, invoices, orders, delivery_notes,
            invoice_summary, order_summary, delivery_summary
        )
        
        # Cache result
        sap_api_utils.set_cached_data(
            dashboard_cache_key, 
            result, 
            cache_duration=sap_api_utils.DASHBOARD_CACHE_DURATION
        )
        
        # Enqueue background prefetch to warm caches for heavier datasets (non-blocking)
        try:
            _enqueue_background_prefetch(codes)
        except Exception:
            # Best-effort only; ignore prefetch enqueue failures
            pass
        
        # Cleanup session
        try:
            sap_api_utils.cleanup_sap_session()
        except Exception:
            pass
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer dashboard data: {str(e)}", "Customer Portal")
        return {
            "error": True,
            "message": f"Error fetching customer dashboard data: {str(e)}"
        }

@frappe.whitelist()
def get_customer_order_detail(doc_num: str = None):
    """Get a single customer sales order with items from SAP B1 by DocNum, enriched with customer info from Frappe"""
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
        
        # Enrich with customer information from Frappe
        customer_info = get_customer_info_from_frappe(customer_code)
        if customer_info:
            detail.update(customer_info)
        
        # Add logo paths from site files
        logo_info = get_logo_paths()
        if logo_info:
            detail.update(logo_info)
        
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching order detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching order detail: {str(e)}"}


@frappe.whitelist()
def get_customer_delivery_note_detail(doc_num: str = None):
    """Get a single customer delivery note with items from SAP B1 by DocNum, enriched with customer info from Frappe"""
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
        
        # Enrich with customer information from Frappe
        customer_info = get_customer_info_from_frappe(customer_code)
        if customer_info:
            detail.update(customer_info)
        
        # Add logo paths from site files
        logo_info = get_logo_paths()
        if logo_info:
            detail.update(logo_info)
        
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
    """Get a single customer invoice with items from SAP B1 by DocNum, enriched with customer info from Frappe"""
    
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        if not customer_code:
            return {"error": True, "message": "No customer code found for current user"}
        if not doc_num:
            return {"error": True, "message": "Missing doc_num"}
        
        # Get invoice detail from SAP
        detail = sap_api_utils.get_customer_invoice_detail_from_sap(customer_code, doc_num)
        if not detail:
            return {"error": True, "message": "Invoice not found"}
        
        # Enrich with customer information from Frappe
        customer_info = get_customer_info_from_frappe(customer_code)
        if customer_info:
            detail.update(customer_info)
        
        # Add logo paths from site files
        logo_info = get_logo_paths()
        if logo_info:
            detail.update(logo_info)
        
        return {"success": True, "data": detail}
    except Exception as e:
        frappe.log_error(f"Error fetching invoice detail: {str(e)}", "Customer Portal")
        return {"error": True, "message": f"Error fetching invoice detail: {str(e)}"}


def get_logo_paths():
    """Get logo file paths from Frappe site files directory"""
    try:
        logo_info = {}
        
        # Get site path
        site_path = frappe.get_site_path()
        files_path = os.path.join(site_path, "public", "files")
        
        # Check for BRC logo
        brc_logo_path = os.path.join(files_path, "brc_logo.jpeg")
        if os.path.exists(brc_logo_path):
            logo_info['brc_logo_url'] = "/files/brc_logo.jpeg"
        else:
            # Fallback: check for brc_logo in different formats
            for ext in ['.jpeg', '.jpg', '.png']:
                logo_path = os.path.join(files_path, f"brc_logo{ext}")
                if os.path.exists(logo_path):
                    logo_info['brc_logo_url'] = f"/files/brc_logo{ext}"
                    break
        
        # Check for Vision 2030 logo
        vision_logo_path = os.path.join(files_path, "vision2030_logo.png")
        if os.path.exists(vision_logo_path):
            logo_info['vision2030_logo_url'] = "/files/vision2030_logo.png"
        else:
            # Fallback: check for vision2030_logo in different formats
            for ext in ['.png', '.jpg', '.jpeg']:
                logo_path = os.path.join(files_path, f"vision2030_logo{ext}")
                if os.path.exists(logo_path):
                    logo_info['vision2030_logo_url'] = f"/files/vision2030_logo{ext}"
                    break
        
        return logo_info
        
    except Exception as e:
        frappe.logger().error(f"Error getting logo paths: {str(e)}")
        return {}


def get_customer_info_from_frappe(customer_code: str):
    """Get customer information from Frappe/ERPNext including addresses and contacts"""
    try:
        customer_info = {}
        
        # Get customer document
        if frappe.db.exists("Customer", customer_code):
            customer_doc = frappe.get_doc("Customer", customer_code)
            customer_info['customer_name'] = customer_doc.customer_name or customer_code
            
            # Get primary address
            addresses = frappe.db.sql("""
                SELECT 
                    name,
                    address_line1,
                    address_line2,
                    city,
                    state,
                    pincode,
                    country,
                    address_title,
                    address_type
                FROM `tabAddress`
                WHERE name IN (
                    SELECT parent 
                    FROM `tabDynamic Link` 
                    WHERE link_doctype = 'Customer' 
                    AND link_name = %s
                )
                ORDER BY 
                    CASE WHEN address_type = 'Billing' THEN 1 
                         WHEN address_type = 'Shipping' THEN 2 
                         ELSE 3 END,
                    is_primary_address DESC,
                    creation DESC
                LIMIT 1
            """, (customer_code,), as_dict=True)
            
            if addresses:
                addr = addresses[0]
                address_parts = []
                if addr.address_line1:
                    address_parts.append(addr.address_line1)
                if addr.address_line2:
                    address_parts.append(addr.address_line2)
                if addr.city:
                    address_parts.append(addr.city)
                if addr.state:
                    address_parts.append(addr.state)
                if addr.pincode:
                    address_parts.append(addr.pincode)
                if addr.country:
                    address_parts.append(addr.country)
                
                customer_info['address_display'] = ", ".join(address_parts)
                customer_info['customer_address'] = addr.name
                customer_info['shipping_address'] = addr.name
            
            # Get shipping address separately if different
            shipping_addresses = frappe.db.sql("""
                SELECT 
                    address_line1,
                    address_line2,
                    city,
                    state,
                    pincode,
                    country
                FROM `tabAddress`
                WHERE name IN (
                    SELECT parent 
                    FROM `tabDynamic Link` 
                    WHERE link_doctype = 'Customer' 
                    AND link_name = %s
                )
                AND address_type = 'Shipping'
                ORDER BY is_primary_address DESC, creation DESC
                LIMIT 1
            """, (customer_code,), as_dict=True)
            
            if shipping_addresses:
                addr = shipping_addresses[0]
                address_parts = []
                if addr.address_line1:
                    address_parts.append(addr.address_line1)
                if addr.address_line2:
                    address_parts.append(addr.address_line2)
                if addr.city:
                    address_parts.append(addr.city)
                if addr.state:
                    address_parts.append(addr.state)
                if addr.pincode:
                    address_parts.append(addr.pincode)
                if addr.country:
                    address_parts.append(addr.country)
                
                customer_info['shipping_address_display'] = ", ".join(address_parts)
            
            # Get tax ID if available
            if hasattr(customer_doc, 'tax_id') and customer_doc.tax_id:
                customer_info['customer_tax_id'] = customer_doc.tax_id
        
        return customer_info
        
    except Exception as e:
        frappe.logger().error(f"Error fetching customer info from Frappe: {str(e)}")
        return {}


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



@frappe.whitelist(allow_guest=False)
def sync_sap_jl_entries(from_date=None, to_date=None):
    """Sync SAP JL Entry data from SAP B1 to local database
    
    Fetches all journal entries from SAP, then saves journal entry lines
    that have ShortName in the Customer table.
    Only saves lines where ShortName starts with a letter (customer codes like F10289, J6878)
    to quickly skip numeric codes.
    Commits in batches of 20 for performance.
    Runs in background with 60 minute timeout.
    
    Args:
        from_date (str): Start date for filtering journal entries
        to_date (str): End date for filtering journal entries
    """
    try:
        date_msg = ""
        if from_date and to_date:
            date_msg = f" from {from_date} to {to_date}"
        frappe.log_error(f"Starting SAP JL Entry sync{date_msg}...")
        
        # Enqueue the background job
        frappe.enqueue(
            'sap_customer_portal.api.customer_balance._sync_sap_jl_entries_background',
            queue='long',
            job_name='sync_sap_jl_entries',
            timeout=10800,  # 60 minutes
            is_async=True,
            from_date=from_date,
            to_date=to_date
        )
        
        return {
            "success": True,
            "message": f"SAP JL Entry sync has been started in the background{date_msg}. This may take several minutes."
        }
        
    except Exception as e:
        frappe.log_error(f"Error starting sync_sap_jl_entries: {str(e)}", "SAP JL Entry Sync")
        return {
            "success": False,
            "error": str(e),
            "message": f"Error starting sync: {str(e)}"
        }


def _parse_date_filters(from_date, to_date):
    """Parse and format date filters for SAP query"""
    from_date_parsed = None
    to_date_parsed = None
    
    if from_date:
        from_date_parsed = from_date.split('T')[0] if 'T' in str(from_date) else from_date
    if to_date:
        to_date_parsed = to_date.split('T')[0] if 'T' in str(to_date) else to_date
    
    return from_date_parsed, to_date_parsed


def _get_customer_set():
    """Get all customer codes as a set for quick lookup"""
    all_customers = frappe.get_all("Customer", pluck="name")
    customer_set = set(all_customers)
    frappe.logger().info(f"Found {len(customer_set)} customers in system")
    frappe.log_error(f"Found {len(customer_set)} customers in system")
    return customer_set


def _fetch_journal_entries_batch(skip, batch_size, from_date_parsed, to_date_parsed):
    """Fetch a batch of journal entries from SAP"""
    params = {
        '$orderby': 'JdtNum asc',
        '$top': batch_size,
        '$skip': skip
    }
    
    # Add date filter if provided
    if from_date_parsed and to_date_parsed:
        params['$filter'] = f"ReferenceDate ge '{from_date_parsed}' and ReferenceDate le '{to_date_parsed}'"
    
    # Fetch from SAP
    data = sap_api_utils.fetch_sap_data_with_session('JournalEntries', params, None)
    
    # Handle both list response and dict with 'value' key
    if not data:
        return []
    
    if isinstance(data, list):
        return data
    elif isinstance(data, dict) and 'value' in data:
        return data.get('value', [])
    else:
        return []


def _should_process_line(short_name, customer_set):
    """Check if a line should be processed based on customer filtering"""
    if not short_name:
        return False, "No ShortName"
    
    # Skip if ShortName doesn't start with a letter
    if not short_name[0].isalpha():
        return False, "ShortName doesn't start with letter"
    
    # Check if ShortName is in the customer list
    if short_name not in customer_set:
        return False, "Not in customer list"
    
    return True, ""

import time
from contextlib import contextmanager

@contextmanager
def db_transaction():
    """Context manager for explicit transaction handling"""
    try:
        yield
        frappe.db.commit()
    except Exception:
        frappe.db.rollback()
        raise


def _save_jl_entry_with_retry(jdt_num, line_id, line, original_journal, original, max_retries=3):
    """Save JL Entry with improved retry logic and lock management
    
    Key improvements:
    1. Check for existing records BEFORE starting transaction
    2. Exponential backoff with jitter
    3. Separate transaction per record to minimize lock duration
    4. Better error handling and logging
    
    Returns:
        tuple: (success: bool, saved: bool, error_message: str)
    """
    retry_count = 0
    last_error = None
    
    while retry_count < max_retries:
        try:
            # IMPORTANT: Check existence outside transaction to avoid locks
            existing = frappe.db.exists('Sap JL Entry', {
                'jdtnum': jdt_num,
                'line_id': line_id
            })
            
            if existing:
                return True, False, None  # Already exists, skip
            
            # Parse dates
            posting_date = line.get('ReferenceDate1')
            due_date = line.get('DueDate')
            reference = line.get('Reference1', '')
            
            if posting_date:
                posting_date = posting_date.split('T')[0] if 'T' in str(posting_date) else posting_date
            if due_date:
                due_date = due_date.split('T')[0] if 'T' in str(due_date) else due_date
            
            # Use explicit transaction context for single insert
            with db_transaction():
                # Truncate line_memo to 100 characters
                line_memo = line.get('LineMemo', '')
                if line_memo and len(line_memo) > 100:
                    line_memo = line_memo[:100]
                
                jl_entry = frappe.get_doc({
                    'doctype': 'Sap JL Entry',
                    'jdtnum': jdt_num,
                    'line_id': line_id,
                    'posting_date': posting_date,
                    'due_date': due_date,
                    'account_code': line.get('AccountCode'),
                    'debit': line.get('Debit', 0) or 0,
                    'credit': line.get('Credit', 0) or 0,
                    'customer': line.get('ShortName'),
                    'reference': reference,
                    'line_memo': line_memo,
                    'original_journal': original_journal,
                    'original': original
                })
                
                # Insert with ignore_if_duplicate
                jl_entry.insert(ignore_permissions=True, ignore_if_duplicate=True)
            
            return True, True, None  # Success!
            
        except frappe.DuplicateEntryError:
            # Record was created by another process, this is OK
            return True, False, None
            
        except (frappe.exceptions.QueryDeadlockError, 
                frappe.exceptions.QueryTimeoutError) as e:
            last_error = e
            retry_count += 1
            
            if retry_count < max_retries:
                # Exponential backoff with jitter: 0.1-0.3s, 0.2-0.6s, 0.4-1.2s
                base_delay = 0.1 * (2 ** retry_count)
                jitter = base_delay * 2
                delay = base_delay + (time.time() % jitter)
                
                frappe.logger().warning(
                    f"Lock timeout/deadlock on JDT {jdt_num}, Line {line_id}. "
                    f"Retry {retry_count}/{max_retries} after {delay:.2f}s"
                )
                
                time.sleep(delay)
                frappe.db.rollback()
                continue
            else:
                error_msg = f"Failed after {max_retries} retries: {str(e)[:100]}"
                frappe.log_error(
                    f"JDT {jdt_num}, Line {line_id}: {error_msg}",
                    "JL Entry Lock Timeout"
                )
                return False, False, error_msg
                
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)[:100]}"
            frappe.log_error(
                f"Error saving JL Entry JDT {jdt_num}, Line {line_id}: {str(e)}",
                "JL Entry Save Error"
            )
            return False, False, error_msg
    
    return False, False, f"Failed after {max_retries} retries: {str(last_error)}"



def _process_journal_entry(je, customer_set, total_lines, saved_lines, skipped_lines, batch_size, batch_count):
    """Process a single journal entry and return updated counts
    
    Returns:
        tuple: (total_lines, saved_lines, skipped_lines, batch_count)
    """
    jdt_num = je.get('JdtNum')
    original_journal = je.get('OriginalJournal')
    original = je.get('Original')
    
    # Get lines from the journal entry
    lines = je.get('JournalEntryLines', [])
    if not lines:
        return total_lines, saved_lines, skipped_lines, batch_count
    
    # Process each line
    for line in lines:
        try:
            total_lines += 1
            short_name = line.get('ShortName')
            
            # Check if we should process this line
            should_process, skip_reason = _should_process_line(short_name, customer_set)
            if not should_process:
                skipped_lines += 1
                continue
            
            # Get line_id
            line_id = line.get('Line_ID')
            
            # Try to save with retry logic
            result = _save_jl_entry_with_retry(jdt_num, line_id, line, original_journal, original)
            
            # Handle the tuple returned (success, saved, error)
            if len(result) == 3:
                success, saved, error = result
            else:
                # Fallback for old signature
                success, saved = result
                error = None
            
            if not success:
                skipped_lines += 1
                continue
            
            if saved:
                saved_lines += 1
                # Commit every 10 records to prevent lock timeout
                if saved_lines % 10 == 0:
                    frappe.db.commit()
                    batch_count += 1
                    frappe.logger().info(f"Committed batch {batch_count}. Saved {saved_lines} records so far.")
            else:
                skipped_lines += 1
        except Exception as e:
            # Log error but continue processing other lines
            frappe.log_error(f"Error processing line in JDT {jdt_num}: {str(e)[:200]}", "SAP JL Entry Sync")
            frappe.logger().error(f"Error processing line in JDT {jdt_num}: {str(e)}")
            skipped_lines += 1
            continue
    
    return total_lines, saved_lines, skipped_lines, batch_count


def _sync_sap_jl_entries_background(from_date=None, to_date=None):
    """Background job to sync SAP JL Entry data
    This function is accessed dynamically by frappe.enqueue()
    
    Args:
        from_date (str): Start date for filtering (optional)
        to_date (str): End date for filtering (optional)
    """
    try:
        frappe.log_error("Starting SAP JL Entry sync in background...")
        
        # Parse date filters
        from_date_parsed, to_date_parsed = _parse_date_filters(from_date, to_date)
        
        # Get customer set
        customer_set = _get_customer_set()
        
        # Initialize counters
        total_entries = 0
        total_lines = 0
        saved_lines = 0
        skipped_lines = 0
        batch_count = 0
        
        # Configure batch processing
        batch_size = 20
        skip = 0
        batch_num = 0
        max_batches = 100000  # Safety limit
        
        # Main processing loop
        while batch_num < max_batches:
            # Fetch batch of journal entries
            entries = _fetch_journal_entries_batch(skip, batch_size, from_date_parsed, to_date_parsed)
            
            if not entries:
                frappe.logger().info(f"No entries in batch {batch_num}")
                break
            
            total_entries += len(entries)
            
            # Process each journal entry
            for je in entries:
                try:
                    total_lines, saved_lines, skipped_lines, batch_count = _process_journal_entry(
                        je, customer_set, total_lines, saved_lines, skipped_lines, batch_size, batch_count
                    )
                except Exception as e:
                    # Log error but continue processing other entries
                    jdt_num = je.get('JdtNum', 'Unknown')
                    frappe.log_error(f"Error processing JDT {jdt_num}: {str(e)[:200]}", "SAP JL Entry Sync")
                    frappe.logger().error(f"Error processing JDT {jdt_num}: {str(e)}")
                    # Continue with next entry
                    continue
            
            # Check if this is the last page
            if len(entries) < batch_size:
                break
            
            skip += batch_size
            batch_num += 1
        
        # Final commit
        frappe.db.commit()
        
        summary = f"""
            Sync Complete:
            - Total Entries Processed: {total_entries}
            - Total Lines Processed: {total_lines}
            - Lines Saved: {saved_lines}
            - Lines Skipped: {skipped_lines}
            - Commits: {batch_count}
        """
        
        frappe.logger().info(summary)
        frappe.log_error(summary)
        
        return {
            "success": True,
            "total_entries": total_entries,
            "total_lines": total_lines,
            "saved_lines": saved_lines,
            "skipped_lines": skipped_lines,
            "message": f"Successfully synced {saved_lines} JL Entry lines from {total_entries} journal entries"
        }
        
    except Exception as e:
        frappe.log_error(f"Error in _sync_sap_jl_entries_background: {str(e)}", "SAP JL Entry Sync")
        frappe.db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": f"Error during sync: {str(e)}"
        }


@frappe.whitelist(allow_guest=False)
def get_customer_statement_from_jl_entry(from_date=None, to_date=None):
    """Get customer statement from SAP JL Entry data across all linked customer codes
    
    Args:
        from_date (str): Start date for filtering
        to_date (str): End date for filtering
        
    Returns:
        dict: Statement data with transactions and running balance
    """
    try:
        # Get all customer codes for current user (handles multiple customers scenario)
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        customer_codes = get_codes() if callable(get_codes) else []
        if not customer_codes:
            single = sap_api_utils.get_customer_code_from_user()
            if not single:
                return {
                    "error": True,
                    "message": "No customer code found for current user"
                }
            customer_codes = [single]
        
        if not from_date or not to_date:
            return {
                "error": True,
                "message": "From date and to date are required"
            }
        
        # Parse dates
        from_date_parsed = from_date.split('T')[0] if 'T' in str(from_date) else from_date
        to_date_parsed = to_date.split('T')[0] if 'T' in str(to_date) else to_date
        
        # Step 1: Calculate opening balance from all transactions BEFORE from_date
        opening_balance_entries = frappe.db.sql("""
            SELECT 
                debit,
                credit
            FROM `tabSap JL Entry`
            WHERE customer IN ({})
            AND posting_date < %s
            ORDER BY posting_date ASC, jdtnum ASC, line_id ASC
        """.format(', '.join(['%s'] * len(customer_codes))), 
            tuple(customer_codes) + (from_date_parsed,), 
            as_dict=True)
        
        # Calculate opening balance (balance as of the day before from_date)
        opening_balance = 0
        for entry in opening_balance_entries:
            opening_balance += (entry.debit or 0) - (entry.credit or 0)
        
        # Step 2: Fetch JL Entry records for all customers and date range
        jl_entries = frappe.db.sql("""
            SELECT 
                jdtnum,
                line_id,
                posting_date,
                original_journal,
                reference,
                line_memo,
                debit,
                credit,
                customer,
                account_code
            FROM `tabSap JL Entry`
            WHERE customer IN ({})
            AND posting_date BETWEEN %s AND %s
            ORDER BY posting_date ASC, jdtnum ASC, line_id ASC
        """.format(', '.join(['%s'] * len(customer_codes))), 
            tuple(customer_codes) + (from_date_parsed, to_date_parsed), 
            as_dict=True)
        
        # Step 3: Calculate running balance starting from opening balance
        transactions = []
        running_balance = opening_balance  # Start with opening balance
        
        # Add opening balance entry (show if non-zero or if no transactions in range)
        if opening_balance != 0 or (jl_entries is None or len(jl_entries) == 0):
            transactions.append({
                'date': from_date_parsed,
                'type': 'Opening Balance',
                'number': '',
                'description': f'Opening Balance as of {from_date_parsed}',
                'debit': opening_balance if opening_balance > 0 else 0,
                'credit': abs(opening_balance) if opening_balance < 0 else 0,
                'balance': opening_balance,
                'status': 'Closed',
                'account_code': '',
                'jdtnum': '',
                'line_id': ''
            })
        
        # Process transactions in the date range
        for entry in jl_entries:
            running_balance += (entry.debit or 0) - (entry.credit or 0)
            
            transactions.append({
                'date': entry.posting_date,
                'type': entry.original_journal or 'General',
                'number': entry.reference or '',
                'description': entry.line_memo or '',
                'debit': entry.debit or 0,
                'credit': entry.credit or 0,
                'balance': running_balance,
                'status': 'Closed',
                'account_code': entry.account_code,
                'jdtnum': entry.jdtnum,
                'line_id': entry.line_id
            })
        
        # Calculate summary (exclude opening balance entry from totals)
        total_debit = sum(t['debit'] for t in transactions if t.get('type') != 'Opening Balance')
        total_credit = sum(t['credit'] for t in transactions if t.get('type') != 'Opening Balance')
        
        # Get customer names (for all linked customers)
        customer_names = []
        for code in customer_codes:
            name = frappe.db.get_value("Customer", code, "customer_name") or code
            customer_names.append(name)
        
        # Format customer info display
        customer_code_display = ", ".join(customer_codes) if len(customer_codes) > 1 else customer_codes[0]
        customer_name_display = ", ".join(customer_names) if len(customer_names) > 1 else customer_names[0]
        
        return {
            "success": True,
            "data": {
                "customer_code": customer_code_display,
                "customer_name": customer_name_display,
                "from_date": from_date_parsed,
                "to_date": to_date_parsed,
                "opening_balance": opening_balance,  # Balance as of the day before from_date
                "closing_balance": running_balance,  # Final balance after all transactions in range
                "transactions": transactions,
                "summary": {
                    "total_transactions": len(transactions),
                    "total_debit": total_debit,
                    "total_credit": total_credit,
                    "net_amount": total_debit - total_credit
                }
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching customer statement from JL Entry: {str(e)}")
        return {
            "error": True,
            "message": f"Error fetching statement: {str(e)}"
        }
