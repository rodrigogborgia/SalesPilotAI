import 'dotenv/config';
import { hash } from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const ownerPassword = requiredEnv('SEED_OWNER_PASSWORD');
  const salesPassword = requiredEnv('SEED_SALES_PASSWORD');
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() || 'javier@pro-aire.com';
  const salesEmail = process.env.SEED_SALES_EMAIL?.trim().toLowerCase() || 'david@pro-aire.com';

  if (ownerEmail === salesEmail) {
    throw new Error('SEED_OWNER_EMAIL and SEED_SALES_EMAIL must be different.');
  }

  const [ownerPasswordHash, salesPasswordHash] = await Promise.all([
    hash(ownerPassword, 12),
    hash(salesPassword, 12)
  ]);

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: 'pro-aire-industrial' },
      update: {
        name: 'Pro-Aire Industrial',
        brandName: 'Pro-Aire'
      },
      create: {
        name: 'Pro-Aire Industrial',
        slug: 'pro-aire-industrial',
        brandName: 'Pro-Aire'
      }
    });

    await tx.user.upsert({
      where: { email: ownerEmail },
      update: {
        organizationId: organization.id,
        firstName: 'Javier',
        lastName: null,
        role: UserRole.OWNER,
        status: 'active',
        passwordHash: ownerPasswordHash
      },
      create: {
        organizationId: organization.id,
        firstName: 'Javier',
        email: ownerEmail,
        role: UserRole.OWNER,
        passwordHash: ownerPasswordHash
      }
    });

    await tx.user.upsert({
      where: { email: salesEmail },
      update: {
        organizationId: organization.id,
        firstName: 'David',
        lastName: null,
        role: UserRole.SALES,
        status: 'active',
        passwordHash: salesPasswordHash
      },
      create: {
        organizationId: organization.id,
        firstName: 'David',
        email: salesEmail,
        role: UserRole.SALES,
        passwordHash: salesPasswordHash
      }
    });

    const categorySpecs = [
      { name: 'Compresores', slug: 'compresores', description: 'Compresores industriales de aire.' },
      { name: 'Tratamiento de aire', slug: 'tratamiento-de-aire', description: 'Secadores y equipos para tratamiento de aire.' },
      { name: 'Repuestos y mantenimiento', slug: 'repuestos-y-mantenimiento', description: 'Kits y repuestos para mantenimiento preventivo.' }
    ];

    const categories = await Promise.all(
      categorySpecs.map((category) =>
        tx.category.upsert({
          where: {
            organizationId_slug: {
              organizationId: organization.id,
              slug: category.slug
            }
          },
          update: {
            name: category.name,
            description: category.description
          },
          create: {
            organizationId: organization.id,
            ...category
          }
        })
      )
    );

    const [compressorCategory, dryerCategory, kitCategory] = categories;
    const products = [
      {
        sku: 'PA-COMP-TORNILLO',
        name: 'Compresor de aire a tornillo',
        description: 'Compresor industrial a tornillo. Precio a cotizar según potencia y configuración.',
        categoryId: compressorCategory.id
      },
      {
        sku: 'PA-SECADOR-AIRE',
        name: 'Secador de aire industrial',
        description: 'Secador para tratamiento de aire comprimido. Selección según caudal y punto de rocío.',
        categoryId: dryerCategory.id
      },
      {
        sku: 'PA-KIT-MANTENIMIENTO',
        name: 'Kit de mantenimiento preventivo',
        description: 'Kit de filtros y aceite según modelo y ciclo de mantenimiento del equipo.',
        categoryId: kitCategory.id
      }
    ];

    await Promise.all(
      products.map((product) =>
        tx.product.upsert({
          where: {
            organizationId_sku: {
              organizationId: organization.id,
              sku: product.sku
            }
          },
          update: {
            name: product.name,
            description: product.description,
            categoryId: product.categoryId,
            isActive: true
          },
          create: {
            organizationId: organization.id,
            ...product
          }
        })
      )
    );
  });

  console.info('Seed completed: Pro-Aire Industrial, Javier (OWNER), David (SALES), 3 categories, 3 products.');
}

main()
  .catch((error: unknown) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
