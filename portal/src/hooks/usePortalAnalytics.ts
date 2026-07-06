import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth-context";

const SESSION_STORAGE_KEY = "portal_usage_session_id";
const HEARTBEAT_MS = 2 * 60 * 1000;

function getCSRFToken(): string | null {
  if (typeof window !== "undefined" && (window as any).csrf_token) {
    return (window as any).csrf_token;
  }
  return null;
}

function getPageTitle(pathname: string): string {
  const labels: Record<string, string> = {
    "/": "Dashboard",
    "/sales-orders": "Sales Orders",
    "/delivery-notes": "Delivery Notes",
    "/sales-invoices": "Invoices",
    "/payments": "Payments",
    "/customer-statement": "Customer Statement",
    "/settings": "Settings",
    "/portal-analytics": "Portal Analytics",
  };

  if (labels[pathname]) return labels[pathname];
  if (pathname.startsWith("/sales-orders/")) return "Sales Order Detail";
  if (pathname.startsWith("/delivery-notes/")) return "Delivery Note Detail";
  if (pathname.startsWith("/sales-invoices/")) return "Invoice Detail";
  if (pathname.startsWith("/payments/")) return "Payment Detail";
  return pathname.replace(/^\//, "").replace(/-/g, " ") || "Portal";
}

async function callPortalAnalytics(
  method: string,
  args: Record<string, unknown> = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers["X-Frappe-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(args),
  });
  const data = await response.json();
  return data.message;
}

export function endPortalUsageSession() {
  const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers["X-Frappe-CSRF-Token"] = csrfToken;
  }

  fetch("/api/method/sap_customer_portal.api.portal_analytics.end_portal_session", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ session: sessionId }),
    keepalive: true,
  }).catch(() => {});

  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function usePortalAnalytics() {
  const { user, isInitialized } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    if (!isInitialized || !user.isLoggedIn) return;

    let cancelled = false;

    async function resumeOrStartSession() {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);

      try {
        const result = await callPortalAnalytics(
          "sap_customer_portal.api.portal_analytics.start_portal_session",
          existing ? { session: existing } : {}
        );
        if (!cancelled && result?.session) {
          sessionIdRef.current = result.session;
          sessionStorage.setItem(SESSION_STORAGE_KEY, result.session);
        }
      } catch (error) {
        console.error("Failed to start portal usage session:", error);
      }
    }

    resumeOrStartSession();

    const heartbeat = window.setInterval(() => {
      const sessionId = sessionIdRef.current || sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!sessionId) return;
      callPortalAnalytics(
        "sap_customer_portal.api.portal_analytics.heartbeat_portal_session",
        { session: sessionId }
      ).catch(() => {});
    }, HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
    };
  }, [isInitialized, user.isLoggedIn]);

  useEffect(() => {
    if (!isInitialized || !user.isLoggedIn) return;

    const pathname = location.pathname || "/";
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const sessionId = sessionIdRef.current || sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) return;

    callPortalAnalytics(
      "sap_customer_portal.api.portal_analytics.record_portal_page_visit",
      {
        session: sessionId,
        page_path: pathname,
        page_title: getPageTitle(pathname),
      }
    ).catch(() => {});
  }, [location.pathname, isInitialized, user.isLoggedIn]);
}
