import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Home, Car, Fuel, Wrench, User } from "lucide-react";

type MainLayoutProps = {
  children: ReactNode;
};

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--color-background)] text-[color:var(--color-primary)]">
      <header className="h-14 flex items-center justify-center bg-[color:var(--color-primary)] text-white shadow-md">
        <h1 className="font-semibold text-lg tracking-tight">App Frota</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-16 px-3 pt-3 max-w-md w-full mx-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
        <div className="max-w-md mx-auto flex justify-between px-4 py-2 text-xs">
          <NavItem to="/" icon={<Home size={20} />} label="Home" />
          <NavItem to="/vehicles" icon={<Car size={20} />} label="Veículos" />
          <NavItem to="/refueling" icon={<Fuel size={20} />} label="Abastecer" />
          <NavItem to="/maintenance" icon={<Wrench size={20} />} label="Manut." />
          <NavItem to="/profile" icon={<User size={20} />} label="Perfil" />
        </div>
      </nav>
    </div>
  );
};

type NavItemProps = {
  to: string;
  icon: ReactNode;
  label: string;
};

const NavItem = ({ to, icon, label }: NavItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        "flex flex-col items-center gap-1 flex-1 py-1",
        isActive
          ? "text-[color:var(--color-primary)] font-semibold"
          : "text-gray-500",
      ].join(" ")
    }
  >
    <span
      className="flex items-center justify-center w-9 h-9 rounded-full border border-transparent"
      style={{
        backgroundColor: "var(--color-accent)",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      {icon}
    </span>
    <span>{label}</span>
  </NavLink>
);

export default MainLayout;
