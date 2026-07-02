import { PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

const slug = (name: string) => slugify(name, { lower: true, strict: true });

async function upsertCategory(name: string, icon: string | null = null) {
  const s = slug(name);
  return prisma.category.upsert({
    where: { slug: s },
    update: { name, icon },
    create: { name, slug: s, icon },
  });
}

async function upsertSubcategory(categoryId: string, name: string) {
  const s = slug(name);
  return prisma.subcategory.upsert({
    where: { categoryId_slug: { categoryId, slug: s } },
    update: { name },
    create: { name, slug: s, categoryId },
  });
}

/**
 * Products have no natural unique key, so we make the seed idempotent by
 * skipping creation when a product of the same name already exists in the
 * subcategory.
 */
async function ensureProduct(
  subcategoryId: string,
  data: { name: string; description: string; link: string; imageUrl: string },
) {
  const existing = await prisma.product.findFirst({
    where: { subcategoryId, name: data.name },
  });
  if (existing) {
    return prisma.product.update({ where: { id: existing.id }, data });
  }
  return prisma.product.create({ data: { ...data, subcategoryId } });
}

// The 15 storefront categories from the BoscoStore mockup, with their
// lucide-react icon names and the subcategories shown on each card.
const CATALOG: { name: string; icon: string; subcategories: string[] }[] = [
  {
    name: 'Health & Household',
    icon: 'HeartPulse',
    subcategories: ['Vitamins', 'Supplements', 'Nutrition'],
  },
  {
    name: 'Beauty & Personal Care',
    icon: 'Sparkles',
    subcategories: ['Skin Care', 'Hair Care', 'Cosmetics'],
  },
  {
    name: 'Clothing, Shoes & Jewelry',
    icon: 'Shirt',
    subcategories: ['Apparel', 'Footwear', 'Accessories'],
  },
  {
    name: 'Pet Supplies',
    icon: 'PawPrint',
    subcategories: ['Pet Food', 'Treats', 'Toys & Accessories'],
  },
  {
    name: 'Home & Kitchen',
    icon: 'CookingPot',
    subcategories: ['Appliances', 'Cookware', 'Kitchen Tools'],
  },
  {
    name: 'Tools & Home Improvement',
    icon: 'Wrench',
    subcategories: ['Tools', 'Hardware', 'Home Renovation'],
  },
  {
    name: 'Grocery & Gourmet Food',
    icon: 'ShoppingBasket',
    subcategories: ['Food', 'Beverages', 'Snacks', 'Canned Goods'],
  },
  {
    name: 'Baby & Child Care',
    icon: 'Baby',
    subcategories: ['Diapers', 'Wipes', 'Baby Food', 'Formula'],
  },
  {
    name: 'Electronics & Accessories',
    icon: 'Headphones',
    subcategories: ['Phone Accessories', 'Headphones', 'Chargers'],
  },
  {
    name: 'Seasonal & Holiday',
    icon: 'Gift',
    subcategories: ['Holiday Décor', 'Gifts', 'Party Supplies'],
  },
  {
    name: 'Sports & Outdoors',
    icon: 'Dumbbell',
    subcategories: ['Fitness', 'Outdoor Gear', 'Sports Accessories'],
  },
  {
    name: 'Automotive',
    icon: 'Car',
    subcategories: ['Car Care', 'Accessories', 'Tools'],
  },
  {
    name: 'Office & School Supplies',
    icon: 'NotebookPen',
    subcategories: ['Office Essentials', 'Stationery', 'School Supplies'],
  },
  {
    name: 'Electronics & Small Appliances',
    icon: 'Tv',
    subcategories: ['Small Electronics', 'Gadgets', 'Home Electronics'],
  },
  {
    name: 'Toys & Games',
    icon: 'Gamepad2',
    subcategories: ['Educational Toys', 'Games', "Kids' Products"],
  },
];

// A few demo products spread across subcategories so listing, filtering and
// pagination have something to show. imageUrl uses brand-colored placeholders.
const DEMO_PRODUCTS: {
  category: string;
  subcategory: string;
  name: string;
  description: string;
}[] = [
  {
    category: 'Health & Household',
    subcategory: 'Vitamins',
    name: 'Daily Multivitamin Gummies (90 ct)',
    description:
      'Complete multivitamin gummies with vitamins A, C, D, E and B-complex for daily immune support.',
  },
  {
    category: 'Health & Household',
    subcategory: 'Supplements',
    name: 'Omega-3 Fish Oil Softgels (120 ct)',
    description:
      'High-potency omega-3 softgels with EPA and DHA to support heart and brain health.',
  },
  {
    category: 'Beauty & Personal Care',
    subcategory: 'Skin Care',
    name: 'Hydrating Facial Serum with Hyaluronic Acid',
    description:
      'Lightweight daily serum that boosts hydration and improves skin elasticity for all skin types.',
  },
  {
    category: 'Pet Supplies',
    subcategory: 'Pet Food',
    name: 'Grain-Free Dry Dog Food, Chicken (24 lb)',
    description:
      'Protein-rich grain-free kibble made with real chicken, sweet potatoes and garden vegetables.',
  },
  {
    category: 'Home & Kitchen',
    subcategory: 'Appliances',
    name: '12-Cup Programmable Coffee Maker',
    description:
      'Drip coffee maker with programmable timer, auto shut-off, glass carafe and reusable filter.',
  },
  {
    category: 'Home & Kitchen',
    subcategory: 'Cookware',
    name: 'Nonstick Cookware Set (10 pieces)',
    description:
      'Scratch-resistant nonstick pots and pans with stay-cool handles, dishwasher safe.',
  },
  {
    category: 'Electronics & Accessories',
    subcategory: 'Headphones',
    name: 'Wireless Over-Ear Headphones ANC',
    description:
      'Bluetooth 5.3 headphones with active noise cancelling, 40-hour battery and fast charge.',
  },
  {
    category: 'Electronics & Accessories',
    subcategory: 'Chargers',
    name: '65W USB-C Fast Wall Charger (2-pack)',
    description:
      'GaN fast charger compatible with phones, tablets and laptops; foldable plug design.',
  },
  {
    category: 'Sports & Outdoors',
    subcategory: 'Fitness',
    name: 'Adjustable Dumbbell Set 5–52.5 lb',
    description:
      'Space-saving adjustable dumbbells with quick-select dial, ideal for home gyms.',
  },
  {
    category: 'Toys & Games',
    subcategory: 'Educational Toys',
    name: 'STEM Building Blocks Kit (250 pieces)',
    description:
      'Creative construction kit that develops motor skills and problem solving for ages 6+.',
  },
];

async function main() {
  const subcategoryIds = new Map<string, string>(); // "category/subcategory" -> id

  for (const cat of CATALOG) {
    const category = await upsertCategory(cat.name, cat.icon);
    for (const subName of cat.subcategories) {
      const sub = await upsertSubcategory(category.id, subName);
      subcategoryIds.set(`${cat.name}/${subName}`, sub.id);
    }
  }

  for (const p of DEMO_PRODUCTS) {
    const subId = subcategoryIds.get(`${p.category}/${p.subcategory}`);
    if (!subId) continue;
    await ensureProduct(subId, {
      name: p.name,
      description: p.description,
      link: 'https://www.amazon.com/',
      imageUrl: `https://placehold.co/600x600/0A1633/F5A524?text=${encodeURIComponent(
        p.name.split(' ').slice(0, 2).join(' '),
      )}`,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
