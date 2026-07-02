# Bosco API

Catalog e-commerce backend for **Boscorp Solutions** — phase 1 (catalog only). Built with
**NestJS + Prisma + PostgreSQL**.

This phase is a **catalog**, not a full store: no inventory, orders, payments, carts, or
client-side users. It exposes a **public catalog** (categories + products, read-only) and an
**admin dashboard API** (OTP login + CRUD).

- Base path: `/api`
- Dev URL: `http://localhost:3000/api`

## Stack

- NestJS 9 (Express)
- Prisma 5 (PostgreSQL / Neon)
- JWT (HS256) admin auth via email OTP (Resend, no passwords)
- Image storage: AWS S3 in prod, local `./uploads` in dev (zero AWS setup required)

## API endpoints

### Health
- `GET /api/health` → `{ status: "ok" }`

### Auth (admin only — OTP, no passwords)
- `POST /api/auth/otp/request` `{ email }` → `200 { message }` (always 200, no enumeration)
- `POST /api/auth/otp/verify` `{ email, code }` → `200 { accessToken, admin: { email } }`
- `GET  /api/auth/me` (Bearer) → `{ email }`

### Categories (GET public; writes require admin Bearer)
- `GET    /api/categories` → categories with nested subcategories
- `POST   /api/categories` `{ name }`
- `PATCH  /api/categories/:id` `{ name }`
- `DELETE /api/categories/:id` → `204` (cascade-deletes subcategories + products)
- `POST   /api/categories/:id/subcategories` `{ name }`
- `PATCH  /api/subcategories/:id` `{ name }`
- `DELETE /api/subcategories/:id` → `204`

### Products (GET public; writes require admin Bearer, `multipart/form-data` for image)
- `GET /api/products?page=1&limit=10&search=&categoryId=&subcategoryId=`
  → `{ data, total, page, limit, totalPages }`
  `limit ∈ {10, 50, 100}` (default 10, invalid clamped to 10); `search` = case-insensitive
  match on name + description; filter by `categoryId` and/or `subcategoryId`
  (`subcategoryId` wins if both are given).
- `GET    /api/products/:id`
- `POST   /api/products` — multipart: `name, description, link, subcategoryId, image` (file, required)
- `PATCH  /api/products/:id` — multipart: any of the above + optional new `image`
- `DELETE /api/products/:id` → `204`

## Environment

Copy `.env.example` to `.env` and adjust:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signing secret for admin JWTs |
| `ADMIN_EMAILS` | Comma-separated allow-list of admin emails |
| `RESEND_API_KEY` | Resend API key. **If empty, OTP codes are logged to the console** (dev). |
| `RESEND_FROM` | From address for OTP emails |
| `AWS_REGION` / `AWS_S3_BUCKET` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | If all set, images upload to S3; otherwise saved to `./uploads`. |
| `FRONTEND_ORIGINS` | Comma-separated CORS origins |
| `PUBLIC_URL` | Public base URL (used to build local image URLs) |
| `PORT` | HTTP port (default 3000) |

A ready-to-run `.env` with local dev defaults is included.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres (uses the bundled docker-compose)
docker compose up -d

# 3. Create the schema (runs the first migration + generates the client)
npm run db:migrate

# 4. Seed sample categories, subcategories, and products
npm run db:seed

# 5. Run the API in watch mode
npm run start:dev
```

The API is now at `http://localhost:3000/api`. Try `GET http://localhost:3000/api/health`.

### Admin login in dev

With `RESEND_API_KEY` blank, `POST /api/auth/otp/request` logs the 6-digit code to the server
console. Use an email from `ADMIN_EMAILS` (defaults to `leonprimo.9@gmail.com`), read the code
from the logs, then `POST /api/auth/otp/verify` to get a JWT.

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Run in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run db:migrate` | `prisma migrate dev` (create/apply dev migration) |
| `npm run db:deploy` | `prisma migrate deploy` (apply migrations in prod) |
| `npm run db:generate` | `prisma generate` |
| `npm run db:seed` | Seed the database (idempotent) |

## Database (Docker)

`docker-compose.yml` provides a Postgres 16 service (`bosco` / `bosco` / db `bosco`) on port
`5432`, matching the default `DATABASE_URL`.

```bash
docker compose up -d      # start
docker compose down       # stop (keeps data volume)
docker compose down -v    # stop + wipe data
```

## Image storage

Uploaded images are stored **locally under `./uploads`** in dev and served at `/uploads/<file>`;
`imageUrl` is built from `PUBLIC_URL`. In production, set the four `AWS_*` vars and images upload
to S3 instead, with public S3 URLs returned. No code changes needed. `./uploads` is git-ignored.

## Notes

- Run migrations only against a live database. The scaffold ships without a generated migration
  directory; `npm run db:migrate` creates the first one.
- License: MIT (see `LICENSE`).
