import { Router } from 'express';

import { organizationsService } from './organizations.service';

export const organizationsRoutes = Router();

organizationsRoutes.get('/', async (_req, res) => {
  const data = await organizationsService.list();
  res.status(200).json(data);
});

organizationsRoutes.post('/', async (req, res) => {
  const payload = req.body ?? {};
  const data = await organizationsService.create(payload);
  res.status(201).json(data);
});
