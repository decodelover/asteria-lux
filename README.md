# Asteris Luxury Store

<p align="center">
  A production-oriented luxury storefront built with React, Tailwind CSS, Express, and PostgreSQL.
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-20232a?logo=react">
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-0f172a?logo=tailwindcss">
  <img alt="Express 5" src="https://img.shields.io/badge/Express-5-111827?logo=express">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Database-1d4ed8?logo=postgresql">
  <img alt="Bootstrap Icons" src="https://img.shields.io/badge/Bootstrap_Icons-1.13-6d28d9?logo=bootstrap">
</p>

## Overview

`Asteris Luxury Store` is a full-stack commerce project with:

- a customer storefront inspired by app-first shopping flows
- customer authentication with email verification support
- cart, checkout, order history, and payment review workflows
- a separate admin workspace for catalog, users, orders, team, and runtime settings
- PostgreSQL-backed persistence for products, carts, users, admins, settings, and orders

The frontend and backend can run together on one host, or be deployed separately.

## Core Features

### Customer storefront

- React 19 + Vite single-page storefront
- Tailwind CSS v4 styling with Bootstrap Icons
- search, category filtering, featured content, cart, saved items, and account tab
- sign up, sign in, email verification, and account settings
- live order history and tracking visibility
- WhatsApp quick-contact entry

### Payments and checkout

- Paystack initialization and verification flow
- bank transfer checkout with proof upload
- server-side order creation and payment review states
- admin-controlled payment settings

### Admin workspace

- separate admin session and route: `/admin/login` and `/admin`
- product create, edit, delete, and image upload
- order review, tracking updates, payment review, and direct customer email
- user update, delete, suspend, and email tools
- team management for additional admin accounts
- runtime settings for branding, email, and payments

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 7, Tailwind CSS 4, Bootstrap Icons |
| Backend | Node.js, Express 5, Multer, Nodemailer, JWT |
| Database | PostgreSQL |
| Auth | JWT for customers and admins |
| Payments | Paystack, bank transfer proof workflow |
| Mail | SMTP or local preview mode |

## Repository Structure

```text
luxury-store/
├─ backend/
│  ├─ db.js
│  ├─ mailer.js
│  ├─ runtime-settings.js
│  ├─ schema.js
│  ├─ seed.js
│  ├─ server.js
│  └─ uploads/
├─ frontend/
│  ├─ public/
│  └─ src/
├─ docs/
│  ├─ ADMIN.md
│  ├─ API.md
│  ├─ DEPLOYMENT.md
│  └─ GITHUB-PUBLISH.md
├─ .gitignore
└─ README.md
```

## Local Development

### 1. Backend

```powershell
cd backend
npm install
copy .env.example .env
npm run seed
npm start
```

Backend default URL:

- `http://localhost:5000`
- health check: `http://localhost:5000/api/health`

### 2. Frontend

For a separate Vite development server:

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend dev URL:

- `http://localhost:5173`

### 3. Single-host production-style local run

Build the frontend, then let Express serve it:

```powershell
cd frontend
npm run build

cd ..\\backend
npm start
```

## Environment Variables

See:

- [backend/.env.example](/c:/WEB%20PROJECTS/luxury-store/backend/.env.example)
- [frontend/.env.example](/c:/WEB%20PROJECTS/luxury-store/frontend/.env.example)
- [docs/DEPLOYMENT.md](/c:/WEB%20PROJECTS/luxury-store/docs/DEPLOYMENT.md)

Common backend values:

- `DATABASE_URL` or `DB_*`
- `JWT_SECRET`
- `APP_BASE_URL`
- `FRONTEND_URL`
- `BACKEND_PUBLIC_URL`
- `SMTP_*`
- `PAYSTACK_*`
- `BANK_*`

Common frontend values:

- `VITE_API_BASE_URL`
- `VITE_STORE_CURRENCY`
- `VITE_STORE_LOCALE`
- `VITE_WHATSAPP_NUMBER`
- `VITE_WHATSAPP_MESSAGE`

## Admin Access

Local default admin:

- email: `admin@asterialuxury.local`
- password: `Admin123!`

Change this after deployment.

## API Reference

The API reference is documented in:

- [docs/API.md](/c:/WEB%20PROJECTS/luxury-store/docs/API.md)

## Deployment Notes

Deployment guidance is documented in:

- [docs/DEPLOYMENT.md](/c:/WEB%20PROJECTS/luxury-store/docs/DEPLOYMENT.md)

Important current behavior:

- if SMTP is not configured, email falls back to local preview mode
- if Paystack keys are not configured, Paystack endpoints return configuration errors
- bank-transfer proofs are stored in `backend/uploads`, so persistent storage is recommended in production

## Admin Operations Guide

- [docs/ADMIN.md](/c:/WEB%20PROJECTS/luxury-store/docs/ADMIN.md)

## Publishing This Repo

- [docs/GITHUB-PUBLISH.md](/c:/WEB%20PROJECTS/luxury-store/docs/GITHUB-PUBLISH.md)

## Quality Checks

```powershell
cd frontend
npm run lint
npm run build

cd ..\\backend
node -c server.js
node -c schema.js
node -c mailer.js
```

## Current Project Status

This project is ready for repository publishing and deployment preparation.

The remaining launch-time configuration is operational, not structural:

- production database credentials
- production SMTP credentials
- production Paystack keys if Paystack should be enabled
- real deployment domains

