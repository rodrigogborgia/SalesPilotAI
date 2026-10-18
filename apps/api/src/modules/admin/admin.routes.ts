import { Router } from 'express';

import { adminService } from './admin.service';

export const adminRoutes = Router();

adminRoutes.get('/audiences', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.listAudiences(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/audiences/export', async (req, res, next) => {
  try {
    const csv = await adminService.exportAudience(req.auth!.organizationId);
    res
      .status(200)
      .type('text/csv')
      .attachment('salespilot-meta-audience.csv')
      .send(csv);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/audiences/sync', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.simulateMetaSync(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/sales-import', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.getCompletedSalesAudiences(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/sales-import', async (req, res, next) => {
  const input = req.body?.sales;
  if (!Array.isArray(input) || input.length === 0) {
    res.status(400).json({ message: 'Envía una lista no vacía de ventas en el campo sales.' });
    return;
  }

  const sales = [];
  for (const [index, row] of input.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      res.status(400).json({ message: `La venta de la fila ${index + 1} no es válida.` });
      return;
    }
    const candidate = row as Record<string, unknown>;
    const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : '';
    const phone = typeof candidate.phone === 'string' ? candidate.phone.trim() : '';
    const company = typeof candidate.company === 'string' ? candidate.company.trim() : '';
    const amount = typeof candidate.amount === 'number' || typeof candidate.amount === 'string'
      ? Number(String(candidate.amount).replace(',', '.'))
      : Number.NaN;
    const purchaseDate = typeof candidate.purchaseDate === 'string'
      ? new Date(candidate.purchaseDate)
      : new Date(Number.NaN);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !company || !Number.isFinite(amount) || amount < 0 ||
      Number.isNaN(purchaseDate.getTime()) || purchaseDate.getTime() > Date.now()) {
      res.status(400).json({
        message: `Datos inválidos en la fila ${index + 1}: revisa email, empresa, monto y fecha de compra.`
      });
      return;
    }
    sales.push({ email, phone: phone || null, company, amount, purchaseDate });
  }

  try {
    res.status(200).json(await adminService.importCompletedSales(req.auth!.organizationId, sales));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/sales-import/export', async (req, res, next) => {
  try {
    const csv = await adminService.exportCompletedSalesAudiences(req.auth!.organizationId);
    res.status(200).type('text/csv').attachment('salespilot-meta-completed-sales.csv').send(csv);
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/sales-import/sync', async (req, res, next) => {
  try {
    res.status(200).json(await adminService.simulateCompletedSalesMetaSync(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/dashboard', async (req, res, next) => {
  const rawDays = req.query.days ?? '30';
  const days = rawDays === 'all' ? 0 : Number(rawDays);
  if (![0, 7, 30, 90].includes(days)) {
    res.status(400).json({ message: 'Rango inválido. Usa 7, 30, 90 o all.' });
    return;
  }

  try {
    res.status(200).json(await adminService.getDashboard(req.auth!.organizationId, days));
  } catch (error) {
    next(error);
  }
});
