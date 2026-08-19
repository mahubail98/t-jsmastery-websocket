/**
 * Driver error inspection, kept out of route handlers.
 *
 * Drizzle wraps driver errors in a plain Error ("Failed query: ...") and hangs
 * the LibsqlError off `cause`, so constraint details sit one or two levels
 * down. Everything here walks that chain rather than matching on the outer
 * message.
 *
 * These codes are SQLite-specific. If this project moves to Postgres, the
 * equivalents live in the same place: unique violation becomes SQLSTATE 23505,
 * foreign key 23503, check 23514 — change them here, not in the routes.
 */

/** SQLite extended result code for SQLITE_CONSTRAINT_UNIQUE. */
const SQLITE_CONSTRAINT_UNIQUE = 2067;

/** SQLite extended result code for SQLITE_CONSTRAINT_FOREIGNKEY. */
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

interface DriverError extends Error {
  code?: string;
  rawCode?: number;
}

/** Yields the error and each `cause` beneath it. */
function* causeChain(error: unknown): Generator<DriverError> {
  for (let current = error; current instanceof Error; current = current.cause) {
    yield current as DriverError;
  }
}

/**
 * True when the failure is a UNIQUE constraint violation.
 *
 * Three independent signals are checked so this survives Drizzle or libsql
 * changing how they wrap errors. Note the generic `SQLITE_CONSTRAINT` code is
 * deliberately NOT matched: it also covers NOT NULL, CHECK and foreign-key
 * failures, which are bugs rather than conflicts.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  for (const link of causeChain(error)) {
    if (
      link.code === "SQLITE_CONSTRAINT_UNIQUE" ||
      link.rawCode === SQLITE_CONSTRAINT_UNIQUE ||
      link.message.includes("UNIQUE constraint failed")
    ) {
      return true;
    }
  }

  return false;
};

/**
 * True when the failure is a FOREIGN KEY constraint violation — i.e. the row
 * references a parent that does not exist. Lets a route answer 404 instead of
 * leaking a 500, without spending a second query to check first.
 */
export const isForeignKeyViolation = (error: unknown): boolean => {
  for (const link of causeChain(error)) {
    if (
      link.code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
      link.rawCode === SQLITE_CONSTRAINT_FOREIGNKEY ||
      link.message.includes("FOREIGN KEY constraint failed")
    ) {
      return true;
    }
  }

  return false;
};
