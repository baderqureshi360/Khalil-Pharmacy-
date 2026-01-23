import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

/**
 * Protected Route - Owner-only access
 * 
 * In this owner-only system, ALL routes require authentication.
 * Unauthenticated users are redirected to login.
 */
export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isOwner } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Owner-only system: ALL routes require authentication
  if (!user || !isOwner) {
    return <Navigate to="/auth" replace />;
  }

  // requireAdmin is legacy - in owner-only system, all authenticated users are owners
  if (requireAdmin && !isOwner) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
