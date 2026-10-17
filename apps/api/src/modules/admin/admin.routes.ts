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
