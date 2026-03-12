// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCT REPOSITORY (SQL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { execute, executeOne } from '../db/index.js';

export const getProductById = async (productId) =>
  executeOne(
    `SELECT id, name, slug, description, shortDescription, status, basePrice,
            compareAtPrice, costPrice, weight, dimensions, isFeatured, isNew,
            allowBackorder, allowPreorder, preorderAvailableDate,
            viewCount, purchaseCount, averageRating, reviewCount,
            createdAt, updatedAt, publishedAt,
            categoryId, brandId, createdById
       FROM products
      WHERE id = ?`,
    [productId]
  );

export const getProductVariantById = async (variantId) =>
  executeOne(
    `SELECT pv.id, pv.productId, pv.sku, pv.barcode, pv.attributes, pv.price,
            pv.compareAtPrice, pv.costPrice, pv.weight, pv.stockQuantity,
            pv.lowStockThreshold, pv.version, pv.isActive, pv.isDefault,
            p.name AS productName, p.status AS productStatus
       FROM product_variants pv
       JOIN products p ON p.id = pv.productId
      WHERE pv.id = ?`,
    [variantId]
  );

export const getPrimaryImageByProductId = async (productId) =>
  executeOne(
    `SELECT url, altText
       FROM product_images
      WHERE productId = ? AND isPrimary = 1
      ORDER BY displayOrder ASC
      LIMIT 1`,
    [productId]
  );

export const getProductWithVariants = async (productId) => {
  const product = await getProductById(productId);
  if (!product) return null;

  const variants = await execute(
    `SELECT id, sku, attributes, price, compareAtPrice, costPrice, weight,
            stockQuantity, lowStockThreshold, isActive, isDefault
       FROM product_variants
      WHERE productId = ?
      ORDER BY isDefault DESC, createdAt ASC`,
    [productId]
  );

  const images = await execute(
    `SELECT url, altText, displayOrder, isPrimary
       FROM product_images
      WHERE productId = ?
      ORDER BY isPrimary DESC, displayOrder ASC`,
    [productId]
  );

  return { ...product, variants, images };
};
