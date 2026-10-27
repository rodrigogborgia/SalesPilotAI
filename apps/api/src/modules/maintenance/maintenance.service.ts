import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export const maintenanceService = {
  async rescheduleCheckIn(
    organizationId: string,
    userId: string,
    equipmentId: string,
    horometerHours: string,
    dueAt: Date
  ) {
    return prisma.$transaction(async (tx) => {
      const equipment = await tx.installedEquipment.findFirst({
        where: { id: equipmentId, organizationId },
        include: { customer: true }
      });
      const user = await tx.user.findFirst({
        where: { id: userId, organizationId, status: 'active' }
      });
      if (!equipment || !user) return null;

      const [updatedEquipment, followUp] = await Promise.all([
        tx.installedEquipment.update({
          where: { id: equipment.id },
          data: { currentHours: new Prisma.Decimal(horometerHours) }
        }),
        tx.manualFollowUp.create({
          data: {
            organizationId,
            assignedToUserId: user.id,
            customer: equipment.customer.companyName ?? equipment.customer.fullName,
            contactName: equipment.customer.fullName,
            contactTitle: equipment.customer.contactTitle,
            email: equipment.customer.corporateEmail ?? equipment.customer.email,
            phone: equipment.customer.phone ?? '',
            reason: `Re-llamar por mantenimiento · ${equipment.model} · ${horometerHours} hs`,
            dueAt,
            priority: 'Media',
            owner: 'Luciana'
          }
        }),
        tx.customer.update({
          where: { id: equipment.customerId },
          data: { lastContactAt: new Date() }
        })
      ]);
      return { equipment: updatedEquipment, followUp };
    });
  },

  async triggerHorometerOutreach(organizationId: string) {
    const candidates = await prisma.installedEquipment.findMany({
      where: {
        organizationId,
        status: { in: ['active', 'in_service'] },
        currentHours: { gte: 4000 },
        customer: { maintenanceWhatsAppSentAt: null }
      },
      select: { customerId: true }
    });
    const customerIds = Array.from(new Set(candidates.map((item) => item.customerId)));
    if (customerIds.length) {
      await prisma.customer.updateMany({
        where: {
          id: { in: customerIds },
          organizationId,
          maintenanceWhatsAppSentAt: null
        },
        data: { maintenanceWhatsAppSentAt: new Date() }
      });
    }
  },

  async listOutbound(organizationId: string) {
    await this.triggerHorometerOutreach(organizationId);
    const equipment = await prisma.installedEquipment.findMany({
      where: {
        organizationId,
        status: { in: ['active', 'in_service'] },
        customer: {
          maintenanceWhatsAppSentAt: { not: null },
          OR: [
            { maintenanceWhatsAppRepliedAt: null },
            { requiresDirectCall: true }
          ]
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            phone: true,
            corporateEmail: true,
            lastContactAt: true,
            maintenanceWhatsAppSentAt: true,
            maintenanceWhatsAppRepliedAt: true,
            requiresDirectCall: true
          }
        },
        product: { select: { name: true } },
        maintenancePlans: {
          where: { status: 'active' },
          orderBy: { nextDueHours: 'asc' }
        }
      }
    });

    return equipment
      .filter((item) => Number(item.currentHours) >= 4000)
      .map((item) => {
        const nextService = item.maintenancePlans[0];
        const currentHours = Number(item.currentHours);
        return {
          ...item,
          hoursToService: nextService ? nextService.nextDueHours - currentHours : null
        };
      })
      .sort((left, right) => {
        if (left.hoursToService === null) return 1;
        if (right.hoursToService === null) return -1;
        return left.hoursToService - right.hoursToService;
      });
  },

  async captureEmail(organizationId: string, userId: string, customerId: string, email: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId },
      include: {
        budgets: { where: { status: '03 - Ganado' }, take: 1 },
        installedEquipment: { select: { currentHours: true } }
      }
    });
    if (!customer) return null;

    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId, status: 'active' },
      select: { firstName: true }
    });
    if (!user) return null;

    const tags = new Set<string>();
    if (customer.budgets.length) tags.add('03 - Ganado');
    if (customer.installedEquipment.some((item) => Number(item.currentHours) > 4000)) {
      tags.add('Horómetro Crítico');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [updatedCustomer, audienceEntry] = await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: { corporateEmail: normalizedEmail }
      }),
      prisma.metaAudienceEntry.upsert({
        where: {
          organizationId_email: { organizationId, email: normalizedEmail }
        },
        update: {
          customerId,
          capturedByUserId: userId,
          capturedByName: user.firstName,
          tags: Array.from(tags)
        },
        create: {
          organizationId,
          customerId,
          capturedByUserId: userId,
          capturedByName: user.firstName,
          email: normalizedEmail,
          tags: Array.from(tags)
        }
      })
    ]);

    return { customer: updatedCustomer, audienceEntry };
  }
};
