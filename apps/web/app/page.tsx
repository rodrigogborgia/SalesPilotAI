import Link from 'next/link';

const modules = [
  'Inbound comercial y venta consultiva',
  'CRM y pipeline',
  'Post-venta y mantenimiento',
  'Automatización y follow-up',
  'Dashboards ejecutivos',
  'White-label para distribuidores'
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">SalesPilotAI</span>
        <h1>Sistema operativo comercial, post-venta y recurrencia</h1>
        <p>
          Plataforma SaaS para reforzar el ciclo de vida del cliente y transformar CRM,
          atención comercial y servicio en una sola capa operativa.
        </p>
      </section>

      <section className="card">
        <h2>Alcance funcional</h2>
        <ul>
          {modules.map((module) => (
            <li key={module}>{module}</li>
          ))}
        </ul>
      </section>

      <section className="grid">
        <div className="card">
          <h3>Objetivo</h3>
          <p>
            Reemplazar el CRM tradicional pasivo con un motor operativo comercial que
            orqueste captura, distribución, seguimiento y cierre de oportunidades.
          </p>
        </div>
        <div className="card">
          <h3>Casos de uso</h3>
          <p>
            Leads capturados desde Meta Ads, gestión de clientes, post-venta,
            mantenimientos y dashboards de rendimiento por canal y distribuidor.
          </p>
        </div>
      </section>

      <section className="grid">
        <Link href="/portal" className="card block transition hover:-translate-y-0.5 hover:shadow-lg">
          <h3>Mi Planta</h3>
          <p>Portal de Taller Rosario S.A. para consultar el Compresor PA 132 y solicitar servicio.</p>
          <span className="mt-4 inline-block text-sm font-semibold text-blue-600">Abrir portal →</span>
        </Link>
        <Link href="/simulator" className="card block transition hover:-translate-y-0.5 hover:shadow-lg">
          <h3>Simulador Comercial</h3>
          <p>Prueba la conversación con el asistente de Pro-Aire y recibe derivaciones en la consola de David.</p>
          <span className="mt-4 inline-block text-sm font-semibold text-blue-600">Abrir simulador →</span>
        </Link>
      </section>
    </main>
  );
}
