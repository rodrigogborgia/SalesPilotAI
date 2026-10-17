'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import DemoTour from '../../components/DemoTour';

type Equipment = {
  id: string;
  model: string;
  serialNumber: string;
  currentHours: string;
  status: string;
  locationInPlant: string | null;
  customer: { companyName: string | null };
  maintenancePlans: Array<{ nextDueHours: number; planName: string }>;
};

type Ticket = {
  id: string;
  symptoms: string;
  status: string;
  createdAt: string;
  installedEquipment: { model: string; serialNumber: string };
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function apiErrorMessage(value: unknown, fallback: string) {
  return typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
    ? value.message
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMaintenancePlan(value: unknown): value is Equipment['maintenancePlans'][number] {
  return (
    isRecord(value) &&
    typeof value.planName === 'string' &&
    typeof value.nextDueHours === 'number'
  );
}

function isEquipment(value: unknown): value is Equipment {
  if (!isRecord(value)) return false;
  const customer = value.customer;
  return (
    typeof value.id === 'string' &&
    typeof value.model === 'string' &&
    typeof value.serialNumber === 'string' &&
    (typeof value.currentHours === 'string' || typeof value.currentHours === 'number') &&
    typeof value.status === 'string' &&
    (typeof value.locationInPlant === 'string' || value.locationInPlant === null) &&
    isRecord(customer) &&
    (typeof customer.companyName === 'string' || customer.companyName === null) &&
    Array.isArray(value.maintenancePlans) &&
    value.maintenancePlans.every(isMaintenancePlan)
  );
}

function isTicket(value: unknown): value is Ticket {
  if (!isRecord(value)) return false;
  const installedEquipment = value.installedEquipment;
  return (
    typeof value.id === 'string' &&
    typeof value.symptoms === 'string' &&
    typeof value.status === 'string' &&
    typeof value.createdAt === 'string' &&
    isRecord(installedEquipment) &&
    typeof installedEquipment.model === 'string' &&
    typeof installedEquipment.serialNumber === 'string'
  );
}

function formatStatus(status: string) {
  return status === 'RECEIVED' ? 'Recibido' : status.replaceAll('_', ' ').toLowerCase();
}

export default function PlantPortalPage() {
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketMessage, setTicketMessage] = useState('');

  useEffect(() => {
    setMounted(true);
    const savedToken = window.localStorage.getItem('salespilot_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    setToken(savedToken);
    void loadPlant(savedToken);
  }, []);

  async function loadPlant(accessToken: string) {
    setError('');
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [equipmentResponse, ticketsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/portal/tickets/equipment`, { headers }),
        fetch(`${apiUrl}/api/portal/tickets`, { headers })
      ]);
      const equipmentResult: unknown = await equipmentResponse.json();
      const ticketsResult: unknown = await ticketsResponse.json();

      if (!equipmentResponse.ok) {
        throw new Error(apiErrorMessage(equipmentResult, 'No se pudo cargar el equipo de planta.'));
      }
      if (!ticketsResponse.ok) {
        throw new Error(apiErrorMessage(ticketsResult, 'No se pudo cargar el historial de servicio.'));
      }
      if (!Array.isArray(equipmentResult) || !equipmentResult.every(isEquipment)) {
        throw new Error('La respuesta de equipos no tiene el formato esperado.');
      }
      if (!Array.isArray(ticketsResult) || !ticketsResult.every(isTicket)) {
        throw new Error('La respuesta del historial no tiene el formato esperado.');
      }

      setEquipment(equipmentResult[0] ?? null);
      setTickets(ticketsResult);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar Mi Planta.');
    } finally {
      setIsLoading(false);
    }
  }

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!equipment || !token) return;

    setIsSubmitting(true);
    setTicketMessage('');
    try {
      const response = await fetch(`${apiUrl}/api/portal/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          installedEquipmentId: equipment.id,
          symptoms: symptoms.trim()
        })
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(result, 'No se pudo crear el ticket.'));
      }
      if (!isTicket(result)) throw new Error('La respuesta del ticket no tiene el formato esperado.');

      setTickets((currentTickets) => [result, ...currentTickets]);
      setSymptoms('');
      setTicketMessage('Solicitud enviada. El equipo de servicio se pondrá en contacto.');
    } catch (submitError) {
      setTicketMessage(submitError instanceof Error ? submitError.message : 'No se pudo crear el ticket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentHours = Number(equipment?.currentHours ?? 0);
  const nextMaintenance = equipment?.maintenancePlans[0]?.nextDueHours;
  const remainingHours = nextMaintenance === undefined ? undefined : Math.max(0, nextMaintenance - currentHours);

  return (
    <main className="min-h-screen bg-[#F4F7FB] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">Portal de clientes</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-500 sm:inline">Taller Rosario S.A.</span>
            <DemoTour />
            <ThemeToggle />
            <Link href="/simulator" className="font-semibold text-[#1E64FF] hover:text-blue-700">Ver simulador</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E64FF]">Portal de planta</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Mi Planta</h1>
          <p className="mt-2 text-slate-500">El estado de tus equipos y su servicio, en un solo lugar.</p>
        </div>

        {!token && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h2 className="font-semibold">Inicia sesión para ver tu planta</h2>
            <p className="mt-1 text-sm text-amber-800">Usa el acceso de cliente operador de Taller Rosario S.A.</p>
            <Link href="/login?next=%2Fportal" className="mt-4 inline-flex rounded-lg bg-[#1E64FF] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Iniciar sesión</Link>
          </section>
        )}

        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Cargando equipo y solicitudes…</div>
        ) : token && !equipment && !error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">No hay equipos vinculados a esta cuenta.</div>
        ) : equipment ? (
          <>
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
              <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                <div className="relative min-h-[280px] bg-gradient-to-br from-[#E8F0FA] via-[#F4F8FC] to-[#DDE8F5] p-5 sm:min-h-[390px] sm:p-8">
                  <div className="absolute left-7 top-7 rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" /> En Servicio
                  </div>
                  <Image
                    src="/compresor-pa132.svg"
                    alt="Ilustración del Compresor PA 132"
                    fill
                    priority
                    className="object-contain px-5 pb-4 pt-16 sm:px-10 sm:pb-8"
                  />
                  <span className="absolute bottom-4 right-5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Imagen ilustrativa</span>
                </div>

                <div className="flex flex-col justify-between p-6 sm:p-9">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#1E64FF]">{equipment.customer.companyName ?? 'Mi equipo'}</p>
                        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{equipment.model}</h2>
                        <p className="mt-1 text-sm text-slate-500">Aire comprimido · Pro-Aire</p>
                      </div>
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">N.º {equipment.serialNumber}</span>
                    </div>

                    <div className="mt-8 rounded-2xl bg-[#F5F8FC] p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Horómetro</p>
                          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{mounted ? currentHours.toLocaleString('es-AR') : currentHours} <span className="text-base font-semibold text-slate-500">hs</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Próximo mantenimiento</p>
                          <p className="mt-1 font-semibold text-[#172033]">{remainingHours !== undefined ? `en ${mounted ? remainingHours.toLocaleString('es-AR') : remainingHours} hs` : 'A coordinar'}</p>
                        </div>
                      </div>
                      {remainingHours !== undefined && (
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-[#1E64FF]" style={{ width: `${Math.max(4, Math.min(100, ((500 - remainingHours) / 500) * 100))}%` }} />
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-500">{equipment.locationInPlant ?? 'Ubicación no informada'}</p>
                    </div>
                  </div>

                  <a href="#solicitar-servicio" className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E64FF] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700">
                    Solicitar Servicio <span aria-hidden="true">→</span>
                  </a>
                </div>
              </div>
            </section>

            <nav aria-label="Accesos rápidos" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { href: '#solicitar-servicio', label: 'Solicitar Servicio', icon: '＋', color: 'text-blue-600 bg-blue-50' },
                { href: '#manuales', label: 'Manuales', icon: '▤', color: 'text-violet-600 bg-violet-50' },
                { href: '#mantenimiento', label: 'Mantenimiento', icon: '◷', color: 'text-amber-600 bg-amber-50' },
                { href: '#historial', label: 'Historial', icon: '↻', color: 'text-emerald-600 bg-emerald-50' }
              ].map((action) => (
                <a key={action.label} href={action.href} className="flex min-h-24 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${action.color}`}>{action.icon}</span>
                  {action.label}
                </a>
              ))}
            </nav>

            <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <section id="solicitar-servicio" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1E64FF]">Asistencia técnica</p>
                <h2 className="mt-2 text-xl font-bold">Solicitar Servicio</h2>
                <p className="mt-1 text-sm text-slate-500">Cuéntanos qué sucede con tu equipo y generaremos un ticket.</p>
                <form className="mt-5" onSubmit={submitTicket}>
                  <label htmlFor="symptoms" className="mb-2 block text-sm font-semibold text-slate-700">Descripción del problema</label>
                  <textarea
                    id="symptoms"
                    required
                    maxLength={5000}
                    rows={4}
                    value={symptoms}
                    onChange={(event) => setSymptoms(event.target.value)}
                    placeholder="Describe una alarma, ruido, pérdida de presión u otro síntoma…"
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#1E64FF] focus:ring-4 focus:ring-blue-100"
                  />
                  {ticketMessage && <p role="status" className="mt-3 text-sm text-slate-700">{ticketMessage}</p>}
                  <button disabled={isSubmitting || !token} className="mt-4 rounded-xl bg-[#0F172A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSubmitting ? 'Enviando solicitud…' : 'Enviar solicitud'}
                  </button>
                </form>
              </section>

              <div className="space-y-5">
                <section id="manuales" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-600">Documentación</p>
                      <h2 className="mt-1 text-lg font-bold">Manuales del equipo</h2>
                    </div>
                    <span className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">PA 132</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">La documentación técnica estará disponible aquí cuando Pro-Aire la habilite para este equipo.</p>
                </section>
                <section id="mantenimiento" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-600">Plan preventivo</p>
                  <h2 className="mt-1 text-lg font-bold">Próximo mantenimiento</h2>
                  <p className="mt-2 text-sm text-slate-600">{remainingHours !== undefined ? `A las ${mounted ? nextMaintenance?.toLocaleString('es-AR') : nextMaintenance} hs de uso · faltan ${mounted ? remainingHours.toLocaleString('es-AR') : remainingHours} hs.` : 'Sin mantenimiento programado.'}</p>
                </section>
                <section id="historial" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-600">Postventa</p>
                      <h2 className="mt-1 text-lg font-bold">Historial de servicio</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tickets.length}</span>
                  </div>
                  {tickets.length ? (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {tickets.slice(0, 4).map((ticket) => (
                        <li key={ticket.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{ticket.symptoms}</p>
                            <p className="mt-1 text-xs text-slate-500">{mounted ? new Date(ticket.createdAt).toLocaleDateString('es-AR') : '—'} · {ticket.installedEquipment.serialNumber}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{formatStatus(ticket.status)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 text-sm text-slate-500">Todavía no hay solicitudes de servicio.</p>}
                </section>
              </div>
            </div>
          </>
        ) : null}

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">SalesPilotAI · Portal de clientes Pro-Aire · Demo local</footer>
      </div>
    </main>
  );
}
