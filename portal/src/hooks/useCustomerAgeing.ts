import { useState, useEffect } from "react";

export interface AgingBuckets {
  current: number;
  "1_30": number;
  "31_60": number;
  "61_90": number;
  "90_plus": number;
}

export interface CustomerAgingData {
  [customer: string]: AgingBuckets;
}

export function useCustomerAging() {
  const [data, setData] = useState<CustomerAgingData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCustomerAging = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/method/customer_portal.api.customer_ageing.get_customer_aging");
        if (!res.ok) throw new Error("Failed to fetch customer aging data");

        const json = await res.json();
        setData(json.message || {});
      } catch (err: any) {
        setError(err);
        console.error("Error fetching customer aging:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerAging();
  }, []);

  return { data, loading, error };
}
