// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN PRODUCTS REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const listProducts = async ({ status, categoryId, search, limit, offset, sortBy }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  }
  if (categoryId) {
    conditions.push('p.categoryId = ?');
    params.push(categoryId);
  }
  if (search) {
    conditions.push('(p.name LIKE ? OR p.slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortClause = sortBy === 'name'
    ? 'ORDER BY p.name ASC'
    : sortBy === 'newest'
      ? 'ORDER BY p.createdAt DESC'
      : 'ORDER BY p.createdAt DESC';

  return execute(
    `SELECT p.id, p.name, p.slug, p.status, p.createdAt,
            c.name AS categoryName,
            b.name AS brandName,
            MIN(pv.price) AS minPrice,
            MAX(pv.price) AS maxPrice,
            COUNT(pv.id) AS variantCount
       FROM products p
       LEFT JOIN categories c ON c.id = p.categoryId
       LEFT JOIN brands b ON b.id = p.brandId
       LEFT JOIN product_variants pv ON pv.productId = p.id
      ${whereClause}
      GROUP BY p.id
      ${sortClause}
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
};

export const countProducts = async ({ status, categoryId, search }) => {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (categoryId) {
    conditions.push('categoryId = ?');
    params.push(categoryId);
  }
  if (search) {
    conditions.push('(name LIKE ? OR slug LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return executeOne(
    `SELECT COUNT(*) AS total FROM products ${whereClause}`,
    params
  );
};

export const getProductById = async (productId) =>
  executeOne(
    `SELECT p.*, c.name AS categoryName, b.name AS brandName
       FROM products p
       LEFT JOIN categories c ON c.id = p.categoryId
       LEFT JOIN brands b ON b.id = p.brandId
      WHERE p.id = ?`,
    [productId]
  );

export const listProductVariants = async (productId) =>
  execute(
    `SELECT id, productId, sku, attributes, price, compareAtPrice, costPrice, stockQuantity,
            lowStockThreshold, isActive, isDefault, createdAt, updatedAt
       FROM product_variants
      WHERE productId = ?
      ORDER BY isDefault DESC, createdAt ASC`,
    [productId]
  );

export const listProductImages = async (productId) =>
  execute(
    `SELECT id, productId, url, altText, displayOrder, isPrimary, createdAt
       FROM product_images
      WHERE productId = ?
      ORDER BY isPrimary DESC, displayOrder ASC`,
    [productId]
  );

export const getProductImageById = async (imageId) =>
  executeOne(
    `SELECT id, productId, url, altText, displayOrder, isPrimary, createdAt
       FROM product_images
      WHERE id = ?`,
    [imageId]
  );

export const getVariantById = async (variantId) =>
  executeOne(
    `SELECT id, productId, sku, attributes, price, compareAtPrice, costPrice, stockQuantity,
            lowStockThreshold, isActive, isDefault, createdAt, updatedAt
       FROM product_variants
      WHERE id = ?`,
    [variantId]
  );

export const findVariantBySku = async (sku) =>
  executeOne(
    `SELECT id, productId, sku FROM product_variants WHERE sku = ?`,
    [sku]
  );

export const findProductBySlug = async (slug) =>
  executeOne(
    `SELECT id FROM products WHERE slug = ?`,
    [slug]
  );

export const insertProduct = async (data) => {
  const {
    id,
    name,
    slug,
    description,
    shortDescription,
    categoryId,
    brandId,
    status,
    basePrice,
    createdById,
  } = data;

  await execute(
    `INSERT INTO products
        (id, name, slug, description, shortDescription, categoryId, brandId,
         status, basePrice, createdById, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      name,
      slug,
      description || null,
      shortDescription || null,
      categoryId,
      brandId || null,
      status,
      basePrice,
      createdById,
    ]
  );

  return getProductById(id);
};

export const updateProduct = async (productId, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return getProductById(productId);

  values.push(productId);

  await execute(
    `UPDATE products SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return getProductById(productId);
};

export const insertVariant = async (data) => {
  const { id, productId, sku, attributes, price, costPrice, isDefault } = data;

  await execute(
    `INSERT INTO product_variants
        (id, productId, sku, attributes, price, costPrice, stockQuantity,
         lowStockThreshold, isActive, isDefault, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, 10, 1, ?, NOW(), NOW())`,
    [id, productId, sku, attributes, price, costPrice || null, isDefault ? 1 : 0]
  );

  return executeOne(
    `SELECT * FROM product_variants WHERE id = ?`,
    [id]
  );
};

export const updateVariant = async (variantId, updates) => {
  const fields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (fields.length === 0) return executeOne(`SELECT * FROM product_variants WHERE id = ?`, [variantId]);

  values.push(variantId);

  await execute(
    `UPDATE product_variants SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return executeOne(
    `SELECT * FROM product_variants WHERE id = ?`,
    [variantId]
  );
};

export const updateVariantPrice = async (variantId, price) =>
  execute(
    `UPDATE product_variants SET price = ?, updatedAt = NOW() WHERE id = ?`,
    [price, variantId]
  );

export const updateProductStatusBulk = async (productIds, status) => {
  if (productIds.length === 0) return { updated: 0 };

  await execute(
    `UPDATE products SET status = ?, updatedAt = NOW() WHERE id IN (${productIds.map(() => '?').join(', ')})`,
    [status, ...productIds]
  );

  return { updated: productIds.length };
};

export const insertProductImage = async (data) => {
  const { id, productId, url, altText, isPrimary, displayOrder } = data;

  await execute(
    `INSERT INTO product_images
        (id, productId, url, altText, isPrimary, displayOrder, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [id, productId, url, altText || null, isPrimary ? 1 : 0, displayOrder || 0]
  );

  return executeOne(
    `SELECT * FROM product_images WHERE id = ?`,
    [id]
  );
};

export const deleteProductImage = async (imageId) =>
  execute(
    `DELETE FROM product_images WHERE id = ?`,
    [imageId]
  );
