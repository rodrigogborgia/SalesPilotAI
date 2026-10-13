import 'dotenv/config';
import cors from 'cors';
import express, { ErrorRequestHandler } from 'express';

import { authRoutes } from './modules/auth/auth.routes';
import { organizationsRoutes } from './modules/organizations/organizations.routes';
import { customersRoutes } from './modules/customers/customers.routes';
import { productsRoutes } from './modules/products/products.routes';
import { copilotRoutes } from './modules/copilot/copilot.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'salespilot-api',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/analytics', analyticsRoutes);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error('API request failed:', error);
  res.status(500).json({ message: 'Error interno del servidor.' });
};

app.use(errorHandler);

export default app;
