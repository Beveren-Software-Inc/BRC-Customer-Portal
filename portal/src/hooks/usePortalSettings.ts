import { useQuery } from '@tanstack/react-query';
import { PortalSettings, getPortalSettings } from '@/lib/api';

/**
 * Custom hook to fetch and use portal settings across the application
 * Provides logo, icon, company name, and other portal configuration
 */
export function usePortalSettings() {
  const { 
    data: settings, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery<PortalSettings | null, Error>({
    queryKey: ['portal-settings'],
    queryFn: () => getPortalSettings(),
    staleTime: 1000 * 60 * 60, // Cache settings for 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2, // Retry failed requests twice
  });

  // Helper function to get full file URL for Frappe file paths
  const getFileUrl = (filePath: string | undefined): string => {
    if (!filePath) return '';
    
    // If path already starts with http, it's already a full URL
    if (filePath.startsWith('http')) {
      return filePath;
    }
    
    // If path starts with /files/ or /private/files/, use as is
    if (filePath.startsWith('/files/') || filePath.startsWith('/private/files/')) {
      return filePath;
    }
    
    // Handle case where Frappe returns just the filename
    if (!filePath.startsWith('/')) {
      return `/files/${filePath}`;
    }
    
    // Otherwise, return the path as is - it might be an asset path
    return filePath;
  };

  // Derived values with proper URL formatting
  const logoUrl = getFileUrl(settings?.portal_logo);
  const iconUrl = getFileUrl(settings?.portal_icon);
  const companyName = settings?.company_name || '';
  const allowDownload = settings?.allow_download_files === 1;
  const downloadFormat = settings?.download_format || '';

  // For debugging
  // console.log('Portal Settings:', {
  //   rawLogo: settings?.portal_logo,
  //   logoUrl,
  //   rawIcon: settings?.portal_icon,
  //   iconUrl
  // });

  return {
    settings,
    isLoading,
    isError,
    error,
    refetch,
    // Derived values
    logoUrl,
    iconUrl,
    companyName,
    allowDownload,
    downloadFormat,
  };
}