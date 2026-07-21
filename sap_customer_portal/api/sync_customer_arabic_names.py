import json

import frappe
from frappe import _
from frappe.utils import cstr, escape_html

import sap_customer_portal.sap_api_utils as sap_api_utils
from sap_customer_portal.api.sync_sales_persons import (
    _paginated_sap_fetch,
    _reset_sap_session,
    _sap_get_list,
)

ARABIC_NAME_FIELD = "custom_arabic_name"
SAP_ARABIC_NAME_PROPERTY = "CardForeignName"  # OCRD.CardFName in Service Layer
SYNC_JOB_TIMEOUT = 7200
SYNC_JOB_NAME = "sync_customer_arabic_names_from_sap"
SYNC_RUNNING_KEY = "sap_customer_arabic_name_sync_running"
COMMIT_EVERY_N_CUSTOMERS = 50
LOG_BATCH_SIZE = 400


def _require_arabic_name_field():
    if not frappe.get_meta("Customer").has_field(ARABIC_NAME_FIELD):
        frappe.throw(
            _(
                "Customer field {0} is missing. Run bench migrate before starting the sync."
            ).format(ARABIC_NAME_FIELD)
        )


def _escape_odata(value):
    return cstr(value).replace("'", "''")


def _fetch_one_customer(customer, session_holder):
    params = {
        "$select": f"CardCode,CardName,{SAP_ARABIC_NAME_PROPERTY}",
        "$filter": f"CardCode eq '{_escape_odata(customer)}'",
        "$top": "1",
    }
    rows = _sap_get_list("BusinessPartners", params, session_holder)
    response = rows[0] if rows else None
    return response, {
        "endpoint": "BusinessPartners",
        "ocrd_field": "CardFName",
        "service_layer_property": SAP_ARABIC_NAME_PROPERTY,
        "request": params,
        "response": response,
    }


def _sync_one_customer(customer, session_holder, sap_row=None):
    if sap_row is None:
        sap_row, sap_meta = _fetch_one_customer(customer, session_holder)
    else:
        sap_meta = {
            "source": "bulk_fetch",
            "ocrd_field": "CardFName",
            "service_layer_property": SAP_ARABIC_NAME_PROPERTY,
            "response": sap_row,
        }

    result = {
        "customer": customer,
        "status": "failed",
        "message": "",
        "previous_arabic_name": frappe.db.get_value(
            "Customer", customer, ARABIC_NAME_FIELD
        ),
        "arabic_name": None,
        "sap": sap_meta,
    }

    if not sap_row:
        result["message"] = "No SAP Business Partner found for this Customer/CardCode"
        return result

    arabic_name = (sap_row.get(SAP_ARABIC_NAME_PROPERTY) or "").strip()
    result["arabic_name"] = arabic_name
    if not arabic_name:
        result["status"] = "skipped"
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


def _format_log_line(result):
    return (
        f"{result['customer']} | {result['status'].upper()} | "
        f"Previous={json.dumps(result.get('previous_arabic_name'), ensure_ascii=False)} | "
        f"ArabicName={json.dumps(result.get('arabic_name'), ensure_ascii=False)} | "
        f"SAP={json.dumps(result.get('sap'), ensure_ascii=False, default=cstr)} | "
        f"{result.get('message') or ''}"
    )


def _format_result_html(result):
    return "<br>".join(
        [
            f"<b>Customer:</b> {escape_html(result['customer'])}",
            f"<b>Status:</b> {escape_html(result['status'])}",
            f"<b>Message:</b> {escape_html(result.get('message') or '-')}",
            f"<b>Previous Arabic Name:</b> <span dir='rtl'>{escape_html(result.get('previous_arabic_name') or '-')}</span>",
            f"<b>SAP Arabic Name:</b> <span dir='rtl'>{escape_html(result.get('arabic_name') or '-')}</span>",
            "<b>SAP request/response:</b>",
            (
                "<pre style='white-space:pre-wrap'>"
                + escape_html(
                    json.dumps(result.get("sap"), indent=2, ensure_ascii=False, default=cstr)
                )
                + "</pre>"
            ),
        ]
    )


def _write_customer_logs(results):
    lines = [_format_log_line(result) for result in results]
    for line in lines:
        frappe.logger().info(f"[Arabic Name Sync] {line}")

    for start in range(0, len(lines), LOG_BATCH_SIZE):
        batch_number = (start // LOG_BATCH_SIZE) + 1
        title = "SAP Customer Arabic Name Sync — Customer Log"
        if len(lines) > LOG_BATCH_SIZE:
            title += f" (part {batch_number})"
        frappe.log_error("\n".join(lines[start : start + LOG_BATCH_SIZE]), title)


def _run_customer_arabic_name_sync():
    _require_arabic_name_field()
    customers = frappe.get_all("Customer", pluck="name")
    session_holder = {"cookies": None}
    session_holder["cookies"] = _reset_sap_session(session_holder)
    if not session_holder["cookies"]:
        frappe.throw(_("Failed to connect to SAP B1"))

    try:
        sap_rows = _paginated_sap_fetch(
            "BusinessPartners",
            f"CardCode,CardName,{SAP_ARABIC_NAME_PROPERTY}",
            session_holder,
            odata_filter="CardType eq 'cCustomer'",
        )
        if not sap_rows:
            sap_rows = _paginated_sap_fetch(
                "BusinessPartners",
                f"CardCode,CardName,{SAP_ARABIC_NAME_PROPERTY}",
                session_holder,
            )
        sap_by_customer = {
            row.get("CardCode"): row for row in sap_rows if row.get("CardCode")
        }

        results = []
        for index, customer in enumerate(customers, start=1):
            try:
                results.append(
                    _sync_one_customer(
                        customer,
                        session_holder,
                        sap_row=sap_by_customer.get(customer),
                    )
                )
            except Exception as exc:
                results.append(
                    {
                        "customer": customer,
                        "status": "error",
                        "message": cstr(exc),
                        "previous_arabic_name": None,
                        "arabic_name": None,
                        "sap": None,
                    }
                )
            if index % COMMIT_EVERY_N_CUSTOMERS == 0:
                frappe.db.commit()

        frappe.db.commit()
        counts = {
            status: sum(1 for result in results if result["status"] == status)
            for status in ("success", "unchanged", "skipped", "failed", "error")
        }
        summary = _(
            "Customer Arabic name sync finished. Total: {0}, Updated: {1}, "
            "Unchanged: {2}, Empty in SAP: {3}, Not found: {4}, Errors: {5}"
        ).format(
            len(customers),
            counts["success"],
            counts["unchanged"],
            counts["skipped"],
            counts["failed"],
            counts["error"],
        )
        return {
            "success": counts["failed"] == 0 and counts["error"] == 0,
            "message": summary,
            "results": results,
            **counts,
        }
    finally:
        sap_api_utils.cleanup_sap_session()


def _sync_customer_arabic_names_background():
    try:
        result = _run_customer_arabic_name_sync()
        title = (
            "SAP Customer Arabic Name Sync Complete"
            if result["success"]
            else "SAP Customer Arabic Name Sync Finished with Errors"
        )
        frappe.log_error(result["message"], title)
        _write_customer_logs(result["results"])
        return result
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SAP Customer Arabic Name Sync Failed")
        raise
    finally:
        try:
            frappe.cache().delete_value(SYNC_RUNNING_KEY)
        except Exception:
            pass


@frappe.whitelist()
def sync_single_customer_arabic_name_from_sap(customer=None):
    frappe.only_for("System Manager")
    _require_arabic_name_field()
    if not customer or not frappe.db.exists("Customer", customer):
        frappe.throw(_("A valid Customer is required"))

    session_holder = {"cookies": None}
    session_holder["cookies"] = _reset_sap_session(session_holder)
    if not session_holder["cookies"]:
        frappe.throw(_("Failed to connect to SAP B1"))

    try:
        result = _sync_one_customer(customer, session_holder)
        frappe.db.commit()
        frappe.log_error(
            _format_log_line(result) + "\n\n" + _format_result_html(result),
            f"SAP Customer Arabic Name Sync — {customer}",
        )
        return {
            "success": result["status"] in ("success", "unchanged"),
            "work_done": result["status"] == "success",
            "status": result["status"],
            "message": result["message"],
            "detail_html": _format_result_html(result),
            "result": result,
        }
    finally:
        sap_api_utils.cleanup_sap_session()


@frappe.whitelist()
def sync_customer_arabic_names_from_sap():
    frappe.only_for("System Manager")
    _require_arabic_name_field()

    cache = frappe.cache()
    if cache.get_value(SYNC_RUNNING_KEY):
        return {
            "success": False,
            "message": _("Customer Arabic name sync is already running."),
        }

    try:
        cache.set_value(SYNC_RUNNING_KEY, 1, expires_in_sec=SYNC_JOB_TIMEOUT)
        frappe.enqueue(
            "sap_customer_portal.api.sync_customer_arabic_names._sync_customer_arabic_names_background",
            queue="long",
            job_name=SYNC_JOB_NAME,
            timeout=SYNC_JOB_TIMEOUT,
            is_async=True,
        )
    except Exception:
        cache.delete_value(SYNC_RUNNING_KEY)
        raise

    return {
        "success": True,
        "message": _(
            "Customer Arabic name sync started in the background. "
            "Check Error Log for the summary and per-customer SAP responses."
        ),
    }
