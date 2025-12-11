import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../components/layout/MainLayout";
import { useAuth } from "../contexts/AuthContext";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import VehiclesPage from "../pages/Vehicles/VehiclesPage";
import RefuelingPage from "../pages/Refueling/RefuelingPage";
import MaintenancePage from "../pages/Maintenance/MaintenancePage";
import ProfilePage from "../pages/Profile/ProfilePage";
import OnboardingVehiclesPage from "../pages/Vehicles/OnboardingVehiclesPage";
import LoginPage from "../pages/Auth/LoginPage";
import RegisterPage from "../pages/Auth/RegisterPage";

const AppRouter = () => {
  const { user, loading } = useAuth();

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
  );
};

export default AppRouter;
