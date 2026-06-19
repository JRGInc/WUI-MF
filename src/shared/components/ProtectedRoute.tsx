import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { LoadingScreen } from './LoadingScreen';

/**
 * Gate for authenticated routes. While the auth state is resolving we show the
 * full-screen loader; once resolved, an unauthenticated user is redirected to
 * /login (preserving the attempted location so Login can send them back).
 */
export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
