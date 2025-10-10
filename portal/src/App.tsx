import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import MainLayout from "@/components/layout/main-layout";
import NotFound from "@/app/not-found/page";

// Import page components
import Dashboard from "@/components/dashboard/dashboard";
import DocumentsList from "@/components/documents/documents-list";

// List views
import SalesOrdersList from "@/components/sales-orders/sales-orders-list";
import QuotationsList from "@/components/quotations/quotations-list";
import InvoicesList from "@/components/sales-invoices/sales-invoices-list";
import DeliveryNotesList from "@/components/delivery-notes/delivery-notes-list";
import PaymentsList from "@/components/payments/payments-list";
import SupportTicketsList from "@/components/support-tickets/support-tickets-list";
import Settings from "@/app/settings/page";

// Detail views
import SalesOrderDetail from "@/components/sales-orders/sales-order-detail";
import QuotationDetail from "@/components/quotations/quotation-detail";
import InvoiceDetail from "@/components/sales-invoices/sales-invoice-detail";
import DeliveryNoteDetail from "@/components/delivery-notes/delivery-note-detail";
import PaymentDetail from "@/components/payments/payment-detail";
import SupportTicketDetail from "@/components/support-tickets/support-ticket-detail";
import CustomerStatementList from "@/components/customer-statement/customer-statement-list";

export default function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="theme">
      <AuthProvider>
        <CurrencyProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/portal" element={<Navigate replace to="/" />} />

            {/* NotFound route - outside of MainLayout */}
            <Route path="not-found" element={<NotFound />} />

            {/* All routes - no protection */}
            <Route
              path="/*"
              element={
                <MainLayout>
                  <Routes>
                    {/* Dashboard */}
                    <Route path="/" element={<Dashboard />} />

                    {/* Sales Orders */}
                    <Route path="/sales-orders" element={<SalesOrdersList />} />
                    <Route
                      path="/sales-orders/:id"
                      element={<SalesOrderDetail />}
                    />

                    {/* Quotations */}
                    <Route path="/quotations" element={<QuotationsList />} />
                    <Route
                      path="/quotations/:id"
                      element={<QuotationDetail />}
                    />

                    {/* Invoices */}
                    <Route path="/sales-invoices" element={<InvoicesList />} />
                    <Route
                      path="/sales-invoices/:id"
                      element={<InvoiceDetail />}
                    />

                    {/* Delivery Notes */}
                    <Route
                      path="/delivery-notes"
                      element={<DeliveryNotesList />}
                    />
                    <Route
                      path="/delivery-notes/:id"
                      element={<DeliveryNoteDetail />}
                    />

                    {/* Payments */}
                    <Route path="/payments" element={<PaymentsList />} />
                    <Route path="/payments/:id" element={<PaymentDetail />} />

                    {/* Support Tickets */}
                    <Route
                      path="/support-tickets"
                      element={<SupportTicketsList />}
                    />
                    <Route
                      path="/support-tickets/:id"
                      element={<SupportTicketDetail />}
                    />

                    {/* Documents */}
                    <Route path="/documents" element={<DocumentsList />} />

                    {/* Settings */}
                    <Route path="/settings" element={<Settings />} />

                    {/* Customer Statement */}
                    <Route
                      path="/customer-statement"
                      element={<CustomerStatementList />}
                    />
                  </Routes>
                </MainLayout>
              }
            />

            {/* Global catch-all route - renders NotFound page without layout */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
