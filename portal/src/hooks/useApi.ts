import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { fetchDocumentsWithFields } from '@/lib/api'; // Use the optimized fetcher
import { SalesOrder, SalesInvoice, Quotation, DeliveryNote, PaymentEntry } from '@/lib/api'; // Import relevant types

// Define a mapping from DocType string to its corresponding data type
// This helps with type safety when using the hook
interface DocTypeMapping {
  'Sales Order': SalesOrder;
  'Sales Invoice': SalesInvoice;
  'Quotation': Quotation;
  'Delivery Note': DeliveryNote;
  'Payment Entry': PaymentEntry;
  // Add other doctypes and their types here as needed
}

// Define the options for the useApi hook
interface UseApiOptions<TData> extends Omit<UseQueryOptions<TData[], Error>, 'queryKey' | 'queryFn'> {
  filters?: object; // Optional filters object
  queryKey?: QueryKey; // Allow overriding the default queryKey
  enabled?: boolean; // Standard React Query option to enable/disable the query
  staleTime?: number; // Time in milliseconds after which data becomes stale
  refetchOnMount?: boolean; // Whether to refetch when component mounts
}

/**
 * A generic hook to fetch a list of documents from the ERPNext API using React Query.
 * 
 * @template K - The DocType string (e.g., 'Sales Order').
 * @param {K} docType - The type of document to fetch.
 * @param {string[]} fields - An array of fields to retrieve for each document.
 * @param {UseApiOptions<DocTypeMapping[K]>} [options] - Optional configuration for filters and React Query.
 * @returns The result object from React Query ({ data, isLoading, isError, error, ... }).
 */
export const useApi = <K extends keyof DocTypeMapping>(
  docType: K,
  fields: string[],
  options?: UseApiOptions<DocTypeMapping[K]>
) => {
  // Destructure options, providing defaults with improved settings
  const { 
    filters = { docstatus: 1 }, 
    queryKey: customQueryKey, 
    enabled = true, 
    staleTime = 300000, // Default 5 minutes stale time
    refetchOnMount = true,
    ...queryOptions 
  } = options || {};

  // Construct a default query key based on doctype and filters for caching
  // Ensures that queries with different filters are cached separately
  const queryKey = customQueryKey || [docType, JSON.stringify(filters), fields.join(',')];

  // Use React Query's useQuery hook with improved configuration
  return useQuery<DocTypeMapping[K][], Error>({
    queryKey: queryKey,
    // The query function calls the optimized fetchDocumentsWithFields
    queryFn: () => fetchDocumentsWithFields<DocTypeMapping[K]>(docType, fields, filters),
    enabled: enabled, // Control whether the query runs automatically
    staleTime: staleTime, // Set how long the data stays fresh
    refetchOnMount: refetchOnMount, // Refetch when component mounts
    retry: 2, // Retry failed requests twice
    ...queryOptions, // Spread any other React Query options
  });
};
