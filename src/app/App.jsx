import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AuthProvider } from './providers/AuthProvider';
import { ToastProvider } from './providers/ToastProvider';
import { AppRoutes } from './router';
import { isSupabaseConfigured } from '../lib/supabase';
import { SetupRequiredPage } from '../pages/SetupRequiredPage';

export default function App() {
  if (!isSupabaseConfigured) return <SetupRequiredPage />;
  return (
    <QueryProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryProvider>
  );
}
