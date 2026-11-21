import { Router } from 'express';
import { randomUUID } from 'node:crypto';

import prisma from '../../lib/prisma';
import { isBudgetLossReason } from '../../shared/budgetEnums';
import { resolveLeadCustomerIdentity } from '../customers/customers.service';
import { rebaseCadenceDates, shiftCadenceDate } from './cadence';

export const followUpsRoutes = Router();

const priorities = ['Alta', 'Media', 'Baja'];
const owners = ['David', 'Luciana'];
const statuses = ['scheduled', 'completed', 'won', 'lost'];
const outcomes = ['contacted', 'no_answer', 'not_interested', 'follow_up', 'other'] as const;

followUpsRoutes.get('/reactivation-candidates', async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 360 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.completedSale.findMany({
      where: { organizationId: req.auth!.organizationId, purchaseDate: { lt: cutoff } },
      orderBy: [{ purchaseDate: 'asc' }, { company: 'asc' }]
    });
    const candidateEmails = candidates.map((candidate) => candidate.email);
    const scheduled = candidateEmails.length
      ? await prisma.manualFollowUp.findMany({
          where: {
            organizationId: req.auth!.organizationId,
            owner: 'Luciana',
            status: 'scheduled',
            email: { in: candidateEmails },
            reason: { startsWith: 'Reactivación comercial' }
          },
          select: { email: true }
        })
      : [];
    const scheduledEmails = new Set(scheduled.flatMap((item) => item.email ? [item.email] : []));
    res.status(200).json(candidates
      .filter((candidate) => !scheduledEmails.has(candidate.email))
      .map((candidate) => ({
        email: candidate.email,
        phone: candidate.phone,
        company: candidate.company,
        lastPurchaseAt: candidate.purchaseDate
      })));
  } catch (error) {
    next(error);
  }
});

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

followUpsRoutes.get('/', async (req, res, next) => {
  try {
    const followUps = await prisma.manualFollowUp.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: {
        customerAccount: true,
        contact: true,
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
    customerId?: unknown;
    contactId?: unknown;
    entityType?: unknown;
    documentNumber?: unknown;
    contactRelationship?: unknown;
    status?: unknown;
    result?: unknown;
    nextAction?: unknown;
    outcome?: unknown;
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
    (body.customerId !== undefined && (typeof body.customerId !== 'string' || !body.customerId.trim())) ||
    (body.contactId !== undefined && (typeof body.contactId !== 'string' || !body.contactId.trim())) ||
    (body.entityType !== undefined && body.entityType !== 'person' && body.entityType !== 'company') ||
    (body.documentNumber !== undefined &&
      (typeof body.documentNumber !== 'string' || body.documentNumber.trim().length > 80)) ||
    (body.contactRelationship !== undefined &&
      body.contactRelationship !== 'owner' && body.contactRelationship !== 'employee' && body.contactRelationship !== 'other') ||
    (body.entityType === 'company' &&
      (typeof body.contactName !== 'string' || !body.contactName.trim() || body.contactName.length > 200)) ||
    (body.priority !== undefined && !priorities.includes(String(body.priority))) ||
    (body.owner !== undefined && !owners.includes(String(body.owner))) ||
    (body.status !== undefined && !statuses.includes(String(body.status))) ||
    (body.result !== undefined && (typeof body.result !== 'string' || body.result.length > 10000)) ||
    (body.nextAction !== undefined && (typeof body.nextAction !== 'string' || body.nextAction.length > 2000)) ||
    (body.outcome !== undefined && !outcomes.includes(body.outcome as typeof outcomes[number])) ||
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

  const customerName = typeof body.customer === 'string' ? body.customer.trim() : '';
  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : '';
  try {
    let customerId = typeof body.customerId === 'string' ? body.customerId.trim() : undefined;
    let contactId = typeof body.contactId === 'string' ? body.contactId.trim() : undefined;
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: req.auth!.organizationId },
        select: { id: true }
      });
      if (!customer) {
        res.status(404).json({ message: 'Cliente asociado no encontrado.' });
        return;
      }
    }
    if (contactId) {
      const contact = await prisma.customerContact.findFirst({
        where: {
          id: contactId,
          organizationId: req.auth!.organizationId,
          ...(customerId ? { customerId } : {})
        },
        select: { id: true, customerId: true }
      });
      if (!contact) {
        res.status(404).json({ message: 'Contacto asociado no encontrado o no pertenece al cliente indicado.' });
        return;
      }
      customerId = contact.customerId;
    }
    if (body.leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: body.leadId, organizationId: req.auth!.organizationId },
        select: { id: true, customerId: true, contactId: true }
      });
      if (!lead) {
        res.status(404).json({ message: 'Prospecto asociado no encontrado.' });
        return;
      }
      if (
        (customerId && lead.customerId && customerId !== lead.customerId) ||
        (contactId && lead.contactId && contactId !== lead.contactId)
      ) {
        res.status(400).json({ message: 'El cliente o contacto no coincide con el prospecto asociado.' });
        return;
      }
      customerId ??= lead.customerId ?? undefined;
      contactId ??= lead.contactId ?? undefined;
    }
    if (body.entityType === 'person' || body.entityType === 'company') {
      const entityType = body.entityType === 'company' ? 'company' : 'person';
      if (customerId || contactId) {
        res.status(400).json({
          message: 'Envía los identificadores existentes o los datos para resolver la identidad, pero no ambos.'
        });
        return;
      }
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const identity = await prisma.$transaction((tx) => resolveLeadCustomerIdentity(
        tx,
        req.auth!.organizationId,
        {
          entityType,
          fullName: entityType === 'person' ? customerName : contactName,
          ...(entityType === 'company' ? { companyName: customerName } : {}),
          ...(typeof body.documentNumber === 'string' && body.documentNumber.trim()
            ? { documentNumber: body.documentNumber.trim() }
            : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(typeof body.contactTitle === 'string' ? { title: body.contactTitle.trim() } : {}),
          relationship: body.contactRelationship === 'owner' ||
            body.contactRelationship === 'employee' ||
            body.contactRelationship === 'other'
            ? body.contactRelationship
            : 'other'
        }
      ));
      if (identity.ambiguous) {
        res.status(409).json({
          message: 'Hay más de un cliente o contacto con esa identidad. Agrega CUIT/DNI o corrige los datos antes de agendar.'
        });
        return;
      }
      if (
        (customerId && customerId !== identity.customer.id) ||
        (contactId && contactId !== (identity.contact?.id ?? undefined))
      ) {
        res.status(400).json({ message: 'El cliente o contacto no coincide con los datos ingresados.' });
        return;
      }
      customerId = identity.customer.id;
      contactId = identity.contact?.id;
    }
    const owner = typeof body.owner === 'string' ? body.owner : 'David';
    const assignedUser = await prisma.user.findFirst({
      where: { organizationId: req.auth!.organizationId, firstName: owner, role: 'SALES', status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (owner === 'Luciana' && body.reason.trim().startsWith('Reactivación comercial') && email) {
      const existingReactivation = await prisma.manualFollowUp.findFirst({
        where: {
          organizationId: req.auth!.organizationId,
          owner: 'Luciana',
          status: 'scheduled',
          email,
          reason: { startsWith: 'Reactivación comercial' }
        },
        select: { id: true }
      });
      if (existingReactivation) {
        res.status(409).json({ message: 'Ya existe una llamada de reactivación pendiente para este cliente.' });
        return;
      }
    }
    const followUp = await prisma.manualFollowUp.create({
      data: {
        organizationId: req.auth!.organizationId,
        ...(typeof body.leadId === 'string' ? { leadId: body.leadId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(contactId ? { contactId } : {}),
        assignedToUserId: assignedUser?.id ?? req.auth!.userId,
        customer: body.customer.trim(),
        contactName: typeof body.contactName === 'string' ? body.contactName.trim() || null : null,
        contactTitle: typeof body.contactTitle === 'string' ? body.contactTitle.trim() || null : null,
        email: email || null,
        phone: typeof body.phone === 'string' ? body.phone.trim() : '',
        reason: body.reason.trim(),
        dueAt,
        originalDueAt: dueAt,
        priority: typeof body.priority === 'string' ? body.priority : 'Media',
        owner,
        status: typeof body.status === 'string' ? body.status : 'scheduled',
        result: typeof body.result === 'string' ? body.result : '',
        nextAction: typeof body.nextAction === 'string' ? body.nextAction.trim() || null : null,
        ...(outcomes.includes(body.outcome as typeof outcomes[number])
          ? { outcome: body.outcome as typeof outcomes[number] }
          : {}),
        completedAt: typeof body.completedAt === 'string' ? new Date(body.completedAt) : null,
        ...(typeof body.createdAt === 'string' ? { createdAt: new Date(body.createdAt) } : {}),
        refCode: typeof body.refCode === 'string' ? body.refCode : null
      },
      include: {
        customerAccount: true,
        contact: true,
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
    outcome?: unknown;
    nextAction?: unknown;
    refCode?: unknown;
    rescheduleScope?: unknown;
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
    (body.outcome !== undefined && !outcomes.includes(body.outcome as typeof outcomes[number])) ||
    (body.nextAction !== undefined && (typeof body.nextAction !== 'string' || body.nextAction.length > 2000)) ||
    (body.rescheduleScope !== undefined &&
      body.rescheduleScope !== 'cadence' && body.rescheduleScope !== 'single') ||
    (body.motivoPerdida !== undefined && !isBudgetLossReason(body.motivoPerdida)) ||
    (body.motivoPerdidaNota !== undefined &&
      (typeof body.motivoPerdidaNota !== 'string' || body.motivoPerdidaNota.length > 2000)) ||
    (body.status === 'lost' &&
      (!isBudgetLossReason(body.motivoPerdida) ||
        typeof body.motivoPerdidaNota !== 'string' ||
        !body.motivoPerdidaNota.trim())) ||
    (body.status === 'completed' &&
      (typeof body.result !== 'string' || !body.result.trim() ||
        !outcomes.includes(body.outcome as typeof outcomes[number]))) ||
    !isOptionalText(body.refCode, 80)
  ) {
    res.status(400).json({ message: 'Datos inválidos para actualizar el seguimiento.' });
    return;
  }

  try {
    const resultText = body.status === 'lost'
      ? `Motivo de pérdida: ${body.motivoPerdida}\nNota: ${(body.motivoPerdidaNota as string).trim()}`
      : body.result;
    const completedAt = body.status === 'completed' ? new Date() : undefined;
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.manualFollowUp.findFirst({
        where: { id: req.params.followUpId, organizationId: req.auth!.organizationId }
      });
      if (!current) return { notFound: true as const };

      const upcoming = current.cadenceId && current.cadenceStep !== null
        ? await tx.manualFollowUp.findMany({
            where: {
              organizationId: req.auth!.organizationId,
              cadenceId: current.cadenceId,
              cadenceStep: { gt: current.cadenceStep },
              status: 'scheduled'
            },
            orderBy: { cadenceStep: 'asc' },
            select: { id: true, dueAt: true, cadenceOffsetDays: true }
          })
        : [];
      if (
        body.status === 'completed' &&
        upcoming.length > 0 &&
        !(typeof body.nextAction === 'string' && body.nextAction.trim()) &&
        !(current.nextAction?.trim())
      ) {
        return { nextActionRequired: true as const };
      }

      const dueAt = typeof body.dueAt === 'string' ? new Date(body.dueAt) : undefined;
      const dueAtDelta = dueAt ? dueAt.getTime() - current.dueAt.getTime() : 0;
      const updateData = {
        ...(typeof body.customer === 'string' ? { customer: body.customer.trim() } : {}),
        ...(typeof body.contactName === 'string' ? { contactName: body.contactName.trim() || null } : {}),
        ...(typeof body.contactTitle === 'string' ? { contactTitle: body.contactTitle.trim() || null } : {}),
        ...(typeof body.email === 'string' ? { email: body.email.trim().toLowerCase() || null } : {}),
        ...(typeof body.phone === 'string' ? { phone: body.phone.trim() } : {}),
        ...(typeof body.reason === 'string' ? { reason: body.reason.trim() } : {}),
        ...(dueAt ? { dueAt } : {}),
        ...(typeof body.priority === 'string' ? { priority: body.priority } : {}),
        ...(typeof body.owner === 'string' ? { owner: body.owner } : {}),
        ...(typeof body.status === 'string'
          ? {
              status: body.status,
              completedAt: body.status === 'scheduled' ? null : completedAt ?? new Date(),
              ...(body.status === 'scheduled' ? { outcome: null } : {})
            }
          : {}),
        ...(typeof resultText === 'string' ? { result: resultText } : {}),
        ...(typeof body.outcome === 'string' ? { outcome: body.outcome } : {}),
        ...(typeof body.nextAction === 'string' ? { nextAction: body.nextAction.trim() || null } : {}),
        ...(typeof body.refCode === 'string' ? { refCode: body.refCode } : {})
      };
      const saved = await tx.manualFollowUp.update({
        where: { id: current.id },
        data: updateData,
        include: {
          customerAccount: true,
          contact: true,
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

      if (
        dueAt &&
        dueAtDelta !== 0 &&
        current.status === 'scheduled' &&
        body.status !== 'completed'
      ) {
        const changeGroupId = randomUUID();
        const scope = body.rescheduleScope === 'single' ? 'single' : 'cadence';
        const scheduleChanges: Array<{
          id: string;
          organizationId: string;
          followUpId: string;
          changedByUserId: string;
          changeGroupId: string;
          previousDueAt: Date;
          newDueAt: Date;
          changeReason: string;
        }> = [{
          id: randomUUID(),
          organizationId: req.auth!.organizationId,
          followUpId: current.id,
          changedByUserId: req.auth!.userId,
          changeGroupId,
          previousDueAt: current.dueAt,
          newDueAt: dueAt,
          changeReason: 'user_rescheduled'
        }];
        if (scope === 'cadence' && current.cadenceId && current.cadenceStep !== null) {
          const shifted = upcoming.map((item) => ({
            ...item,
            newDueAt: shiftCadenceDate(item.dueAt, dueAtDelta)
          }));
          for (const item of shifted) {
            await tx.manualFollowUp.update({
              where: { id: item.id },
              data: { dueAt: item.newDueAt }
            });
            scheduleChanges.push({
              id: randomUUID(),
              organizationId: req.auth!.organizationId,
              followUpId: item.id,
              changedByUserId: req.auth!.userId,
              changeGroupId,
              previousDueAt: item.dueAt,
              newDueAt: item.newDueAt,
              changeReason: 'cadence_shifted'
            });
          }
        }
        await tx.manualFollowUpScheduleChange.createMany({ data: scheduleChanges });
      }

      if (
        body.status === 'completed' &&
        current.status === 'scheduled' &&
        completedAt &&
        current.cadenceId &&
        current.cadenceOffsetDays !== null
      ) {
        const cadenceUpcoming = upcoming.filter(
          (item): item is typeof item & { cadenceOffsetDays: number } => item.cadenceOffsetDays !== null
        );
        const rebased = rebaseCadenceDates(
          completedAt,
          current.cadenceOffsetDays,
          cadenceUpcoming
        );
        const changeGroupId = randomUUID();
        const scheduleChanges = [];
        for (const [index, item] of rebased.entries()) {
          const nextAction = typeof body.nextAction === 'string' && body.nextAction.trim()
            ? body.nextAction.trim()
            : current.nextAction?.trim();
          await tx.manualFollowUp.update({
            where: { id: item.id },
            data: {
              dueAt: item.newDueAt,
              ...(index === 0 && nextAction ? { reason: nextAction } : {})
            }
          });
          if (item.previousDueAt.getTime() !== item.newDueAt.getTime()) {
            scheduleChanges.push({
              id: randomUUID(),
              organizationId: req.auth!.organizationId,
              followUpId: item.id,
              changedByUserId: req.auth!.userId,
              changeGroupId,
              previousDueAt: item.previousDueAt,
              newDueAt: item.newDueAt,
              changeReason: 'cadence_rebased_after_completion'
            });
          }
        }
        if (scheduleChanges.length) {
          await tx.manualFollowUpScheduleChange.createMany({ data: scheduleChanges });
        }
      }

      if ((body.status === 'won' || body.status === 'lost') && current.leadId) {
        await tx.manualFollowUp.updateMany({
          where: {
            organizationId: req.auth!.organizationId,
            leadId: current.leadId,
            status: 'scheduled',
            id: { not: current.id }
          },
          data: {
            status: 'cancelled',
            completedAt: new Date(),
            result: `Cadencia cancelada: oportunidad ${body.status === 'won' ? 'ganada' : 'perdida'}.`
          }
        });
        await tx.lead.updateMany({
          where: { id: current.leadId, organizationId: req.auth!.organizationId },
          data: { status: body.status }
        });
        await tx.opportunity.updateMany({
          where: { leadId: current.leadId, organizationId: req.auth!.organizationId },
          data: body.status === 'won'
            ? { stage: 'Ganada', wonAt: new Date(), lostAt: null }
            : { stage: 'Perdida', lostAt: new Date(), wonAt: null }
        });
      }
      return { followUp: saved };
    });
    if ('notFound' in result) {
      res.status(404).json({ message: 'Seguimiento no encontrado.' });
      return;
    }
    if ('nextActionRequired' in result) {
      res.status(400).json({ message: 'Indica la próxima acción antes de completar este paso de la cadencia.' });
      return;
    }
    res.status(200).json(result.followUp);
  } catch (error) {
    next(error);
  }
});
