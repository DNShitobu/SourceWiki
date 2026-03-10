# SourceWiki

SourceWiki is a Wikipedia reference review app with a React frontend and an Express/MongoDB backend.

## Current State

- Frontend: Vite + React + TypeScript UI with routed pages for landing, auth, submission, directory, profile, admin, and country views
- Backend: Express API with MongoDB, JWT auth, request validation, rate limiting, and input sanitization
- Main workflows: user registration/login, reference submission, verifier/admin review, public directory browsing, country pages, and profile stats
- Repo status: active development; some frontend utilities still seed demo data for local development

## Stack

- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui
- Backend: Node.js, Express, MongoDB, Mongoose, JWT
- Testing: Jest + Supertest in `backend`

## Local Setup

### Backend

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Required backend env values:

```env
PORT=5000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend

```bash
cd frontend
npm install
echo VITE_API_URL=http://localhost:5000/api > .env
npm run dev
```

## Default Local URLs

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Health check: `http://localhost:5000/health`

## Useful Commands

```bash
# frontend
npm run dev
npm run build

# backend
npm run dev
npm test
```

## Project Layout

```text
backend/   Express API, models, controllers, routes, tests
frontend/  React app, pages, components, API client, utilities
```

## Notes

- API reference lives in `backend/API_DOCUMENTATION.md`
- The frontend should point to the backend with `VITE_API_URL`
- This repo is not production-ready by default; review secrets, CORS, database config, and deployment settings before public use
