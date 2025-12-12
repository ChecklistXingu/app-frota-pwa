import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wrench, Car, Users, LogOut, Fuel } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen grid grid-rows-[56px_1fr] lg:grid-rows-[1fr] lg:grid-cols-[240px_1fr] bg-gray-50 text-[#0d2d6c]">
      <header className="h-14 lg:hidden flex items-center justify-between px-4 bg-[#0d2d6c] text-white shadow">
        <h1 className="font-semibold">Painel Frota</h1>
        <button onClick={() => logout()} className="text-white/90 hover:text-white flex items-center gap-2 text-sm">
          <LogOut size={16} /> Sair
        </button>
      </header>

      <aside className="hidden lg:flex flex-col bg-white border-r">
        <div className="h-16 flex items-center px-4 border-b">
          <span className="font-bold">Painel Frota</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavItem to="/admin/maintenance" icon={<Wrench size={18} />} label="Manutenções" />
          <NavItem to="/admin/refueling" icon={<Fuel size={18} />} label="Abastecimentos" />
          <NavItem to="/admin/vehicles" icon={<Car size={18} />} label="Veículos" />
          <NavItem to="/admin/users" icon={<Users size={18} />} label="Usuários" />
        </nav>
        <div className="border-t p-3 text-sm text-gray-600">
          <p className="font-semibold">{profile?.name}</p>
          <button onClick={() => logout()} className="mt-2 text-[#0d2d6c] hover:underline">Sair</button>
        </div>
      </aside>

      <main className="p-4 lg:p-6 max-w-[1400px] w-full mx-auto">{children}</main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-md mx-auto flex justify-between px-4 py-2 text-xs">
          <NavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Home" />
          <NavItem to="/admin/maintenance" icon={<Wrench size={18} />} label="Manut." />
          <NavItem to="/admin/refueling" icon={<Fuel size={18} />} label="Abast." />
          <NavItem to="/admin/vehicles" icon={<Car size={18} />} label="Veículos" />
          <NavItem to="/admin/users" icon={<Users size={18} />} label="Usuários" />
        </div>
      </nav>
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        isActive ? "bg-[#ffd300]/20 text-[#0d2d6c] font-semibold" : "text-gray-600 hover:bg-gray-50",
      ].join(" ")
    }
    end
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default AdminLayout;
