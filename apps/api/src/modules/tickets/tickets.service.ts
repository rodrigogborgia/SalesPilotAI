import { SupportTicketStatus } from '@prisma/client';

import prisma from '../../lib/prisma';

export type CreateTicketInput = {
  installedEquipmentId: string;
  symptoms: string;
  photos: string[];
};

export const ticketsService = {
  listEquipment(organizationId: string, clientEmail?: string) {
    return prisma.installedEquipment.findMany({
      where: {
        organizationId,
        ...(clientEmail ? { customer: { email: clientEmail } } : {})
      },
      include: {
        product: { select: { name: true, sku: true } },
        customer: { select: { companyName: true } },
        maintenancePlans: {
          where: { status: 'active' },
          orderBy: { nextDueHours: 'asc' }
        }
      },
      orderBy: { model: 'asc' }
    });
  },

  list(organizationId: string, clientEmail?: string) {
    return prisma.supportTicket.findMany({
      where: {
        organizationId,
        ...(clientEmail
          ? { installedEquipment: { customer: { email: clientEmail } } }
          : {})
      },
      include: {
        installedEquipment: {
          select: {
            id: true,
            serialNumber: true,
            model: true,
            locationInPlant: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  findById(organizationId: string, ticketId: string, clientEmail?: string) {
    return prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        organizationId,
        ...(clientEmail
          ? { installedEquipment: { customer: { email: clientEmail } } }
          : {})
      },
      include: {
        installedEquipment: {
          select: {
            id: true,
            serialNumber: true,
            model: true,
            locationInPlant: true
          }
        }
      }
    });
  },

  async create(organizationId: string, input: CreateTicketInput, clientEmail?: string) {
    const equipment = await prisma.installedEquipment.findFirst({
      where: {
        id: input.installedEquipmentId,
        organizationId,
        ...(clientEmail ? { customer: { email: clientEmail } } : {})
      },
      select: { id: true }
    });

    if (!equipment) {
      return null;
    }

    return prisma.supportTicket.create({
      data: {
        organizationId,
        installedEquipmentId: equipment.id,
        symptoms: input.symptoms.trim(),
        photos: input.photos,
        status: SupportTicketStatus.RECEIVED
      },
      include: {
        installedEquipment: {
          select: {
            model: true,
            serialNumber: true
          }
        }
      }
    });
  }
};
