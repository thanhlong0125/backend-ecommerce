# Microservice starter

This workspace contains a Gateway and independently runnable services:

- `apps/gateway`: the public HTTP entry point. It registers itself with Consul
  and discovers healthy service instances for routing.
- `apps/services/auth`: validates login input, authenticates email/password with
  bcrypt in MongoDB, and issues signed app JWTs.

Gateway does not hold user credentials or make authorization decisions. Auth
and User manage application accounts in MongoDB; Directus is reserved for the
admin CMS and is not part of user login.

## Local setup

Requirements: Node.js 22+, pnpm 10+, and Docker Compose.

1. Copy `.env.example` to `.env.local`. The included credentials are only for
   local development; replace them outside a local environment.
2. Install dependencies and generate Prisma Client:

   ```sh
   pnpm install
   pnpm run prisma:generate
   ```

3. Start Consul, MongoDB, and (if needed for the admin CMS) Directus:

   ```sh
   docker compose --env-file .env.local up -d
   ```

   MongoDB starts as a single-node replica set for Prisma. Directus uses
   PostgreSQL for its own CMS data; Auth and User do not depend on Directus.

4. Create the MongoDB collections/indexes and start the services:

   ```sh
   pnpm run prisma:push
   pnpm run prisma:seed
   pnpm run start:local
   ```

   The catalog seed is safe to rerun without duplicating records: it creates
   four categories, seven measurement-based sizes (S-4XL), and 20 tole products
   with per-size stock. Sample prices are 180,000 VND with an original price of
   250,000 VND.

Gateway listens on `GATEWAY_PORT`; Auth listens on `AUTH_PORT`. Each service
loads its own YAML bootstrap from
`apps/services/<service>/src/bootstraps/bootstrap-<NODE_ENV>.yaml`; `${ENV_NAME}`
placeholders are read from `.env.local`. Both register their service name and
health check with Consul.

When Gateway and Auth run directly on the host while Consul runs in Docker,
`SERVICE_ADVERTISE_HOST=host.docker.internal` lets Consul reach the services;
`SERVICE_HOST_OVERRIDE=localhost` lets the host-run Gateway reach services.
Leave the host override empty when Gateway should use the address returned by
Consul.

## API

Register a new account through Gateway:

```http
POST /api/auth/register
Content-Type: application/json

{"email":"user@example.com","password":"my-strong-password","displayName":"User","phoneNumber":"+84901234567"}
```

Then login with `POST /api/auth/login` using `email` and `password`. Both
endpoints return an app JWT. The User service validates that JWT and stores
bcrypt password hashes in MongoDB. Legacy Directus profile records are not
automatically migrated to login accounts.

For local development, set `SEED_USER_EMAIL`, `SEED_USER_PASSWORD`, and
optionally `SEED_USER_DISPLAY_NAME` in `.env.local`. When the Auth service
starts, it creates that user only if the `users` collection is empty. The
password is hashed with bcrypt; the seed is disabled outside development and
does not overwrite existing users.

Change a password with `POST /api/user/change-password`, sending
`currentPassword` and `newPassword` (8 or more characters) with the JWT in the
Authorization header. `AUTH_JWT_SECRET` must be at least 32 characters and
must be the same for Auth and User; use a strong secret outside local
development. Registration does not currently verify email ownership.

Read the current account with `GET /api/user` and update its profile with
`PATCH /api/user`, both using the JWT. Updates accept `displayName` and/or
`phoneNumber`; send `null` to clear either field. Phone numbers may include a
leading `+`, spaces, parentheses, periods, and hyphens.

## Unit tests

Run the User and Auth service unit tests with:

```sh
pnpm exec nx test user
pnpm exec nx test auth
```

The tests do not require a running database. Add service test files under
`apps/services/<service>/src` with the `.spec.ts` suffix. To run with coverage,
use `pnpm exec nx test auth --codeCoverage` or
`pnpm exec nx test user --codeCoverage`.

## Service CLI

Create a service scaffold under `apps/services/`, assign its port, register its
Nx project in the workspace scripts, and route it through Gateway. The CLI
also adjusts Nx parallelism so the new long-running service does not wait in
the queue:

```sh
pnpm run service -- create user
pnpm run start:local
```

By default, the CLI selects the next available port in the 3000 range. To
choose one explicitly, pass `--port`, for example
`pnpm run service -- create catalog --port 3120`. The generated endpoint is
`http://localhost:<GATEWAY_PORT>/<APP_PREFIX>/<service-name>`; health checks use
`http://localhost:<service-port>/<APP_PREFIX>/health`.

Remove a service with `pnpm run service -- delete <service-name>`. The CLI
requires typing the exact service name before it deletes that source folder and
removes the project from workspace scripts. It does not delete database data;
stop the service process before removing it.

## Configuration

- Gateway bootstrap: `apps/gateway/src/bootstraps/`
- Auth bootstrap: `apps/services/auth/src/bootstraps/`
- Shared Prisma client lifecycle: `apps/shared/prisma.service.ts`
- Shared JWT guard: `apps/shared/jwt-auth.guard.ts` (validates app-issued JWTs)
- Shared Directus REST client: `apps/directus/src/`
- Shared Prisma schema: `db/prisma/schema.prisma`
- MongoDB models: `User` (`users`), `Category` (`categories`), `Size` (`sizes`),
  `Product` (`products`), and `ProductSize` (`product_sizes`). Products store
  their integer VND price, images, rating/review summaries, sold count, and
  colors; each product belongs to one category. `ProductSize` links a product
  to a size and tracks its stock.
- Auth request validation: `db/authschema/`
- User request validation: `db/userschema/`
- Directus runs on PostgreSQL; do not point Directus at MongoDB.

Never commit `.env.local`, real Directus credentials, or production secrets.
