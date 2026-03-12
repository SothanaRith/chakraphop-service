CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(191) NOT NULL,
  passwordHash VARCHAR(191) NULL,
  role ENUM('SUPER_ADMIN','ADMIN','INVENTORY_MANAGER','SALES_AGENT','CUSTOMER','INSTRUCTOR','STUDENT') NOT NULL DEFAULT 'CUSTOMER',
  firstName VARCHAR(191) NULL,
  lastName VARCHAR(191) NULL,
  phone VARCHAR(191) NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  isEmailVerified TINYINT(1) NOT NULL DEFAULT 0,
  emailVerifiedAt DATETIME NULL,
  authProvider ENUM('EMAIL','GOOGLE','FACEBOOK','APPLE') NOT NULL DEFAULT 'EMAIL',
  googleId VARCHAR(191) NULL,
  facebookId VARCHAR(191) NULL,
  failedLoginAttempts INT NOT NULL DEFAULT 0,
  accountLockedUntil DATETIME NULL,
  lastPasswordChange DATETIME NULL,
  twoFactorEnabled TINYINT(1) NOT NULL DEFAULT 0,
  lastLoginAt DATETIME NULL,
  lastLoginIp VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_googleId_unique (googleId),
  UNIQUE KEY users_facebookId_unique (facebookId),
  INDEX users_email_index (email),
  INDEX users_role_index (role),
  INDEX users_googleId_index (googleId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addresses (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  fullName VARCHAR(191) NOT NULL,
  phone VARCHAR(191) NOT NULL,
  addressLine1 VARCHAR(191) NOT NULL,
  addressLine2 VARCHAR(191) NULL,
  city VARCHAR(191) NOT NULL,
  state VARCHAR(191) NOT NULL,
  postalCode VARCHAR(191) NOT NULL,
  country VARCHAR(191) NOT NULL DEFAULT 'USA',
  isDefault TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX addresses_userId_index (userId),
  CONSTRAINT addresses_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  parentId VARCHAR(36) NULL,
  imageUrl VARCHAR(191) NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY categories_slug_unique (slug),
  INDEX categories_slug_index (slug),
  INDEX categories_parentId_index (parentId),
  CONSTRAINT categories_parentId_fkey FOREIGN KEY (parentId) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  logoUrl VARCHAR(191) NULL,
  websiteUrl VARCHAR(191) NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY brands_name_unique (name),
  UNIQUE KEY brands_slug_unique (slug),
  INDEX brands_slug_index (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  shortDescription TEXT NULL,
  categoryId VARCHAR(36) NOT NULL,
  brandId VARCHAR(36) NULL,
  metaTitle VARCHAR(191) NULL,
  metaDescription TEXT NULL,
  metaKeywords TEXT NULL,
  status ENUM('DRAFT','ACTIVE','OUT_OF_STOCK','DISCONTINUED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  basePrice DECIMAL(10,2) NOT NULL,
  compareAtPrice DECIMAL(10,2) NULL,
  costPrice DECIMAL(10,2) NULL,
  weight DECIMAL(10,2) NULL,
  dimensions TEXT NULL,
  isFeatured TINYINT(1) NOT NULL DEFAULT 0,
  isNew TINYINT(1) NOT NULL DEFAULT 0,
  allowBackorder TINYINT(1) NOT NULL DEFAULT 0,
  allowPreorder TINYINT(1) NOT NULL DEFAULT 0,
  preorderAvailableDate DATETIME NULL,
  viewCount INT NOT NULL DEFAULT 0,
  purchaseCount INT NOT NULL DEFAULT 0,
  averageRating DECIMAL(3,2) NULL,
  reviewCount INT NOT NULL DEFAULT 0,
  createdById VARCHAR(36) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  publishedAt DATETIME NULL,
  UNIQUE KEY products_slug_unique (slug),
  INDEX products_slug_index (slug),
  INDEX products_categoryId_index (categoryId),
  INDEX products_brandId_index (brandId),
  INDEX products_status_index (status),
  INDEX products_createdAt_index (createdAt),
  INDEX products_isFeatured_index (isFeatured),
  CONSTRAINT products_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES categories(id),
  CONSTRAINT products_brandId_fkey FOREIGN KEY (brandId) REFERENCES brands(id),
  CONSTRAINT products_createdById_fkey FOREIGN KEY (createdById) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  productId VARCHAR(36) NOT NULL,
  url VARCHAR(191) NOT NULL,
  altText VARCHAR(191) NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  isPrimary TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX product_images_productId_index (productId),
  CONSTRAINT product_images_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  productId VARCHAR(36) NOT NULL,
  sku VARCHAR(191) NOT NULL,
  barcode VARCHAR(191) NULL,
  attributes TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  compareAtPrice DECIMAL(10,2) NULL,
  costPrice DECIMAL(10,2) NULL,
  weight DECIMAL(10,2) NULL,
  stockQuantity INT NOT NULL DEFAULT 0,
  lowStockThreshold INT NOT NULL DEFAULT 10,
  version INT NOT NULL DEFAULT 0,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  isDefault TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY product_variants_sku_unique (sku),
  UNIQUE KEY product_variants_barcode_unique (barcode),
  INDEX product_variants_productId_index (productId),
  INDEX product_variants_sku_index (sku),
  INDEX product_variants_stockQuantity_index (stockQuantity),
  CONSTRAINT product_variants_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  contactName VARCHAR(191) NULL,
  email VARCHAR(191) NULL,
  phone VARCHAR(191) NULL,
  address TEXT NULL,
  city VARCHAR(191) NULL,
  country VARCHAR(191) NULL,
  paymentTerms VARCHAR(191) NULL,
  notes TEXT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  poNumber VARCHAR(191) NOT NULL,
  supplierId VARCHAR(36) NOT NULL,
  orderDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expectedDeliveryDate DATETIME NULL,
  actualDeliveryDate DATETIME NULL,
  status VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  shippingCost DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  notes TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY purchase_orders_poNumber_unique (poNumber),
  INDEX purchase_orders_poNumber_index (poNumber),
  INDEX purchase_orders_supplierId_index (supplierId),
  CONSTRAINT purchase_orders_supplierId_fkey FOREIGN KEY (supplierId) REFERENCES suppliers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  purchaseOrderId VARCHAR(36) NOT NULL,
  variantId VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unitCost DECIMAL(10,2) NOT NULL,
  totalCost DECIMAL(10,2) NOT NULL,
  receivedQuantity INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX purchase_order_items_purchaseOrderId_index (purchaseOrderId),
  CONSTRAINT purchase_order_items_purchaseOrderId_fkey FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discount_codes (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  code VARCHAR(191) NOT NULL,
  description TEXT NULL,
  type ENUM('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING','BUY_X_GET_Y') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  maxUses INT NULL,
  maxUsesPerUser INT NOT NULL DEFAULT 1,
  usedCount INT NOT NULL DEFAULT 0,
  minOrderValue DECIMAL(10,2) NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  validFrom DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validUntil DATETIME NULL,
  categoryIds TEXT NULL,
  productIds TEXT NULL,
  userIds TEXT NULL,
  createdById VARCHAR(36) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY discount_codes_code_unique (code),
  INDEX discount_codes_code_index (code),
  INDEX discount_codes_active_dates_index (isActive, validFrom, validUntil)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_methods (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  type ENUM('STANDARD','EXPRESS','PICKUP') NOT NULL,
  description TEXT NULL,
  basePrice DECIMAL(10,2) NOT NULL,
  estimatedDays INT NOT NULL,
  estimatedDaysMin INT NOT NULL,
  minOrderAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
  maxOrderWeight INT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY delivery_methods_name_unique (name),
  INDEX delivery_methods_isActive_index (isActive)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderNumber VARCHAR(191) NOT NULL,
  userId VARCHAR(36) NOT NULL,
  guestEmail VARCHAR(191) NULL,
  status ENUM('PENDING','PAYMENT_FAILED','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  shippingCost DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  discountCodeId VARCHAR(36) NULL,
  discountAmount DECIMAL(10,2) NOT NULL DEFAULT 0,
  shippingAddressId VARCHAR(36) NULL,
  shippingMethod VARCHAR(191) NULL,
  trackingNumber VARCHAR(191) NULL,
  estimatedDelivery DATETIME NULL,
  deliveryMethodId VARCHAR(36) NULL,
  deliveryStatus ENUM('PENDING','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  deliveryStatusUpdatedAt DATETIME NULL,
  customerNotes TEXT NULL,
  internalNotes TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  paidAt DATETIME NULL,
  shippedAt DATETIME NULL,
  deliveredAt DATETIME NULL,
  cancelledAt DATETIME NULL,
  refundedAt DATETIME NULL,
  version INT NOT NULL DEFAULT 0,
  UNIQUE KEY orders_orderNumber_unique (orderNumber),
  INDEX orders_orderNumber_index (orderNumber),
  INDEX orders_userId_index (userId),
  INDEX orders_status_index (status),
  INDEX orders_createdAt_index (createdAt),
  INDEX orders_guestEmail_index (guestEmail),
  CONSTRAINT orders_userId_fkey FOREIGN KEY (userId) REFERENCES users(id),
  CONSTRAINT orders_shippingAddressId_fkey FOREIGN KEY (shippingAddressId) REFERENCES addresses(id),
  CONSTRAINT orders_discountCodeId_fkey FOREIGN KEY (discountCodeId) REFERENCES discount_codes(id),
  CONSTRAINT orders_deliveryMethodId_fkey FOREIGN KEY (deliveryMethodId) REFERENCES delivery_methods(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  variantId VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  priceAtPurchase DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  productName VARCHAR(191) NOT NULL,
  variantSku VARCHAR(191) NOT NULL,
  variantAttributes TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX order_items_orderId_index (orderId),
  CONSTRAINT order_items_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_variantId_fkey FOREIGN KEY (variantId) REFERENCES product_variants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  fromStatus ENUM('PENDING','PAYMENT_FAILED','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') NULL,
  toStatus ENUM('PENDING','PAYMENT_FAILED','PAID','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') NOT NULL,
  notes TEXT NULL,
  changedById VARCHAR(36) NULL,
  changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX order_status_history_orderId_index (orderId),
  CONSTRAINT order_status_history_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_availability_rules (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  deliveryMethodId VARCHAR(36) NOT NULL,
  country VARCHAR(191) NOT NULL DEFAULT 'USA',
  state VARCHAR(191) NULL,
  city VARCHAR(191) NULL,
  isAvailable TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY delivery_availability_rules_unique (deliveryMethodId, country, state, city),
  INDEX delivery_availability_rules_deliveryMethodId_index (deliveryMethodId),
  CONSTRAINT delivery_availability_rules_deliveryMethodId_fkey FOREIGN KEY (deliveryMethodId) REFERENCES delivery_methods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_delivery_tracking (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  trackingNumber VARCHAR(191) NULL,
  carrier VARCHAR(191) NULL,
  carrierUrl VARCHAR(191) NULL,
  shippedAt DATETIME NULL,
  outForDeliveryAt DATETIME NULL,
  deliveredAt DATETIME NULL,
  failedAt DATETIME NULL,
  currentStatus ENUM('PENDING','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  lastStatusUpdate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returnedAt DATETIME NULL,
  returnReason TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY order_delivery_tracking_orderId_unique (orderId),
  UNIQUE KEY order_delivery_tracking_trackingNumber_unique (trackingNumber),
  INDEX order_delivery_tracking_orderId_index (orderId),
  INDEX order_delivery_tracking_trackingNumber_index (trackingNumber),
  INDEX order_delivery_tracking_currentStatus_index (currentStatus),
  CONSTRAINT order_delivery_tracking_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_delivery_status_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  trackingId VARCHAR(36) NOT NULL,
  fromStatus ENUM('PENDING','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED') NULL,
  toStatus ENUM('PENDING','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','FAILED','RETURNED','CANCELLED') NOT NULL,
  changedBy VARCHAR(36) NULL,
  reason TEXT NULL,
  notes TEXT NULL,
  changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX order_delivery_status_history_orderId_index (orderId),
  INDEX order_delivery_status_history_trackingId_index (trackingId),
  CONSTRAINT order_delivery_status_history_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_delivery_status_history_trackingId_fkey FOREIGN KEY (trackingId) REFERENCES order_delivery_tracking(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  orderId VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(191) NOT NULL DEFAULT 'USD',
  method ENUM('CREDIT_CARD','DEBIT_CARD','PAYPAL','STRIPE','BANK_TRANSFER','CASH_ON_DELIVERY') NOT NULL,
  status ENUM('PENDING','PROCESSING','COMPLETED','FAILED','REFUNDED','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
  transactionId VARCHAR(191) NULL,
  gatewayResponse TEXT NULL,
  lastFourDigits VARCHAR(191) NULL,
  cardBrand VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  processedAt DATETIME NULL,
  failedAt DATETIME NULL,
  failureReason TEXT NULL,
  UNIQUE KEY payments_transactionId_unique (transactionId),
  INDEX payments_orderId_index (orderId),
  INDEX payments_transactionId_index (transactionId),
  CONSTRAINT payments_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_movements (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  variantId VARCHAR(36) NOT NULL,
  type ENUM('INITIAL_STOCK','PURCHASE_ORDER','MANUAL_ADJUSTMENT','SALE','RETURN','TRANSFER','WRITE_OFF') NOT NULL,
  quantityChange INT NOT NULL,
  previousQuantity INT NOT NULL,
  newQuantity INT NOT NULL,
  orderId VARCHAR(36) NULL,
  purchaseOrderId VARCHAR(36) NULL,
  reason TEXT NULL,
  notes TEXT NULL,
  performedById VARCHAR(36) NULL,
  performedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX stock_movements_variantId_index (variantId),
  INDEX stock_movements_orderId_index (orderId),
  INDEX stock_movements_purchaseOrderId_index (purchaseOrderId),
  INDEX stock_movements_performedAt_index (performedAt),
  CONSTRAINT stock_movements_variantId_fkey FOREIGN KEY (variantId) REFERENCES product_variants(id),
  CONSTRAINT stock_movements_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id),
  CONSTRAINT stock_movements_purchaseOrderId_fkey FOREIGN KEY (purchaseOrderId) REFERENCES purchase_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  variantId VARCHAR(36) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  priceSnapshot DECIMAL(10,2) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY cart_items_user_variant_unique (userId, variantId),
  INDEX cart_items_userId_index (userId),
  CONSTRAINT cart_items_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_variantId_fkey FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NULL,
  action VARCHAR(191) NOT NULL,
  entity VARCHAR(191) NOT NULL,
  entityId VARCHAR(191) NOT NULL,
  changes TEXT NULL,
  metadata TEXT NULL,
  ipAddress VARCHAR(191) NULL,
  userAgent VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_logs_userId_index (userId),
  INDEX audit_logs_entity_index (entity, entityId),
  INDEX audit_logs_createdAt_index (createdAt),
  CONSTRAINT audit_logs_userId_fkey FOREIGN KEY (userId) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_verifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NULL,
  email VARCHAR(191) NOT NULL,
  phone VARCHAR(191) NULL,
  type ENUM('EMAIL_VERIFICATION','LOGIN_2FA','PASSWORD_RESET','ACCOUNT_RECOVERY') NOT NULL,
  otpHash VARCHAR(191) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  maxAttempts INT NOT NULL DEFAULT 3,
  expiresAt DATETIME NOT NULL,
  verifiedAt DATETIME NULL,
  ipAddress VARCHAR(191) NULL,
  userAgent VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX otp_verifications_email_type_index (email, type),
  INDEX otp_verifications_userId_index (userId),
  INDEX otp_verifications_expiresAt_index (expiresAt),
  CONSTRAINT otp_verifications_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  token VARCHAR(191) NOT NULL,
  expiresAt DATETIME NOT NULL,
  revokedAt DATETIME NULL,
  replacedBy VARCHAR(191) NULL,
  ipAddress VARCHAR(191) NULL,
  userAgent VARCHAR(191) NULL,
  deviceId VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY refresh_tokens_token_unique (token),
  INDEX refresh_tokens_userId_index (userId),
  INDEX refresh_tokens_token_index (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NULL,
  event VARCHAR(191) NOT NULL,
  severity VARCHAR(191) NOT NULL DEFAULT 'INFO',
  details TEXT NULL,
  ipAddress VARCHAR(191) NULL,
  userAgent VARCHAR(191) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX security_logs_userId_index (userId),
  INDEX security_logs_event_index (event),
  INDEX security_logs_createdAt_index (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  notes TEXT NULL,
  priority INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY wishlist_items_user_product_unique (userId, productId),
  INDEX wishlist_items_userId_index (userId),
  CONSTRAINT wishlist_items_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT wishlist_items_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recently_viewed (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  viewedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY recently_viewed_user_product_unique (userId, productId),
  INDEX recently_viewed_user_viewedAt_index (userId, viewedAt),
  CONSTRAINT recently_viewed_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT recently_viewed_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS discount_usage_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  discountCodeId VARCHAR(36) NOT NULL,
  userId VARCHAR(36) NULL,
  orderId VARCHAR(36) NULL,
  discountAmount DECIMAL(10,2) NOT NULL,
  orderTotal DECIMAL(10,2) NOT NULL,
  usedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX discount_usage_logs_discountCodeId_index (discountCodeId),
  INDEX discount_usage_logs_userId_index (userId),
  CONSTRAINT discount_usage_logs_discountCodeId_fkey FOREIGN KEY (discountCodeId) REFERENCES discount_codes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_reviews (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  productId VARCHAR(36) NOT NULL,
  userId VARCHAR(36) NOT NULL,
  orderId VARCHAR(36) NULL,
  rating INT NOT NULL,
  title VARCHAR(191) NULL,
  comment TEXT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','FLAGGED') NOT NULL DEFAULT 'PENDING',
  moderatedById VARCHAR(36) NULL,
  moderatedAt DATETIME NULL,
  moderationNotes TEXT NULL,
  helpfulCount INT NOT NULL DEFAULT 0,
  unhelpfulCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY product_reviews_user_product_unique (productId, userId),
  INDEX product_reviews_product_status_index (productId, status),
  INDEX product_reviews_userId_index (userId),
  CONSTRAINT product_reviews_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT product_reviews_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS related_products (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  productId VARCHAR(36) NOT NULL,
  relatedProductId VARCHAR(36) NOT NULL,
  relationType VARCHAR(191) NOT NULL DEFAULT 'RELATED',
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY related_products_pair_unique (productId, relatedProductId),
  INDEX related_products_productId_index (productId),
  CONSTRAINT related_products_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT related_products_relatedProductId_fkey FOREIGN KEY (relatedProductId) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_templates (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  type ENUM('ORDER_CONFIRMATION','ORDER_SHIPPED','ORDER_DELIVERED','ORDER_CANCELLED','PAYMENT_SUCCESS','PAYMENT_FAILED','STOCK_ALERT','PROMOTION','SYSTEM') NOT NULL,
  channel ENUM('EMAIL','SMS','PUSH','IN_APP') NOT NULL,
  subject VARCHAR(191) NULL,
  body TEXT NOT NULL,
  isActive TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY notification_templates_name_unique (name),
  INDEX notification_templates_type_channel_index (type, channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  type ENUM('ORDER_CONFIRMATION','ORDER_SHIPPED','ORDER_DELIVERED','ORDER_CANCELLED','PAYMENT_SUCCESS','PAYMENT_FAILED','STOCK_ALERT','PROMOTION','SYSTEM') NOT NULL,
  channel ENUM('EMAIL','SMS','PUSH','IN_APP') NOT NULL,
  subject VARCHAR(191) NULL,
  body TEXT NOT NULL,
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  readAt DATETIME NULL,
  relatedEntityType VARCHAR(191) NULL,
  relatedEntityId VARCHAR(191) NULL,
  sentAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX user_notifications_userId_isRead_index (userId, isRead),
  INDEX user_notifications_sentAt_index (sentAt),
  CONSTRAINT user_notifications_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  recipient VARCHAR(191) NOT NULL,
  subject VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  provider VARCHAR(191) NULL,
  sentAt DATETIME NULL,
  failedAt DATETIME NULL,
  errorMessage TEXT NULL,
  userId VARCHAR(36) NULL,
  orderId VARCHAR(36) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX email_logs_recipient_index (recipient),
  INDEX email_logs_status_index (status),
  INDEX email_logs_createdAt_index (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `key` VARCHAR(191) NOT NULL,
  value TEXT NOT NULL,
  description TEXT NULL,
  category VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
  updatedBy VARCHAR(36) NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY system_settings_key_unique (`key`),
  INDEX system_settings_category_index (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_flags (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  isEnabled TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT NULL,
  enabledForUserIds TEXT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY feature_flags_name_unique (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id VARCHAR(36) PRIMARY KEY,
  variantId VARCHAR(36) NOT NULL,
  adjustment INT NOT NULL,
  reason VARCHAR(191) NOT NULL,
  notes TEXT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  requestedBy VARCHAR(36) NOT NULL,
  approvedBy VARCHAR(36) NULL,
  approvalNotes TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX stock_adjustments_variantId_index (variantId),
  INDEX stock_adjustments_status_index (status),
  CONSTRAINT stock_adjustments_variantId_fkey FOREIGN KEY (variantId) REFERENCES product_variants(id),
  CONSTRAINT stock_adjustments_requestedBy_fkey FOREIGN KEY (requestedBy) REFERENCES users(id),
  CONSTRAINT stock_adjustments_approvedBy_fkey FOREIGN KEY (approvedBy) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_action_log (
  id VARCHAR(36) PRIMARY KEY,
  adminId VARCHAR(36) NOT NULL,
  action VARCHAR(191) NOT NULL,
  metadata TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX admin_action_log_adminId_index (adminId),
  INDEX admin_action_log_action_index (action),
  CONSTRAINT admin_action_log_adminId_fkey FOREIGN KEY (adminId) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refunds (
  id VARCHAR(36) PRIMARY KEY,
  orderId VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NULL,
  refundedBy VARCHAR(36) NULL,
  refundedAt DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX refunds_orderId_index (orderId),
  INDEX refunds_createdAt_index (createdAt),
  CONSTRAINT refunds_orderId_fkey FOREIGN KEY (orderId) REFERENCES orders(id),
  CONSTRAINT refunds_refundedBy_fkey FOREIGN KEY (refundedBy) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS instructors (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  userId VARCHAR(36) NOT NULL,
  headline VARCHAR(191) NULL,
  bio TEXT NULL,
  websiteUrl VARCHAR(191) NULL,
  socialLinks TEXT NULL,
  expertise TEXT NULL,
  isVerified TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY instructors_userId_unique (userId),
  INDEX instructors_userId_index (userId),
  CONSTRAINT instructors_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  instructorId VARCHAR(36) NOT NULL,
  title VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  shortDescription TEXT NULL,
  description TEXT NULL,
  category VARCHAR(191) NOT NULL,
  level ENUM('BEGINNER','INTERMEDIATE','ADVANCED') NOT NULL DEFAULT 'BEGINNER',
  language VARCHAR(100) NOT NULL DEFAULT 'English',
  thumbnailUrl VARCHAR(191) NULL,
  previewVideoUrl VARCHAR(191) NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  originalPrice DECIMAL(10,2) NULL,
  status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  isFeatured TINYINT(1) NOT NULL DEFAULT 0,
  totalDurationMinutes INT NOT NULL DEFAULT 0,
  totalLessons INT NOT NULL DEFAULT 0,
  ratingAverage DECIMAL(3,2) NOT NULL DEFAULT 0,
  ratingCount INT NOT NULL DEFAULT 0,
  enrollmentCount INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  publishedAt DATETIME NULL,
  UNIQUE KEY courses_slug_unique (slug),
  INDEX courses_instructorId_index (instructorId),
  INDEX courses_status_index (status),
  INDEX courses_category_index (category),
  CONSTRAINT courses_instructorId_fkey FOREIGN KEY (instructorId) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_sections (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  courseId VARCHAR(36) NOT NULL,
  title VARCHAR(191) NOT NULL,
  description TEXT NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX course_sections_courseId_index (courseId),
  CONSTRAINT course_sections_courseId_fkey FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_lessons (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  sectionId VARCHAR(36) NOT NULL,
  courseId VARCHAR(36) NOT NULL,
  title VARCHAR(191) NOT NULL,
  contentType ENUM('VIDEO','TEXT') NOT NULL DEFAULT 'VIDEO',
  videoUrl VARCHAR(191) NULL,
  content TEXT NULL,
  documents JSON NULL,
  durationMinutes INT NOT NULL DEFAULT 0,
  isPreview TINYINT(1) NOT NULL DEFAULT 0,
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX course_lessons_sectionId_index (sectionId),
  INDEX course_lessons_courseId_index (courseId),
  CONSTRAINT course_lessons_sectionId_fkey FOREIGN KEY (sectionId) REFERENCES course_sections(id) ON DELETE CASCADE,
  CONSTRAINT course_lessons_courseId_fkey FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS course_enrollments (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  courseId VARCHAR(36) NOT NULL,
  studentId VARCHAR(36) NOT NULL,
  status ENUM('ACTIVE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  progressPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
  completedLessons INT NOT NULL DEFAULT 0,
  totalLessons INT NOT NULL DEFAULT 0,
  enrolledAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME NULL,
  lastAccessedAt DATETIME NULL,
  UNIQUE KEY course_enrollments_course_student_unique (courseId, studentId),
  INDEX course_enrollments_studentId_index (studentId),
  INDEX course_enrollments_courseId_index (courseId),
  CONSTRAINT course_enrollments_courseId_fkey FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT course_enrollments_studentId_fkey FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_progress (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  enrollmentId VARCHAR(36) NOT NULL,
  lessonId VARCHAR(36) NOT NULL,
  status ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  watchTimeSeconds INT NOT NULL DEFAULT 0,
  lastPositionSeconds INT NOT NULL DEFAULT 0,
  completedAt DATETIME NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY lesson_progress_enrollment_lesson_unique (enrollmentId, lessonId),
  INDEX lesson_progress_lessonId_index (lessonId),
  CONSTRAINT lesson_progress_enrollmentId_fkey FOREIGN KEY (enrollmentId) REFERENCES course_enrollments(id) ON DELETE CASCADE,
  CONSTRAINT lesson_progress_lessonId_fkey FOREIGN KEY (lessonId) REFERENCES course_lessons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desk_accessory_sets (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT NULL,
  coverImageUrl VARCHAR(191) NULL,
  bundlePrice DECIMAL(10,2) NULL,
  status ENUM('DRAFT','ACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  createdById VARCHAR(36) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY desk_accessory_sets_slug_unique (slug),
  INDEX desk_accessory_sets_status_index (status),
  CONSTRAINT desk_accessory_sets_createdById_fkey FOREIGN KEY (createdById) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS desk_accessory_set_items (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setId VARCHAR(36) NOT NULL,
  productId VARCHAR(36) NOT NULL,
  variantId VARCHAR(36) NULL,
  quantity INT NOT NULL DEFAULT 1,
  displayOrder INT NOT NULL DEFAULT 0,
  note TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX desk_accessory_set_items_setId_index (setId),
  INDEX desk_accessory_set_items_productId_index (productId),
  CONSTRAINT desk_accessory_set_items_setId_fkey FOREIGN KEY (setId) REFERENCES desk_accessory_sets(id) ON DELETE CASCADE,
  CONSTRAINT desk_accessory_set_items_productId_fkey FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT desk_accessory_set_items_variantId_fkey FOREIGN KEY (variantId) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
