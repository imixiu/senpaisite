import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

export const SITE = "senpaisite";

export async function query(text: string, params: unknown[] = []) {
  const sql = getSql();
  const result = await sql(text, params);
  return result;
}

export { getSql };
