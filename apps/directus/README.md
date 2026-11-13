# Directus client library

This Nx library provides a typed Directus REST client and helpers for mapping
asset URLs and translated text. It uses Node.js `fetch` and the workspace
bootstrap configuration; it does not depend on private `@peoplex/*` or
`@smc/*` packages.

Register it in a NestJS module with the Directus configuration:

```ts
SmcDirectusModule.register({
  url: 'http://localhost:8055',
  token: process.env.DIRECTUS_TOKEN,
});
```

Build it with `pnpm exec nx build directus-client`.
