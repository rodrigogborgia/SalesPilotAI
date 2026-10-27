'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ENABLE_SOFIA_CHAT, getViewMode } from '../lib/alphaViewMode';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const steps = [
  { label: '1. WhatsApp Inbound & Bot', href: '/simulator?module=copilot&demo=1' },
  { label: '2. Derivación & Minuta David', href: '/simulator?module=copilot&demo=2' },
  { label: '3. Outbound & Horómetros Luciana', href: '/simulator?module=maintenance&demo=3' },
  { label: '4. Métricas Gerenciales Javier', href: '/dashboard?demo=4' },
  { label: '5. Portal Cliente "Mi Planta"', href: '/portal?demo=5' },
  { label: '6. Admin Sync Meta Ads', href: '/admin?demo=6' }
].filter((step) => ENABLE_SOFIA_CHAT || !step.href.includes('module=copilot'));

type DemoLoginResponse = {
  token?: string;
  user?: { id: string; firstName: string; lastName?: string | null; email: string; role: string };
  message?: string;
};

export default function DemoTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  async function ensureDemoSession() {
    const savedToken = window.localStorage.getItem('salespilot_token');
    if (savedToken) {
      const sessionResponse = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (sessionResponse.ok) return;
    }

    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@pro-aire.com', password: 'demo123' })
    });
    const result = (await response.json()) as DemoLoginResponse;
    if (!response.ok || !result.token || !result.user) {
      throw new Error(result.message ?? 'No se pudo iniciar la sesión de demostración.');
    }

    window.localStorage.setItem('salespilot_token', result.token);
    window.localStorage.setItem('salespilot_user', JSON.stringify(result.user));
    window.localStorage.setItem('salespilot_view_mode', getViewMode(result.user.firstName, result.user.role));
    window.dispatchEvent(new Event('salespilot:auth-changed'));
  }

  async function navigateTo(href: string) {
    if (isStarting) return;
    setIsStarting(true);
    setError('');
    try {
      await ensureDemoSession();
      setIsOpen(false);
      const target = new URL(href, window.location.origin);
      const detail = {
        module: target.searchParams.get('module'),
        demo: target.searchParams.get('demo')
      };
      if (target.pathname === pathname) {
        window.dispatchEvent(new CustomEvent('salespilot:navigate-demo', { detail }));
      }
      router.push(`${target.pathname}${target.search}`);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar la demo.');
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => {
          setError('');
          setIsOpen((open) => !open);
        }}
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60"
      >
        <span aria-hidden="true">▶</span> {isStarting ? 'Iniciando…' : 'Demo Mode'}
      </button>
      {isOpen && (
        <nav aria-label="Pasos de la demo" role="menu" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Recorrido para Javier</p>
          <button
            type="button"
            role="menuitem"
            disabled={isStarting}
            onClick={() => void navigateTo(steps[0].href)}
            className="mb-1 w-full rounded-lg bg-blue-600 px-3 py-2.5 text-left text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Iniciar demo guiada
          </button>
          {steps.map((step) => (
            <button
              key={step.label}
              type="button"
              role="menuitem"
              disabled={isStarting}
              onClick={() => void navigateTo(step.href)}
              className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {step.label}
            </button>
          ))}
          {error && <p role="alert" className="m-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">{error}</p>}
        </nav>
      )}
    </div>
  );
}
