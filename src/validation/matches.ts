import { z } from "zod";

export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
} as const;

export type MatchStatusValue = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

const isIsoDateString = (value: string): boolean =>
  ISO_DATE_TIME.test(value) && !Number.isNaN(new Date(value).getTime());

const isoDateString = z
  .string()
  .refine(isIsoDateString, { message: "Must be a valid ISO 8601 date string" });

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, { message: `${field} is required` });

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

/**
 * Keyset cursor. Encodes the sort key of the last row of the previous page —
 * createdAt (epoch seconds, matching how SQLite stores it) plus id as the
 * tiebreaker. Opaque to clients so the sort key can change without breaking them.
 */
export interface MatchesCursor {
  createdAt: Date;
  id: number;
}

export const encodeMatchesCursor = (cursor: MatchesCursor): string =>
  Buffer.from(
    `${Math.floor(cursor.createdAt.getTime() / 1000)}.${cursor.id}`,
  ).toString("base64url");

export const decodeMatchesCursor = (raw: string): MatchesCursor | null => {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const [seconds, id] = decoded.split(".");
  const secondsValue = Number(seconds);
  const idValue = Number(id);

  if (
    !Number.isSafeInteger(secondsValue) ||
    secondsValue < 0 ||
    !Number.isSafeInteger(idValue) ||
    idValue <= 0
  ) {
    return null;
  }

  return { createdAt: new Date(secondsValue * 1000), id: idValue };
};

const cursorParam = z.string().transform((raw, ctx): MatchesCursor => {
  const cursor = decodeMatchesCursor(raw);

  if (!cursor) {
    ctx.addIssue({ code: "custom", message: "Malformed cursor" });
    return z.NEVER;
  }

  return cursor;
});

export const listMatchesQuerySchema = z.object({
  limit: positiveInt.max(100).optional(),
  cursor: cursorParam.optional(),
});

export const matchIdParamSchema = z.object({
  id: positiveInt,
});

export const createMatchSchema = z
  .object({
    sport: nonEmptyString("sport"),
    homeTeam: nonEmptyString("homeTeam"),
    awayTeam: nonEmptyString("awayTeam"),
    startTime: isoDateString,
    endTime: isoDateString,
    homeScore: nonNegativeInt.optional(),
    awayScore: nonNegativeInt.optional(),
  })
  .superRefine((value, ctx) => {
    if (!isIsoDateString(value.startTime) || !isIsoDateString(value.endTime)) {
      return;
    }
    if (new Date(value.endTime).getTime() <= new Date(value.startTime).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "endTime must be after startTime",
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: nonNegativeInt,
  awayScore: nonNegativeInt,
});

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
export type MatchIdParam = z.infer<typeof matchIdParamSchema>;
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateScoreInput = z.infer<typeof updateScoreSchema>;
