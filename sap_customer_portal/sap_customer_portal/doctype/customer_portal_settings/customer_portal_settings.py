# Copyright (c) 2025, SAP Software Inc and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CustomerPortalSettings(Document):
    def validate(self):
        """Validate settings"""
        # Don't override user-uploaded files
        # Only set fallbacks if fields are completely empty
        if not self.portal_logo:
            self.portal_logo = ""
            
        if not self.portal_icon:
            self.portal_icon = ""
    
    def on_update(self):
        """Clear cache when settings are updated"""
        frappe.cache().delete_key("sap_customer_portal_settings")
        
    @classmethod
    def get_settings(cls):
        """Get cached settings or fetch them from DB"""
        settings = frappe.cache().get_value("sap_customer_portal_settings")
        if not settings:
            # Get the first (and only) instance of settings
            settings_doc = frappe.get_doc("Customer Portal Settings")
            settings = {
                "portal_logo": settings_doc.portal_logo,
                "portal_icon": settings_doc.portal_icon,
            }
            # Cache for 24 hours
            frappe.cache().set_value("sap_customer_portal_settings", settings, expires_in_sec=86400)
        
        return settings
