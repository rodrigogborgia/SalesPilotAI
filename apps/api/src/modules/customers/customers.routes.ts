import { Router } from 'express';

import { customersService } from './customers.service';

export const customersRoutes = Router();

customersRoutes.get('/', async (_req, res) => {
  const data = await customersService.list();
  res.status(200).json(data);
});

customersRoutes.post('/', async (req, res) => {
  const payload = req.body ?? {};
  const data = await customersService.create(payload);
  res.status(201).json(data);
});
