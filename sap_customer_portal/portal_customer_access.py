"""Portal customer access helpers.

Supports:
- Direct customer portal users (Portal User child table on Customer)
- Email-based customer matching
- Salesperson portal users (Sales Person.custom_user -> Customer sales_team)

Salespersons with multiple customers must work on one customer at a time.
The active customer is stored server-side per user session.
"""

import frappe

# Custom fields — created manually in ERPNext (not shipped as fixtures).
SALES_PERSON_USER_FIELD = "custom_user"
SALES_PERSON_SLP_CODE_FIELD = "custom_slp_code"

ACTIVE_CUSTOMER_CACHE_PREFIX = "portal_active_customer"
ACTIVE_CUSTOMER_DEFAULT_KEY = "portal_active_customer"
ACTIVE_CUSTOMER_CACHE_TTL = 60 * 60 * 24 * 30  # 30 days


def _sales_person_user_field_exists():
    return frappe.get_meta("Sales Person").has_field(SALES_PERSON_USER_FIELD)


def _sales_person_slp_code_field_exists():
    return frappe.get_meta("Sales Person").has_field(SALES_PERSON_SLP_CODE_FIELD)


def _active_customer_cache_key(user):
    return f"{ACTIVE_CUSTOMER_CACHE_PREFIX}:{user}"


def _get_stored_active_customer(user):
    """Read persisted active customer (defaults DB, with cache fallback)."""
    active = frappe.defaults.get_user_default(ACTIVE_CUSTOMER_DEFAULT_KEY, user)
    if active:
        return active
    try:
        return frappe.cache().get_value(_active_customer_cache_key(user))
    except Exception:
        return None


def _set_stored_active_customer(user, customer_code):
    """Persist active customer in the database so it survives cache clears/restarts."""
    frappe.defaults.set_user_default(ACTIVE_CUSTOMER_DEFAULT_KEY, customer_code, user)
    try:
        frappe.cache().set_value(
            _active_customer_cache_key(user),
            customer_code,
            expires_in_sec=ACTIVE_CUSTOMER_CACHE_TTL,
        )
    except Exception:
        pass


def _clear_stored_active_customer(user):
    try:
        frappe.defaults.clear_user_default(ACTIVE_CUSTOMER_DEFAULT_KEY, user)
    except Exception:
        pass
    try:
        frappe.cache().delete_value(_active_customer_cache_key(user))
    except Exception:
        pass


def get_portal_customers_via_sales_person(user):
    """Customers linked to a salesperson through Customer sales_team."""
    if not _sales_person_user_field_exists():
        return []

    sales_persons = frappe.get_all(
        "Sales Person",
        filters={SALES_PERSON_USER_FIELD: user},
        pluck="name",
    )
    if not sales_persons:
        return []

    customers = frappe.get_all(
        "Sales Team",
        filters={
            "parenttype": "Customer",
            "sales_person": ["in", sales_persons],
        },
        pluck="parent",
    )
    return list(dict.fromkeys(customers))


def get_portal_customers_via_portal_user(user):
    portal_customers = frappe.get_all(
        "Portal User",
        filters={"user": user, "parenttype": "Customer"},
        pluck="parent",
    )
    return list(dict.fromkeys(portal_customers))


def get_portal_customers_via_email(user):
    user_email = frappe.db.get_value("User", user, "email")
    if not user_email:
        return []
    customers = frappe.get_all(
        "Customer", filters={"email_id": user_email}, pluck="name"
    )
    return list(dict.fromkeys(customers))


def get_active_customer_codes_list(user=None):
    """Return a single-item list with the active customer code (for legacy loop callers)."""
    code = get_active_customer_code_for_user(user)
    return [code] if code else []


def is_sales_portal_user(user=None):
    """True when the user is a salesperson using the portal (Sales User role)."""
    user = user or frappe.session.user
    if not user or user in ("Administrator", "Guest"):
        return False
    roles = frappe.get_roles(user)
    if "System Manager" in roles:
        return False
    return "Sales User" in roles


def user_can_switch_portal_customer(user=None):
    """Sales users always pick a customer; others only when multiple are linked."""
    user = user or frappe.session.user
    linked = get_linked_customer_codes_for_user(user)
    if not linked:
        return False
    if is_sales_portal_user(user):
        return True
    return len(linked) > 1


def user_should_see_desk_navigation(user=None):
    """Portal-only users (Customer / Sales User) should not be sent to desk."""
    user = user or frappe.session.user
    if not user or user in ("Administrator", "Guest"):
        return False
    roles = set(frappe.get_roles(user))
    if "System Manager" in roles:
        return True
    portal_roles = {"Customer", "Sales User"}
    other_roles = roles - portal_roles - {"Guest", "All"}
    return bool(other_roles)


def get_linked_customer_codes_for_user(user=None):
    """All Customer document names the user may access in the portal."""
    user = user or frappe.session.user

    # Sales users only see customers from their Sales Person → sales_team links.
    if is_sales_portal_user(user):
        return get_portal_customers_via_sales_person(user)

    customers = []
    customers.extend(get_portal_customers_via_portal_user(user))
    if not customers:
        customers.extend(get_portal_customers_via_email(user))
    customers.extend(get_portal_customers_via_sales_person(user))

    return list(dict.fromkeys([c for c in customers if c]))


def user_has_multiple_portal_customers(user=None):
    return len(get_linked_customer_codes_for_user(user)) > 1


def get_active_customer_code_for_user(user=None):
    """Single customer code used for SAP/portal data queries (no mixing)."""
    user = user or frappe.session.user
    linked = get_linked_customer_codes_for_user(user)
    if not linked:
        return None

    active = _get_stored_active_customer(user)
    if active and active in linked:
        return active

    return linked[0]


def set_active_customer_code_for_user(customer_code, user=None):
    """Persist the salesperson's selected customer for portal data views."""
    user = user or frappe.session.user
    linked = get_linked_customer_codes_for_user(user)

    if not linked:
        frappe.throw("No customers are linked to your portal account.", frappe.PermissionError)
    if customer_code not in linked:
        frappe.throw("You do not have access to this customer.", frappe.PermissionError)

    previous = _get_stored_active_customer(user)
    _set_stored_active_customer(user, customer_code)
    clear_user_dashboard_cache(user)

    try:
        import sap_customer_portal.sap_api_utils as sap_api_utils

        if previous and previous != customer_code:
            sap_api_utils.clear_cache_for_customer(previous)
        sap_api_utils.clear_cache_for_customer(customer_code)
    except Exception:
        pass

    return customer_code


def clear_active_customer_for_user(user=None):
    user = user or frappe.session.user
    _clear_stored_active_customer(user)


def get_dashboard_cache_key(user=None):
    user = user or frappe.session.user
    active = get_active_customer_code_for_user(user)
    if active:
        return f"dashboard_data_{user}_{active}"
    return f"dashboard_data_{user}"


def clear_user_dashboard_cache(user=None):
    user = user or frappe.session.user
    keys = {f"dashboard_data_{user}"}
    active = _get_stored_active_customer(user)
    if active:
        keys.add(f"dashboard_data_{user}_{active}")
    for linked in get_linked_customer_codes_for_user(user):
        keys.add(f"dashboard_data_{user}_{linked}")

    cache = frappe.cache()
    for key in keys:
        try:
            cache.delete_value(key)
        except Exception:
            pass


def get_portal_customer_list_for_user(user=None):
    """Return [{customer, customer_name}, ...] for the portal customer picker."""
    user = user or frappe.session.user
    linked = get_linked_customer_codes_for_user(user)
    if not linked:
        return []

    active = get_active_customer_code_for_user(user)
    rows = frappe.get_all(
        "Customer",
        filters={"name": ["in", linked]},
        fields=["name", "customer_name"],
        order_by="name asc",
    )
    return [
        {
            "customer": row.name,
            "customer_name": row.customer_name or row.name,
            "is_active": row.name == active,
        }
        for row in rows
    ]
