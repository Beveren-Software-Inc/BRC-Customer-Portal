import frappe
from sap_customer_portal import sap_api_utils

@frappe.whitelist()
def test_sap_balance():
    """Test SAP B1 balance fetching with detailed error reporting"""
    try:
        current_user = frappe.session.user
        frappe.logger().info(f"Testing SAP balance for user: {current_user}")
        
        # Get customer code
        customer_code = sap_api_utils.get_customer_code_from_user()
        frappe.logger().info(f"Customer code: {customer_code}")
        
        if not customer_code:
            return {
                "success": False,
                "error": "No customer code found",
                "details": f"User: {current_user}"
            }
        
        # Get SAP settings
        settings = sap_api_utils.get_sap_b1_settings()
        if not settings:
            return {
                "success": False,
                "error": "SAP B1 settings not configured"
            }
        
        frappe.logger().info(f"SAP settings: {settings}")
        
        # Test SAP connection
        try:
            # Create credentials
            encoded_credentials = sap_api_utils.create_base64_credentials(
                settings["username"], settings["password"], settings["companydb"]
            )
            frappe.logger().info("Credentials created successfully")
            
            # Test login
            session_info = sap_api_utils.login_to_sap_b1(settings["server_url"], encoded_credentials)
            frappe.logger().info(f"Login successful: {session_info}")
            
            # Get headers
            headers = sap_api_utils.get_sap_b1_headers(session_info)
            frappe.logger().info(f"Headers created: {bool(headers)}")
            
            # Test logout
            sap_api_utils.logout_from_sap_b1(settings["server_url"], headers)
            frappe.logger().info("Logout successful")
            
            return {
                "success": True,
                "message": "SAP B1 connection test successful",
                "customer_code": customer_code,
                "session_info": session_info
            }
            
        except Exception as sap_error:
            frappe.logger().error(f"SAP connection error: {str(sap_error)}")
            return {
                "success": False,
                "error": f"SAP connection failed: {str(sap_error)}",
                "customer_code": customer_code,
                "settings": {
                    "server_url": settings.get("server_url"),
                    "username": settings.get("username"),
                    "companydb": settings.get("companydb")
                }
            }
        
    except Exception as e:
        frappe.logger().error(f"Test balance error: {str(e)}")
        return {
            "success": False,
            "error": f"Test failed: {str(e)}"
        }

@frappe.whitelist()
def test_balance_fetch():
    """Test actual balance fetching"""
    try:
        customer_code = sap_api_utils.get_customer_code_from_user()
        
        if not customer_code:
            return {
                "success": False,
                "error": "No customer code found"
            }
        
        # Try to fetch balance
        balance_data = sap_api_utils.get_customer_balance_from_sap(customer_code)
        
        return {
            "success": True,
            "customer_code": customer_code,
            "balance_data": balance_data
        }
        
    except Exception as e:
        frappe.logger().error(f"Balance fetch error: {str(e)}")
        return {
            "success": False,
            "error": f"Balance fetch failed: {str(e)}"
        }
