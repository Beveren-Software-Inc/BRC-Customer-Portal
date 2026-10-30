// Copyright (c) 2025, SAP Software Inc and contributors
// Single-customer SAP test buttons

frappe.ui.form.on("Customer", {
	refresh(frm) {
		if (frm.is_new() || !frm.doc.name) {
			return;
		}
		if (!frappe.user.has_role("System Manager")) {
			return;
		}

		frm.add_custom_button(
			__("Sync Salesperson from SAP"),
			() => {
				frappe.call({
					method:
						"sap_customer_portal.api.sync_sales_persons.sync_single_customer_sales_person_from_sap",
					args: {
						customer: frm.doc.name,
					},
					freeze: true,
					freeze_message: __("Fetching salesperson from SAP..."),
					callback(r) {
						const msg = r.message || {};
						const indicator =
							msg.status === "failed" || msg.status === "error"
								? "red"
								: msg.work_done
									? "green"
									: "orange";

						frappe.msgprint({
							title: __("SAP Salesperson Sync — {0}", [frm.doc.name]),
							indicator,
							message: msg.detail_html || msg.message || __("Sync completed."),
						});

						if (msg.work_done) {
							frm.reload_doc();
						}
					},
					error() {
						frappe.show_alert({
							message: __("Sync failed. Check Error Log for SAP response details."),
							indicator: "red",
						}, 6);
					},
				});
			},
			__("SAP")
		);

		frm.add_custom_button(
			__("Fetch Customer Arabic Name"),
			() => {
				frappe.call({
					method:
						"sap_customer_portal.api.sync_customer_arabic_names.sync_single_customer_arabic_name_from_sap",
					args: {
						customer: frm.doc.name,
					},
					freeze: true,
					freeze_message: __("Fetching customer Arabic name from SAP..."),
					callback(r) {
						const msg = r.message || {};
						const indicator =
							msg.status === "failed" || msg.status === "error"
								? "red"
								: msg.work_done
									? "green"
									: "orange";

						frappe.msgprint({
							title: __("SAP Customer Arabic Name — {0}", [frm.doc.name]),
							indicator,
							message: msg.detail_html || msg.message || __("Fetch completed."),
						});

						if (msg.work_done) {
							frm.reload_doc();
						}
					},
					error() {
						frappe.show_alert({
							message: __("Arabic name fetch failed. Check Error Log for details."),
							indicator: "red",
						}, 6);
					},
				});
			},
			__("SAP")
		);
	},
});
