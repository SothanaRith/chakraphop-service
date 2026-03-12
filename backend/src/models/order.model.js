// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ORDER DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ValidationError } from '../utils/errors.js';

const allowedTransitions = {
  PENDING: ['PAYMENT_FAILED', 'PAID', 'CANCELLED', 'PROCESSING'],
  PAYMENT_FAILED: ['CANCELLED', 'PENDING'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

class Order {
  constructor({ id, status, subtotal, tax, shippingCost, discount, total }) {
    this.id = id;
    this.status = status;
    this.subtotal = Number(subtotal);
    this.tax = Number(tax);
    this.shippingCost = Number(shippingCost);
    this.discount = Number(discount);
    this.total = Number(total);
  }

  static fromData(data) {
    return new Order({
      id: data.id,
      status: data.status,
      subtotal: data.subtotal,
      tax: data.tax,
      shippingCost: data.shippingCost,
      discount: data.discount,
      total: data.total,
    });
  }

  static calculateTotals({ subtotal, taxRate, shippingCost, discount }) {
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax + shippingCost - discount;
    return { tax, total };
  }

  canTransitionTo(nextStatus) {
    const allowed = allowedTransitions[this.status] || [];
    return allowed.includes(nextStatus);
  }

  assertCanTransitionTo(nextStatus) {
    if (!this.canTransitionTo(nextStatus)) {
      throw new ValidationError(`Cannot transition from ${this.status} to ${nextStatus}`);
    }
  }

  canConfirm() {
    return this.status === 'PENDING';
  }

  assertCanConfirm() {
    if (!this.canConfirm()) {
      throw new ValidationError(`Cannot confirm order with status: ${this.status}`);
    }
  }

  canCancel() {
    return ['PENDING', 'PAYMENT_FAILED', 'PAID', 'PROCESSING'].includes(this.status);
  }

  assertCanCancel() {
    if (!this.canCancel()) {
      throw new ValidationError(`Cannot cancel order with status: ${this.status}`);
    }
  }

  canProcessPayment() {
    return this.status === 'PENDING';
  }

  assertCanProcessPayment() {
    if (!this.canProcessPayment()) {
      throw new ValidationError(`Cannot process payment for order with status: ${this.status}`);
    }
  }

  canRefund() {
    return ['PAID', 'PROCESSING', 'SHIPPED'].includes(this.status);
  }

  assertCanRefund() {
    if (!this.canRefund()) {
      throw new ValidationError(`Cannot refund order with status: ${this.status}`);
    }
  }
}

export default Order;
