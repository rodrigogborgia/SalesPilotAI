import { Router } from 'express';

import prisma from '../../lib/prisma';
import { isBudgetLossReason } from '../../shared/budgetEnums';

export const followUpsRoutes = Router();

const priorities = ['Alta', 'Media', 'Baja'];
const owners = ['David', 'Luciana'];
const statuses = ['scheduled', 'completed', 'won', 'lost'];

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

followUpsRoutes.get('/', async (req, res, next) => {
  try {
    const followUps = await prisma.manualFollowUp.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: {
        lead: {
          select: {
            customerName: true,
            contactTitle: true,
            contactPhone: true,
            email: true,
            companyName: true,
            notes: true,
            updatedAt: true
          }
        }
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }]
    });
    res.status(200).json(followUps);
  } catch (error) {
    next(error);
  }
});

followUpsRoutes.post('/', async (req, res, next) => {
  const body = req.body as {
    customer?: unknown;
    contactName?: unknown;
    contactTitle?: unknown;
    email?: unknown;
    phone?: unknown;
    reason?: unknown;
    dueAt?: unknown;
    priority?: unknown;
    owner?: unknown;
    refCode?: unknown;
    leadId?: unknown;
    status?: unknown;
    result?: unknown;
    completedAt?: unknown;
    createdAt?: unknown;
  };
  const dueAt = typeof body.dueAt === 'string' ? new Date(body.dueAt) : null;
  if (
    typeof body.customer !== 'string' || !body.customer.trim() || body.customer.length > 200 ||
    typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 2000 ||
    typeof body.dueAt !== 'string' || !dueAt || !Number.isFinite(dueAt.getTime()) ||
    (body.phone !== undefined && (typeof body.phone !== 'string' || body.phone.length > 80)) ||
    (body.contactName !== undefined && (typeof body.contactName !== 'string' || body.contactName.length > 200)) ||
    (body.contactTitle !== undefined && (typeof body.contactTitle !== 'string' || body.contactTitle.length > 200)) ||
    (body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 254 ||
      (body.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())))) ||
    (body.priority !== undefined && !priorities.includes(String(body.priority))) ||
    (body.owner !== undefined && !owners.includes(String(body.owner))) ||
    (body.status !== undefined && !statuses.includes(String(body.status))) ||
    (body.result !== undefined && (typeof body.result !== 'string' || body.result.length > 10000)) ||
    (body.completedAt !== undefined &&
      body.completedAt !== null &&
      (typeof body.completedAt !== 'string' || !Number.isFinite(Date.parse(body.completedAt)))) ||
    (body.createdAt !== undefined &&
      (typeof body.createdAt !== 'string' || !Number.isFinite(Date.parse(body.createdAt)))) ||
    !isOptionalText(body.refCode, 80) ||
    !isOptionalText(body.leadId, 80)
  ) {
    res.status(400).json({ message: 'Datos inválidos para crear el seguimiento.' });
    return;
  }

  try {
    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, organizationId: req.auth!.organizationId },
        select: { id: true }
      });
      if (!lead) {
        res.status(404).json({ message: 'Prospecto asociado no encontrado.' });
        return;
      }
    }
    const owner = typeof body.owner === 'string' ? body.owner : 'David';
    const assignedUser = await prisma.user.findFirst({
      where: { organizationId: req.auth!.organizationId, firstName: owner, role: 'SALES', status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    const followUp = await prisma.manualFollowUp.create({
      data: {
        organizationId: req.auth!.organizationId,
        ...(typeof body.leadId === 'string' ? { leadId: body.leadId } : {}),
        assignedToUserId: assignedUser?.id ?? req.auth!.userId,
        customer: body.customer.trim(),
        contactName: typeof body.contactName === 'string' ? body.contactName.trim() || null : null,
        contactTitle: typeof body.contactTitle === 'string' ? body.contactTitle.trim() || null : null,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null,
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        reason: body.reason.trim(),
        dueAt,
        priority: typeof body.priority === 'string' ? body.priority : 'Media',
        owner,
        status: typeof body.status === 'string' ? body.status : 'scheduled',
        result: typeof body.result === 'string' ? body.result : '',
        completedAt: typeof body.completedAt === 'string' ? new Date(body.completedAt) : null,
        ...(typeof body.createdAt === 'string' ? { createdAt: new Date(body.createdAt) } : {}),
        refCode: typeof body.refCode === 'string' ? body.refCode : null
      },
      include: {
        lead: {
          select: {
            customerName: true,
            contactTitle: true,
            contactPhone: true,
            email: true,
            companyName: true,
            notes: true,
            updatedAt: true
          }
        }
      }
    });
    res.status(201).json(followUp);
  } catch (error) {
    next(error);
  }
});

followUpsRoutes.patch('/:followUpId', async (req, res, next) => {
  const body = req.body as {
    customer?: unknown;
    contactName?: unknown;
    contactTitle?: unknown;
    email?: unknown;
    phone?: unknown;
    reason?: unknown;
    dueAt?: unknown;
    priority?: unknown;
    owner?: unknown;
    status?: unknown;
    result?: unknown;
    refCode?: unknown;
    motivoPerdida?: unknown;
    motivoPerdidaNota?: unknown;
  };
  if (
    (body.customer !== undefined && (typeof body.customer !== 'string' || !body.customer.trim() || body.customer.length > 200)) ||
    (body.phone !== undefined && (typeof body.phone !== 'string' || body.phone.length > 80)) ||
    (body.contactName !== undefined && (typeof body.contactName !== 'string' || body.contactName.length > 200)) ||
    (body.contactTitle !== undefined && (typeof body.contactTitle !== 'string' || body.contactTitle.length > 200)) ||
    (body.email !== undefined && (typeof body.email !== 'string' || body.email.length > 254 ||
      (body.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())))) ||
    (body.reason !== undefined && (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 2000)) ||
    (body.dueAt !== undefined && (typeof body.dueAt !== 'string' || !Number.isFinite(Date.parse(body.dueAt)))) ||
    (body.priority !== undefined && !priorities.includes(String(body.priority))) ||
    (body.owner !== undefined && !owners.includes(String(body.owner))) ||
    (body.status !== undefined && !statuses.includes(String(body.status))) ||
    (body.result !== undefined && (typeof body.result !== 'string' || body.result.length > 10000)) ||
    (body.motivoPerdida !== undefined && !isBudgetLossReason(body.motivoPerdida)) ||
    (body.motivoPerdidaNota !== undefined &&
      (typeof body.motivoPerdidaNota !== 'string' || body.motivoPerdidaNota.length > 2000)) ||
    (body.status === 'lost' &&
      (!isBudgetLossReason(body.motivoPerdida) ||
        typeof body.motivoPerdidaNota !== 'string' ||
        !body.motivoPerdidaNota.trim())) ||
    !isOptionalText(body.refCode, 80)
  ) {
    res.status(400).json({ message: 'Datos inválidos para actualizar el seguimiento.' });
    return;
  }

  try {
    const followUp = await prisma.manualFollowUp.findFirst({
      where: { id: req.params.followUpId, organizationId: req.auth!.organizationId }
    });
    if (!followUp) {
      res.status(404).json({ message: 'Seguimiento no encontrado.' });
      return;
    }
    const resultText = body.status === 'lost'
      ? `Motivo de pérdida: ${body.motivoPerdida}\nNota: ${(body.motivoPerdidaNota as string).trim()}`
      : body.result;
    const updateData = {
      ...(typeof body.customer === 'string' ? { customer: body.customer.trim() } : {}),
      ...(typeof body.contactName === 'string' ? { contactName: body.contactName.trim() || null } : {}),
      ...(typeof body.contactTitle === 'string' ? { contactTitle: body.contactTitle.trim() || null } : {}),
      ...(typeof body.email === 'string' ? { email: body.email.trim().toLowerCase() || null } : {}),
      ...(typeof body.phone === 'string' ? { phone: body.phone.trim() } : {}),
      ...(typeof body.reason === 'string' ? { reason: body.reason.trim() } : {}),
      ...(typeof body.dueAt === 'string' ? { dueAt: new Date(body.dueAt) } : {}),
      ...(typeof body.priority === 'string' ? { priority: body.priority } : {}),
      ...(typeof body.owner === 'string' ? { owner: body.owner } : {}),
      ...(typeof body.status === 'string'
        ? {
            status: body.status,
            completedAt: body.status === 'scheduled' ? null : new Date()
          }
        : {}),
      ...(typeof resultText === 'string' ? { result: resultText } : {}),
      ...(typeof body.refCode === 'string' ? { refCode: body.refCode } : {})
    };
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.manualFollowUp.update({
        where: { id: followUp.id },
        data: updateData,
        include: {
          lead: {
            select: {
              customerName: true,
              contactTitle: true,
              contactPhone: true,
              email: true,
              companyName: true,
              notes: true,
              updatedAt: true
            }
          }
        }
      });
      if ((body.status === 'won' || body.status === 'lost') && followUp.leadId) {
        await tx.manualFollowUp.updateMany({
          where: {
            organizationId: req.auth!.organizationId,
            leadId: followUp.leadId,
            status: 'scheduled',
            id: { not: followUp.id }
          },
          data: {
            status: 'cancelled',
            completedAt: new Date(),
            result: `Cadencia cancelada: oportunidad ${body.status === 'won' ? 'ganada' : 'perdida'}.`
          }
        });
        await tx.lead.updateMany({
          where: { id: followUp.leadId, organizationId: req.auth!.organizationId },
          data: { status: body.status }
        });
        await tx.opportunity.updateMany({
          where: { leadId: followUp.leadId, organizationId: req.auth!.organizationId },
          data: body.status === 'won'
            ? { stage: 'Ganada', wonAt: new Date(), lostAt: null }
            : { stage: 'Perdida', lostAt: new Date(), wonAt: null }
        });
      }
      return saved;
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});
