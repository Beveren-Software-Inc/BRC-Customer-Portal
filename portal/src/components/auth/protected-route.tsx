import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCustomer } from '@/context/customer-context';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCustomer?: boolean; // If true, requires customer to be linked
}

export default function ProtectedRoute({ children, requireCustomer = false }: ProtectedRouteProps) {
  const { hasCustomers, isLoading } = useCustomer();
  const location = useLocation();

  // If route requires customer and user has no customers, redirect to dashboard
  if (requireCustomer && !isLoading && hasCustomers === false) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  // Show loading state while checking customer status
  if (requireCustomer && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
