import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type RegisterForm = {
  name: string;
  phone: string;
  filial: string;
  email: string;
  password: string;
};

const RegisterPage = () => {
  const { register: registerField, handleSubmit, formState } =
    useForm<RegisterForm>();
  const { isSubmitting } = formState;
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      await register({
        name: data.name,
        phone: data.phone,
        filial: data.filial,
        email: data.email,
        password: data.password,
      });
      navigate("/onboarding/vehicles");
    } catch (err) {
      console.error(err);
      setError("Não foi possível criar a conta. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[color:var(--color-background)] text-[color:var(--color-primary)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-sm text-gray-600">
            Preencha seus dados básicos. Depois vamos cadastrar os veículos.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("name", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Telefone</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("phone", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Filial</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("filial", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">E-mail</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("email", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("password", { required: true, minLength: 6 })}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600">
          Já tem conta?{' '}
          <Link to="/login" className="underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
