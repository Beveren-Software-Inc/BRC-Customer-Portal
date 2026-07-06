import { useQuery } from "@tanstack/react-query";
import { checkPortalAdmin } from "@/lib/api";

export function usePortalAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["portal-admin"],
    queryFn: checkPortalAdmin,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    isPortalAdmin: data === true,
    isLoading,
  };
}
