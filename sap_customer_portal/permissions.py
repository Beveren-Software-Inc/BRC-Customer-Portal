import frappe
from frappe import _

def is_customer_user():
    """Return True only if the user is strictly a Customer user.
    Exclude Administrator and System Manager even if they have the 'Customer' role."""
    if frappe.session.user in ["Administrator"] or "System Manager" in frappe.get_roles(frappe.session.user):
        return False
    roles = frappe.get_roles(frappe.session.user)
    return "Customer" in roles


def is_sales_user():
    """Return True if the current user has the Sales User portal role."""
    from sap_customer_portal.portal_customer_access import is_sales_portal_user
    return is_sales_portal_user()


def has_customer_permissions():
    """Check if the current user has any User Permissions set for the Customer doctype."""
    if frappe.session.user == "Administrator":
        return True
        
    perms = frappe.db.exists("User Permission", 
        {
            "user": frappe.session.user, 
            "allow": "Customer", 
            "is_default": 0 
        }
    )
    return bool(perms)

def get_allowed_customers(user):
    """Get Customer document names the user may access via User Permissions or sales team."""
    perms = frappe.get_all("User Permission", 
        filters={
            "user": user, 
            "allow": "Customer" 
        },
        fields=["for_value"]
    )
    customers = [perm.for_value for perm in perms if perm.for_value]

    from sap_customer_portal.portal_customer_access import get_portal_customers_via_sales_person
    customers.extend(get_portal_customers_via_sales_person(user))

    return list(dict.fromkeys(customers))

def customer_has_permission(doc, user=None, permission_type=None):
    """
    Enforce custom permission on Customer documents only for website users.
    For non-website users (desk users), return True immediately.
    """
    if not user:
        user = frappe.session.user

    if not is_website_user(user):
        return True

    if not doc or permission_type == "create":
        return True

    allowed_customers = get_allowed_customers(user)  
    return doc.name in allowed_customers

def customer_user_has_permission(doc, user=None, permission_type=None):
    """
    Enforce custom permission on transaction documents based on the linked Customer,
    but only for website users.
    """
    if not user:
        user = frappe.session.user

    if not is_website_user(user):
        return True

    if not doc or permission_type == "create":
        return True

    if not getattr(doc, 'customer', None):
        return False

    allowed_customers = get_allowed_customers(user)  
    return doc.customer in allowed_customers


def is_website_user(user=None):
    """
    Check if a given user (or the current session user) is a Website User.
    Returns True if the user's 'user_type' is 'Website User'.
    """
    if not user:
        user = frappe.session.user

    if user == "Administrator" or "System Manager" in frappe.get_roles(user):
        return False

    user_doc = frappe.get_doc("User", user)
    return user_doc.get("user_type") == "Website User"
