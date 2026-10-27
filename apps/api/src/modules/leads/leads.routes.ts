import { Router } from 'express';
import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';

export const leadsRoutes = Router();

const salesCadence = [
  { day: 3, message: 'Primer re-contacto comercial.' },
  { day: 7, message: 'Segundo re-contacto comercial.' },
  { day: 15, message: 'Tercer re-contacto comercial.' },
  { day: 21, message: 'Cuarto re-contacto comercial.' },
  { day: 30, message: 'Quinto re-contacto comercial.' },
  { day: 45, message: 'Sexto re-contacto comercial.' },
  { day: 60, message: 'Séptimo re-contacto comercial.' }
] as const;

function nonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validOptionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

leadsRoutes.get('/', async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: { opportunities: true },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(leads);
  } catch (error) {
    next(error);
  }
});

leadsRoutes.post('/', async (req, res, next) => {
  const body = req.body as {
    customerName?: unknown;
    contactTitle?: unknown;
    companyName?: unknown;
    phone?: unknown;
    email?: unknown;
    productInterest?: unknown;
    estimatedAmount?: unknown;
    sourceMessage?: unknown;
  };
  const amount = body.estimatedAmount;
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : 0;

  if (
    !nonEmptyString(body.customerName, 200) ||
    !validOptionalString(body.contactTitle, 200) ||
    !validOptionalString(body.companyName, 200) ||
    !validOptionalString(body.phone, 80) ||
    !validOptionalString(body.email, 254) ||
    (typeof body.email === 'string' && body.email.trim() !== '' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) ||
    !validOptionalString(body.productInterest, 200) ||
    !Number.isFinite(numericAmount) ||
    numericAmount < 0 ||
    !validOptionalString(body.sourceMessage, 10000)
  ) {
    res.status(400).json({ message: 'Datos inválidos para crear el prospecto.' });
    return;
  }
  const customerName = body.customerName.trim();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const david = await tx.user.findFirst({
        where: {
          organizationId: req.auth!.organizationId,
          firstName: { equals: 'David' },
          role: 'SALES',
          status: 'active'
        },
        orderBy: { createdAt: 'asc' }
      });
      const lead = await tx.lead.create({
        data: {
          organizationId: req.auth!.organizationId,
          assignedToUserId: david?.id ?? req.auth!.userId,
          source: 'manual_quick_add',
          customerName,
          contactTitle: typeof body.contactTitle === 'string' ? body.contactTitle.trim() || null : null,
          companyName: typeof body.companyName === 'string' ? body.companyName.trim() || null : null,
          contactPhone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
          email: typeof body.email === 'string' ? body.email.trim() || null : null,
          productInterest: typeof body.productInterest === 'string' ? body.productInterest.trim() || null : null,
          estimatedAmount: new Prisma.Decimal(numericAmount),
          notes: typeof body.sourceMessage === 'string' ? body.sourceMessage.trim() || null : null
        }
      });
      const amountValue = new Prisma.Decimal(numericAmount);
      const opportunity = await tx.opportunity.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          salesOwnerUserId: david?.id ?? req.auth!.userId,
          stage: 'new',
          amount: amountValue,
          probability: 10,
          notes: lead.productInterest ? `Producto de interés: ${lead.productInterest}` : null
        }
      });
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 3);
      const followUp = await tx.manualFollowUp.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          assignedToUserId: david?.id ?? req.auth!.userId,
          customer: lead.companyName ?? lead.customerName,
          contactName: lead.customerName,
          contactTitle: lead.contactTitle,
          email: lead.email,
          phone: lead.contactPhone ?? '',
          reason: `Primer seguimiento · ${lead.productInterest ?? 'nuevo prospecto'}`,
          dueAt,
          priority: 'Media',
          owner: 'David'
        }
      });
      await tx.manualFollowUp.createMany({
        data: salesCadence.slice(1).map(({ day, message }) => {
          const scheduledAt = new Date();
          scheduledAt.setDate(scheduledAt.getDate() + day);
          return {
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            assignedToUserId: david?.id ?? req.auth!.userId,
            customer: lead.companyName ?? lead.customerName,
            contactName: lead.customerName,
            contactTitle: lead.contactTitle,
            email: lead.email,
            phone: lead.contactPhone ?? '',
            reason: `${message} · ${lead.productInterest ?? 'nuevo prospecto'}`,
            dueAt: scheduledAt,
            priority: 'Media',
            owner: 'David'
          };
        })
      });
      return { lead, opportunity, followUp, followUps: 7 };
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

leadsRoutes.patch('/:leadId/stage', async (req, res, next) => {
  const body = req.body as { stage?: unknown };
  if (body.stage !== '03 - Cotizado') {
    res.status(400).json({ message: 'La etapa indicada no es válida.' });
    return;
  }
  const stage = '03 - Cotizado';

  try {
    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id: req.params.leadId, organizationId: req.auth!.organizationId }
      });
      if (!lead) return null;

      const opportunity = await tx.opportunity.findFirst({
        where: { leadId: lead.id, organizationId: req.auth!.organizationId }
      });
      if (opportunity) {
        await tx.opportunity.update({
          where: { id: opportunity.id },
          data: { stage }
        });
      } else {
        await tx.opportunity.create({
          data: {
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            salesOwnerUserId: lead.assignedToUserId ?? req.auth!.userId,
            stage,
            amount: lead.estimatedAmount ?? new Prisma.Decimal(0),
            probability: 50
          }
        });
      }

      await tx.lead.update({ where: { id: lead.id }, data: { status: stage } });
      const existingCadence = await tx.manualFollowUp.count({
        where: { organizationId: req.auth!.organizationId, leadId: lead.id }
      });
      if (existingCadence < salesCadence.length) {
        const david = await tx.user.findFirst({
          where: {
            organizationId: req.auth!.organizationId,
            firstName: 'David',
            role: 'SALES',
            status: 'active'
          },
          orderBy: { createdAt: 'asc' }
        });
        const assignedToUserId = david?.id ?? lead.assignedToUserId ?? req.auth!.userId;
        const dueAt = new Date();
        await tx.manualFollowUp.createMany({
          data: salesCadence.slice(existingCadence).map(({ day, message }) => {
            const scheduledAt = new Date(dueAt);
            scheduledAt.setDate(scheduledAt.getDate() + day);
            return {
              organizationId: req.auth!.organizationId,
              leadId: lead.id,
              assignedToUserId,
              customer: lead.companyName ?? lead.customerName,
              phone: lead.contactPhone ?? '',
              reason: `${message} · ${lead.productInterest ?? 'oportunidad cotizada'}`,
              dueAt: scheduledAt,
              priority: 'Media',
              owner: 'David'
            };
          })
        });
      }

      return { leadId: lead.id, stage };
    });
    if (!result) {
      res.status(404).json({ message: 'Prospecto no encontrado.' });
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
