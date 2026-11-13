import { Router } from 'express';

import { productsService } from './products.service';

export const productsRoutes = Router();

productsRoutes.get('/', async (req, res, next) => {
  try {
    const data = await productsService.list(req.auth!.organizationId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

productsRoutes.post('/', async (req, res, next) => {
  const body = req.body as {
    sku?: unknown;
    name?: unknown;
    description?: unknown;
    categoryId?: unknown;
    price?: unknown;
  };
  const price = body.price === undefined ? undefined : Number(body.price);
  if (
    typeof body.sku !== 'string' || !body.sku.trim() || body.sku.length > 100 ||
    typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200 ||
    (body.description !== undefined && typeof body.description !== 'string') ||
    (body.categoryId !== undefined && typeof body.categoryId !== 'string') ||
    (price !== undefined && (!Number.isFinite(price) || price < 0))
  ) {
    res.status(400).json({ message: 'Datos inválidos para crear el producto.' });
    return;
  }

  try {
    const product = await productsService.create(req.auth!.organizationId, {
      sku: body.sku.trim(),
      name: body.name.trim(),
      ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
      ...(typeof body.categoryId === 'string' ? { categoryId: body.categoryId } : {}),
      ...(price === undefined ? {} : { price: String(price) })
    });
    if (!product) {
      res.status(404).json({ message: 'Categoría no encontrada.' });
      return;
    }
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});
