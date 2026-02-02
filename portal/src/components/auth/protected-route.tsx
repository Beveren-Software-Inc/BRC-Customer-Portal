import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomer } from '@/context/customer-context';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCustomer?: boolean; // If true, requires customer to be linked
  requireSalesOrdersVisible?: boolean; // If true, redirect to dashboard when Sales Orders tab is hidden for this customer
}

export default function ProtectedRoute({
  children,
  requireCustomer = false,
  requireSalesOrdersVisible = false,
}: ProtectedRouteProps) {
  const { hasCustomers, hideSalesOrders, isLoading } = useCustomer();
  const location = useLocation();

  // If this route is for Sales Orders but tab is hidden for this customer, redirect to dashboard
  if (requireSalesOrdersVisible && !isLoading && hideSalesOrders) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // If route requires customer and user has no customers, redirect to dashboard
  if (requireCustomer && !isLoading && hasCustomers === false) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Show loading state while checking customer status
  if ((requireCustomer || requireSalesOrdersVisible) && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
