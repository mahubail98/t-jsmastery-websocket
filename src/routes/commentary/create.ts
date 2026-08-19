import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { isForeignKeyViolation, isUniqueViolation } from "../../db/errors.js";
import { db } from "../../db/index.js";
import { commentary, matches } from "../../db/schema.js";
import { createCommentarySchema } from "../../validation/commentary.js";
import { matchIdParamSchema } from "../../validation/matches.js";

export const createCommentary: RequestHandler = async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      error: "Invalid match id.",
      details: parsedParams.error.issues,
    });
    return;
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedBody.success) {
    res
      .status(400)
      .json({ error: "Invalid payload.", details: parsedBody.error.issues });
    return;
  }

  const { id: matchId } = parsedParams.data;

  try {
    const [result] = await db
      .insert(commentary)
      .values({ ...parsedBody.data, matchId })
      .returning();

    if (res.app.locals.broadcastCommentary) {
      res.app.locals.broadcastCommentary(result.matchId, result);
    }

    res.status(201).json({ data: result });
  } catch (e) {
    // The unique index on (matchId, sequence) makes a retried publish a
    // conflict instead of a duplicate event.
    if (isUniqueViolation(e)) {
      res.status(409).json({
        error: "Commentary with this sequence already exists for the match.",
      });
      return;
    }

    // The only FK on this table is matchId, so a violation means the match
    // does not exist. Answering 404 here avoids a pre-flight SELECT.
    if (isForeignKeyViolation(e)) {
      res.status(404).json({ error: "Match not found." });
      return;
    }

    res.status(500).json({
      error: "Failed to create commentary.",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
