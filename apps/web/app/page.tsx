import Image from 'next/image';
import Link from 'next/link';
import DemoTour from '../components/DemoTour';
import ThemeToggle from '../components/ThemeToggle';

const workspaces = [
  {
    title: 'Mi Planta',
    href: '/portal',
    icon: '🏭',
    action: 'Abrir portal',
    description:
      'Portal del cliente para consultar el PA 132, revisar horómetros y solicitar service.',
    detail: 'Portal de cliente'
  },
  {
    title: 'Centro Comercial & Sofía',
    href: '/simulator',
    icon: '💬',
    action: 'Hablar con Sofía',
    description:
      'Chat inbound con Sofía, derivación #REF-104 y minutas de voz para David y Luciana.',
    detail: 'Atención y seguimiento'
  },
  {
    title: 'Dashboard Directivo',
    href: '/dashboard',
    icon: '📊',
    action: 'Ver métricas',
    description:
      'Métricas de Javier con rangos de fecha, recontactos de Sofía vs. David y motivos de pérdida.',
    detail: 'Analítica comercial'
  },
  {
    title: 'Meta Growth & Admin',
    href: '/admin',
    icon: '🚀',
    action: 'Abrir administración',
    description:
      'Importación de ventas 90d, segmentación LAL 1%, audiencia Top of Mind y exportador de órdenes JSON.',
    detail: 'Growth y operaciones'
  }
];

const capabilities = [
  'Diagnóstico de planta en 3 preguntas',
  'Cotizaciones listas para compartir en PDF',
  'Recontactos oportunos para no perder oportunidades'
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/SalesPilotAI.jpeg"
              alt="SalesPilotAI"
              width={1408}
              height={768}
              priority
              className="h-12 w-[88px] shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">SalesPilotAI</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                Caso de Éxito / Cliente 0: Pro-Aire
              </p>
            </div>
          </div>
          <nav aria-label="Controles de la página" className="flex shrink-0 items-center gap-2">
            <DemoTour />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                Atención Consultiva 24/7
              </span>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                Tu operación comercial, conectada
              </p>
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
                Conoce a Sofía, tu asesora comercial virtual de Pro-Aire
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Sofía acompaña a cada cliente desde la primera consulta hasta el seguimiento:
                entiende la necesidad, orienta la solución y conecta al equipo comercial cuando
                hace falta.
              </p>
              <ul className="mt-7 space-y-3">
                {capabilities.map((capability) => (
                  <li key={capability} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      ✓
                    </span>
                    {capability}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/simulator"
                  className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
                >
                  Probar a Sofía <span aria-hidden="true" className="ml-2">→</span>
                </Link>
                <a
                  href="#espacios"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Explorar la plataforma
                </a>
              </div>
            </div>

            <div className="relative min-h-[300px] bg-slate-200 dark:bg-slate-800 sm:min-h-[420px] lg:min-h-full">
              <Image
                src="/Sofia.jpeg"
                alt="Sofía, asesora comercial virtual de Pro-Aire, en una planta industrial"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-[68%_center]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent p-6 pt-20 sm:p-8 sm:pt-24">
                <p className="text-lg font-bold text-white">Sofía</p>
                <p className="mt-1 text-sm text-slate-200">Asesora Comercial Virtual · Pro-Aire</p>
              </div>
            </div>
          </div>
        </section>

        <section id="espacios" className="mt-12 scroll-mt-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Un solo lugar para operar</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                Explora SalesPilotAI
              </h2>
            </div>
            <p className="max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Accede a las herramientas de cliente, ventas, gestión y crecimiento de Pro-Aire.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.href}
                href={workspace.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:shadow-black/20 sm:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl dark:bg-slate-800"
                  >
                    {workspace.icon}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {workspace.detail}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                  {workspace.title}
                </h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {workspace.description}
                </p>
                <span className="mt-5 inline-flex items-center text-sm font-bold text-blue-700 dark:text-blue-300">
                  {workspace.action}
                  <span aria-hidden="true" className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          SalesPilotAI · Caso de Éxito Pro-Aire
        </footer>
      </div>
    </main>
  );
}
