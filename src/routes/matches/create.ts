import type { RequestHandler } from "express";
import { db } from "../../db/index.js";
import { matches } from "../../db/schema.js";
import { getMatchStatus } from "../../utils/match-status.js";
import { MATCH_STATUS, createMatchSchema } from "../../validation/matches.js";

export const createMatch: RequestHandler = async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid payload.", details: parsed.error.issues });
    return;
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime) ?? MATCH_STATUS.SCHEDULED,
      })
      .returning();

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }

    res.status(201).json({ data: event });
  } catch (e) {
    res.status(500).json({
      error: "Failed to create match.",
      details: e instanceof Error ? e.message : String(e),
    });
  }
};
