"""Automatic SAP enrichment for newly created Customers.

Customers in this portal are keyed by the SAP ``CardCode``, so as soon as a
Customer is inserted we can pull the same two values that the manual "SAP"
buttons on the Customer form fetch:

* ``CardForeignName``  -> ``Customer.custom_arabic_name``
* ``SalesPersonCode``  -> ``Sales Person`` + ``Customer.sales_team``

The work is always done in a background job (enqueued after the creating
transaction commits) so that creating a Customer is never slowed down or
broken when SAP B1 is unreachable. Failures are only logged to the Error Log.

The manual per-customer buttons (see ``public/js/customer_salesperson_sync.js``)
and the bulk buttons on Customer Portal Settings remain available for re-runs.
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, cstr

import sap_customer_portal.sap_api_utils as sap_api_utils
from sap_customer_portal.api.sync_customer_arabic_names import (
    ARABIC_NAME_FIELD,
    SAP_ARABIC_NAME_PROPERTY,
    _escape_odata,
    _format_result_html,
)
from sap_customer_portal.api.sync_sales_persons import (
    _extract_slp_code_from_bp,
    _format_customer_log_html,
    _format_customer_log_line,
    _reset_sap_session,
    _sap_get_list,
)
from sap_customer_portal.api.sync_sales_persons import (
    _sync_one_customer as _sync_customer_salesperson,
)

AUTO_SYNC_SETTING_FIELD = "auto_sync_new_customers"
AUTO_SYNC_JOB_PREFIX = "customer-sap-autosync"
AUTO_SYNC_QUEUE = "default"
AUTO_SYNC_TIMEOUT = 600

BP_ENDPOINT = "BusinessPartners"
BP_BASE_FIELDS = "CardCode,CardName,SalesPersonCode"


def is_auto_sync_enabled():
    """Return True unless Customer Portal Settings explicitly disables the sync.

    A missing doctype/field (for example on a site where ``bench migrate`` has
    not run yet) is treated as enabled so the feature works out of the box.
    """
    try:
        if not frappe.get_meta("Customer Portal Settings").has_field(
            AUTO_SYNC_SETTING_FIELD
        ):
            return True
        value = frappe.db.get_single_value(
            "Customer Portal Settings", AUTO_SYNC_SETTING_FIELD
        )
    except Exception:
        return True

    return True if value is None else bool(cint(value))


def on_customer_created(doc, method=None):
    """``Customer.after_insert`` hook — queue SAP enrichment for the new Customer."""
    if not doc or not doc.name:
        return

    # Never fire SAP calls while running the test suite.
    if frappe.flags.in_test:
        return

    try:
        if not is_auto_sync_enabled():
            return

        customer = doc.name
        # Queue only once the creating transaction is committed so the
        # background job can always find the Customer and a rolled back insert
        # does not leave a job behind.
        frappe.db.after_commit.add(lambda: _enqueue_enrichment(customer))
    except Exception:
        # A failure to queue must never break Customer creation.
        frappe.log_error(
            frappe.get_traceback(),
            f"SAP Customer Auto Sync — could not queue {doc.name}",
        )


def _enqueue_enrichment(customer):
    """Enqueue the background enrichment job; queue errors are only logged."""
    try:
        if not is_auto_sync_enabled():
            return

        frappe.enqueue(
            "sap_customer_portal.customization.customer_sap_autosync.sync_new_customer_from_sap",
            queue=AUTO_SYNC_QUEUE,
            timeout=AUTO_SYNC_TIMEOUT,
            job_id=f"{AUTO_SYNC_JOB_PREFIX}::{customer}",
            deduplicate=True,
            customer=customer,
        )
    except Exception:
        frappe.log_error(
            frappe.get_traceback(),
            f"SAP Customer Auto Sync — could not queue {customer}",
        )


def _fetch_new_customer_bp_row(customer, session_holder):
    """Fetch the Business Partner row needed for both Arabic name and salesperson.

    ``CardForeignName`` is requested together with ``SalesPersonCode`` first. If
    SAP rejects that combination the two lookups are made separately so that a
    single unsupported property cannot hide a valid Business Partner.
    """
    odata_filter = f"CardCode eq '{_escape_odata(customer)}'"

    rows = _sap_get_list(
        BP_ENDPOINT,
        {
            "$select": f"{BP_BASE_FIELDS},{SAP_ARABIC_NAME_PROPERTY}",
            "$filter": odata_filter,
            "$top": "1",
        },
        session_holder,
    )
    if rows:
        return rows[0]

    rows = _sap_get_list(
        BP_ENDPOINT,
        {"$select": BP_BASE_FIELDS, "$filter": odata_filter, "$top": "1"},
        session_holder,
    )
    if not rows:
        return None

    bp_row = rows[0]
    arabic_rows = _sap_get_list(
        BP_ENDPOINT,
        {
            "$select": f"CardCode,{SAP_ARABIC_NAME_PROPERTY}",
            "$filter": odata_filter,
            "$top": "1",
        },
        session_holder,
    )
    if arabic_rows:
        bp_row[SAP_ARABIC_NAME_PROPERTY] = arabic_rows[0].get(SAP_ARABIC_NAME_PROPERTY)

    return bp_row


def _sync_arabic_name(customer, bp_row):
    """Copy ``CardForeignName`` from the SAP row onto the Customer."""
    result = {
        "customer": customer,
        "status": "skipped",
        "message": "",
        "previous_arabic_name": None,
        "arabic_name": None,
        "sap": {
            "source": "auto_sync",
            "ocrd_field": "CardFName",
            "service_layer_property": SAP_ARABIC_NAME_PROPERTY,
            "response": bp_row,
        },
    }

    if not frappe.get_meta("Customer").has_field(ARABIC_NAME_FIELD):
        result["message"] = (
            f"Customer field {ARABIC_NAME_FIELD} is missing; run bench migrate"
        )
        return result

    arabic_name = (bp_row.get(SAP_ARABIC_NAME_PROPERTY) or "").strip()
    result["previous_arabic_name"] = frappe.db.get_value(
        "Customer", customer, ARABIC_NAME_FIELD
    )
    result["arabic_name"] = arabic_name

    if not arabic_name:
        result["message"] = "OCRD.CardFName is empty in SAP"
        return result

    if result["previous_arabic_name"] == arabic_name:
        result["status"] = "unchanged"
        result["message"] = "Arabic name is already up to date"
        return result

    frappe.db.set_value(
        "Customer",
        customer,
        ARABIC_NAME_FIELD,
        arabic_name,
        update_modified=False,
    )
    result["status"] = "success"
    result["message"] = "Customer Arabic name updated"
    return result


def _sync_salesperson(customer, bp_row, session_holder):
    """Create/link the Sales Person and add it to the Customer sales team."""
    slp_code = _extract_slp_code_from_bp(bp_row)
    if not slp_code:
        return {
            "customer": customer,
            "status": "skipped",
            "message": (
                "SAP Business Partner has no salesperson code "
                "(SalesPersonCode is empty or -1)"
            ),
            "slp_code": None,
            "sales_person": None,
            "sales_person_action": None,
            "sales_team_action": None,
            "sap_bp_response": bp_row,
            "sap_sp_response": None,
            "sap_bp_meta": {"source": "auto_sync", "response": bp_row},
            "sap_sp_meta": None,
        }

    try:
        # Re-use the tested single-customer path with the SlpCode we already
        # fetched so the Business Partner is not requested from SAP twice.
        return _sync_customer_salesperson(
            customer,
            session_holder,
            sap_customer_map={customer: slp_code},
        )
    except Exception as exc:
        frappe.log_error(
            frappe.get_traceback(),
            f"SAP Customer Auto Sync — salesperson — {customer}",
        )
        return {
            "customer": customer,
            "status": "failed",
            "message": cstr(exc),
            "slp_code": slp_code,
            "sales_person": None,
            "sales_person_action": None,
            "sales_team_action": None,
            "sap_bp_response": bp_row,
            "sap_sp_response": None,
            "sap_bp_meta": {"source": "auto_sync", "response": bp_row},
            "sap_sp_meta": None,
        }


def _build_result(customer, arabic_result, salesperson_log):
    statuses = {arabic_result.get("status"), salesperson_log.get("status")}

    if statuses & {"failed", "error"}:
        status = "failed"
    elif "success" in statuses:
        status = "success"
    elif "unchanged" in statuses:
        status = "unchanged"
    else:
        status = "skipped"

    work_done = (
        arabic_result.get("status") == "success"
        or salesperson_log.get("sales_person_action") in ("created", "updated")
        or salesperson_log.get("sales_team_action") == "added"
    )

    return {
        "customer": customer,
        "status": status,
        "success": status in ("success", "unchanged"),
        "work_done": work_done,
        "message": "Arabic name: {0} | Salesperson: {1}".format(
            arabic_result.get("message") or "-",
            salesperson_log.get("message") or "-",
        ),
        "arabic_name": arabic_result,
        "salesperson": salesperson_log,
    }


def _log_auto_sync_outcome(result):
    line = "{0} | {1} | ArabicName={2} ({3}) | {4}".format(
        result["customer"],
        (result["status"] or "").upper(),
        json.dumps(result["arabic_name"].get("arabic_name"), ensure_ascii=False),
        result["arabic_name"].get("status"),
        _format_customer_log_line(result["salesperson"]),
    )
    frappe.logger().info(f"[Customer Auto Sync] {line}")

    if result["status"] == "failed":
        detail = "{0}<br><br>{1}".format(
            _format_result_html(result["arabic_name"]),
            _format_customer_log_html(result["salesperson"]),
        )
        frappe.log_error(detail, f"SAP Customer Auto Sync — {result['customer']}")


def sync_new_customer_from_sap(customer=None):
    """Background job: enrich one newly created Customer from SAP B1.

    Returns a dict describing what happened; it never raises so that a failed
    SAP round-trip only shows up in the Error Log.
    """
    if not customer or not frappe.db.exists("Customer", customer):
        return {
            "customer": customer,
            "status": "failed",
            "success": False,
            "work_done": False,
            "message": _("Customer {0} does not exist").format(customer),
        }

    session_holder = {"cookies": None}
    try:
        session_holder["cookies"] = _reset_sap_session(session_holder)
        if not session_holder["cookies"]:
            raise frappe.ValidationError(_("Failed to connect to SAP B1"))

        bp_row = _fetch_new_customer_bp_row(customer, session_holder)
        if bp_row is None:
            raise frappe.ValidationError(
                _("No SAP Business Partner found for this Customer/CardCode")
            )

        arabic_result = _sync_arabic_name(customer, bp_row)
        if arabic_result["status"] == "success":
            # Commit right away: the salesperson step may roll back on a
            # duplicate Sales Person entry.
            frappe.db.commit()

        salesperson_log = _sync_salesperson(customer, bp_row, session_holder)
        frappe.db.commit()

        result = _build_result(customer, arabic_result, salesperson_log)
        _log_auto_sync_outcome(result)
        return result
    except Exception as exc:
        frappe.log_error(
            frappe.get_traceback(),
            f"SAP Customer Auto Sync — {customer}",
        )
        return {
            "customer": customer,
            "status": "failed",
            "success": False,
            "work_done": False,
            "message": cstr(exc),
        }
    finally:
        try:
            sap_api_utils.cleanup_sap_session()
        except Exception:
            pass

