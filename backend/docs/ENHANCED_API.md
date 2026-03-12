# 🔐 Enhanced Authentication & Features API Documentation

## 📋 Table of Contents
1. [Authentication Endpoints](#authentication)
2. [OTP Verification](#otp-verification)
3. [Discount Codes](#discount-codes)
4. [Wishlist](#wishlist)
5. [Product Reviews](#product-reviews)
6. [Notifications](#notifications)
7. [Recently Viewed](#recently-viewed)
8. [Security Features](#security-features)

---

## 🔐 Authentication

### Register with Email (Enhanced)
**POST** `/api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CUSTOMER",
    "isEmailVerified": false
  },
  "message": "Registration successful. Please verify your email.",
  "otpSent": true
}
```

**Security Features:**
- ✅ Password hashed with bcrypt (12 rounds)
- ✅ Email verification required
- ✅ Account enumeration prevention
- ✅ Rate limiting on registration endpoint

---

### Verify Email
**POST** `/api/auth/verify-email`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error Responses:**
- `400` - Invalid or expired OTP
- `429` - Too many attempts (max 3)

---

### Login with Email/Password
**POST** `/api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200) - Without 2FA:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "role": "CUSTOMER"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

**Response (200) - With 2FA Enabled:**
```json
{
  "requires2FA": true,
  "message": "Please enter the OTP sent to your email"
}
```

**Error Responses:**
- `401` - Invalid credentials (X attempts remaining)
- `403` - Account locked (after 5 failed attempts, locked for 30 minutes)
- `403` - Account inactive

**Security Features:**
- ✅ Failed attempt tracking
- ✅ Account lockout after 5 failed attempts (30 min)
- ✅ Generic error messages (no enumeration)
- ✅ Security logging

---

### Verify 2FA
**POST** `/api/auth/verify-2fa`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": { ... },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

---

### Google OAuth Login
**POST** `/api/auth/google`

**Request Body:**
```json
{
  "idToken": "google_id_token_from_client"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "firstName": "John",
    "authProvider": "GOOGLE"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token",
  "isNewUser": false
}
```

**Features:**
- ✅ Automatic account linking by email
- ✅ Auto email verification
- ✅ No password required for OAuth-only accounts
- ✅ Secure token validation

---

### Request Password Reset
**POST** `/api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset code has been sent."
}
```

**Security Notes:**
- Always returns success (prevents enumeration)
- OTP sent only if account exists
- Rate limited (3 per 15 minutes)

---

### Reset Password
**POST** `/api/auth/reset-password`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successful. You can now login with your new password."
}
```

---

### Change Password (Authenticated)
**POST** `/api/auth/change-password`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

### Enable/Disable 2FA
**POST** `/api/auth/2fa/toggle`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "enable": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

---

## 📧 OTP Verification

### OTP Types
- `EMAIL_VERIFICATION` - Verify email after registration
- `LOGIN_2FA` - Two-factor authentication
- `PASSWORD_RESET` - Reset forgotten password
- `ACCOUNT_RECOVERY` - Account security verification

### OTP Specifications
- **Length:** 6 digits
- **Validity:** 10 minutes
- **Max Attempts:** 3
- **Rate Limit:** 3 OTPs per 15 minutes per email
- **Storage:** Hashed (bcrypt), never plain text

### Resend OTP
**POST** `/api/auth/resend-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "type": "EMAIL_VERIFICATION"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresAt": "2026-02-02T10:15:00Z"
}
```

**Error Responses:**
- `429` - Must wait 2 minutes before requesting another OTP

---

## 🎟️ Discount Codes

### Create Discount Code (Admin)
**POST** `/api/admin/discounts`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Request Body:**
```json
{
  "code": "SUMMER20",
  "description": "20% off summer collection",
  "type": "PERCENTAGE",
  "value": 20,
  "maxUses": 100,
  "maxUsesPerUser": 1,
  "minOrderValue": 50,
  "validFrom": "2026-06-01T00:00:00Z",
  "validUntil": "2026-08-31T23:59:59Z",
  "categoryIds": ["cat-id-1", "cat-id-2"]
}
```

**Discount Types:**
- `PERCENTAGE` - Percentage off (value: 0-100)
- `FIXED_AMOUNT` - Fixed dollar amount off
- `FREE_SHIPPING` - Waive shipping fee

**Response (201):**
```json
{
  "success": true,
  "discount": {
    "id": "uuid",
    "code": "SUMMER20",
    "type": "PERCENTAGE",
    "value": 20,
    "isActive": true
  }
}
```

---

### Validate Discount Code
**POST** `/api/discounts/validate`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "code": "SUMMER20",
  "orderTotal": 150
}
```

**Response (200):**
```json
{
  "valid": true,
  "discount": {
    "code": "SUMMER20",
    "type": "PERCENTAGE",
    "value": 20
  },
  "discountAmount": 30,
  "message": "Discount code 'SUMMER20' applied successfully"
}
```

**Validation Checks:**
- ✅ Code exists and is active
- ✅ Within valid date range
- ✅ Usage limits not exceeded
- ✅ User hasn't exceeded personal limit
- ✅ Meets minimum order value
- ✅ Applicable to cart items (category/product restrictions)

---

### Get All Discounts (Admin)
**GET** `/api/admin/discounts?page=1&limit=20&isActive=true`

**Response (200):**
```json
{
  "discounts": [
    {
      "id": "uuid",
      "code": "SUMMER20",
      "type": "PERCENTAGE",
      "value": 20,
      "usedCount": 45,
      "maxUses": 100,
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

---

### Deactivate Discount Code
**DELETE** `/api/admin/discounts/:id`

**Response (200):**
```json
{
  "success": true,
  "message": "Discount code deactivated"
}
```

---

## ❤️ Wishlist

### Get Wishlist
**GET** `/api/wishlist`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "product": {
        "id": "prod-id",
        "name": "Running Shoes",
        "slug": "running-shoes",
        "images": [...],
        "variants": [
          {
            "price": 129.99,
            "compareAtPrice": 159.99,
            "stockQuantity": 15
          }
        ]
      },
      "notes": "Size 10 preferred",
      "priority": 1,
      "createdAt": "2026-02-01T10:00:00Z"
    }
  ]
}
```

---

### Add to Wishlist
**POST** `/api/wishlist`

**Request Body:**
```json
{
  "productId": "prod-id",
  "notes": "Want this for birthday",
  "priority": 2
}
```

**Response (201):**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "productId": "prod-id",
    "notes": "Want this for birthday",
    "priority": 2
  }
}
```

---

### Remove from Wishlist
**DELETE** `/api/wishlist/:productId`

**Response (200):**
```json
{
  "success": true,
  "message": "Item removed from wishlist"
}
```

---

### Move to Cart
**POST** `/api/wishlist/:productId/move-to-cart`

**Response (200):**
```json
{
  "success": true,
  "message": "Item moved to cart"
}
```

**Error Responses:**
- `404` - Product not in wishlist
- `400` - Product out of stock

---

### Check if in Wishlist
**GET** `/api/wishlist/check/:productId`

**Response (200):**
```json
{
  "inWishlist": true
}
```

---

## ⭐ Product Reviews

### Create Review
**POST** `/api/products/:productId/reviews`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "rating": 5,
  "title": "Excellent product!",
  "comment": "Very satisfied with my purchase. Highly recommend!",
  "orderId": "order-id" // optional, for verified purchase badge
}
```

**Response (201):**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "rating": 5,
    "title": "Excellent product!",
    "status": "PENDING",
    "user": {
      "firstName": "John",
      "lastName": "Doe"
    },
    "createdAt": "2026-02-02T10:00:00Z"
  }
}
```

**Validation:**
- ✅ Rating must be 1-5
- ✅ One review per user per product
- ✅ Verified purchase if orderId provided
- ✅ Can only review delivered orders

---

### Get Product Reviews
**GET** `/api/products/:productId/reviews?page=1&limit=10&sortBy=createdAt&sortOrder=desc`

**Response (200):**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Excellent!",
      "comment": "Great product",
      "user": {
        "firstName": "John",
        "lastName": "D."
      },
      "createdAt": "2026-02-02T10:00:00Z",
      "helpfulCount": 12,
      "unhelpfulCount": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "pages": 5
  },
  "ratingBreakdown": {
    "5": 30,
    "4": 10,
    "3": 3,
    "2": 1,
    "1": 1
  }
}
```

---

### Update Review
**PUT** `/api/reviews/:reviewId`

**Request Body:**
```json
{
  "rating": 4,
  "title": "Updated title",
  "comment": "Updated comment"
}
```

**Response (200):**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "rating": 4,
    "status": "PENDING" // Re-moderation required
  }
}
```

---

### Delete Review
**DELETE** `/api/reviews/:reviewId`

**Response (200):**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

---

### Moderate Review (Admin)
**POST** `/api/admin/reviews/:reviewId/moderate`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Request Body:**
```json
{
  "status": "APPROVED",
  "moderationNotes": "Review meets guidelines"
}
```

**Status Options:**
- `APPROVED` - Publish review
- `REJECTED` - Hide review
- `FLAGGED` - Mark for further review

**Response (200):**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "status": "APPROVED",
    "moderatedAt": "2026-02-02T10:30:00Z"
  }
}
```

---

### Get Pending Reviews (Admin)
**GET** `/api/admin/reviews/pending?page=1&limit=20`

**Response (200):**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "product": {
        "id": "prod-id",
        "name": "Product Name"
      },
      "user": {
        "email": "user@example.com",
        "firstName": "John"
      },
      "rating": 5,
      "comment": "...",
      "createdAt": "2026-02-02T10:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

---

### Vote on Review
**POST** `/api/reviews/:reviewId/vote`

**Request Body:**
```json
{
  "helpful": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Vote recorded"
}
```

---

## 🔔 Notifications

### Get User Notifications
**GET** `/api/notifications?page=1&limit=20&isRead=false`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "ORDER_SHIPPED",
      "subject": "Your Order Has Shipped",
      "body": "Order #ORD-123 has been shipped...",
      "isRead": false,
      "relatedEntityType": "Order",
      "relatedEntityId": "order-id",
      "sentAt": "2026-02-02T10:00:00Z"
    }
  ],
  "unreadCount": 3,
  "pagination": { ... }
}
```

---

### Mark as Read
**PUT** `/api/notifications/:id/read`

**Response (200):**
```json
{
  "success": true
}
```

---

### Mark All as Read
**PUT** `/api/notifications/read-all`

**Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

---

## 👀 Recently Viewed

### Get Recently Viewed Products
**GET** `/api/recently-viewed?limit=10`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "product": {
        "id": "prod-id",
        "name": "Product Name",
        "slug": "product-slug",
        "images": [...],
        "variants": [...]
      },
      "viewedAt": "2026-02-02T09:45:00Z"
    }
  ]
}
```

---

### Track Product View
**POST** `/api/products/:productId/view`

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response (200):**
```json
{
  "success": true
}
```

**Notes:**
- Automatically tracks last 20 viewed products
- Updates timestamp if already viewed
- Increments product view count

---

### Get Trending Products
**GET** `/api/products/trending?days=7&limit=10`

**Response (200):**
```json
{
  "products": [
    {
      "id": "prod-id",
      "name": "Trending Product",
      "viewCount": 245,
      "images": [...],
      "variants": [...]
    }
  ]
}
```

---

## 🔒 Security Features

### Account Lockout Protection
- **Trigger:** 5 failed login attempts
- **Duration:** 30 minutes
- **Reset:** Successful login or password reset
- **Notification:** Email sent when account locked

### Rate Limiting
- **OTP Requests:** 3 per 15 minutes per email
- **Login Attempts:** 5 before lockout
- **API Endpoints:** 100 requests/minute per IP (adjustable)

### Security Logging
All security events are logged:
- Login attempts (success/failure)
- Password changes
- 2FA actions
- Account lockouts
- OTP requests and verifications
- Google OAuth authentications

### Security Log Events
```
LOGIN_SUCCESS
LOGIN_FAILED_PASSWORD
LOGIN_BLOCKED_LOCKED
LOGIN_BLOCKED_INACTIVE
ACCOUNT_LOCKED
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_SUCCESS
2FA_ENABLED
2FA_DISABLED
2FA_VERIFIED_SUCCESS
OTP_CREATED
OTP_VERIFIED_SUCCESS
OTP_VERIFICATION_FAILED
OTP_MAX_ATTEMPTS_EXCEEDED
USER_REGISTERED
USER_REGISTERED_GOOGLE
EMAIL_VERIFIED
GOOGLE_ACCOUNT_LINKED
```

---

## 🛡️ Security Best Practices

### For Developers
1. ✅ Never store plain text passwords or OTPs
2. ✅ Always hash sensitive data (bcrypt recommended)
3. ✅ Use HTTPS in production
4. ✅ Implement rate limiting on all auth endpoints
5. ✅ Log security events for audit trails
6. ✅ Validate all inputs server-side
7. ✅ Use secure session management
8. ✅ Implement CSRF protection
9. ✅ Keep dependencies updated
10. ✅ Use environment variables for secrets

### For Frontend
1. ✅ Store tokens in httpOnly cookies (recommended)
2. ✅ Or use secure storage (not localStorage for sensitive data)
3. ✅ Implement token refresh logic
4. ✅ Handle 401 errors globally
5. ✅ Clear tokens on logout
6. ✅ Validate inputs client-side (but don't rely on it)
7. ✅ Show appropriate error messages
8. ✅ Implement CAPTCHA for sensitive actions (optional)

---

## 📊 API Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Login successful |
| 201 | Created | User registered |
| 400 | Bad Request | Invalid OTP |
| 401 | Unauthorized | Invalid credentials |
| 403 | Forbidden | Account locked |
| 404 | Not Found | User not found |
| 409 | Conflict | Email already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

---

## 🧪 Testing Credentials

### Development Environment

**Test Users:**
```
Admin:
Email: admin@sportshop.com
Password: admin123

Customer with 2FA:
Email: john@example.com
Password: password123

New User (for testing registration):
Email: test@example.com
Password: Test123!
```

**Test Discount Codes:**
```
WELCOME10 - 10% off, unlimited uses
FREESHIP - Free shipping over $100
VIP20 - 20% off for VIP users only
```

---

## 🔄 Integration Flow Examples

### Complete Registration Flow
```
1. POST /api/auth/register
   → Returns: { otpSent: true }

2. POST /api/auth/verify-email
   → Returns: { success: true }

3. POST /api/auth/login
   → Returns: { accessToken, refreshToken }
```

### Google OAuth Flow
```
1. User clicks "Sign in with Google"
2. Frontend gets idToken from Google
3. POST /api/auth/google { idToken }
   → Returns: { accessToken, refreshToken, isNewUser }
```

### Password Reset Flow
```
1. POST /api/auth/forgot-password { email }
   → Returns: { success: true }

2. User receives OTP via email

3. POST /api/auth/reset-password { email, otp, newPassword }
   → Returns: { success: true }
```

### Checkout with Discount Flow
```
1. POST /api/discounts/validate { code, orderTotal }
   → Returns: { valid: true, discountAmount: 30 }

2. POST /api/orders { ..., discountCodeId }
   → Order created with discount applied

3. Discount usage logged automatically
```

---

This documentation covers all enhanced authentication and feature endpoints. Integrate these into your existing API infrastructure for a complete, production-ready system.
