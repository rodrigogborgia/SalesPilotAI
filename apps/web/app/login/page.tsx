'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getViewMode } from '../../lib/alphaViewMode';

type LoginResponse = {
  token?: string;
  user?: {
    firstName: string;
    role: string;
  };
  message?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = (await response.json()) as LoginResponse;

      if (!response.ok || !result.token || !result.user) {
        setError(result.message ?? 'No pudimos iniciar sesión. Verifica tus datos.');
        return;
      }

      const viewMode = getViewMode(result.user.firstName, result.user.role);
      window.localStorage.setItem('salespilot_token', result.token);
      window.localStorage.setItem('salespilot_user', JSON.stringify(result.user));
      window.localStorage.setItem('salespilot_view_mode', viewMode);
      router.push(viewMode === 'javier' ? '/dashboard' : '/simulator');
    } catch {
      setError('No se pudo conectar con SalesPilotAI. Intenta nuevamente en unos minutos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#0F172A] text-white lg:grid-cols-2">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-white/10 bg-[#0F172A] p-12 lg:flex xl:p-16">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#1E64FF]/20 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-[#10B981]/10 blur-[120px]" />

        <div className="relative z-10">
          <Image
            src="/SalesPilotAI.jpeg"
            alt="SalesPilotAI"
            width={210}
            height={64}
            priority
            className="h-12 w-auto rounded-md object-contain"
          />
        </div>

        <div className="relative z-10 max-w-xl py-16">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#6EE7B7]">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            Operación comercial inteligente
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Cada conversación,
            <br />
            una oportunidad
            <span className="text-[#1E64FF]"> de crecer.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
            Ventas, atención y post-venta conectadas en un solo sistema para que ningún
            cliente ni oportunidad quede sin seguimiento.
          </p>

          <div className="mt-12 grid max-w-lg grid-cols-3 gap-4">
            <div className="border-l-2 border-[#1E64FF] pl-4">
              <p className="text-2xl font-semibold">24/7</p>
              <p className="mt-1 text-xs text-slate-400">seguimiento operativo</p>
            </div>
            <div className="border-l-2 border-[#10B981] pl-4">
              <p className="text-2xl font-semibold">360°</p>
              <p className="mt-1 text-xs text-slate-400">ciclo del cliente</p>
            </div>
            <div className="border-l-2 border-slate-500 pl-4">
              <p className="text-2xl font-semibold">IA</p>
              <p className="mt-1 text-xs text-slate-400">asistencia consultiva</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} SalesPilotAI · Pro-Aire Industrial
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Image
              src="/SalesPilotAI.jpeg"
              alt="SalesPilotAI"
              width={190}
              height={58}
              priority
              className="h-11 w-auto rounded-md object-contain"
            />
          </div>

          <div className="mb-9">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#10B981]">
              Bienvenido de nuevo
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Inicia sesión</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Ingresa a tu espacio de trabajo de SalesPilotAI.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#1E64FF] focus:ring-2 focus:ring-[#1E64FF]/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#1E64FF] focus:ring-2 focus:ring-[#1E64FF]/20"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-[#1E64FF] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1E64FF]/20 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-[#1E64FF] focus:ring-offset-2 focus:ring-offset-[#0F172A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Ingresando…' : 'Ingresar a SalesPilotAI'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-500">
            Acceso exclusivo para usuarios autorizados de tu organización.
          </p>
        </div>
      </section>
    </main>
  );
}
