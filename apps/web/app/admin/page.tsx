'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import DemoTour from '../../components/DemoTour';
import ThemeToggle from '../../components/ThemeToggle';

type AudienceEntry = {
  id: string;
  email: string;
  capturedByName: string;
  tags: unknown;
  updatedAt: string;
  customer: { companyName: string | null; fullName: string };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [entries, setEntries] = useState<AudienceEntry[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('salespilot_token') ?? '';
    const savedUser = localStorage.getItem('salespilot_user');
    setToken(savedToken);
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as { role?: string };
        setAuthorized(user.role === 'OWNER' || user.role === 'ADMIN');
      } catch {
        setAuthorized(false);
      }
    }
  }, []);

  useEffect(() => {
    if (token && authorized) void loadAudiences();
  }, [token, authorized]);

  async function loadAudiences() {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/audiences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as { count?: number; entries?: AudienceEntry[]; message?: string };
      if (!response.ok || !Array.isArray(result.entries)) {
        throw new Error(result.message ?? 'No se pudo cargar la audiencia.');
      }
      setEntries(result.entries);
      setCount(result.count ?? result.entries.length);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la audiencia.');
    }
  }

  async function syncAudience() {
    setIsSyncing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/audiences/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as { count?: number; message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo preparar la sincronización.');
      setNotice(result.message ?? `Audiencia preparada: ${result.count ?? 0} contactos.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'No se pudo preparar la sincronización.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function exportAudience() {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/audiences/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? 'No se pudo exportar la audiencia.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'salespilot-meta-audience.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar la audiencia.');
    }
  }

  return (
    <main className="min-h-screen bg-[#F1F4F9] text-[#172033] dark:bg-[#0b1220] dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">Meta Audiences & Growth</span>
          </Link>
          <div className="flex items-center gap-2">
            <DemoTour />
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm font-semibold text-[#1E64FF]">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1300px] p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#1E64FF]">Administración · OWNER / ADMIN</p>
            <h1 className="mt-1 text-3xl font-bold">Meta Audiences & Growth</h1>
            <p className="mt-1 text-sm text-slate-500">Contactos consentidos para segmentación comercial y campañas de servicio.</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <p className="text-xs font-semibold uppercase tracking-wide">Audiencias disponibles</p>
            <p className="mt-1 text-3xl font-bold">{count}</p>
          </div>
        </div>

        {!token && <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Inicia sesión como Javier (OWNER) o ADMIN para continuar.</p>}
        {token && !authorized && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Acceso restringido: esta consola requiere rol OWNER o ADMIN.</p>}
        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold">Activación de audiencias comerciales</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                El email corporativo se etiqueta por intención y horómetro. La segmentación permite excluir clientes ya ganados de campañas de adquisición y priorizar remarketing relevante, ayudando a reducir el costo por lead (CPL). El impacto es una expectativa de campaña, no una métrica atribuida hasta conectar Meta Ads.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void syncAudience()}
              disabled={!authorized || isSyncing}
              className="rounded-xl bg-[#1E64FF] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-50"
            >
              {isSyncing ? 'Preparando…' : '🔄 Sincronizar / Exportar Audiencia a Meta Ads'}
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Impacto esperado: menor costo por lead con mejor segmentación</span>
            <button type="button" onClick={() => void exportAudience()} disabled={!authorized} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Descargar CSV</button>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="font-bold">Emails capturados por Luciana y David</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Capturado por</th><th className="px-5 py-3">Etiquetas</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-4 font-semibold">{entry.customer.companyName ?? entry.customer.fullName}</td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{entry.email}</td>
                    <td className="px-5 py-4">{entry.capturedByName}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {(Array.isArray(entry.tags) ? entry.tags : []).map((tag) => (
                          <span key={String(tag)} className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">{String(tag)}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!entries.length && <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">Todavía no hay emails capturados.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
