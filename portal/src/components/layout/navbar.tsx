"use client";

import { ChevronDown, Settings, PanelLeft, LogOut, LayoutGrid, Menu, Globe, RefreshCw, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToggleSidebar } from "./sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { useCustomer } from "@/context/customer-context";
import { endPortalUsageSession } from "@/hooks/usePortalAnalytics";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface NavbarProps {
  isMobile?: boolean;
  onMenuClick?: () => void;
}

export default function Navbar({ isMobile = false, onMenuClick }: NavbarProps) {
  const { toggle } = useToggleSidebar();
  const { user, logout } = useAuth();
  const { customerDisplayName, canSwitchCustomer, customers, activeCustomer, switchCustomer, showDeskNavigation } = useCustomer();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const handleToggle = () => {
    if (isMobile && onMenuClick) {
      onMenuClick();
    } else if (toggle) {
      toggle();
    } else {
      console.error("Toggle function is undefined");
    }
  };

  const handleLogout = async () => {
    try {
      endPortalUsageSession();
      // Call the Frappe logout endpoint first
      const response = await fetch('/api/method/logout', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include' // Important to include cookies
      });
      
      if (!response.ok) {
        throw new Error(`Logout failed with status: ${response.status}`);
      }
      
      // Then call the auth context logout function
      await logout();
      
      // Finally redirect to root
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      // Still redirect even if there was an error
      window.location.href = "/login";
    }
  };
  
  const handleAppsRedirect = () => {
    window.location.href = "/apps";
  };

  const handleClearCache = async () => {
    try {
      // Clear server-side cache
      await fetch('/api/method/sap_customer_portal.api.customer_balance.clear_customer_cache');
      
      // Clear React Query cache
      queryClient.clear();
      
      // Show success message
      toast({
        title: t("Cache Cleared"),
        description: "All cached data has been cleared. Data will be refreshed on next page load.",
        duration: 3000,
      });
      
      // Optionally refresh the page to show fresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast({
        variant: "destructive",
        title: t("Cache Clear Failed"),
        description: "Failed to clear cache. Please try again.",
        duration: 3000,
      });
    }
  };

  // Use defensive programming to handle potential missing user info
  const userInitials = user?.initials || "U";
  const userFullName = user?.fullName || "User";

  const activeCustomerLabel = (() => {
    if (activeCustomer && customers.length > 0) {
      const match = customers.find((item) => item.customer === activeCustomer);
      if (match) {
        return `${match.customer}: ${match.customer_name}`;
      }
    }
    if (customerDisplayName && customerDisplayName !== "Customer") {
      return customerDisplayName;
    }
    return activeCustomer;
  })();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleToggle} 
              className="h-9 w-9 mr-2"
              aria-label={isMobile ? "Open menu" : "Toggle sidebar"}
            >
              {isMobile ? (
                <Menu className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <h1 className="text-lg font-semibold shrink-0 sm:text-xl">
                {t("Customer Portal")}
              </h1>
              {activeCustomerLabel && (
                <span
                  className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs sm:text-sm font-medium text-foreground max-w-[140px] sm:max-w-xs truncate"
                  title={activeCustomerLabel}
                >
                  {activeCustomerLabel}
                </span>
              )}
              {canSwitchCustomer && customers.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1 shrink-0">
                      <Building2 className="h-4 w-4" />
                      <span className="hidden sm:inline">{t("Switch Customer")}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>{t("Select Customer")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {customers.map((item) => (
                      <DropdownMenuItem
                        key={item.customer}
                        onClick={async () => {
                          if (item.customer !== activeCustomer) {
                            try {
                              await switchCustomer(item.customer);
                            } catch (error) {
                              toast({
                                variant: "destructive",
                                title: t("Switch Failed"),
                                description:
                                  error instanceof Error
                                    ? error.message
                                    : t("Could not switch customer. Please try again."),
                                duration: 5000,
                              });
                            }
                          }
                        }}
                      >
                        {item.customer === activeCustomer ? "✓ " : ""}
                        {item.customer}: {item.customer_name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="flex items-center ml-auto gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-1" aria-label="Change language">
                  <Globe className="h-5 w-5" />
                  <span className="hidden md:inline font-medium">{i18n.language === "ar" ? "العربية" : "English"}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>{i18n.language === "en" ? "✓ " : ""}English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage("ar")}>{i18n.language === "ar" ? "✓ " : ""}العربية</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 ml-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="items-center hidden md:flex">
                    <span className="mr-2 max-w-[100px] truncate">{userFullName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("My Account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {showDeskNavigation && (
                  <DropdownMenuItem onClick={handleAppsRedirect}>
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    <span>{t("Apps")}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t("Settings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearCache}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  <span>{t("Clear Cache")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("Logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
