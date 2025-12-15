import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wrench, Car, Users, LogOut, Fuel, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import FolhaAzul from "../../assets/folha azul.png";

const AdminLayout = ({ children }: { children: ReactNode }) => {
  const { logout, profile } = useAuth();

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[#0a1633]">
      <header className="bg-[#00205b] text-white shadow-lg">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <img src={FolhaAzul} alt="Logotipo Xingu" className="h-9 w-9 object-contain" />
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

      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 pt-6 pb-20 lg:pb-6 flex flex-col gap-6 lg:flex-row">
        <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col rounded-3xl bg-white pt-8 pb-6 shadow-[0_20px_45px_rgba(0,32,91,0.12)] border border-[#e4e7ec]">
          <div className="flex flex-col items-center px-6 text-center gap-3 pb-6 border-b border-[#edf0f6]">
            <img src={FolhaAzul} alt="Logotipo Xingu" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-sm font-semibold text-[#00205b]">Xingu Máquinas</p>
              <p className="text-xs text-gray-500">Gestão de Frotas</p>
            </div>
          </div>
          <nav className="flex-1 w-full px-4 py-6 space-y-1">
            <SideNavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <SideNavItem to="/admin/maintenance" icon={<Wrench size={18} />} label="Manutenções" />
            <SideNavItem to="/admin/refueling" icon={<Fuel size={18} />} label="Abastecimentos" />
            <SideNavItem to="/admin/vehicles" icon={<Car size={18} />} label="Veículos" />
            <SideNavItem to="/admin/users" icon={<Users size={18} />} label="Usuários" />
          </nav>
          <div className="border-t border-[#edf0f6] px-6 pt-4 text-sm text-gray-500 space-y-2">
            <p className="font-semibold text-[#00205b]">{profile?.name}</p>
            <p className="text-xs text-gray-500">Administrador</p>
            <button onClick={() => logout()} className="text-sm text-[#00205b] font-medium hover:underline">
              Encerrar sessão
            </button>
          </div>
        </aside>

        <main className="flex-1 w-full">
          <div className="rounded-[32px] bg-white/80 p-4 sm:p-6 shadow-[0_25px_60px_rgba(15,23,42,0.07)] border border-white">
            {children}
          </div>
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[#e4e7ec] shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="w-full overflow-x-auto no-scrollbar">
          <div className="min-w-max flex justify-start px-2 py-2 text-xs text-[#00205b]">
            <div className="px-2">
              <BottomNavItem to="/admin" icon={<LayoutDashboard size={20} />} label="Home" />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/maintenance" icon={<Wrench size={20} />} label="Manutenções" />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/refueling" icon={<Fuel size={20} />} label="Abastecimentos" />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/vehicles" icon={<Car size={20} />} label="Veículos" />
            </div>
            <div className="px-2">
              <BottomNavItem to="/admin/users" icon={<Users size={20} />} label="Usuários" />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};
const SideNavItem = ({ to, icon, label }: { to: string; icon: ReactNode; label: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition w-full",
        isActive
          ? "bg-[#00205b]/10 text-[#00205b] font-semibold shadow-sm"
          : "text-gray-600 hover:bg-[#f5f7fb]",
      ].join(" ")
    }
    end
  >
    <span className="flex items-center gap-3">
      <span className="text-[#00205b]">{icon}</span>
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
          ? "bg-[#00205b]/10 text-[#00205b] font-semibold shadow-sm"
          : "text-gray-500 hover:bg-[#f3f6ff]",
      ].join(" ")
    }
    end
  >
    <div className="flex-shrink-0">{icon}</div>
    <span className="text-xs leading-tight">{label}</span>
  </NavLink>
);

export default AdminLayout;
