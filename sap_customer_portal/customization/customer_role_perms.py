import frappe

def _apply_portal_role_permissions(role_name):
    role_perm_definition = {
        "role": role_name,
        "permlevel": 0,
        "read": 1,
        "select": 1,
        "export": 1,
        "write": 0,
        "create": 0,
        "delete": 0,
        "submit": 0,
        "cancel": 0,
        "amend": 0,
        "report": 0,
        "import": 0,
        "share": 0,
        "print": 1,
        "email": 0,
        "if_owner": 0,
        "set_user_permissions": 0,
    }

    doctypes = [
        "Sales Invoice",
        "Sales Order",
        "Delivery Note",
        "Quotation",
    ]

    for doctype in doctypes:
        print(f"Processing permissions for DocType: {doctype}")

        try:
            standard_perms = frappe.get_all("DocPerm", filters={"parent": doctype}, fields=["*"])
            print(f"  Found {len(standard_perms)} standard DocPerm entries.")
        except Exception as e:
            print(f"  Error fetching standard DocPerm for {doctype}: {e}")
            standard_perms = []

        perms_to_set_in_custom = []
        for p in standard_perms:
            perm_dict = {
                "role": p.get("role"),
                "permlevel": p.get("permlevel", 0),
                "read": p.get("read", 0),
                "write": p.get("write", 0),
                "create": p.get("create", 0),
                "delete": p.get("delete", 0),
                "submit": p.get("submit", 0),
                "cancel": p.get("cancel", 0),
                "amend": p.get("amend", 0),
                "report": p.get("report", 0),
                "export": p.get("export", 0),
                "import": p.get("import", 0),
                "share": p.get("share", 0),
                "print": p.get("print", 0),
                "email": p.get("email", 0),
                "if_owner": p.get("if_owner", 0),
                "select": p.get("select", 0),
                "set_user_permissions": p.get("set_user_permissions", 0),
            }
            if perm_dict["role"]:
                perms_to_set_in_custom.append(perm_dict)

        role_perm_found_in_standard = False
        for i, p in enumerate(perms_to_set_in_custom):
            if p["role"] == role_perm_definition["role"] and p["permlevel"] == role_perm_definition["permlevel"]:
                perms_to_set_in_custom[i] = role_perm_definition.copy()
                role_perm_found_in_standard = True
                print(f"  Updating definition for '{role_name}' role based on standard perms.")
                break

        if not role_perm_found_in_standard:
            perms_to_set_in_custom.append(role_perm_definition.copy())
            print(f"  Adding definition for '{role_name}' role.")

        for perm_data in perms_to_set_in_custom:
            filters = {
                "parent": doctype,
                "role": perm_data["role"],
                "permlevel": perm_data["permlevel"],
            }

            try:
                existing_perm_name = frappe.db.exists("Custom DocPerm", filters)

                doc_args = perm_data.copy()
                doc_args["doctype"] = "Custom DocPerm"
                doc_args["parent"] = doctype
                doc_args["parentfield"] = "permissions"
                doc_args["parenttype"] = "DocType"

                if "import" in doc_args:
                    doc_args["import_"] = doc_args.pop("import")
                if "print" in doc_args:
                    doc_args["print_"] = doc_args.pop("print")

                if existing_perm_name:
                    perm_doc = frappe.get_doc("Custom DocPerm", existing_perm_name)
                    perm_doc.update(doc_args)
                    perm_doc.save(ignore_permissions=True)
                else:
                    perm_doc = frappe.get_doc(doc_args)
                    perm_doc.insert(ignore_permissions=True)

            except Exception as e:
                print(f"    Error processing Custom DocPerm for Role {perm_data.get('role', 'N/A')} in {doctype}: {e}")

    frappe.db.commit()
    print(f"Finished processing custom permissions for role: {role_name}.")


def _delete_portal_role_permissions(role_name):
    doctypes = [
        "Sales Invoice",
        "Sales Order",
        "Delivery Note",
        "Quotation",
    ]

    for doctype in doctypes:
        perm_names = frappe.get_all(
            "Custom DocPerm",
            filters={"parent": doctype, "role": role_name},
            pluck="name",
        )

        for name in perm_names:
            try:
                frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True, force=True)
                print(f"Deleted Custom DocPerm {name} for {doctype}, Role: {role_name}")
            except Exception as e:
                frappe.log_error(f"Error deleting Custom DocPerm {name}", frappe.get_traceback())
                print(f"Error deleting Custom DocPerm {name}: {e}")

    frappe.db.commit()


def create_customer_role_permissions():
    _apply_portal_role_permissions("Customer")


def delete_customer_role_permissions():
    _delete_portal_role_permissions("Customer")

'''
REFER TO THIS FOR THE REQUIRED PERMISSIONS

[
 {
  "amend": 0,
  "cancel": 0,
  "create": 0,
  "delete": 0,
  "docstatus": 0,
  "doctype": "Custom DocPerm",
  "email": 0,
  "export": 1,
  "if_owner": 0,
  "import": 0,
  "modified": "2025-03-21 22:07:52.550269",
  "name": "eilr50ib15",
  "parent": "Sales Order",
  "permlevel": 0,
  "print": 0,
  "read": 1,
  "report": 0,
  "role": "Customer",
  "select": 1,
  "share": 0,
  "submit": 0,
  "write": 0
 },
 {
  "amend": 0,
  "cancel": 0,
  "create": 0,
  "delete": 0,
  "docstatus": 0,
  "doctype": "Custom DocPerm",
  "email": 0,
  "export": 1,
  "if_owner": 0,
  "import": 0,
  "modified": "2025-03-21 22:08:14.780304",
  "name": "epjk67g2b5",
  "parent": "Sales Invoice",
  "permlevel": 0,
  "print": 0,
  "read": 1,
  "report": 0,
  "role": "Customer",
  "select": 1,
  "share": 0,
  "submit": 0,
  "write": 0
 },
 {
  "amend": 0,
  "cancel": 0,
  "create": 0,
  "delete": 0,
  "docstatus": 0,
  "doctype": "Custom DocPerm",
  "email": 0,
  "export": 1,
  "if_owner": 0,
  "import": 0,
  "modified": "2025-03-21 22:08:32.560890",
  "name": "ev5pbgeqah",
  "parent": "Delivery Note",
  "permlevel": 0,
  "print": 0,
  "read": 1,
  "report": 0,
  "role": "Customer",
  "select": 1,
  "share": 0,
  "submit": 0,
  "write": 0
 },
 {
  "amend": 0,
  "cancel": 0,
  "create": 0,
  "delete": 0,
  "docstatus": 0,
  "doctype": "Custom DocPerm",
  "email": 0,
  "export": 1,
  "if_owner": 0,
  "import": 0,
  "modified": "2025-03-21 22:14:14.700346",
  "name": "ia3lv73ul9",
  "parent": "Quotation",
  "permlevel": 0,
  "print": 0,
  "read": 1,
  "report": 0,
  "role": "Customer",
  "select": 1,
  "share": 0,
  "submit": 0,
  "write": 0
 }
]

'''
