// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN PRODUCTS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Product catalog management for admin
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import crypto from 'node:crypto';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../config/logger.js';
import {
  countProducts,
  deleteProductImage as deleteProductImageRepo,
  findProductBySlug,
  findVariantBySku,
  getProductById as getProductByIdRepo,
  getProductImageById,
  getVariantById,
  insertProduct,
  insertProductImage,
  insertVariant,
  listProductImages,
  listProductVariants,
  listProducts,
  updateProduct,
  updateProductStatusBulk,
  updateVariant,
  updateVariantPrice,
} from '../repositories/admin.products.repository.js';
import { insertAdminActionLog } from '../repositories/admin.actions.repository.js';

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

class AdminProductsService {
  /**
   * Get all products with filtering
   */
  async getAllProducts({ status, category, sportId, page = 1, limit = 20, search, sortBy }) {
    const [products, total] = await Promise.all([
      listProducts({
        status,
        categoryId: category,
        search,
        limit,
        offset: (page - 1) * limit,
        sortBy
      }),
      countProducts({ status, categoryId: category, search })
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total: total?.total || 0,
        totalPages: Math.ceil((total?.total || 0) / limit)
      }
    };
  }

  /**
   * Get product by ID
   */
  async getProductById(productId) {
    const product = await getProductByIdRepo(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const [variants, images] = await Promise.all([
      listProductVariants(productId),
      listProductImages(productId)
    ]);

    return {
      ...product,
      variants,
      images
    };
  }

  /**
   * Create new product
   */
  async createProduct({ name, description, sku, categoryId, status, images, basePrice = 0, shortDescription = null, brandId = null }, adminUserId) {
    const slug = slugify(name);
    const existing = await findProductBySlug(slug);

    if (existing) {
      throw new ValidationError('Product slug already exists');
    }

    if (sku) {
      const existingSku = await findVariantBySku(sku);
      if (existingSku) {
        throw new ValidationError('SKU already exists');
      }
    }

    const product = await insertProduct({
      id: crypto.randomUUID(),
      name,
      slug,
      description,
      shortDescription,
      categoryId,
      brandId,
      status: status || 'DRAFT',
      basePrice,
      createdById: adminUserId,
    });

    if (sku) {
      await insertVariant({
        id: crypto.randomUUID(),
        productId: product.id,
        sku,
        attributes: JSON.stringify({}),
        price: basePrice,
        costPrice: null,
        isDefault: true,
      });
    }

    if (images?.length) {
      await Promise.all(
        images.map((image, index) =>
          insertProductImage({
            id: crypto.randomUUID(),
            productId: product.id,
            url: image.url,
            altText: image.alt || image.altText || product.name,
            isPrimary: image.isPrimary || index === 0,
            displayOrder: image.displayOrder ?? index,
          })
        )
      );
    }

    await this._logAdminAction(adminUserId, 'CREATE_PRODUCT', {
      productId: product.id,
      name
    });

    logger.info('Product created', {
      productId: product.id,
      sku,
      createdBy: adminUserId
    });

    return this.getProductById(product.id);
  }

  /**
   * Update product
   */
  async updateProduct(productId, { name, description, categoryId, sportId, status, images }, adminUserId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const updated = await updateProduct(productId, {
      ...(name && { name }),
      ...(description && { description }),
      ...(categoryId && { categoryId }),
      ...(status && { status })
    });

    await this._logAdminAction(adminUserId, 'UPDATE_PRODUCT', {
      productId,
      changes: { name, description, status }
    });

    return {
      ...updated,
      variants: await listProductVariants(productId),
      images: await listProductImages(productId)
    };
  }

  /**
   * Publish product
   */
  async publishProduct(productId, adminUserId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const updated = await updateProduct(productId, { status: 'ACTIVE', publishedAt: new Date() });

    await this._logAdminAction(adminUserId, 'PUBLISH_PRODUCT', { productId });

    logger.info('Product published', { productId, publishedBy: adminUserId });

    return updated;
  }

  /**
   * Archive product (soft delete)
   */
  async archiveProduct(productId, adminUserId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const updated = await updateProduct(productId, { status: 'ARCHIVED' });

    await this._logAdminAction(adminUserId, 'ARCHIVE_PRODUCT', { productId });

    logger.info('Product archived', { productId, archivedBy: adminUserId });

    return updated;
  }

  /**
   * Create product variant
   */
  async createVariant(productId, { sku, size, color, price, cost, images }, adminUserId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const existingSku = await findVariantBySku(sku);
    if (existingSku) {
      throw new ValidationError('SKU already exists');
    }

    const variant = await insertVariant({
      id: crypto.randomUUID(),
      productId,
      sku,
      attributes: JSON.stringify({ size, color }),
      price,
      costPrice: cost || null,
      isDefault: false,
    });

    await this._logAdminAction(adminUserId, 'CREATE_VARIANT', {
      productId,
      variantId: variant.id,
      sku
    });

    return variant;
  }

  /**
   * Update variant
   */
  async updateVariant(variantId, { sku, size, color, price, cost, images }, adminUserId) {
    const variant = await getVariantById(variantId);

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    if (sku && sku !== variant.sku) {
      const existingSku = await findVariantBySku(sku);
      if (existingSku) {
        throw new ValidationError('SKU already exists');
      }
    }

    let nextAttributes = null;
    if (size !== undefined || color !== undefined) {
      let current = {};
      try {
        current = variant.attributes ? JSON.parse(variant.attributes) : {};
      } catch (error) {
        current = {};
      }
      nextAttributes = JSON.stringify({
        ...current,
        ...(size !== undefined ? { size } : {}),
        ...(color !== undefined ? { color } : {})
      });
    }

    const updated = await updateVariant(variantId, {
      ...(sku && { sku }),
      ...(nextAttributes ? { attributes: nextAttributes } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(cost !== undefined ? { costPrice: cost } : {})
    });

    await this._logAdminAction(adminUserId, 'UPDATE_VARIANT', {
      variantId,
      changes: { sku, size, color, price, cost }
    });

    return updated;
  }

  /**
   * Get product variants
   */
  async getProductVariants(productId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return listProductVariants(productId);
  }

  /**
   * Bulk update prices
   */
  async bulkUpdatePrices(updates, adminUserId) {
    const results = [];

    for (const { variantId, price } of updates) {
      const variant = await getVariantById(variantId);

      if (!variant) {
        results.push({
          variantId,
          status: 'ERROR',
          message: 'Variant not found'
        });
        continue;
      }

      await updateVariantPrice(variantId, price);

      results.push({
        variantId,
        status: 'SUCCESS',
        oldPrice: variant.price,
        newPrice: price
      });
    }

    await this._logAdminAction(adminUserId, 'BULK_UPDATE_PRICES', {
      count: updates.length
    });

    logger.info('Bulk price update completed', {
      count: updates.length,
      successful: results.filter(r => r.status === 'SUCCESS').length
    });

    return results;
  }

  /**
   * Bulk update product status
   */
  async bulkUpdateStatus(productIds, status, adminUserId) {
    const updated = await updateProductStatusBulk(productIds, status);

    await this._logAdminAction(adminUserId, 'BULK_UPDATE_STATUS', {
      productCount: productIds.length,
      newStatus: status
    });

    logger.info('Bulk status update completed', {
      count: productIds.length,
      newStatus: status
    });

    return {
      updated: updated.updated,
      status,
      productIds
    };
  }

  /**
   * Get product images
   */
  async getProductImages(productId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return listProductImages(productId);
  }

  /**
   * Upload product image
   */
  async uploadProductImage(productId, file, { alt, isPrimary }, adminUserId) {
    const product = await this.getProductById(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!file) {
      throw new ValidationError('No image file provided');
    }

    // TODO: Upload to cloud storage (S3, etc.)
    const imageUrl = `/uploads/products/${productId}/${file.filename}`;

    const image = await insertProductImage({
      id: crypto.randomUUID(),
      productId,
      url: imageUrl,
      altText: alt || product.name,
      isPrimary: isPrimary || false,
      displayOrder: 0,
    });

    return image;
  }

  /**
   * Delete product image
   */
  async deleteProductImage(imageId, adminUserId) {
    const target = await getProductImageById(imageId);

    if (!target) {
      throw new NotFoundError('Image not found');
    }

    await deleteProductImageRepo(imageId);

    // TODO: Delete from cloud storage

    return { deleted: true };
  }

  /**
   * Log admin action
   */
  async _logAdminAction(adminId, action, metadata) {
    try {
      await insertAdminActionLog(adminId, `PRODUCT_${action}`, JSON.stringify(metadata));
    } catch (error) {
      logger.error('Failed to log admin action', { error });
    }
  }
}

export default new AdminProductsService();
