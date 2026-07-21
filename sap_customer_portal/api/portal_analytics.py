import frappe
from frappe import _
from datetime import timedelta
from frappe.utils import add_days, flt, get_datetime, getdate, now_datetime, today

from sap_customer_portal.portal_customer_access import get_active_customer_code_for_user


def _ensure_portal_user():
	user = frappe.session.user
	if not user or user == "Guest":
		frappe.throw(_("You must be logged in."), frappe.PermissionError)
	return user


def _get_session_doc(session_name, user=None):
	user = user or frappe.session.user
	if not session_name or not frappe.db.exists("Portal Usage Session", session_name):
		frappe.throw(_("Invalid portal session."), frappe.PermissionError)

	doc = frappe.get_doc("Portal Usage Session", session_name)
	if doc.user != user:
		frappe.throw(_("You do not have access to this session."), frappe.PermissionError)
	return doc


def _page_title_from_path(page_path):
	labels = {
		"/": "Dashboard",
		"/sales-orders": "Sales Orders",
		"/delivery-notes": "Delivery Notes",
		"/sales-invoices": "Invoices",
		"/payments": "Payments",
		"/customer-statement": "Customer Statement",
		"/settings": "Settings",
		"/portal-analytics": "Portal Analytics",
	}
	if page_path in labels:
		return labels[page_path]
	if page_path.startswith("/sales-orders/"):
		return "Sales Order Detail"
	if page_path.startswith("/delivery-notes/"):
		return "Delivery Note Detail"
	if page_path.startswith("/sales-invoices/"):
		return "Invoice Detail"
	if page_path.startswith("/payments/"):
		return "Payment Detail"
	if page_path.startswith("/quotations/"):
		return "Quotation Detail"
	return page_path.strip("/").replace("-", " ").title() or "Portal"


@frappe.whitelist()
def start_portal_session(session=None):
	"""Resume an open portal browsing session or create one after a fresh visit.

	Note: Login counts come from Activity Log, not from this session record.
	"""
	user = _ensure_portal_user()
	active_customer = get_active_customer_code_for_user(user)

	if session:
		try:
			doc = _get_session_doc(session, user)
			if doc.status == "Open":
				doc.last_seen = now_datetime()
				if active_customer:
					doc.customer = active_customer
				doc.flags.ignore_permissions = True
				doc.save(ignore_permissions=True)
				frappe.db.commit()
				return {"success": True, "session": doc.name, "resumed": True}
		except frappe.PermissionError:
			pass

	open_session = frappe.db.get_value(
		"Portal Usage Session",
		{"user": user, "status": "Open"},
		"name",
		order_by="session_start desc",
	)
	if open_session:
		doc = _get_session_doc(open_session, user)
		doc.last_seen = now_datetime()
		if active_customer:
			doc.customer = active_customer
		doc.flags.ignore_permissions = True
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		return {"success": True, "session": doc.name, "resumed": True}

	doc = frappe.get_doc(
		{
			"doctype": "Portal Usage Session",
			"user": user,
			"customer": active_customer,
			"session_start": now_datetime(),
			"last_seen": now_datetime(),
			"status": "Open",
			"page_view_count": 0,
			"user_agent": (frappe.request.headers or {}).get("User-Agent", ""),
		}
	)
	doc.flags.ignore_permissions = True
	doc.insert(ignore_permissions=True)
	frappe.db.commit()

	return {
		"success": True,
		"session": doc.name,
		"resumed": False,
	}


@frappe.whitelist()
def record_portal_page_visit(session, page_path, page_title=None):
	"""Record a page visit inside an active portal session."""
	user = _ensure_portal_user()
	doc = _get_session_doc(session, user)

	if doc.status == "Closed":
		return {"success": False, "message": "Session already closed"}

	page_path = (page_path or "/").strip() or "/"
	title = (page_title or _page_title_from_path(page_path)).strip()

	doc.append(
		"page_visits",
		{
			"page_path": page_path[:140],
			"page_title": title[:140],
			"visited_at": now_datetime(),
		},
	)
	doc.last_seen = now_datetime()
	doc.page_view_count = len(doc.page_visits or [])
	active_customer = get_active_customer_code_for_user(user)
	if active_customer:
		doc.customer = active_customer

	doc.flags.ignore_permissions = True
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	return {"success": True}


@frappe.whitelist()
def heartbeat_portal_session(session):
	"""Keep the session alive and refresh duration while the user is active."""
	user = _ensure_portal_user()
	doc = _get_session_doc(session, user)

	if doc.status == "Closed":
		return {"success": False, "message": "Session already closed"}

	now = now_datetime()
	doc.last_seen = now
	if doc.session_start:
		doc.duration_seconds = max(int((now - get_datetime(doc.session_start)).total_seconds()), 0)

	doc.flags.ignore_permissions = True
	doc.save(ignore_permissions=True)
	frappe.db.commit()

	return {"success": True, "duration_seconds": doc.duration_seconds}


@frappe.whitelist()
def end_portal_session(session):
	"""Close a portal session on logout or browser close."""
	user = _ensure_portal_user()
	doc = _get_session_doc(session, user)

	if doc.status == "Closed":
		return {"success": True, "already_closed": True}

	doc.close_session()
	frappe.db.commit()
	return {"success": True}


def _is_portal_admin(user=None):
	user = user or frappe.session.user
	if user == "Administrator":
		return True
	if not user or user == "Guest":
		return False
	return "System Manager" in frappe.get_roles(user)


@frappe.whitelist()
def is_portal_admin():
	"""Return whether the current user can access portal analytics."""
	return {"is_admin": _is_portal_admin()}


def _get_portal_login_activity(from_date, to_date):
	"""Successful logins from Frappe Activity Log (actual auth events, not page refreshes)."""
	return frappe.db.sql(
		"""
		SELECT
			al.user,
			al.full_name,
			COALESCE(al.communication_date, al.creation) AS login_time,
			DATE(COALESCE(al.communication_date, al.creation)) AS login_day
		FROM `tabActivity Log` al
		WHERE al.operation = 'Login'
			AND al.status = 'Success'
			AND DATE(COALESCE(al.communication_date, al.creation)) BETWEEN %s AND %s
			AND IFNULL(al.user, '') NOT IN ('', 'Guest')
		ORDER BY COALESCE(al.communication_date, al.creation) DESC
		""",
		(from_date, to_date),
		as_dict=True,
	)


@frappe.whitelist()
def get_portal_analytics_dashboard(from_date=None, to_date=None):
	"""Summary analytics for administrators."""
	if not _is_portal_admin():
		frappe.throw(_("Not permitted"), frappe.PermissionError)

	from_date = getdate(from_date or add_days(today(), -30))
	to_date = getdate(to_date or today())

	login_activity = _get_portal_login_activity(from_date, to_date)
	total_logins = len(login_activity)
	unique_users = len({row.user for row in login_activity if row.user})

	sessions = frappe.db.sql(
		"""
		SELECT
			name,
			user,
			full_name,
			customer,
			session_start,
			session_end,
			last_seen,
			duration_seconds,
			page_view_count,
			status
		FROM `tabPortal Usage Session`
		WHERE DATE(session_start) BETWEEN %s AND %s
		ORDER BY session_start DESC
		""",
		(from_date, to_date),
		as_dict=True,
	)

	closed_sessions = [row for row in sessions if row.status == "Closed"]
	avg_duration_seconds = (
		sum(row.duration_seconds or 0 for row in closed_sessions) / len(closed_sessions)
		if closed_sessions
		else 0
	)
	total_page_views = sum(row.page_view_count or 0 for row in sessions)
	total_portal_sessions = len(sessions)

	logins_by_user = {}
	for row in login_activity:
		entry = logins_by_user.setdefault(
			row.user,
			{
				"user": row.user,
				"full_name": row.full_name or row.user,
				"login_count": 0,
				"last_login": None,
			},
		)
		entry["login_count"] += 1
		if not entry["last_login"] or row.login_time > entry["last_login"]:
			entry["last_login"] = row.login_time

	session_stats_by_user = frappe.db.sql(
		"""
		SELECT
			user,
			MAX(full_name) AS full_name,
			SUM(page_view_count) AS page_views,
			AVG(CASE WHEN status = 'Closed' THEN duration_seconds ELSE NULL END) AS avg_duration_seconds
		FROM `tabPortal Usage Session`
		WHERE DATE(session_start) BETWEEN %s AND %s
		GROUP BY user
		""",
		(from_date, to_date),
		as_dict=True,
	)
	session_stats_map = {row.user: row for row in session_stats_by_user}

	per_user = []
	for user, login_data in logins_by_user.items():
		session_data = session_stats_map.get(user, {})
		per_user.append(
			{
				"user": user,
				"full_name": login_data["full_name"] or session_data.get("full_name") or user,
				"login_count": login_data["login_count"],
				"page_views": session_data.get("page_views") or 0,
				"avg_duration_seconds": session_data.get("avg_duration_seconds"),
				"last_login": login_data["last_login"],
			}
		)

	# Include portal-only users who had sessions but no captured login in range
	for user, session_data in session_stats_map.items():
		if user not in logins_by_user:
			per_user.append(
				{
					"user": user,
					"full_name": session_data.get("full_name") or user,
					"login_count": 0,
					"page_views": session_data.get("page_views") or 0,
					"avg_duration_seconds": session_data.get("avg_duration_seconds"),
					"last_login": None,
				}
			)

	per_user.sort(key=lambda row: (row.get("login_count") or 0, row.get("last_login") or ""), reverse=True)

	daily_login_map = {}
	for row in login_activity:
		day = str(row.login_day)
		entry = daily_login_map.setdefault(day, {"day": day, "logins": 0, "users": set()})
		entry["logins"] += 1
		entry["users"].add(row.user)

	daily_logins = [
		{"day": day, "logins": data["logins"], "unique_users": len(data["users"])}
		for day, data in sorted(daily_login_map.items())
	]

	top_pages = frappe.db.sql(
		"""
		SELECT
			pv.page_path,
			MAX(pv.page_title) AS page_title,
			COUNT(*) AS visits
		FROM `tabPortal Page Visit` pv
		INNER JOIN `tabPortal Usage Session` ps ON ps.name = pv.parent
		WHERE DATE(ps.session_start) BETWEEN %s AND %s
		GROUP BY pv.page_path
		ORDER BY visits DESC
		LIMIT 15
		""",
		(from_date, to_date),
		as_dict=True,
	)

	recent_sessions = [
		{
			"name": row.name,
			"user": row.user,
			"full_name": row.full_name or row.user,
			"customer": row.customer,
			"session_start": row.session_start,
			"session_end": row.session_end,
			"duration_seconds": row.duration_seconds or 0,
			"page_view_count": row.page_view_count or 0,
			"status": row.status,
		}
		for row in sessions[:50]
	]

	return {
		"success": True,
		"from_date": str(from_date),
		"to_date": str(to_date),
		"summary": {
			"total_logins": total_logins,
			"unique_users": unique_users,
			"avg_duration_minutes": round(flt(avg_duration_seconds) / 60, 1),
			"total_page_views": total_page_views,
			"total_portal_sessions": total_portal_sessions,
		},
		"per_user": per_user,
		"top_pages": top_pages,
		"daily_logins": daily_logins,
		"recent_sessions": recent_sessions,
	}


def close_stale_portal_sessions(stale_minutes=30):
	"""Close abandoned portal sessions that were left open."""
	cutoff = get_datetime(now_datetime()) - timedelta(minutes=stale_minutes)

	stale_sessions = frappe.get_all(
		"Portal Usage Session",
		filters={"status": "Open", "last_seen": ["<", cutoff]},
		pluck="name",
	)

	for name in stale_sessions:
		doc = frappe.get_doc("Portal Usage Session", name)
		doc.close_session(session_end=doc.last_seen or now_datetime())

	if stale_sessions:
		frappe.db.commit()

	return len(stale_sessions)
