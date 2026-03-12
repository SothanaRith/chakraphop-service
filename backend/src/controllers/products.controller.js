// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCTS CONTROLLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import productService from '../services/product.service.js';
import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

class ProductsController {
  /**
   * Get all products with filters
   * GET /api/products
   */
  getProducts = asyncHandler(async (req, res) => {
    const result = await productService.getProducts(req.query);
    res.json(success(result));
  });

  /**
   * Get product by slug
   * GET /api/products/:slug
   */
  getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const product = await productService.getProductBySlug(slug);
    res.json(success(product));
  });

  /**
   * Search products
   * GET /api/products/search
   */
  searchProducts = asyncHandler(async (req, res) => {
    const { q, limit } = req.query;
    const products = await productService.searchProducts(q, limit);
    res.json(success(products));
  });

  /**
   * Get categories
   * GET /api/products/categories
   */
  getCategories = asyncHandler(async (req, res) => {
    const categories = await productService.getCategories();
    res.json(success(categories));
  });

  /**
   * Get brands
   * GET /api/products/brands
   */
  getBrands = asyncHandler(async (req, res) => {
    const brands = await productService.getBrands();
    res.json(success(brands));
  });

  /**
   * Create product (admin)
   * POST /api/products
   */
  createProduct = asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body, req.user.id);
    res.status(201).json(success(product, 'Product created successfully'));
  });

  /**
   * Update product (admin)
   * PATCH /api/products/:id
   */
  updateProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body);
    res.json(success(product, 'Product updated successfully'));
  });

  /**
   * Delete product (admin)
   * DELETE /api/products/:id
   */
  deleteProduct = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await productService.deleteProduct(id);
    res.json(success(null, 'Product deleted successfully'));
  });
}

export default new ProductsController();
