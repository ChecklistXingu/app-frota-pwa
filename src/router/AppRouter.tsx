import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import AdminLayout from "../components/layout/AdminLayout";
import { useAuth } from "../contexts/AuthContext";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import VehiclesPage from "../pages/Vehicles/VehiclesPage";
import RefuelingPage from "../pages/Refueling/RefuelingPage";
import MaintenancePage from "../pages/Maintenance/MaintenancePage";
import ProfilePage from "../pages/Profile/ProfilePage";
import OnboardingVehiclesPage from "../pages/Vehicles/OnboardingVehiclesPage";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";
import AdminDashboardPage from "../pages/Admin/dashboard/DashboardPage";
import AdminMaintenancePage from "../pages/Admin/AdminMaintenancePage";
import AdminMaintenanceHistoryPage from "../pages/Admin/AdminMaintenanceHistoryPage";
import AdminVehiclesPage from "../pages/Admin/AdminVehiclesPage";
import AdminUsersPage from "../pages/Admin/AdminUsersPage";
import AdminRefuelingPage from "../pages/Admin/AdminRefuelingPage";

const AppRouter = () => {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Rotas do app (motorista) */}
      <Route
        path="/*"
        element={
          <MainLayout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/onboarding/vehicles" element={<OnboardingVehiclesPage />} />
              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/refueling" element={<RefuelingPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MainLayout>
        }
      />

      {/* Rotas do Painel Admin (somente perfil admin) */}
      <Route
        path="/admin/*"
        element={
          profile?.role === "admin" ? (
            <AdminLayout>
              <Routes>
                <Route path="" element={<AdminDashboardPage />} />
                <Route path="maintenance" element={<AdminMaintenancePage />} />
                <Route path="maintenance/history" element={<AdminMaintenanceHistoryPage />} />
                <Route path="refueling" element={<AdminRefuelingPage />} />
                <Route path="vehicles" element={<AdminVehiclesPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Routes>
            </AdminLayout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
    </Routes>
  );
};

export default AppRouter;
