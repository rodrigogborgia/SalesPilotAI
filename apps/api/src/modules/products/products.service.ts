import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';

export const productsService = {
  list(organizationId: string) {
    return prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });
  },

  async create(
    organizationId: string,
    input: { sku: string; name: string; description?: string; categoryId?: string; price?: string }
  ) {
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, organizationId }
      });
      if (!category) return null;
    }

    return prisma.product.create({
      data: {
        organizationId,
        sku: input.sku,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        price: input.price === undefined ? null : new Prisma.Decimal(input.price)
      }
    });
  }
};
