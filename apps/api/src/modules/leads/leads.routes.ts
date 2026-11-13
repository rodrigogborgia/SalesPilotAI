import { Router } from 'express';
import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';
import { getMonthlyCommercialKpis } from '../analytics/commercialKpis.service';

export const leadsRoutes = Router();

const salesCadence = [
  { day: 2, message: 'Primer contacto de seguimiento · 48 horas.' },
  { day: 7, message: 'Segundo seguimiento comercial.' },
  { day: 14, message: 'Tercer seguimiento comercial.' },
  { day: 21, message: 'Cuarto seguimiento comercial.' },
  { day: 30, message: 'Quinto seguimiento comercial.' },
  { day: 45, message: 'Sexto seguimiento comercial.' },
  { day: 60, message: 'Séptimo seguimiento comercial.' }
] as const;

const leadSources = [
  'WhatsApp Meta - 8 Cheques',
  'WhatsApp Meta - Galicia',
  'Remarketing Inactivos',
  'Web / Formulario',
  'Correo Electrónico',
  'Redes Sociales (IG/FB)',
  'Outbound / Guía Industria',
  'Referido / Cliente Actual',
  'Otro'
] as const;
const customerTypes = ['new', 'active', 'reactivated', 'unknown'] as const;
const requestTypes = ['new_equipment', 'service_maintenance', 'spare_parts', 'engineering', 'other'] as const;

function nonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validOptionalString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

leadsRoutes.get('/my-monthly-kpis', async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: {
        id: req.auth!.userId,
        organizationId: req.auth!.organizationId,
        status: 'active',
        role: 'SALES'
      },
      select: { firstName: true }
    });
    if (!user || (user.firstName !== 'David' && user.firstName !== 'Luciana')) {
      res.status(403).json({ message: 'No hay indicadores personales disponibles para este usuario.' });
      return;
    }

    const monthlyKpis = await getMonthlyCommercialKpis(req.auth!.organizationId);
    const personalMetrics = monthlyKpis.people.find((person) => person.owner === user.firstName);
    if (!personalMetrics) throw new Error('No se pudieron obtener los indicadores mensuales del usuario.');
    res.status(200).json({ monthStart: monthlyKpis.monthStart, ...personalMetrics });
  } catch (error) {
    next(error);
  }
});

leadsRoutes.get('/', async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { organizationId: req.auth!.organizationId },
      include: {
        opportunities: true,
        product: { select: { id: true, sku: true, name: true } },
        assignedToUser: { select: { id: true, firstName: true } }
      },
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
    source?: unknown;
    sourceCampaign?: unknown;
    customerType?: unknown;
    requestType?: unknown;
    productId?: unknown;
    equipmentQuantity?: unknown;
  };
  const amount = body.estimatedAmount;
  const numericAmount = typeof amount === 'number' || typeof amount === 'string' ? Number(amount) : 0;
  const equipmentQuantity = body.equipmentQuantity === undefined ? 1 : Number(body.equipmentQuantity);

  if (
    !nonEmptyString(body.customerName, 200) ||
    !validOptionalString(body.contactTitle, 200) ||
    !validOptionalString(body.companyName, 200) ||
    !validOptionalString(body.phone, 80) ||
    !validOptionalString(body.email, 254) ||
    (typeof body.email === 'string' && body.email.trim() !== '' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) ||
    !validOptionalString(body.productInterest, 200) ||
    (body.source !== undefined && !leadSources.includes(body.source as typeof leadSources[number])) ||
    !validOptionalString(body.sourceCampaign, 200) ||
    (body.customerType !== undefined && !customerTypes.includes(body.customerType as typeof customerTypes[number])) ||
    (body.requestType !== undefined && !requestTypes.includes(body.requestType as typeof requestTypes[number])) ||
    (body.productId !== undefined && body.productId !== null &&
      (typeof body.productId !== 'string' || body.productId.length > 80)) ||
    !Number.isInteger(equipmentQuantity) || equipmentQuantity < 0 || equipmentQuantity > 10000 ||
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
      const currentUser = await tx.user.findFirst({
        where: {
          id: req.auth!.userId,
          organizationId: req.auth!.organizationId,
          status: 'active'
        },
        select: { id: true, firstName: true }
      });
      const defaultOwnerName = currentUser?.firstName === 'Luciana' ? 'Luciana' : 'David';
      const assignedUser = currentUser?.firstName === 'David' || currentUser?.firstName === 'Luciana'
        ? currentUser
        : await tx.user.findFirst({
            where: {
              organizationId: req.auth!.organizationId,
              firstName: defaultOwnerName,
              role: 'SALES',
              status: 'active'
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true, firstName: true }
          });
      let product = null;
      if (typeof body.productId === 'string' && body.productId.trim()) {
        product = await tx.product.findFirst({
          where: {
            id: body.productId.trim(),
            organizationId: req.auth!.organizationId,
            isActive: true
          },
          select: { id: true, name: true }
        });
        if (!product) return { productUnavailable: true as const };
      }
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      let customerType = typeof body.customerType === 'string' ? body.customerType : 'unknown';
      if (customerType === 'unknown' && email) {
        const lastSale = await tx.completedSale.findUnique({
          where: { organizationId_email: { organizationId: req.auth!.organizationId, email } },
          select: { purchaseDate: true }
        });
        if (lastSale) {
          customerType = Date.now() - lastSale.purchaseDate.getTime() > 360 * 24 * 60 * 60 * 1000
            ? 'reactivated'
            : 'active';
        }
      }
      const productName = product?.name ??
        (typeof body.productInterest === 'string' ? body.productInterest.trim() : '');
      const ownerId = assignedUser?.id ?? req.auth!.userId;
      const ownerName = assignedUser?.firstName ?? defaultOwnerName;
      const lead = await tx.lead.create({
        data: {
          organizationId: req.auth!.organizationId,
          assignedToUserId: ownerId,
          source: typeof body.source === 'string' ? body.source : 'manual_quick_add',
          sourceCampaign: typeof body.sourceCampaign === 'string' ? body.sourceCampaign.trim() || null : null,
          customerName,
          contactTitle: typeof body.contactTitle === 'string' ? body.contactTitle.trim() || null : null,
          companyName: typeof body.companyName === 'string' ? body.companyName.trim() || null : null,
          contactPhone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
          email: email || null,
          customerType,
          requestType: typeof body.requestType === 'string' ? body.requestType : 'new_equipment',
          productId: product?.id ?? null,
          equipmentQuantity,
          productInterest: productName || null,
          estimatedAmount: new Prisma.Decimal(numericAmount),
          notes: typeof body.sourceMessage === 'string' ? body.sourceMessage.trim() || null : null
        }
      });
      const amountValue = new Prisma.Decimal(numericAmount);
      const opportunity = await tx.opportunity.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          productId: product?.id ?? null,
          salesOwnerUserId: ownerId,
          stage: 'new',
          amount: amountValue,
          probability: 10,
          notes: productName ? `Producto de interés: ${productName}` : null
        }
      });
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + salesCadence[0].day);
      const followUp = await tx.manualFollowUp.create({
        data: {
          organizationId: req.auth!.organizationId,
          leadId: lead.id,
          assignedToUserId: ownerId,
          customer: lead.companyName ?? lead.customerName,
          contactName: lead.customerName,
          contactTitle: lead.contactTitle,
          email: lead.email,
          phone: lead.contactPhone ?? '',
          reason: `${salesCadence[0].message} · ${productName || 'nuevo prospecto'}`,
          dueAt,
          priority: 'Media',
          owner: ownerName
        }
      });
      await tx.manualFollowUp.createMany({
        data: salesCadence.slice(1).map(({ day, message }) => {
          const scheduledAt = new Date();
          scheduledAt.setDate(scheduledAt.getDate() + day);
          return {
            organizationId: req.auth!.organizationId,
            leadId: lead.id,
            assignedToUserId: ownerId,
            customer: lead.companyName ?? lead.customerName,
            contactName: lead.customerName,
            contactTitle: lead.contactTitle,
            email: lead.email,
            phone: lead.contactPhone ?? '',
            reason: `${message} · ${productName || 'nuevo prospecto'}`,
            dueAt: scheduledAt,
            priority: 'Media',
            owner: ownerName
          };
        })
      });
      return { lead, opportunity, followUp, followUps: salesCadence.length };
    });
    if ('productUnavailable' in result) {
      res.status(404).json({ message: 'El producto seleccionado ya no está disponible en el catálogo.' });
      return;
    }
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
        where: { id: req.params.leadId, organizationId: req.auth!.organizationId },
        include: { assignedToUser: { select: { firstName: true } } }
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
            quotedAt: new Date(),
            productId: lead.productId,
            amount: lead.estimatedAmount ?? new Prisma.Decimal(0),
            probability: 50
          }
        });
      }

      await tx.lead.update({ where: { id: lead.id }, data: { status: stage } });
      if (opportunity) {
        await tx.opportunity.update({
          where: { id: opportunity.id },
          data: { quotedAt: opportunity.quotedAt ?? new Date(), productId: lead.productId }
        });
      }
      const existingCadence = await tx.manualFollowUp.count({
        where: { organizationId: req.auth!.organizationId, leadId: lead.id }
      });
      if (existingCadence < salesCadence.length) {
        const assignedUser = await tx.user.findFirst({
          where: {
            organizationId: req.auth!.organizationId,
            firstName: lead.assignedToUser?.firstName ?? 'David',
            role: 'SALES',
            status: 'active'
          },
          orderBy: { createdAt: 'asc' }
        });
        const assignedToUserId = assignedUser?.id ?? lead.assignedToUserId ?? req.auth!.userId;
        await tx.manualFollowUp.createMany({
          data: salesCadence.slice(existingCadence).map(({ day, message }) => {
            const scheduledAt = new Date(lead.createdAt);
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
              owner: assignedUser?.firstName === 'Luciana' ? 'Luciana' : 'David'
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
