import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment.');
}

const url = new URL(databaseUrl);
const dbName = url.pathname.replace(/^\//, '');

if (!dbName) {
  throw new Error('DATABASE_URL must include a database name.');
}

const port = url.port ? parseInt(url.port, 10) : 3306;
const user = decodeURIComponent(url.username || '');
const password = decodeURIComponent(url.password || '');

const connection = await mysql.createConnection({
  host: url.hostname,
  port,
  user,
  password,
  database: dbName,
  multipleStatements: false,
});

const log = (message) => console.log(`[seed-tech] ${message}`);

const getByEmail = async (email) => {
  const [rows] = await connection.execute(
    'SELECT id, email, role FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

const getBySlug = async (table, slug) => {
  const [rows] = await connection.execute(
    `SELECT id, slug FROM ${table} WHERE slug = ? LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
};

const upsertUser = async ({ email, firstName, lastName, role, plainPassword }) => {
  const existing = await getByEmail(email);
  const passwordHash = await bcrypt.hash(plainPassword, 12);

  if (existing) {
    await connection.execute(
      `UPDATE users
          SET firstName = ?,
              lastName = ?,
              role = ?,
              passwordHash = ?,
              isActive = 1,
              isEmailVerified = 1,
              updatedAt = NOW()
        WHERE id = ?`,
      [firstName, lastName, role, passwordHash, existing.id]
    );
    return existing.id;
  }

  await connection.execute(
    `INSERT INTO users (id, email, passwordHash, role, firstName, lastName, isActive, isEmailVerified, authProvider, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, 1, 1, 'EMAIL', NOW(), NOW())`,
    [email, passwordHash, role, firstName, lastName]
  );

  const created = await getByEmail(email);
  return created.id;
};

const upsertInstructorProfile = async (userId, profile) => {
  const [rows] = await connection.execute(
    'SELECT id FROM instructors WHERE userId = ? LIMIT 1',
    [userId]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE instructors
          SET headline = ?,
              bio = ?,
              websiteUrl = ?,
              socialLinks = ?,
              expertise = ?,
              isVerified = 1,
              updatedAt = NOW()
        WHERE userId = ?`,
      [
        profile.headline,
        profile.bio,
        profile.websiteUrl,
        JSON.stringify(profile.socialLinks || {}),
        profile.expertise,
        userId,
      ]
    );
    return;
  }

  await connection.execute(
    `INSERT INTO instructors (id, userId, headline, bio, websiteUrl, socialLinks, expertise, isVerified, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      userId,
      profile.headline,
      profile.bio,
      profile.websiteUrl,
      JSON.stringify(profile.socialLinks || {}),
      profile.expertise,
    ]
  );
};

const upsertCategory = async ({ name, slug, description, order }) => {
  const existing = await getBySlug('categories', slug);

  if (existing) {
    await connection.execute(
      `UPDATE categories
          SET name = ?,
              description = ?,
              isActive = 1,
              displayOrder = ?,
              updatedAt = NOW()
        WHERE id = ?`,
      [name, description, order, existing.id]
    );
    return existing.id;
  }

  await connection.execute(
    `INSERT INTO categories (id, name, slug, description, displayOrder, isActive, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, 1, NOW(), NOW())`,
    [name, slug, description, order]
  );

  const created = await getBySlug('categories', slug);
  return created.id;
};

const upsertBrand = async ({ name, slug, description }) => {
  const existing = await getBySlug('brands', slug);

  if (existing) {
    await connection.execute(
      `UPDATE brands
          SET name = ?,
              description = ?,
              isActive = 1,
              updatedAt = NOW()
        WHERE id = ?`,
      [name, description, existing.id]
    );
    return existing.id;
  }

  await connection.execute(
    `INSERT INTO brands (id, name, slug, description, isActive, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, 1, NOW(), NOW())`,
    [name, slug, description]
  );

  const created = await getBySlug('brands', slug);
  return created.id;
};

const upsertProduct = async ({
  name,
  slug,
  description,
  shortDescription,
  categoryId,
  brandId,
  basePrice,
  compareAtPrice,
  costPrice,
  status,
  createdById,
}) => {
  const existing = await getBySlug('products', slug);

  if (existing) {
    await connection.execute(
      `UPDATE products
          SET name = ?,
              description = ?,
              shortDescription = ?,
              categoryId = ?,
              brandId = ?,
              basePrice = ?,
              compareAtPrice = ?,
              costPrice = ?,
              status = ?,
              publishedAt = CASE WHEN ? = 'ACTIVE' THEN COALESCE(publishedAt, NOW()) ELSE publishedAt END,
              updatedAt = NOW()
        WHERE id = ?`,
      [
        name,
        description,
        shortDescription,
        categoryId,
        brandId,
        basePrice,
        compareAtPrice,
        costPrice,
        status,
        status,
        existing.id,
      ]
    );
    return existing.id;
  }

  await connection.execute(
    `INSERT INTO products (
      id, name, slug, description, shortDescription, categoryId, brandId,
      basePrice, compareAtPrice, costPrice, status, metaTitle, metaDescription,
      createdById, publishedAt, createdAt, updatedAt
    )
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      name,
      slug,
      description,
      shortDescription,
      categoryId,
      brandId,
      basePrice,
      compareAtPrice,
      costPrice,
      status,
      name,
      shortDescription,
      createdById,
    ]
  );

  const created = await getBySlug('products', slug);
  return created.id;
};

const upsertVariant = async ({
  productId,
  sku,
  attributes,
  price,
  compareAtPrice,
  costPrice,
  stockQuantity,
  isDefault,
}) => {
  const [rows] = await connection.execute(
    'SELECT id FROM product_variants WHERE sku = ? LIMIT 1',
    [sku]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE product_variants
          SET productId = ?,
              attributes = ?,
              price = ?,
              compareAtPrice = ?,
              costPrice = ?,
              stockQuantity = ?,
              isDefault = ?,
              isActive = 1,
              updatedAt = NOW()
        WHERE id = ?`,
      [
        productId,
        JSON.stringify(attributes),
        price,
        compareAtPrice,
        costPrice,
        stockQuantity,
        isDefault ? 1 : 0,
        rows[0].id,
      ]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO product_variants (
      id, productId, sku, attributes, price, compareAtPrice, costPrice,
      stockQuantity, lowStockThreshold, isDefault, isActive, createdAt, updatedAt
    )
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 10, ?, 1, NOW(), NOW())`,
    [
      productId,
      sku,
      JSON.stringify(attributes),
      price,
      compareAtPrice,
      costPrice,
      stockQuantity,
      isDefault ? 1 : 0,
    ]
  );

  const [createdRows] = await connection.execute(
    'SELECT id FROM product_variants WHERE sku = ? LIMIT 1',
    [sku]
  );
  return createdRows[0].id;
};

const upsertCourse = async ({
  instructorId,
  title,
  slug,
  category,
  level,
  price,
  shortDescription,
  description,
}) => {
  const existing = await getBySlug('courses', slug);

  if (existing) {
    await connection.execute(
      `UPDATE courses
          SET instructorId = ?,
              title = ?,
              category = ?,
              level = ?,
              price = ?,
              shortDescription = ?,
              description = ?,
              language = 'English',
              status = 'PUBLISHED',
              publishedAt = COALESCE(publishedAt, NOW()),
              updatedAt = NOW()
        WHERE id = ?`,
      [
        instructorId,
        title,
        category,
        level,
        price,
        shortDescription,
        description,
        existing.id,
      ]
    );
    return existing.id;
  }

  await connection.execute(
    `INSERT INTO courses (
      id, instructorId, title, slug, shortDescription, description, category,
      level, language, price, status, isFeatured, totalDurationMinutes,
      totalLessons, createdAt, updatedAt, publishedAt
    )
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, 'English', ?, 'PUBLISHED', 1, 0, 0, NOW(), NOW(), NOW())`,
    [instructorId, title, slug, shortDescription, description, category, level, price]
  );

  const created = await getBySlug('courses', slug);
  return created.id;
};

const upsertSection = async ({ courseId, title, description, displayOrder }) => {
  const [rows] = await connection.execute(
    `SELECT id FROM course_sections
      WHERE courseId = ? AND title = ?
      LIMIT 1`,
    [courseId, title]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE course_sections
          SET description = ?, displayOrder = ?, updatedAt = NOW()
        WHERE id = ?`,
      [description, displayOrder, rows[0].id]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO course_sections (id, courseId, title, description, displayOrder, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, NOW(), NOW())`,
    [courseId, title, description, displayOrder]
  );

  const [createdRows] = await connection.execute(
    `SELECT id FROM course_sections
      WHERE courseId = ? AND title = ?
      LIMIT 1`,
    [courseId, title]
  );
  return createdRows[0].id;
};

const upsertLesson = async ({
  courseId,
  sectionId,
  title,
  contentType,
  videoUrl,
  content,
  durationMinutes,
  displayOrder,
  isPreview,
}) => {
  const [rows] = await connection.execute(
    `SELECT id FROM course_lessons
      WHERE courseId = ? AND sectionId = ? AND title = ?
      LIMIT 1`,
    [courseId, sectionId, title]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE course_lessons
          SET contentType = ?,
              videoUrl = ?,
              content = ?,
              durationMinutes = ?,
              displayOrder = ?,
              isPreview = ?,
              updatedAt = NOW()
        WHERE id = ?`,
      [
        contentType,
        videoUrl || null,
        content || null,
        durationMinutes,
        displayOrder,
        isPreview ? 1 : 0,
        rows[0].id,
      ]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO course_lessons (
      id, sectionId, courseId, title, contentType, videoUrl, content,
      durationMinutes, isPreview, displayOrder, createdAt, updatedAt
    )
    VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      sectionId,
      courseId,
      title,
      contentType,
      videoUrl || null,
      content || null,
      durationMinutes,
      isPreview ? 1 : 0,
      displayOrder,
    ]
  );

  const [createdRows] = await connection.execute(
    `SELECT id FROM course_lessons
      WHERE courseId = ? AND sectionId = ? AND title = ?
      LIMIT 1`,
    [courseId, sectionId, title]
  );
  return createdRows[0].id;
};

const syncCourseStats = async (courseId) => {
  await connection.execute(
    `UPDATE courses
        SET totalLessons = (
          SELECT COUNT(*) FROM course_lessons WHERE courseId = ?
        ),
            totalDurationMinutes = (
              SELECT COALESCE(SUM(durationMinutes), 0) FROM course_lessons WHERE courseId = ?
            ),
            updatedAt = NOW()
      WHERE id = ?`,
    [courseId, courseId, courseId]
  );
};

const upsertEnrollment = async ({ courseId, studentId }) => {
  const [rows] = await connection.execute(
    `SELECT id, totalLessons FROM course_enrollments
      WHERE courseId = ? AND studentId = ?
      LIMIT 1`,
    [courseId, studentId]
  );

  const [courseRows] = await connection.execute(
    'SELECT totalLessons FROM courses WHERE id = ? LIMIT 1',
    [courseId]
  );
  const totalLessons = courseRows[0]?.totalLessons || 0;

  if (rows[0]) {
    await connection.execute(
      `UPDATE course_enrollments
          SET status = 'ACTIVE',
              totalLessons = ?,
              lastAccessedAt = NOW()
        WHERE id = ?`,
      [totalLessons, rows[0].id]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO course_enrollments (
      id, courseId, studentId, status, progressPercent, completedLessons,
      totalLessons, enrolledAt, lastAccessedAt
    )
    VALUES (UUID(), ?, ?, 'ACTIVE', 0, 0, ?, NOW(), NOW())`,
    [courseId, studentId, totalLessons]
  );

  const [createdRows] = await connection.execute(
    `SELECT id FROM course_enrollments
      WHERE courseId = ? AND studentId = ?
      LIMIT 1`,
    [courseId, studentId]
  );
  return createdRows[0].id;
};

const upsertLessonProgress = async ({ enrollmentId, lessonId, status }) => {
  const [rows] = await connection.execute(
    `SELECT id FROM lesson_progress
      WHERE enrollmentId = ? AND lessonId = ?
      LIMIT 1`,
    [enrollmentId, lessonId]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE lesson_progress
          SET status = ?,
              completedAt = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completedAt, NOW()) ELSE completedAt END,
              updatedAt = NOW()
        WHERE id = ?`,
      [status, status, rows[0].id]
    );
    return;
  }

  await connection.execute(
    `INSERT INTO lesson_progress (
      id, enrollmentId, lessonId, status, watchTimeSeconds,
      lastPositionSeconds, completedAt, createdAt, updatedAt
    )
    VALUES (UUID(), ?, ?, ?, 0, 0, ?, NOW(), NOW())`,
    [enrollmentId, lessonId, status, status === 'COMPLETED' ? new Date() : null]
  );
};

const syncEnrollmentProgress = async (enrollmentId) => {
  const [enrollmentRows] = await connection.execute(
    `SELECT totalLessons FROM course_enrollments WHERE id = ? LIMIT 1`,
    [enrollmentId]
  );
  const totalLessons = enrollmentRows[0]?.totalLessons || 0;

  const [completedRows] = await connection.execute(
    `SELECT COUNT(*) AS completedLessons
       FROM lesson_progress
      WHERE enrollmentId = ? AND status = 'COMPLETED'`,
    [enrollmentId]
  );
  const completedLessons = completedRows[0]?.completedLessons || 0;
  const progressPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  await connection.execute(
    `UPDATE course_enrollments
        SET completedLessons = ?,
            progressPercent = ?,
            status = CASE WHEN ? >= totalLessons AND totalLessons > 0 THEN 'COMPLETED' ELSE 'ACTIVE' END,
            completedAt = CASE WHEN ? >= totalLessons AND totalLessons > 0 THEN COALESCE(completedAt, NOW()) ELSE completedAt END,
            lastAccessedAt = NOW()
      WHERE id = ?`,
    [completedLessons, progressPercent, completedLessons, completedLessons, enrollmentId]
  );
};

const upsertAccessorySet = async ({ name, slug, description, bundlePrice, status, createdById }) => {
  const [rows] = await connection.execute(
    'SELECT id FROM desk_accessory_sets WHERE slug = ? LIMIT 1',
    [slug]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE desk_accessory_sets
          SET name = ?, description = ?, bundlePrice = ?, status = ?, createdById = ?, updatedAt = NOW()
        WHERE id = ?`,
      [name, description, bundlePrice || null, status || 'ACTIVE', createdById, rows[0].id]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO desk_accessory_sets (id, name, slug, description, bundlePrice, status, createdById, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, slug, description || null, bundlePrice || null, status || 'ACTIVE', createdById]
  );

  const [createdRows] = await connection.execute(
    'SELECT id FROM desk_accessory_sets WHERE slug = ? LIMIT 1',
    [slug]
  );
  return createdRows[0].id;
};

const upsertAccessorySetItem = async ({ setId, productId, variantId, quantity, displayOrder, note }) => {
  const [rows] = await connection.execute(
    `SELECT id FROM desk_accessory_set_items
      WHERE setId = ? AND productId = ? AND ((variantId IS NULL AND ? IS NULL) OR variantId = ?)
      LIMIT 1`,
    [setId, productId, variantId || null, variantId || null]
  );

  if (rows[0]) {
    await connection.execute(
      `UPDATE desk_accessory_set_items
          SET quantity = ?, displayOrder = ?, note = ?, updatedAt = NOW()
        WHERE id = ?`,
      [quantity || 1, displayOrder || 0, note || null, rows[0].id]
    );
    return rows[0].id;
  }

  await connection.execute(
    `INSERT INTO desk_accessory_set_items (id, setId, productId, variantId, quantity, displayOrder, note, createdAt, updatedAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [setId, productId, variantId || null, quantity || 1, displayOrder || 0, note || null]
  );

  const [createdRows] = await connection.execute(
    `SELECT id FROM desk_accessory_set_items
      WHERE setId = ? AND productId = ? AND ((variantId IS NULL AND ? IS NULL) OR variantId = ?)
      LIMIT 1`,
    [setId, productId, variantId || null, variantId || null]
  );
  return createdRows[0].id;
};

try {
  log('Seeding users...');
  const adminId = await upsertUser({
    email: 'admin@techforge.dev',
    firstName: 'Admin',
    lastName: 'Techforge',
    role: 'ADMIN',
    plainPassword: 'Password123',
  });

  const instructorId = await upsertUser({
    email: 'instructor@techforge.dev',
    firstName: 'Lin',
    lastName: 'Nguyen',
    role: 'INSTRUCTOR',
    plainPassword: 'Password123',
  });

  const studentId = await upsertUser({
    email: 'student@techforge.dev',
    firstName: 'Narith',
    lastName: 'Student',
    role: 'STUDENT',
    plainPassword: 'Password123',
  });

  await upsertInstructorProfile(instructorId, {
    headline: 'Senior Full-Stack Engineer and Mentor',
    bio: 'Builds production systems with Node.js, React, and MySQL. Teaches practical engineering patterns.',
    websiteUrl: 'https://techforge.dev',
    socialLinks: {
      github: 'https://github.com/techforge',
      linkedin: 'https://linkedin.com/in/techforge',
    },
    expertise: 'Node.js, React, SQL, System Design',
  });

  log('Seeding categories and brands...');
  const keyboardCategoryId = await upsertCategory({
    name: 'Mechanical Keyboards',
    slug: 'mechanical-keyboards',
    description: 'Premium keyboards for developers and creators.',
    order: 1,
  });
  const deskCategoryId = await upsertCategory({
    name: 'Desk Setup Accessories',
    slug: 'desk-setup-accessories',
    description: 'Cable management, monitor lights, desk mats, and more.',
    order: 2,
  });

  const keychronBrandId = await upsertBrand({
    name: 'Keychron',
    slug: 'keychron',
    description: 'Developer-friendly mechanical keyboards.',
  });
  const benqBrandId = await upsertBrand({
    name: 'BenQ',
    slug: 'benq',
    description: 'Monitor lighting and productivity tools.',
  });

  log('Seeding products and variants...');
  const keychronProductId = await upsertProduct({
    name: 'Keychron K8 Pro Hot-Swap Keyboard',
    slug: 'keychron-k8-pro-hot-swap-keyboard',
    description: 'Wireless mechanical keyboard with hot-swappable switches and macOS/Windows layout support.',
    shortDescription: 'Hot-swap mechanical keyboard for coding sessions.',
    categoryId: keyboardCategoryId,
    brandId: keychronBrandId,
    basePrice: 109.99,
    compareAtPrice: 129.99,
    costPrice: 72.0,
    status: 'ACTIVE',
    createdById: adminId,
  });

  await upsertVariant({
    productId: keychronProductId,
    sku: 'KEYCHRON-K8P-RGB-BROWN',
    attributes: { layout: 'TKL', switch: 'Gateron Brown', color: 'RGB' },
    price: 109.99,
    compareAtPrice: 129.99,
    costPrice: 72.0,
    stockQuantity: 60,
    isDefault: true,
  });

  await upsertVariant({
    productId: keychronProductId,
    sku: 'KEYCHRON-K8P-RGB-RED',
    attributes: { layout: 'TKL', switch: 'Gateron Red', color: 'RGB' },
    price: 109.99,
    compareAtPrice: 129.99,
    costPrice: 72.0,
    stockQuantity: 45,
    isDefault: false,
  });

  const monitorLightProductId = await upsertProduct({
    name: 'BenQ ScreenBar Halo Monitor Light',
    slug: 'benq-screenbar-halo-monitor-light',
    description: 'Asymmetric monitor lighting that reduces eye strain and keeps your desk clean.',
    shortDescription: 'Premium monitor light for late-night coding.',
    categoryId: deskCategoryId,
    brandId: benqBrandId,
    basePrice: 159.0,
    compareAtPrice: 179.0,
    costPrice: 108.0,
    status: 'ACTIVE',
    createdById: adminId,
  });

  await upsertVariant({
    productId: monitorLightProductId,
    sku: 'BENQ-SCREENBAR-HALO-STD',
    attributes: { edition: 'Standard' },
    price: 159.0,
    compareAtPrice: 179.0,
    costPrice: 108.0,
    stockQuantity: 35,
    isDefault: true,
  });

  log('Seeding desk accessory sets...');
  const devDeskSetId = await upsertAccessorySet({
    name: 'Developer Desk Starter Set',
    slug: 'developer-desk-starter-set',
    description: 'A balanced setup with an ergonomic keyboard and monitor lighting for long coding sessions.',
    bundlePrice: 249.0,
    status: 'ACTIVE',
    createdById: adminId,
  });

  await upsertAccessorySetItem({
    setId: devDeskSetId,
    productId: keychronProductId,
    variantId: null,
    quantity: 1,
    displayOrder: 1,
    note: 'Choose preferred switch type at checkout',
  });

  await upsertAccessorySetItem({
    setId: devDeskSetId,
    productId: monitorLightProductId,
    variantId: null,
    quantity: 1,
    displayOrder: 2,
    note: 'Helps reduce eye fatigue at night',
  });

  log('Seeding courses, sections, and lessons...');
  const nodeCourseId = await upsertCourse({
    instructorId,
    title: 'Node.js API Engineering Bootcamp',
    slug: 'nodejs-api-engineering-bootcamp',
    category: 'Backend Development',
    level: 'INTERMEDIATE',
    price: 79.0,
    shortDescription: 'Design and ship production-grade Node.js APIs with MySQL and Express.',
    description:
      'A practical backend course covering API architecture, authentication, SQL patterns, and deployment checklists.',
  });

  const nodeSec1 = await upsertSection({
    courseId: nodeCourseId,
    title: 'API Foundations',
    description: 'Project structure, request lifecycle, and controller-service-repository patterns.',
    displayOrder: 1,
  });
  const nodeSec2 = await upsertSection({
    courseId: nodeCourseId,
    title: 'Authentication and RBAC',
    description: 'JWT auth, role guards, and permission modeling.',
    displayOrder: 2,
  });

  const nodeLesson1 = await upsertLesson({
    courseId: nodeCourseId,
    sectionId: nodeSec1,
    title: 'Designing a Scalable Express Architecture',
    contentType: 'VIDEO',
    videoUrl: 'https://www.youtube.com/embed/1ANZx8A5s8A',
    content: null,
    durationMinutes: 24,
    displayOrder: 1,
    isPreview: true,
  });
  await upsertLesson({
    courseId: nodeCourseId,
    sectionId: nodeSec1,
    title: 'Repository Pattern with MySQL2',
    contentType: 'TEXT',
    videoUrl: null,
    content: 'Implement repository helpers for list/get/create/update operations with safe parameterized queries.',
    durationMinutes: 18,
    displayOrder: 2,
    isPreview: false,
  });
  await upsertLesson({
    courseId: nodeCourseId,
    sectionId: nodeSec2,
    title: 'JWT Middleware and Access Control',
    contentType: 'VIDEO',
    videoUrl: 'https://www.youtube.com/embed/mbsmsi7l3r4',
    content: null,
    durationMinutes: 22,
    displayOrder: 1,
    isPreview: false,
  });

  const reactCourseId = await upsertCourse({
    instructorId,
    title: 'React Frontend Patterns for Commerce Apps',
    slug: 'react-frontend-patterns-for-commerce-apps',
    category: 'Frontend Development',
    level: 'BEGINNER',
    price: 59.0,
    shortDescription: 'Build modular storefront interfaces with reusable components and API integration.',
    description:
      'Hands-on frontend course focused on page composition, async data patterns, and scalable component architecture.',
  });

  const reactSec1 = await upsertSection({
    courseId: reactCourseId,
    title: 'Page Composition and Routing',
    description: 'Build store and course pages with a consistent layout system.',
    displayOrder: 1,
  });
  await upsertLesson({
    courseId: reactCourseId,
    sectionId: reactSec1,
    title: 'Building a Product Listing Experience',
    contentType: 'VIDEO',
    videoUrl: 'https://www.youtube.com/embed/Ke90Tje7VS0',
    content: null,
    durationMinutes: 20,
    displayOrder: 1,
    isPreview: true,
  });
  const reactLesson2 = await upsertLesson({
    courseId: reactCourseId,
    sectionId: reactSec1,
    title: 'Integrating Axios Services and UI State',
    contentType: 'TEXT',
    videoUrl: null,
    content: 'Model loading, error, and success states with reusable hooks and centralized API clients.',
    durationMinutes: 15,
    displayOrder: 2,
    isPreview: false,
  });

  await syncCourseStats(nodeCourseId);
  await syncCourseStats(reactCourseId);

  log('Seeding enrollments and lesson progress...');
  const enrollmentNode = await upsertEnrollment({
    courseId: nodeCourseId,
    studentId,
  });
  const enrollmentReact = await upsertEnrollment({
    courseId: reactCourseId,
    studentId,
  });

  await upsertLessonProgress({
    enrollmentId: enrollmentNode,
    lessonId: nodeLesson1,
    status: 'COMPLETED',
  });
  await upsertLessonProgress({
    enrollmentId: enrollmentReact,
    lessonId: reactLesson2,
    status: 'IN_PROGRESS',
  });

  await syncEnrollmentProgress(enrollmentNode);
  await syncEnrollmentProgress(enrollmentReact);

  log('Seed completed successfully.');
  log('Admin: admin@techforge.dev / Password123');
  log('Instructor: instructor@techforge.dev / Password123');
  log('Student: student@techforge.dev / Password123');
} finally {
  await connection.end();
}
