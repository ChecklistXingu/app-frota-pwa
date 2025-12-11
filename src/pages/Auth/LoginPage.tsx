import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

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

  const onSubmit = async (data: LoginForm) => {
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[color:var(--color-background)] text-[color:var(--color-primary)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-sm text-gray-600">
            Acesse o App Frota com seu e-mail e senha.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...register("email", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...register("password", { required: true })}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          Ainda não tem conta?{' '}
          <Link to="/register" className="underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
