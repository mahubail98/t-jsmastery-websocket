import { desc, eq } from "drizzle-orm";
import type { RequestHandler } from "express";

import { db } from "../../db/index.js";
import { commentary } from "../../db/schema.js";
import { listCommentaryQuerySchema } from "../../validation/commentary.js";
import { matchIdParamSchema } from "../../validation/matches.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;

export const listCommentary: RequestHandler = async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      error: "Invalid match id.",
      details: parsedParams.error.issues,
    });
    return;
  }

  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res
      .status(400)
      .json({ error: "Invalid query.", details: parsedQuery.error.issues });
    return;
  }

  const { id: matchId } = parsedParams.data;
  const limit = Math.min(parsedQuery.data.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, matchId))
      // createdAt is second-granular and a live match produces several events
      // per second, so sequence breaks ties deterministically.
      .orderBy(desc(commentary.createdAt), desc(commentary.sequence))
      .limit(limit);

    res.json({ data });
  } catch (e) {
    res.status(500).json({
      error: "Failed to list commentary.",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
