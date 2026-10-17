import { Router } from 'express';

import { budgetsService } from './budgets.service';
import {
  isBudgetLossReason,
  isBudgetStatus
} from '../../shared/budgetEnums';

export const budgetsRoutes = Router();

function isNonNegativeNumber(value: unknown): value is string | number {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0;
}

budgetsRoutes.get('/', async (req, res, next) => {
  try {
    const budgets = await budgetsService.list(req.auth!.organizationId);
    res.status(200).json(budgets);
  } catch (error) {
    next(error);
  }
});

budgetsRoutes.get('/follow-ups', async (req, res, next) => {
  try {
    res.status(200).json(await budgetsService.listFollowUps(req.auth!.organizationId));
  } catch (error) {
    next(error);
  }
});

budgetsRoutes.get('/:budgetId/export-json', async (req, res, next) => {
  try {
    const result = await budgetsService.getOrderExport(
      req.auth!.organizationId,
      req.params.budgetId
    );
    if (!result) {
      res.status(404).json({ message: 'Solo se pueden exportar presupuestos ganados.' });
      return;
    }
    res.status(200).json(result.payload);
  } catch (error) {
    next(error);
  }
});

budgetsRoutes.patch('/:budgetId/status', async (req, res, next) => {
  const body = req.body as { status?: unknown; motivoPerdida?: unknown };
  if (
    !isBudgetStatus(body?.status) ||
    (body.motivoPerdida !== undefined &&
      body.motivoPerdida !== null &&
      !isBudgetLossReason(body.motivoPerdida))
  ) {
    res.status(400).json({ message: 'Estado o motivo de pérdida inválido.' });
    return;
  }

  try {
    const result = await budgetsService.updateStatus(
      req.auth!.organizationId,
      req.params.budgetId,
      body.status,
      isBudgetLossReason(body.motivoPerdida) ? body.motivoPerdida : undefined
    );
    if (!result.count) {
      res.status(404).json({ message: 'Presupuesto no encontrado.' });
      return;
    }
    res.status(200).json({ message: 'Estado del presupuesto actualizado.' });
  } catch (error) {
    next(error);
  }
});

budgetsRoutes.post('/minutes', async (req, res, next) => {
  const body = req.body as {
    equipmentId?: unknown;
    budgetId?: unknown;
    status?: unknown;
    amount?: unknown;
    motivoPerdida?: unknown;
    nextAction?: unknown;
    horometerHours?: unknown;
    transcript?: unknown;
  };

  if (
    typeof body?.equipmentId !== 'string' ||
    !body.equipmentId.trim() ||
    (body.budgetId !== undefined &&
      (typeof body.budgetId !== 'string' || !body.budgetId.trim())) ||
    !isBudgetStatus(body.status) ||
    !isNonNegativeNumber(body.amount) ||
    !isNonNegativeNumber(body.horometerHours) ||
    (body.motivoPerdida !== undefined &&
      body.motivoPerdida !== null &&
      !isBudgetLossReason(body.motivoPerdida)) ||
    (body.nextAction !== undefined &&
      (typeof body.nextAction !== 'string' || body.nextAction.length > 2000)) ||
    (body.transcript !== undefined &&
      (typeof body.transcript !== 'string' || body.transcript.length > 10000))
  ) {
    res.status(400).json({ message: 'Datos inválidos para registrar la minuta.' });
    return;
  }

  try {
    const result = await budgetsService.saveVoiceMinute(req.auth!.organizationId, {
      equipmentId: body.equipmentId.trim(),
      userId: req.auth!.userId,
      ...(typeof body.budgetId === 'string' ? { budgetId: body.budgetId.trim() } : {}),
      status: body.status,
      amount: String(body.amount),
      ...(isBudgetLossReason(body.motivoPerdida)
        ? { motivoPerdida: body.motivoPerdida }
        : {}),
      ...(typeof body.nextAction === 'string' ? { nextAction: body.nextAction } : {}),
      horometerHours: String(body.horometerHours),
      ...(typeof body.transcript === 'string' ? { transcript: body.transcript } : {})
    });

    if (!result) {
      res.status(404).json({ message: 'Equipo o presupuesto asociado no encontrado.' });
      return;
    }
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
