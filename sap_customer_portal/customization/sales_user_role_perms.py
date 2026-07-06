import frappe

from sap_customer_portal.customization.customer_role_perms import (
    _apply_portal_role_permissions,
    _delete_portal_role_permissions,
)

SALES_USER_ROLE = "Sales User"


def create_sales_user_role_permissions():
    _apply_portal_role_permissions(SALES_USER_ROLE)


def delete_sales_user_role_permissions():
    _delete_portal_role_permissions(SALES_USER_ROLE)
