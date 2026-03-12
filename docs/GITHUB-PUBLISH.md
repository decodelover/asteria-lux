# GitHub Publish Guide

Repository target:

```text
https://github.com/decodelover/asterisluxurystore
```

## Current Situation

This workspace is not initialized as a Git repository yet.

That means you need to:

1. initialize Git locally
2. connect the remote repository
3. commit the project
4. push to GitHub

## Commands

Run these from the project root:

```powershell
git init
git branch -M main
git remote add origin https://github.com/decodelover/asterisluxurystore.git
git add .
git commit -m "Initial project documentation and storefront setup"
git push -u origin main
```

## If `origin` already exists

Use:

```powershell
git remote set-url origin https://github.com/decodelover/asterisluxurystore.git
```

## Before You Push

Confirm these are not included:

- `backend/.env`
- `frontend/.env`
- `backend/uploads/`
- `node_modules/`
- temporary screenshots or local check files

