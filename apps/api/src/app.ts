import 'dotenv/config';
import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';

import { authRoutes } from './modules/auth/auth.routes';
import { organizationsRoutes } from './modules/organizations/organizations.routes';
import { customersRoutes } from './modules/customers/customers.routes';
import { productsRoutes } from './modules/products/products.routes';
import { copilotRoutes } from './modules/copilot/copilot.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { ticketsRoutes } from './modules/tickets/tickets.routes';
import { budgetsRoutes } from './modules/budgets/budgets.routes';
import { maintenanceRoutes } from './modules/maintenance/maintenance.routes';
import { leadsRoutes } from './modules/leads/leads.routes';
import { followUpsRoutes } from './modules/follow-ups/follow-ups.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import {
  authMiddleware,
  internalPanelAccess,
  ticketAccess,
  requireRoles
} from './shared/middleware/authMiddleware';
import { UserRole } from './shared/domainEnums';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'salespilot-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/organizations', authMiddleware, internalPanelAccess, organizationsRoutes);
app.use('/api/customers', authMiddleware, internalPanelAccess, customersRoutes);
app.use('/api/products', authMiddleware, internalPanelAccess, productsRoutes);
app.use('/api/copilot', authMiddleware, internalPanelAccess, copilotRoutes);
app.use('/api/analytics', authMiddleware, internalPanelAccess, analyticsRoutes);
app.use('/api/portal/tickets', authMiddleware, ticketAccess, ticketsRoutes);
app.use('/api/budgets', authMiddleware, internalPanelAccess, budgetsRoutes);
app.use('/api/maintenance', authMiddleware, internalPanelAccess, maintenanceRoutes);
app.use('/api/leads', authMiddleware, internalPanelAccess, leadsRoutes);
app.use('/api/follow-ups', authMiddleware, internalPanelAccess, followUpsRoutes);
app.use(
  '/api/admin',
  authMiddleware,
  requireRoles(UserRole.OWNER, UserRole.ADMIN),
  adminRoutes
);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('API request failed:', error);
  res.status(500).json({ message: 'Error interno del servidor.' });
};

app.use(errorHandler);

export default app;
