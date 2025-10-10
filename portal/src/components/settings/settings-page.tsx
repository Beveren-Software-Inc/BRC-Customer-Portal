"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useTheme } from "next-themes"
import { useAuth } from "@/context/auth-context"
import { useApi } from "@/hooks/useApi"
import { SalesOrder, SalesInvoice } from "@/lib/api"
import { useTranslation } from "react-i18next"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Globe, ChevronDown } from "lucide-react"
import { useCurrencySettings } from "@/context/currency-context"

export default function SettingsPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { t, i18n } = useTranslation()

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  })

  // Define fields to fetch for orders and invoices (including customer_name)
  const salesOrderFields = ["name", "customer", "customer_name"];
  const salesInvoiceFields = ["name", "customer", "customer_name"];

  // Use the centralized useApi hook to fetch data
  const { 
    data: orders = [], 
    isLoading: ordersLoading
  } = useApi("Sales Order", salesOrderFields);

  const {
    data: invoices = [],
    isLoading: invoicesLoading
  } = useApi("Sales Invoice", salesInvoiceFields);

  const { allowSecondCurrency, setAllowSecondCurrency, secondCurrency, setSecondCurrency, exchangeRate, setExchangeRate } = useCurrencySettings();

  // Initialize theme and user profile state
  useEffect(() => {
    // Set profile data from auth context
    setProfile({
      name: user.fullName || "User",
      email: user.email || "",
      phone: user.phone || "",
      company: user.company || "",
    })
  }, [theme, user])

  // Process customer info from orders and invoices to get both code and name
  useEffect(() => {
    // If either data is still loading, wait until both are loaded
    if (ordersLoading || invoicesLoading) return;
    
    // If user already has company info, don't override it
    if (user.company) return;
    
    // Combine all customer info from both orders and invoices
    const customerInfo = new Map<string, string>(); // Map of customer code -> customer name
    
    orders.forEach((order: SalesOrder) => {
      if (order.customer) {
        const customerName = order.customer_name || order.customer;
        customerInfo.set(order.customer, customerName);
      }
    });
    
    invoices.forEach((invoice: SalesInvoice) => {
      if (invoice.customer) {
        const customerName = invoice.customer_name || invoice.customer;
        customerInfo.set(invoice.customer, customerName);
      }
    });
    
    // Update profile with the customer information
    let companyName = ""; 
    if (customerInfo.size === 1) {
      const [customerCode, customerNameOnly] = Array.from(customerInfo.entries())[0];
      companyName = `${customerCode}: ${customerNameOnly}`;
    } else if (customerInfo.size > 1) {
      companyName = "All Customers";
    } else {
      companyName = "Customer";
    }
    
    // Update the profile with the company name
    setProfile(prev => ({
      ...prev,
      company: companyName
    }));
  }, [orders, invoices, ordersLoading, invoicesLoading, user.company])

  const languages = [
    { code: "en", label: "English" },
    { code: "ar", label: "العربية" },
    // Add more languages here if needed
  ];

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("Profile")}</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("Personal Information")}</CardTitle>
          <CardDescription>{t("Your personal information and contact details.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("Full Name")}</Label>
              <div className="p-2 border rounded-md bg-muted/20">{profile.name}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{t("Company Name")}</Label>
              <div className="p-2 border rounded-md bg-muted/20">{profile.company || t("Loading...")}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("Email Address")}</Label>
              <div className="p-2 border rounded-md bg-muted/20">{profile.email}</div>
            </div>
            {profile.phone && (
              <div className="space-y-2">
                <Label htmlFor="phone">{t("Phone Number")}</Label>
                <div className="p-2 border rounded-md bg-muted/20">{profile.phone}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col md:flex-row gap-6 w-full">
        {/* Language Selector Card */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>{t("Language")}</CardTitle>
              <CardDescription>{t("Select your preferred language for the portal interface.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    <span className="font-medium">{languages.find(l => l.code === i18n.language)?.label || "Language"}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {languages.map(lang => (
                    <DropdownMenuItem key={lang.code} onClick={() => i18n.changeLanguage(lang.code)}>
                      {i18n.language === lang.code ? "✓ " : ""}{lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        </div>
        {/* Currency Settings Card */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Currency Display</CardTitle>
              <CardDescription>Configure how amounts are shown in the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSecondCurrency}
                    onChange={e => setAllowSecondCurrency(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600"
                  />
                  <span>Allow Second Currency in Amounts</span>
                </label>
              </div>
              {allowSecondCurrency && (
                <div className="flex flex-col md:flex-row gap-4 items-center mt-2">
                  <div>
                    <label className="block mb-1 font-medium">Second Currency</label>
                    <select
                      value={secondCurrency}
                      onChange={e => setSecondCurrency(e.target.value)}
                      className="border rounded-md px-3 py-2"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="SAR">SAR</option>
                      {/* Add more currencies as needed */}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Exchange Rate</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={exchangeRate}
                      onChange={e => setExchangeRate(Number(e.target.value))}
                      className="border rounded-md px-3 py-2 w-32"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

