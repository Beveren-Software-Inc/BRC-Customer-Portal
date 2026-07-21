// Copyright (c) 2025, SAP Software Inc and contributors
// Sync salesperson from SAP — single customer test button

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
	},
});
