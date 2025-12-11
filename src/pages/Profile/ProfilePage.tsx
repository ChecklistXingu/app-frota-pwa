import { useAuth } from "../../contexts/AuthContext";

const ProfilePage = () => {
  const { user, profile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold">Perfil</h2>

      <div className="space-y-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-medium text-gray-800">Seus dados</p>

        <div className="space-y-2 text-sm text-gray-700">
          <div>
            <p className="text-[11px] uppercase text-gray-500 font-semibold">
              Nome
            </p>
            <p>{profile?.name || "--"}</p>
          </div>

          <div>
            <p className="text-[11px] uppercase text-gray-500 font-semibold">
              E-mail
            </p>
            <p>{user?.email || "--"}</p>
          </div>

          <div className="flex gap-6">
            <div className="flex-1">
              <p className="text-[11px] uppercase text-gray-500 font-semibold">
                Telefone
              </p>
              <p>{profile?.phone || "--"}</p>
            </div>

            <div className="flex-1">
              <p className="text-[11px] uppercase text-gray-500 font-semibold">
                Filial
              </p>
              <p>{profile?.filial || "--"}</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase text-gray-500 font-semibold">
              Perfil
            </p>
            <p>{profile?.role === "admin" ? "Administrador" : "Motorista"}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full rounded-full border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 bg-white"
      >
        Sair do aplicativo
      </button>
    </div>
  );
};

export default ProfilePage;
