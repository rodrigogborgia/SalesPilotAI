import { Router } from 'express';

import { maintenanceService } from './maintenance.service';

export const maintenanceRoutes = Router();

maintenanceRoutes.get('/outbound', async (req, res, next) => {
  try {
    const equipment = await maintenanceService.listOutbound(req.auth!.organizationId);
    res.status(200).json(equipment);
  } catch (error) {
    next(error);
  }
});

maintenanceRoutes.post('/email-capture', async (req, res, next) => {
  const body = req.body as { customerId?: unknown; email?: unknown };
  if (
    typeof body?.customerId !== 'string' ||
    !body.customerId.trim() ||
    typeof body.email !== 'string' ||
    body.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  ) {
    res.status(400).json({ message: 'Ingresa un email corporativo válido.' });
    return;
  }

  try {
    const result = await maintenanceService.captureEmail(
      req.auth!.organizationId,
      req.auth!.userId,
      body.customerId.trim(),
      body.email
    );
    if (!result) {
      res.status(404).json({ message: 'Cliente no encontrado.' });
      return;
    }
    res.status(200).json({
      message: 'Guardado y etiquetado para Audiencia Meta.',
      customer: result.customer,
      audienceEntry: result.audienceEntry
    });
  } catch (error) {
    next(error);
  }
});
