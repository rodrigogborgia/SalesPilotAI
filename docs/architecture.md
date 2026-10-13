# SalesPilotAI - Arquitectura de módulos y estructura del proyecto

## 1. Visión de arquitectura

SalesPilotAI se modela como una plataforma SaaS multi-tenant orientada a operaciones comerciales y de servicio. La base es una app monolítica modular en backend y una app web con Next.js. La idea es separar claramente:

- `apps/web`: experiencia de usuario y dashboards
- `apps/api`: lógica de negocio, integración con WhatsApp/Instagram/Email, CRM, mantenimiento y automatizaciones
- `apps/shared`: utilidades compartidas, zod schemas, tipos, enums, constantes, validaciones, si se decide crecer
- `packages/*`: módulos reutilizables, validaciones, clients externos, SDKs

## 2. Capas de la solución

### Capa 1: Frontend (Next.js)
Responsable por:
- Auth / sesión y roles
- Dashboard ejecutivo
- CRM / pipeline
- Lead capture y oportunidades
- Módulo de atención inbound
- Post-venta y mantenimiento
- White-label y branding por tenant

### Capa 2: API REST / services (Express + TS)
Responsable por:
- auth y RBAC
- gestión de organizaciones, usuarios, clientes
- lead/opportunity management
- conversación y derivación a David
- mantenimiento y alertas por horómetro
- reportes ejecutivos y cron jobs
- integración con Whisper / WhatsApp / Meta / Email / PDF

### Capa 3: Persistencia
- PostgreSQL nativo en Ubuntu o Supabase como base principal
- Prisma o TypeORM
- JSONB para settings y metadata de tenant
- Optional: Redis para cache / rate-limit / queues async
- Proceso API ejecutado nativamente con PM2 o systemd

### Capa 4: Integraciones externas
- Meta Ads / WhatsApp / Instagram Graph API
- OpenAI / Whisper API
- PDF generation service
- Email delivery provider
- cron job scheduler / queue workers

## 3. Estructura sugerida para apps/api

```text
apps/api/
  src/
    app.ts
    server.ts
    config/
      env.ts
      database.ts
      logger.ts
    modules/
      auth/
        auth.controller.ts
        auth.service.ts
        auth.routes.ts
        auth.schema.ts
      organizations/
        organizations.controller.ts
        organizations.service.ts
        organizations.routes.ts
        organizations.validation.ts
      users/
        users.controller.ts
        users.service.ts
        users.routes.ts
      customers/
        customers.controller.ts
        customers.service.ts
        customers.routes.ts
      products/
        products.controller.ts
        products.service.ts
        products.routes.ts
      equipment/
        equipment.controller.ts
        equipment.service.ts
        equipment.routes.ts
      maintenance/
        maintenance.controller.ts
        maintenance.service.ts
        maintenance.routes.ts
      leads/
        leads.controller.ts
        leads.service.ts
        leads.routes.ts
      opportunities/
        opportunities.controller.ts
        opportunities.service.ts
        opportunities.routes.ts
      conversations/
        conversations.controller.ts
        conversations.service.ts
        conversations.routes.ts
      copilot/
        copilot.controller.ts
        copilot.service.ts
        copilot.routes.ts
      reports/
        reports.controller.ts
        reports.service.ts
        reports.routes.ts
      campaigns/
        campaigns.controller.ts
        campaigns.service.ts
        campaigns.routes.ts
      imports/
        imports.controller.ts
        imports.service.ts
        imports.routes.ts
    shared/
      http/
        ApiError.ts
        asyncHandler.ts
        response.ts
      lib/
        uuid.ts
        pagination.ts
        tenant.ts
      middleware/
        requireAuth.ts
        requireRole.ts
        tenantGuard.ts
      utils/
        money.ts
        dates.ts
        logger.ts
      constants/
        roles.ts
        channels.ts
        statuses.ts
    integrations/
      whatsapp/
        whatsapp.client.ts
        whatsapp.service.ts
      instagram/
        instagram.client.ts
      email/
        email.service.ts
      openai/
        whisper.service.ts
        copilot.service.ts
      pdf/
        quotePdf.service.ts
    jobs/
      cron/
        weeklyExecutiveReport.ts
        maintenanceAlertCheck.ts
      workers/
        syncConversations.ts
    prisma/
      schema.prisma
      seed.ts
      migrations/
    database/
      prisma.ts
      repositories/
        organization.repository.ts
        customer.repository.ts
        equipment.repository.ts
        opportunity.repository.ts
```

## 4. Estructura sugerida para apps/web

```text
apps/web/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
    (dashboard)/
      layout.tsx
      page.tsx
      overview/page.tsx
      pipeline/page.tsx
      customers/page.tsx
      leads/page.tsx
      opportunities/page.tsx
      maintenance/page.tsx
      conversations/page.tsx
      reports/page.tsx
    api/
      health/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    app-shell/
      AppShell.tsx
      Sidebar.tsx
      Topbar.tsx
    ui/
      Button.tsx
      Card.tsx
      Modal.tsx
      Badge.tsx
      Table.tsx
      Tabs.tsx
    dashboard/
      KPIGrid.tsx
      PipelineBoard.tsx
      ExecutiveSummary.tsx
    forms/
      CustomerForm.tsx
      LeadForm.tsx
      EquipmentForm.tsx
      OpportunityForm.tsx
    chat/
      ConversationPanel.tsx
      MessageList.tsx
      Composer.tsx
  features/
    auth/
      useSession.ts
      authApi.ts
    crm/
      useLeads.ts
      leadsApi.ts
    sales/
      opportunitiesApi.ts
    maintenance/
      maintenanceApi.ts
    reporting/
      reportsApi.ts
  lib/
    api.ts
    utils.ts
    auth.ts
    date.ts
    format.ts
  hooks/
    useTenant.ts
    useDebounce.ts
    usePagination.ts
  stores/
    session.store.ts
    ui.store.ts
  styles/
    tokens.css
    theme.css
  types/
    api.ts
    entities.ts
```

## 5. Módulos funcionales del sistema

### 5.1 Módulo de CRM y ventas
- Lead capture
- Calificación consultiva
- Pipeline por etapas
- Asignación a vendedores
- Cierre y seguimiento

### 5.2 Módulo de inbound y diagnóstico
- Diagnóstico 3 pasos
- Procesamiento de voz con Whisper
- Generación de cotización PDF
- Registro de la conversación y derivación

### 5.3 Módulo de copilot / agentes B2B
- `copilot_references` con `#REF-XXX`
- Controles de `requires_derivation`
- Derivación a David
- Respuesta en canal original

### 5.4 Módulo de post-venta y mantenimiento
- Equipos instalados
- seguimiento de horómetro
- planes de mantenimiento
- alertas por 2k / 4k horas
- kits, repuestos y recomendaciones

### 5.5 Módulo de campañas y reportes ejecutivos
- campañas automáticas de upgrades
- cron jobs semanales
- KPIs por canal, equipo, zona y producto
- envío por email a Javier

## 6. Recomendación de diseño de capas y reglas

- Cada módulo debe exponer `controller`, `service`, `routes` y `validation`.
- La lógica de negocio va en services, no en controllers.
- Las queries y mutations por tenant deben filtrar por `organization_id` siempre.
- Todo `conversations` debe tener `channel_ref` y `thread_id` para rehidratación del hilo.
- Las entidades relacionadas a clientes y operaciones deben tener `status`, `created_at`, `updated_at`.
- Los jobs automáticos deben escribirse en `jobs/` y no mezclar lógica con controllers.

## 7. Roadmap sugerido

### Fase 1 - MVP
- Auth
- Organizations
- Users
- Customers
- Products
- Leads
- Opportunities
- Conversations
- Dashboard base

### Fase 2 - Post-venta
- Installed equipment
- Maintenance plans
- Maintenance triggers
- Alerts

### Fase 3 - Copilot y WhatsApp automation
- Copilot references
- Derivations
- Voice/text processing
- PDF quotes

### Fase 4 - Reporting & growth
- Campaigns
- Executive reports
- Segmentation
- KPI analytics

## 8. Recomendación final

Para este proyecto, la mejor combinación es:

- PostgreSQL + Prisma
- Express + TypeScript
- Next.js 14 + App Router
- PostgreSQL nativo o Supabase; procesos administrados con PM2 o systemd
- Redis opcional para cron/jobs/queues

Esto acelera tanto el desarrollo del MVP como la futura expansión a white-label y automatizaciones multi-canal.
