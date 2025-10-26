# Copyright (c) 2025, SAP Software Inc and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import today, add_days


def daily_sync_jl_entries():
    """Daily scheduled task to sync SAP JL Entries for the past week
    
    Runs every night at 12:00 AM to fetch journal entries from the past 7 days
    This is an incremental sync that only fetches new data from the past week
    """
    try:
        frappe.log_error("Starting daily SAP JL Entry sync...")
        frappe.logger().info("Starting daily SAP JL Entry sync...")
        
        # Calculate date range for the past week (7 days back)
        # This ensures we only sync recent data
        to_date = today()
        from_date = add_days(to_date, -7)
        
        # Ensure we have string dates
        from_date_str = str(from_date) if from_date else None
        to_date_str = str(to_date) if to_date else None
        
        frappe.log_error(f"Daily sync: Fetching JL entries from {from_date_str} to {to_date_str}")
        frappe.logger().info(f"Daily sync: Fetching JL entries from {from_date_str} to {to_date_str}")
        
        # Call the background sync function with date range
        from sap_customer_portal.api.customer_balance import _sync_sap_jl_entries_background
        
        # Run the sync in background with last 7 days of data
        frappe.enqueue(
            'sap_customer_portal.api.customer_balance._sync_sap_jl_entries_background',
            queue='long',
            job_name='daily_sync_sap_jl_entries',
            timeout=3600,  # 60 minutes
            is_async=True,
            from_date=from_date_str,
            to_date=to_date_str
        )
        
        frappe.log_error(f"Daily sync job queued successfully for {from_date_str} to {to_date_str}")
        frappe.logger().info(f"Daily sync job queued successfully for {from_date_str} to {to_date_str}")
        
    except Exception as e:
        frappe.log_error(f"Error in daily_sync_jl_entries: {str(e)}", "SAP JL Entry Daily Sync")
        frappe.logger().error(f"Error in daily SAP JL Entry sync: {str(e)}")

