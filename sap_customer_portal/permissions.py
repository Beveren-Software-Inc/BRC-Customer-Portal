import frappe
from frappe import _

def is_customer_user():
    """Return True only if the user is strictly a Customer user.
    Exclude Administrator and System Manager even if they have the 'Customer' role."""
    if frappe.session.user in ["Administrator"] or "System Manager" in frappe.get_roles(frappe.session.user):
        return False
    roles = frappe.get_roles(frappe.session.user)
    return "Customer" in roles

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
    """Get a list of specific Customer document names the user is allowed to access via User Permissions."""
    perms = frappe.get_all("User Permission", 
        filters={
            "user": user, 
            "allow": "Customer" 
        },
        fields=["for_value"]
    )
    # Return a list of specific customer names (e.g., ['CUST-0001', 'CUST-0002'])
    return [perm.for_value for perm in perms if perm.for_value]

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
