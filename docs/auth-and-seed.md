# SalesPilotAI - Acceso inicial y permisos

## Roles

Los roles son el enum `UserRole` del schema Prisma:

| Rol | Permisos previstos |
| --- | --- |
| `OWNER` | Administración total de la organización, usuarios, configuración, datos, reportes y facturación. |
| `ADMIN` | Administración operativa de usuarios, catálogo, clientes, ventas, conversaciones y reportes; sin acciones exclusivas del owner. |
| `SALES` | Acceso a clientes, leads, oportunidades, conversaciones asignadas y cotizaciones. |
| `SUPPORT` | Acceso a clientes, conversaciones asignadas, equipos instalados y mantenimiento; sin administración del catálogo ni de usuarios. |
| `CLIENT_OPERATOR` | Acceso limitado al portal de planta: consultar la ficha y documentación del equipo, y crear/consultar tickets de asistencia permitidos para su organización. |

La enum fija los roles válidos; la autorización de cada endpoint debe aplicarse en middleware/RBAC antes de habilitar operaciones productivas.

## Seed

El seed es idempotente y crea:

- Organización `Pro-Aire Industrial` (`pro-aire-industrial`).
- Javier con rol `OWNER`.
- David con rol `SALES`.
- Categorías Compresores, Tratamiento de aire, Repuestos y mantenimiento.
- Tres productos base de Pro-Aire. Sus precios quedan sin definir y se mantienen nulos hasta cargar una lista comercial real.

Configurar `apps/api/.env` a partir de `.env.example`, incluyendo:

- `DATABASE_URL`: URL de PostgreSQL nativo o Supabase.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `SEED_OWNER_PASSWORD` y `SEED_SALES_PASSWORD`: contraseñas individuales iniciales; nunca se guardan en el seed ni en el repositorio.
- `SEED_OWNER_EMAIL` y `SEED_SALES_EMAIL` son opcionales, con defaults `javier@pro-aire.com` y `david@pro-aire.com`.

Desde la raíz del monorepo:

```bash
npm install
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate -- --name init
npm --workspace apps/api run prisma:seed
```

El seed exige ambos passwords y falla sin crear/actualizar registros cuando falta alguno.

## Autenticación

- `POST /api/auth/login` valida email y contraseña contra el hash bcrypt del usuario, y devuelve un JWT con vencimiento a las 12 horas.
- `GET /api/auth/me` acepta `Authorization: Bearer <token>` y devuelve el usuario, organización y rol actuales, consultados desde la base de datos.
- `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` configura la URL base del backend para el formulario web.

## Separación entre panel interno y Portal Mi Planta

`authMiddleware` valida el JWT y vuelve a leer usuario, estado, organización y rol de PostgreSQL en cada petición protegida. La organización del contexto se toma de ese registro activo, nunca de un parámetro enviado por el cliente.

| Superficie | Roles autorizados | Alcance |
| --- | --- | --- |
| CRM/API interna: `/api/organizations`, `/api/customers`, `/api/products`, `/api/copilot`, `/api/analytics` | `OWNER`, `ADMIN`, `SALES` | Panel y operaciones internas; `CLIENT_OPERATOR` recibe 403. |
| Portal Mi Planta: `/api/portal/tickets` | `OWNER`, `ADMIN`, `SALES`, `SUPPORT`, `CLIENT_OPERATOR` | Listar/consultar y crear tickets. Todas las lecturas y altas quedan filtradas por `organizationId` del contexto. |
| Salud: `/api/health` | Público | Estado del proceso, sin datos de tenant. |

El portal expone únicamente `GET /api/portal/tickets`, `GET /api/portal/tickets/:ticketId` y `POST /api/portal/tickets`. La creación solo acepta equipo instalado, síntomas y fotos; ignora cualquier `organizationId` enviado por el navegador y verifica que el equipo pertenezca a la organización autenticada. No expone endpoints para cambiar estados o modificar/eliminar tickets a `CLIENT_OPERATOR`.
