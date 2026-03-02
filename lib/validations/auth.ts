/**
 * lib/validations/auth.ts
 *
 * Zod schemas for authentication-related inputs.
 * Shared between server actions and any API route handlers.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

const emailField = z
  .string()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(254, "Email is too long.")
  .transform((v) => v.trim().toLowerCase());

const passwordField = z
  .string()
  .min(1, "Password is required.")
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password is too long.");

const nameField = z
  .string()
  .min(1, "Name is required.")
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name is too long.")
  .transform((v) => v.trim());

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    emailField,
  password: passwordField,
});

export const registerSchema = z
  .object({
    name:            nameField,
    email:           emailField,
    password:        passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path:    ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    token:           z.string().min(1, "Reset token is required."),
    password:        passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path:    ["confirmPassword"],
  });

// ─────────────────────────────────────────────────────────────────────────────
// Inferred types
// ─────────────────────────────────────────────────────────────────────────────

export type LoginInput    = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
