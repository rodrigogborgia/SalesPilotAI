import { Router } from 'express';

import { analyticsService } from './analytics.service';

export const analyticsRoutes = Router();

analyticsRoutes.get('/audits', async (_req, res) => {
  const data = await analyticsService.listAudits();
  res.status(200).json(data);
});

analyticsRoutes.post('/audits/run', async (_req, res) => {
  const data = await analyticsService.runAudit();
  res.status(200).json(data);
});

analyticsRoutes.get('/prompt-history', async (_req, res) => {
  const data = await analyticsService.listPromptHistory();
  res.status(200).json(data);
});

analyticsRoutes.post('/prompt-history', async (req, res) => {
  const payload = req.body ?? {};
  const data = await analyticsService.savePromptHistory(payload);
  res.status(201).json(data);
});
