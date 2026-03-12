// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISCOUNT CODE & PROMOTIONS SERVICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

/**
 * Create discount code
 */
async function createDiscountCode({
  code,
  description,
  type, // PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING
  value,
  maxUses = null,
  maxUsesPerUser = 1,
  minOrderValue = null,
  validFrom = new Date(),
  validUntil = null,
  categoryIds = null,
  productIds = null,
  userIds = null,
  createdById
}) {
  // Validate code format
  const codeUpper = code.toUpperCase().trim();
  
  if (!/^[A-Z0-9]{4,20}$/.test(codeUpper)) {
    throw new AppError('Invalid code format. Use 4-20 alphanumeric characters.', 400);
  }
  
  // Check if code already exists
  const existing = await prisma.discountCode.findUnique({
    where: { code: codeUpper }
  });
  
  if (existing) {
    throw new AppError('Discount code already exists', 409);
  }
  
  // Validate value based on type
  if (type === 'PERCENTAGE' && (value <= 0 || value > 100)) {
    throw new AppError('Percentage discount must be between 0 and 100', 400);
  }
  
  if (type === 'FIXED_AMOUNT' && value <= 0) {
    throw new AppError('Fixed amount must be greater than 0', 400);
  }
  
  const discount = await prisma.discountCode.create({
    data: {
      code: codeUpper,
      description,
      type,
      value,
      maxUses,
      maxUsesPerUser,
      minOrderValue,
      validFrom,
      validUntil,
      categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
      productIds: productIds ? JSON.stringify(productIds) : null,
      userIds: userIds ? JSON.stringify(userIds) : null,
      createdById
    }
  });
  
  return discount;
}

/**
 * Validate and apply discount code
 */
async function validateDiscountCode({ code, userId, orderTotal, cartItems }) {
  const codeUpper = code.toUpperCase().trim();
  
  const discount = await prisma.discountCode.findUnique({
    where: { code: codeUpper }
  });
  
  if (!discount) {
    throw new AppError('Invalid discount code', 404);
  }
  
  // Check if active
  if (!discount.isActive) {
    throw new AppError('This discount code is no longer active', 400);
  }
  
  // Check date validity
  const now = new Date();
  if (discount.validFrom > now) {
    throw new AppError('This discount code is not yet valid', 400);
  }
  
  if (discount.validUntil && discount.validUntil < now) {
    throw new AppError('This discount code has expired', 400);
  }
  
  // Check usage limits
  if (discount.maxUses && discount.usedCount >= discount.maxUses) {
    throw new AppError('This discount code has reached its usage limit', 400);
  }
  
  // Check per-user usage
  const userUsage = await prisma.discountUsageLog.count({
    where: {
      discountCodeId: discount.id,
      userId
    }
  });
  
  if (userUsage >= discount.maxUsesPerUser) {
    throw new AppError('You have already used this discount code the maximum number of times', 400);
  }
  
  // Check minimum order value
  if (discount.minOrderValue && orderTotal < discount.minOrderValue) {
    throw new AppError(
      `Minimum order value of $${discount.minOrderValue} required to use this code`,
      400
    );
  }
  
  // Check category restrictions
  if (discount.categoryIds) {
    const allowedCategories = JSON.parse(discount.categoryIds);
    const hasMatchingCategory = cartItems.some(item => 
      allowedCategories.includes(item.product.categoryId)
    );
    
    if (!hasMatchingCategory) {
      throw new AppError('This discount code is not applicable to items in your cart', 400);
    }
  }
  
  // Check product restrictions
  if (discount.productIds) {
    const allowedProducts = JSON.parse(discount.productIds);
    const hasMatchingProduct = cartItems.some(item => 
      allowedProducts.includes(item.productId)
    );
    
    if (!hasMatchingProduct) {
      throw new AppError('This discount code is not applicable to items in your cart', 400);
    }
  }
  
  // Check user restrictions (exclusive codes)
  if (discount.userIds) {
    const allowedUsers = JSON.parse(discount.userIds);
    if (!allowedUsers.includes(userId)) {
      throw new AppError('This discount code is not available for your account', 403);
    }
  }
  
  // Calculate discount amount
  let discountAmount = 0;
  
  if (discount.type === 'PERCENTAGE') {
    discountAmount = (orderTotal * discount.value) / 100;
  } else if (discount.type === 'FIXED_AMOUNT') {
    discountAmount = Math.min(discount.value, orderTotal); // Don't exceed order total
  } else if (discount.type === 'FREE_SHIPPING') {
    // Shipping discount handled separately in checkout
    discountAmount = 0;
  }
  
  return {
    valid: true,
    discount,
    discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimals
    message: `Discount code "${codeUpper}" applied successfully`
  };
}

/**
 * Log discount usage
 */
async function logDiscountUsage({ discountCodeId, userId, orderId, discountAmount, orderTotal }) {
  // Increment usage count
  await prisma.discountCode.update({
    where: { id: discountCodeId },
    data: {
      usedCount: {
        increment: 1
      }
    }
  });
  
  // Create usage log
  await prisma.discountUsageLog.create({
    data: {
      discountCodeId,
      userId,
      orderId,
      discountAmount,
      orderTotal
    }
  });
}

/**
 * Get all discount codes (admin)
 */
async function getAllDiscounts({ page = 1, limit = 20, isActive = null }) {
  const skip = (page - 1) * limit;
  
  const where = {};
  if (isActive !== null) {
    where.isActive = isActive;
  }
  
  const [discounts, total] = await Promise.all([
    prisma.discountCode.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.discountCode.count({ where })
  ]);
  
  return {
    discounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update discount code
 */
async function updateDiscountCode(id, updates) {
  const discount = await prisma.discountCode.update({
    where: { id },
    data: updates
  });
  
  return discount;
}

/**
 * Deactivate discount code
 */
async function deactivateDiscountCode(id) {
  await prisma.discountCode.update({
    where: { id },
    data: { isActive: false }
  });
  
  return { success: true };
}

/**
 * Get discount statistics
 */
async function getDiscountStats(discountCodeId) {
  const [discount, usageLogs] = await Promise.all([
    prisma.discountCode.findUnique({
      where: { id: discountCodeId }
    }),
    prisma.discountUsageLog.findMany({
      where: { discountCodeId },
      select: {
        discountAmount: true,
        orderTotal: true,
        usedAt: true
      }
    })
  ]);
  
  const totalRevenue = usageLogs.reduce((sum, log) => sum + Number(log.orderTotal), 0);
  const totalDiscount = usageLogs.reduce((sum, log) => sum + Number(log.discountAmount), 0);
  
  return {
    code: discount.code,
    usedCount: discount.usedCount,
    maxUses: discount.maxUses,
    totalRevenue,
    totalDiscount,
    averageOrderValue: usageLogs.length ? totalRevenue / usageLogs.length : 0,
    usageHistory: usageLogs
  };
}

module.exports = {
  createDiscountCode,
  validateDiscountCode,
  logDiscountUsage,
  getAllDiscounts,
  updateDiscountCode,
  deactivateDiscountCode,
  getDiscountStats
};
