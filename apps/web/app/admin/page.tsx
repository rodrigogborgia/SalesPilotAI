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

type CompletedSale = {
  id: string;
  email: string;
  phone: string | null;
  company: string;
  amount: number;
  purchaseDate: string;
};

type SalesAudiences = {
  totalBuyers: number;
  lookalikeSeed: CompletedSale[];
  recentExclusions: CompletedSale[];
  topOfMind: CompletedSale[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseAmount(value: string) {
  let normalized = value.replace(/[^\d,.-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replaceAll('.', '').replace(',', '.')
      : normalized.replaceAll(',', '');
  } else if (normalized.includes(',')) {
    normalized = normalized.replaceAll('.', '').replace(',', '.');
  }
  return Number(normalized);
}

function parsePurchaseDate(value: string) {
  const localizedDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (localizedDate) return `${localizedDate[3]}-${localizedDate[2].padStart(2, '0')}-${localizedDate[1].padStart(2, '0')}`;
  return value;
}

function readSalesCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('El CSV debe incluir encabezados y al menos una venta.');

  const headers = rows[0].map(normalizeHeader);
  const column = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const emailColumn = column(['email', 'correo', 'correoelectronico']);
  const phoneColumn = column(['telefono', 'tel', 'phone', 'celular']);
  const companyColumn = column(['empresa', 'company']);
  const amountColumn = column(['monto', 'montopesos', 'amount', 'value', 'montocompra']);
  const dateColumn = column(['fechadecompra', 'fechacompra', 'purchasedate']);

  if ([emailColumn, companyColumn, amountColumn, dateColumn].some((index) => index < 0)) {
    throw new Error('Faltan columnas requeridas: Email, Empresa, Monto y Fecha de Compra. Teléfono es opcional.');
  }

  return rows.slice(1).map((values, index) => {
    const amount = parseAmount(values[amountColumn] ?? '');
    const purchaseDate = parsePurchaseDate(values[dateColumn] ?? '');
    const email = (values[emailColumn] ?? '').trim().toLowerCase();
    const company = (values[companyColumn] ?? '').trim();
    if (!email || !company || !Number.isFinite(amount) || amount < 0 || Number.isNaN(Date.parse(purchaseDate))) {
      throw new Error(`Revisa Email, Empresa, Monto y Fecha de Compra en la fila ${index + 2}.`);
    }
    return {
      email,
      phone: phoneColumn >= 0 ? (values[phoneColumn] ?? '').trim() : '',
      company,
      amount,
      purchaseDate
    };
  });
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [entries, setEntries] = useState<AudienceEntry[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [salesAudiences, setSalesAudiences] = useState<SalesAudiences>({
    totalBuyers: 0,
    lookalikeSeed: [],
    recentExclusions: [],
    topOfMind: []
  });
  const [activeSalesTab, setActiveSalesTab] = useState<'lookalike' | 'topOfMind'>('lookalike');
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [isImportingSales, setIsImportingSales] = useState(false);

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
    if (token && authorized) {
      void loadAudiences();
      void loadSalesAudiences();
    }
  }, [token, authorized]);

  async function loadSalesAudiences() {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/sales-import`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as SalesAudiences & { message?: string };
      if (!response.ok || !Array.isArray(result.lookalikeSeed) || !Array.isArray(result.topOfMind)) {
        throw new Error(result.message ?? 'No se pudieron cargar las audiencias de ventas.');
      }
      setSalesAudiences(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las audiencias de ventas.');
    }
  }

  async function importSales() {
    if (!salesFile) return;
    setIsImportingSales(true);
    setError('');
    setNotice('');
    try {
      const sales = readSalesCsv(await salesFile.text());
      const response = await fetch(`${apiUrl}/api/admin/sales-import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sales })
      });
      const result = (await response.json()) as SalesAudiences & { importedCount?: number; message?: string };
      if (!response.ok || !Array.isArray(result.lookalikeSeed)) {
        throw new Error(result.message ?? 'No se pudieron importar las ventas.');
      }
      setSalesAudiences(result);
      setSalesFile(null);
      setNotice(`Importación completada: ${result.importedCount ?? 0} compradores procesados. Audiencias actualizadas.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudieron importar las ventas.');
    } finally {
      setIsImportingSales(false);
    }
  }

  async function syncSalesAudiences() {
    setIsSyncing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/sales-import/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as {
        message?: string;
        lookalikeSeedCount?: number;
        topOfMindCount?: number;
        recentExclusionCount?: number;
      };
      if (!response.ok) throw new Error(result.message ?? 'No se pudieron preparar las audiencias.');
      setNotice(`${result.message ?? 'Audiencias preparadas.'} Semilla LAL: ${result.lookalikeSeedCount ?? 0}; exclusiones recientes: ${result.recentExclusionCount ?? 0}; Top of Mind: ${result.topOfMindCount ?? 0}.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'No se pudieron preparar las audiencias.');
    } finally {
      setIsSyncing(false);
    }
  }

  async function exportSalesAudiences() {
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/admin/sales-import/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message ?? 'No se pudo exportar el CSV de Meta.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'salespilot-meta-completed-sales.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar el CSV de Meta.');
    }
  }

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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Growth Hacking · Ventas concretadas</h2>
              <p className="mt-1 text-sm text-slate-500">Importa compradores para crear la semilla Lookalike y activar post-venta durante los primeros 90 días.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void syncSalesAudiences()} disabled={!authorized || isSyncing} className="rounded-xl bg-[#1E64FF] px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {isSyncing ? 'Preparando…' : '🔄 Sincronizar Ambas Audiencias con Meta Ads'}
              </button>
              <button type="button" onClick={() => void exportSalesAudiences()} disabled={!authorized} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
                📄 Descargar CSV Formateado para Meta
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Total Compradores Importados', value: salesAudiences.totalBuyers },
              { label: 'Audiencia Lookalike Lista · 1%', value: salesAudiences.lookalikeSeed.length },
              { label: 'Audiencia Top of Mind / Mantenimiento Activa', value: salesAudiences.topOfMind.length }
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-bold">{metric.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
            <div className="min-w-0 flex-1">
              <label htmlFor="sales-csv" className="block text-sm font-bold">Cargar ventas concretadas (CSV)</label>
              <p className="mt-1 text-xs text-slate-500">Columnas: Email, Teléfono, Empresa, Monto, Fecha de Compra. Admite fechas DD/MM/AAAA.</p>
            </div>
            <input
              id="sales-csv"
              type="file"
              accept=".csv,text/csv"
              disabled={!authorized || isImportingSales}
              onChange={(event) => setSalesFile(event.target.files?.[0] ?? null)}
              className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-blue-800 disabled:opacity-50 dark:file:bg-blue-950/60 dark:file:text-blue-200"
            />
            <button type="button" onClick={() => void importSales()} disabled={!authorized || !salesFile || isImportingSales} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500">
              {isImportingSales ? 'Importando…' : 'Importar ventas'}
            </button>
            {salesFile && <span className="basis-full text-xs text-slate-500">{salesFile.name}</span>}
          </div>

          <div className="mt-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-5">
              <button type="button" onClick={() => setActiveSalesTab('lookalike')} className={`border-b-2 px-1 py-3 text-sm font-bold ${activeSalesTab === 'lookalike' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500'}`}>
                Público Semilla Lookalike (1%)
              </button>
              <button type="button" onClick={() => setActiveSalesTab('topOfMind')} className={`border-b-2 px-1 py-3 text-sm font-bold ${activeSalesTab === 'topOfMind' ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-500'}`}>
                Remarketing Post-Venta (0-90 días)
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {activeSalesTab === 'lookalike'
              ? `La semilla incluye ${salesAudiences.lookalikeSeed.length} compradores. ${salesAudiences.recentExclusions.length} compradores de los últimos 90 días quedan identificados para excluirlos de captación.`
              : 'Incluye a todos los compradores desde el primer día hasta cumplir 90 días, para garantía, kits de mantenimiento y posicionamiento de marca.'}
          </p>
          {(() => {
            const displayedSales = activeSalesTab === 'lookalike' ? salesAudiences.lookalikeSeed : salesAudiences.topOfMind;
            return (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Email / Teléfono</th><th className="px-4 py-3">Monto</th><th className="px-4 py-3">Fecha de compra</th><th className="px-4 py-3">Segmento</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {displayedSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-4 py-3 font-semibold">{sale.company}</td>
                        <td className="px-4 py-3">{sale.email}<span className="block text-xs text-slate-500">{sale.phone ?? 'Sin teléfono'}</span></td>
                        <td className="px-4 py-3">{currency.format(sale.amount)}</td>
                        <td className="px-4 py-3">{new Date(sale.purchaseDate).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3">
                          {salesAudiences.recentExclusions.some((buyer) => buyer.id === sale.id)
                            ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Excluir de captación · reciente</span>
                            : activeSalesTab === 'lookalike'
                              ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">Semilla LAL</span>
                              : <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Post-venta activa</span>}
                        </td>
                      </tr>
                    ))}
                    {!displayedSales.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aún no hay ventas para este segmento. Importa un CSV o ejecuta el seed de demo.</td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </section>

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
