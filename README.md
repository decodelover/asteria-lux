# Asteria Luxury Store

Production-oriented luxury storefront built with React, Vite, Express, and PostgreSQL.

## Overview

Asteria Luxury Store includes:

- a customer storefront with search, category filtering, cart, and account flows
- email-based customer authentication with verification support
- Paystack and bank-transfer checkout flows
- order history and tracking for signed-in customers
- a separate admin workspace for products, orders, users, settings, and team management
- PostgreSQL-backed persistence for catalog, carts, users, admins, orders, and runtime settings

The frontend and backend can run separately or together on one host.

## Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 7, Tailwind CSS 4, Bootstrap Icons |
| Backend | Node.js, Express 5, Multer, Nodemailer, JWT |
| Database | PostgreSQL |
| Payments | Paystack, bank transfer proof upload |
| Mail | SMTP or local preview mode |

## Repository Structure

```text
luxury-store/
|-- backend/
|   |-- db.js
|   |-- mailer.js
|   |-- runtime-settings.js
|   |-- schema.js
|   |-- seed.js
|   |-- server.js
|   |-- scripts/
|   `-- uploads/
|-- frontend/
|   |-- public/
|   `-- src/
|-- docs/
|   |-- ADMIN.md
|   |-- API.md
|   |-- DEPLOYMENT.md
|   `-- GITHUB-PUBLISH.md
|-- .gitignore
|-- CONTRIBUTING.md
`-- README.md
```

## Local Development

### Backend

```powershell
cd backend
npm install
copy .env.example .env
npm run seed
npm start
```

Backend URLs:

- `http://localhost:5000`
- `http://localhost:5000/api/health`

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend dev URL:

- `http://localhost:5173`

### Single-host local run

```powershell
cd frontend
npm run build

cd ..\backend
npm start
```

## Environment Files

- [backend/.env.example](backend/.env.example)
- [frontend/.env.example](frontend/.env.example)

Common backend variables:

- `DATABASE_URL` or `DB_*`
- `JWT_SECRET`
- `APP_BASE_URL`
- `FRONTEND_URL`
- `BACKEND_PUBLIC_URL`
- `EMAIL_VERIFICATION_REQUIRED`
- `SMTP_*`
- `PAYSTACK_*`
- `BANK_*`
- `WHATSAPP_NUMBER`

Common frontend variables:

- `VITE_API_BASE_URL`
- `VITE_STORE_CURRENCY`
- `VITE_STORE_LOCALE`
- `VITE_WHATSAPP_NUMBER`
- `VITE_WHATSAPP_MESSAGE`

## Admin Access

The initial owner admin is created from your configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`
environment variables during bootstrap.

After first sign-in, change the password from the admin dashboard security panel before going live.
The admin settings workspace also lets you manage SMTP mail settings and toggle customer email verification without editing code.

## Quality Checks

```powershell
cd frontend
npm run lint
npm run build

cd ..\backend
node -c server.js
node -c schema.js
node -c mailer.js
npm run audit:api
```

## Documentation

- [API reference](docs/API.md)
- [Admin guide](docs/ADMIN.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [GitHub publishing guide](docs/GITHUB-PUBLISH.md)

## Current Status

The codebase is ready for GitHub publishing and deployment preparation.

Before a real production launch, confirm:

- production database credentials
- a private production `JWT_SECRET`
- verified SMTP sender credentials
- live Paystack keys if Paystack should be active
- your final frontend/backend domain URLs
- persistent storage strategy for `backend/uploads`
