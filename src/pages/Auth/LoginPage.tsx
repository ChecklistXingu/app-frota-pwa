import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Truck, Mail, Lock, WifiOff } from "lucide-react";

type LoginForm = {
  email: string;
  password: string;
};

const LoginPage = () => {
  const { register, handleSubmit, formState } = useForm<LoginForm>();
  const { isSubmitting } = formState;
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitora status de conexão
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const onSubmit = async (data: LoginForm) => {
    // Se está offline, mostra mensagem específica
    if (isOffline) {
      setError("Sem conexão com a internet. Conecte-se para fazer login.");
      return;
    }

    try {
      setError(null);
      await login(data.email, data.password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Não foi possível entrar. Verifique e-mail e senha.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d2d6c]">
      {/* Header com logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-8">
        <div className="w-20 h-20 bg-[#ffd300] rounded-full flex items-center justify-center mb-4 shadow-lg">
          <Truck size={40} className="text-[#0d2d6c]" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">App Frota</h1>
        <p className="text-white/70 text-sm">Gestão inteligente de veículos</p>
      </div>

      {/* Card de login */}
      <div className="bg-white rounded-t-[2rem] px-6 pt-8 pb-10 shadow-2xl">
        <div className="max-w-sm mx-auto">
          <h2 className="text-xl font-bold text-[#0d2d6c] mb-1">Bem-vindo de volta!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Acesse sua conta para continuar
          </p>

          {/* Aviso de offline */}
          {isOffline && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
              <WifiOff size={20} className="text-orange-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-700">Sem conexão</p>
                <p className="text-xs text-orange-600">
                  Conecte-se à internet para fazer login pela primeira vez.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">E-mail</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ffd300] focus:ring-2 focus:ring-[#ffd300]/30 transition-all"
                  {...register("email", { required: true })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Senha</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ffd300] focus:ring-2 focus:ring-[#ffd300]/30 transition-all"
                  {...register("password", { required: true })}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-xs text-red-600 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#ffd300] hover:bg-[#e6be00] active:bg-[#ccaa00] text-[#0d2d6c] font-semibold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Ainda não tem conta?{" "}
            <Link to="/register" className="text-[#0d2d6c] font-semibold hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
