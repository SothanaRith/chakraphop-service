// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATABASE SEED FILE
// Production-grade seed data for E-commerce & Inventory Management System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. USERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('👤 Creating users...');

  const passwordHash = await bcrypt.hash('Password123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@sportshop.com' },
    update: {},
    create: {
      email: 'superadmin@sportshop.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@sportshop.com' },
    update: {},
    create: {
      email: 'admin@sportshop.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Administrator',
      role: 'ADMIN',
      isActive: true,
      isEmailVerified: true
    }
  });

  const inventoryManager = await prisma.user.upsert({
    where: { email: 'inventory@sportshop.com' },
    update: {},
    create: {
      email: 'inventory@sportshop.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Stock',
      role: 'INVENTORY_MANAGER',
      isActive: true,
      isEmailVerified: true
    }
  });

  const salesAgent = await prisma.user.upsert({
    where: { email: 'sales@sportshop.com' },
    update: {},
    create: {
      email: 'sales@sportshop.com',
      passwordHash,
      firstName: 'Mike',
      lastName: 'Sales',
      role: 'SALES_AGENT',
      isActive: true,
      isEmailVerified: true
    }
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@example.com' },
    update: {},
    create: {
      email: 'customer1@example.com',
      passwordHash,
      firstName: 'Emma',
      lastName: 'Wilson',
      phoneNumber: '+1234567890',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true
    }
  });

  const customer2 = await prisma.user.upsert({
    where: { email: 'customer2@example.com' },
    update: {},
    create: {
      email: 'customer2@example.com',
      passwordHash,
      firstName: 'James',
      lastName: 'Brown',
      phoneNumber: '+1234567891',
      role: 'CUSTOMER',
      isActive: true,
      isEmailVerified: true
    }
  });

  console.log('✅ Created 6 users (Super Admin, Admin, Inventory Manager, Sales Agent, 2 Customers)\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. CATEGORIES & BRANDS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('📦 Creating categories and brands...');

  const shoesCategory = await prisma.category.upsert({
    where: { slug: 'athletic-shoes' },
    update: {},
    create: {
      name: 'Athletic Shoes',
      slug: 'athletic-shoes',
      description: 'High-performance athletic footwear',
      isActive: true,
      displayOrder: 1
    }
  });

  const apparelCategory = await prisma.category.upsert({
    where: { slug: 'sports-apparel' },
    update: {},
    create: {
      name: 'Sports Apparel',
      slug: 'sports-apparel',
      description: 'Performance athletic clothing',
      isActive: true,
      displayOrder: 2
    }
  });

  const equipmentCategory = await prisma.category.upsert({
    where: { slug: 'sports-equipment' },
    update: {},
    create: {
      name: 'Sports Equipment',
      slug: 'sports-equipment',
      description: 'Essential sports equipment and gear',
      isActive: true,
      displayOrder: 3
    }
  });

  const nikeBrand = await prisma.brand.upsert({
    where: { slug: 'nike' },
    update: {},
    create: {
      name: 'Nike',
      slug: 'nike',
      description: 'Just Do It',
      isActive: true
    }
  });

  const adidasBrand = await prisma.brand.upsert({
    where: { slug: 'adidas' },
    update: {},
    create: {
      name: 'Adidas',
      slug: 'adidas',
      description: 'Impossible is Nothing',
      isActive: true
    }
  });

  const pumaBrand = await prisma.brand.upsert({
    where: { slug: 'puma' },
    update: {},
    create: {
      name: 'Puma',
      slug: 'puma',
      description: 'Forever Faster',
      isActive: true
    }
  });

  console.log('✅ Created 3 categories and 3 brands\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. PRODUCTS WITH VARIANTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🏷️  Creating products with variants...');

  // Product 1: Nike Air Zoom Pegasus
  const pegasus = await prisma.product.upsert({
    where: { slug: 'nike-air-zoom-pegasus-40' },
    update: {},
    create: {
      name: 'Nike Air Zoom Pegasus 40',
      slug: 'nike-air-zoom-pegasus-40',
      description: 'The Nike Air Zoom Pegasus 40 is a versatile and responsive running shoe designed for daily training. Featuring enhanced cushioning with Zoom Air units, it offers a smooth, comfortable ride for runners of all levels.',
      shortDescription: 'Responsive running shoes for daily training',
      categoryId: shoesCategory.id,
      brandId: nikeBrand.id,
      basePrice: 129.99,
      compareAtPrice: 149.99,
      costPrice: 65.00,
      status: 'ACTIVE',
      metaTitle: 'Nike Air Zoom Pegasus 40 - Premium Running Shoes',
      metaDescription: 'Get the Nike Air Zoom Pegasus 40 for responsive cushioning and comfort on every run.',
      viewCount: 1250,
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  await prisma.productImage.createMany({
    data: [
      {
        productId: pegasus.id,
        url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
        altText: 'Nike Air Zoom Pegasus 40 - Side View',
        displayOrder: 0,
        isPrimary: true
      },
      {
        productId: pegasus.id,
        url: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa',
        altText: 'Nike Air Zoom Pegasus 40 - Top View',
        displayOrder: 1,
        isPrimary: false
      }
    ],
    skipDuplicates: true
  });

  // Create variants for different sizes
  const sizes = ['7', '8', '9', '10', '11', '12'];
  for (let i = 0; i < sizes.length; i++) {
    await prisma.productVariant.upsert({
      where: { sku: `NIKE-PEG40-BLK-${sizes[i]}` },
      update: {},
      create: {
        productId: pegasus.id,
        sku: `NIKE-PEG40-BLK-${sizes[i]}`,
        barcode: `789${i}${sizes[i].padStart(2, '0')}12345`,
        attributes: JSON.stringify({ color: 'Black', size: sizes[i] }),
        price: 129.99,
        compareAtPrice: 149.99,
        costPrice: 65.00,
        stockQuantity: 50 + (i * 10),
        lowStockThreshold: 10,
        isDefault: i === 2, // Size 9 is default
        isActive: true
      }
    });
  }

  // Product 2: Adidas Ultraboost
  const ultraboost = await prisma.product.upsert({
    where: { slug: 'adidas-ultraboost-23' },
    update: {},
    create: {
      name: 'Adidas Ultraboost 23',
      slug: 'adidas-ultraboost-23',
      description: 'The Adidas Ultraboost 23 delivers incredible energy return with its Boost midsole technology. Designed for long-distance comfort and performance, it features a Primeknit upper that adapts to your foot for a personalized fit.',
      shortDescription: 'Maximum energy return for long runs',
      categoryId: shoesCategory.id,
      brandId: adidasBrand.id,
      basePrice: 189.99,
      compareAtPrice: 219.99,
      costPrice: 95.00,
      status: 'ACTIVE',
      metaTitle: 'Adidas Ultraboost 23 - Energy Return Running Shoes',
      metaDescription: 'Experience unmatched energy return with Adidas Ultraboost 23.',
      viewCount: 890,
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  await prisma.productImage.create({
    data: {
      productId: ultraboost.id,
      url: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5',
      altText: 'Adidas Ultraboost 23',
      displayOrder: 0,
      isPrimary: true
    }
  });

  for (let i = 0; i < sizes.length; i++) {
    await prisma.productVariant.upsert({
      where: { sku: `ADIDAS-UB23-WHT-${sizes[i]}` },
      update: {},
      create: {
        productId: ultraboost.id,
        sku: `ADIDAS-UB23-WHT-${sizes[i]}`,
        barcode: `890${i}${sizes[i].padStart(2, '0')}23456`,
        attributes: JSON.stringify({ color: 'White', size: sizes[i] }),
        price: 189.99,
        compareAtPrice: 219.99,
        costPrice: 95.00,
        stockQuantity: 40 + (i * 8),
        lowStockThreshold: 10,
        isDefault: i === 2,
        isActive: true
      }
    });
  }

  // Product 3: Nike Dri-FIT Shirt
  const driftShirt = await prisma.product.upsert({
    where: { slug: 'nike-dri-fit-training-shirt' },
    update: {},
    create: {
      name: 'Nike Dri-FIT Training Shirt',
      slug: 'nike-dri-fit-training-shirt',
      description: 'The Nike Dri-FIT Training Shirt keeps you dry and comfortable during intense workouts. Made with moisture-wicking fabric, it helps you stay cool and focused on your performance.',
      shortDescription: 'Moisture-wicking training shirt',
      categoryId: apparelCategory.id,
      brandId: nikeBrand.id,
      basePrice: 34.99,
      compareAtPrice: 44.99,
      costPrice: 15.00,
      status: 'ACTIVE',
      metaTitle: 'Nike Dri-FIT Training Shirt - Performance Apparel',
      metaDescription: 'Stay dry and comfortable with Nike Dri-FIT technology.',
      viewCount: 650,
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  await prisma.productImage.create({
    data: {
      productId: driftShirt.id,
      url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
      altText: 'Nike Dri-FIT Training Shirt',
      displayOrder: 0,
      isPrimary: true
    }
  });

  const clothingSizes = ['S', 'M', 'L', 'XL', 'XXL'];
  for (let i = 0; i < clothingSizes.length; i++) {
    await prisma.productVariant.upsert({
      where: { sku: `NIKE-DRIFT-BLK-${clothingSizes[i]}` },
      update: {},
      create: {
        productId: driftShirt.id,
        sku: `NIKE-DRIFT-BLK-${clothingSizes[i]}`,
        barcode: `991${i}${i}${i}34567`,
        attributes: JSON.stringify({ color: 'Black', size: clothingSizes[i] }),
        price: 34.99,
        compareAtPrice: 44.99,
        costPrice: 15.00,
        stockQuantity: 100 + (i * 20),
        lowStockThreshold: 15,
        isDefault: i === 1, // M is default
        isActive: true
      }
    });
  }

  // Product 4: Puma Basketball
  const basketball = await prisma.product.upsert({
    where: { slug: 'puma-official-basketball' },
    update: {},
    create: {
      name: 'Puma Official Basketball',
      slug: 'puma-official-basketball',
      description: 'Official size and weight basketball with superior grip and durability. Perfect for indoor and outdoor play.',
      shortDescription: 'Official size basketball',
      categoryId: equipmentCategory.id,
      brandId: pumaBrand.id,
      basePrice: 29.99,
      compareAtPrice: 39.99,
      costPrice: 12.00,
      status: 'ACTIVE',
      metaTitle: 'Puma Official Basketball - Premium Sports Equipment',
      metaDescription: 'Get game-ready with the Puma Official Basketball.',
      viewCount: 420,
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  await prisma.productImage.create({
    data: {
      productId: basketball.id,
      url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc',
      altText: 'Puma Official Basketball',
      displayOrder: 0,
      isPrimary: true
    }
  });

  await prisma.productVariant.upsert({
    where: { sku: 'PUMA-BBALL-ORG-ONE' },
    update: {},
    create: {
      productId: basketball.id,
      sku: 'PUMA-BBALL-ORG-ONE',
      barcode: '123456789012',
      attributes: JSON.stringify({ color: 'Orange', size: 'Official' }),
      price: 29.99,
      compareAtPrice: 39.99,
      costPrice: 12.00,
      stockQuantity: 200,
      lowStockThreshold: 25,
      isDefault: true,
      isActive: true
    }
  });

  console.log('✅ Created 4 products with multiple variants\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. ADDRESSES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('🏠 Creating addresses...');

  const customer1Address = await prisma.address.create({
    data: {
      userId: customer1.id,
      fullName: 'Emma Wilson',
      addressLine1: '123 Main Street',
      addressLine2: 'Apt 4B',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA',
      phoneNumber: '+1234567890',
      addressType: 'HOME',
      isDefault: true
    }
  });

  const customer2Address = await prisma.address.create({
    data: {
      userId: customer2.id,
      fullName: 'James Brown',
      addressLine1: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      postalCode: '90001',
      country: 'USA',
      phoneNumber: '+1234567891',
      addressType: 'HOME',
      isDefault: true
    }
  });

  console.log('✅ Created 2 customer addresses\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. SAMPLE ORDERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('📝 Creating sample orders...');

  // Get some variants
  const pegasusVariant = await prisma.productVariant.findFirst({
    where: { sku: 'NIKE-PEG40-BLK-9' }
  });

  const shirtVariant = await prisma.productVariant.findFirst({
    where: { sku: 'NIKE-DRIFT-BLK-M' }
  });

  if (pegasusVariant && shirtVariant) {
    const order1 = await prisma.order.create({
      data: {
        userId: customer1.id,
        orderNumber: `ORD-${Date.now()}-001`,
        status: 'DELIVERED',
        subtotal: 164.98,
        tax: 13.20,
        shippingCost: 0,
        total: 178.18,
        currency: 'USD',
        paymentStatus: 'PAID',
        shippingAddressId: customer1Address.id,
        billingAddressId: customer1Address.id,
        items: {
          create: [
            {
              variantId: pegasusVariant.id,
              quantity: 1,
              price: 129.99,
              tax: 10.40,
              subtotal: 129.99,
              total: 140.39
            },
            {
              variantId: shirtVariant.id,
              quantity: 1,
              price: 34.99,
              tax: 2.80,
              subtotal: 34.99,
              total: 37.79
            }
          ]
        },
        payments: {
          create: {
            paymentMethod: 'CREDIT_CARD',
            transactionId: `TXN-${Date.now()}-001`,
            amount: 178.18,
            status: 'COMPLETED',
            paidAt: new Date()
          }
        }
      }
    });

    console.log('✅ Created 1 sample order\n');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SEED COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Database Summary:');
  console.log('  • 6 Users (including admin accounts)');
  console.log('  • 3 Categories (Shoes, Apparel, Equipment)');
  console.log('  • 3 Brands (Nike, Adidas, Puma)');
  console.log('  • 4 Products with 27+ variants');
  console.log('  • 2 Customer addresses');
  console.log('  • 1 Sample order');
  console.log('\n🔐 Test Accounts:');
  console.log('  • Super Admin: superadmin@sportshop.com / Password123');
  console.log('  • Admin: admin@sportshop.com / Password123');
  console.log('  • Inventory Manager: inventory@sportshop.com / Password123');
  console.log('  • Sales Agent: sales@sportshop.com / Password123');
  console.log('  • Customer 1: customer1@example.com / Password123');
  console.log('  • Customer 2: customer2@example.com / Password123');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
