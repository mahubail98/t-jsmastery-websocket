import { z } from "zod";

/**
 * Request validation for the commentary API.
 *
 * Optionality mirrors the commentary table in src/db/schema.ts: minute, period,
 * actor, team and metadata are nullable there, so they are optional here.
 * sequence, eventType and message are NOT NULL, so they are required.
 */

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, { message: `${field} is required` });

export const listCommentaryQuerySchema = z.object({
  limit: positiveInt.max(100).optional(),
});

export const createCommentarySchema = z.object({
  // Pre-match and half-time events have no minute.
  minute: nonNegativeInt.optional(),
  // Ordering key for the live feed; unique per match at the DB level.
  sequence: nonNegativeInt,
  period: z.string().trim().min(1).optional(),
  eventType: nonEmptyString("eventType"),
  actor: z.string().trim().min(1).optional(),
  team: z.string().trim().min(1).optional(),
  message: nonEmptyString("message"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
});

export type ListCommentaryQuery = z.infer<typeof listCommentaryQuerySchema>;
export type CreateCommentaryInput = z.infer<typeof createCommentarySchema>;
