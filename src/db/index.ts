import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

// Local SQLite file inside the project; override with DATABASE_URL for Turso etc.
const url = process.env.DATABASE_URL ?? "file:sportz.db";

export const client = createClient({ url });

// SQLite enforces foreign keys only when asked to; WAL keeps readers from
// blocking the live-commentary writer.
await client.execute("PRAGMA foreign_keys = ON");
await client.execute("PRAGMA journal_mode = WAL");

export const db = drizzle(client, { schema, casing: "snake_case" });

export { schema };
