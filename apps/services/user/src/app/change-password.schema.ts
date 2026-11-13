import { z } from 'zod';

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'Password must be at most 72 bytes when encoded as UTF-8'
      ),
  })
  .strict();

export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
