# ADMIN API - QUICK REFERENCE & CODE EXAMPLES

## Authentication Example

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'SecurePassword123!'
  })
});

const { data } = await loginResponse.json();
const token = data.accessToken;

// 2. Use token for admin requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

---

## EXAMPLE 1: Safe Stock Adjustment

**Use Case:** Warehouse found 5 damaged units

```bash
# Request
POST /api/admin/inventory/adjust-stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "variantId": "var_abc123",
  "adjustment": -5,
  "reason": "DAMAGE",
  "notes": "Water damage during storage, 5 units destroyed",
  "requiresApproval": true
}

# Response
{
  "status": "success",
  "data": {
    "status": "PENDING",
    "adjustmentId": "adj_xyz789",
    "message": "Stock adjustment pending approval"
  }
}

# Later - Approve
POST /api/admin/inventory/adjust-stock/adj_xyz789/approve
Authorization: Bearer <token>

{
  "notes": "Damage verified. Photos attached to incident #2024-001"
}

# Response
{
  "status": "success",
  "data": {
    "status": "APPROVED",
    "adjustmentId": "adj_xyz789",
    "variantId": "var_abc123"
  }
}
```

---

## EXAMPLE 2: Order Cancellation with Stock Rollback

**Use Case:** Customer wants to cancel paid order

```bash
# 1. Check order details first
GET /api/admin/orders/ord_def456
Authorization: Bearer <token>

# Response
{
  "data": {
    "id": "ord_def456",
    "orderNumber": "ORD-1704067200123",
    "status": "PROCESSING",
    "items": [
      {
        "variantId": "var_123",
        "quantity": 2,
        "price": 99.99
      }
    ],
    "total": 199.98
  }
}

# 2. Cancel the order
POST /api/admin/orders/ord_def456/cancel
Authorization: Bearer <token>

{
  "reason": "CUSTOMER_REQUEST",
  "notes": "Customer called requesting cancellation due to sizing concerns"
}

# Response - Stock AUTOMATICALLY released
{
  "data": {
    "id": "ord_def456",
    "status": "CANCELLED",
    "cancelledAt": "2024-01-15T12:00:00Z"
  }
}

# Verify stock was released
GET /api/admin/inventory/movements?orderId=ord_def456

# Should show:
# - Type: SALE (2 units sold)
# - Type: RELEASE (2 units released when order cancelled)
```

---

## EXAMPLE 3: Handling Defective Product Refund

**Use Case:** Customer received defective shoes, wants full refund

```bash
# 1. Get order
GET /api/admin/orders/ord_ghi789
Authorization: Bearer <token>

# 2. Add internal note
POST /api/admin/orders/ord_ghi789/notes
Authorization: Bearer <token>

{
  "note": "Customer reported left shoe has hole in sole. Defective unit confirmed by QA",
  "isInternal": true
}

# 3. Process refund (SUPER_ADMIN only)
POST /api/admin/orders/ord_ghi789/refund
Authorization: Bearer <super_admin_token>

{
  "reason": "DEFECTIVE_PRODUCT",
  "notes": "Manufacturing defect - left shoe sole punctured",
  "refundAmount": 99.99
}

# Response
{
  "status": "success",
  "data": {
    "refundId": "ref_111222",
    "orderId": "ord_ghi789",
    "amount": 99.99,
    "reason": "DEFECTIVE_PRODUCT",
    "status": "PROCESSED",
    "refundedBy": "super_admin_456",
    "timestamp": "2024-01-15T13:00:00Z"
  }
}

# Stock automatically released ✓
# Refund record created for finance ✓
# Audit trail complete ✓
```

---

## EXAMPLE 4: Bulk Stock Import

**Use Case:** Receiving shipment of 10,000 units across multiple SKUs

```bash
POST /api/admin/inventory/bulk-import
Authorization: Bearer <token>

{
  "updates": [
    {
      "variantId": "var_001",
      "quantity": 500,
      "poNumber": "PO-2024-001",
      "supplier": "Nike Distribution",
      "notes": "Black size 10"
    },
    {
      "variantId": "var_002",
      "quantity": 750,
      "poNumber": "PO-2024-001",
      "supplier": "Nike Distribution",
      "notes": "Black size 11"
    },
    {
      "variantId": "var_003",
      "quantity": 600,
      "poNumber": "PO-2024-001",
      "supplier": "Nike Distribution",
      "notes": "White size 10"
    }
  ]
}

# Response
{
  "status": "success",
  "data": {
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "variantId": "var_001",
        "previousQuantity": 50,
        "newQuantity": 550,
        "quantityAdded": 500,
        "status": "SUCCESS"
      },
      ...
    ]
  }
}

# All stock movements logged ✓
# Audit trail shows PO number ✓
# Can be audited later ✓
```

---

## EXAMPLE 5: Audit Trail Query

**Use Case:** Finance audit - find all refunds from Jan 2024

```bash
GET /api/admin/activity
  ?action=REFUND
  &startDate=2024-01-01
  &endDate=2024-01-31
  &page=1
  &limit=100
Authorization: Bearer <token>

# Response
{
  "data": {
    "logs": [
      {
        "id": "log_123",
        "adminId": "admin_456",
        "action": "PROCESS_REFUND",
        "metadata": {
          "orderId": "ord_ghi789",
          "amount": 99.99,
          "reason": "DEFECTIVE_PRODUCT"
        },
        "createdAt": "2024-01-15T13:00:00Z"
      },
      {
        "id": "log_124",
        "adminId": "admin_456",
        "action": "PROCESS_REFUND",
        "metadata": {
          "orderId": "ord_jkl012",
          "amount": 149.99,
          "reason": "CUSTOMER_REQUEST"
        },
        "createdAt": "2024-01-16T10:15:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 100, "total": 47 }
  }
}

# Total refunds in Jan: $4,757.53
# Can cross-reference with payment processor ✓
# Complete accountability ✓
```

---

## JAVASCRIPT CLIENT LIBRARY (EXAMPLE)

```javascript
class AdminClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Inventory Management
  async adjustStock(variantId, adjustment, reason, requiresApproval = true) {
    const response = await fetch(`${this.baseUrl}/api/admin/inventory/adjust-stock`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        variantId,
        adjustment,
        reason,
        requiresApproval
      })
    });
    return response.json();
  }

  async approveStockAdjustment(adjustmentId, notes) {
    const response = await fetch(
      `${this.baseUrl}/api/admin/inventory/adjust-stock/${adjustmentId}/approve`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ notes })
      }
    );
    return response.json();
  }

  // Order Management
  async cancelOrder(orderId, reason, notes) {
    const response = await fetch(`${this.baseUrl}/api/admin/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ reason, notes })
    });
    return response.json();
  }

  async refundOrder(orderId, reason, notes, refundAmount) {
    const response = await fetch(`${this.baseUrl}/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ reason, notes, refundAmount })
    });
    return response.json();
  }

  async getOrderHistory(orderId) {
    const response = await fetch(
      `${this.baseUrl}/api/admin/orders/${orderId}/history`,
      { headers: this.headers }
    );
    return response.json();
  }

  // Activity/Audit
  async getActivityLog(userId, action, startDate, endDate) {
    const params = new URLSearchParams({
      userId,
      action,
      startDate,
      endDate,
      page: 1,
      limit: 100
    });
    const response = await fetch(
      `${this.baseUrl}/api/admin/activity?${params}`,
      { headers: this.headers }
    );
    return response.json();
  }
}

// Usage
const admin = new AdminClient('http://localhost:3000', token);

// Adjust stock with approval
const adjustment = await admin.adjustStock('var_123', -5, 'DAMAGE', true);
console.log(adjustment.data.adjustmentId);

// Later, approve it
await admin.approveStockAdjustment(adjustment.data.adjustmentId, 'Verified by warehouse');

// Cancel order
await admin.cancelOrder('ord_123', 'CUSTOMER_REQUEST', 'Customer wants to cancel');

// Check activity
const logs = await admin.getActivityLog('admin_456', 'REFUND', '2024-01-01', '2024-01-31');
```

---

## ERROR HANDLING

```javascript
async function safeAdminAction(action) {
  try {
    const response = await fetch(...);
    
    if (!response.ok) {
      const error = await response.json();
      
      // Handle specific errors
      switch (error.code) {
        case 'INSUFFICIENT_STOCK':
          console.error(`Cannot adjust: ${error.message}`);
          // Current: 10, Adjustment: -20, Result would be -10
          break;
        
        case 'UNAUTHORIZED':
          console.error('Insufficient permissions for this action');
          break;
        
        case 'ORDER_NOT_FOUND':
          console.error('Order does not exist');
          break;
        
        case 'INVALID_STATUS_TRANSITION':
          console.error(`Cannot go from ${error.from} to ${error.to}`);
          break;
        
        default:
          console.error('Unexpected error:', error.message);
      }
    }
    
    return response.json();
  } catch (error) {
    console.error('Network error:', error);
  }
}
```

---

## TESTING CHECKLIST

```bash
# Test 1: Stock adjustment prevents negative
curl -X POST http://localhost:3000/api/admin/inventory/adjust-stock \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"variantId":"v1","adjustment":-50,"reason":"DAMAGE"}' \
# Should fail if current is 30

# Test 2: Order cancellation releases stock
# 1. Check current stock
curl http://localhost:3000/api/admin/inventory/variant/v1
# {"quantity": 50}

# 2. Check order
curl http://localhost:3000/api/admin/orders/ord1
# {"status": "PROCESSING", "items": [{"variantId":"v1","quantity":10}]}

# 3. Cancel order
curl -X POST http://localhost:3000/api/admin/orders/ord1/cancel \
  -d '{"reason":"TEST"}'

# 4. Check stock again
curl http://localhost:3000/api/admin/inventory/variant/v1
# {"quantity": 60} ← Should be +10

# Test 3: Audit trail
curl "http://localhost:3000/api/admin/activity?action=CANCEL_ORDER" \
  -H "Authorization: Bearer $TOKEN"
# Should show order cancellation logged

# Test 4: Refund creates proper record
curl -X POST http://localhost:3000/api/admin/orders/ord1/refund \
  -d '{"reason":"TEST_REFUND","amount":99.99}'

# Test 5: Stock adjustment approval workflow
# 1. Request adjustment with requiresApproval: true
# 2. Check status is PENDING
# 3. Approve it
# 4. Check status is APPLIED
# 5. Verify stock changed
```

---

## DEPLOYMENT CHECKLIST

- [ ] All services exported correctly
- [ ] All controllers imported in routes
- [ ] Admin routes added to main app.js: `app.use('/api/admin', adminRoutes)`
- [ ] JWT middleware applied globally
- [ ] RBAC middleware configured
- [ ] Database migrations run
- [ ] Error handling middleware in place
- [ ] Logging configured for admin operations
- [ ] Rate limiting applied (if needed)
- [ ] HTTPS enforced in production
- [ ] Admin token expiration set (24 hours)
- [ ] Audit logs backed up daily
- [ ] Admin dashboard frontend deployed
- [ ] Staff training completed
- [ ] Monitoring/alerts configured

---

## PRODUCTION CONFIGURATION

```javascript
// config/admin.js
export default {
  // Session
  tokenExpiration: '24h',
  
  // Rate limiting
  rateLimit: {
    window: 60000, // 1 minute
    maxRequests: 100
  },
  
  // Approval thresholds
  requiresApproval: {
    stockAdjustment: true,
    refund: true // Only SUPER_ADMIN anyway
  },
  
  // Audit
  auditLog: {
    retention: 'PERMANENT',
    backup: 'DAILY'
  },
  
  // Alerts
  alerts: {
    lowStockThreshold: 50,
    failedPayment24h: true,
    bulkAdjustmentOver: 1000
  }
};
```

---

**Ready for production deployment.**
