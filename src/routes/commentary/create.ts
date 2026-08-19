import type { RequestHandler } from "express";

import { isForeignKeyViolation, isUniqueViolation } from "../../db/errors.js";
import { db } from "../../db/index.js";
import { commentary } from "../../db/schema.js";
import { createCommentarySchema } from "../../validation/commentary.js";

export const createCommentary: RequestHandler = async (req, res) => {
  const parsed = createCommentarySchema.safeParse(req.body);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload.", details: parsed.error.issues });
    return;
  }

  try {
    const [result] = await db.insert(commentary).values(parsed.data).returning();

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
