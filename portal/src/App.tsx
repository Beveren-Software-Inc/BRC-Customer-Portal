import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { CurrencyProvider } from "@/context/currency-context";
import { AuthProvider } from "@/context/auth-context";
import { CustomerProvider } from "@/context/customer-context";
import MainLayout from "@/components/layout/main-layout";
import ProtectedRoute from "@/components/auth/protected-route";
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
          <CustomerProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/portal" element={<Navigate replace to="/" />} />

              {/* NotFound route - outside of MainLayout */}
              <Route path="not-found" element={<NotFound />} />

              {/* All routes */}
              <Route
                path="/*"
                element={
                  <MainLayout>
                    <Routes>
                      {/* Dashboard - always accessible */}
                      <Route path="/" element={<Dashboard />} />

                      {/* Sales Orders - requires customer and visible (hidden when custom_hide_sales_order_in_portal on Customer) */}
                      <Route 
                        path="/sales-orders" 
                        element={
                          <ProtectedRoute requireCustomer={true} requireSalesOrdersVisible={true}>
                            <SalesOrdersList />
                          </ProtectedRoute>
                        } 
                      />
                      <Route
                        path="/sales-orders/:id"
                        element={
                          <ProtectedRoute requireCustomer={true} requireSalesOrdersVisible={true}>
                            <SalesOrderDetail />
                          </ProtectedRoute>
                        }
                      />

                      {/* Quotations - requires customer */}
                      <Route 
                        path="/quotations" 
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <QuotationsList />
                          </ProtectedRoute>
                        } 
                      />
                      <Route
                        path="/quotations/:id"
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <QuotationDetail />
                          </ProtectedRoute>
                        }
                      />

                      {/* Invoices - requires customer */}
                      <Route 
                        path="/sales-invoices" 
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <InvoicesList />
                          </ProtectedRoute>
                        } 
                      />
                      <Route
                        path="/sales-invoices/:id"
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <InvoiceDetail />
                          </ProtectedRoute>
                        }
                      />

                      {/* Delivery Notes - requires customer */}
                      <Route
                        path="/delivery-notes"
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <DeliveryNotesList />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/delivery-notes/:id"
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <DeliveryNoteDetail />
                          </ProtectedRoute>
                        }
                      />

                      {/* Payments - requires customer */}
                      <Route 
                        path="/payments" 
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <PaymentsList />
                          </ProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/payments/:id" 
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <PaymentDetail />
                          </ProtectedRoute>
                        } 
                      />

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

                      {/* Settings - always accessible */}
                      <Route path="/settings" element={<Settings />} />

                      {/* Customer Statement - requires customer */}
                      <Route
                        path="/customer-statement"
                        element={
                          <ProtectedRoute requireCustomer={true}>
                            <CustomerStatementList />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </MainLayout>
                }
              />

              {/* Global catch-all route - renders NotFound page without layout */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CustomerProvider>
        </CurrencyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
