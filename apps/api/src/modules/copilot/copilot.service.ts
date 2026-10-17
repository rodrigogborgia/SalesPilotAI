import prisma from '../../lib/prisma';

export type CopilotReferenceInput = {
  conversationId: string;
  customerId?: string;
  refCode: string;
  sourceChannel: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'PHONE' | 'OTHER';
  assignedToUserId?: string;
  requiresDerivation?: boolean;
  summary?: string;
};

export const copilotService = {
  listReferences(organizationId: string) {
    return prisma.copilotReference.findMany({
      where: { organizationId },
      include: { conversation: { select: { status: true } } },
      orderBy: { createdAt: 'desc' }
    });
  },

  async createReference(organizationId: string, input: CopilotReferenceInput) {
    const existingConversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, organizationId }
    });
    const conversation = existingConversation ?? await prisma.conversation.create({
      data: {
        organizationId,
        ...(input.conversationId ? { id: input.conversationId } : {}),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        contactChannel: input.sourceChannel,
        direction: 'INBOUND',
        content: input.summary,
        summary: input.summary,
        requiresDerivation: input.requiresDerivation ?? true,
        status: 'REQUIRES_HUMAN'
      }
    });

    return prisma.copilotReference.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        refCode: input.refCode,
        ...(input.assignedToUserId ? { assignedToUserId: input.assignedToUserId } : {}),
        sourceChannel: input.sourceChannel,
        summary: input.summary,
        requiresDerivation: input.requiresDerivation ?? true
      }
    });
  },

  async resolveReference(organizationId: string, refCode: string) {
    const result = await prisma.copilotReference.updateMany({
      where: { organizationId, refCode },
      data: { resolved: true, resolvedAt: new Date() }
    });
    if (!result.count) return null;
    return prisma.copilotReference.findFirst({ where: { organizationId, refCode } });
  },

  async takeReference(organizationId: string, userId: string, refCode: string) {
    const reference = await prisma.copilotReference.findFirst({
      where: { organizationId, refCode }
    });
    if (!reference) return null;
    return prisma.$transaction(async (tx) => {
      await tx.copilotReference.update({
        where: { id: reference.id },
        data: { assignedToUserId: userId }
      });
      await tx.conversation.update({
        where: { id: reference.conversationId },
        data: { status: 'HUMAN_HANDLING', requiresDerivation: false }
      });
      return tx.copilotReference.findUnique({
        where: { id: reference.id },
        include: { conversation: { select: { status: true } } }
      });
    });
  },

  async recordLearningRule(
    organizationId: string,
    userId: string,
    refCode: string,
    objection: string,
    rule: string
  ) {
    const reference = await prisma.copilotReference.findFirst({
      where: { organizationId, refCode }
    });
    if (!reference) return null;
    return prisma.commercialLearningRule.create({
      data: {
        organizationId,
        userId,
        refCode,
        objection,
        rule,
        notificationStatus: 'simulated'
      }
    });
  }
};
