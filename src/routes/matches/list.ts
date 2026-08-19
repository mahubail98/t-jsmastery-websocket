import { and, desc, eq, lt, or } from "drizzle-orm";
import type { RequestHandler } from "express";

import { db } from "../../db/index.js";
import { matches } from "../../db/schema.js";
import {
  encodeMatchesCursor,
  listMatchesQuerySchema,
  type MatchesCursor,
} from "../../validation/matches.js";

const DEFAULT_LIMIT = 50;

/** Backstop matching listMatchesQuerySchema's own max, so the cap holds even `if` that changes. */
const MAX_LIMIT = 100;

/**
 * Keyset predicate for a `(createdAt DESC, id DESC)` sort: take rows strictly
 * older than the cursor, plus rows sharing its second whose id is lower.
 * The tiebreaker is required because createdAt is only second-granular.
 */
const afterCursor = (cursor: MatchesCursor) =>
  or(
    lt(matches.createdAt, cursor.createdAt),
    and(eq(matches.createdAt, cursor.createdAt), lt(matches.id, cursor.id)),
  );

export const listMatches: RequestHandler = async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid query.", details: parsed.error.issues });
    return;
  }

  const { cursor } = parsed.data;
  const limit = Math.min(parsed.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  try {
    // Over-fetch by one to detect a further page without a second COUNT query.
    const rows = await db
      .select()
      .from(matches)
      .where(cursor ? afterCursor(cursor) : undefined)
      .orderBy(desc(matches.createdAt), desc(matches.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);

    res.json({
      data,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore && last ? encodeMatchesCursor(last) : null,
      },
    });
  } catch (e) {
    res.status(500).json({
      error: "Failed to list matches.",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
