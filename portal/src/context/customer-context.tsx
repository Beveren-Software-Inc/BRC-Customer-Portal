"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCustomerDashboardData } from "@/lib/api";

interface CustomerContextType {
  hasCustomers: boolean | null; // null = loading, true = has customers, false = no customers
  isLoading: boolean;
}

const CustomerContext = createContext<CustomerContextType>({
  hasCustomers: null,
  isLoading: true,
});

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [hasCustomers, setHasCustomers] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCustomerStatus = async () => {
      try {
        const data = await getCustomerDashboardData();
        setHasCustomers(data?.has_customers !== false);
      } catch (error) {
        console.error("Error checking customer status:", error);
        setHasCustomers(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkCustomerStatus();
  }, []);

  return (
    <CustomerContext.Provider value={{ hasCustomers, isLoading }}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomer = () => useContext(CustomerContext);

