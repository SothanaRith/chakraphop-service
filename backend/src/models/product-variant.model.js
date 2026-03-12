// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRODUCT VARIANT DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ValidationError } from '../utils/errors.js';

class ProductVariant {
  constructor({ id, sku, isActive, stockQuantity, productStatus }) {
    this.id = id;
    this.sku = sku;
    this.isActive = Boolean(isActive);
    this.stockQuantity = Number(stockQuantity);
    this.productStatus = productStatus;
  }

  static fromData(data) {
    return new ProductVariant({
      id: data.id,
      sku: data.sku,
      isActive: data.isActive,
      stockQuantity: data.stockQuantity,
      productStatus: data.productStatus,
    });
  }

  canSell(quantity) {
    return (
      this.productStatus === 'ACTIVE' &&
      this.isActive &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      this.stockQuantity >= quantity
    );
  }

  assertCanSell(quantity) {
    if (this.productStatus !== 'ACTIVE') {
      throw new ValidationError('Product is not available');
    }
    if (!this.isActive) {
      throw new ValidationError('Product variant is not available');
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0');
    }
    if (this.stockQuantity < quantity) {
      throw new ValidationError(`Only ${this.stockQuantity} items available in stock`);
    }
  }
}

export default ProductVariant;
