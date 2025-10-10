import "./i18n";
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./styles/globals.css"
import "./styles/tooltip-styles.css"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "./components/theme-provider"
import { CurrencyProvider } from "./context/currency-context"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query' // Import React Query client
import { CurrencySettingsProvider } from "./context/currency-context"

// Create a client
const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <BrowserRouter>
          <CurrencySettingsProvider>
            <CurrencyProvider>
              <App />
            </CurrencyProvider>
          </CurrencySettingsProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
