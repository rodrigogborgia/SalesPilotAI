import { Router } from 'express';

import { copilotService } from './copilot.service';

export const copilotRoutes = Router();

copilotRoutes.get('/references', async (_req, res) => {
  const data = await copilotService.listReferences();
  res.status(200).json(data);
});

copilotRoutes.post('/references', async (req, res) => {
  const payload = req.body ?? {};
  const data = await copilotService.createReference(payload);
  res.status(201).json(data);
});

copilotRoutes.post('/references/:refCode/resolve', async (req, res) => {
  const { refCode } = req.params;
  const data = await copilotService.resolveReference(refCode);
  res.status(200).json(data);
});
