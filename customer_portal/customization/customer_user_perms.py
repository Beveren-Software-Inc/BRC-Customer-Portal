import frappe
from frappe import _  

def create_customer_user_permissions(doc, method):   
    portal_users = doc.get("portal_users") or []
    for entry in portal_users:
        user_id = entry.user  
        if not frappe.db.exists("User Permission", {
            "user": user_id, 
            "allow": "Customer",
            "for_value": doc.name
        }):
            user_permission = frappe.get_doc({
                "doctype": "User Permission",
                "user": user_id,
                "allow": "Customer",
                "for_value": doc.name,
                "allow_for_all_doctypes": 1
            })
            user_permission.insert(ignore_permissions=True)
    
    frappe.db.commit()


def delete_customer_user_permissions(doc, method):
    if method == "on_trash":
        permissions = frappe.get_all("User Permission", 
                                    filters={
                                        "allow": "Customer",
                                        "for_value": doc.name
                                    },
                                    fields=["user"])
        
        users_to_check = [perm.user for perm in permissions]
        
        frappe.db.delete("User Permission", {
            "allow": "Customer",
            "for_value": doc.name,
        })
        
        for user_id in users_to_check:
            update_user_customer_role(user_id)
    
    elif method == "on_update":
        current_portal_users = [entry.user for entry in (doc.get("portal_users") or [])]
        permissions = frappe.get_all("User Permission", 
                                    filters={
                                        "allow": "Customer",
                                        "for_value": doc.name
                                    },
                                    fields=["name", "user"])
        
        users_to_check = []
        
        for perm in permissions:
            if perm.user not in current_portal_users:
                frappe.delete_doc("User Permission", perm.name, ignore_permissions=True)
                users_to_check.append(perm.user)
        
        for user_id in users_to_check:
            update_user_customer_role(user_id)
    
    frappe.db.commit()

def update_user_customer_role(user_id):
    """
    Check if user is a portal user for any customer.
    If not, remove the Customer role from the user.
    """
    # Check if user exists in any customer's portal_users
    is_portal_user = frappe.db.sql("""
        SELECT 1 FROM `tabPortal User` 
        WHERE user = %s 
        LIMIT 1
    """, (user_id,))
    
    if not is_portal_user:
        user = frappe.get_doc("User", user_id)
        
        has_portal_customer_role = False
        roles_to_keep = []
        
        for role in user.roles:
            if role.role == "Customer":
                has_portal_customer_role = True
            else:
                roles_to_keep.append(role)
    
        if has_portal_customer_role:
            user.roles = roles_to_keep
            user.save(ignore_permissions=True)
            frappe.msgprint(_(f"Customer role removed from user {user_id} as they are no longer associated with any customer."))

