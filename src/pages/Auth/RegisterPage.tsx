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
  const {
    register: registerField,
    handleSubmit,
    formState,
    setValue,
  } = useForm<RegisterForm>();
  const { isSubmitting } = formState;
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    if (digits.length <= 2) return digits;
    if (digits.length <= 3) return `${digits.slice(0, 2)} ${digits.slice(2)}`;

    const ddd = digits.slice(0, 2);
    const nine = digits.slice(2, 3);
    const part1 = digits.slice(3, 7);
    const part2 = digits.slice(7, 11);

    let formatted = `${ddd} ${nine}`;
    if (part1) formatted += ` ${part1}`;
    if (part2) formatted += `-${part2}`;

    return formatted;
  };

  const handlePhoneChange = (e: any) => {
    const raw = e.target.value as string;
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    const formatted = formatPhone(raw);

    setPhoneDisplay(formatted);
    setValue("phone", digits, { shouldValidate: true });
  };

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

  const phoneRegister = registerField("phone", {
    required: true,
    validate: (value) =>
      value.replace(/\D/g, "").length === 11 ||
      "Telefone deve ter 11 dígitos (ex: 66 9 9999-9999)",
  });

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
              type="tel"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...phoneRegister}
              value={phoneDisplay}
              onChange={handlePhoneChange}
              placeholder="66 9 9999-9999"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Filial</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] bg-white"
              {...registerField("filial", { required: true })}
            >
              <option value="">Selecione a filial</option>
              <option value="Água Boa">Água Boa</option>
              <option value="Querência">Querência</option>
              <option value="Canarana">Canarana</option>
              <option value="Confresa">Confresa</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">E-mail</label>
              <span className="text-xs text-gray-500">Corporativo ou Pessoal</span>
            </div>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]"
              {...registerField("email", { required: true })}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Senha</label>
              <span className="text-xs text-gray-500">Senha pré-definida: primeiros 6 dígitos do CPF</span>
            </div>
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
