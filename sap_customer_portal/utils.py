import os
from pathlib import Path
import frappe

# Function to find the first logo file in assets directory
def _get_logo_path():
    try:
        assets_dir = Path(__file__).parent / "public" / "portal" / "assets"
        
        if assets_dir.exists():
            for file in sorted(os.listdir(assets_dir)):
                if "logo" in file.lower():
                    return f"/assets/sap_customer_portal/portal/assets/{file}"
    except Exception:    
        return "/assets/sap_customer_portal/portal/assets/logo-DRmS0mf5.jpg"

def get_website_route_rules():
    """
    Returns the list of website route rules for the customer portal.
    Called in hooks.py
    """
    return [
        # Major Default rules
        {'from_route': '/portal/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/me', 'to_route': 'portal'},
        {'from_route': '/me/<path:app_path>', 'to_route': 'portal'},

        # Add rules for specific React app top-level routes
        # These ensure that refreshing on these paths serves the React app
        {'from_route': '/sales-orders', 'to_route': 'portal'},
        {'from_route': '/sales-orders/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/quotations', 'to_route': 'portal'},
        {'from_route': '/quotations/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/sales-invoices', 'to_route': 'portal'},
        {'from_route': '/sales-invoices/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/delivery-notes', 'to_route': 'portal'},
        {'from_route': '/delivery-notes/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/support-tickets', 'to_route': 'portal'},        {'from_route': '/support-tickets/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/settings', 'to_route': 'portal'},
        {'from_route': '/settings/<path:app_path>', 'to_route': 'portal'},
        {'from_route': '/customer-statement', 'to_route': 'portal'},
        {'from_route': '/customer-statement/<path:app_path>', 'to_route': 'portal'},
    ]


@frappe.whitelist()
def get_monthly_sales_order_stats(customer=None, company=None, months=12):
    """
    Returns monthly sales order stats for the dashboard chart.
    Treats customers with the same email as one customer.
    """
    try:
        # Ensure months is an integer (convert from string if needed)
        months = int(months) if months is not None else 12
        
        user = frappe.session.user
        frappe.logger().info(f"[DEBUG] get_monthly_sales_order_stats called by user: {user}")
        frappe.logger().info(f"[DEBUG] User roles: {frappe.get_roles(user)}")
        
        customer_list = _resolve_customer_list(user, customer)
        frappe.logger().info(f"[DEBUG] Resolved customer list: {customer_list}")
        
        sales_orders, order_to_month, month_buckets = _fetch_sales_orders(customer_list, company, months)

        if not sales_orders:
            result = _format_monthly_result(month_buckets, months)
            frappe.logger().info(f"[DEBUG] No sales orders found, returning: {len(result)} months")
            return result

        _accumulate_paid_amounts(sales_orders, order_to_month, month_buckets)
        result = _format_monthly_result(month_buckets, months)
        frappe.logger().info(f"[DEBUG] Returning {len(result)} months of data")
        return result

    except Exception as e:
        frappe.logger().error(f"[ERROR] get_monthly_sales_order_stats failed: {str(e)}")
        frappe.logger().error(f"[ERROR] Traceback: {frappe.get_traceback()}")
        frappe.log_error(
            message=frappe.get_traceback(), 
            title="get_monthly_sales_order_stats Failed"
        )
        frappe.throw("Failed to fetch monthly sales order stats.")


# ------------------ Helpers ------------------ #

def _resolve_customer_list(user, customer):
    """Resolve customer list based on email or portal mapping."""
    frappe.logger().info(f"[DEBUG] _resolve_customer_list called with user: {user}, customer: {customer}")
    
    if customer:
        email = frappe.db.get_value("Customer", customer, "email_id")
        if email:
            result = frappe.get_all("Customer", filters={"email_id": email}, pluck="name")
            frappe.logger().info(f"[DEBUG] Found customers by email: {result}")
            return result
        frappe.logger().info(f"[DEBUG] Returning single customer: {[customer]}")
        return [customer]

    roles = frappe.get_roles(user)
    frappe.logger().info(f"[DEBUG] User roles: {roles}")
    
    if "Administrator" in roles or "System Manager" in roles or "Sales Manager" in roles:
        # For Administrator, System Manager, and Sales Manager users, don't filter by customer
        # This allows them to see all sales orders without customer restrictions
        frappe.logger().info(f"[DEBUG] Admin user detected, returning None (no customer filter)")
        return None
    
    # For customer users, get their Portal User mapping
    portal_users = frappe.get_all("Portal User", filters={"user": user}, pluck="parent")
    frappe.logger().info(f"[DEBUG] Portal User customers: {portal_users}")
    
    if not portal_users:
        frappe.logger().warning(f"[WARNING] No Portal User mapping found for user: {user}")
        # Try to find customer by email if no Portal User mapping
        user_email = frappe.db.get_value("User", user, "email")
        if user_email:
            customers_by_email = frappe.get_all("Customer", filters={"email_id": user_email}, pluck="name")
            frappe.logger().info(f"[DEBUG] Found customers by user email: {customers_by_email}")
            return customers_by_email
    
    return portal_users


def _fetch_sales_orders(customer_list, company, months):
    """Fetch sales orders and bucket them by month."""
    from datetime import datetime, timedelta
    from collections import defaultdict

    # Ensure months is an integer (convert from string if needed)
    months = int(months) if months is not None else 12
    
    today = datetime.today()
    start_date = (today.replace(day=1) - timedelta(days=months * 31)).replace(day=1)

    filters = {"docstatus": 1, "transaction_date": (">=", start_date.strftime("%Y-%m-%d"))}
    if customer_list is not None:
        filters["customer"] = ("in", customer_list)
    if company:
        filters["company"] = company

    sales_orders = frappe.get_all(
        "Sales Order",
        filters=filters,
        fields=["name", "transaction_date", "grand_total", "currency"]
    )
    frappe.logger().info(f"[DEBUG] Sales Orders fetched: {len(sales_orders)}")

    month_buckets = defaultdict(lambda: {"order_amount": 0, "amount_paid": 0, "currency": None})
    order_to_month = {}

    for so in sales_orders:
        date = so["transaction_date"]
        month_key = date.strftime('%Y-%m') if hasattr(date, 'strftime') else str(date)[:7]
        month_buckets[month_key]["order_amount"] += so["grand_total"] or 0
        month_buckets[month_key]["currency"] = so["currency"] or month_buckets[month_key]["currency"]
        order_to_month[so["name"]] = month_key

    return sales_orders, order_to_month, month_buckets


def _accumulate_paid_amounts(sales_orders, order_to_month, month_buckets):
    """Fetch delivery notes, invoices, and accumulate paid amounts by month."""
    so_names = [so["name"] for so in sales_orders]
    if not so_names:
        return

    delivery_notes = frappe.get_all(
        "Delivery Note Item",
        filters={"against_sales_order": ("in", so_names)},
        fields=["name", "against_sales_order"]
    )
    dn_to_so = {d["name"]: d["against_sales_order"] for d in delivery_notes}
    dn_item_names = [d["name"] for d in delivery_notes]
    if not dn_item_names:
        return

    invoice_items = frappe.get_all(
        "Sales Invoice Item",
        filters={"dn_detail": ("in", dn_item_names)},
        fields=["parent", "dn_detail", "amount"]
    )
    invoice_to_dn = {i["parent"]: i["dn_detail"] for i in invoice_items}
    invoice_names = list({i["parent"] for i in invoice_items})
    if not invoice_names:
        return

    invoices = frappe.get_all(
        "Sales Invoice",
        filters={"name": ("in", invoice_names), "docstatus": 1},
        fields=["name", "grand_total", "outstanding_amount", "posting_date"]
    )
    for inv in invoices:
        paid = (inv["grand_total"] or 0) - (inv["outstanding_amount"] or 0)
        dn = invoice_to_dn.get(inv["name"])
        so = dn_to_so.get(dn)
        month_key = order_to_month.get(so)
        if month_key:
            month_buckets[month_key]["amount_paid"] += paid


def _format_monthly_result(month_buckets, months):
    """Helper: return list of monthly dicts sorted by month key"""
    # Ensure months is an integer (convert from string if needed)
    months = int(months) if months is not None else 12
    sorted_months = sorted(month_buckets.keys())[-months:]
    result = []
    for m in sorted_months:
        entry = month_buckets[m]
        result.append({
            "month": m,
            "order_amount": entry["order_amount"],
            "amount_paid": entry["amount_paid"],
            "currency": entry["currency"] or "SAR"
        })
    return result
