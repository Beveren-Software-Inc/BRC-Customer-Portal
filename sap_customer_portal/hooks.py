app_name = "sap_customer_portal"
app_title = "SAP Customer Portal"
app_publisher = "SAP Software Inc"
app_description = "SAP Customer Portal for ERPNext"
app_email = "simon@beverensoftware.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ['erpnext']


# Each item in the list will be shown as an app in the apps page
from .utils import _get_logo_path
_logo_path = _get_logo_path()

add_to_apps_screen = [
	{
		"name": "sap_customer_portal",
		"logo": _logo_path,
		"title": "SAP Customer Portal",
		"route": "/portal"
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/sap_customer_portal/css/sap_customer_portal.css"
# app_include_js = "/assets/sap_customer_portal/js/sap_customer_portal.js"

# include js, css files in header of web template
# web_include_css = "/assets/sap_customer_portal/css/sap_customer_portal.css"
# web_include_js = "/assets/sap_customer_portal/js/sap_customer_portal.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "sap_customer_portal/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "sap_customer_portal/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
role_home_page = {
	"Customer": "portal"
}

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "sap_customer_portal.utils.jinja_methods",
# 	"filters": "sap_customer_portal.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "sap_customer_portal.install.before_install"
after_install = [
    "sap_customer_portal.customization.customer_role_perms.create_customer_role_permissions",
]


# Uninstallation
# ------------

# before_uninstall = "sap_customer_portal.uninstall.before_uninstall"
after_uninstall = [
    "sap_customer_portal.customization.customer_role_perms.delete_customer_role_permissions",
]


# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "sap_customer_portal.utils.before_app_install"
# after_app_install = "sap_customer_portal.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "sap_customer_portal.utils.before_app_uninstall"
# after_app_uninstall = "sap_customer_portal.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "sap_customer_portal.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
#     "Customer": "sap_customer_portal.permissions.customer_query_conditions",
#     "Sales Invoice": "sap_customer_portal.permissions.customer_user_query_conditions",
#     "Sales Order": "sap_customer_portal.permissions.customer_user_query_conditions",
#     "Delivery Note": "sap_customer_portal.permissions.customer_user_query_conditions",
#     "Quotation": "sap_customer_portal.permissions.customer_user_query_conditions",
# }

has_permission = {
    "Customer": "sap_customer_portal.permissions.customer_has_permission",
    "Sales Invoice": "sap_customer_portal.permissions.customer_user_has_permission",
    "Sales Order": "sap_customer_portal.permissions.customer_user_has_permission",
    "Delivery Note": "sap_customer_portal.permissions.customer_user_has_permission",
    "Quotation": "sap_customer_portal.permissions.customer_user_has_permission",
}

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

doc_events = {
    "Customer": {
        "after_insert": [
            "sap_customer_portal.customization.customer_user_perms.create_customer_user_permissions",
        ],
        "on_update": [
            "sap_customer_portal.customization.customer_user_perms.create_customer_user_permissions",
            "sap_customer_portal.customization.customer_user_perms.delete_customer_user_permissions",
        ],
        "on_trash": [
            "sap_customer_portal.customization.customer_user_perms.delete_customer_user_permissions",
        ]
    },
}

# Scheduled Tasks
# ---------------

scheduler_events = {
    "daily": [
        "sap_customer_portal.scheduler.daily_sync_jl_entries"
    ],
}

# Testing
# -------

# before_tests = "sap_customer_portal.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "sap_customer_portal.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "sap_customer_portal.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["sap_customer_portal.utils.before_request"]
# after_request = ["sap_customer_portal.utils.after_request"]


# Job Events
# ----------
# before_job = ["sap_customer_portal.utils.before_job"]
# after_job = ["sap_customer_portal.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"sap_customer_portal.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

from .utils import get_website_route_rules

website_route_rules = get_website_route_rules()