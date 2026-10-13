import { Router } from 'express';

import { ticketsService } from './tickets.service';

export const ticketsRoutes = Router();

ticketsRoutes.get('/', async (req, res, next) => {
  try {
    const tickets = await ticketsService.list(req.auth!.organizationId);
    res.status(200).json(tickets);
  } catch (error) {
    next(error);
  }
});

ticketsRoutes.get('/:ticketId', async (req, res, next) => {
  try {
    const ticket = await ticketsService.findById(
      req.auth!.organizationId,
      req.params.ticketId
    );

    if (!ticket) {
      res.status(404).json({ message: 'Ticket no encontrado.' });
      return;
    }

    res.status(200).json(ticket);
  } catch (error) {
    next(error);
  }
});

ticketsRoutes.post('/', async (req, res, next) => {
  const body = req.body as {
    installedEquipmentId?: unknown;
    symptoms?: unknown;
    photos?: unknown;
  };

  if (
    typeof body?.installedEquipmentId !== 'string' ||
    !body.installedEquipmentId.trim() ||
    typeof body.symptoms !== 'string' ||
    !body.symptoms.trim() ||
    body.symptoms.length > 5000 ||
    (body.photos !== undefined &&
      (!Array.isArray(body.photos) ||
        body.photos.length > 10 ||
        !body.photos.every((photo) => typeof photo === 'string' && photo.length <= 2048)))
  ) {
    res.status(400).json({ message: 'Datos inválidos para crear el ticket.' });
    return;
  }

  try {
    const ticket = await ticketsService.create(req.auth!.organizationId, {
      installedEquipmentId: body.installedEquipmentId.trim(),
      symptoms: body.symptoms,
      photos: (body.photos as string[] | undefined) ?? []
    });

    if (!ticket) {
      res.status(404).json({ message: 'Equipo instalado no encontrado.' });
      return;
    }

    res.status(201).json(ticket);
  } catch (error) {
    next(error);
  }
});
