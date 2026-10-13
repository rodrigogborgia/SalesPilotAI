# SalesPilotAI - Modelo de datos relacional

## 1. Principios de diseño

- Multi-tenancy por `organization_id` en todas las entidades operativas.
- Separación entre `customers` y `organizations` para permitir clientes/proveedores del mismo tenant.
- `users` federados a `organizations` y roles por permiso.
- `conversations` centraliza todos los canales: WhatsApp, Instagram, Email, call center.
- `copilot_references` vincula cada derivación a la conversación original y al destinatario humano.
- `installed_equipment` y `maintenance_plans` permiten servicio preventivo basado en horómetros.
- `opportunities` conecta leads, clientes y ventas finalizadas.

## 2. Modelo relacional recomendado

### Entidades principales

#### organizations
- id: UUID PK
- name: VARCHAR(255)
- slug: VARCHAR(120) UNIQUE
- brand_name: VARCHAR(255)
- logo_url: TEXT NULL
- status: VARCHAR(30) default 'active'
- settings: JSONB default '{}'
- created_at, updated_at

#### users
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- first_name: VARCHAR(120)
- last_name: VARCHAR(120)
- email: VARCHAR(255) UNIQUE
- phone: VARCHAR(50) NULL
- role: VARCHAR(50) default 'agent'
- avatar_url: TEXT NULL
- status: VARCHAR(30) default 'active'
- password_hash: TEXT NULL
- last_login_at: TIMESTAMPTZ NULL
- created_at, updated_at

#### categories
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- parent_id: UUID NULL FK -> categories.id
- name: VARCHAR(150)
- slug: VARCHAR(150)
- description: TEXT NULL
- created_at, updated_at

#### products
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- category_id: UUID NULL FK -> categories.id
- sku: VARCHAR(120)
- name: VARCHAR(220)
- description: TEXT NULL
- price: DECIMAL(12,2)
- cost_price: DECIMAL(12,2) NULL
- is_active: BOOLEAN default true
- created_at, updated_at
- technical_documents: relación 1:N con `technical_documents`

#### technical_documents
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- product_id: UUID FK -> products.id
- title: VARCHAR(255)
- document_type: ENUM (`MANUAL`, `SCHEMA`, `DATASHEET`)
- file_url: TEXT
- created_at: TIMESTAMPTZ

#### customers
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- full_name: VARCHAR(220)
- email: VARCHAR(255) NULL
- phone: VARCHAR(50) NULL
- company_name: VARCHAR(220) NULL
- document_number: VARCHAR(80) NULL
- segment: VARCHAR(80) NULL
- address: TEXT NULL
- notes: TEXT NULL
- status: VARCHAR(30) default 'active'
- created_at, updated_at

#### installed_equipment
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- customer_id: UUID FK -> customers.id
- serial_number: VARCHAR(120) UNIQUE
- qr_token: VARCHAR(36) UNIQUE, generado como UUID
- location_in_plant: TEXT NULL
- product_id: UUID FK -> products.id
- model: VARCHAR(180)
- installation_date: TIMESTAMPTZ
- current_hours: DECIMAL(10,2) default 0
- avg_hours_per_day: DECIMAL(10,2) default 0
- warranty_end_date: TIMESTAMPTZ NULL
- status: VARCHAR(30) default 'active'
- notes: TEXT NULL
- created_at, updated_at

#### maintenance_plans
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- installed_equipment_id: UUID FK -> installed_equipment.id
- plan_name: VARCHAR(150)
- interval_hours: INTEGER
- next_due_hours: INTEGER
- status: VARCHAR(30) default 'active'
- created_at, updated_at

#### support_tickets
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- installed_equipment_id: UUID FK -> installed_equipment.id
- symptoms: TEXT
- photos: TEXT[] default '{}'
- status: ENUM (`RECEIVED`, `DIAGNOSING`, `SCHEDULED`, `REPAIRING`, `RESOLVED`)
- created_at, updated_at

#### conversations
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- customer_id: UUID NULL FK -> customers.id
- contact_channel: VARCHAR(30) default 'whatsapp'
- channel_ref: VARCHAR(150) NULL
- thread_id: VARCHAR(200) NULL
- sender_name: VARCHAR(180) NULL
- sender_phone: VARCHAR(50) NULL
- direction: VARCHAR(20) default 'inbound'
- content: TEXT NULL
- summary: TEXT NULL
- requires_derivation: BOOLEAN default false
- status: VARCHAR(30) default 'open'
- created_at, updated_at

#### copilot_references
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- conversation_id: UUID FK -> conversations.id
- customer_id: UUID NULL FK -> customers.id
- ref_code: VARCHAR(40) UNIQUE
- assigned_to_user_id: UUID NULL FK -> users.id
- source_channel: VARCHAR(30)
- summary: TEXT NULL
- resolved: BOOLEAN default false
- resolved_at: TIMESTAMPTZ NULL
- created_at, updated_at

#### leads
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- source: VARCHAR(60)
- source_campaign: VARCHAR(180) NULL
- customer_name: VARCHAR(220)
- contact_phone: VARCHAR(60)
- email: VARCHAR(255) NULL
- company_name: VARCHAR(220) NULL
- status: VARCHAR(40) default 'new'
- score: INTEGER default 0
- notes: TEXT NULL
- assigned_to_user_id: UUID NULL FK -> users.id
- created_at, updated_at

#### opportunities
- id: UUID PK
- organization_id: UUID FK -> organizations.id
- lead_id: UUID NULL FK -> leads.id
- customer_id: UUID NULL FK -> customers.id
- product_id: UUID NULL FK -> products.id
- sales_owner_user_id: UUID NULL FK -> users.id
- stage: VARCHAR(50) default 'new'
- amount: DECIMAL(12,2) default 0
- expected_close_date: DATE NULL
- probability: INTEGER default 0
- notes: TEXT NULL
- won_at: TIMESTAMPTZ NULL
- lost_at: TIMESTAMPTZ NULL
- created_at, updated_at

## 3. SQL DDL sugerido (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  brand_name VARCHAR(255),
  logo_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'agent',
  avatar_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  password_hash TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES categories(id),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  sku VARCHAR(120) NOT NULL,
  name VARCHAR(220) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name VARCHAR(220) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  company_name VARCHAR(220),
  document_number VARCHAR(80),
  segment VARCHAR(80),
  address TEXT,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE installed_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  serial_number VARCHAR(120) NOT NULL UNIQUE,
  model VARCHAR(180) NOT NULL,
  installation_date TIMESTAMPTZ NOT NULL,
  current_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_hours_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
  warranty_end_date TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  installed_equipment_id UUID NOT NULL REFERENCES installed_equipment(id) ON DELETE CASCADE,
  plan_name VARCHAR(150) NOT NULL,
  interval_hours INTEGER NOT NULL,
  next_due_hours INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  contact_channel VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  channel_ref VARCHAR(150),
  thread_id VARCHAR(200),
  sender_name VARCHAR(180),
  sender_phone VARCHAR(50),
  direction VARCHAR(20) NOT NULL DEFAULT 'inbound',
  content TEXT,
  summary TEXT,
  requires_derivation BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE copilot_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  ref_code VARCHAR(40) NOT NULL UNIQUE,
  assigned_to_user_id UUID REFERENCES users(id),
  source_channel VARCHAR(30) NOT NULL,
  summary TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source VARCHAR(60) NOT NULL,
  source_campaign VARCHAR(180),
  customer_name VARCHAR(220) NOT NULL,
  contact_phone VARCHAR(60),
  email VARCHAR(255),
  company_name VARCHAR(220),
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  assigned_to_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  customer_id UUID REFERENCES customers(id),
  product_id UUID REFERENCES products(id),
  sales_owner_user_id UUID REFERENCES users(id),
  stage VARCHAR(50) NOT NULL DEFAULT 'new',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_close_date DATE,
  probability INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 4. Índices clave

```sql
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_products_organization_id ON products(organization_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_customers_organization_id ON customers(organization_id);
CREATE INDEX idx_installed_equipment_customer_id ON installed_equipment(customer_id);
CREATE INDEX idx_installed_equipment_organization_id ON installed_equipment(organization_id);
CREATE INDEX idx_maintenance_plans_equipment_id ON maintenance_plans(installed_equipment_id);
CREATE INDEX idx_conversations_organization_id ON conversations(organization_id);
CREATE INDEX idx_conversations_customer_id ON conversations(customer_id);
CREATE INDEX idx_copilot_references_org_ref ON copilot_references(organization_id, ref_code);
CREATE INDEX idx_opportunities_organization_stage ON opportunities(organization_id, stage);
CREATE INDEX idx_opportunities_customer_id ON opportunities(customer_id);
```

## 5. Prisma schema sugerido

```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  brandName   String?
  logoUrl     String?
  status      String   @default("active")
  settings    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users                 User[]
  categories            Category[]
  products             Product[]
  customers            Customer[]
  conversations        Conversation[]
  copilotReferences     CopilotReference[]
  leads                Lead[]
  opportunities        Opportunity[]
  maintenancePlans     MaintenancePlan[]
  installedEquipment   InstalledEquipment[]
}

model User {
  id                 String   @id @default(uuid())
  organizationId     String
  organization       Organization @relation(fields: [organizationId], references: [id])
  firstName          String
  lastName           String
  email              String   @unique
  phone              String?
  role               String   @default("agent")
  avatarUrl          String?
  status             String   @default("active")
  passwordHash       String?
  lastLoginAt        DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  assignedLeads              Lead[]
  salesOpportunities         Opportunity[]
  assignedCopilotReferences   CopilotReference[]
}

model Category {
  id            String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  parentId      String?
  parent        Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children      Category[] @relation("CategoryTree")
  name          String
  slug          String
  description   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  products      Product[]
}

model Product {
  id            String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  categoryId     String?
  category       Category? @relation(fields: [categoryId], references: [id])
  sku           String
  name          String
  description   String?
  price         Decimal
  costPrice     Decimal?
  isActive      Boolean @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  installedEquipment InstalledEquipment[]
  technicalDocuments TechnicalDocument[]
  opportunities     Opportunity[]
}

model Customer {
  id            String   @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  fullName      String
  email         String?
  phone         String?
  companyName   String?
  documentNumber String?
  segment       String?
  address       String?
  notes         String?
  status        String @default("active")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  installedEquipment InstalledEquipment[]
  conversations     Conversation[]
  copilotReferences  CopilotReference[]
  opportunities     Opportunity[]
}

model InstalledEquipment {
  id              String   @id @default(uuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id])
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])
  productId       String
  product         Product @relation(fields: [productId], references: [id])
  serialNumber    String @unique
  qrToken            String @unique @default(uuid())
  locationInPlant    String?
  model           String
  installationDate DateTime
  currentHours    Decimal @default("0")
  avgHoursPerDay  Decimal @default("0")
  warrantyEndDate DateTime?
  status          String @default("active")
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  maintenancePlans MaintenancePlan[]
  supportTickets     SupportTicket[]
}

model TechnicalDocument {
  id             String                @id @default(uuid())
  organizationId String
  organization   Organization          @relation(fields: [organizationId], references: [id])
  productId      String
  product        Product               @relation(fields: [productId], references: [id])
  title          String
  documentType   TechnicalDocumentType
  fileUrl        String
  createdAt      DateTime              @default(now())
}

model SupportTicket {
  id                   String              @id @default(uuid())
  organizationId       String
  organization         Organization        @relation(fields: [organizationId], references: [id])
  installedEquipmentId String
  installedEquipment  InstalledEquipment  @relation(fields: [installedEquipmentId], references: [id])
  symptoms             String
  photos               String[]            @default([])
  status               SupportTicketStatus @default(RECEIVED)
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt
}

model MaintenancePlan {
  id                  String   @id @default(uuid())
  organizationId      String
  organization        Organization @relation(fields: [organizationId], references: [id])
  installedEquipmentId String
  installedEquipment  InstalledEquipment @relation(fields: [installedEquipmentId], references: [id])
  planName            String
  intervalHours       Int
  nextDueHours        Int
  status              String @default("active")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model Conversation {
  id                 String   @id @default(uuid())
  organizationId     String
  organization       Organization @relation(fields: [organizationId], references: [id])
  customerId         String?
  customer           Customer? @relation(fields: [customerId], references: [id])
  contactChannel     String @default("whatsapp")
  channelRef         String?
  threadId           String?
  senderName         String?
  senderPhone        String?
  direction          String @default("inbound")
  content            String?
  summary            String?
  requiresDerivation Boolean @default(false)
  status             String @default("open")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  copilotReferences CopilotReference[]
}

model CopilotReference {
  id               String   @id @default(uuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id])
  customerId        String?
  customer          Customer? @relation(fields: [customerId], references: [id])
  refCode           String @unique
  assignedToUserId  String?
  assignedToUser    User? @relation(fields: [assignedToUserId], references: [id])
  sourceChannel     String
  summary           String?
  resolved          Boolean @default(false)
  resolvedAt        DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model Lead {
  id               String   @id @default(uuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  source           String
  sourceCampaign   String?
  customerName     String
  contactPhone     String?
  email            String?
  companyName      String?
  status           String @default("new")
  score            Int @default(0)
  notes            String?
  assignedToUserId String?
  assignedToUser   User? @relation(fields: [assignedToUserId], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  opportunities Opportunity[]
}

model Opportunity {
  id                String   @id @default(uuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  leadId            String?
  lead              Lead? @relation(fields: [leadId], references: [id])
  customerId        String?
  customer          Customer? @relation(fields: [customerId], references: [id])
  productId         String?
  product           Product? @relation(fields: [productId], references: [id])
  salesOwnerUserId  String?
  salesOwnerUser    User? @relation(fields: [salesOwnerUserId], references: [id])
  stage             String @default("new")
  amount            Decimal @default("0")
  expectedCloseDate DateTime?
  probability       Int @default(0)
  notes             String?
  wonAt             DateTime?
  lostAt            DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## 6. Relaciones y reglas de negocio

- Un `organization` posee muchos `users`, `customers`, `products`, `conversations`, etc.
- Un `user` puede ser agente, supervisor, sales owner, soporte o admin.
- Cada `conversation` puede pertenecer a un `customer`, pero también puede quedar sin cliente si es un lead nuevo o un consultor no identificado.
- `copilot_references` relaciona una conversación con el `ref_code` y con su persona asignada (`David`).
- `installed_equipment` registra la instalación física por cliente y producto.
- `maintenance_plans` se calculan en función del `current_hours` y `avg_hours_per_day` para obtener alertas de mantenimiento.
- `opportunities` se alimenta desde tanto `lead` como `customer`, con `stage`, `probability` y `amount`.

## 7. Recomendación de ORM

- Usar Prisma si el equipo prioriza DX, validación de schema y queries seguras.
- Usar TypeORM si la organización ya tiene experiencia con repositorios y migrations avanzadas.
- En ambos casos, conservar siempre `organization_id` para filtros globales y políticas de tenant.

## 8. Recomendación para futuros módulos

- `quotes` / `quote_items`
- `maintenance_events`
- `campaigns`
- `campaign_runs`
- `analytics_kpis`
- `documents`
- `notifications`
- `audit_logs`
