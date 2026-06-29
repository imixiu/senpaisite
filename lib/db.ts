import * as mysql from "mysql2/promise";

export const SITE = "senpaisite";

function getConnectionConfig() {
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error("MYSQL_URL is not set");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectTimeout: 10000,
    disableEval: true,
  };
}

export async function query(text: string, params?: any[]): Promise<any> {
  const conn = await mysql.createConnection(getConnectionConfig());
  try {
    let sql = text;
    if (params && params.length > 0) {
      sql = text.replace(/\$(\d+)/g, '?');
      const [rows] = await conn.query(sql, params);
      if (Array.isArray(rows)) return rows.map((row: any) => ({ ...row }));
      return [rows];
    }
    const [rows] = await conn.query(sql);
    if (Array.isArray(rows)) return rows.map((row: any) => ({ ...row }));
    return [rows];
  } finally {
    await conn.end();
  }
}
