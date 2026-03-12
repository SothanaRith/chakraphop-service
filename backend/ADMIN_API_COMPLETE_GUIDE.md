# ADMIN API - COMPLETE IMPLEMENTATION GUIDE

## Overview

This is a production-grade Admin API for managing a complete e-commerce and inventory management system. The API is designed for **internal staff only** (not public users) and includes critical safeguards for business operations.

---

## 🔐 SECURITY & AUTHENTICATION

### JWT-Based Authentication

All admin endpoints require a valid JWT token:

```
Authorization: Bearer <jwt_token>
```

### Token Structure

```javascript
{
  id: "user_id",
  email: "admin@example.com",
  role: "ADMIN",
  iat: 1704067200,
  exp: 1704153600
}
```

### Request Flow

1. User authenticates via `/api/v1/auth/login`
2. Receives JWT token with 24-hour expiration
3. Includes token in `Authorization` header for all admin requests
4. Server validates token and checks user role

---

## 👥 ROLE-BASED ACCESS CONTROL (RBAC)

### Role Hierarchy

```
SUPER_ADMIN (highest)
    ↓
ADMIN
    ↓
INVENTORY_MANAGER
    ↓
SALES_AGENT
    ↓
CUSTOMER (lowest)
```

### Role Permission Matrix

#### SUPER_ADMIN
- Full system access
- User management (create, update, delete, assign roles)
- All inventory operations including approvals
- All product management
- All order operations including refunds
- System configuration

#### ADMIN
- User management (create, update - no delete)
- Inventory read/write and adjustments
- Product management and publishing
- Order management (except refunds)
- Activity monitoring
- No role assignment

#### INVENTORY_MANAGER
- Read all inventory
- Stock in/out operations
- Stock adjustments
- Low-stock threshold management
- Cannot modify products
- Cannot manage orders

#### SALES_AGENT
- Read-only access to most operations
- Can update order status
- Can view inventory
- Cannot modify stock or products

---

## 📚 API ENDPOINTS BY MODULE

### 1. USER & ROLE MANAGEMENT

#### Get All Admin Users
```
GET /api/admin/users
Query: role, status, page, limit, search
Authorization: Admin, Super Admin
```

**Response:**
```json
{
  "data": {
    "users": [
      {
        "id": "usr_123",
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "lastLogin": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5 }
  }
}
```

#### Create Admin User (SUPER_ADMIN ONLY)
```
POST /api/admin/users
Authorization: Super Admin
```

**Request Body:**
```json
{
  "email": "newadmin@example.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "ADMIN"
}
```

#### Update User Role (SUPER_ADMIN ONLY)
```
PATCH /api/admin/users/:userId/role
Authorization: Super Admin
```

**Request Body:**
```json
{
  "role": "INVENTORY_MANAGER"
}
```

**Audit Trail:**
```javascript
// Automatically logged
{
  action: 'CHANGE_ROLE',
  fromRole: 'ADMIN',
  toRole: 'INVENTORY_MANAGER',
  changedBy: 'admin_user_id',
  timestamp: '2024-01-15T10:30:00Z'
}
```

#### Get Activity Log
```
GET /api/admin/activity
Query: userId, action, page, limit, startDate, endDate
Authorization: Admin, Super Admin
```

---

### 2. INVENTORY MANAGEMENT (CRITICAL)

#### Get Inventory Overview
```
GET /api/admin/inventory/overview
Query: page, limit, lowStockOnly=true
Authorization: Inventory Manager, Admin, Super Admin
```

**Response:**
```json
{
  "data": {
    "items": [
      {
        "variantId": "var_123",
        "productName": "Pro Running Shoe",
        "sku": "SHOE-001-BLK-10",
        "size": "10",
        "color": "Black",
        "quantity": 45,
        "lowStockThreshold": 50,
        "reorderQuantity": 100,
        "price": 99.99,
        "status": "LOW"
      }
    ]
  }
}
```

#### Stock In (Receive from Supplier)
```
POST /api/admin/inventory/stock-in
Authorization: Inventory Manager, Admin, Super Admin
```

**Request Body:**
```json
{
  "variantId": "var_123",
  "quantity": 500,
  "purchaseOrderNumber": "PO-2024-001",
  "supplierName": "Nike Wholesale",
  "notes": "Received via FedEx"
}
```

**CRITICAL SAFETY FEATURES:**
- ✅ Uses database transaction (atomic)
- ✅ Locks variant row during update
- ✅ Records movement history
- ✅ Logs admin action
- ✅ Cannot go negative

**Response:**
```json
{
  "data": {
    "variantId": "var_123",
    "productName": "Pro Running Shoe",
    "previousQuantity": 45,
    "newQuantity": 545,
    "quantityAdded": 500,
    "purchaseOrderNumber": "PO-2024-001"
  }
}
```

#### Manual Stock Adjustment (CRITICAL)
```
POST /api/admin/inventory/adjust-stock
Authorization: Inventory Manager, Admin, Super Admin
```

**Request Body:**
```json
{
  "variantId": "var_123",
  "adjustment": -10,
  "reason": "DAMAGE",
  "notes": "5 units damaged in warehouse fire, 5 expired",
  "requiresApproval": true
}
```

**Allowed Reasons:**
- `DAMAGE` - Physical damage
- `THEFT` - Loss due to theft
- `COUNT_CORRECTION` - Inventory recount discrepancy
- `RETURN` - Returned from customer
- `WASTE` - Expiration or waste

**Safety Mechanisms:**
1. **Prevents Negative Stock:**
   - Validates: `newQuantity = currentQuantity + adjustment >= 0`
   - Throws error if would go below 0

2. **Optional Approval Workflow:**
   ```json
   { "requiresApproval": true }
   ```
   - Creates pending request instead of applying immediately
   - Requires admin approval via:
   ```
   POST /api/admin/inventory/adjust-stock/:adjustmentId/approve
   ```

3. **Complete Audit Trail:**
   - All adjustments logged to `stockMovement` table
   - Records: previous quantity, new quantity, reason, notes
   - Timestamps and admin ID stored

**Response (Pending):**
```json
{
  "data": {
    "status": "PENDING",
    "adjustmentId": "adj_456",
    "message": "Stock adjustment pending approval"
  }
}
```

#### Approve Stock Adjustment
```
POST /api/admin/inventory/adjust-stock/:adjustmentId/approve
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "notes": "Damage verified by warehouse manager"
}
```

#### Set Low-Stock Threshold
```
POST /api/admin/inventory/variant/:variantId/threshold
Authorization: Inventory Manager, Admin, Super Admin
```

**Request Body:**
```json
{
  "threshold": 50,
  "reorderQuantity": 200
}
```

#### Get Inventory Movements
```
GET /api/admin/inventory/movements
Query: variantId, productId, type, page, limit, startDate, endDate
Authorization: Inventory Manager, Admin, Super Admin
```

**Movement Types:**
- `PURCHASE_ORDER` - Stock received
- `MANUAL_ADJUSTMENT` - Admin adjustment
- `SALE` - Stock sold
- `RETURN` - Customer return
- `WRITE_OFF` - Damage/expiration

---

### 3. PRODUCT MANAGEMENT

#### Get All Products
```
GET /api/admin/products
Query: status, category, sportId, page, limit, search, sortBy
Authorization: Admin, Super Admin
```

#### Create Product
```
POST /api/admin/products
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "name": "Pro Running Shoe",
  "description": "High-performance racing shoe",
  "sku": "SHOE-PRO-001",
  "categoryId": "cat_123",
  "sportId": "sport_456",
  "status": "DRAFT",
  "images": [
    {
      "url": "https://cdn.example.com/shoe1.jpg",
      "alt": "Pro Running Shoe - Black",
      "isPrimary": true
    }
  ]
}
```

#### Publish Product
```
POST /api/admin/products/:productId/publish
Authorization: Admin, Super Admin
```

**Effect:** Changes status from DRAFT to ACTIVE (visible to customers)

#### Create Product Variant
```
POST /api/admin/products/:productId/variants
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "sku": "SHOE-PRO-001-BLK-10",
  "size": "10",
  "color": "Black",
  "price": 99.99,
  "cost": 45.00,
  "images": ["url1", "url2"]
}
```

#### Bulk Update Prices
```
POST /api/admin/products/bulk-update/prices
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "updates": [
    { "variantId": "var_123", "price": 89.99 },
    { "variantId": "var_124", "price": 94.99 }
  ]
}
```

---

### 4. ORDER MANAGEMENT

#### Get All Orders
```
GET /api/admin/orders
Query: status, userId, page, limit, dateFrom, dateTo, search
Authorization: Admin, Super Admin
```

**Status Options:**
- PENDING - Payment pending
- PAID - Payment confirmed
- PROCESSING - Being prepared
- SHIPPED - In transit
- DELIVERED - Completed
- CANCELLED - Cancelled
- PAYMENT_FAILED - Payment declined
- REFUNDED - Refunded

#### Get Order Details
```
GET /api/admin/orders/:orderId
Authorization: Admin, Super Admin
```

**Response:**
```json
{
  "data": {
    "id": "ord_123",
    "orderNumber": "ORD-1704067200123",
    "user": {
      "id": "usr_456",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "items": [
      {
        "id": "item_789",
        "variantId": "var_123",
        "quantity": 2,
        "price": 99.99,
        "subtotal": 199.98,
        "variant": {
          "sku": "SHOE-PRO-001-BLK-10",
          "size": "10",
          "color": "Black",
          "product": { "name": "Pro Running Shoe" }
        }
      }
    ],
    "total": 199.98,
    "status": "PROCESSING",
    "payment": {
      "method": "STRIPE",
      "transactionId": "txn_123456",
      "status": "COMPLETED",
      "amount": 199.98
    },
    "shippingAddress": { ... },
    "statusHistory": [
      {
        "fromStatus": "PENDING",
        "toStatus": "PAID",
        "timestamp": "2024-01-15T10:00:00Z"
      },
      {
        "fromStatus": "PAID",
        "toStatus": "PROCESSING",
        "timestamp": "2024-01-15T11:30:00Z",
        "notes": "Order packed and ready to ship"
      }
    ],
    "notes": [...]
  }
}
```

#### Update Order Status
```
PATCH /api/admin/orders/:orderId/status
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "status": "SHIPPED",
  "notes": "Shipped via FedEx, Tracking: 123456789"
}
```

**Status Transition Rules:**
```
PENDING        → PAID, PAYMENT_FAILED, CANCELLED
PAID           → PROCESSING, CANCELLED
PROCESSING     → SHIPPED, CANCELLED
SHIPPED        → DELIVERED, CANCELLED
DELIVERED      → (none - terminal state)
CANCELLED      → (none - terminal state)
PAYMENT_FAILED → PENDING, CANCELLED
REFUNDED       → (none - terminal state)
```

#### Cancel Order (CRITICAL - with Stock Rollback)
```
POST /api/admin/orders/:orderId/cancel
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "reason": "CUSTOMER_REQUEST",
  "notes": "Customer changed mind"
}
```

**CRITICAL TRANSACTION FEATURES:**
1. **Stock Rollback:**
   - If order was PAID/PROCESSING/SHIPPED, releases stock back
   - Each item quantity returned to inventory
   - Prevents negative stock

2. **Atomic Operation:**
   - Order status updated
   - Stock released
   - Status history logged
   - All or nothing (rollback on failure)

3. **Audit Trail:**
   - Records original status → CANCELLED
   - Logs cancellation reason
   - Timestamps admin action

**Response:**
```json
{
  "data": {
    "id": "ord_123",
    "status": "CANCELLED",
    "cancelledAt": "2024-01-15T12:00:00Z",
    "statusHistory": [
      { "fromStatus": "PROCESSING", "toStatus": "CANCELLED", "notes": "Customer requested cancellation" }
    ]
  }
}
```

#### Process Refund (SUPER_ADMIN ONLY - Financial Operation)
```
POST /api/admin/orders/:orderId/refund
Authorization: Super Admin
```

**Request Body:**
```json
{
  "reason": "DEFECTIVE_PRODUCT",
  "notes": "Shoes had stitching defect, customer returned",
  "refundAmount": 199.98
}
```

**CRITICAL SAFEGUARDS:**
1. **Amount Validation:**
   - `refundAmount` must be > 0
   - `refundAmount` must be ≤ order.total
   - Cannot exceed total order value

2. **Stock Handling:**
   - Stock released back to inventory
   - Movement recorded as "RETURN"

3. **Full Audit:**
   - Refund record created with:
     - Amount
     - Reason
     - Admin who approved
     - Timestamp

4. **Financial Safety:**
   - All refunds logged separately from orders
   - Can be audited independently
   - Creates immutable record

**Response:**
```json
{
  "data": {
    "refundId": "ref_123",
    "orderId": "ord_123",
    "amount": 199.98,
    "reason": "DEFECTIVE_PRODUCT",
    "refundedBy": "admin_456",
    "status": "PROCESSED",
    "timestamp": "2024-01-15T13:00:00Z"
  }
}
```

#### Add Order Note
```
POST /api/admin/orders/:orderId/notes
Authorization: Admin, Super Admin
```

**Request Body:**
```json
{
  "note": "Customer called - requesting expedited shipping",
  "isInternal": false
}
```

**Note Types:**
- `isInternal: true` - Admin-only notes (not visible to customer)
- `isInternal: false` - Customer-visible notes

#### Get Order History
```
GET /api/admin/orders/:orderId/history
Authorization: Admin, Super Admin
```

**Response includes:**
- All status changes with timestamps
- All notes and comments
- Timeline of events
- Payment records
- Shipping records

#### Get Abnormal Orders
```
GET /api/admin/orders/abnormal/list
Authorization: Admin, Super Admin
```

**Identifies:**
- Failed payments stuck >24 hours
- Processing orders >7 days old
- Cancelled with high refund amount
- Orders with error flags

#### Export Orders (CSV)
```
GET /api/admin/orders/export/csv
Query: status, dateFrom, dateTo
Authorization: Admin, Super Admin
```

---

## ⚠️ CRITICAL SAFETY RULES

### 1. Stock Management

**NEVER allow negative stock:**
```javascript
// CORRECT ✅
if (newQuantity < 0) {
  throw new InsufficientStockError("Cannot adjust below 0");
}

// WRONG ❌
await updateStock(quantity + adjustment); // Could go negative
```

**Always use transactions:**
```javascript
// CORRECT ✅
await prisma.$transaction(async (tx) => {
  const variant = await tx.productVariant.findUnique({ where: { id } });
  await tx.productVariant.update({
    where: { id },
    data: { quantity: variant.quantity + adjustment }
  });
  await tx.stockMovement.create({ ... });
});

// WRONG ❌
await prisma.productVariant.update({ ... });
await prisma.stockMovement.create({ ... }); // Could fail halfway
```

### 2. Order Cancellation

**Always release stock:**
```javascript
// When cancelling PAID/PROCESSING/SHIPPED orders:
await inventoryService.releaseStock(
  stockItems,
  orderId,
  reason,
  adminUserId
);
```

### 3. Refunds

**Only SUPER_ADMIN can refund:**
- Prevent accidental refunds
- Financial accountability
- Audit trail

**Validate refund amount:**
```javascript
if (refundAmount <= 0 || refundAmount > order.total) {
  throw new ValidationError("Invalid refund amount");
}
```

### 4. Role Changes

**Only SUPER_ADMIN can assign roles:**
- Prevent privilege escalation
- Audit trail required
- Activity logged

---

## 🛡️ COMMON ABUSE SCENARIOS & PREVENTION

### Scenario 1: Admin Reduces Stock Incorrectly

**Attack:** Admin adjusts stock to negative value (fraud)

**Prevention:**
```javascript
if (newQuantity < 0) {
  throw InsufficientStockError(`Current: ${current}, Cannot go below 0`);
}
```

**Additional:** Requires approval if marked `requiresApproval: true`

---

### Scenario 2: Unauthorized Stock Release

**Attack:** Admin releases large quantity without reason

**Prevention:**
1. Requires `reason` parameter
2. All reasons logged: DAMAGE, THEFT, COUNT_CORRECTION, etc.
3. Audit log created with admin ID
4. Can be reviewed later

---

### Scenario 3: Fake Refunds

**Attack:** Admin refunds money without authorization

**Prevention:**
1. Only SUPER_ADMIN can refund
2. Amount validated against order total
3. Immutable refund record created
4. Separate from order (full audit trail)
5. Finance can verify refunds independently

---

### Scenario 4: Role Escalation

**Attack:** Admin promotes themselves to SUPER_ADMIN

**Prevention:**
1. Only existing SUPER_ADMIN can change roles
2. Role changes logged with timestamps
3. Activity log searchable by admin ID
4. Cannot modify your own role

---

### Scenario 5: Mass Deletion

**Attack:** Admin deletes all products/orders

**Prevention:**
1. No hard delete endpoints (soft delete only)
2. All changes logged to admin action log
3. Requires specific role permission
4. Can be audited and recovered

---

## 📊 AUDIT TRAIL

All sensitive operations logged to `adminActionLog`:

```javascript
{
  id: "log_123",
  adminId: "admin_456",
  action: "STOCK_ADJUSTMENT",
  metadata: {
    variantId: "var_123",
    adjustment: -10,
    reason: "DAMAGE",
    newQuantity: 35
  },
  createdAt: "2024-01-15T10:30:00Z"
}
```

**Queryable via:**
```
GET /api/admin/activity
?userId=admin_456
&action=STOCK_ADJUSTMENT
&startDate=2024-01-01
&endDate=2024-01-31
```

---

## 🔄 TRANSACTION FLOW: Order Cancellation

Visual of critical transaction:

```
START TRANSACTION
│
├─ 1. Fetch order with items
│     └─ LOCK row for update
│
├─ 2. For each item:
│     └─ Return quantity to inventory
│        └─ Prevent negative stock
│
├─ 3. Update order status to CANCELLED
│
├─ 4. Log status change
│
├─ 5. Create audit entry
│
└─ COMMIT or ROLLBACK on error
  └─ If any step fails, entire transaction rolled back
  └─ Stock NOT released partially
  └─ Order status NOT changed
```

---

## 🚀 INTEGRATION CHECKLIST

- [ ] Import admin routes in main `app.js`
- [ ] Ensure JWT middleware is applied
- [ ] RBAC middleware properly configured
- [ ] Database migration for `adminActionLog` table
- [ ] Database migration for `stockMovement` table
- [ ] Database migration for `stockAdjustment` table
- [ ] Error handling middleware catches all exceptions
- [ ] Logging configured for admin operations
- [ ] Rate limiting applied (optional but recommended)
- [ ] Admin dashboard frontend connected
- [ ] Supervisor training on stock adjustments
- [ ] Finance team trained on refunds
- [ ] Backup strategy for audit logs

---

## 📞 SUPPORT SCENARIOS

### Q: Can a SALES_AGENT update order status?
**A:** Yes, SALES_AGENT can update status but cannot cancel or refund.

### Q: What if stock adjustment is rejected?
**A:** Original stock level remains unchanged. Rejection reason is logged.

### Q: Can admins see each other's activity?
**A:** Yes, ADMIN+ can query all activity logs. Only SUPER_ADMIN can see admin-specific actions.

### Q: What happens if refund fails?
**A:** Entire transaction rolls back. Order status unchanged, stock not released. Logged as failure.

### Q: How long are audit logs kept?
**A:** Indefinitely (immutable). Archive periodically for compliance.

---

## 🎯 NEXT STEPS

1. **Deploy Routes:** Add admin routes to Express app
2. **Database Setup:** Run migrations for audit tables
3. **Admin Dashboard:** Connect frontend to API
4. **Staff Training:** Train admins on workflows
5. **Monitoring:** Set up alerts for abnormal activity
6. **Backup:** Ensure audit logs backed up daily
7. **Testing:** Test all transaction scenarios
8. **Documentation:** Share with support team

---

**Built with production safety as priority 1.**
