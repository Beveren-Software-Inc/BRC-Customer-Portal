import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge"; // Import badgeVariants

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = "SAR"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount)
}

// Format currency with dual display (SAR & USD)
export function formatDualCurrency(amount: number, currency: string = 'SAR') {
  const exchangeRate = 3.75; // Fixed SAR to USD rate: 1 USD = 3.75 SAR
  
  // Default to SAR if currency is not provided
  currency = currency || 'SAR';
  
  let primaryValue, primaryFormatted, secondaryValue, secondaryFormatted;
  
  if (currency === 'USD') {
    // Primary is USD, secondary is SAR
    primaryValue = amount;
    secondaryValue = amount * exchangeRate;
    
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(primaryValue);
    
    secondaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SAR",
    }).format(secondaryValue);
  } else {
    // Primary is SAR or other, secondary is USD
    primaryValue = amount;
    secondaryValue = amount / exchangeRate;
    
    primaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(primaryValue);
    
    secondaryFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(secondaryValue);
  }
  
  return {
    primary: {
      value: primaryValue,
      formatted: primaryFormatted,
      currency: currency
    },
    secondary: {
      value: secondaryValue,
      formatted: secondaryFormatted,
      currency: currency === 'USD' ? 'SAR' : 'USD'
    }
  };
}

// Remove the JSX function that was causing the error
// formatDualCurrencyElement should be used in React components directly

export function formatDate(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  // Handle null or undefined values
  if (!dateString) return 'N/A';
  
  try {
    // Parse the date - ERPNext dates are typically in ISO format or YYYY-MM-DD
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    // Default options with timezone handling
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC" // Use UTC as base timezone to ensure consistent display
    };
    
    // Merge provided options with default options
    const formattingOptions = { ...defaultOptions, ...options };
    
    return new Intl.DateTimeFormat("en-US", formattingOptions).format(date);
  } catch (error) {
    console.error(`Error formatting date: ${dateString}`, error);
    return 'Error';
  }
}

// Define the specific variant types based on badgeVariants
type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export function getStatusColor(status: string | null | undefined): BadgeVariant {
  // Handle null or undefined status
  if (!status) return "default";
  
  switch (status.toLowerCase()) {
    case "delivered":
    case "paid":
    case "completed":
    case "accepted":
      return "success"
    case "pending":
      return "warning"
    case "processing":
    case "scheduled":
      return "info"
    case "overdue":
    case "rejected":
    case "cancelled":
      return "destructive"
    case "partially delivered":
      return "secondary"
    case "partially paid":
      return "secondary-purple"
    default:
      return "default"
  }
}

// Format numbers with decimal places
export function formatNumber(number: number, decimals = 2): string {
  return number.toFixed(decimals);
}

// Calculate days remaining or overdue with timezone consideration
export function getDaysRemaining(dueDate: string): number {
  // Create dates using UTC to avoid timezone shifting
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  
  const due = new Date(dueDate);
  const dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  
  const diffTime = dueUTC - todayUTC;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Check if a date is in the past with timezone consideration
export function isPastDue(dueDate: string): boolean {
  // Create dates using UTC to ensure consistent comparison
  const today = new Date();
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  
  const due = new Date(dueDate);
  const dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  
  return dueUTC < todayUTC;
}

// Calculate percentage of total
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

