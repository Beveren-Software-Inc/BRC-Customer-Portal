"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  getCustomerDashboardData,
  getPortalCustomerAccess,
  setActivePortalCustomer,
  PortalCustomerOption,
} from "@/lib/api";

interface CustomerContextType {
  hasCustomers: boolean | null;
  hideSalesOrders: boolean;
  isLoading: boolean;
  customerDisplayName: string;
  hasMultipleCustomers: boolean;
  isSalesUser: boolean;
  canSwitchCustomer: boolean;
  showDeskNavigation: boolean;
  activeCustomer: string | null;
  customers: PortalCustomerOption[];
  switchCustomer: (customerCode: string) => Promise<void>;
  refreshCustomerContext: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType>({
  hasCustomers: null,
  hideSalesOrders: false,
  isLoading: true,
  customerDisplayName: "Customer",
  hasMultipleCustomers: false,
  isSalesUser: false,
  canSwitchCustomer: false,
  showDeskNavigation: false,
  activeCustomer: null,
  customers: [],
  switchCustomer: async () => {},
  refreshCustomerContext: async () => {},
});

function formatCustomerDisplayName(
  customerCode?: string | null,
  customerName?: string | null
): string {
  if (customerCode && customerName) {
    return `${customerCode}: ${customerName}`;
  }
  if (customerCode) {
    return customerCode;
  }
  if (customerName) {
    return customerName;
  }
  return "Customer";
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [hasCustomers, setHasCustomers] = useState<boolean | null>(null);
  const [hideSalesOrders, setHideSalesOrders] = useState(false);
  const [customerDisplayName, setCustomerDisplayName] = useState("Customer");
  const [hasMultipleCustomers, setHasMultipleCustomers] = useState(false);
  const [isSalesUser, setIsSalesUser] = useState(false);
  const [canSwitchCustomer, setCanSwitchCustomer] = useState(false);
  const [showDeskNavigation, setShowDeskNavigation] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<string | null>(null);
  const [customers, setCustomers] = useState<PortalCustomerOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomerContext = useCallback(async () => {
    try {
      const [access, dashboard] = await Promise.all([
        getPortalCustomerAccess(),
        getCustomerDashboardData(),
      ]);

      setHasCustomers(access.has_customers || dashboard?.has_customers !== false);
      setHideSalesOrders(dashboard?.hide_sales_orders === true);
      setHasMultipleCustomers(access.has_multiple_customers);
      setIsSalesUser(access.is_sales_user);
      setCanSwitchCustomer(access.can_switch_customer);
      setShowDeskNavigation(access.show_desk_navigation);
      setActiveCustomer(access.active_customer);
      setCustomers(access.customers || []);

      const activeFromList = access.customers?.find(
        (item) => item.customer === access.active_customer
      );
      const customerInfo = dashboard?.customer_info;
      setCustomerDisplayName(
        formatCustomerDisplayName(
          activeFromList?.customer || customerInfo?.customer_code || access.active_customer,
          activeFromList?.customer_name || customerInfo?.customer_name
        )
      );
    } catch (error) {
      console.error("Error checking customer status:", error);
      setHasCustomers(false);
      setHideSalesOrders(false);
      setCustomerDisplayName("Customer");
      setHasMultipleCustomers(false);
      setIsSalesUser(false);
      setCanSwitchCustomer(false);
      setShowDeskNavigation(false);
      setActiveCustomer(null);
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomerContext();
  }, [refreshCustomerContext]);

  const switchCustomer = useCallback(
    async (customerCode: string) => {
      const result = await setActivePortalCustomer(customerCode);
      setActiveCustomer(result.active_customer);
      setCustomerDisplayName(
        formatCustomerDisplayName(result.active_customer, result.customer_name)
      );
      window.location.reload();
    },
    []
  );

  return (
    <CustomerContext.Provider
      value={{
        hasCustomers,
        hideSalesOrders,
        isLoading,
        customerDisplayName,
        hasMultipleCustomers,
        isSalesUser,
        canSwitchCustomer,
        showDeskNavigation,
        activeCustomer,
        customers,
        switchCustomer,
        refreshCustomerContext,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export const useCustomer = () => useContext(CustomerContext);
