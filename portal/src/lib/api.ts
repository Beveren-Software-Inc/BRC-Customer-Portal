import axios from "axios";

// Function to get CSRF token from global variable (set by Frappe template)
function getCSRFToken(): string | null {
  // Get from global window variable (set by Frappe template)
  if (typeof window !== 'undefined' && (window as any).csrf_token) {
    const token = (window as any).csrf_token;
   
    return token;
  }
  
  console.warn("[WARNING] No CSRF token found in window.csrf_token");
  return null;
}

// Function to get fresh CSRF token from server
async function getFreshCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/method/frappe.sessions.get_csrf_token", {
      method: "GET",
      credentials: "include"
    });
    
    if (response.ok) {
      const data = await response.json();
      const token = data.message;
      return token;
    } else if (response.status === 403) {
      return null;
    } else {
      console.error("[ERROR] Failed to get fresh CSRF token:", response.status);
      return null;
    }
  } catch (error) {
    console.error("[ERROR] Error fetching fresh CSRF token:", error);
    return null;
  }
}

// Base API configuration
export const erpnextApi = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Include cookies for authentication
});

// Add CSRF token interceptor
erpnextApi.interceptors.request.use(
  (config) => {
    // Only add CSRF token for POST, PUT, PATCH, DELETE requests
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      const csrfToken = getCSRFToken();
  
      if (csrfToken) {
        config.headers['X-Frappe-CSRF-Token'] = csrfToken;
      } else {
        console.warn("[WARNING] No CSRF token found for POST request");
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Type definitions for ERPNext responses
export interface ERPNextResponse<T> {
  message: T;
}

// Portal settings interface
export interface PortalSettings {
  name: string;
  portal_logo: string;
  portal_icon: string;
  company_name: string;
  allow_download_files: number; // 0 or 1 for boolean
  download_format?: "PDF" | "Excel" | "";
}

export interface ERPNextListResponse {
  data: { name: string }[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    pages: number;
  };
}

// Data models
export interface SalesOrder {
  name: string;
  customer: string;
  customer_name?: string;
  transaction_date: string;
  grand_total: number;
  status: string;
  currency: string;
  items: SalesItem[];
  // Additional properties needed by components
  per_delivered?: number;
  per_billed?: number;
  delivery_date?: string;
  valid_till?: string;
  total_taxes_and_charges?: number;
  net_total?: number;
  total_qty?: number;
  tax_id?: string;
  customer_tax_id?: string;
  po_no?: string;
  contact_person?: string;
  address_display?: string;
  shipping_address_display?: string;
  carry_over?: number;
  shipping_type?: string;
  remarks?: string;
  allow_partial_delivery?: boolean;
  brc_logo_url?: string;
  vision2030_logo_url?: string;
  related_deliveries?: { name: string; amount: number; currency: string }[];
  related_invoices?: { name: string; amount: number; currency: string }[];
}

export async function getSapSalesOrderDetail(docNum: string): Promise<SalesOrder | null> {
  try {
    const response = await fetch(`/api/method/sap_customer_portal.api.customer_balance.get_customer_order_detail?doc_num=${encodeURIComponent(docNum)}`);
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as SalesOrder;
    } else {
      console.error("Error fetching order detail from SAP:", data.message?.message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching order detail:", error);
    return null;
  }
}

export interface RelatedDocsForOrder {
  related_deliveries: { name: string; amount: number; currency: string }[];
  related_invoices: { name: string; amount: number; currency: string }[];
}

export async function getRelatedDocsForOrder(docNum: string): Promise<RelatedDocsForOrder | null> {
  try {
    const response = await fetch(`/api/method/sap_customer_portal.api.customer_balance.get_related_docs_for_order?doc_num=${encodeURIComponent(docNum)}`);
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as RelatedDocsForOrder;
    } else {
      console.error("Error fetching related docs from SAP:", data.message?.message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching related docs:", error);
    return null;
  }
}

export async function getSapDeliveryNotes(): Promise<DeliveryNote[]> {
  try {
    const response = await fetch('/api/method/sap_customer_portal.api.customer_balance.get_customer_delivery_notes');
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as DeliveryNote[];
    } else {
      console.error("Error fetching delivery notes from SAP:", data.message?.message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching delivery notes:", error);
    return [];
  }
}

export async function getSapDeliveryNoteDetail(docNum: string): Promise<DeliveryNote | null> {
  try {
    const response = await fetch(`/api/method/sap_customer_portal.api.customer_balance.get_customer_delivery_note_detail?doc_num=${encodeURIComponent(docNum)}`);
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as DeliveryNote;
    } else {
      console.error("Error fetching delivery note detail from SAP:", data.message?.message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching delivery note detail:", error);
    return null;
  }
}

export async function getSapInvoices(): Promise<Invoice[]> {
  try {
    const response = await fetch('/api/method/sap_customer_portal.api.customer_balance.get_customer_invoices');
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as Invoice[];
    } else {
      console.error("Error fetching invoices from SAP:", data.message?.message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }
}

export async function getSapInvoiceDetail(docNum: string): Promise<Invoice | null> {
  try {
    const response = await fetch(`/api/method/sap_customer_portal.api.customer_balance.get_customer_invoice_detail?doc_num=${encodeURIComponent(docNum)}`);
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data as Invoice;
    } else {
      console.error("Error fetching invoice detail from SAP:", data.message?.message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching invoice detail:", error);
    return null;
  }
}

export interface Quotation {
  name: string;
  party_name: string;
  transaction_date: string;
  grand_total: number;
  status: string;
  currency: string;
  valid_till: string;
  items: SalesItem[];
}

export interface SalesInvoice {
  name: string;
  sap_doc_entry?: number;
  customer: string;
  customer_name?: string;
  posting_date: string;
  due_date: string;
  grand_total: number;
  outstanding_amount: number;
  paid_amount?: number;
  status: string;
  currency: string;
  items: SalesItem[];
  comments?: string;
  docstatus?: number;
  company?: string;
  tax_id?: string;
  address_display?: string;
  shipping_address_display?: string;
  contact_display?: string;
  contact_email?: string;
  total_taxes_and_charges?: number;
  is_return?: number;
  return_against?: string;
  customer_tax_id?: string;
  po_no?: string;
  brc_logo_url?: string;
  vision2030_logo_url?: string;
}

// Alias for SAP invoices
export type Invoice = SalesInvoice;

export interface PaymentEntry {
  name: string;
  payment_type: string;
  posting_date: string;
  paid_amount: number;
  received_amount: number;
  reference_no: string;
  reference_date: string;
  party: string;
  status: string;
}

export interface SalesItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  description?: string;
  uom?: string;
  stock_uom?: string;
  conversion_factor?: number;
  delivered_qty?: number;
  pending_qty?: number;
}

// Additional interfaces
export interface DeliveryNote {
  name: string;
  customer: string;
  customer_name?: string;
  posting_date: string;
  grand_total: number;
  status: string;
  currency: string;
  items: SalesItem[];
  total_taxes_and_charges?: number;
  net_total?: number;
  tax_id?: string;
  customer_tax_id?: string;
  po_no?: string;
  customer_po_no?: string;
  sales_order?: string;
  shipping_address?: string;
  shipping_address_display?: string;
  address_display?: string;
  sap_receiver_name?: string;
  sap_carrier?: string;
  sap_driver_name?: string;
  sap_truck_no?: string;
  sap_mobile_no?: string;
  qr_code?: string;
  brc_logo_url?: string;
  vision2030_logo_url?: string;
}

export interface DeliveryNoteOld {
  name: string;
  sap_doc_entry?: number;
  customer: string;
  customer_name?: string;
  posting_date: string;
  transaction_date?: string;
  status: string;
  currency: string;
  items: DeliveryItem[];
  grand_total: number;
  comments?: string;
  // Additional properties needed by components
  per_billed?: number;
  per_installed?: number;
  per_returned?: number;
  shipping_address?: string;
  total_taxes_and_charges?: number;
  total_qty?: number;
}

export interface DeliveryItem extends SalesItem {
  against_sales_order?: string;
}

/**
 * Helper function to fetch documents of a given type with specified fields.
 * Only documents matching the provided filters are returned.
 */
export async function fetchDocumentsWithFields<T>(
  docType: string,
  fields: string[],
  filters: object = { docstatus: 1 } // Default filter remains
): Promise<T[]> {
  // console.log(`Fetching ${docType} with fields:`, fields, "Filters:", filters); // Log request details
  try {
    const response = await erpnextApi.get(`/resource/${docType}`, {
      params: {
        fields: JSON.stringify(fields), // Fetch specified fields
        filters: JSON.stringify(filters),
        limit_page_length: 0, // Fetch all matching documents
      },
    });

    // console.log(`Raw response for ${docType}:`, response); // Log raw response

    // Extract document data from the response
    let documents: T[] = [];
    if (response.data?.data && Array.isArray(response.data.data)) {
      documents = response.data.data;
    } else if (response.data?.message && Array.isArray(response.data.message)) {
      // Handle cases where data might be in message (less common for list views)
      documents = response.data.message;
      console.log(
        `Extracted documents from response.data.message for ${docType}`
      );
    } else {
      console.warn(
        `Unexpected response structure for ${docType}:`,
        response.data
      );
    }

    return documents;
  } catch (error) {
    console.error(`Error fetching ${docType} documents with fields:`, error); // Log error
    // Check if the error is an Axios error and log more details
    if (axios.isAxiosError(error)) {
      console.error(
        "Axios error details:",
        error.response?.status,
        error.response?.data
      );
    }
    throw error; // Re-throw the error to be handled by React Query
  }
}

// API Functions - Updated to use fetchDocumentsWithFields

export async function getSalesOrders(
  filters: object = { docstatus: 1 }
): Promise<SalesOrder[]> {
  const fields = [
    "name",
    "customer",
    "transaction_date",
    "grand_total",
    "status",
    "currency",
  ];
  // Note: We are not fetching 'items' here for the list view to keep the payload small.
  // If 'items' are needed elsewhere, a separate call or adjustment might be necessary.
  return fetchDocumentsWithFields<SalesOrder>("Sales Order", fields, filters);
}

export async function getQuotations(
  filters: object = { docstatus: 1 }
): Promise<Quotation[]> {
  const fields = [
    "name",
    "party_name",
    "transaction_date",
    "grand_total",
    "status",
    "currency",
    "valid_till",
  ];
  return fetchDocumentsWithFields<Quotation>("Quotation", fields, filters);
}

export async function getSalesInvoices(
  filters: object = { docstatus: 1 }
): Promise<SalesInvoice[]> {
  // Use SAP B1 API instead of ERPNext
  try {
    const response = await fetch("/api/method/sap_customer_portal.api.customer_balance.get_customer_invoices");
    const data = await response.json();
    
    if (data.message && data.message.success) {
      return data.message.data || [];
    } else {
      console.error("Error fetching invoices from SAP:", data.message?.message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }
}

export async function getPaymentEntries(
  filters: object = { docstatus: 1 }
): Promise<PaymentEntry[]> {
  const fields = [
    "name",
    "payment_type",
    "posting_date",
    "paid_amount",
    "received_amount",
    "reference_no",
    "reference_date",
    "party",
    "status",
  ];
  return fetchDocumentsWithFields<PaymentEntry>(
    "Payment Entry",
    fields,
    filters
  );
}

// SAP B1 API functions
export async function getCustomerBalance(): Promise<any> {
  try {
    const response = await fetch("/api/method/sap_customer_portal.api.customer_balance.get_customer_balance");
    const data = await response.json();
    
    if (data.message && data.message.success) {
      return data.message.data;
    } else {
      console.error("Error fetching customer balance from SAP:", data.message?.message);
      return null;
    }
  } catch (error) {
    console.error("Error fetching customer balance:", error);
    return null;
  }
}

export async function getCustomerDashboardData(): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for dashboard
  
  try {
    const response = await fetch("/api/method/sap_customer_portal.api.customer_balance.get_customer_dashboard_data", {
      signal: controller.signal,
      credentials: "include"
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    // Check if user has no customers
    if (data.message && data.message.has_customers === false) {
      return { has_customers: false, hide_sales_orders: false, message: data.message.message };
    }

    if (data.message && data.message.success) {
      return {
        ...data.message.data,
        has_customers: data.message.has_customers !== false,
        hide_sales_orders: data.message.hide_sales_orders === true,
      };
    } else {
      console.error("Error fetching dashboard data from SAP:", data.message?.message);
      return { has_customers: false, hide_sales_orders: false, error: true, message: data.message?.message };
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error("Dashboard data fetch timeout after 60 seconds");
      throw new Error("Request timed out. The SAP server may be slow. Please try again.");
    }
    console.error("Error fetching dashboard data:", error);
    throw error;
  }
}
// ---- Invoice Status Summary (server-aggregated) ----
export interface InvoiceStatusBucket {
  name: string;
  value: number;
  percentage: number;
  total: number;
  color: string;
}

export async function getInvoiceStatusSummary(period: string = "12months"): Promise<{ period: string; buckets: InvoiceStatusBucket[]; total: number } | null> {
  try {
    const response = await fetch(`/api/method/sap_customer_portal.api.customer_balance.get_invoice_status_summary?period=${encodeURIComponent(period)}`);
    const data = await response.json();
    if (data.message && data.message.success) {
      return data.message.data;
    }
    if (data.message && data.message.data) {
      return data.message.data;
    }
    return null;
  } catch (e) {
    console.error("Failed to fetch invoice status summary", e);
    return null;
  }
}

export async function getSapSalesOrders(): Promise<any[]> {
  try {
    console.log("Fetching SAP sales orders...");
    const response = await fetch("/api/method/sap_customer_portal.api.customer_balance.get_customer_orders");
    console.log("SAP orders response status:", response.status);
    
    const data = await response.json();
    console.log("SAP orders response data:", data);
    
    if (data.message && data.message.success) {
      console.log("SAP orders success, data:", data.message.data);
      return data.message.data || [];
    } else {
      console.error("Error fetching orders from SAP:", data.message?.message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}


export async function getDeliveryNotes(
  filters: object = { docstatus: 1 }
): Promise<DeliveryNote[]> {
  const fields = [
    "name",
    "customer",
    "posting_date",
    "status",
    "currency",
    "grand_total",
  ];
  return fetchDocumentsWithFields<DeliveryNote>(
    "Delivery Note",
    fields,
    filters
  );
}

/**
 * Fetch a single document by name.
 * It fetches all fields for the specified document.
 */
export async function getDocumentByName<T>(
  docType: string,
  name: string
): Promise<T | null> {
  try {
    const response = await erpnextApi.get(`/resource/${docType}/${name}`);

    // Assuming the full document data is in response.data.data
    const doc = response.data?.data;

    // Optional: You might still want to check docstatus or other conditions
    // if (doc && doc.docstatus !== 1) {
    //   console.warn(`${docType} ${name} is not submitted (docstatus=${doc.docstatus})`);
    //   return null;
    // }

    return doc ? (doc as T) : null;
  } catch (error) {
    console.error(`Error fetching ${docType} ${name}:`, error);
    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", error.response?.data);
    }
    // Return null or throw error based on how you want to handle detail view errors
    // Returning null might be suitable if a 404 is expected for non-existent/unauthorized docs
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`${docType} ${name} not found or access denied.`);
      return null;
    }
    throw error; // Re-throw for other errors
  }
}

// ... checkCustomerHasData remains the same, but will now use the optimized fetchers ...
export const checkCustomerHasData = async (): Promise<boolean> => {
  try {
    // Make parallel API calls to check if there's any relevant data
    // These calls now use the optimized fetchDocumentsWithFields
    const [invoices, salesOrders, quotations, deliveryNotes] =
      await Promise.all([
        getSalesInvoices().catch(() => []),
        getSalesOrders().catch(() => []),
        getQuotations().catch(() => []),
        getDeliveryNotes().catch(() => []),
      ]);

    // Return true if any of these arrays has content
    return (
      (Array.isArray(invoices) && invoices.length > 0) ||
      (Array.isArray(salesOrders) && salesOrders.length > 0) ||
      (Array.isArray(quotations) && quotations.length > 0) ||
      (Array.isArray(deliveryNotes) && deliveryNotes.length > 0)
    );
  } catch (error) {
    console.error("Error checking customer data:", error);
    return false; // Assume no data on error
  }
};

export const getCurrentUser = async (): Promise<string | null> => {
  try {
    const response = await erpnextApi.get(
      "/method/frappe.auth.get_logged_user"
    );
    if (response.data?.message) {
      return response.data.message;
    }
    return null;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
};

export const logoutUser = async (): Promise<void> => {
  await erpnextApi.get("/method/login");
};

/**
 * Fetches the Customer Portal Settings
 * This includes logo, icon, company name, and other portal configuration
 */
export async function getPortalSettings(): Promise<PortalSettings | null> {
  try {
    // Use our whitelisted method instead of direct doctype access
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_statement.get_portal_settings"
    );

    if (response.data?.message) {
      return response.data.message as PortalSettings;
    }
    return null;
  } catch (error) {
    console.error("Error fetching portal settings:", error);
    return null;
  }
}

// Customer Statement API functions
export interface CustomerStatementFilter {
  customer?: string;
  from_date: string;
  to_date: string;
  company?: string;
}

/**
 * Download Customer Statement using ERPNext's General Ledger report
 */
/**
 * Get user session defaults including company
 */
export const getUserSessionDefaults = async (): Promise<
  Record<string, any>
> => {
  try {
    const response = await erpnextApi.get(
      "/method/frappe.desk.desktop.get_workspace_sidebar_items"
    );
    if (response.data?.message?.defaults) {
      return response.data.message.defaults;
    }
    return {};
  } catch (error) {
    console.warn("Could not get user session defaults:", error);
    return {};
  }
};

/**
 * Get all companies available to the user
 */
export const getUserCompanies = async (): Promise<string[]> => {
  try {
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_balance.get_user_companies"
    );

    if (response.data?.message?.success && response.data.message.companies) {
      return response.data.message.companies.map((company: any) => company.name);
    }
    return [];
  } catch (error) {
    console.warn("Could not get user companies:", error);
    return [];
  }
};

/**
 * Get the user's default company from invoice data
 * This is more efficient than fetching from Global Defaults and ensures
 * we use the same company context as the customer's actual data
 */
export const getUserDefaultCompany = async (): Promise<string> => {
  try {
    console.log("Getting default company from whitelisted method...");

    // Use the whitelisted method to get default company
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_balance.get_user_default_company"
    );

    if (response.data?.message?.success && response.data.message.company) {
      console.log("Found company from whitelisted method:", response.data.message.company);
      return response.data.message.company;
    }

    // Fallback: If no company found, try getting all companies and use the first one
    console.log("No company found from whitelisted method, falling back to company list...");
    const companies = await getUserCompanies();
    console.log("Available companies:", companies);

    if (companies.length > 0) {
      console.log("Using first available company:", companies[0]);
      return companies[0];
    }

    throw new Error("No company found");
  } catch (error) {
    console.error("Could not get user default company:", error);
    throw new Error(
      "Unable to determine user company. Please contact administrator."
    );
  }
};

export const downloadCustomerStatement = async (
  filters: CustomerStatementFilter,
  format: "PDF" | "Excel" = "PDF"
): Promise<void> => {
  try {
    // Handle PDF format differently - open print preview instead of download
    if (format === "PDF") {
      await openCustomerStatementPrintPreview(filters);
      return;
    }

    // Get user's default company first
    let company = filters.company;
    if (!company) {
      company = await getUserDefaultCompany();
    }

    console.log("Using company for statement:", company);

    // Use our whitelisted API method for Excel download
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_statement.download_customer_statement",
      {
        params: {
          customer: filters.customer,
          from_date: filters.from_date,
          to_date: filters.to_date,
          company: company,
          file_format: format,
        },
        responseType: "blob",
      }
    );

    console.log("Export response status:", response.status);
    console.log("Export response headers:", response.headers);

    // Create a download link for the blob
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer_statement.xlsx`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  } catch (error) {
    console.error("Failed to download customer statement:", error);
    // Re-throw with user-friendly message
    if (error instanceof Error && error.message.includes("company")) {
      throw new Error(
        "Unable to determine company for customer statement. Please contact administrator."
      );
    }
    throw error;
  }
};

export const openCustomerStatementPrintPreview = async (
  filters: CustomerStatementFilter
): Promise<void> => {
  try {
    // Get user's default company first
    let company = filters.company;
    if (!company) {
      company = await getUserDefaultCompany();
    }

    console.log("Opening print preview for company:", company);

    // Get HTML content for print preview
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_statement_pdf.get_customer_statement_pdf_preview",
      {
        params: {
          customer: filters.customer,
          from_date: filters.from_date,
          to_date: filters.to_date,
          company: company,
        },
      }
    );

    console.log("Print preview response:", response.data);

    if (response.data?.message?.html_content) {
      // Open the HTML content in a new window for print preview
      const printWindow = window.open(
        "",
        "_blank",
        "width=1200,height=800,scrollbars=yes,resizable=yes"
      );
      if (printWindow) {
        printWindow.document.write(response.data.message.html_content);
        printWindow.document.close();
        printWindow.focus();
      } else {
        throw new Error(
          "Unable to open print preview window. Please check your popup blocker settings."
        );
      }
    } else {
      console.error("Print preview response missing html_content:", response.data);
      throw new Error("Failed to generate print preview content. Please check the server logs for more details.");
    }
  } catch (error) {
    console.error("Failed to open print preview:", error);
    // Re-throw with user-friendly message
    if (error instanceof Error && error.message.includes("company")) {
      throw new Error(
        "Unable to determine company for customer statement. Please contact administrator."
      );
    }
    throw error;
  }
};

/**
 * Get Customer Statement data using SAP JL Entry data for preview
 */
export const getSapCustomerStatement = async (
  fromDate: string,
  toDate: string
): Promise<any> => {
  try {
    const response = await fetch(
      `/api/method/sap_customer_portal.api.customer_balance.get_customer_statement_from_jl_entry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Frappe-CSRF-Token": getCSRFToken(),
        },
        body: JSON.stringify({
          from_date: fromDate,
          to_date: toDate,
        }),
      }
    );

    const data = await response.json();
    console.log("[DEBUG] Customer statement response:", data);
    
    if (data.message && data.message.success) {
      return data.message.data;
    } else {
      console.error("Error fetching customer statement:", data.message?.message);
      throw new Error(data.message?.message || "Failed to fetch customer statement");
    }
  } catch (error) {
    console.error("Error fetching customer statement:", error);
    throw error;
  }
};

/**
 * Get Customer Payments from SAP B1
 */
export const getSapCustomerPayments = async (): Promise<any> => {
  try {
    const response = await fetch(
      `/api/method/sap_customer_portal.api.customer_balance.get_customer_payments`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Frappe-CSRF-Token": getCSRFToken(),
        },
      }
    );

    const data = await response.json();
    
    if (data.message && data.message.success) {
      return data.message.data;
    } else {
      console.error("Error fetching customer payments from SAP:", data.message?.message);
      throw new Error(data.message?.message || "Failed to fetch customer payments");
    }
  } catch (error) {
    console.error("Error fetching customer payments:", error);
    throw error;
  }
};

export const getCustomerStatementData = async (
  filters: CustomerStatementFilter
): Promise<any> => {
  try {
    // Get user's default company first
    let company = filters.company;
    if (!company) {
      company = await getUserDefaultCompany();
    }

    // Use our whitelisted API method instead of direct query report access
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_statement.get_customer_statement_data",
      {
        params: {
          customer: filters.customer,
          from_date: filters.from_date,
          to_date: filters.to_date,
          company: company,
        },
      }
    );

    return response.data.message;
  } catch (error) {
    console.error("Failed to fetch customer statement data:", error);
    // Re-throw with user-friendly message
    if (error instanceof Error && error.message.includes("company")) {
      throw new Error(
        "Unable to determine company for customer statement. Please contact administrator."
      );
    }
    throw error;
  }
};

/**
 * Get list of customers available to the current user
 * This uses a whitelisted method that respects user permissions
 */
export const getCustomerListForStatements = async (): Promise<
  Array<{ customer: string; customer_name: string }>
> => {
  try {
    const response = await erpnextApi.get(
      "/method/sap_customer_portal.api.customer_statement.get_customer_list"
    );

    return response.data.message || [];
  } catch (error) {
    console.error("Failed to fetch customer list:", error);
    return [];
  }
};

// --- Monthly Sales Order Stats API ---
export interface MonthlySalesOrderStat {
  month: string;
  order_amount: number;
  amount_paid: number;
  currency: string;
}

export async function getMonthlySalesOrderStats(months: number = 12): Promise<MonthlySalesOrderStat[]> {
  try {
  
    // Try using fetch instead of axios to match direct API access
    let csrfToken = getCSRFToken();
    
    let response = await fetch("/api/method/sap_customer_portal.utils.get_monthly_sales_order_stats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken || "",
      },
      credentials: "include",
      body: JSON.stringify({ months })
    });
    
  
    // If CSRF error, try different approaches
    if (!response.ok && response.status === 400) {
      const errorText = await response.text();
      console.log("[DEBUG] First attempt failed, checking if CSRF error...");
      
      if (errorText.includes("CSRFTokenError")) {
        console.log("[DEBUG] CSRF error detected, trying alternative approaches...");
        
        // Try 1: Get fresh token (works for admin users)
        const freshToken = await getFreshCSRFToken();
        
        if (freshToken) {
          console.log("[DEBUG] Retrying with fresh CSRF token:", freshToken);
          response = await fetch("/api/method/sap_customer_portal.utils.get_monthly_sales_order_stats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Frappe-CSRF-Token": freshToken,
            },
            credentials: "include",
            body: JSON.stringify({ months })
          });
          
          console.log("[DEBUG] Retry response status:", response.status);
        } else {
          // Try 2: For customer users, try without CSRF token (some endpoints allow this)
          console.log("[DEBUG] Trying without CSRF token for customer users...");
          response = await fetch("/api/method/sap_customer_portal.utils.get_monthly_sales_order_stats", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ months })
          });
          
          console.log("[DEBUG] No-CSRF retry response status:", response.status);
          
          if (!response.ok) {
            // Try 3: Use GET method instead of POST (some endpoints support GET)
            console.log("[DEBUG] Trying GET method instead of POST...");
            response = await fetch(`/api/method/sap_customer_portal.utils.get_monthly_sales_order_stats?months=${months}`, {
              method: "GET",
              credentials: "include"
            });
            
            console.log("[DEBUG] GET retry response status:", response.status);
          }
        }
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ERROR] All attempts failed:", response.status, errorText);
      console.error("[ERROR] Request headers sent:", {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken || "",
      });
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.message) {
      return data.message;
    }
    console.error("[ERROR] No message in response data:", data);
    throw new Error("Failed to fetch monthly sales order stats");
  } catch (error) {
    console.error("[ERROR] getMonthlySalesOrderStats failed:", error);
    throw error;
  }
}
