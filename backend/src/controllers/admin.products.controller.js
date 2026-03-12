// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN: PRODUCT MANAGEMENT CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Product, variant, and catalog management endpoints
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import adminProductsService from '../services/admin.products.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class AdminProductsController {
  /**
   * Get all products with pagination and filtering
   * GET /api/admin/products
   * Query: status, category, sportId, page, limit, search, sortBy
   */
  getAllProducts = asyncHandler(async (req, res) => {
    const { status, category, sportId, page = 1, limit = 20, search, sortBy } = req.query;

    const result = await adminProductsService.getAllProducts({
      status,
      category,
      sportId,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sortBy
    });

    res.json(success(result, 'Products retrieved successfully'));
  });

  /**
   * Get product details
   * GET /api/admin/products/:productId
   */
  getProductById = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const product = await adminProductsService.getProductById(productId);

    res.json(success(product, 'Product retrieved successfully'));
  });

  /**
   * Create new product
   * POST /api/admin/products
   * Body: name, description, sku, categoryId, sportId, status, images
   */
  createProduct = asyncHandler(async (req, res) => {
    const { name, description, sku, categoryId, sportId, status, images } = req.body;

    const product = await adminProductsService.createProduct(
      {
        name,
        description,
        sku,
        categoryId,
        sportId,
        status,
        images
      },
      req.user.id
    );

    res.status(201).json(success(product, 'Product created successfully'));
  });

  /**
   * Update product
   * PATCH /api/admin/products/:productId
   * Body: name, description, categoryId, sportId, status, images
   */
  updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { name, description, categoryId, sportId, status, images } = req.body;

    const product = await adminProductsService.updateProduct(
      productId,
      { name, description, categoryId, sportId, status, images },
      req.user.id
    );

    res.json(success(product, 'Product updated successfully'));
  });

  /**
   * Publish product (make visible)
   * POST /api/admin/products/:productId/publish
   */
  publishProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const product = await adminProductsService.publishProduct(productId, req.user.id);

    res.json(success(product, 'Product published successfully'));
  });

  /**
   * Archive product (soft delete)
   * POST /api/admin/products/:productId/archive
   */
  archiveProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const product = await adminProductsService.archiveProduct(productId, req.user.id);

    res.json(success(product, 'Product archived successfully'));
  });

  /**
   * Create product variant
   * POST /api/admin/products/:productId/variants
   * Body: sku, size, color, price, cost, images
   */
  createVariant = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { sku, size, color, price, cost, images } = req.body;

    const variant = await adminProductsService.createVariant(
      productId,
      { sku, size, color, price, cost, images },
      req.user.id
    );

    res.status(201).json(success(variant, 'Product variant created successfully'));
  });

  /**
   * Update product variant
   * PATCH /api/admin/products/:productId/variants/:variantId
   * Body: sku, size, color, price, cost, images
   */
  updateVariant = asyncHandler(async (req, res) => {
    const { productId, variantId } = req.params;
    const { sku, size, color, price, cost, images } = req.body;

    const variant = await adminProductsService.updateVariant(
      variantId,
      { sku, size, color, price, cost, images },
      req.user.id
    );

    res.json(success(variant, 'Product variant updated successfully'));
  });

  /**
   * Get all variants for product
   * GET /api/admin/products/:productId/variants
   */
  getProductVariants = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const variants = await adminProductsService.getProductVariants(productId);

    res.json(success(variants, 'Product variants retrieved successfully'));
  });

  /**
   * Bulk update product prices
   * POST /api/admin/products/bulk-update/prices
   * Body: updates (array of {variantId, price})
   */
  bulkUpdatePrices = asyncHandler(async (req, res) => {
    const { updates } = req.body;

    const result = await adminProductsService.bulkUpdatePrices(updates, req.user.id);

    res.json(success(result, 'Product prices updated successfully'));
  });

  /**
   * Bulk update product status
   * POST /api/admin/products/bulk-update/status
   * Body: productIds, status
   */
  bulkUpdateStatus = asyncHandler(async (req, res) => {
    const { productIds, status } = req.body;

    const result = await adminProductsService.bulkUpdateStatus(
      productIds,
      status,
      req.user.id
    );

    res.json(success(result, 'Product status updated successfully'));
  });

  /**
   * Get product image management
   * GET /api/admin/products/:productId/images
   */
  getProductImages = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const images = await adminProductsService.getProductImages(productId);

    res.json(success(images, 'Product images retrieved successfully'));
  });

  /**
   * Upload product image
   * POST /api/admin/products/:productId/images
   * Body: imageFile, alt, isPrimary
   */
  uploadProductImage = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { alt, isPrimary } = req.body;

    const image = await adminProductsService.uploadProductImage(
      productId,
      req.file,
      { alt, isPrimary },
      req.user.id
    );

    res.status(201).json(success(image, 'Product image uploaded successfully'));
  });

  /**
   * Delete product image
   * DELETE /api/admin/products/:productId/images/:imageId
   */
  deleteProductImage = asyncHandler(async (req, res) => {
    const { productId, imageId } = req.params;

    await adminProductsService.deleteProductImage(imageId, req.user.id);

    res.json(success(null, 'Product image deleted successfully'));
  });
}

export default new AdminProductsController();
