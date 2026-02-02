"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCustomerDashboardData } from "@/lib/api";

interface CustomerContextType {
  hasCustomers: boolean | null; // null = loading, true = has customers, false = no customers
  hideSalesOrders: boolean; // true when any linked customer has custom_hide_sales_order_in_portal
  isLoading: boolean;
}

const CustomerContext = createContext<CustomerContextType>({
  hasCustomers: null,
  hideSalesOrders: false,
  isLoading: true,
});

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [hasCustomers, setHasCustomers] = useState<boolean | null>(null);
  const [hideSalesOrders, setHideSalesOrders] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkCustomerStatus = async () => {
      try {
        const data = await getCustomerDashboardData();
        setHasCustomers(data?.has_customers !== false);
        setHideSalesOrders(data?.hide_sales_orders === true);
      } catch (error) {
        console.error("Error checking customer status:", error);
        setHasCustomers(false);
        setHideSalesOrders(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkCustomerStatus();
  }, []);

  return (
    <CustomerContext.Provider value={{ hasCustomers, hideSalesOrders, isLoading }}>
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomer = () => useContext(CustomerContext);
