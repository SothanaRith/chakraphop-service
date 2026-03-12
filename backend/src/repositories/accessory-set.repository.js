import { randomUUID } from 'crypto';
import { query, queryOne } from '../db/index.js';

export const listSets = async ({ status = 'ACTIVE', search, includeAllStatuses = false }) => {
  const where = [];
  const params = [];

  if (!includeAllStatuses) {
    where.push('s.status = ?');
    params.push(status || 'ACTIVE');
  } else if (status && status !== 'ALL') {
    where.push('s.status = ?');
    params.push(status);
  }

  if (search) {
    where.push('(LOWER(s.name) LIKE ? OR LOWER(s.description) LIKE ?)');
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return query(
    `SELECT s.id, s.name, s.slug, s.description, s.coverImageUrl, s.bundlePrice, s.status,
            s.createdById, s.createdAt, s.updatedAt,
            u.firstName AS createdByFirstName, u.lastName AS createdByLastName,
            (SELECT COUNT(*) FROM desk_accessory_set_items i WHERE i.setId = s.id) AS itemCount
       FROM desk_accessory_sets s
       JOIN users u ON u.id = s.createdById
       ${whereSql}
      ORDER BY s.updatedAt DESC`,
    params
  );
};

export const getSetBySlug = async (slug) =>
  queryOne(
    `SELECT id, name, slug, description, coverImageUrl, bundlePrice, status, createdById, createdAt, updatedAt
       FROM desk_accessory_sets
      WHERE slug = ?
      LIMIT 1`,
    [slug]
  );

export const getSetById = async (setId) =>
  queryOne(
    `SELECT id, name, slug, description, coverImageUrl, bundlePrice, status, createdById, createdAt, updatedAt
       FROM desk_accessory_sets
      WHERE id = ?
      LIMIT 1`,
    [setId]
  );

export const createSet = async ({ name, slug, description, coverImageUrl, bundlePrice, status, createdById }) => {
  const setId = randomUUID();

  await query(
    `INSERT INTO desk_accessory_sets (id, name, slug, description, coverImageUrl, bundlePrice, status, createdById, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [setId, name, slug, description || null, coverImageUrl || null, bundlePrice || null, status || 'DRAFT', createdById]
  );

  return getSetById(setId);
};

export const updateSet = async (setId, updates) => {
  const allowed = ['name', 'slug', 'description', 'coverImageUrl', 'bundlePrice', 'status'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) {
    return getSetById(setId);
  }

  values.push(setId);
  await query(
    `UPDATE desk_accessory_sets SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return getSetById(setId);
};

export const listSetItems = async (setId) =>
  query(
    `SELECT i.id, i.setId, i.productId, i.variantId, i.quantity, i.displayOrder, i.note,
            i.createdAt, i.updatedAt,
            p.name AS productName, p.slug AS productSlug, p.basePrice,
            v.sku AS variantSku, v.price AS variantPrice
       FROM desk_accessory_set_items i
       JOIN products p ON p.id = i.productId
  LEFT JOIN product_variants v ON v.id = i.variantId
      WHERE i.setId = ?
      ORDER BY i.displayOrder ASC, i.createdAt ASC`,
    [setId]
  );

export const getSetItemById = async (itemId) =>
  queryOne(
    `SELECT id, setId, productId, variantId, quantity, displayOrder, note
       FROM desk_accessory_set_items
      WHERE id = ?
      LIMIT 1`,
    [itemId]
  );

export const createSetItem = async ({ setId, productId, variantId, quantity, displayOrder, note }) => {
  const itemId = randomUUID();

  await query(
    `INSERT INTO desk_accessory_set_items (id, setId, productId, variantId, quantity, displayOrder, note, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [itemId, setId, productId, variantId || null, quantity || 1, displayOrder || 0, note || null]
  );

  return getSetItemById(itemId);
};

export const updateSetItem = async (itemId, updates) => {
  const allowed = ['productId', 'variantId', 'quantity', 'displayOrder', 'note'];
  const fields = [];
  const values = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) {
    return getSetItemById(itemId);
  }

  values.push(itemId);
  await query(
    `UPDATE desk_accessory_set_items SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
    values
  );

  return getSetItemById(itemId);
};

export const deleteSetItem = async (itemId) => {
  await query('DELETE FROM desk_accessory_set_items WHERE id = ?', [itemId]);
};

export const findProductById = async (productId) =>
  queryOne('SELECT id, name, status FROM products WHERE id = ? LIMIT 1', [productId]);

export const findVariantById = async (variantId) =>
  queryOne('SELECT id, productId, sku FROM product_variants WHERE id = ? LIMIT 1', [variantId]);
