import frappe

from sap_customer_portal.portal_customer_access import (
    get_active_customer_code_for_user,
    get_linked_customer_codes_for_user,
    get_portal_customer_list_for_user,
    is_sales_portal_user,
    set_active_customer_code_for_user,
    user_can_switch_portal_customer,
    user_has_multiple_portal_customers,
    user_should_see_desk_navigation,
)


@frappe.whitelist()
def get_portal_customer_access():
    """Return linked customers and the currently active customer for the portal."""
    linked = get_linked_customer_codes_for_user()
    active = get_active_customer_code_for_user()
    customers = get_portal_customer_list_for_user()

    return {
        "success": True,
        "has_customers": bool(linked),
        "has_multiple_customers": user_has_multiple_portal_customers(),
        "is_sales_user": is_sales_portal_user(),
        "can_switch_customer": user_can_switch_portal_customer(),
        "show_desk_navigation": user_should_see_desk_navigation(),
        "active_customer": active,
        "customers": customers,
    }


@frappe.whitelist()
def set_active_portal_customer(customer=None):
    """Switch the active customer for salesperson portal sessions."""
    if not customer:
        frappe.throw("customer is required")

    active = set_active_customer_code_for_user(customer)
    customer_name = frappe.db.get_value("Customer", active, "customer_name") or active

    return {
        "success": True,
        "active_customer": active,
        "customer_name": customer_name,
        "message": f"Active customer set to {active}",
    }
