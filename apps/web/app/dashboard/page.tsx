'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import DemoTour from '../../components/DemoTour';
import ThemeToggle from '../../components/ThemeToggle';
import {
  type ManualFollowUp
} from '../../lib/manualFollowUps';

type DashboardData = {
  rangeDays: number;
  budgetCount: number;
  issuedAmount: number;
  wonCount: number;
  wonAmount: number;
  minuteCount: number;
  minutesByOwner: Array<{ name: string; count: number }>;
  criticalEquipmentCount: number;
  lossReasons: Array<{ reason: string; count: number }>;
  autonomousFollowUpCount: number;
  autonomousFollowUps: Array<{ id: string; dayNumber: number; message: string; processedAt: string | null }>;
  derivationCount: number;
  derivations: Array<{ id: string; refCode: string; summary: string | null; createdAt: string }>;
  orderExportCount: number;
  orderExports: Array<{ id: string; budgetId: string; exportedAt: string }>;
  previousPeriod: {
    autonomousFollowUpCount: number;
    derivationCount: number;
    orderExportCount: number;
  } | null;
  budgets: Array<{
    id: string;
    status: string;
    amount: string | number;
    customer: { companyName: string | null; fullName: string };
    motivoPerdida: string | null;
  }>;
  minutes: Array<{
    id: string;
    createdAt: string;
    transcript: string | null;
    user: { firstName: string } | null;
    customer: { companyName: string | null; fullName: string };
    installedEquipment: { model: string };
  }>;
  criticalEquipment: Array<{
    id: string;
    model: string;
    serialNumber: string;
    currentHours: string | number;
    customer: { companyName: string | null; fullName: string };
  }>;
};

type Drilldown = 'budgets' | 'minutes' | 'equipment' | 'losses' | 'follow-ups' | 'derivations' | 'exports';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [token, setToken] = useState('');
  const [mounted, setMounted] = useState(false);
  const [days, setDays] = useState('30');
  const [data, setData] = useState<DashboardData | null>(null);
  const [drilldown, setDrilldown] = useState<Drilldown | null>(null);
  const [error, setError] = useState('');
  const [manualFollowUps, setManualFollowUps] = useState<ManualFollowUp[]>([]);

  useEffect(() => {
    setMounted(true);
    const savedToken = localStorage.getItem('salespilot_token') ?? '';
    setToken(savedToken);
  }, []);

  useEffect(() => {
    if (token) void loadDashboard();
  }, [token, days]);

  useEffect(() => {
    if (!token) return;
    let isActive = true;
    const loadManualFollowUps = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/follow-ups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json() as ManualFollowUp[] | { message?: string };
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(!Array.isArray(result) ? result.message ?? 'No se pudieron cargar los re-contactos del equipo.' : 'No se pudieron cargar los re-contactos del equipo.');
        }
        if (isActive) setManualFollowUps(result);
      } catch (loadError) {
        if (isActive) setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los re-contactos del equipo.');
      }
    };
    void loadManualFollowUps();
    const refreshTimer = window.setInterval(() => void loadManualFollowUps(), 30_000);
    return () => {
      isActive = false;
      window.clearInterval(refreshTimer);
    };
  }, [token]);

  async function loadDashboard() {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/dashboard?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as DashboardData | { message?: string };
      if (!response.ok || !('budgets' in result)) {
        throw new Error('message' in result ? result.message ?? 'No se pudieron cargar las métricas.' : 'No se pudieron cargar las métricas.');
      }
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las métricas.');
    }
  }

  const tiles: Array<{ key: Drilldown; title: string; value: string; detail: string }> = data ? [
    {
      key: 'budgets',
      title: 'Presupuestos emitidos vs. ganados',
      value: `${currency.format(data.issuedAmount)} / ${currency.format(data.wonAmount)}`,
      detail: `${data.budgetCount} emitidos · ${data.wonCount} ganados`
    },
    {
      key: 'minutes',
      title: 'Minutas comerciales registradas',
      value: String(data.minuteCount),
      detail: data.minutesByOwner.map((owner) => `${owner.name}: ${owner.count}`).join(' · ') || 'Sin actividad'
    },
    {
      key: 'equipment',
      title: 'Equipos en horómetro crítico',
      value: String(data.criticalEquipmentCount),
      detail: 'Equipos con más de 4.000 hs'
    },
    {
      key: 'losses',
      title: 'Principales motivos de pérdida',
      value: String(data.lossReasons.reduce((total, item) => total + item.count, 0)),
      detail: data.lossReasons.slice(0, 2).map((item) => item.reason).join(' · ') || 'Sin pérdidas registradas'
    },
    {
      key: 'follow-ups',
      title: 'Recontactos de Sofía vs. derivaciones a David',
      value: `${data.autonomousFollowUpCount} / ${data.derivationCount}`,
      detail: data.previousPeriod
        ? `Período anterior: ${data.previousPeriod.autonomousFollowUpCount} / ${data.previousPeriod.derivationCount}`
        : 'Todo el período'
    },
    {
      key: 'exports',
      title: 'Ventas ganadas e historial de JSONs',
      value: `${currency.format(data.wonAmount)} · ${data.orderExportCount} JSON`,
      detail: data.previousPeriod
        ? `JSONs en período anterior: ${data.previousPeriod.orderExportCount}`
        : 'Órdenes listas para integrar'
    },
    {
      key: 'derivations',
      title: 'Derivaciones a David',
      value: String(data.derivationCount),
      detail: 'Conversaciones que requirieron intervención comercial'
    }
  ] : [];

  const now = new Date();
  const rangeStart = days === 'all'
    ? null
    : new Date(now.getTime() - Number(days) * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + ((7 - weekEnd.getDay()) % 7));
  weekEnd.setHours(23, 59, 59, 999);
  const todayKey = localDateKey(now);
  const followUpMetrics = (['David', 'Luciana'] as const).map((owner) => {
    const ownerFollowUps = manualFollowUps.filter((item) => item.owner === owner);
    const inPeriod = (value: string | null) => {
      if (!value) return false;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) &&
        (!rangeStart || timestamp >= rangeStart.getTime()) &&
        timestamp <= now.getTime();
    };
    const inPlanningWindow = (value: string | null) => {
      if (!value) return false;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) &&
        (!rangeStart || timestamp >= rangeStart.getTime()) &&
        timestamp <= weekEnd.getTime();
    };
    const scheduledInRange = ownerFollowUps.filter((item) => inPeriod(item.dueAt));
    const plannedForWeek = ownerFollowUps.filter((item) => inPlanningWindow(item.dueAt));
    const overdue = scheduledInRange.filter((item) =>
      item.status === 'scheduled' && Date.parse(item.dueAt) < now.getTime()
    ).length;
    const pendingToday = plannedForWeek.filter((item) =>
      item.status === 'scheduled' &&
      localDateKey(new Date(item.dueAt)) === todayKey &&
      Date.parse(item.dueAt) >= now.getTime()
    ).length;
    const pendingThisWeek = plannedForWeek.filter((item) => {
      const dueAt = Date.parse(item.dueAt);
      return item.status === 'scheduled' &&
        localDateKey(new Date(item.dueAt)) !== todayKey &&
        dueAt > now.getTime() &&
        dueAt <= weekEnd.getTime();
    }).length;
    const completed = ownerFollowUps.filter((item) =>
      item.status !== 'scheduled' && item.status !== 'cancelled' && inPeriod(item.completedAt)
    ).length;
    const totalScheduled = scheduledInRange.filter((item) => item.status !== 'cancelled').length;
    const completedCommitments = scheduledInRange.filter((item) =>
      item.status !== 'scheduled' && item.status !== 'cancelled'
    ).length;
    return {
      owner,
      area: owner === 'David' ? 'Ventas' : 'Post-venta',
      overdue,
      pendingToday,
      pendingThisWeek,
      completed,
      compliance: totalScheduled ? Math.round((completedCommitments / totalScheduled) * 100) : 0
    };
  });
  const overdueFollowUpTotal = followUpMetrics.reduce((total, item) => total + item.overdue, 0);

  return (
    <main className="min-h-screen bg-[#F1F4F9] text-[#172033] dark:bg-[#0b1220] dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">Dashboard directivo</span>
          </Link>
          <div className="flex items-center gap-2">
            <DemoTour />
            <ThemeToggle />
            <Link href="/simulator" className="text-sm font-semibold text-[#1E64FF]">Centro comercial</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] p-4 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#1E64FF]">Javier · dirección</p>
            <h1 className="mt-1 text-3xl font-bold">Rendimiento comercial</h1>
            <p className="mt-1 text-sm text-slate-500">Presupuestos, actividad de equipo y oportunidades de servicio.</p>
          </div>
          <label className="text-sm font-semibold">
            Rango de fechas
            <select value={days} onChange={(event) => setDays(event.target.value)} className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
              <option value="all">Todo el período</option>
            </select>
          </label>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {!token && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Inicia sesión como Javier (OWNER) para consultar el dashboard gerencial.</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => (
            <button key={tile.key} type="button" onClick={() => setDrilldown(tile.key)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{tile.title}</span>
              <span className="mt-3 block text-2xl font-bold tracking-tight">{tile.value}</span>
              <span className="mt-2 block text-xs text-slate-500">{tile.detail}</span>
              <span className="mt-4 block text-xs font-bold text-[#1E64FF]">Ver desglose →</span>
            </button>
          ))}
        </div>

        <section aria-label="Salud y Eficiencia de Seguimiento Comercial" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Actividad manual del equipo</p>
              <h2 className="mt-1 text-xl font-bold">Salud y Eficiencia de Seguimiento Comercial</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cola compartida del simulador · {days === 'all' ? 'Todo el período' : `Últimos ${days} días`}
              </p>
            </div>
            {overdueFollowUpTotal > 0 && (
              <span role="status" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                ⚠️ {overdueFollowUpTotal} re-llamados vencidos requieren atención directiva
              </span>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-xs font-bold text-slate-500">
                  <th className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">Ejecutivo</th>
                  <th className="border-b border-slate-200 px-3 py-3">Vencidos 🔴</th>
                  <th className="border-b border-slate-200 px-3 py-3">Pendientes Hoy 📅</th>
                  <th className="border-b border-slate-200 px-3 py-3">Esta Semana</th>
                  <th className="border-b border-slate-200 px-3 py-3">Completados en Período 🟢</th>
                  <th className="border-b border-slate-200 px-3 py-3">Tasa de Cumplimiento (%)</th>
                </tr>
              </thead>
              <tbody>
                {followUpMetrics.map((metric) => (
                  <tr key={metric.owner} className="text-sm">
                    <th scope="row" className="border-b border-slate-100 px-3 py-4 dark:border-slate-800">
                      <span className="block font-bold">{metric.owner}</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">{metric.area}</span>
                    </th>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold text-red-700 dark:border-slate-800 dark:text-red-300">{metric.overdue}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-semibold">{metric.pendingToday}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-semibold">{metric.pendingThisWeek}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-semibold text-emerald-700 dark:border-slate-800 dark:text-emerald-300">{metric.completed}</td>
                    <td className="border-b border-slate-100 px-3 py-4 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-bold">{metric.compliance}%</span>
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${metric.compliance}%` }} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!manualFollowUps.length && (
            <p className="mt-3 text-xs text-slate-500">
              Aún no hay re-contactos en la cola compartida. Se mostrarán aquí cuando se agenden desde el simulador.
            </p>
          )}
        </section>

        {drilldown && data && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Desglose: {tiles.find((tile) => tile.key === drilldown)?.title}</h2>
              <button type="button" onClick={() => setDrilldown(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">Cerrar</button>
            </div>
            <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">
              {drilldown === 'budgets' && data.budgets.map((budget) => (
                <article key={budget.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <span>{budget.customer.companyName ?? budget.customer.fullName} · {budget.status}</span>
                  <span className="font-semibold">{currency.format(Number(budget.amount))}{budget.motivoPerdida ? ` · ${budget.motivoPerdida}` : ''}</span>
                </article>
              ))}
              {drilldown === 'minutes' && data.minutes.map((minute) => (
                <article key={minute.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <p className="font-semibold">{minute.user?.firstName ?? 'Sin asignar'} · {minute.customer.companyName ?? minute.customer.fullName} · {minute.installedEquipment.model}</p>
                  <p className="mt-1 text-xs text-slate-500">{minute.transcript ?? 'Sin transcripción'}</p>
                </article>
              ))}
              {drilldown === 'equipment' && data.criticalEquipment.map((equipment) => (
                <article key={equipment.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <span>{equipment.customer.companyName ?? equipment.customer.fullName} · {equipment.model} · {equipment.serialNumber}</span>
                  <strong>{Number(equipment.currentHours).toLocaleString('es-AR')} hs</strong>
                </article>
              ))}
              {drilldown === 'losses' && data.lossReasons.map((item) => (
                <article key={item.reason} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  <span>{item.reason}</span><strong>{item.count}</strong>
                </article>
              ))}
              {drilldown === 'follow-ups' && data.autonomousFollowUps.map((item) => (
                <article key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  Día {item.dayNumber} · {item.message} · {item.processedAt ? 'Completado' : 'Programado'}
                </article>
              ))}
              {drilldown === 'derivations' && data.derivations.map((item) => (
                <article key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  {item.refCode} · {item.summary ?? 'Derivación comercial'}
                </article>
              ))}
              {drilldown === 'exports' && data.orderExports.map((item) => (
                <article key={item.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                  Presupuesto {item.budgetId} · exportado {mounted ? new Date(item.exportedAt).toLocaleString('es-AR') : item.exportedAt}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
