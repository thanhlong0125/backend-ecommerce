import { z } from 'zod';

export const RegisterSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    password: z
      .string()
      .min(8)
      .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'Password must be at most 72 bytes when encoded as UTF-8'
      ),
    displayName: z.string().trim().min(1).max(100).optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s().-]{6,19}$/)
      .optional(),
  })
  .strict();

export type RegisterRequest = z.infer<typeof RegisterSchema>;
