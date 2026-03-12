// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DELIVERY DOMAIN MODEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { ValidationError } from '../utils/errors.js';

const allowedTransitions = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'FAILED', 'RETURNED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['SHIPPED', 'RETURNED', 'CANCELLED'],
  RETURNED: [],
  CANCELLED: [],
};

class Delivery {
  constructor({ currentStatus }) {
    this.currentStatus = currentStatus;
  }

  static fromData(data) {
    return new Delivery({
      currentStatus: data.currentStatus,
    });
  }

  canUpdateStatus(nextStatus) {
    const allowed = allowedTransitions[this.currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  assertCanUpdateStatus(nextStatus) {
    if (!this.canUpdateStatus(nextStatus)) {
      const allowed = allowedTransitions[this.currentStatus] || [];
      throw new ValidationError(
        `Cannot transition from ${this.currentStatus} to ${nextStatus}. ` +
        `Allowed transitions: ${allowed.join(', ') || 'none (final state)'}`
      );
    }
  }
}

export default Delivery;
