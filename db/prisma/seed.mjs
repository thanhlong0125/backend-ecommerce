import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Tay dài', slug: 'tay-dai', code: 'TD' },
  { name: 'Tay ngắn', slug: 'tay-ngan', code: 'TN' },
  { name: 'Lửng', slug: 'lung', code: 'LU' },
  { name: 'Đùi', slug: 'dui', code: 'DU' },
];

const designs = [
  { name: 'Gấu nâu', slug: 'gau-nau', code: 'GN' },
  { name: 'Hoa xanh', slug: 'hoa-xanh', code: 'HX' },
  { name: 'Siêu nhân', slug: 'sieu-nhan', code: 'SN' },
  { name: 'Mickey', slug: 'mickey', code: 'MK' },
  { name: 'Tym', slug: 'tym', code: 'TY' },
];

async function seedCatalog() {
  const categoryRecords = new Map();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
      },
      update: {},
    });
    categoryRecords.set(category.slug, record);
  }

  for (const category of categories) {
    const categoryRecord = categoryRecords.get(category.slug);
    if (!categoryRecord) {
      throw new Error(`Failed to load category "${category.slug}"`);
    }

    for (const design of designs) {
      const name = `Đồ tole ${category.name.toLowerCase()} - ${design.name}`;
      const sku = `TOLE-${category.code}-${design.code}`;

      await prisma.product.upsert({
        where: { sku },
        create: {
          sku,
          name,
          slug: `do-tole-${category.slug}-${design.slug}`,
          description: `${name}.`,
          price: 150000,
          stockQuantity: 10,
          category: { connect: { id: categoryRecord.id } },
        },
        update: {},
      });
    }
  }

  console.log(
    `Seeded ${categories.length} categories and ${categories.length * designs.length} products.`
  );
}

try {
  await seedCatalog();
} finally {
  await prisma.$disconnect();
}
