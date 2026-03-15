# API Guide

All backend routes are served from `/api`.

## Public Routes

- `GET /health`: health and readiness report
- `GET /settings/public`: storefront branding and support details
- `POST /location/resolve`: device location resolution from coordinates
- `GET /products`: product listing with optional `search`, `category`, `featured`, and `sort`
- `GET /categories`: product categories with counts
- `POST /newsletter/subscribe`: newsletter opt-in
- `POST /contact`: contact form submission
- `GET /payments/config`: current payment capabilities
- `GET /cart`: cart snapshot for a `sessionId`
- `POST /cart/items`: add to cart
- `PATCH /cart/items/:productId`: update item quantity
- `DELETE /cart/items/:productId`: remove one cart item
- `DELETE /cart`: clear cart
- `GET /orders/:orderNumber`: order lookup for the signed-in owner or with matching `email`

## Customer Auth Routes

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/settings`
- `POST /auth/resend-verification`
- `GET /auth/verify-email`

Customer auth uses bearer tokens in the `Authorization` header.

## Payment Routes

- `POST /payments/paystack/initialize`
- `POST /payments/paystack/verify`
- `POST /payments/paystack/webhook`
- `POST /payments/bank-transfer/submit`

`POST /checkout` is intentionally deprecated and returns `410`.

## Admin Routes

### Auth

- `POST /admin/auth/login`
- `GET /admin/auth/me`
- `POST /admin/auth/change-password`

### Bootstrap and Settings

- `GET /admin/bootstrap`
- `GET /admin/settings`
- `PUT /admin/settings`

### Team and Users

- `POST /admin/admins`
- `PATCH /admin/admins/:adminId`
- `PATCH /admin/users/:userId`
- `DELETE /admin/users/:userId`
- `POST /admin/users/:userId/email`

### Products and Orders

- `POST /admin/uploads/product-image`
- `POST /admin/products`
- `PATCH /admin/products/:productId`
- `DELETE /admin/products/:productId`
- `PATCH /admin/orders/:orderNumber`
- `POST /admin/orders/:orderNumber/email`

## Recommended Validation Checks

Before deployment, run:

```powershell
cd backend
npm run audit:api
```

This audit covers public APIs, customer auth, admin auth, product CRUD, cart flows, payment initialization, bank transfer ordering, and tracking.
