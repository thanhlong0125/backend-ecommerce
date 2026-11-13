import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const APP_BOOTSTRAP = Symbol('APP_BOOTSTRAP');

const BootstrapSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    prefix: z.string(),
    port: z.coerce.number().int().min(1).max(65535),
  }),
  service: z.object({
    name: z.string().min(1),
    advertiseHost: z.string().min(1),
  }),
  consul: z.object({
    url: z.string().url(),
  }),
  serviceHostOverride: z.string().optional(),
  directus: z
    .object({
      url: z.string().url(),
    })
    .optional(),
  auth: z
    .object({
      jwtSecret: z.string().min(32),
    })
    .optional(),
  database: z
    .object({
      url: z
        .string()
        .url()
        .refine((value) => value.startsWith('mongodb://') || value.startsWith('mongodb+srv://'), {
          message: 'must be a MongoDB connection URL',
        }),
    })
    .optional(),
});

export type AppBootstrap = z.infer<typeof BootstrapSchema>;
export type ServiceApp = string;

function interpolate(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_match, name: string) => {
      const envValue = process.env[name];
      if (envValue === undefined) {
        throw new Error(`Missing environment variable ${name} in bootstrap`);
      }
      return envValue;
    });
  }
  if (Array.isArray(value)) {
    return value.map(interpolate);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolate(item)])
    );
  }
  return value;
}

export function loadBootstrap(
  service: ServiceApp,
  bootstrapDirectory = join(
    process.cwd(),
    'apps',
    service === 'gateway' ? 'gateway' : join('services', service),
    'src',
    'bootstraps'
  )
): AppBootstrap {
  if (service !== 'gateway' && !/^[a-z][a-z0-9-]*$/.test(service)) {
    throw new Error(`Invalid service name: ${service}`);
  }
  const environment = process.env['NODE_ENV'] ?? 'development';
  const filename = join(bootstrapDirectory, `bootstrap-${environment}.yaml`);
  if (!existsSync(filename)) {
    throw new Error(`Bootstrap file not found: ${filename}`);
  }

  const rawConfig = parse(readFileSync(filename, 'utf8'));
  const interpolatedConfig = interpolate(rawConfig);
  const result = BootstrapSchema.safeParse(interpolatedConfig);
  if (!result.success) {
    throw new Error(
      `Invalid ${service} bootstrap configuration: ${result.error.message}`
    );
  }
  return result.data;
}
