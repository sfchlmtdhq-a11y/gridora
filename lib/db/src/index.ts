import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({
  max: Number(process.env.DB_POOL_MAX ?? 3),
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
