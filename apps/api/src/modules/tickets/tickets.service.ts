import { SupportTicketStatus } from '@prisma/client';

import prisma from '../../lib/prisma';

export type CreateTicketInput = {
  installedEquipmentId: string;
  symptoms: string;
  photos: string[];
};

export const ticketsService = {
  list(organizationId: string) {
    return prisma.supportTicket.findMany({
      where: { organizationId },
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

  findById(organizationId: string, ticketId: string) {
    return prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        organizationId
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

  async create(organizationId: string, input: CreateTicketInput) {
    const equipment = await prisma.installedEquipment.findFirst({
      where: {
        id: input.installedEquipmentId,
        organizationId
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
      }
    });
  }
};
