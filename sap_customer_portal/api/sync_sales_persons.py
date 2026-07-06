import frappe
from frappe import _

import sap_customer_portal.sap_api_utils as sap_api_utils
from sap_customer_portal.portal_customer_access import (
    SALES_PERSON_SLP_CODE_FIELD,
    _sales_person_slp_code_field_exists,
)


def _extract_slp_code_from_bp(bp_record):
    for key in ("SlpCode", "SalesPersonCode", "SalesEmployeeCode"):
        value = bp_record.get(key)
        if value not in (None, "", -1, 0):
            return value
    return None


def _get_sales_person_name_from_sap(slp_code, session_cookies=None):
    """Best-effort fetch of salesperson display name from SAP."""
    for endpoint, filter_field in (
        ("SalesPersons", "SalesEmployeeCode"),
        ("SalesEmployees", "SalesEmployeeCode"),
    ):
        try:
            params = {
                "$select": "SalesEmployeeCode,SalesEmployeeName",
                "$filter": f"{filter_field} eq {int(slp_code)}",
            }
            data = sap_api_utils.fetch_sap_data_with_session(
                endpoint, params, session_cookies=session_cookies
            )
            if data:
                return data[0].get("SalesEmployeeName") or str(slp_code)
        except Exception:
            continue
    return str(slp_code)


def _ensure_sales_person(slp_code, sales_person_name):
    """Create or update a Sales Person record for the SAP SlpCode."""
    slp_code_str = str(slp_code)
    sales_person_name = (sales_person_name or slp_code_str).strip()

    existing_name = None
    if _sales_person_slp_code_field_exists():
        existing_name = frappe.db.get_value(
            "Sales Person", {SALES_PERSON_SLP_CODE_FIELD: slp_code}, "name"
        )
    if not existing_name and frappe.db.exists("Sales Person", slp_code_str):
        existing_name = slp_code_str

    if existing_name:
        doc = frappe.get_doc("Sales Person", existing_name)
        if doc.sales_person_name != sales_person_name:
            doc.sales_person_name = sales_person_name
        if _sales_person_slp_code_field_exists():
            setattr(doc, SALES_PERSON_SLP_CODE_FIELD, slp_code)
        doc.flags.ignore_permissions = True
        doc.save(ignore_permissions=True)
        return doc.name

    doc = frappe.new_doc("Sales Person")
    doc.sales_person_name = sales_person_name
    doc.enabled = 1
    if _sales_person_slp_code_field_exists():
        setattr(doc, SALES_PERSON_SLP_CODE_FIELD, slp_code)
    doc.flags.ignore_permissions = True
    doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_customer_sales_team(customer_name, sales_person_name):
    """Add the salesperson to the Customer sales_team child table if missing."""
    customer = frappe.get_doc("Customer", customer_name)
    existing = {row.sales_person for row in (customer.get("sales_team") or [])}
    if sales_person_name in existing:
        return False

    customer.append(
        "sales_team",
        {
            "sales_person": sales_person_name,
            "allocated_percentage": 100,
        },
    )
    customer.flags.ignore_permissions = True
    customer.save(ignore_permissions=True)
    return True


def _fetch_bp_slp_code(customer_code, session_cookies):
    params = {
        "$select": "CardCode,CardName,SlpCode,SalesPersonCode",
        "$filter": f"CardCode eq '{customer_code}'",
    }
    data = sap_api_utils.fetch_sap_data_with_session(
        "BusinessPartners", params, session_cookies=session_cookies
    )
    if not data:
        return None, None
    record = data[0]
    return _extract_slp_code_from_bp(record), record.get("CardName")


@frappe.whitelist()
def sync_customer_sales_persons_from_sap():
    """Sync SAP SlpCode onto Customer sales_team and Sales Person records."""
    frappe.only_for("System Manager")

    customers = frappe.get_all("Customer", fields=["name", "customer_name"])
    if not customers:
        return {
            "success": True,
            "message": _("No Customer records found."),
            "updated": 0,
            "skipped": 0,
            "errors": 0,
        }

    session_cookies = sap_api_utils.get_or_create_sap_session()
    if not session_cookies:
        frappe.throw(_("Failed to connect to SAP B1"))

    updated = 0
    skipped = 0
    errors = 0
    error_details = []

    try:
        for row in customers:
            customer_code = row.name
            try:
                slp_code, _card_name = _fetch_bp_slp_code(customer_code, session_cookies)
                if not slp_code:
                    skipped += 1
                    continue

                sales_person_name = _get_sales_person_name_from_sap(
                    slp_code, session_cookies=session_cookies
                )
                sp_name = _ensure_sales_person(slp_code, sales_person_name)
                if _ensure_customer_sales_team(customer_code, sp_name):
                    updated += 1
                else:
                    skipped += 1
            except Exception as exc:
                errors += 1
                error_details.append(f"{customer_code}: {exc}")
                frappe.logger().error(
                    f"[SlpCode Sync] Failed for {customer_code}: {exc}"
                )
    finally:
        try:
            sap_api_utils.cleanup_sap_session()
        except Exception:
            pass

    frappe.db.commit()

    message = _(
        "Salesperson sync finished. Updated: {0}, Skipped: {1}, Errors: {2}"
    ).format(updated, skipped, errors)

    return {
        "success": errors == 0,
        "message": message,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
        "error_details": error_details[:20],
    }
