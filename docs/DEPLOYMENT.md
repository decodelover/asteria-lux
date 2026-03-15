# Deployment Guide

This project can be deployed in two main ways:

- separate frontend and backend hosts
- a single host that serves the built frontend from Express

## Required Backend Configuration

Set these values in `backend/.env` or your hosting provider secrets:

- database connection values: `DATABASE_URL` or `DB_*`
- `JWT_SECRET`
- `APP_BASE_URL`
- `EMAIL_VERIFICATION_REQUIRED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `STORE_SUPPORT_EMAIL`
- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `BANK_*`
- `WHATSAPP_NUMBER`

Optional but recommended:

- `NODE_ENV=production`
- `FRONTEND_URL`
- `BACKEND_PUBLIC_URL`

## Required Frontend Configuration

Set these if the frontend is hosted separately:

- `VITE_API_BASE_URL`
- `VITE_STORE_CURRENCY`
- `VITE_STORE_LOCALE`
- `VITE_WHATSAPP_NUMBER`
- `VITE_WHATSAPP_MESSAGE`

## Backend Deployment Checklist

1. Provision PostgreSQL.
2. Add backend environment variables.
3. Run `npm install`.
4. Run `npm run seed` if you need the starter catalog.
5. Start the API with `npm start`.
6. Confirm `GET /api/health` returns `readiness.ready: true`.

## Frontend Deployment Checklist

1. Add frontend environment variables.
2. Run `npm install`.
3. Run `npm run build`.
4. Serve the `dist/` folder or deploy it to a static host.

`frontend/vercel.json` already includes SPA rewrites for Vercel.

## Post-Deploy Checks

Run these after deployment:

- open the storefront and admin routes
- sign up a new customer and confirm the verification email arrives
- place a test order
- confirm admin order updates appear in the customer account
- confirm the email verification setting in admin behaves the way you expect for new signups
- confirm `/api/health` still reports a healthy configuration

## Persistent Storage

Payment proofs and uploaded product images are stored in `backend/uploads/`. Use persistent storage in production if your backend host has ephemeral filesystems.

## Recommended Pre-Launch Command

```powershell
cd backend
npm run audit:api
```
