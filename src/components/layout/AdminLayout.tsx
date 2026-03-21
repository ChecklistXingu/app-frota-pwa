import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wrench, Car, Users, LogOut, Fuel, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import LogoApp from "../../assets/logo app (2).png";
import VirtualAssistant from "../../assistant/VirtualAssistant";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen bg-[#F0F2F7] text-[#0a1633]">
      <header className="bg-[#0d2d6c] text-white shadow-lg">
        <div className="max-w-[1800px] mx-auto flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <img src={LogoApp} alt="Logotipo Xingu" className="h-9 w-9 object-contain rounded-full" />
              <div className="text-xs uppercase tracking-[0.2em] text-white/70">Sistema de Gestão</div>
            </div>
            <div>
              <p className="text-sm text-white/80">Painel Administrativo</p>
              <h1 className="text-xl font-semibold">Painel de Gestão – Frota Xingu</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-white/70">v2.0</span>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <RefreshCw size={16} /> Atualizar dados
            </button>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-white hover:bg-white/25 transition"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto px-2 lg:px-3 pt-6 pb-20 lg:pb-6 flex flex-col gap-3 lg:flex-row lg:gap-3">
        <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col bg-[#0d2d6c] pt-6 pb-4 h-screen sticky top-0">
          <div className="flex flex-col items-center px-6 text-center gap-3 pb-5 border-b border-white/10">
            <img src={LogoApp} alt="Logotipo Xingu" className="h-20 w-auto object-contain" />
            <div>
              <p className="text-sm font-semibold text-white">Xingu Máquinas</p>
              <p className="text-xs text-white/60">Gestão de Frotas</p>
            </div>
          </div>
          <nav className="flex-1 w-full px-2 py-4 space-y-0.5">
            <SideNavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <SideNavItem to="/admin/maintenance" icon={<Wrench size={18} />} label="Manutenções" />
            <SideNavItem to="/admin/maintenance/history" icon={<Wrench size={18} />} label="Histórico de Manutenções" />
            <SideNavItem to="/admin/refueling" icon={<Fuel size={18} />} label="Abastecimentos" />
            <SideNavItem to="/admin/refueling/history" icon={<Fuel size={18} />} label="Histórico de Abastecimentos" />
            <SideNavItem to="/admin/vehicles" icon={<Car size={18} />} label="Veículos" />
            <SideNavItem to="/admin/users" icon={<Users size={18} />} label="Usuários" />
          </nav>
          <div className="border-t border-white/10 px-4 pt-4 text-sm space-y-1.5">
            <p className="font-semibold text-white">{profile?.name}</p>
            <p className="text-xs text-white/60">Administrador</p>
            <button onClick={() => logout()} className="text-sm text-white/70 font-medium hover:text-white transition">
              Encerrar sessão
            </button>
          </div>
        </aside>

        <main className="flex-1 w-full">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            {children}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#e4e7ec] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="w-full overflow-x-auto no-scrollbar">
          <div className="min-w-max flex justify-start px-2 py-2 text-xs text-[#0d2d6c]">
            <div className="px-2">
              <BottomNavItem to="/admin" icon={<LayoutDashboard size={20} />} label="Home" />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/maintenance" icon={<Wrench size={20} />} label="Manut." />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/maintenance/history" icon={<Wrench size={20} />} label="Hist. Man." />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/refueling" icon={<Fuel size={20} />} label="Abast." />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/refueling/history" icon={<Fuel size={20} />} label="Hist. Abast." />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/vehicles" icon={<Car size={20} />} label="Veíc." />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/users" icon={<Users size={20} />} label="Usuár." />
            </div>
          </div>
        </div>
      </nav>
      <VirtualAssistant />
    </div>
  );
};
const SideNavItem = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex items-center gap-3 rounded-lg px-3 py-2.5 mx-1 text-sm transition w-[calc(100%-8px)]",
        isActive
          ? "bg-white/15 text-white font-medium"
          : "text-white/60 hover:bg-white/8 hover:text-white/90",
      ].join(" ")
    }
    end
  >
    <span className="flex items-center gap-3">
      {icon}
      <span>{label}</span>
    </span>
  </NavLink>
);

const BottomNavItem = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex flex-col items-center justify-center gap-1 rounded-xl p-2 transition w-16 text-center",
        isActive
          ? "bg-[#0d2d6c]/10 text-[#0d2d6c] font-semibold"
          : "text-gray-500 hover:bg-[#0d2d6c]/5",
      ].join(" ")
    }
    end
  >
    <div className="flex-shrink-0">{icon}</div>
    <span className="text-xs leading-tight">{label}</span>
  </NavLink>
);

export default AdminLayout;
