# SalesPilotAI

Base de proyecto para una SaaS white-label orientada a gestión comercial, post-venta y recurrencia para Pro-Aire.

## Arquitectura propuesta

- Frontend: Next.js + TypeScript
- Backend: Express + TypeScript
- Base de datos: SQLite para la demo local; PostgreSQL es el destino previsto para producción.
- Ejecución: nativa en Ubuntu con PM2 o systemd; PostgreSQL nativo o Supabase

## Inicio rápido: demo local

```bash
npm install
npm run db:setup
npm run start:demo
```

Antes de comenzar, crea `apps/api/.env` a partir de `apps/api/.env.example` y configura `JWT_SECRET` (mínimo 32 caracteres) y las tres contraseñas de seed (`SEED_OWNER_PASSWORD`, `SEED_SALES_PASSWORD` y `SEED_CLIENT_PASSWORD`). La URL SQLite local predeterminada es `file:./dev.db`; no se necesita instalar ni iniciar un servidor de base de datos. No guardes credenciales reales en el repositorio.

`npm run db:setup` ejecuta, en ese orden, `prisma db push` y `prisma db seed` desde `apps/api`, creando `apps/api/prisma/dev.db`. `npm run start:demo` levanta API y web en paralelo; la web queda en http://localhost:3000 y la API en http://localhost:4000. Detén ambos procesos con `Ctrl+C`. Las pantallas `/portal` y `/simulator` funcionan contra esta infraestructura local y no requieren servicios externos.

## Scripts adicionales

```bash
npm run dev:api
npm run dev:web
npm run build
```

## Importación de ventas para Meta Ads

La consola `/admin` permite importar un CSV de ventas concretadas con las columnas `Email`, `Teléfono`, `Empresa`, `Monto` y `Fecha de Compra` (teléfono opcional; fechas `DD/MM/AAAA` o ISO). La API protegida `POST /api/admin/sales-import` recibe las ventas en el campo `sales`; el endpoint `GET /api/admin/sales-import` devuelve la semilla Lookalike, la exclusión de compradores recientes y la audiencia de post-venta activa.

La semilla Lookalike usa todos los compradores importados. Las compras de los últimos 90 días se identifican además como exclusión de captación y como audiencia Top of Mind / mantenimiento. La sincronización con Meta y el CSV combinado de segmentos son preparaciones locales simuladas; no se envían datos a Meta Ads.

## Seguimiento comercial Pro-Aire

El alta de prospectos registra canal, campaña, tipo de cliente, requerimiento, producto del catálogo activo, cantidad y monto estimado. Los productos se consultan desde la base de datos; `db:setup` carga el catálogo incluido en el seed. La asignación sigue al usuario que registra el contacto (David o Luciana), sin derivación automática por tipo de requerimiento.

La cadencia automática se programa desde el ingreso del prospecto a los 2, 7, 14, 21, 30, 45 y 60 días. Los clientes con última compra registrada hace más de 360 días aparecen en la cola de reactivación de Luciana; sin historial de compras no se los clasifica como inactivos.

## Importación de facturas y métricas mensuales

Desde `/admin`, el rol OWNER/ADMIN puede importar periódicamente un CSV de facturas de Bejerman. Es una importación manual, no una integración directa. Cada fila representa un rubro de una factura; si el comprobante tiene varias líneas, indica un número de línea distinto para cada una. Se aceptan separadores coma o punto y coma y fechas `DD/MM/AAAA` o ISO.

Columnas requeridas: `Número de Factura`, `Fecha`, `Empresa`, `Responsable` (`David`/`Luciana`), `Rubro` (`Equipo`, `Servicio` o `Repuestos`) y `Monto`. `Línea` (por defecto 1), `Email`, `Cantidad de equipos` y `Tipo de cliente` (`nuevo`, `activo`, `reactivado`, `desconocido`) son opcionales. La empresa y el email se usan para consolidar compras; el tipo se infiere del prospecto o del historial importado cuando no viene en el archivo.

El dashboard suma facturas importadas del mes calendario en Argentina: equipos para David, servicios y repuestos para Luciana; la conversión se calcula sobre presupuestos que pasaron a cotizados y sus cierres. Los nuevos clientes de David son empresas con primer presupuesto aceptado; para Luciana se cuentan clientes nuevos facturados y las reactivaciones se muestran aparte. Los objetivos iniciales son $80.000.000 mensuales para David y $50.000.000 para Luciana; Javier ve la suma y el desglose por responsable. Importa el historial disponible antes de usar la cola de reactivación o interpretar clientes sin compras previas.

David y Luciana también ven en su consola personal el objetivo mensual, la facturación acumulada y el avance contra objetivo. La cifra se actualiza al cargar la pantalla y cada minuto; requiere haber importado las facturas del mes desde `/admin`.

## Estructura

```text
apps/
  api/      # API backend
  web/      # app frontend
```

## Siguientes pasos

1. Definir autenticación y multitenancy.
2. Diseñar modelos de clientes, leads, oportunidades y tickets.
3. Implementar tablero ejecutivo y pipelines comerciales.
4. Añadir automatizaciones y paneles para post-venta y recurrencia.
