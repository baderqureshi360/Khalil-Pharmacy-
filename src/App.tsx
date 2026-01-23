import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RouteErrorBoundaryWrapper } from "@/components/RouteErrorBoundary";
import { ReceiptProvider } from "@/contexts/ReceiptContext";
import { ReceiptContainer } from "@/components/pos/ReceiptContainer";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PointOfSale from "./pages/PointOfSale";
import Products from "./pages/Products";
import StockPurchases from "./pages/StockPurchases";
import SalesReport from "./pages/SalesReport";
import Racks from "./pages/Racks";
import NotFound from "./pages/NotFound";

// Configure QueryClient with error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ReceiptProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route 
                path="/auth" 
                element={
                  <RouteErrorBoundaryWrapper>
                    <Auth />
                  </RouteErrorBoundaryWrapper>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <Index />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/pos" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <PointOfSale />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/products" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <Products />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/purchases" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <StockPurchases />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/sales" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <SalesReport />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/racks" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <Racks />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="*" 
                element={
                  <ProtectedRoute>
                    <RouteErrorBoundaryWrapper>
                      <NotFound />
                    </RouteErrorBoundaryWrapper>
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </BrowserRouter>
          {/* Receipt container rendered outside all layouts for printing */}
          <ReceiptContainer />
        </TooltipProvider>
      </ReceiptProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
