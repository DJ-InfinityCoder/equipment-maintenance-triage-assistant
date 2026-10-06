import { z } from "zod";

export const UserRoleSchema = z.enum(["reporter", "technician"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: UserRoleSchema,
  passwordHash: z.string().min(1),
  passwordSalt: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type AppUser = z.infer<typeof UserSchema>;

export const RegisterUserInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  role: UserRoleSchema.default("reporter"),
  technicianInviteCode: z.string().max(256).optional(),
});

export const LoginUserInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(128),
});
