# ADMIN API - INTEGRATION GUIDE

## 1. INSTALLATION & SETUP

### Step 1: Add Routes to Main App

**File: `backend/src/app.js`**

```javascript
// Import admin routes
import adminApiRoutes from './routes/admin.api.routes.js';

// ... existing middleware setup ...

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN API ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// All admin routes are protected by default
app.use('/api/admin', adminApiRoutes);

// ... rest of your routes ...
```

### Step 2: Database Migrations

Ensure these tables exist:

```sql
-- Admin Action Log
CREATE TABLE admin_action_log (
  id VARCHAR(36) PRIMARY KEY,
  admin_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES user(id),
  INDEX (admin_id),
  INDEX (action),
  INDEX (created_at)
);

-- Stock Movement Log
CREATE TABLE stock_movement (
  id VARCHAR(36) PRIMARY KEY,
  variant_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT,
  new_quantity INT,
  reference VARCHAR(255),
  notes TEXT,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variant(id),
  FOREIGN KEY (created_by) REFERENCES user(id),
  INDEX (variant_id),
  INDEX (type),
  INDEX (created_at)
);

-- Stock Adjustment (Pending approvals)
CREATE TABLE stock_adjustment (
  id VARCHAR(36) PRIMARY KEY,
  variant_id VARCHAR(36) NOT NULL,
  adjustment INT NOT NULL,
  reason VARCHAR(100),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  requested_by VARCHAR(36),
  approved_by VARCHAR(36),
  approval_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (variant_id) REFERENCES product_variant(id),
  FOREIGN KEY (requested_by) REFERENCES user(id),
  FOREIGN KEY (approved_by) REFERENCES user(id),
  INDEX (status),
  INDEX (created_at)
);

-- Order Status History
CREATE TABLE order_status_history (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES order(id),
  INDEX (order_id),
  INDEX (created_at)
);

-- Order Notes
CREATE TABLE order_note (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  note TEXT,
  is_internal BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES order(id),
  FOREIGN KEY (created_by) REFERENCES user(id),
  INDEX (order_id),
  INDEX (created_at)
);

-- Refund Log
CREATE TABLE refund (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2),
  reason VARCHAR(255),
  refunded_by VARCHAR(36),
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES order(id),
  FOREIGN KEY (refunded_by) REFERENCES user(id),
  INDEX (order_id),
  INDEX (created_at)
);
```

### Step 3: Verify Prisma Schema

Ensure your Prisma schema includes these models. Add to `backend/prisma/schema.prisma`:

```prisma
model AdminActionLog {
  id        String   @id @default(cuid())
  adminId   String
  action    String
  metadata  String?  @db.LongText
  createdAt DateTime @default(now())
  
  admin     User     @relation(fields: [adminId], references: [id])
  
  @@index([adminId])
  @@index([action])
  @@index([createdAt])
}

model StockMovement {
  id                String   @id @default(cuid())
  variantId         String
  type              String   // PURCHASE_ORDER, MANUAL_ADJUSTMENT, SALE, RETURN, WRITE_OFF
  quantity          Int
  previousQuantity  Int?
  newQuantity       Int?
  reference         String?
  notes             String?  @db.LongText
  createdBy         String?
  createdAt         DateTime @default(now())
  
  variant           ProductVariant @relation(fields: [variantId], references: [id])
  admin             User?    @relation(fields: [createdBy], references: [id])
  
  @@index([variantId])
  @@index([type])
  @@index([createdAt])
}

model StockAdjustment {
  id              String   @id @default(cuid())
  variantId       String
  adjustment      Int
  reason          String?
  notes           String?  @db.LongText
  status          String   @default("PENDING") // PENDING, APPROVED, REJECTED
  requestedBy     String
  approvedBy      String?
  approvalNotes   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  variant         ProductVariant @relation(fields: [variantId], references: [id])
  requester       User     @relation("InventoryRequestor", fields: [requestedBy], references: [id])
  approver        User?    @relation("InventoryApprover", fields: [approvedBy], references: [id])
  
  @@index([status])
  @@index([createdAt])
}

model OrderStatusHistory {
  id          String   @id @default(cuid())
  orderId     String
  fromStatus  String?
  toStatus    String
  notes       String?  @db.LongText
  createdAt   DateTime @default(now())
  
  order       Order    @relation(fields: [orderId], references: [id])
  
  @@index([orderId])
  @@index([createdAt])
}

model OrderNote {
  id        String   @id @default(cuid())
  orderId   String
  note      String   @db.LongText
  isInternal Boolean @default(true)
  createdBy String?
  createdAt DateTime @default(now())
  
  order     Order    @relation(fields: [orderId], references: [id])
  author    User?    @relation(fields: [createdBy], references: [id])
  
  @@index([orderId])
  @@index([createdAt])
}

model Refund {
  id         String   @id @default(cuid())
  orderId    String
  amount     Decimal  @db.Decimal(10, 2)
  reason     String?
  refundedBy String?
  refundedAt DateTime?
  createdAt  DateTime @default(now())
  
  order      Order    @relation(fields: [orderId], references: [id])
  admin      User?    @relation(fields: [refundedBy], references: [id])
  
  @@index([orderId])
  @@index([createdAt])
}

// Add to Order model if not present:
model Order {
  // ... existing fields ...
  statusHistory   OrderStatusHistory[]
  notes           OrderNote[]
  refunds         Refund[]
}

// Add to User model if not present:
model User {
  // ... existing fields ...
  adminActions    AdminActionLog[]
  stockMovements  StockMovement[]
  requestedAdjustments StockAdjustment[] @relation("InventoryRequestor")
  approvedAdjustments  StockAdjustment[] @relation("InventoryApprover")
  orderNotes      OrderNote[]
  refunds         Refund[]
}

// Add to ProductVariant model:
model ProductVariant {
  // ... existing fields ...
  stockMovements  StockMovement[]
  adjustments     StockAdjustment[]
}
```

### Step 4: Run Migrations

```bash
cd backend

# If using Prisma
npx prisma migrate dev --name add-admin-api-tables

# If using raw SQL
mysql < migrations/add-admin-api-tables.sql
```

### Step 5: Verify Services Are Imported

The services are already implemented:
- ✅ `admin.users.service.js`
- ✅ `admin.inventory.service.js`
- ✅ `admin.products.service.js`
- ✅ `admin.orders.service.js`

---

## 2. TESTING

### Test 1: Verify Routes Are Accessible

```bash
# Get JWT token first
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | jq -r '.data.accessToken')

echo "Token: $TOKEN"

# Test admin routes exist
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/users

# Should respond with 200 OK (or 403 if role not allowed)
# NOT 404 (route not found)
```

### Test 2: Verify RBAC

```bash
# Login as SALES_AGENT
TOKEN=$(curl ... login with sales_agent@example.com)

# Try to access inventory (should fail)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/inventory/overview
# Expected: 403 FORBIDDEN

# Try to get orders (should work)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/admin/orders
# Expected: 200 OK
```

### Test 3: Stock Safety

```bash
# Get current stock
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/admin/inventory/variant/var_123 \
  | jq '.data.quantity'
# Returns: 10

# Try to adjust below 0
curl -X POST http://localhost:3000/api/admin/inventory/adjust-stock \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "var_123",
    "adjustment": -20,
    "reason": "DAMAGE"
  }'
# Expected: 400 BAD REQUEST - "Cannot adjust below 0"
```

### Test 4: Order Cancellation

```bash
# Create order with stock
# Cancel it
# Check stock was released
```

---

## 3. FRONTEND INTEGRATION

### Connect React Dashboard

```javascript
// hooks/useAdminAPI.js
import { useCallback } from 'react';
import useAuth from './useAuth';

export const useAdminAPI = () => {
  const { token } = useAuth();
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const adjustStock = useCallback(async (variantId, adjustment, reason) => {
    const response = await fetch('/api/admin/inventory/adjust-stock', {
      method: 'POST',
      headers,
      body: JSON.stringify({ variantId, adjustment, reason, requiresApproval: true })
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    return response.json();
  }, [token]);

  const cancelOrder = useCallback(async (orderId, reason, notes) => {
    const response = await fetch(`/api/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, notes })
    });
    
    if (!response.ok) {
      throw new Error(await response.text());
    }
    
    return response.json();
  }, [token]);

  return { adjustStock, cancelOrder };
};

// Usage in component
function InventoryManager() {
  const { adjustStock } = useAdminAPI();
  
  const handleDamageReport = async (variantId, count) => {
    try {
      const result = await adjustStock(variantId, -count, 'DAMAGE');
      showNotification(`Adjustment pending approval: ${result.data.adjustmentId}`);
    } catch (error) {
      showError(error.message);
    }
  };
  
  return (
    // JSX
  );
}
```

---

## 4. MONITORING & LOGGING

### Configure Logger for Admin Operations

```javascript
// config/logger.js
import winston from 'winston';

const adminLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'admin-api' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/admin-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/admin.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  adminLogger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default adminLogger;
```

### Set Up Alerts

```javascript
// Example: Alert on large refunds
if (refundAmount > 500) {
  await sendAlert({
    level: 'WARNING',
    title: 'Large Refund Processed',
    message: `Admin ${adminId} refunded $${refundAmount} for order ${orderId}`,
    action: 'REVIEW_REFUND',
    link: `/admin/refunds/${refundId}`
  });
}

// Example: Alert on failed stock adjustment
if (adjustment.status === 'REJECTED') {
  await sendAlert({
    level: 'INFO',
    title: 'Stock Adjustment Rejected',
    message: `${adjustment.reason} adjustment rejected`,
    action: 'REVIEW_INVENTORY'
  });
}
```

---

## 5. BACKUP & COMPLIANCE

### Daily Backup of Audit Logs

```bash
#!/bin/bash
# backup-admin-logs.sh

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/backups/admin-audit/${DATE}"

mkdir -p $BACKUP_DIR

# Export admin logs
mysql -u root -p$DB_PASSWORD -h localhost $DB_NAME -e \
  "SELECT * INTO OUTFILE '$BACKUP_DIR/admin_action_log.csv' 
   FIELDS TERMINATED BY ',' 
   FROM admin_action_log;"

# Encrypt backup
gpg --encrypt --recipient backup@example.com $BACKUP_DIR/admin_action_log.csv

# Upload to secure storage
aws s3 cp $BACKUP_DIR/admin_action_log.csv.gpg \
  s3://backup-bucket/admin-audit/${DATE}/ \
  --sse AES256

echo "Backup completed: $BACKUP_DIR"
```

### Run Daily

```bash
# Add to crontab
0 2 * * * /scripts/backup-admin-logs.sh
```

---

## 6. STAFF TRAINING

### Inventory Manager Training

```
1. Stock In Operations
   - Receive PO number and item list
   - Scan or manually enter variantId
   - Enter quantity
   - Confirm and submit
   - System updates inventory in real-time

2. Damage Reporting
   - Found 5 damaged units
   - Use "Adjust Stock" tool
   - Select "DAMAGE" reason
   - Enter count and notes
   - Optionally require approval
   - Submit and wait for approval if needed

3. Safety Rules
   - NEVER enter negative numbers without reason
   - ALWAYS provide clear notes
   - If unsure, request approval
```

### Admin User Management Training

```
1. Creating Staff Users
   - Only SUPER_ADMIN can create users
   - Assign appropriate role based on duties
   - INVENTORY_MANAGER: Stock control only
   - SALES_AGENT: Order fulfillment only
   - ADMIN: Full operational control
   - SUPER_ADMIN: System configuration

2. Password Reset
   - Use "Reset Password" feature
   - User must change password on next login
   - Logged for compliance

3. Disable Users
   - When employee leaves
   - Select user and click "Disable"
   - User cannot login but history preserved
   - Cannot re-enable from normal interface
```

---

## 7. TROUBLESHOOTING

### Issue: "Stock adjustment shows PENDING but was instantly applied"

**Solution:** Check `requiresApproval` flag
```javascript
// Should require approval
requiresApproval: true

// This creates PENDING status
```

### Issue: Order cancellation shows "Cannot transition from PROCESSING to CANCELLED"

**Solution:** Check order status rules
```javascript
// PROCESSING → SHIPPED, CANCELLED (allowed)
// DELIVERED → Cannot cancel (not allowed)
```

### Issue: Refund failed but stock was released

**Solution:** This should NOT happen (transaction safety)
- If refund fails, entire transaction rolled back
- Check logs for error details
- Investigate database for partial updates

### Issue: Admin cannot see activity log

**Solution:** Check RBAC
```javascript
// Only ADMIN+ can view activity
authorize(['ADMIN', 'SUPER_ADMIN'])
```

---

## 8. SECURITY CHECKLIST

- [ ] JWT expiration set to 24 hours
- [ ] HTTPS enforced on all admin endpoints
- [ ] Rate limiting configured (optional)
- [ ] CORS restricted to admin dashboard domain
- [ ] Admin IP whitelisting (optional)
- [ ] 2FA enabled for SUPER_ADMIN accounts
- [ ] Audit logs backed up daily
- [ ] Staff trained on security procedures
- [ ] Change log review process established
- [ ] Incident response plan created

---

## 9. PERFORMANCE OPTIMIZATION

### Indexes for Common Queries

```sql
-- Already in migrations, but verify:
CREATE INDEX idx_stock_movement_variant ON stock_movement(variant_id);
CREATE INDEX idx_stock_movement_type ON stock_movement(type);
CREATE INDEX idx_stock_adjustment_status ON stock_adjustment(status);
CREATE INDEX idx_admin_action_log_admin ON admin_action_log(admin_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
```

### Query Optimization

```javascript
// Use pagination
limit: 50,  // Don't fetch all records

// Use filtering
where: { status: 'PENDING' },  // Filter early

// Use projections
select: { id: true, name: true },  // Only needed fields
```

---

## 10. PRODUCTION DEPLOYMENT

### Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Migrations created and tested
- [ ] Error handling configured
- [ ] Logging enabled
- [ ] Rate limiting active
- [ ] HTTPS certificate valid
- [ ] Database backups configured
- [ ] Admin dashboard deployed
- [ ] Staff trained
- [ ] Monitoring alerts active
- [ ] Incident response plan ready

### Go-Live Procedure

1. Deploy to staging environment first
2. Run full test suite
3. Staff runs acceptance tests
4. Create database backup
5. Deploy to production during low-traffic period
6. Monitor error logs for 24 hours
7. Send staff notification with new procedures
8. Schedule training sessions

---

**Admin API successfully integrated and ready for operations.**
