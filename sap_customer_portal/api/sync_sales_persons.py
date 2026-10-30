import json

import frappe
from frappe import _
from frappe.utils import cstr, escape_html

import sap_customer_portal.sap_api_utils as sap_api_utils
from sap_customer_portal.portal_customer_access import (
    SALES_PERSON_SLP_CODE_FIELD,
    _sales_person_slp_code_field_exists,
)

SYNC_JOB_TIMEOUT = 7200  # 2 hours
SYNC_JOB_NAME = "sync_customer_sales_persons_from_sap"
SYNC_RUNNING_KEY = "sap_sales_person_sync_running"
COMMIT_EVERY_N_CUSTOMERS = 50
SAP_PAGE_SIZE = 500
CUSTOMER_LOG_BATCH_SIZE = 400


def _extract_slp_code_from_bp(bp_record):
    """Read salesperson code from a SAP Business Partner row."""
    if not bp_record:
        return None
    for key in ("SalesPersonCode", "SlpCode", "SalesEmployeeCode"):
        value = bp_record.get(key)
        if value in (None, ""):
            continue
        try:
            code = int(value)
        except (TypeError, ValueError):
            continue
        if code > 0:
            return code
    return None


def _reset_sap_session(session_holder):
    if hasattr(frappe.local, "sap_session"):
        delattr(frappe.local, "sap_session")
    session_holder["cookies"] = sap_api_utils.get_or_create_sap_session()
    return session_holder["cookies"]


def _sap_get_list(endpoint, params, session_holder):
    """Fetch a SAP collection page, refreshing the session once on failure."""
    cookies = session_holder.get("cookies")
    data = sap_api_utils.fetch_sap_data_with_session(
        endpoint, params, session_cookies=cookies
    )
    if data is None:
        _reset_sap_session(session_holder)
        cookies = session_holder.get("cookies")
        data = sap_api_utils.fetch_sap_data_with_session(
            endpoint, params, session_cookies=cookies
        )
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


def _paginated_sap_fetch(endpoint, select_fields, session_holder, odata_filter=None):
    rows = []
    skip = 0
    while True:
        params = {
            "$select": select_fields,
            "$top": str(SAP_PAGE_SIZE),
            "$skip": str(skip),
        }
        if odata_filter:
            params["$filter"] = odata_filter

        page = _sap_get_list(endpoint, params, session_holder)
        if not page:
            break

        rows.extend(page)
        if len(page) < SAP_PAGE_SIZE:
            break
        skip += SAP_PAGE_SIZE

    return rows


def _fetch_sap_bp_row(customer_code, session_holder):
    """Fetch one Business Partner row from SAP for logging and processing."""
    params = {
        "$select": "CardCode,CardName,SalesPersonCode",
        "$filter": f"CardCode eq '{customer_code}'",
        "$top": "1",
    }
    rows = _sap_get_list("BusinessPartners", params, session_holder)
    meta = {
        "endpoint": "BusinessPartners",
        "request": params,
        "response": rows[0] if rows else None,
        "found": bool(rows),
    }
    return (rows[0] if rows else None), meta


def _fetch_sap_sales_person_row(slp_code, session_holder):
    """Fetch salesperson master row from SAP for logging."""
    for endpoint, filter_field in (
        ("SalesPersons", "SalesEmployeeCode"),
        ("SalesEmployees", "SalesEmployeeCode"),
    ):
        params = {
            "$select": "SalesEmployeeCode,SalesEmployeeName",
            "$filter": f"{filter_field} eq {int(slp_code)}",
            "$top": "1",
        }
        rows = _sap_get_list(endpoint, params, session_holder)
        meta = {
            "endpoint": endpoint,
            "request": params,
            "response": rows[0] if rows else None,
            "found": bool(rows),
        }
        if rows:
            return rows[0], meta
    return None, {
        "endpoint": "SalesPersons/SalesEmployees",
        "request": {"SalesEmployeeCode": slp_code},
        "response": None,
        "found": False,
    }


def _build_sap_customer_slp_map(session_holder):
    """Bulk-load CardCode -> SalesPersonCode from SAP Business Partners."""
    mapping = {}

    for odata_filter in (
        "CardType eq 'cCustomer'",
        None,
    ):
        rows = _paginated_sap_fetch(
            "BusinessPartners",
            "CardCode,SalesPersonCode",
            session_holder,
            odata_filter=odata_filter,
        )
        if rows:
            break

    for row in rows:
        card_code = row.get("CardCode")
        slp_code = _extract_slp_code_from_bp(row)
        if card_code and slp_code:
            mapping[card_code] = slp_code

    return mapping


def _build_sap_slp_name_map(session_holder):
    """Bulk-load SalesPersonCode -> display name from SAP."""
    names = {}

    for endpoint in ("SalesPersons", "SalesEmployees"):
        rows = _paginated_sap_fetch(
            endpoint,
            "SalesEmployeeCode,SalesEmployeeName",
            session_holder,
        )
        for row in rows:
            code = row.get("SalesEmployeeCode")
            label = (row.get("SalesEmployeeName") or "").strip()
            if code is not None and label:
                try:
                    names[int(code)] = label
                except (TypeError, ValueError):
                    names[code] = label
        if names:
            break

    return names


def _slp_code_lookup_values(slp_code):
    """Return SlpCode variants for DB lookup (int/str mismatches)."""
    values = set()
    if slp_code is None:
        return values
    values.add(slp_code)
    values.add(str(slp_code))
    try:
        values.add(int(slp_code))
    except (TypeError, ValueError):
        pass
    return values


def _find_existing_sales_person(slp_code, sales_person_name):
    """Find Sales Person by SAP SlpCode or by display name (name = sales_person_name in ERPNext)."""
    sales_person_name = (sales_person_name or "").strip()

    if _sales_person_slp_code_field_exists():
        for value in _slp_code_lookup_values(slp_code):
            name = frappe.db.get_value(
                "Sales Person", {SALES_PERSON_SLP_CODE_FIELD: value}, "name"
            )
            if name:
                return name

    slp_code_str = str(slp_code)
    if frappe.db.exists("Sales Person", slp_code_str):
        return slp_code_str

    if sales_person_name:
        if frappe.db.exists("Sales Person", sales_person_name):
            return sales_person_name
        name = frappe.db.get_value(
            "Sales Person", {"sales_person_name": sales_person_name}, "name"
        )
        if name:
            return name

    return None


def _ensure_sales_person(slp_code, sales_person_name):
    """Create or update a Sales Person record for the SAP SlpCode."""
    slp_code_str = str(slp_code)
    sales_person_name = (sales_person_name or slp_code_str).strip()

    existing_name = _find_existing_sales_person(slp_code, sales_person_name)

    if existing_name:
        doc = frappe.get_doc("Sales Person", existing_name)
        changed = False
        if doc.sales_person_name != sales_person_name:
            doc.sales_person_name = sales_person_name
            changed = True
        if _sales_person_slp_code_field_exists():
            current_slp = doc.get(SALES_PERSON_SLP_CODE_FIELD)
            if current_slp in (None, "") or str(current_slp) != slp_code_str:
                setattr(doc, SALES_PERSON_SLP_CODE_FIELD, slp_code)
                changed = True
        if changed:
            doc.flags.ignore_permissions = True
            doc.save(ignore_permissions=True)
            return doc.name, "updated"
        return doc.name, "unchanged"

    doc = frappe.new_doc("Sales Person")
    doc.sales_person_name = sales_person_name
    doc.enabled = 1
    if _sales_person_slp_code_field_exists():
        setattr(doc, SALES_PERSON_SLP_CODE_FIELD, slp_code)
    doc.flags.ignore_permissions = True

    try:
        doc.insert(ignore_permissions=True)
        return doc.name, "created"
    except Exception as exc:
        if not frappe.db.is_duplicate_entry(exc):
            raise
        frappe.db.rollback()
        existing_name = _find_existing_sales_person(slp_code, sales_person_name)
        if not existing_name:
            raise
        doc = frappe.get_doc("Sales Person", existing_name)
        changed = False
        if _sales_person_slp_code_field_exists() and not doc.get(SALES_PERSON_SLP_CODE_FIELD):
            setattr(doc, SALES_PERSON_SLP_CODE_FIELD, slp_code)
            changed = True
        if changed:
            doc.flags.ignore_permissions = True
            doc.save(ignore_permissions=True)
            return doc.name, "updated"
        return doc.name, "unchanged"


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


def _format_customer_log_line(customer_log):
    return (
        f"{customer_log['customer']} | {customer_log['status'].upper()} | "
        f"SlpCode={customer_log.get('slp_code') or '-'} | "
        f"SAP_BP={json.dumps(customer_log.get('sap_bp_response'), default=cstr)} | "
        f"SAP_SP={json.dumps(customer_log.get('sap_sp_response'), default=cstr)} | "
        f"SalesPerson={customer_log.get('sales_person') or '-'} "
        f"({customer_log.get('sales_person_action') or '-'}) | "
        f"SalesTeam={customer_log.get('sales_team_action') or '-'} | "
        f"{customer_log.get('message') or ''}"
    )


def _format_customer_log_html(customer_log):
    parts = [
        f"<b>Customer:</b> {escape_html(customer_log['customer'])}",
        f"<b>Status:</b> {escape_html(customer_log['status'])}",
        f"<b>Message:</b> {escape_html(customer_log.get('message') or '-')}",
    ]
    if customer_log.get("slp_code") is not None:
        parts.append(f"<b>SlpCode:</b> {escape_html(customer_log['slp_code'])}")
    if customer_log.get("sales_person"):
        parts.append(
            f"<b>Sales Person:</b> {escape_html(customer_log['sales_person'])} "
            f"({escape_html(customer_log.get('sales_person_action') or '-')})"
        )
    if customer_log.get("sales_team_action"):
        parts.append(f"<b>Sales Team:</b> {escape_html(customer_log['sales_team_action'])}")

    parts.append("<b>SAP Business Partner</b>")
    parts.append(
        f"<pre style='white-space:pre-wrap'>{escape_html(json.dumps(customer_log.get('sap_bp_meta'), indent=2, default=cstr))}</pre>"
    )
    parts.append("<b>SAP Salesperson</b>")
    parts.append(
        f"<pre style='white-space:pre-wrap'>{escape_html(json.dumps(customer_log.get('sap_sp_meta'), indent=2, default=cstr))}</pre>"
    )
    return "<br>".join(parts)


def _sync_one_customer(
    customer_code,
    session_holder,
    sap_customer_map=None,
    sap_name_map=None,
    always_fetch_sap=False,
):
    """Sync one customer and return a detailed per-customer log entry."""
    customer_log = {
        "customer": customer_code,
        "status": "skipped",
        "message": "",
        "slp_code": None,
        "sales_person": None,
        "sales_person_action": None,
        "sales_team_action": None,
        "sap_bp_response": None,
        "sap_sp_response": None,
        "sap_bp_meta": None,
        "sap_sp_meta": None,
    }

    slp_code = sap_customer_map.get(customer_code) if sap_customer_map else None
    bp_row = None

    if always_fetch_sap or not slp_code:
        bp_row, bp_meta = _fetch_sap_bp_row(customer_code, session_holder)
        customer_log["sap_bp_meta"] = bp_meta
        customer_log["sap_bp_response"] = bp_meta.get("response")
        if not bp_meta.get("found"):
            customer_log["status"] = "failed"
            customer_log["message"] = "No SAP Business Partner found for this CardCode"
            return customer_log
        if not slp_code:
            slp_code = _extract_slp_code_from_bp(bp_row)
    else:
        customer_log["sap_bp_meta"] = {
            "source": "bulk_map",
            "response": {
                "CardCode": customer_code,
                "SalesPersonCode": slp_code,
            },
        }
        customer_log["sap_bp_response"] = customer_log["sap_bp_meta"]["response"]

    if not slp_code:
        customer_log["status"] = "skipped"
        customer_log["message"] = "SAP Business Partner has no salesperson code (SalesPersonCode is empty or -1)"
        return customer_log

    customer_log["slp_code"] = slp_code

    sales_person_label = None
    sp_row = None
    if sap_name_map and int(slp_code) in sap_name_map:
        sales_person_label = sap_name_map[int(slp_code)]
        customer_log["sap_sp_meta"] = {
            "source": "bulk_map",
            "response": {
                "SalesEmployeeCode": slp_code,
                "SalesEmployeeName": sales_person_label,
            },
        }
        customer_log["sap_sp_response"] = customer_log["sap_sp_meta"]["response"]
    else:
        sp_row, sp_meta = _fetch_sap_sales_person_row(slp_code, session_holder)
        customer_log["sap_sp_meta"] = sp_meta
        customer_log["sap_sp_response"] = sp_meta.get("response")
        if sp_row:
            sales_person_label = (sp_row.get("SalesEmployeeName") or "").strip()

    if not sales_person_label:
        sales_person_label = str(slp_code)
        if not customer_log.get("sap_sp_meta", {}).get("found"):
            customer_log["message"] = (
                customer_log.get("message") or "Salesperson name not found in SAP; using SlpCode as label"
            )

    sp_name, sp_action = _ensure_sales_person(slp_code, sales_person_label)
    customer_log["sales_person"] = sp_name
    customer_log["sales_person_action"] = sp_action

    if _ensure_customer_sales_team(customer_code, sp_name):
        customer_log["sales_team_action"] = "added"
    else:
        customer_log["sales_team_action"] = "already_exists"

    work_done = sp_action in ("created", "updated") or customer_log["sales_team_action"] == "added"
    if work_done:
        customer_log["status"] = "success"
        customer_log["message"] = customer_log.get("message") or "Synced successfully"
    else:
        customer_log["status"] = "unchanged"
        customer_log["message"] = customer_log.get("message") or "Already up to date"

    return customer_log


def _write_customer_logs_to_error_log(customer_logs, title_prefix="SAP Salesperson Sync"):
    """Append every customer line to the app log; send only failures to the Error Log.

    Successful / unchanged / skipped rows are routine and used to flood the
    Error Log, so only rows with status "error" or "failed" are written there.
    """
    if not customer_logs:
        return

    formatted = [(_format_customer_log_line(log), log.get("status")) for log in customer_logs]
    for line, _status in formatted:
        frappe.logger().info(f"[SlpCode Sync] {line}")

    failure_lines = [
        line for line, status in formatted if status in ("error", "failed")
    ]
    if not failure_lines:
        return

    batch_count = 0
    for start in range(0, len(failure_lines), CUSTOMER_LOG_BATCH_SIZE):
        batch = failure_lines[start : start + CUSTOMER_LOG_BATCH_SIZE]
        batch_count += 1
        title = f"{title_prefix} — Failed Customers"
        if len(failure_lines) > CUSTOMER_LOG_BATCH_SIZE:
            title += f" (part {batch_count})"
        frappe.log_error("\n".join(batch), title)


def _format_sync_message(stats):
    return _(
        "Salesperson sync finished.\n"
        "ERPNext customers: {total_erp}\n"
        "SAP customers with salesperson: {sap_with_sp}\n"
        "Success: {success_count}\n"
        "Unchanged: {unchanged_count}\n"
        "Skipped: {skipped_count}\n"
        "Failed: {failed_count}\n"
        "Sales team rows added: {sales_team_added}\n"
        "Already on sales team: {sales_team_exists}\n"
        "Sales Persons created: {sales_persons_created}\n"
        "Sales Persons updated: {sales_persons_updated}\n"
        "Errors: {errors}"
    ).format(**stats)


def _apply_customer_log_to_stats(customer_log, stats):
    status = customer_log.get("status")
    if status == "success":
        stats["success_count"] += 1
    elif status == "unchanged":
        stats["unchanged_count"] += 1
    elif status == "failed":
        stats["failed_count"] += 1
        stats["errors"] += 1
    else:
        stats["skipped_count"] += 1

    sp_action = customer_log.get("sales_person_action")
    if sp_action == "created":
        stats["sales_persons_created"] += 1
    elif sp_action == "updated":
        stats["sales_persons_updated"] += 1

    team_action = customer_log.get("sales_team_action")
    if team_action == "added":
        stats["sales_team_added"] += 1
    elif team_action == "already_exists":
        stats["sales_team_exists"] += 1


def _run_sales_person_sync():
    """Core sync logic — intended to run in a background worker."""
    customers = frappe.get_all("Customer", fields=["name", "customer_name"])
    stats = {
        "total_erp": len(customers),
        "sap_with_sp": 0,
        "success_count": 0,
        "unchanged_count": 0,
        "skipped_count": 0,
        "failed_count": 0,
        "sales_team_added": 0,
        "sales_team_exists": 0,
        "sales_persons_created": 0,
        "sales_persons_updated": 0,
        "no_sap_sales_person": 0,
        "errors": 0,
    }
    customer_logs = []
    error_details = []

    if not customers:
        stats["message"] = _("No Customer records found in ERPNext.")
        return {
            "success": True,
            "message": stats["message"],
            **stats,
            "customer_logs": [],
            "error_details": [],
        }

    session_holder = {"cookies": None}
    session_holder["cookies"] = _reset_sap_session(session_holder)
    if not session_holder["cookies"]:
        frappe.throw(_("Failed to connect to SAP B1"))

    try:
        sap_customer_map = _build_sap_customer_slp_map(session_holder)
        sap_name_map = _build_sap_slp_name_map(session_holder)
        stats["sap_with_sp"] = len(sap_customer_map)

        frappe.logger().info(
            f"[SlpCode Sync] Loaded {stats['sap_with_sp']} SAP customers with salesperson, "
            f"{len(sap_name_map)} salesperson names"
        )

        if not sap_customer_map:
            sample_customer = customers[0].name
            sample_log = _sync_one_customer(
                sample_customer,
                session_holder,
                always_fetch_sap=True,
            )
            error_details.append(_format_customer_log_line(sample_log))
            customer_logs.append(sample_log)

        for index, row in enumerate(customers, start=1):
            customer_code = row.name
            try:
                customer_log = _sync_one_customer(
                    customer_code,
                    session_holder,
                    sap_customer_map=sap_customer_map,
                    sap_name_map=sap_name_map,
                    always_fetch_sap=not sap_customer_map,
                )
                customer_logs.append(customer_log)
                _apply_customer_log_to_stats(customer_log, stats)

                if customer_log["status"] == "skipped" and not customer_log.get("slp_code"):
                    stats["no_sap_sales_person"] += 1
            except Exception as exc:
                stats["errors"] += 1
                stats["failed_count"] += 1
                fail_log = {
                    "customer": customer_code,
                    "status": "error",
                    "message": str(exc),
                    "slp_code": None,
                    "sales_person": None,
                    "sales_person_action": None,
                    "sales_team_action": None,
                    "sap_bp_response": None,
                    "sap_sp_response": None,
                    "sap_bp_meta": None,
                    "sap_sp_meta": None,
                }
                customer_logs.append(fail_log)
                error_details.append(f"{customer_code}: {exc}")
                frappe.logger().error(
                    f"[SlpCode Sync] Failed for {customer_code}: {exc}"
                )

            if index % COMMIT_EVERY_N_CUSTOMERS == 0:
                frappe.db.commit()
                frappe.logger().info(
                    f"[SlpCode Sync] Progress: {index}/{stats['total_erp']} "
                    f"(added={stats['sales_team_added']}, "
                    f"created={stats['sales_persons_created']}, "
                    f"errors={stats['errors']})"
                )
    finally:
        try:
            sap_api_utils.cleanup_sap_session()
        except Exception:
            pass

    frappe.db.commit()

    message = _format_sync_message(stats)
    work_done = (
        stats["sales_team_added"]
        + stats["sales_persons_created"]
        + stats["sales_persons_updated"]
    )

    return {
        "success": stats["errors"] == 0,
        "message": message,
        "work_done": work_done,
        **stats,
        "customer_logs": customer_logs,
        "error_details": error_details[:30],
    }


def _sync_customer_sales_persons_background():
    """Background worker for SAP salesperson sync."""
    try:
        frappe.logger().info("[SlpCode Sync] Background job started")

        result = _run_sales_person_sync()

        log_message = result["message"]
        if result.get("error_details"):
            log_message += "\n\nDetails:\n" + "\n".join(result["error_details"])

        if result.get("errors"):
            frappe.log_error(log_message, "SAP Salesperson Sync Finished with Errors")
        else:
            # Success / no-change runs are routine — app log only.
            frappe.logger().info(f"[SlpCode Sync] {log_message}")

        _write_customer_logs_to_error_log(result.get("customer_logs") or [])
        frappe.logger().info("[SlpCode Sync] Background job finished")
        return result
    except Exception:
        frappe.log_error(frappe.get_traceback(), "SAP Salesperson Sync Failed")
        raise
    finally:
        try:
            frappe.cache().delete_value(SYNC_RUNNING_KEY)
        except Exception:
            pass


@frappe.whitelist()
def sync_single_customer_sales_person_from_sap(customer=None):
    """Sync salesperson for one Customer — for testing before full sync."""
    frappe.only_for("System Manager")

    if not customer:
        frappe.throw(_("Customer is required"))
    if not frappe.db.exists("Customer", customer):
        frappe.throw(_("Customer {0} does not exist").format(customer))

    session_holder = {"cookies": None}
    session_holder["cookies"] = _reset_sap_session(session_holder)
    if not session_holder["cookies"]:
        frappe.throw(_("Failed to connect to SAP B1"))

    try:
        customer_log = _sync_one_customer(
            customer,
            session_holder,
            always_fetch_sap=True,
        )
        frappe.db.commit()

        log_line = _format_customer_log_line(customer_log)
        if customer_log.get("status") in ("error", "failed"):
            frappe.log_error(
                log_line + "\n\n" + _format_customer_log_html(customer_log),
                f"SAP Salesperson Sync — {customer}",
            )
        else:
            frappe.logger().info(f"[SlpCode Sync] Single customer test: {log_line}")

        work_done = (
            customer_log.get("sales_person_action") in ("created", "updated")
            or customer_log.get("sales_team_action") == "added"
        )

        return {
            "success": customer_log.get("status") in ("success", "unchanged"),
            "status": customer_log.get("status"),
            "work_done": work_done,
            "message": customer_log.get("message"),
            "detail_html": _format_customer_log_html(customer_log),
            "log": customer_log,
        }
    except Exception as exc:
        frappe.log_error(frappe.get_traceback(), f"SAP Salesperson Sync — {customer}")
        frappe.throw(_("Sync failed for {0}: {1}").format(customer, exc))
    finally:
        try:
            sap_api_utils.cleanup_sap_session()
        except Exception:
            pass


@frappe.whitelist()
def sync_customer_sales_persons_from_sap():
    """Queue SAP SlpCode sync onto Customer sales_team and Sales Person records."""
    frappe.only_for("System Manager")

    cache = frappe.cache()
    if cache.get_value(SYNC_RUNNING_KEY):
        return {
            "success": False,
            "message": _(
                "Salesperson sync is already running in the background. "
                "Please wait for it to finish."
            ),
        }

    try:
        cache.set_value(SYNC_RUNNING_KEY, 1, expires_in_sec=SYNC_JOB_TIMEOUT)
        frappe.enqueue(
            "sap_customer_portal.api.sync_sales_persons._sync_customer_sales_persons_background",
            queue="long",
            job_name=SYNC_JOB_NAME,
            timeout=SYNC_JOB_TIMEOUT,
            is_async=True,
        )
    except Exception:
        try:
            cache.delete_value(SYNC_RUNNING_KEY)
        except Exception:
            pass
        raise

    return {
        "success": True,
        "message": _(
            "Salesperson sync has been started in the background. "
            "This may take up to 2 hours for large customer lists. "
            "Only failures are written to the Error Log."
        ),
    }
