/**
 * lib/validations/review.ts
 */

import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().cuid("Invalid product ID."),
  rating:    z
    .number({ error: "Rating must be a number." })
    .int("Rating must be a whole number.")
    .min(1, "Minimum rating is 1.")
    .max(5, "Maximum rating is 5."),
  title:     z.string().max(150).trim().optional().nullable(),
  body:      z
    .string()
    .min(10, "Review must be at least 10 characters.")
    .max(5000)
    .trim(),
  images:    z.array(z.string().url("Each image must be a valid URL.")).max(5).default([]),
});

export const replyToReviewSchema = z.object({
  reviewId: z.string().cuid("Invalid review ID."),
  body:     z
    .string()
    .min(5, "Reply must be at least 5 characters.")
    .max(2000)
    .trim(),
});

export const moderateReviewSchema = z.object({
  reviewId:   z.string().cuid("Invalid review ID."),
  isApproved: z.boolean(),
});

export type CreateReviewInput   = z.infer<typeof createReviewSchema>;
export type ReplyToReviewInput  = z.infer<typeof replyToReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
