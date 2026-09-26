import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../app/providers/AuthProvider';
import { ToastProvider } from '../app/providers/ToastProvider';
import { AppRoutes } from '../app/router';

/** Renders the real route tree at `path` with fresh providers (no retries so failures surface fast). */
export function renderApp(path = '/dashboard') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
