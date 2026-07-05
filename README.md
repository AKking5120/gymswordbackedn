# E-Commerce Backend API

Node.js + Express + Supabase backend for a full-featured e-commerce application.

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

> ⚠️ Use the **Service Role Key** (not the anon key) so the backend can bypass RLS.

### 3. Run
```bash
# Development
npm run dev

# Production
npm start
```

---

## API Reference

All responses follow this shape:
```json
{ "success": true, "message": "...", "data": {...} }
```

Authentication uses `Authorization: Bearer <token>` header.

---

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | — | Register new user |
| POST | `/login` | — | Login |
| GET | `/me` | ✅ | Get current user |
| PUT | `/profile` | ✅ | Update name/password |
| GET | `/addresses` | ✅ | List addresses |
| POST | `/addresses` | ✅ | Add address |
| PUT | `/addresses/:id` | ✅ | Update address |
| DELETE | `/addresses/:id` | ✅ | Delete address |
| GET | `/notifications` | ✅ | Get notifications |
| PUT | `/notifications/:id/read` | ✅ | Mark as read |

**Register body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123",
  "referred_by": "ABC12345"   // optional referral code
}
```

---

### Products — `/api/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | — | List products (with filters) |
| GET | `/:id` | — | Get product + reviews |
| POST | `/` | 🔐 Admin | Create product |
| PUT | `/:id` | 🔐 Admin | Update product |
| DELETE | `/:id` | 🔐 Admin | Soft-delete product |
| GET | `/categories` | — | List categories |
| POST | `/categories` | 🔐 Admin | Create category |
| POST | `/:id/reviews` | ✅ | Add review |
| GET | `/user/wishlist` | ✅ | Get wishlist |
| POST | `/:id/wishlist` | ✅ | Toggle wishlist |

**Product query params:**
```
?category_id=1&gender=men&min_price=100&max_price=5000
&search=shirt&sort=price_asc&page=1&limit=12
```
Sort options: `price_asc`, `price_desc`, `newest`

---

### Cart — `/api/cart`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get cart with totals |
| POST | `/` | ✅ | Add item to cart |
| PUT | `/:id` | ✅ | Update quantity |
| DELETE | `/:id` | ✅ | Remove item |
| DELETE | `/clear` | ✅ | Clear entire cart |

**Add to cart body:**
```json
{ "product_id": 5, "quantity": 2 }
```

---

### Orders — `/api/orders`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ | Place order |
| GET | `/` | ✅ | My orders |
| GET | `/:id` | ✅ | Order details |
| GET | `/admin/all` | 🔐 Admin | All orders |
| PUT | `/admin/:id/status` | 🔐 Admin | Update status |

**Place order body:**
```json
{
  "address_id": 1,
  "payment_method": "cod",
  "coupon_code": "SAVE10",
  "discount_amount": 50,
  "use_wallet_coins": 20
}
```

Order statuses: `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`
Payment statuses: `pending`, `paid`, `failed`

---

### Coupons — `/api/coupons`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/validate` | ✅ | Validate & calculate discount |
| GET | `/` | 🔐 Admin | List coupons |
| POST | `/` | 🔐 Admin | Create coupon |
| PUT | `/:id` | 🔐 Admin | Update coupon |
| DELETE | `/:id` | 🔐 Admin | Delete coupon |

**Validate body:**
```json
{ "code": "SAVE10", "cart_total": 500 }
```

Coupon discount types: `percentage`, `flat`

---

### Wallet — `/api/wallet`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Balance + transaction history |

---

### Referrals — `/api/referrals`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | My referral code + stats |

---

## Project Structure

```
backend/
├── config/
│   └── db.js                  # Supabase client
├── middleware/
│   ├── authMiddleware.js       # JWT verify
│   └── adminMiddleware.js      # Admin role check
├── controllers/
│   ├── authController.js       # Auth + profile + addresses + notifications
│   ├── productController.js    # Products + categories + wishlist + reviews
│   ├── cartController.js       # Cart CRUD
│   ├── orderController.js      # Orders + admin
│   ├── couponController.js     # Coupons + validation
│   ├── walletController.js     # Wallet balance + history
│   └── referralController.js   # Referral stats
├── routes/                     # Express routers
├── services/
│   ├── walletService.js        # Credit/debit wallet logic
│   └── notificationService.js  # Create notifications
├── utils/
│   └── helpers.js              # Response helpers + referral code gen
├── app.js                      # Express app + middleware
└── server.js                   # Entry point
```

## Business Logic Highlights

- **Referral system**: Referrer earns 25 coins when referred user places their first order
- **Wallet coins**: Can be applied at checkout as a discount (1 coin = 1 currency unit)
- **Stock management**: Stock is decremented when an order is placed, validated before checkout
- **Soft delete**: Products are deactivated (`is_active: false`), not hard deleted
- **Notifications**: Auto-sent on registration, order placed, order status change, referral reward
