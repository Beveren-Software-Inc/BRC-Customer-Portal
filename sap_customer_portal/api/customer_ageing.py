import frappe
from frappe.utils.data import today, getdate

@frappe.whitelist()
def get_customer_aging():
    current_user = frappe.session.user
    # Default: get customers linked to this user
    customer_names = []
    roles = frappe.get_roles(current_user)
    if current_user == "Administrator" or "System Manager" or "Sales User" or "Sales Manager" in roles:
        # Administrator and System Manager see all customers
        customer_names = frappe.get_all("Customer", pluck="name")
    else:
        customers = frappe.get_all(
            "Portal User",
            filters={"user": current_user, "parenttype": "Customer"},
            fields=["parent"]
        )
        customer_names = [c.parent for c in customers]

    if not customer_names:
        return {}

    # Pick first customer to decide currency reference
    first_customer = customer_names[0]
    currency = frappe.get_value("Customer", first_customer, "default_currency") or "SAR"

    # Fetch invoices for all these customers with outstanding amounts
    invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "customer": ["in", customer_names],
            "outstanding_amount": [">", 0],
            "docstatus": 1
        },
        fields=["posting_date", "outstanding_amount"]
    )
    
    # Fetch unlinked return invoices (Credit Notes) that don't have return_against
    # These will have negative outstanding amounts and should reduce the ageing balance
    return_invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "customer": ["in", customer_names],
            "is_return": 1,
            "return_against": ["is", "not set"],
            "outstanding_amount": ["<", 0],
            "docstatus": 1
        },
        fields=["posting_date", "outstanding_amount"]
    )

    # Aging buckets
    aging_data = {
        "currency": currency,
        "0_30": 0.00,
        "31_60": 0.00,
        "61_90": 0.00,
        "91_120": 0.00,
        "120_plus": 0.00,
    }

    # Process regular invoices (positive outstanding amounts)
    for inv in invoices:
        age = (getdate(today()) - getdate(inv.posting_date)).days

        if 0 <= age <= 30:
            aging_data["0_30"] += inv.outstanding_amount
        elif 31 <= age <= 60:
            aging_data["31_60"] += inv.outstanding_amount
        elif 61 <= age <= 90:
            aging_data["61_90"] += inv.outstanding_amount
        elif 91 <= age <= 120:
            aging_data["91_120"] += inv.outstanding_amount
        elif age > 120:
            aging_data["120_plus"] += inv.outstanding_amount
    
    # Process return invoices (negative outstanding amounts) - these reduce the ageing balance
    for ret_inv in return_invoices:
        age = (getdate(today()) - getdate(ret_inv.posting_date)).days
        # Use absolute value since outstanding_amount is negative for returns
        return_amount = abs(ret_inv.outstanding_amount)

        if 0 <= age <= 30:
            aging_data["0_30"] -= return_amount
        elif 31 <= age <= 60:
            aging_data["31_60"] -= return_amount
        elif 61 <= age <= 90:
            aging_data["61_90"] -= return_amount
        elif 91 <= age <= 120:
            aging_data["91_120"] -= return_amount
        elif age > 120:
            aging_data["120_plus"] -= return_amount

    # Round all values
    for key in aging_data:
        if key != "currency":
            aging_data[key] = round(aging_data[key], 2)

    return aging_data
