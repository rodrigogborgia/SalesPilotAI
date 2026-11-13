import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';
import { getMonthlyCommercialKpis } from '../analytics/commercialKpis.service';

function dateFilter(days: number) {
  return days > 0 ? { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } : undefined;
}

export const adminService = {
  async getCompletedSalesAudiences(organizationId: string) {
    const buyers = await prisma.completedSale.findMany({
      where: { organizationId },
      orderBy: [{ purchaseDate: 'desc' }, { email: 'asc' }]
    });
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentBuyers = buyers.filter((buyer) => buyer.purchaseDate >= cutoff);
    const toAudienceEntry = (buyer: typeof buyers[number]) => ({
      ...buyer,
      amount: Number(buyer.amount),
      purchaseDate: buyer.purchaseDate.toISOString()
    });

    return {
      totalBuyers: buyers.length,
      lookalikeSeed: buyers.map(toAudienceEntry),
      recentExclusions: recentBuyers.map(toAudienceEntry),
      topOfMind: recentBuyers.map(toAudienceEntry)
    };
  },

  async importCompletedSales(
    organizationId: string,
    sales: Array<{ email: string; phone: string | null; company: string; amount: number; purchaseDate: Date }>
  ) {
    const newestByEmail = new Map<string, (typeof sales)[number]>();
    for (const sale of sales) {
      const current = newestByEmail.get(sale.email);
      if (!current || sale.purchaseDate > current.purchaseDate) newestByEmail.set(sale.email, sale);
    }

    await prisma.$transaction(async (tx) => {
      for (const sale of newestByEmail.values()) {
        const current = await tx.completedSale.findUnique({
          where: { organizationId_email: { organizationId, email: sale.email } }
        });
        if (current && current.purchaseDate > sale.purchaseDate) continue;
        await tx.completedSale.upsert({
          where: { organizationId_email: { organizationId, email: sale.email } },
          update: {
            phone: sale.phone,
            company: sale.company,
            amount: sale.amount,
            purchaseDate: sale.purchaseDate
          },
          create: { organizationId, ...sale }
        });
      }
    });

    return {
      importedCount: newestByEmail.size,
      ...(await this.getCompletedSalesAudiences(organizationId))
    };
  },

  async importCommercialInvoices(
    organizationId: string,
    invoices: Array<{
      invoiceNumber: string;
      lineNumber: number;
      invoiceDate: Date;
      email: string | null;
      company: string;
      salesOwner: 'David' | 'Luciana';
      businessUnit: 'equipment' | 'service' | 'spare_parts';
      amount: number;
      equipmentQuantity: number;
      customerType?: 'new' | 'active' | 'reactivated' | 'unknown';
    }>
  ) {
    const imported = await prisma.$transaction(async (tx) => {
      const importedCount = { created: 0, updated: 0 };
      for (const invoice of invoices) {
        const key = {
          organizationId_invoiceNumber_lineNumber: {
            organizationId,
            invoiceNumber: invoice.invoiceNumber,
            lineNumber: invoice.lineNumber
          }
        };
        const [existing, previousSale, matchingLead] = await Promise.all([
          tx.salesInvoice.findUnique({ where: key }),
          invoice.email
            ? tx.completedSale.findUnique({
                where: { organizationId_email: { organizationId, email: invoice.email } },
                select: { purchaseDate: true }
              })
            : null,
          invoice.email
            ? tx.lead.findFirst({
              where: { organizationId, email: invoice.email, createdAt: { lte: invoice.invoiceDate } },
                orderBy: { createdAt: 'desc' },
                select: { customerType: true }
              })
            : null
        ]);
        let customerType = invoice.customerType ?? existing?.customerType;
        if (!customerType) {
          const purchaseGap = previousSale
            ? invoice.invoiceDate.getTime() - previousSale.purchaseDate.getTime()
            : null;
          customerType = purchaseGap !== null && purchaseGap >= 0
            ? purchaseGap > 360 * 24 * 60 * 60 * 1000 ? 'reactivated' : 'active'
            : !previousSale && (
                matchingLead?.customerType === 'new' ||
                matchingLead?.customerType === 'active' ||
                matchingLead?.customerType === 'reactivated'
              )
              ? matchingLead.customerType
              : 'unknown';
        }

        await tx.salesInvoice.upsert({
          where: key,
          update: {
            invoiceDate: invoice.invoiceDate,
            customerEmail: invoice.email,
            customerName: invoice.company,
            salesOwner: invoice.salesOwner,
            businessUnit: invoice.businessUnit,
            amount: new Prisma.Decimal(invoice.amount),
            equipmentQuantity: invoice.equipmentQuantity,
            customerType
          },
          create: {
            organizationId,
            invoiceNumber: invoice.invoiceNumber,
            lineNumber: invoice.lineNumber,
            invoiceDate: invoice.invoiceDate,
            customerEmail: invoice.email,
            customerName: invoice.company,
            salesOwner: invoice.salesOwner,
            businessUnit: invoice.businessUnit,
            amount: new Prisma.Decimal(invoice.amount),
            equipmentQuantity: invoice.equipmentQuantity,
            customerType
          }
        });
        if (existing) importedCount.updated += 1;
        else importedCount.created += 1;
      }

      const emails = Array.from(new Set(invoices.flatMap((invoice) => invoice.email ? [invoice.email] : [])));
      for (const email of emails) {
        const latestInvoice = await tx.salesInvoice.findFirst({
          where: { organizationId, customerEmail: email },
          orderBy: [{ invoiceDate: 'desc' }, { invoiceNumber: 'desc' }],
          select: {
            invoiceDate: true,
            invoiceNumber: true,
            customerName: true,
          }
        });
        if (!latestInvoice) continue;
        const latestInvoiceTotal = await tx.salesInvoice.aggregate({
          where: {
            organizationId,
            customerEmail: email,
            invoiceNumber: latestInvoice.invoiceNumber,
            invoiceDate: latestInvoice.invoiceDate
          },
          _sum: { amount: true }
        });
        const currentSale = await tx.completedSale.findUnique({
          where: { organizationId_email: { organizationId, email } },
          select: { purchaseDate: true }
        });
        if (currentSale && currentSale.purchaseDate > latestInvoice.invoiceDate) continue;
        await tx.completedSale.upsert({
          where: { organizationId_email: { organizationId, email } },
          update: {
            company: latestInvoice.customerName,
            amount: latestInvoiceTotal._sum.amount ?? new Prisma.Decimal(0),
            purchaseDate: latestInvoice.invoiceDate
          },
          create: {
            organizationId,
            email,
            company: latestInvoice.customerName,
            amount: latestInvoiceTotal._sum.amount ?? new Prisma.Decimal(0),
            purchaseDate: latestInvoice.invoiceDate
          }
        });
      }
      return importedCount;
    });

    return { importedCount: invoices.length, ...imported };
  },

  async exportCompletedSalesAudiences(organizationId: string) {
    const audiences = await this.getCompletedSalesAudiences(organizationId);
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows: Array<Array<string | number>> = [
      ['audience', 'email', 'phone', 'company', 'amount', 'purchase_date']
    ];
    for (const buyer of audiences.lookalikeSeed) {
      rows.push(['LOOKALIKE_SEED_1_PERCENT', buyer.email, buyer.phone ?? '', buyer.company, buyer.amount, buyer.purchaseDate]);
    }
    for (const buyer of audiences.recentExclusions) {
      rows.push(['RECENT_BUYER_EXCLUSION_0_90_DAYS', buyer.email, buyer.phone ?? '', buyer.company, buyer.amount, buyer.purchaseDate]);
    }
    for (const buyer of audiences.topOfMind) {
      rows.push(['TOP_OF_MIND_MAINTENANCE_0_90_DAYS', buyer.email, buyer.phone ?? '', buyer.company, buyer.amount, buyer.purchaseDate]);
    }
    return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  },

  async simulateCompletedSalesMetaSync(organizationId: string) {
    const audiences = await this.getCompletedSalesAudiences(organizationId);
    return {
      simulated: true,
      lookalikeSeedCount: audiences.totalBuyers,
      recentExclusionCount: audiences.recentExclusions.length,
      topOfMindCount: audiences.topOfMind.length,
      message: 'Ambas audiencias quedaron preparadas localmente. La exclusión de compradores recientes está lista para campañas de captación; configura credenciales de Meta Ads para sincronizar en vivo.'
    };
  },

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
    const monthlyCommercialKpis = await getMonthlyCommercialKpis(organizationId);
    return {
      rangeDays: days,
      monthlyCommercialKpis,
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
