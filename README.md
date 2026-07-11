# PriceWatch

A product price-tracking client built with **Next.js 16**, **React 19**, and **TypeScript**. Talks to the PriceWatch Spring API for auth, tracked items, product details, and price history.

## Modules

| Module | Route / API | What It Does |
|--------|-------------|--------------|
| Auth | `/login`, `/register` | Register, login, logout, JWT + refresh cookie session |
| Dashboard | `/` | Snapshot of tracked items and recent price drops |
| Tracked Items | `/items`, `/items/[id]` | Add URLs to watch, set thresholds, filter by status |
| Products | `/products/[id]` | Product detail, stock, and price history |

## Tech Stack

Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · Recharts

## Project Structure

```
src/features/
├── auth/                # Login & registration screens
├── dashboard/           # Home summary of tracking activity
├── items/               # Tracked item list & detail
└── products/            # Product detail & price history
```
