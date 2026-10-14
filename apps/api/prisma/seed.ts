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
  const clientPassword = requiredEnv('SEED_CLIENT_PASSWORD');
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() || 'javier@pro-aire.com';
  const salesEmail = process.env.SEED_SALES_EMAIL?.trim().toLowerCase() || 'david@pro-aire.com';
  const clientEmail =
    process.env.SEED_CLIENT_EMAIL?.trim().toLowerCase() || 'operador@tallerrosario.com';

  if (new Set([ownerEmail, salesEmail, clientEmail]).size !== 3) {
    throw new Error('Seed user email addresses must be different.');
  }

  const [ownerPasswordHash, salesPasswordHash, clientPasswordHash] = await Promise.all([
    hash(ownerPassword, 12),
    hash(salesPassword, 12),
    hash(clientPassword, 12)
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

    await tx.user.upsert({
      where: { email: clientEmail },
      update: {
        organizationId: organization.id,
        firstName: 'Operador',
        lastName: 'Taller Rosario',
        role: UserRole.CLIENT_OPERATOR,
        status: 'active',
        passwordHash: clientPasswordHash
      },
      create: {
        organizationId: organization.id,
        firstName: 'Operador',
        lastName: 'Taller Rosario',
        email: clientEmail,
        role: UserRole.CLIENT_OPERATOR,
        passwordHash: clientPasswordHash
      }
    });

    const categorySpecs = [
      { name: 'Compresores', slug: 'compresores', description: 'Compresores industriales de aire.' },
      { name: 'Tratamiento de aire', slug: 'tratamiento-de-aire', description: 'Secadores y equipos para tratamiento de aire.' },
      { name: 'Repuestos y mantenimiento', slug: 'repuestos-y-mantenimiento', description: 'Kits y repuestos para mantenimiento preventivo.' },
      { name: 'Tuberías y conexiones', slug: 'tuberias-y-conexiones', description: 'Productos de las líneas de tuberías y conexiones Pro-Aire.' },
      { name: 'Servicios', slug: 'servicios', description: 'Servicios de instalación de líneas de aire.' }
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

    const [compressorCategory, , , pipingCategory, servicesCategory] = categories;
    const catalogItems = `
CABEZAL COMPRESOR A PISTON 10 HP|cabezal-compresor-a-piston-10-hp-cab10hpbb
CABEZAL COMPRESOR A PISTON 10 HP|cabezal-compresor-a-piston-10-hp-cab10hpab
CABEZAL COMPRESOR A PISTON 3 HP|cabezal-compresor-a-piston-3-hp-cab3hpab
CABEZAL COMPRESOR A PISTON 3 HP|cabezal-compresor-a-piston-3-hp-cab3hpbb
CABEZAL COMPRESOR A PISTON 5,5 HP|cabezal-compresor-a-piston-55-hp-cab5hpab
CABEZAL COMPRESOR A PISTON 5,5 HP|cabezal-compresor-a-piston-55-hp-cab5hpbb
CABEZAL COMPRESOR A PISTON 7,5 HP|cabezal-compresor-a-piston-75-hp-cab7hpbb
CABEZAL COMPRESOR A PISTON 7,5 HP|cabezal-compresor-a-piston-75-hp-cab7hpab
COMPRESOR A PISTON 10 HP/300 LTS|compresor-a-piston-10-hp300-lts-10hp300l380v
COMPRESOR A PISTON 3 HP/100 LTS MONOF.|compresor-a-piston-3-hp100-lts-monof-oferta1
COMPRESOR A PISTON 3 HP/100 LTS TRIFASIC.|compresor-a-piston-3-hp100-lts-trifasic-3hp100380v
COMPRESOR A PISTON 7,5 HP/300 LTS|compresor-a-piston-75-hp300-lts-7hp300l380v
COMPRESOR A TORNILLO 10 HP PROAIRE INV|compresor-a-tornillo-10-hp-proaire-inv-proaire-10
COMPRESOR A TORNILLO 10 HP PROAIRE PR|compresor-a-tornillo-10-hp-proaire-pr-zt4-10
COMPRESOR A TORNILLO 10 HP PROAIRE SMART INV|compresor-a-tornillo-10-hp-proaire-smart-inv-583
COMPRESOR A TORNILLO 100 HP PROAIRE PR INV|compresor-a-tornillo-100-hp-proaire-pr-inv-zt6-100
COMPRESOR A TORNILLO 15 HP PROAIRE INV|compresor-a-tornillo-15-hp-proaire-inv-proaire-15
COMPRESOR A TORNILLO 20 HP PROAIRE INV|compresor-a-tornillo-20-hp-proaire-inv-proaire-20
COMPRESOR A TORNILLO 20 HP PROAIRE PR|compresor-a-tornillo-20-hp-proaire-pr-zt4-20
COMPRESOR A TORNILLO 20 HP PROAIRE SMART INV|compresor-a-tornillo-20-hp-proaire-smart-inv-650
COMPRESOR A TORNILLO 30 HP PROAIRE INVERTER|compresor-a-tornillo-30-hp-proaire-inverter-proaire-30-inv
COMPRESOR A TORNILLO 30 HP PROAIRE PR|compresor-a-tornillo-30-hp-proaire-pr-zt6-30
COMPRESOR A TORNILLO 50 HP PROAIRE INVERTER|compresor-a-tornillo-50-hp-proaire-inverter-proaire-50-inv
COMPRESOR A TORNILLO 50 HP PROAIRE PR INV|compresor-a-tornillo-50-hp-proaire-pr-inv-zt6-50
COMPRESOR A TORNILLO PROAIRE INV LASER|compresor-a-tornillo-proaire-inv-laser-prolas30hp
COMPRESOR SCROLL 2 X 5 HP|compresor-scroll-2-x-5-hp-scr10
COMPRESOR SCROLL 4 X 5 HP|compresor-scroll-4-x-5-hp-scr20
COMPRESOR SCROLL 5 HP|compresor-scroll-5-hp-scr5
INSTALACION LINEAS DE AIRE|instalacion-lineas-de-aire-line
K10 UNION NORMAL 110MM|k10-union-normal-110mm-710110
K10 UNION NORMAL 20MM|k10-union-normal-20mm-710020
K10 UNION NORMAL 25MM|k10-union-normal-25mm-710025
K10 UNION NORMAL 32MM|k10-union-normal-32mm-710032
K10 UNION NORMAL 40MM|k10-union-normal-40mm-710040
K10 UNION NORMAL 50MM|k10-union-normal-50mm-710050
K10 UNION NORMAL 63MM|k10-union-normal-63mm-710063
K10 UNION NORMAL 75MM|k10-union-normal-75mm-710075
K10 UNION NORMAL 90MM|k10-union-normal-90mm-710090
K11 TUBO INSERTO MACHO (TF/H) 110MM X 4"|k11-tubo-inserto-macho-tfh-110mm-x-4-711110
K11 TUBO INSERTO MACHO (TF/H) 20MM X 1"|k11-tubo-inserto-macho-tfh-20mm-x-1-711420
K11 TUBO INSERTO MACHO (TF/H) 20MM X 1/2"|k11-tubo-inserto-macho-tfh-20mm-x-12-711220
K11 TUBO INSERTO MACHO (TF/H) 25MM X 1"|k11-tubo-inserto-macho-tfh-25mm-x-1-711425
K11 TUBO INSERTO MACHO (TF/H) 25MM X 1/2"|k11-tubo-inserto-macho-tfh-25mm-x-12-711225
K11 TUBO INSERTO MACHO (TF/H) 25MM X 3/4"|k11-tubo-inserto-macho-tfh-25mm-x-34-711325
K11 TUBO INSERTO MACHO (TF/H) 32MM X 1"|k11-tubo-inserto-macho-tfh-32mm-x-1-711432
K11 TUBO INSERTO MACHO (TF/H) 32MM X 1/2"|k11-tubo-inserto-macho-tfh-32mm-x-12-711232
K11 TUBO INSERTO MACHO (TF/H) 32MM X 3/4"|k11-tubo-inserto-macho-tfh-32mm-x-34-711332
K11 TUBO INSERTO MACHO (TF/H) 40MM X 1 1/4"|k11-tubo-inserto-macho-tfh-40mm-x-1-14-711540
K11 TUBO INSERTO MACHO (TF/H) 50MM X 1 1/2"|k11-tubo-inserto-macho-tfh-50mm-x-1-12-711650
K11 TUBO INSERTO MACHO (TF/H) 63MM X 2"|k11-tubo-inserto-macho-tfh-63mm-x-2-711763
K11 TUBO INSERTO MACHO (TF/H) 75MM X 2 1/2"|k11-tubo-inserto-macho-tfh-75mm-x-2-12-711875
K11 TUBO INSERTO MACHO (TF/H) 90MM X 3"|k11-tubo-inserto-macho-tfh-90mm-x-3-711990
K11 TUBO INSERTO MACHO (TF/HEMBRA) 20MMX3/4"|k11-tubo-inserto-macho-tfhembra-20mmx34-711320
K12 TUBO INSERTO MACHO (TF/M) 20MM X 1"|k12-tubo-inserto-macho-tfm-20mm-x-1-712420
K12 TUBO INSERTO MACHO (TF/M) 20MM X 1/2"|k12-tubo-inserto-macho-tfm-20mm-x-12-712220
K12 TUBO INSERTO MACHO (TF/M) 20MM X 3/4"|k12-tubo-inserto-macho-tfm-20mm-x-34-712320
K12 TUBO INSERTO MACHO (TF/M) 25MM X 1"|k12-tubo-inserto-macho-tfm-25mm-x-1-712425
K12 TUBO INSERTO MACHO (TF/M) 25MM X 1/2"|k12-tubo-inserto-macho-tfm-25mm-x-12-712225
K12 TUBO INSERTO MACHO (TF/M) 25MM X 3/4"|k12-tubo-inserto-macho-tfm-25mm-x-34-712325
K12 TUBO INSERTO MACHO (TF/M) 32MM X 1"|k12-tubo-inserto-macho-tfm-32mm-x-1-712432
K12 TUBO INSERTO MACHO (TF/M) 32MM X 1/2"|k12-tubo-inserto-macho-tfm-32mm-x-12-712232
K12 TUBO INSERTO MACHO (TF/M) 32MM X 3/4"|k12-tubo-inserto-macho-tfm-32mm-x-34-712332
K12 TUBO INSERTO MACHO (TF/M) 40MM X 1 1/4"|k12-tubo-inserto-macho-tfm-40mm-x-1-14-712540
K12 TUBO INSERTO MACHO (TF/M) 50MM X 1 1/2"|k12-tubo-inserto-macho-tfm-50mm-x-1-12-712650
    `.trim().split('\n').map((row) => {
      const [name, sku] = row.split('|');
      return {
        name,
        sku,
        categoryId: name.startsWith('K10') || name.startsWith('K11') || name.startsWith('K12')
          ? pipingCategory.id
          : name.startsWith('INSTALACION')
            ? servicesCategory.id
            : compressorCategory.id
      };
    });
    const products = [
      {
        sku: 'PA-132',
        name: 'Compresor PA 132',
        description: 'Compresor industrial Pro-Aire PA 132.',
        categoryId: compressorCategory.id
      },
      ...catalogItems.map((item) => ({
        ...item,
        description: `Producto del catálogo Pro-Aire. Identificador de catálogo: ${item.sku}.`
      }))
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

    await tx.product.updateMany({
      where: {
        organizationId: organization.id,
        sku: { in: ['PA-COMP-TORNILLO', 'PA-SECADOR-AIRE', 'PA-KIT-MANTENIMIENTO'] }
      },
      data: { isActive: false }
    });

    const customer = await tx.customer.findFirst({
      where: {
        organizationId: organization.id,
        companyName: 'Taller Rosario S.A.'
      }
    });
    const tallerRosario = customer
      ? await tx.customer.update({
          where: { id: customer.id },
          data: {
            fullName: 'Operador de planta',
            email: clientEmail,
            companyName: 'Taller Rosario S.A.',
            segment: 'Industria',
            address: 'Rosario, Santa Fe',
            status: 'active'
          }
        })
      : await tx.customer.create({
          data: {
            organizationId: organization.id,
            fullName: 'Operador de planta',
            email: clientEmail,
            companyName: 'Taller Rosario S.A.',
            segment: 'Industria',
            address: 'Rosario, Santa Fe'
          }
        });

    const pa132 = await tx.product.findUniqueOrThrow({
      where: {
        organizationId_sku: {
          organizationId: organization.id,
          sku: 'PA-132'
        }
      }
    });
    const equipment = await tx.installedEquipment.upsert({
      where: { serialNumber: 'PA-000125' },
      update: {
        organizationId: organization.id,
        customerId: tallerRosario.id,
        productId: pa132.id,
        model: 'Compresor PA 132',
        locationInPlant: 'Sala de compresores',
        installationDate: new Date('2024-01-15T12:00:00.000Z'),
        currentHours: '4280.00',
        status: 'in_service',
        notes: 'En servicio. Próximo mantenimiento dentro de 220 hs.'
      },
      create: {
        organizationId: organization.id,
        customerId: tallerRosario.id,
        productId: pa132.id,
        serialNumber: 'PA-000125',
        model: 'Compresor PA 132',
        locationInPlant: 'Sala de compresores',
        installationDate: new Date('2024-01-15T12:00:00.000Z'),
        currentHours: '4280.00',
        status: 'in_service',
        notes: 'En servicio. Próximo mantenimiento dentro de 220 hs.'
      }
    });

    const maintenancePlan = await tx.maintenancePlan.findFirst({
      where: {
        organizationId: organization.id,
        installedEquipmentId: equipment.id,
        planName: 'Mantenimiento preventivo'
      }
    });
    if (maintenancePlan) {
      await tx.maintenancePlan.update({
        where: { id: maintenancePlan.id },
        data: {
          intervalHours: 500,
          nextDueHours: 4500,
          status: 'active'
        }
      });
    } else {
      await tx.maintenancePlan.create({
        data: {
          organizationId: organization.id,
          installedEquipmentId: equipment.id,
          planName: 'Mantenimiento preventivo',
          intervalHours: 500,
          nextDueHours: 4500
        }
      });
    }
  });

  console.info(
    'Seed completed: Pro-Aire, Javier (OWNER), David (SALES), Taller Rosario (CLIENT_OPERATOR), catalog and PA-000125.'
  );
}

main()
  .catch((error: unknown) => {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
