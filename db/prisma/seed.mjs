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

const sizes = [
  {
    name: 'S',
    slug: 's',
    weightMinKg: 40,
    weightMaxKg: 47,
    heightMinCm: 150,
    heightMaxCm: 158,
    bustMinCm: 82,
    bustMaxCm: 86,
    waistMinCm: 62,
    waistMaxCm: 66,
    hipMinCm: 86,
    hipMaxCm: 90,
    sortOrder: 1,
  },
  {
    name: 'M',
    slug: 'm',
    weightMinKg: 48,
    weightMaxKg: 54,
    heightMinCm: 155,
    heightMaxCm: 162,
    bustMinCm: 86,
    bustMaxCm: 90,
    waistMinCm: 67,
    waistMaxCm: 71,
    hipMinCm: 91,
    hipMaxCm: 94,
    sortOrder: 2,
  },
  {
    name: 'L',
    slug: 'l',
    weightMinKg: 55,
    weightMaxKg: 62,
    heightMinCm: 158,
    heightMaxCm: 166,
    bustMinCm: 91,
    bustMaxCm: 95,
    waistMinCm: 72,
    waistMaxCm: 77,
    hipMinCm: 95,
    hipMaxCm: 99,
    sortOrder: 3,
  },
  {
    name: 'XL',
    slug: 'xl',
    weightMinKg: 63,
    weightMaxKg: 70,
    heightMinCm: 160,
    heightMaxCm: 170,
    bustMinCm: 96,
    bustMaxCm: 102,
    waistMinCm: 78,
    waistMaxCm: 84,
    hipMinCm: 100,
    hipMaxCm: 106,
    sortOrder: 4,
  },
  {
    name: '2XL',
    slug: '2xl',
    weightMinKg: 71,
    weightMaxKg: 78,
    heightMinCm: 160,
    heightMaxCm: 172,
    bustMinCm: 103,
    bustMaxCm: 108,
    waistMinCm: 85,
    waistMaxCm: 90,
    hipMinCm: 107,
    hipMaxCm: 112,
    sortOrder: 5,
  },
  {
    name: '3XL',
    slug: '3xl',
    weightMinKg: 79,
    weightMaxKg: 88,
    heightMinCm: 160,
    heightMaxCm: 174,
    bustMinCm: 109,
    bustMaxCm: 115,
    waistMinCm: 91,
    waistMaxCm: 98,
    hipMinCm: 113,
    hipMaxCm: 119,
    sortOrder: 6,
  },
  {
    name: '4XL',
    slug: '4xl',
    weightMinKg: 89,
    weightMaxKg: 100,
    heightMinCm: 162,
    heightMaxCm: 178,
    bustMinCm: 116,
    bustMaxCm: 124,
    waistMinCm: 99,
    waistMaxCm: 108,
    hipMinCm: 120,
    hipMaxCm: 128,
    sortOrder: 7,
  },
];

async function seedCatalog() {
  const categoryRecords = new Map();
  const sizeRecords = new Map();

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

  for (const size of sizes) {
    const record = await prisma.size.upsert({
      where: { slug: size.slug },
      create: size,
      update: size,
    });
    sizeRecords.set(size.slug, record);
  }

  for (const category of categories) {
    const categoryRecord = categoryRecords.get(category.slug);
    if (!categoryRecord) {
      throw new Error(`Failed to load category "${category.slug}"`);
    }

    for (const design of designs) {
      const name = `Đồ tole ${category.name.toLowerCase()} - ${design.name}`;
      const sku = `TOLE-${category.code}-${design.code}`;
      const slug = `do-tole-${category.slug}-${design.slug}`;

      const product = await prisma.product.upsert({
        where: { slug },
        create: {
          sku,
          name,
          slug,
          description: `${name}.`,
          price: 180000,
          originalPrice: 250000,
          galleryImages: [],
          colors: [],
          category: { connect: { id: categoryRecord.id } },
        },
        update: { price: 180000, originalPrice: 250000 },
        select: { id: true },
      });

      for (const size of sizes) {
        const sizeRecord = sizeRecords.get(size.slug);
        if (!sizeRecord) {
          throw new Error(`Failed to load size "${size.slug}"`);
        }

        await prisma.productSize.upsert({
          where: {
            productId_sizeId: {
              productId: product.id,
              sizeId: sizeRecord.id,
            },
          },
          create: {
            product: { connect: { id: product.id } },
            size: { connect: { id: sizeRecord.id } },
            stock: 10,
          },
          update: {},
        });
      }
    }
  }

  console.log(
    `Seeded ${categories.length} categories, ${sizes.length} size guides, and ${categories.length * designs.length} products with per-size stock.`
  );
}

try {
  await seedCatalog();
} finally {
  await prisma.$disconnect();
}
