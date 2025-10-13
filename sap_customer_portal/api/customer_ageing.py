import frappe
from frappe.utils.data import today, getdate
from sap_customer_portal import sap_api_utils

@frappe.whitelist()
def get_customer_aging():
    """Compute customer ageing from SAP invoices for all linked customer codes.

    Logic:
    - Resolve all customer CardCodes for current user (portal mapping or by email) using helper.
    - Fetch SAP invoices per code via sap_api_utils.get_customer_invoices_from_sap.
    - Outstanding = grand_total - paid_amount; include only if > 0.
    - Age by posting_date (DocDate in SAP) into standard buckets.
    - Currency: use invoice currency if available, else 'SAR'.
    """
    try:
        # Resolve customer codes for user
        get_codes = getattr(sap_api_utils, "get_customer_codes_from_user", None)
        codes = get_codes() if callable(get_codes) else []
        if not codes:
            single = sap_api_utils.get_customer_code_from_user()
            if single:
                codes = [single]
        if not codes:
            return {}

        # Prepare ageing buckets
        aging_data = {
            "currency": "SAR",
            "0_30": 0.00,
            "31_60": 0.00,
            "61_90": 0.00,
            "91_120": 0.00,
            "120_plus": 0.00,
        }

        today_date = getdate(today())
        currency_set = False

        # Fetch and process invoices per customer code
        for code in codes:
            invoices = sap_api_utils.get_customer_invoices_from_sap(code, limit=1000) or []
            for inv in invoices:
                grand_total = inv.get("grand_total", 0) or 0
                paid_amount = inv.get("paid_amount", 0) or 0
                outstanding = grand_total - paid_amount
                if outstanding <= 0:
                    continue

                posting_date = inv.get("posting_date")
                if not posting_date:
                    continue
                try:
                    age_days = (today_date - getdate(posting_date)).days
                except Exception:
                    continue

                # Set currency once if available
                if not currency_set:
                    cur = inv.get("currency")
                    if cur:
                        aging_data["currency"] = cur
                        currency_set = True

                if 0 <= age_days <= 30:
                    aging_data["0_30"] += outstanding
                elif 31 <= age_days <= 60:
                    aging_data["31_60"] += outstanding
                elif 61 <= age_days <= 90:
                    aging_data["61_90"] += outstanding
                elif 91 <= age_days <= 120:
                    aging_data["91_120"] += outstanding
                elif age_days > 120:
                    aging_data["120_plus"] += outstanding

        # Round values
        for key in list(aging_data.keys()):
            if key != "currency":
                aging_data[key] = round(aging_data[key], 2)

        return aging_data
    except Exception as e:
        frappe.log_error(f"Error computing customer ageing from SAP: {str(e)}", "Customer Portal")
        return {}
