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
    </main>
  );
}
