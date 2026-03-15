# GitHub Publish Guide

## Before You Push

Confirm these files are not committed with real secrets:

- `backend/.env`
- `frontend/.env`
- uploaded files under `backend/uploads/`

This repository already ignores those paths in the root `.gitignore`.

## Repository Checklist

Before creating the remote repository:

- review the root `README.md`
- confirm `docs/` files exist and links work
- make sure `.env.example` files contain placeholders, not live secrets
- run the frontend checks
- run the backend API audit

Recommended local checks:

```powershell
cd frontend
npm run lint
npm run build

cd ..\backend
npm run audit:api
```

## Push Steps

```powershell
git status
git add .
git commit -m "Prepare repo for publishing"
git remote add origin <your-repository-url>
git push -u origin main
```

If your branch is not `main`, replace it with the branch you plan to publish.

## After Push

Verify on GitHub that:

- the README renders correctly
- `docs/` links open correctly
- no real secrets are visible
- the repository structure looks complete

## Recommended Next Step

Once the remote is created, prepare hosting secrets in your deployment platform rather than committing them into the repository.
