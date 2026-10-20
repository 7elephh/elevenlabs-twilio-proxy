import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Client } from "pg";

const ROOT = join(__dirname, "..", "..");
const MIGRATIONS = ["0001_schema.sql", "0002_security.sql"];

export interface TestDb {
  url: string;
  connect(): Promise<Client>;
  drop(): Promise<void>;
}

/** Crée une base vierge, y applique le shim Supabase puis les migrations. */
export async function createTestDb(): Promise<TestDb> {
  const baseUrl = process.env.TEST_DATABASE_URL;
  if (!baseUrl) throw new Error("TEST_DATABASE_URL manquant : lancez `npm run test:db`.");
  const name = `lkb_${randomBytes(4).toString("hex")}`;
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = baseUrl.replace(/\/[^/]*$/, `/${name}`);
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(readFileSync(join(ROOT, "tests/db/supabase-shim.sql"), "utf8"));
  for (const file of MIGRATIONS) {
    await client.query(readFileSync(join(ROOT, "supabase/migrations", file), "utf8"));
  }
  await client.end();

  return {
    url,
    async connect() {
      const c = new Client({ connectionString: url });
      await c.connect();
      return c;
    },
    async drop() {
      const c = new Client({ connectionString: baseUrl });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}

/** Exécute `fn` dans une transaction sous un rôle Supabase donné. */
export async function asRole<T>(
  client: Client,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.role', $1, true)", [role]);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}
