import frappe
from frappe import _

from sap_customer_portal.portal_customer_access import SALES_PERSON_USER_FIELD


def _get_customers_for_sales_person(sales_person_name):
    return frappe.get_all(
        "Sales Team",
        filters={"parenttype": "Customer", "sales_person": sales_person_name},
        pluck="parent",
    )


def _sync_user_permissions_for_sales_person(doc):
  user_id = doc.get(SALES_PERSON_USER_FIELD)
  customers = _get_customers_for_sales_person(doc.name)

  if not user_id:
      return

  for customer_name in customers:
      if not frappe.db.exists(
          "User Permission",
          {"user": user_id, "allow": "Customer", "for_value": customer_name},
      ):
          frappe.get_doc(
              {
                  "doctype": "User Permission",
                  "user": user_id,
                  "allow": "Customer",
                  "for_value": customer_name,
                  "allow_for_all_doctypes": 1,
              }
          ).insert(ignore_permissions=True)


def _remove_stale_permissions_for_sales_person(doc, previous_user=None):
    user_id = previous_user or doc.get(SALES_PERSON_USER_FIELD)
    if not user_id:
        return

    current_customers = set(_get_customers_for_sales_person(doc.name))
    permissions = frappe.get_all(
        "User Permission",
        filters={"user": user_id, "allow": "Customer"},
        fields=["name", "for_value"],
    )

    for perm in permissions:
        if perm.for_value not in current_customers:
            frappe.delete_doc("User Permission", perm.name, ignore_permissions=True)


def sync_sales_person_portal_permissions(doc, method=None):
    """Grant portal User Permissions when custom_user is set on Sales Person."""
    if not frappe.get_meta("Sales Person").has_field(SALES_PERSON_USER_FIELD):
        return

    previous_user = None
    if not doc.is_new():
        before = doc.get_doc_before_save()
        if before:
            previous_user = before.get(SALES_PERSON_USER_FIELD)

    current_user = doc.get(SALES_PERSON_USER_FIELD)

    if previous_user and previous_user != current_user:
        _remove_stale_permissions_for_sales_person(doc, previous_user=previous_user)

    if current_user:
        _sync_user_permissions_for_sales_person(doc)

    frappe.db.commit()


def cleanup_sales_person_portal_permissions(doc, method=None):
    if not frappe.get_meta("Sales Person").has_field(SALES_PERSON_USER_FIELD):
        return

    previous_user = doc.get(SALES_PERSON_USER_FIELD)
    if previous_user:
        _remove_stale_permissions_for_sales_person(doc, previous_user=previous_user)
        frappe.db.commit()
