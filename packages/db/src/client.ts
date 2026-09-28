import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let sql: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    sql = postgres(url, { max: 10 });
    db = drizzle(sql, { schema });
  }
  return db;
}

export async function closeDb() {
  if (sql) {
    await sql.end();
    sql = null;
    db = null;
  }
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
