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
