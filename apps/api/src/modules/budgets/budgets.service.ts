import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';
import { BudgetStatus } from '../../shared/budgetEnums';

const cadence = [
  { dayNumber: 3, message: 'Confirmación de lectura del presupuesto.' },
  { dayNumber: 7, message: 'Consulta sobre financiación en cheques.' },
  { dayNumber: 15, message: 'Cierre de cartera o pase a 05 - Stand-By.' }
] as const;

export type CreateVoiceMinuteInput = {
  userId: string;
  equipmentId: string;
  budgetId?: string;
  status: BudgetStatus;
  amount: string;
  motivoPerdida?: string;
  nextAction?: string;
  horometerHours: string;
  transcript?: string;
};

async function createCadence(tx: Prisma.TransactionClient, budgetId: string, organizationId: string) {
  const dueAt = new Date();
  await tx.budgetFollowUp.createMany({
    data: cadence.map(({ dayNumber, message }) => ({
      organizationId,
      budgetId,
      dayNumber,
      dueAt: new Date(dueAt.getTime() + dayNumber * 24 * 60 * 60 * 1000),
      message
    }))
  });
}

async function cancelScheduledCadence(tx: Prisma.TransactionClient, budgetId: string) {
  await tx.budgetFollowUp.updateMany({
    where: { budgetId, status: 'scheduled' },
    data: { status: 'cancelled' }
  });
}

async function buildOrderPayload(tx: Prisma.TransactionClient, budgetId: string) {
  const budget = await tx.budget.findUnique({
    where: { id: budgetId },
    include: {
      customer: true,
      installedEquipment: { include: { product: true } }
    }
  });
  if (!budget || budget.status !== BudgetStatus.WON) return null;

  return {
    schemaVersion: '1.0',
    orderType: 'sales_order',
    sourceSystem: 'SalesPilotAI',
    generatedAt: new Date().toISOString(),
    orderNumber: `SPA-${budget.id}`,
    currency: 'ARS',
    budget: {
      id: budget.id,
      status: budget.status,
      amount: budget.amount.toString(),
      nextAction: budget.nextAction
    },
    customer: {
      id: budget.customer.id,
      name: budget.customer.companyName ?? budget.customer.fullName,
      taxId: budget.customer.documentNumber,
      email: budget.customer.corporateEmail ?? budget.customer.email,
      phone: budget.customer.phone,
      address: budget.customer.address
    },
    items: budget.installedEquipment ? [{
      sku: budget.installedEquipment.product.sku,
      description: budget.installedEquipment.product.name,
      equipmentId: budget.installedEquipment.id,
      serialNumber: budget.installedEquipment.serialNumber,
      quantity: 1,
      unitPrice: budget.amount.toString()
    }] : [],
    integration: { status: 'pending', target: null }
  };
}

async function saveOrderExport(tx: Prisma.TransactionClient, organizationId: string, budgetId: string) {
  const payload = await buildOrderPayload(tx, budgetId);
  if (!payload) return null;
  return tx.budgetOrderExport.create({
    data: { organizationId, budgetId, payload }
  });
}

export const budgetsService = {
  list(organizationId: string) {
    return prisma.budget.findMany({
      where: { organizationId },
      include: {
        customer: { select: { id: true, fullName: true, companyName: true } },
        installedEquipment: { select: { id: true, model: true, serialNumber: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
  },

  async updateStatus(
    organizationId: string,
    budgetId: string,
    status: BudgetStatus,
    motivoPerdida?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const budget = await tx.budget.findFirst({ where: { id: budgetId, organizationId } });
      if (!budget) return { count: 0 };
      await tx.budget.update({
        where: { id: budget.id },
        data: {
          status,
          motivoPerdida: status === BudgetStatus.LOST ? motivoPerdida ?? null : null
        }
      });
      if (status !== BudgetStatus.SENT && status !== BudgetStatus.FOLLOW_UP) {
        await cancelScheduledCadence(tx, budget.id);
      }
      if (status === BudgetStatus.WON && budget.status !== BudgetStatus.WON) {
        await saveOrderExport(tx, organizationId, budget.id);
      }
      return { count: 1 };
    });
  },

  async getOrderExport(organizationId: string, budgetId: string) {
    return prisma.$transaction(async (tx) => {
      const budget = await tx.budget.findFirst({ where: { id: budgetId, organizationId } });
      if (!budget || budget.status !== BudgetStatus.WON) return null;

      const existing = await tx.budgetOrderExport.findFirst({
        where: { organizationId, budgetId },
        orderBy: { exportedAt: 'desc' }
      });
      if (existing) return existing;
      return saveOrderExport(tx, organizationId, budgetId);
    });
  },

  async listFollowUps(organizationId: string) {
    await this.processDueFollowUps(organizationId);
    return prisma.budgetFollowUp.findMany({
      where: {
        organizationId,
        budget: { status: { in: [BudgetStatus.SENT, BudgetStatus.FOLLOW_UP] } }
      },
      include: {
        budget: {
          include: {
            customer: { select: { companyName: true, fullName: true } },
            installedEquipment: { select: { model: true } }
          }
        }
      },
      orderBy: [{ dueAt: 'asc' }, { dayNumber: 'asc' }]
    });
  },

  async processDueFollowUps(organizationId?: string) {
    const due = await prisma.budgetFollowUp.findMany({
      where: {
        status: 'scheduled',
        dueAt: { lte: new Date() },
        ...(organizationId ? { organizationId } : {}),
        budget: { status: { in: [BudgetStatus.SENT, BudgetStatus.FOLLOW_UP] } }
      },
      select: { id: true, organizationId: true, budgetId: true, dayNumber: true }
    });
    for (const followUp of due) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.budgetFollowUp.updateMany({
          where: { id: followUp.id, status: 'scheduled' },
          data: { status: 'sent', processedAt: new Date() }
        });
        if (updated.count && followUp.dayNumber === 15) {
          await tx.budget.updateMany({
            where: {
              id: followUp.budgetId,
              organizationId: followUp.organizationId,
              status: { in: [BudgetStatus.SENT, BudgetStatus.FOLLOW_UP] }
            },
            data: { status: BudgetStatus.STANDBY }
          });
        }
      });
    }
    return due.length;
  },

  async saveVoiceMinute(organizationId: string, input: CreateVoiceMinuteInput) {
    return prisma.$transaction(async (tx) => {
      const equipment = await tx.installedEquipment.findFirst({
        where: { id: input.equipmentId, organizationId },
        include: { customer: true }
      });

      if (!equipment) return null;

      const budgetData = {
        status: input.status,
        amount: new Prisma.Decimal(input.amount),
        motivoPerdida: input.status === BudgetStatus.LOST ? input.motivoPerdida ?? null : null,
        nextAction: input.nextAction?.trim() || null
      };

      let budget;
      let previousStatus: string | undefined;
      if (input.budgetId) {
        const existingBudget = await tx.budget.findFirst({
          where: {
            id: input.budgetId,
            organizationId,
            customerId: equipment.customerId
          }
        });
        if (!existingBudget) return null;
        previousStatus = existingBudget.status;
        budget = await tx.budget.update({
          where: { id: existingBudget.id },
          data: { ...budgetData, installedEquipmentId: equipment.id },
          include: {
            customer: { select: { id: true, fullName: true, companyName: true } },
            installedEquipment: { select: { id: true, model: true, serialNumber: true } }
          }
        });
      } else {
        budget = await tx.budget.create({
          data: {
            ...budgetData,
            organizationId,
            customerId: equipment.customerId,
            installedEquipmentId: equipment.id
          },
          include: {
            customer: { select: { id: true, fullName: true, companyName: true } },
            installedEquipment: { select: { id: true, model: true, serialNumber: true } }
          }
        });
        previousStatus = undefined;
        await createCadence(tx, budget.id, organizationId);
      }
      if (input.status === BudgetStatus.WON && previousStatus !== BudgetStatus.WON) {
        await saveOrderExport(tx, organizationId, budget.id);
      }
      if (input.status !== BudgetStatus.SENT && input.status !== BudgetStatus.FOLLOW_UP) {
        await cancelScheduledCadence(tx, budget.id);
      }

      const currentHours = new Prisma.Decimal(input.horometerHours);
      const [updatedEquipment, updatedCustomer, minute] = await Promise.all([
        tx.installedEquipment.update({
          where: { id: equipment.id },
          data: { currentHours }
        }),
        tx.customer.update({
          where: { id: equipment.customerId },
          data: { lastContactAt: new Date() }
        }),
        tx.voiceMinute.create({
          data: {
            organizationId,
            customerId: equipment.customerId,
            installedEquipmentId: equipment.id,
            budgetId: budget.id,
            userId: input.userId,
            transcript: input.transcript?.trim() || null,
            horometerHours: currentHours,
            nextAction: input.nextAction?.trim() || null
          }
        })
      ]);

      return {
        budget,
        minute,
        equipment: {
          id: updatedEquipment.id,
          currentHours: updatedEquipment.currentHours,
          customerId: updatedCustomer.id,
          lastContactAt: updatedCustomer.lastContactAt
        }
      };
    });
  }
};
