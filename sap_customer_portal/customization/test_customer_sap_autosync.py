# Copyright (c) 2026, SAP Software Inc and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from sap_customer_portal.customization import customer_sap_autosync as autosync


class TestCustomerSapAutosync(FrappeTestCase):
    """Tests for the automatic SAP enrichment of newly created Customers.

    SAP B1 is never contacted: only the helpers that talk to SAP are patched,
    the surrounding logic runs for real.
    """

    def setUp(self):
        self.customer = frappe.get_doc(
            {
                "doctype": "Customer",
                "customer_name": "SAP Auto Sync Test Customer",
                "customer_group": frappe.db.get_single_value(
                    "Selling Settings", "customer_group"
                )
                or "All Customer Groups",
                "territory": frappe.db.get_single_value("Selling Settings", "territory")
                or "All Territories",
            }
        ).insert(ignore_permissions=True)

    def test_auto_sync_toggle_controls_enabled_state(self):
        frappe.db.set_single_value("Customer Portal Settings", "auto_sync_new_customers", 0)
        self.assertFalse(autosync.is_auto_sync_enabled())

        frappe.db.set_single_value("Customer Portal Settings", "auto_sync_new_customers", 1)
        self.assertTrue(autosync.is_auto_sync_enabled())

    def test_arabic_name_is_written_from_sap_row(self):
        bp_row = {"CardCode": self.customer.name, "CardForeignName": "اسم تجريبي"}

        result = autosync._sync_arabic_name(self.customer.name, bp_row)

        self.assertEqual(result["status"], "success")
        self.assertEqual(
            frappe.db.get_value("Customer", self.customer.name, "custom_arabic_name"),
            "اسم تجريبي",
        )

    def test_arabic_name_skipped_when_sap_value_empty(self):
        bp_row = {"CardCode": self.customer.name, "CardForeignName": "   "}

        result = autosync._sync_arabic_name(self.customer.name, bp_row)

        self.assertEqual(result["status"], "skipped")
        self.assertFalse(
            frappe.db.get_value("Customer", self.customer.name, "custom_arabic_name")
        )

    def test_salesperson_skipped_without_slp_code(self):
        log = autosync._sync_salesperson(
            self.customer.name, {"SalesPersonCode": -1}, {"cookies": None}
        )

        self.assertEqual(log["status"], "skipped")
        self.assertIsNone(log["slp_code"])

    def test_build_result_marks_failures(self):
        result = autosync._build_result(
            self.customer.name,
            {"status": "skipped", "message": "no arabic name"},
            {"status": "failed", "message": "sap error"},
        )

        self.assertEqual(result["status"], "failed")
        self.assertFalse(result["success"])

    def test_enqueue_uses_customer_specific_job_id(self):
        frappe.db.set_single_value("Customer Portal Settings", "auto_sync_new_customers", 1)

        with patch.object(autosync.frappe, "enqueue") as enqueue:
            autosync._enqueue_enrichment(self.customer.name)

        enqueue.assert_called_once()
        kwargs = enqueue.call_args.kwargs
        self.assertEqual(kwargs["customer"], self.customer.name)
        self.assertEqual(
            kwargs["job_id"], f"customer-sap-autosync::{self.customer.name}"
        )
        self.assertTrue(kwargs["deduplicate"])

    def test_hook_does_not_enqueue_while_running_tests(self):
        with patch.object(autosync.frappe, "enqueue") as enqueue:
            autosync.on_customer_created(self.customer)

        enqueue.assert_not_called()
