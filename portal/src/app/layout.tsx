"use client"

import type React from "react"
import "./globals.css"
import MainLayout from "@/components/layout/main-layout"
import { ThemeProvider } from "@/components/theme-provider"
import { CurrencyProvider } from "@/context/currency-context"
import '@/app/globals.css'; 

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body> 
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme"> 
          <CurrencyProvider>
            <MainLayout>{children}</MainLayout>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}