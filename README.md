# PriceWatch Frontend

Next.js App Router client for the PriceWatch API.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Recharts (product price history)

## Setup

```bash
npm install
cp .env.example .env.local   # optional
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
API default: `http://localhost:8080` (`NEXT_PUBLIC_API_BASE_URL`).

## Auth

- **Access JWT** — in memory, sent as `Authorization: Bearer`
- **Refresh** — HttpOnly cookie (`pw_refresh`), sent with `credentials: "include"`
- On load, the app silently calls `/api/v1/auth/refresh` to restore the session

## Source layout

```
src/
  app/                 # routes only (thin re-exports)
  components/
    auth/              # AuthProvider, RequireAuth
    layout/            # AppShell
    ui/                # shared UI primitives
  features/            # screens by domain
    auth/
    dashboard/
    items/
    products/
  lib/
    api/               # HTTP client + domain API helpers
    auth/              # in-memory session
    hooks/
    format.ts
    types.ts
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Backend

Start the Spring API on `:8080` (compose + `local` profile). CORS allows `http://localhost:3000` with credentials.
