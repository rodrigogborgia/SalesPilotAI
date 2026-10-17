import { Router } from 'express';

import { copilotService } from './copilot.service';

export const copilotRoutes = Router();

copilotRoutes.get('/references', async (req, res, next) => {
  try {
    const data = await copilotService.listReferences(req.auth!.organizationId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

copilotRoutes.post('/references', async (req, res, next) => {
  const payload = req.body ?? {};
  try {
    const data = await copilotService.createReference(req.auth!.organizationId, payload);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

copilotRoutes.post('/references/:refCode/resolve', async (req, res, next) => {
  const { refCode } = req.params;
  try {
    const data = await copilotService.resolveReference(req.auth!.organizationId, refCode);
    if (!data) {
      res.status(404).json({ message: 'Derivación no encontrada.' });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

copilotRoutes.post('/references/:refCode/take', async (req, res, next) => {
  try {
    const data = await copilotService.takeReference(
      req.auth!.organizationId,
      req.auth!.userId,
      req.params.refCode
    );
    if (!data) {
      res.status(404).json({ message: 'Derivación no encontrada.' });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
});

copilotRoutes.post('/references/:refCode/learning-rule', async (req, res, next) => {
  const body = req.body as { objection?: unknown; rule?: unknown };
  if (
    typeof body?.objection !== 'string' ||
    !body.objection.trim() ||
    body.objection.length > 1000 ||
    typeof body.rule !== 'string' ||
    !body.rule.trim() ||
    body.rule.length > 2000
  ) {
    res.status(400).json({ message: 'Indica la objeción y la regla comercial.' });
    return;
  }
  try {
    const data = await copilotService.recordLearningRule(
      req.auth!.organizationId,
      req.auth!.userId,
      req.params.refCode,
      body.objection.trim(),
      body.rule.trim()
    );
    if (!data) {
      res.status(404).json({ message: 'Derivación no encontrada.' });
      return;
    }
    res.status(201).json({
      ...data,
      message: 'Regla registrada. Notificación a Javier y Desarrollo simulada localmente.'
    });
  } catch (error) {
    next(error);
  }
});
