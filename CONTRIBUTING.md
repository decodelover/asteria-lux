# Contributing

## Development Flow

1. install dependencies in `backend/` and `frontend/`
2. copy `.env.example` files as needed
3. run the backend on `http://localhost:5000`
4. run the frontend dev server on `http://localhost:5173` if working in split mode
5. run lint/build checks before publishing changes

## Recommended Checks

```powershell
cd frontend
npm run lint
npm run build

cd ..\\backend
node -c server.js
```

## Commit Guidance

- keep commits focused
- avoid committing `.env` files
- avoid committing uploads, temporary images, or local debug output
- update docs when behavior or routes change

