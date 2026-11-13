'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Profile = 'david' | 'luciana';

type WorkItem = {
  id: string;
  customer: string;
  title: string;
  detail: string;
  status: string;
  priority: 'urgent' | 'today' | 'normal';
  initials: string;
};

type Customer = {
  id: string;
  name: string;
  company: string;
  detail: string;
};

const customers: Customer[] = [
  { id: 'cliente-1', name: 'María López', company: 'Metalúrgica del Sur', detail: 'Consulta por nuevo compresor' },
  { id: 'cliente-2', name: 'Pedro Gómez', company: 'Envases del Plata', detail: 'Compresor PA 132 · 4.820 hs' },
  { id: 'cliente-3', name: 'Sofía Martínez', company: 'Alimentos del Centro', detail: 'Compresor PA 90 · 3.960 hs' },
  { id: 'cliente-4', name: 'Jorge Fernández', company: 'Talleres Norte', detail: 'Compresor PA 55 · 2.150 hs' },
  { id: 'cliente-5', name: 'Carolina Díaz', company: 'Plásticos Andinos', detail: 'Compresor PA 75 · 2.410 hs' }
];

const startingWork: Record<Profile, WorkItem[]> = {
  david: [
    { id: 'cliente-1', customer: 'Metalúrgica del Sur', title: 'María López', detail: 'Pidió información por un equipo nuevo', status: 'Vencido · ayer', priority: 'urgent', initials: 'MS' },
    { id: 'cliente-4', customer: 'Talleres Norte', title: 'Jorge Fernández', detail: 'Presupuesto enviado · falta confirmar', status: 'Para hoy', priority: 'today', initials: 'TN' },
    { id: 'oportunidad-3', customer: 'Alimentos del Centro', title: 'Sofía Martínez', detail: 'Solicitó una propuesta para su planta', status: 'Nuevo', priority: 'normal', initials: 'AC' }
  ],
  luciana: [
    { id: 'cliente-2', customer: 'Envases del Plata', title: 'Compresor PA 132', detail: 'Pedro Gómez · Service cada 5.000 hs', status: 'Vencido · 180 hs', priority: 'urgent', initials: 'EP' },
    { id: 'cliente-3', customer: 'Alimentos del Centro', title: 'Compresor PA 90', detail: 'Sofía Martínez · Service cada 4.000 hs', status: 'Próximo · 40 hs', priority: 'today', initials: 'AC' },
    { id: 'cliente-5', customer: 'Plásticos Andinos', title: 'Compresor PA 75', detail: 'Carolina Díaz · Service cada 3.000 hs', status: 'Planificado', priority: 'normal', initials: 'PA' }
  ]
};

const profileContent = {
  david: {
    name: 'David',
    role: 'Ventas',
    title: 'Tus tareas de ventas',
    subtitle: 'Un próximo paso claro para cada cliente.',
    queueLabel: 'Seguimientos',
    actionLabel: 'Contactar',
    secondaryAction: 'Registrar resultado',
    actionHint: 'Llamar o escribir al cliente'
  },
  luciana: {
    name: 'Luciana',
    role: 'Mantenimiento',
    title: 'Tus tareas de service',
    subtitle: 'Primero, los equipos que necesitan atención.',
    queueLabel: 'Tareas de mantenimiento',
    actionLabel: 'Llamar',
    secondaryAction: 'Reagendar',
    actionHint: 'llamar al cliente'
  }
};

const priorityStyle: Record<WorkItem['priority'], string> = {
  urgent: 'bg-rose-50 text-rose-700 ring-rose-200',
  today: 'bg-amber-50 text-amber-800 ring-amber-200',
  normal: 'bg-slate-100 text-slate-600 ring-slate-200'
};

export default function MaquetaWorkspace({ initialProfile }: { initialProfile: Profile }) {
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => startingWork[initialProfile]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const profile = profileContent[initialProfile];
  const normalizedSearch = search.trim().toLocaleLowerCase('es-AR');
  const results = useMemo(() => customers.filter((customer) =>
    `${customer.name} ${customer.company} ${customer.detail}`.toLocaleLowerCase('es-AR').includes(normalizedSearch)
  ), [normalizedSearch]);
  const queuedIds = new Set(workItems.map((item) => item.id));

  function addToQueue(customer: Customer) {
    if (queuedIds.has(customer.id)) return;
    const item: WorkItem = initialProfile === 'david'
      ? {
          id: customer.id,
          customer: customer.company,
          title: customer.name,
          detail: customer.detail,
          status: 'Agregado · pendiente',
          priority: 'normal',
          initials: customer.company.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
        }
      : {
          id: customer.id,
          customer: customer.company,
          title: customer.detail.split(' · ')[0] ?? 'Equipo del cliente',
          detail: `${customer.name} · ${customer.detail.split(' · ').slice(1).join(' · ') || 'Equipo pendiente de identificar'}`,
          status: 'Agregado · pendiente',
          priority: 'normal',
          initials: customer.company.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
        };
    setWorkItems((items) => [...items, item]);
    setNotice(`${customer.company} se agregó a las tareas pendientes de ${profile.name}.`);
  }

  return (
    <main className="min-h-screen bg-[#F5F7FA] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/maqueta" className="flex items-center gap-2.5" aria-label="SalesPilotAI, maqueta">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">S</span>
            <span>
              <span className="block text-sm font-bold tracking-tight">SalesPilotAI</span>
              <span className="block text-[11px] text-slate-500">Propuesta de interfaz</span>
            </span>
          </Link>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">Prototipo</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6 sm:pt-9">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Una pantalla, lo importante primero</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hola, {profile.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{profile.subtitle}</p>
        </div>

        <nav aria-label="Elegir maqueta" className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
          {(['david', 'luciana'] as const).map((person) => (
            <Link
              key={person}
              href={`/maqueta?perfil=${person}`}
              aria-current={person === initialProfile ? 'page' : undefined}
              className={`rounded-lg px-3 py-2.5 text-center text-sm font-semibold transition ${
                person === initialProfile ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {profileContent[person].name} <span className={person === initialProfile ? 'text-slate-300' : 'text-slate-400'}>· {profileContent[person].role}</span>
            </Link>
          ))}
        </nav>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold">{profile.title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{workItems.length} tareas pendientes</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                setSearch('');
                setNotice('');
              }}
              aria-expanded={searchOpen}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <span aria-hidden="true">⌕</span> Buscar cliente
            </button>
          </div>

          {searchOpen && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:p-4">
              <label htmlFor="customer-search" className="block text-sm font-semibold">Agregar un cliente existente</label>
              <p className="mt-1 text-xs text-slate-600">Busca por nombre o empresa y súmalo a tus tareas pendientes.</p>
              <input
                id="customer-search"
                autoFocus
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej.: Envases del Plata"
                className="mt-3 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {results.map((customer) => {
                  const alreadyQueued = queuedIds.has(customer.id);
                  return (
                    <li key={customer.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{customer.company}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{customer.name} · {customer.detail}</p>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyQueued}
                        onClick={() => addToQueue(customer)}
                        className="min-h-10 shrink-0 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {alreadyQueued ? 'Ya está agregado' : 'Agregar a mis tareas'}
                      </button>
                    </li>
                  );
                })}
                {!results.length && <li className="p-4 text-sm text-slate-500">No encontramos coincidencias. Prueba con otro nombre.</li>}
              </ul>
            </div>
          )}

          {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800">{notice}</p>}

          <div className="mt-4 space-y-3">
            {workItems.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">{item.initials}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold">{item.customer}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${priorityStyle[item.priority]}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
                    <p className="mt-2 text-xs font-medium text-slate-400">{profile.queueLabel}</p>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setNotice(`En la versión final, desde aquí podrías ${profile.actionHint.toLowerCase()} a ${item.customer}.`)}
                      className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                      {profile.actionLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotice(`En la versión final, desde aquí podrías ${profile.secondaryAction.toLowerCase()} para ${item.customer}.`)}
                      className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                    >
                      {profile.secondaryAction}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">¿Te serviría así?</p>
          <p className="mt-1 text-xs leading-5">¿Qué te resulta más útil? ¿Qué cambiarías o qué acción te gustaría tener más a mano?</p>
        </aside>
        <p className="mt-4 text-center text-[11px] text-slate-400">Prototipo para conversar · Los cambios y acciones son solo de muestra.</p>
      </div>
    </main>
  );
}
