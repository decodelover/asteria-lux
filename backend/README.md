# Backend

This folder contains the Express + PostgreSQL API for `Asteris Luxury Store`.

## Main files

- `server.js`: API routes, auth, payments, admin tools, static serving
- `schema.js`: schema creation and seed helpers
- `seed.js`: local catalog seed runner
- `db.js`: PostgreSQL connection layer
- `mailer.js`: SMTP or preview mail delivery
- `runtime-settings.js`: admin-editable runtime configuration

## Scripts

```powershell
npm install
npm run seed
npm start
```

## Notes

- Default port: `5000`
- Base API path: `/api`
- Uploaded product images and payment proofs are stored under `uploads/`

See the root README and [docs/API.md](/c:/WEB%20PROJECTS/luxury-store/docs/API.md) for the full reference.

