import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { ProtectedRoute, PublicOnlyRoute } from './guards';

import { LoginPage } from '../../pages/auth/LoginPage';
import { SignUpPage } from '../../pages/auth/SignUpPage';
import { ForgotPasswordPage } from '../../pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../../pages/auth/ResetPasswordPage';

import { DashboardPage } from '../../pages/dashboard/DashboardPage';
import { OperationsOverviewPage } from '../../pages/operations/OperationsOverviewPage';
import { OperationsListPage } from '../../pages/operations/OperationsListPage';
import { OperationDetailPage } from '../../pages/operations/OperationDetailPage';
import { OperationFormPage } from '../../pages/operations/OperationFormPage';
import { ProductsPage } from '../../pages/products/ProductsPage';
import { StockPage } from '../../pages/stock/StockPage';
import { MoveHistoryPage } from '../../pages/move-history/MoveHistoryPage';
import { WarehousesPage } from '../../pages/settings/WarehousesPage';
import { LocationsPage } from '../../pages/settings/LocationsPage';
import { ContactsPage } from '../../pages/settings/ContactsPage';
import { ProfilePage } from '../../pages/profile/ProfilePage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { OPERATION_LIST } from '../../utils/operations';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/operations" element={<OperationsOverviewPage />} />

          {OPERATION_LIST.map((cfg) => (
            <Route key={cfg.type} path={cfg.path}>
              <Route index element={<OperationsListPage type={cfg.type} />} />
              <Route path="new" element={<OperationFormPage type={cfg.type} />} />
              <Route path=":id" element={<OperationDetailPage type={cfg.type} />} />
              <Route path=":id/edit" element={<OperationFormPage type={cfg.type} />} />
            </Route>
          ))}

          <Route path="/products" element={<ProductsPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/move-history" element={<MoveHistoryPage />} />

          <Route path="/settings" element={<Navigate to="/settings/warehouses" replace />} />
          <Route path="/settings/warehouses" element={<WarehousesPage />} />
          <Route path="/settings/locations" element={<LocationsPage />} />
          <Route path="/settings/contacts" element={<ContactsPage />} />

          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
