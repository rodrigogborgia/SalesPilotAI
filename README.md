# SalesPilotAI

Base de proyecto para una SaaS white-label orientada a gestión comercial, post-venta y recurrencia para Pro-Aire.

## Arquitectura propuesta

- Frontend: Next.js + TypeScript
- Backend: Express + TypeScript
- Base de datos: PostgreSQL
- Ejecución: nativa en Ubuntu con PM2 o systemd; PostgreSQL nativo o Supabase

## Scripts

```bash
npm install
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate -- --name init
npm --workspace apps/api run prisma:seed
npm run dev:api
npm run dev:web
```

El frontend queda disponible en http://localhost:3000 y la API en http://localhost:4000.
Configura `apps/api/.env` con `DATABASE_URL`, `JWT_SECRET` y las dos contraseñas iniciales
(`SEED_OWNER_PASSWORD` y `SEED_SALES_PASSWORD`) antes de migrar y ejecutar el seed. No
guardes credenciales reales en el repositorio.

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
