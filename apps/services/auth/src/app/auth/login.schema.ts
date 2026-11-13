import { z } from 'zod';

export const LoginSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    password: z
      .string()
      .min(1)
      .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'Password must be at most 72 bytes when encoded as UTF-8'
      ),
  })
  .strict();

export type LoginRequest = z.infer<typeof LoginSchema>;
