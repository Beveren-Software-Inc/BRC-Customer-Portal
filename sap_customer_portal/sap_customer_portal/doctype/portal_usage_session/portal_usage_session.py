# Copyright (c) 2026, SAP Software Inc and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, time_diff_in_seconds


class PortalUsageSession(Document):
	def close_session(self, session_end=None):
		end = session_end or now_datetime()
		self.session_end = end
		self.last_seen = end
		self.status = "Closed"

		start = self.session_start
		if start:
			self.duration_seconds = max(
				int(time_diff_in_seconds(end, start)),
				0,
			)
		else:
			self.duration_seconds = 0

		self.page_view_count = len(self.page_visits or [])
		self.flags.ignore_permissions = True
		self.save(ignore_permissions=True)
