"use client";

import type React from "react";
import { useState, useEffect } from "react";
import Navbar from "./navbar";
import { Menu, X } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FileText,
  Package,
  CreditCard,
  TicketCheck,
  FolderOpen,
  Settings,
  Home,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { ToggleSidebarContext } from "./sidebar";
import styles from "./sidebar.module.css";
// Import the SVG logo as fallbacks
import fullLogo from "@/assets/brc_logo.jpeg";
import logoIcon from "@/assets/brc-icon.png";
// Import our custom portal settings hook
import { usePortalSettings } from "@/hooks/usePortalSettings";
// Import custom hook for checking mobile views
import { useMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useMobile();

  // Use our custom hook to get portal settings
  const { logoUrl, iconUrl } = usePortalSettings();
  const { t, i18n } = useTranslation();

  // Load sidebar state from localStorage on component mount
  useEffect(() => {
    const savedState = localStorage.getItem("sidebar-state");
    if (savedState) {
      setSidebarOpen(savedState === "open");
    }

    // Auto-collapse sidebar on mobile
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebar-state", sidebarOpen ? "open" : "closed");
  }, [sidebarOpen]);

  // Close mobile sidebar when changing routes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  // Menu items definition
  const menuItems = [
    { name: t("Dashboard"), icon: Home, path: "/" },
    { name: t("Sales Orders"), icon: ClipboardList, path: "/sales-orders" },
    { name: t("Delivery Notes"), icon: Package, path: "/delivery-notes" },
    // { name: t("Quotations"), icon: FileText, path: "/quotations" },
    { name: t("Invoices"), icon: BarChart3, path: "/sales-invoices" },
    { name: t("Payments"), icon: CreditCard, path: "/payments" },
    { name: t("Customer Statement"), icon: FileText, path: "/customer-statement" },
    // { name: t("Support Tickets"), icon: TicketCheck, path: "/support-tickets" },
    // { name: t("Documents"), icon: FolderOpen, path: "/documents" },
  ];

  return (
    <ToggleSidebarContext.Provider value={{ toggle: toggleSidebar }}>
      <div className="relative flex" dir={i18n.dir()}>
        {/* Mobile sidebar overlay */}
        {isMobile && mobileSidebarOpen && (
          <div
            className={`${styles.sidebarOverlay} ${
              mobileSidebarOpen ? styles.sidebarOverlayVisible : ""
            }`}
            onClick={() => setMobileSidebarOpen(false)}
          ></div>
        )}

        {/* Custom sidebar implementation */}
        <div
          className={`${styles.sidebarWrapper} ${
            !sidebarOpen && !isMobile ? styles.sidebarWrapperCollapsed : ""
          } 
          ${isMobile && !mobileSidebarOpen ? styles.sidebarHidden : ""}`}
          style={i18n.dir() === 'rtl' ? {left: 'auto', right: 0} : {right: 'auto', left: 0}}
        >
          <div className="flex justify-between items-center px-4 py-3">
            <div className={styles.logoContainer}>
              <Link to="/">
                {/* Always show full logo on mobile sidebar, show icon when desktop sidebar is collapsed */}
                {sidebarOpen || isMobile ? (
                  <img
                    src={logoUrl || fullLogo}
                    alt="SAP Logo"
                    className="h-16 w-auto"
                  />
                ) : (
                  <img
                    src={iconUrl || logoIcon}
                    alt="SAP Icon"
                    className="h-8 w-8 object-contain"
                  />
                )}
              </Link>
            </div>

            {/* Mobile close button */}
            {isMobile && (
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-md hover:bg-accent"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Add separator after logo */}
          <div className="border-t border-border my-2"></div>

          {/* Menu items */}
          <div className="py-4 flex-grow">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.path}
                    className={`flex rounded-md px-3 py-2 ${
                      styles.iconWrapper
                    } ${
                      pathname === item.path
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className={styles.tooltipContainer}>
                      <item.icon className="h-5 w-5" />
                      {!sidebarOpen && !isMobile && (
                        <span className={styles.tooltip}>{item.name}</span>
                      )}
                    </div>
                    <span className={`ml-2 ${styles.sidebarTextContent}`}>
                      {item.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer with Settings and Copyright - positioned at bottom */}
          <div className="mt-auto">
            {/* Settings menu item */}
            <div className="border-t border-border">
              <ul className="space-y-1 px-2 py-2">
                <li>
                  <Link
                    to="/settings"
                    className={`flex rounded-md px-3 py-2 ${
                      styles.iconWrapper
                    } ${
                      pathname === "/settings"
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className={styles.tooltipContainer}>
                      <Settings className="h-5 w-5" />
                      {!sidebarOpen && !isMobile && (
                        <span className={styles.tooltip}>{t("Settings")}</span>
                      )}
                    </div>
                    <span className={`ml-2 ${styles.sidebarTextContent}`}>
                      {t("Settings")}
                    </span>
                  </Link>
                </li>
              </ul>
            </div>

            {/* Separator between Settings and Copyright */}
            <div className="border-t border-border"></div>

            {/* Copyright text */}
            <div
              className={`p-4 text-xs text-gray-500 dark:text-gray-400 ${styles.footerContent}`}
            >
              <div className="flex items-center justify-between">
                <span>© 2025 SAP Software Inc</span>
                <span>v1.0.0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div
          className={`${styles.mainContentWrapper} ${
            !sidebarOpen && !isMobile
              ? styles.mainContentWrapperWithCollapsedSidebar
              : ""
          }`}
        >
          <Navbar isMobile={isMobile} onMenuClick={toggleSidebar} />
          <main className="p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </ToggleSidebarContext.Provider>
  );
}
