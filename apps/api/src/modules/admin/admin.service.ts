import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';

function dateFilter(days: number) {
  return days > 0 ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } : undefined;
}

export const adminService = {
  async getDashboard(organizationId: string, days: number) {
    const createdAt = dateFilter(days);
    const now = new Date();
    const previousCreatedAt = days > 0
      ? { gte: new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000), lt: new Date(now.getTime() - days * 24 * 60 * 60 * 1000) }
      : undefined;
    const [budgets, minutes, criticalEquipment, autonomousFollowUps, derivations, orderExports, previousFollowUps, previousDerivations, previousOrderExports] = await Promise.all([
      prisma.budget.findMany({
        where: { organizationId, ...(createdAt ? { createdAt } : {}) },
        include: { customer: { select: { companyName: true, fullName: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.voiceMinute.findMany({
        where: { organizationId, ...(createdAt ? { createdAt } : {}) },
        include: {
          user: { select: { firstName: true } },
          customer: { select: { companyName: true, fullName: true } },
          installedEquipment: { select: { model: true, serialNumber: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.installedEquipment.findMany({
        where: { organizationId, currentHours: { gt: new Prisma.Decimal(4000) } },
        include: {
          customer: { select: { companyName: true, fullName: true } }
        },
        orderBy: { currentHours: 'desc' }
      }),
      prisma.budgetFollowUp.findMany({
        where: { organizationId, status: 'sent', ...(createdAt ? { processedAt: createdAt } : {}) },
        select: { id: true, dayNumber: true, message: true, processedAt: true, budgetId: true }
      }),
      prisma.copilotReference.findMany({
        where: { organizationId, ...(createdAt ? { createdAt } : {}) },
        select: { id: true, refCode: true, summary: true, createdAt: true }
      }),
      prisma.budgetOrderExport.findMany({
        where: { organizationId, ...(createdAt ? { exportedAt: createdAt } : {}) },
        select: { id: true, budgetId: true, exportedAt: true },
        orderBy: { exportedAt: 'desc' }
      }),
      prisma.budgetFollowUp.count({
        where: { organizationId, status: 'sent', ...(previousCreatedAt ? { processedAt: previousCreatedAt } : {}) }
      }),
      prisma.copilotReference.count({
        where: { organizationId, ...(previousCreatedAt ? { createdAt: previousCreatedAt } : {}) }
      }),
      prisma.budgetOrderExport.count({
        where: { organizationId, ...(previousCreatedAt ? { exportedAt: previousCreatedAt } : {}) }
      })
    ]);

    const lossTotals = new Map<string, number>();
    for (const budget of budgets) {
      if (budget.status === '04 - Perdido' && budget.motivoPerdida) {
        lossTotals.set(budget.motivoPerdida, (lossTotals.get(budget.motivoPerdida) ?? 0) + 1);
      }
    }

    const minutesByOwner = new Map<string, number>();
    for (const minute of minutes) {
      const name = minute.user?.firstName ?? 'Sin asignar';
      minutesByOwner.set(name, (minutesByOwner.get(name) ?? 0) + 1);
    }

    const wonBudgets = budgets.filter((budget) => budget.status === '03 - Ganado');
    return {
      rangeDays: days,
      budgetCount: budgets.length,
      issuedAmount: budgets.reduce((total, budget) => total + Number(budget.amount), 0),
      wonCount: wonBudgets.length,
      wonAmount: wonBudgets.reduce((total, budget) => total + Number(budget.amount), 0),
      minuteCount: minutes.length,
      minutesByOwner: Array.from(minutesByOwner, ([name, count]) => ({ name, count })),
      criticalEquipmentCount: criticalEquipment.length,
      lossReasons: Array.from(lossTotals, ([reason, count]) => ({ reason, count }))
        .sort((left, right) => right.count - left.count),
      autonomousFollowUpCount: autonomousFollowUps.length,
      autonomousFollowUps,
      derivationCount: derivations.length,
      derivations,
      orderExportCount: orderExports.length,
      orderExports,
      previousPeriod: days > 0 ? {
        autonomousFollowUpCount: previousFollowUps,
        derivationCount: previousDerivations,
        orderExportCount: previousOrderExports
      } : null,
      budgets,
      minutes,
      criticalEquipment
    };
  },

  async listAudiences(organizationId: string) {
    const entries = await prisma.metaAudienceEntry.findMany({
      where: { organizationId },
      include: {
        customer: { select: { companyName: true, fullName: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return { count: entries.length, entries };
  },

  async exportAudience(organizationId: string) {
    const { entries } = await this.listAudiences(organizationId);
    const escapeCsv = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [
      ['email', 'cliente', 'etiquetas', 'capturado_por', 'fecha'],
      ...entries.map((entry) => [
        entry.email,
        entry.customer.companyName ?? entry.customer.fullName,
        Array.isArray(entry.tags) ? entry.tags.join(' | ') : '',
        entry.capturedByName,
        entry.createdAt.toISOString()
      ])
    ];
    return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  },

  async simulateMetaSync(organizationId: string) {
    const { count } = await this.listAudiences(organizationId);
    return {
      count,
      simulated: true,
      message: 'Audiencia preparada localmente. Configura credenciales de Meta Ads para habilitar sincronización en vivo.'
    };
  }
};
