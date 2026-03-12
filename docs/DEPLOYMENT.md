# Deployment Guide

## Deployment Models

### Option 1: Single backend service serving the frontend build

Use this when you want one Node service to serve both the API and the built frontend.

Flow:

1. Build the frontend with `npm run build`.
2. Keep `frontend/dist` available beside the backend.
3. Start the backend with `npm start`.
4. Route all traffic to the backend service.

### Option 2: Split deployment

Use this when the frontend is hosted separately, for example:

- frontend on Vercel
- backend on Render, Railway, Fly.io, or a VPS

Required configuration:

- frontend: `VITE_API_BASE_URL=https://your-api-domain.com/api`
- backend: `FRONTEND_URL=https://your-frontend-domain.com`
- backend: `APP_BASE_URL=https://your-frontend-domain.com`
- backend: `BACKEND_PUBLIC_URL=https://your-api-domain.com`

## Environment Variables

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Express port, default `5000` |
| `DATABASE_URL` | Yes unless using `DB_*` | Full PostgreSQL connection string |
| `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` | Yes if not using `DATABASE_URL` | Manual database config |
| `DB_SSL` | Sometimes | Enable SSL for managed PostgreSQL |
| `FRONTEND_URL` | Split deploy only | Allowed frontend origin for CORS |
| `APP_BASE_URL` | Yes | Public frontend URL used in email verification links |
| `BACKEND_PUBLIC_URL` | Recommended for split deploy | Public backend URL for uploads and generated asset links |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | JWT duration |
| `EMAIL_VERIFICATION_WINDOW_HOURS` | No | Verification link lifetime |
| `STORE_CURRENCY` | No | Default payment currency |
| `STORE_LOCALE` | No | Default formatting locale |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` | Optional but needed for real inbox delivery | Mail transport |
| `STORE_SUPPORT_EMAIL` | Recommended | Contact email shown to customers |
| `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL` | Optional | Paystack enablement |
| `BANK_TRANSFER_ENABLED`, `BANK_NAME`, `BANK_ACCOUNT_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_TRANSFER_INSTRUCTIONS` | Optional | Bank transfer checkout |

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Split deploy only | Absolute API base URL |
| `VITE_STORE_CURRENCY` | No | Display currency override |
| `VITE_STORE_LOCALE` | No | Display locale override |
| `VITE_WHATSAPP_NUMBER` | Optional | Floating WhatsApp CTA |
| `VITE_WHATSAPP_MESSAGE` | Optional | Default WhatsApp message |

## Production Checklist

1. Set real database credentials.
2. Set `APP_BASE_URL` to the live storefront URL.
3. Set `BACKEND_PUBLIC_URL` if the backend runs on a different domain.
4. Configure SMTP if customer emails should go to real inboxes.
5. Configure Paystack keys if Paystack should be live.
6. Set bank transfer details if bank transfer should be available.
7. Build the frontend with `npm run build`.
8. Ensure `backend/uploads` uses persistent storage if proofs/uploads must survive redeploys.
9. Replace the default admin password immediately after first login.

## Local Build Commands

```powershell
cd frontend
npm run build

cd ..\\backend
npm run seed
npm start
```

## Post-Deployment Smoke Checks

Run these after deployment:

```text
GET  /api/health
GET  /api/products
GET  /api/categories
GET  /api/settings/public
GET  /api/payments/config
GET  /admin/login
```

Then verify:

1. customer sign up
2. email verification flow
3. sign in
4. add to cart
5. checkout entry
6. admin login
7. admin product update reflecting on the storefront

## Important Runtime Notes

- Without SMTP, the app works in preview-email mode instead of inbox delivery.
- Without Paystack keys, the Paystack payment flow stays unavailable.
- Bank transfer proof uploads require writable and persistent backend storage.

