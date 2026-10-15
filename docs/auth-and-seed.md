# SalesPilotAI - Acceso inicial y permisos

## Roles

Los roles válidos se definen como constantes `UserRole` en `apps/api/src/shared/domainEnums.ts` y se almacenan como strings en SQLite:

| Rol | Permisos previstos |
| --- | --- |
| `OWNER` | Administración total de la organización, usuarios, configuración, datos, reportes y facturación. |
| `ADMIN` | Administración operativa de usuarios, catálogo, clientes, ventas, conversaciones y reportes; sin acciones exclusivas del owner. |
| `SALES` | Acceso a clientes, leads, oportunidades, conversaciones asignadas y cotizaciones. |
| `SUPPORT` | Acceso a clientes, conversaciones asignadas, equipos instalados y mantenimiento; sin administración del catálogo ni de usuarios. |
| `CLIENT_OPERATOR` | Acceso limitado al portal de planta: consultar la ficha y documentación del equipo, y crear/consultar tickets de asistencia permitidos para su organización. |

La lista fija los roles válidos; la autorización de cada endpoint se aplica mediante middleware/RBAC.

## Seed

El seed es idempotente y crea:

- Organización `Pro-Aire Industrial` (`pro-aire-industrial`).
- Javier con rol `OWNER`.
- David con rol `SALES`.
- Operador de Taller Rosario S.A. con rol `CLIENT_OPERATOR`.
- Categorías Compresores, Tratamiento de aire, Repuestos y mantenimiento, Tuberías y conexiones, y Servicios.
- Los 64 productos visibles en el [catálogo Pro-Aire](https://www.pro-aire.ar/productos/) al 14/10/2026, además del Compresor PA 132 (SKU `PA-132`). Los SKU del catálogo son sus identificadores de URL; los precios quedan nulos para evitar fijar valores comerciales desactualizables.
- Los tres productos genéricos del seed anterior quedan inactivos (no se eliminan) para conservar cualquier relación histórica.
- El equipo instalado PA 132 (`PA-000125`) de Taller Rosario S.A., con 4.280 hs y mantenimiento preventivo a las 4.500 hs.

Configurar `apps/api/.env` a partir de `.env.example` para la demostración local, incluyendo:

- `DATABASE_URL`: `file:./dev.db` (SQLite local).
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `SEED_OWNER_PASSWORD`, `SEED_SALES_PASSWORD` y `SEED_CLIENT_PASSWORD`: contraseñas individuales iniciales; nunca se guardan en el seed ni en el repositorio.
- `SEED_OWNER_EMAIL`, `SEED_SALES_EMAIL` y `SEED_CLIENT_EMAIL` son opcionales. Sus defaults son `javier@pro-aire.com`, `david@pro-aire.com` y `operador@tallerrosario.com`.

Desde la raíz del monorepo:

```bash
npm install
npm --workspace apps/api run prisma:generate
npm run db:setup
```

`npm run db:setup` aplica el schema SQLite con `prisma db push` y luego corre el seed. El seed exige las tres contraseñas y falla sin crear/actualizar registros cuando falta alguna. `prisma/migrations` conserva el historial PostgreSQL anterior; el flujo local SQLite usa `db push`, no aplica esas migraciones PostgreSQL.

Para la demo local, entra a `/portal` con el usuario cliente o a `/simulator` con David. El simulador responde localmente y usa la API local para crear y resolver referencias; no requiere integraciones externas.

## Autenticación

- `POST /api/auth/login` valida email y contraseña contra el hash bcrypt del usuario, y devuelve un JWT con vencimiento a las 12 horas.
- `GET /api/auth/me` acepta `Authorization: Bearer <token>` y devuelve el usuario, organización y rol actuales, consultados desde la base de datos.
- `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` configura la URL base del backend para el formulario web.

## Separación entre panel interno y Portal Mi Planta

`authMiddleware` valida el JWT y vuelve a leer usuario, estado, organización y rol de la base de datos en cada petición protegida. La organización del contexto se toma de ese registro activo, nunca de un parámetro enviado por el cliente.

| Superficie | Roles autorizados | Alcance |
| --- | --- | --- |
| CRM/API interna: `/api/organizations`, `/api/customers`, `/api/products`, `/api/copilot`, `/api/analytics` | `OWNER`, `ADMIN`, `SALES` | Panel y operaciones internas; `CLIENT_OPERATOR` recibe 403. |
| Portal Mi Planta: `/api/portal/tickets` | `OWNER`, `ADMIN`, `SALES`, `SUPPORT`, `CLIENT_OPERATOR` | Consultar equipo y tickets, y crear tickets. Las operaciones quedan filtradas por `organizationId`; para `CLIENT_OPERATOR`, también por el email asociado al cliente. |
| Salud: `/api/health` | Público | Estado del proceso, sin datos de tenant. |

El portal expone `GET /api/portal/tickets/equipment`, `GET /api/portal/tickets`, `GET /api/portal/tickets/:ticketId` y `POST /api/portal/tickets`. Para `CLIENT_OPERATOR`, los equipos y tickets solo corresponden al cliente cuyo email coincide con el de su cuenta. La creación solo acepta equipo instalado, síntomas y fotos; ignora cualquier `organizationId` enviado por el navegador y verifica la pertenencia del equipo al cliente autenticado. No expone endpoints para cambiar estados o modificar/eliminar tickets a `CLIENT_OPERATOR`.
