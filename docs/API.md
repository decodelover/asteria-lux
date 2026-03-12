# API Reference

Base path:

```text
/api
```

Authentication:

- customer auth uses `Authorization: Bearer <jwt>`
- admin auth uses a separate `Authorization: Bearer <admin-jwt>`

## Public Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API and config health summary |
| `GET` | `/settings/public` | storefront-visible runtime settings |
| `POST` | `/location/resolve` | resolve device location context |
| `GET` | `/products` | product listing with filter/search/sort |
| `GET` | `/categories` | category list with counts |
| `POST` | `/newsletter/subscribe` | newsletter subscription |
| `POST` | `/contact` | contact form submission |
| `GET` | `/orders/:orderNumber` | public order lookup by order number |

### Product query params

| Param | Purpose |
| --- | --- |
| `category` | filter by category |
| `search` | search product name/description |
| `featured=true` | featured-only listing |
| `sort` | `featured`, `newest`, `price-asc`, `price-desc`, `name` |

## Customer Auth Endpoints

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/signup` | No | create account |
| `POST` | `/auth/login` | No | sign in |
| `GET` | `/auth/me` | Customer | account snapshot |
| `PATCH` | `/auth/settings` | Customer | update customer profile/settings |
| `POST` | `/auth/resend-verification` | No or Customer | resend email verification |
| `GET` | `/auth/verify-email` | No | verify email token |

## Cart Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/cart` | fetch cart by session |
| `POST` | `/cart/items` | add item to cart |
| `PATCH` | `/cart/items/:productId` | update item quantity |
| `DELETE` | `/cart/items/:productId` | remove single cart item |
| `DELETE` | `/cart` | clear cart |

## Payment Endpoints

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/payments/config` | No | client payment config |
| `POST` | `/payments/paystack/webhook` | No | Paystack webhook receiver |
| `POST` | `/payments/paystack/initialize` | Customer | initialize Paystack checkout |
| `POST` | `/payments/paystack/verify` | Customer | verify Paystack payment |
| `POST` | `/payments/bank-transfer/submit` | Customer | submit bank transfer proof |

### Checkout note

`POST /checkout` is intentionally closed and returns `410`.

## Admin Auth Endpoints

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/admin/auth/login` | No | admin sign in |
| `GET` | `/admin/auth/me` | Admin | admin session check |
| `POST` | `/admin/auth/change-password` | Admin | admin password update |

## Admin Dashboard Endpoints

| Method | Route | Capability | Purpose |
| --- | --- | --- | --- |
| `GET` | `/admin/bootstrap` | any admin | dashboard bootstrap payload |
| `GET` | `/admin/settings` | `settings` | fetch runtime settings |
| `PUT` | `/admin/settings` | `settings` | update runtime settings |
| `POST` | `/admin/uploads/product-image` | `products` | upload product image |
| `POST` | `/admin/products` | `products` | create product |
| `PATCH` | `/admin/products/:productId` | `products` | update product |
| `DELETE` | `/admin/products/:productId` | `products` | delete product |
| `PATCH` | `/admin/orders/:orderNumber` | `orders` | update order, payment, tracking |
| `POST` | `/admin/orders/:orderNumber/email` | `orders` | send customer order email |
| `PATCH` | `/admin/users/:userId` | `users` | update customer |
| `DELETE` | `/admin/users/:userId` | `users` | delete customer |
| `POST` | `/admin/users/:userId/email` | `users` | send customer email |
| `POST` | `/admin/admins` | `team` | create admin account |
| `PATCH` | `/admin/admins/:adminId` | `team` | update admin account |

## Response Shape

Most endpoints return a JSON payload like:

```json
{
  "success": true,
  "message": "Human readable message"
}
```

Errors typically return:

```json
{
  "success": false,
  "message": "What went wrong"
}
```

## Operational Notes

- email endpoints can return preview metadata when SMTP is not configured
- payment endpoints can return configuration errors if runtime settings are incomplete
- admin routes require an admin token, not a customer token

