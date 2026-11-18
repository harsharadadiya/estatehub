// All pages. Each page is lazy loaded (React.lazy), so the browser downloads only what it needs.
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/common/ProtectedRoute';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import PageLoader from '@/components/common/PageLoader';
import { features } from '@/lib/features';

const HomePage = lazy(() => import('@/pages/HomePage'));
const PropertiesPage = lazy(() => import('@/pages/PropertiesPage'));
const PropertyDetailPage = lazy(() => import('@/pages/PropertyDetailPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const GuestAppointmentPage = lazy(() => import('@/pages/GuestAppointmentPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'));
const OverviewPage = lazy(() => import('@/pages/dashboard/OverviewPage'));
const MyListingsPage = lazy(() => import('@/pages/dashboard/MyListingsPage'));
const ListingEditorPage = lazy(() => import('@/pages/dashboard/ListingEditorPage'));
const MyAppointmentsPage = lazy(() => import('@/pages/dashboard/MyAppointmentsPage'));
const RequestsPage = lazy(() => import('@/pages/dashboard/RequestsPage'));
const ProfilePage = lazy(() => import('@/pages/dashboard/ProfilePage'));
// Optional bonus module – not even downloaded when the feature flag is off
const AiHubPage = features.aiHub ? lazy(() => import('@/pages/AiHubPage')) : null;

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="properties" element={<PropertiesPage />} />
            <Route path="properties/:id" element={<PropertyDetailPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="appointments/:id/manage" element={<GuestAppointmentPage />} />
            {AiHubPage && <Route path="ai-hub" element={<AiHubPage />} />}

            {/* Logged-in users only */}
            <Route element={<ProtectedRoute />}>
              <Route path="dashboard" element={<DashboardLayout />}>
                <Route index element={<OverviewPage />} />
                <Route path="listings" element={<MyListingsPage />} />
                <Route path="listings/new" element={<ListingEditorPage />} />
                <Route path="listings/:id/edit" element={<ListingEditorPage />} />
                <Route path="appointments" element={<MyAppointmentsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
