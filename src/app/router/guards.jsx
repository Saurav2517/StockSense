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
  const { loading, session, recovery } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  // A password-reset link lands on the Site URL root (Supabase default), so the
  // recovery session may arrive on any route: always finish on the reset page.
  if (recovery) return <Navigate to="/reset-password" replace />;
  return <Outlet />;
}

/** Auth screens: bounce signed-in users to the dashboard. */
export function PublicOnlyRoute() {
  const { loading, session, recovery } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoading />;
  if (session && recovery && location.pathname !== '/reset-password') return <Navigate to="/reset-password" replace />;
  // A recovery session must stay on the reset page.
  if (session && !recovery) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
