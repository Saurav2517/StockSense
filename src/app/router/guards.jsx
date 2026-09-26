import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingBlock } from '../../components/ui/Feedback';

function FullPageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingBlock label="Loading StockSense…" />
    </div>
  );
}

/** Requires a signed-in session. */
export function ProtectedRoute() {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Auth screens: bounce signed-in users to the dashboard. */
export function PublicOnlyRoute() {
  const { loading, session, recovery } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  // A recovery session must stay on the reset page.
  if (session && !(recovery && location.pathname === '/reset-password')) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
