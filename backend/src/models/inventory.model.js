// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVENTORY DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ValidationError } from '../utils/errors.js';

class Inventory {
  constructor({ stockQuantity, lowStockThreshold }) {
    this.stockQuantity = Number(stockQuantity);
    this.lowStockThreshold = Number(lowStockThreshold);
  }

  static fromData(data) {
    return new Inventory({
      stockQuantity: data.stockQuantity,
      lowStockThreshold: data.lowStockThreshold,
    });
  }

  canDeduct(quantity) {
    return Number.isFinite(quantity) && quantity > 0 && this.stockQuantity >= quantity;
  }

  assertCanDeduct(quantity) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    if (this.stockQuantity < quantity) {
      throw new ValidationError('Insufficient stock');
    }
  }

  deduct(quantity) {
    this.assertCanDeduct(quantity);
    return new Inventory({
      stockQuantity: this.stockQuantity - quantity,
      lowStockThreshold: this.lowStockThreshold,
    });
  }

  add(quantity) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be positive');
    }
    return new Inventory({
      stockQuantity: this.stockQuantity + quantity,
      lowStockThreshold: this.lowStockThreshold,
    });
  }
}

export default Inventory;
