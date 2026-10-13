import { Router } from 'express';

import { productsService } from './products.service';

export const productsRoutes = Router();

productsRoutes.get('/', async (_req, res) => {
  const data = await productsService.list();
  res.status(200).json(data);
});

productsRoutes.post('/', async (req, res) => {
  const payload = req.body ?? {};
  const data = await productsService.create(payload);
  res.status(201).json(data);
});
