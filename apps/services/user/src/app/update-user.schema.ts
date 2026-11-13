import { z } from 'zod';

const UpdateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s().-]{6,19}$/)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export { UpdateUserSchema };
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
