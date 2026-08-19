import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Column names are intentionally omitted: the project relies on Drizzle's
 * `casing: "snake_case"` option, so `homeTeam` maps to `home_team`.
 * That option must be set in BOTH the runtime client and drizzle.config.ts.
 */

export const MATCH_STATUS = ["scheduled", "live", "finished"] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const matches = sqliteTable(
  "matches",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    sport: text().notNull(),
    homeTeam: text().notNull(),
    awayTeam: text().notNull(),
    // SQLite has no enum type: `enum` gives the TS union, `check` enforces it in the DB.
    status: text({ enum: MATCH_STATUS }).notNull().default("scheduled"),
    startTime: integer({ mode: "timestamp" }).notNull(),
    endTime: integer({ mode: "timestamp" }),
    homeScore: integer().notNull().default(0),
    awayScore: integer().notNull().default(0),
    createdAt: integer({ mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("matches_status_start_time_idx").on(table.status, table.startTime),
    // Backs the keyset pagination sort key in routes/matches/list.ts.
    // Declared ascending; SQLite scans it in reverse for the DESC ordering.
    index("matches_created_at_id_idx").on(table.createdAt, table.id),
    check(
      "matches_status_check",
      sql`${table.status} in ('scheduled', 'live', 'finished')`,
    ),
  ],
);

export const commentary = sqliteTable(
  "commentary",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    matchId: integer()
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    minute: integer(),
    sequence: integer().notNull(),
    period: text(),
    eventType: text().notNull(),
    actor: text(),
    team: text(),
    message: text().notNull(),
    metadata: text({ mode: "json" }).$type<Record<string, unknown>>(),
    tags: text({ mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integer({ mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    // Serves the live feed (ordered events for one match) AND makes retried
    // publishes idempotent instead of duplicating an event.
    uniqueIndex("commentary_match_id_sequence_key").on(
      table.matchId,
      table.sequence,
    ),
  ],
);

export const matchesRelations = relations(matches, ({ many }) => ({
  commentary: many(commentary),
}));

export const commentaryRelations = relations(commentary, ({ one }) => ({
  match: one(matches, {
    fields: [commentary.matchId],
    references: [matches.id],
  }),
}));

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Commentary = typeof commentary.$inferSelect;
export type NewCommentary = typeof commentary.$inferInsert;
