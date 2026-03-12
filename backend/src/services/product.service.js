// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCT SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { randomUUID } from 'crypto';
import { query, queryOne, withTransactionRetry } from '../db/index.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../config/logger.js';

class ProductService {
  /**
   * Get all products with filters and pagination
   */
  async getProducts(filters = {}) {
    const {
      page = 1,
      limit = 20,
      categoryId,
      brandId,
      status = 'ACTIVE',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minPrice,
      maxPrice
    } = filters;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const whereClauses = ['p.status = ?'];
    const params = [status];

    if (categoryId) {
      whereClauses.push('p.categoryId = ?');
      params.push(categoryId);
    }

    if (brandId) {
      whereClauses.push('p.brandId = ?');
      params.push(brandId);
    }

    if (search) {
      // Improved search: name (weighted), SKU, category, brand
      whereClauses.push(`(
        LOWER(p.name) LIKE ? OR 
        LOWER(p.description) LIKE ? OR 
        LOWER(p.shortDescription) LIKE ? OR
        EXISTS (
          SELECT 1 FROM product_variants pv 
          WHERE pv.productId = p.id 
          AND LOWER(pv.sku) LIKE ?
        ) OR
        LOWER(c.name) LIKE ? OR
        LOWER(b.name) LIKE ?
      )`);
      const like = `%${search.toLowerCase()}%`;
      params.push(like, like, like, like, like, like);
    }

    if (minPrice || maxPrice) {
      if (minPrice) {
        whereClauses.push('p.basePrice >= ?');
        params.push(parseFloat(minPrice));
      }
      if (maxPrice) {
        whereClauses.push('p.basePrice <= ?');
        params.push(parseFloat(maxPrice));
      }
    }

    const allowedSortFields = new Set([
      'createdAt',
      'basePrice',
      'name',
      'purchaseCount',
      'viewCount',
      'averageRating'
    ]);
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const products = await query(
      `SELECT p.*, 
              c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
              b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.categoryId
         LEFT JOIN brands b ON b.id = p.brandId
         ${whereSql}
        ORDER BY p.${safeSortBy} ${safeSortOrder}
        LIMIT ${safeLimit} OFFSET ${offset}`,
      params
    );

    const totalRows = await queryOne(
      `SELECT COUNT(*) AS total
         FROM products p
         ${whereSql}`,
      params
    );
    const total = totalRows?.total || 0;

    const productIds = products.map((p) => p.id);
    const images = productIds.length
      ? await query(
          `SELECT id, productId, url, altText, displayOrder, isPrimary
             FROM product_images
            WHERE productId IN (${productIds.map(() => '?').join(',')})
              AND isPrimary = 1`,
          productIds
        )
      : [];

    const variants = productIds.length
      ? await query(
          `SELECT id, productId, sku, price, compareAtPrice, stockQuantity, attributes, isDefault
             FROM product_variants
            WHERE productId IN (${productIds.map(() => '?').join(',')})
              AND isActive = 1`,
          productIds
        )
      : [];

    const imagesByProduct = images.reduce((acc, img) => {
      acc[img.productId] = acc[img.productId] || [];
      acc[img.productId].push(img);
      return acc;
    }, {});

    const variantsByProduct = variants.reduce((acc, variant) => {
      acc[variant.productId] = acc[variant.productId] || [];
      acc[variant.productId].push(variant);
      return acc;
    }, {});

    const mappedProducts = products.map((p) => ({
      ...p,
      category: p.category_id
        ? { id: p.category_id, name: p.category_name, slug: p.category_slug }
        : null,
      brand: p.brand_id
        ? { id: p.brand_id, name: p.brand_name, slug: p.brand_slug }
        : null,
      images: imagesByProduct[p.id] || [],
      variants: variantsByProduct[p.id] || [],
    }));

    return {
      products: mappedProducts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    };
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug) {
    const product = await queryOne(
      `SELECT p.*, 
              c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
              b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug
         FROM products p
         LEFT JOIN categories c ON c.id = p.categoryId
         LEFT JOIN brands b ON b.id = p.brandId
        WHERE p.slug = ?
        LIMIT 1`,
      [slug]
    );

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Increment view count
    const images = await query(
      `SELECT id, productId, url, altText, displayOrder, isPrimary
         FROM product_images
        WHERE productId = ?
        ORDER BY displayOrder ASC`,
      [product.id]
    );

    const variants = await query(
      `SELECT id, productId, sku, barcode, attributes, price, compareAtPrice, costPrice,
              weight, stockQuantity, lowStockThreshold, version, isActive, isDefault,
              createdAt, updatedAt
         FROM product_variants
        WHERE productId = ? AND isActive = 1`,
      [product.id]
    );

    const variantIds = variants.map((v) => v.id);
    const stockMovements = variantIds.length
      ? await query(
          `SELECT id, variantId, type, quantityChange, previousQuantity, newQuantity, orderId,
                  purchaseOrderId, reason, notes, performedById, performedAt
             FROM stock_movements
            WHERE variantId IN (${variantIds.map(() => '?').join(',')})
            ORDER BY performedAt DESC
            LIMIT 5`,
          variantIds
        )
      : [];

    const movementsByVariant = stockMovements.reduce((acc, m) => {
      acc[m.variantId] = acc[m.variantId] || [];
      acc[m.variantId].push(m);
      return acc;
    }, {});

    await query(
      `UPDATE products SET viewCount = viewCount + 1 WHERE id = ?`,
      [product.id]
    );

    return {
      ...product,
      category: product.category_id
        ? { id: product.category_id, name: product.category_name, slug: product.category_slug }
        : null,
      brand: product.brand_id
        ? { id: product.brand_id, name: product.brand_name, slug: product.brand_slug }
        : null,
      images,
      variants: variants.map((v) => ({
        ...v,
        stockMovements: movementsByVariant[v.id] || [],
      })),
    };
  }

  /**
   * Create product (admin)
   */
  async createProduct(productData, createdById) {
    const {
      name,
      slug,
      description,
      shortDescription,
      categoryId,
      brandId,
      basePrice,
      compareAtPrice,
      costPrice,
      status = 'DRAFT',
      metaTitle,
      metaDescription,
      variants = [],
      images = []
    } = productData;

    return await withTransactionRetry(async (tx) => {
      const existing = await tx.execute(
        'SELECT id FROM products WHERE slug = ? LIMIT 1',
        [slug]
      );

      if (existing[0]?.length) {
        throw new ValidationError('Product slug already exists');
      }

      const productId = randomUUID();
      const publishedAt = status === 'ACTIVE' ? new Date() : null;

      await tx.execute(
        `INSERT INTO products (id, name, slug, description, shortDescription, categoryId, brandId,
                               basePrice, compareAtPrice, costPrice, status, metaTitle,
                               metaDescription, createdById, publishedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          productId,
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
          metaTitle || name,
          metaDescription || shortDescription,
          createdById,
          publishedAt,
        ]
      );

      for (let index = 0; index < images.length; index += 1) {
        const img = images[index];
        await tx.execute(
          `INSERT INTO product_images (id, productId, url, altText, displayOrder, isPrimary, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            randomUUID(),
            productId,
            img.url,
            img.altText || name,
            index,
            index === 0 ? 1 : 0,
          ]
        );
      }

      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index];
        await tx.execute(
          `INSERT INTO product_variants (id, productId, sku, barcode, attributes, price, compareAtPrice,
                                         costPrice, stockQuantity, lowStockThreshold, isDefault, isActive,
                                         createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            randomUUID(),
            productId,
            variant.sku,
            variant.barcode || null,
            JSON.stringify(variant.attributes || {}),
            variant.price || basePrice,
            variant.compareAtPrice || compareAtPrice,
            variant.costPrice || costPrice,
            variant.stockQuantity || 0,
            variant.lowStockThreshold || 10,
            index === 0 ? 1 : 0,
            1,
          ]
        );
      }

      const createdProduct = await queryOne(
        `SELECT * FROM products WHERE id = ? LIMIT 1`,
        [productId]
      );

      logger.info('Product created', {
        productId: product.id,
        name: product.name,
        createdById
      });

      return createdProduct;
    });
  }

  /**
   * Update product (admin)
   */
  async updateProduct(productId, updates) {
    const allowedFields = new Set([
      'name',
      'slug',
      'description',
      'shortDescription',
      'categoryId',
      'brandId',
      'basePrice',
      'compareAtPrice',
      'costPrice',
      'status',
      'metaTitle',
      'metaDescription',
      'isFeatured',
      'isNew',
      'allowBackorder',
      'allowPreorder',
      'preorderAvailableDate',
      'publishedAt'
    ]);

    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.has(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updates.status === 'ACTIVE' && !updates.publishedAt) {
      fields.push('publishedAt = ?');
      values.push(new Date());
    }

    if (fields.length > 0) {
      values.push(productId);
      await query(
        `UPDATE products SET ${fields.join(', ')}, updatedAt = NOW() WHERE id = ?`,
        values
      );
    }

    const product = await queryOne(
      `SELECT * FROM products WHERE id = ? LIMIT 1`,
      [productId]
    );

    logger.info('Product updated', { productId });

    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId) {
    await query(
      `UPDATE products SET status = 'ARCHIVED', updatedAt = NOW() WHERE id = ?`,
      [productId]
    );

    const product = await queryOne(
      `SELECT * FROM products WHERE id = ? LIMIT 1`,
      [productId]
    );

    logger.info('Product archived', { productId });

    return product;
  }

  /**
   * Get categories
   */
  async getCategories() {
    const categories = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM products p WHERE p.categoryId = c.id) AS products_count
         FROM categories c
        WHERE c.isActive = 1
        ORDER BY c.displayOrder ASC`
    );

    const children = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM products p WHERE p.categoryId = c.id) AS products_count
         FROM categories c
        WHERE c.isActive = 1 AND c.parentId IS NOT NULL
        ORDER BY c.displayOrder ASC`
    );

    const childrenByParent = children.reduce((acc, child) => {
      acc[child.parentId] = acc[child.parentId] || [];
      acc[child.parentId].push(child);
      return acc;
    }, {});

    return categories.map((category) => ({
      ...category,
      children: childrenByParent[category.id] || [],
      _count: { products: category.products_count }
    }));
  }

  /**
   * Get brands
   */
  async getBrands() {
    const brands = await query(
      `SELECT b.*, 
              (SELECT COUNT(*) FROM products p WHERE p.brandId = b.id) AS products_count
         FROM brands b
        WHERE b.isActive = 1
        ORDER BY b.name ASC`
    );

    return brands.map((brand) => ({
      ...brand,
      _count: { products: brand.products_count }
    }));
  }

  /**
   * Search products with relevance ranking
   */
  async searchProducts(searchQuery, limit = 10) {
    if (!searchQuery || searchQuery.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    const searchTerm = `%${searchQuery.toLowerCase()}%`;
    const exactTerm = `${searchQuery.toLowerCase()}`;
    
    // Search with relevance scoring: exact matches ranked highest
    const products = await query(
      `SELECT p.*, 
              c.id AS category_id, c.name AS category_name,
              b.id AS brand_id, b.name AS brand_name,
              (
                CASE 
                  WHEN LOWER(p.name) = ? THEN 1000
                  WHEN LOWER(p.name) LIKE CONCAT(?, '%') THEN 500
                  WHEN LOWER(p.name) LIKE ? THEN 100
                  WHEN LOWER(p.shortDescription) LIKE ? THEN 50
                  WHEN LOWER(p.description) LIKE ? THEN 25
                  ELSE 10
                END +
                COALESCE(p.purchaseCount, 0) * 0.1 +
                COALESCE(p.viewCount, 0) * 0.01
              ) AS relevance_score
         FROM products p
         LEFT JOIN categories c ON c.id = p.categoryId
         LEFT JOIN brands b ON b.id = p.brandId
         LEFT JOIN product_variants pv ON pv.productId = p.id
        WHERE p.status = 'ACTIVE'
          AND (
            LOWER(p.name) LIKE ? OR 
            LOWER(p.description) LIKE ? OR 
            LOWER(p.shortDescription) LIKE ? OR
            LOWER(pv.sku) LIKE ? OR
            LOWER(c.name) LIKE ? OR
            LOWER(b.name) LIKE ?
          )
        GROUP BY p.id
        ORDER BY relevance_score DESC
        LIMIT ?`,
      [
        exactTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        parseInt(limit, 10)
      ]
    );

    if (!products.length) {
      return [];
    }

    const productIds = products.map((p) => p.id);
    
    const images = await query(
      `SELECT id, productId, url, altText, displayOrder, isPrimary
         FROM product_images
        WHERE productId IN (${productIds.map(() => '?').join(',')})
          AND isPrimary = 1`,
      productIds
    );

    const variants = await query(
      `SELECT id, productId, sku, price, compareAtPrice, stockQuantity, attributes, isDefault
         FROM product_variants
        WHERE productId IN (${productIds.map(() => '?').join(',')})
          AND isActive = 1
        LIMIT 1`,
      productIds
    );

    const imagesByProduct = images.reduce((acc, img) => {
      acc[img.productId] = img;
      return acc;
    }, {});

    const variantsByProduct = variants.reduce((acc, variant) => {
      acc[variant.productId] = variant;
      return acc;
    }, {});

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      basePrice: p.basePrice,
      image: imagesByProduct[p.id] || null,
      variant: variantsByProduct[p.id] || null,
      category: p.category_id ? { id: p.category_id, name: p.category_name } : null,
      brand: p.brand_id ? { id: p.brand_id, name: p.brand_name } : null,
      relevanceScore: p.relevance_score
    }));
  }
}

export default new ProductService();
