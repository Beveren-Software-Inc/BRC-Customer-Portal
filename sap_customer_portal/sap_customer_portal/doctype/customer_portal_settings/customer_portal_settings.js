// Copyright (c) 2025, SAP Software Inc and contributors
// For license information, please see license.txt

frappe.ui.form.on("Customer Portal Settings", {
	refresh(frm) {
		// Add custom button handler for sync
		frm.add_custom_button(__("Sync SAP JL Entries"), () => {
			// Show date input dialog
			const d = new frappe.ui.Dialog({
				title: __("Sync SAP JL Entries"),
				fields: [
					{
						fieldtype: "Date",
						label: __("From Date"),
						fieldname: "from_date",
						reqd: 0,
						default: frappe.datetime.add_months(frappe.datetime.get_today(), -12)
					},
					{
						fieldtype: "Date",
						label: __("To Date"),
						fieldname: "to_date",
						reqd: 0,
						default: frappe.datetime.get_today()
					},
					{
						fieldtype: "Check",
						label: __("Use Date Filter"),
						fieldname: "use_date_filter",
						default: 0
					}
				],
				primary_action_label: __("Start Sync"),
				primary_action(values) {
					d.hide();
					
					// Get date values
					let from_date = null;
					let to_date = null;
					
					if (values.use_date_filter) {
						from_date = values.from_date;
						to_date = values.to_date;
						
						if (!from_date || !to_date) {
							frappe.msgprint({
								title: __("Error"),
								indicator: "red",
								message: __("Please select both From Date and To Date")
							});
							d.show();
							return;
						}
						
						// Validate date range
						if (new Date(from_date) > new Date(to_date)) {
							frappe.msgprint({
								title: __("Error"),
								indicator: "red",
								message: __("From Date cannot be later than To Date")
							});
							d.show();
							return;
						}
					}
					
					// Call the API to sync SAP JL Entries
					frappe.call({
						method: "sap_customer_portal.api.customer_balance.sync_sap_jl_entries",
						args: {
							from_date: from_date,
							to_date: to_date
						},
						freeze: true,
						freeze_message: __("Starting SAP JL Entry sync in background..."),
						callback: function(r) {
							if (r.message && r.message.success) {
								frappe.show_alert({
									message: r.message.message || __("Sync started successfully! Check Error Log for progress."),
									indicator: "green"
								}, 5);
							} else {
								frappe.show_alert({
									message: __("Sync completed but there may be some issues. Check Error Log."),
									indicator: "orange"
								}, 5);
							}
						},
						error: function(r) {
							frappe.show_alert({
								message: __("Error starting sync. Check Error Log."),
								indicator: "red"
							}, 5);
						}
					});
				},
				secondary_action_label: __("Cancel"),
				secondary_action() {
					d.hide();
				}
			});
			
			d.show();
		});
	},
});
