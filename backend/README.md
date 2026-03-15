# Backend

This folder contains the Express and PostgreSQL API for `Asteria Luxury Store`.

## Main Files

- `server.js`: API routes, auth, payments, admin tools, static serving
- `schema.js`: schema creation and seed helpers
- `seed.js`: local catalog seed runner
- `db.js`: PostgreSQL connection layer
- `mailer.js`: SMTP or preview mail delivery
- `runtime-settings.js`: admin-editable runtime configuration
- `scripts/api-audit.js`: repeatable backend API smoke audit

## Scripts

```powershell
npm install
npm run seed
npm start
npm run audit:api
```

## Notes

- Default port: `5000`
- Base API path: `/api`
- Uploaded product images and payment proofs are stored under `uploads/`

See the root [README](../README.md) and [docs/API.md](../docs/API.md) for the full reference.
