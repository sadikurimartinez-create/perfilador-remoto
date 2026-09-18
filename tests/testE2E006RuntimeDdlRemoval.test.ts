import fs from "node:fs";
import path from "node:path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("E2E-006 runtime PostgreSQL DDL removal", () => {
  test("db pool and login do not run schema migration", () => {
    const dbSource = read("src/lib/db.ts");
    const loginSource = read("src/app/api/auth/login/route.ts");

    expect(dbSource).not.toContain("ensureSchema");
    expect(dbSource).not.toMatch(/CREATE TABLE|ALTER TABLE/i);
    expect(loginSource).not.toContain("ensureSchema");
  });

  test("auth runtime keeps only the expected user DML", () => {
    const authSources = [
      read("src/app/api/auth/login/route.ts"),
      read("src/app/api/auth/me/route.ts"),
      read("src/app/api/auth/profile/route.ts"),
      read("src/app/api/admin/users/route.ts"),
    ];
    const combined = authSources.join("\n");

    expect(combined).toMatch(/SELECT[\s\S]+FROM users/i);
    expect(combined).toMatch(/INSERT INTO users/i);
    expect(combined).toMatch(/UPDATE users/i);
    expect(combined).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE INDEX/i);
  });

  test("Drive runtime verifies migrated tables without DDL", () => {
    const serviceSource = read(
      "src/modules/drive-ingestion/drive-ingestion.service.ts"
    );
    const engineSource = read(
      "src/modules/drive-ingestion/drive-ingestion.engine.ts"
    );

    for (const source of [serviceSource, engineSource]) {
      expect(source).toContain("to_regclass");
      expect(source).toContain("DATABASE_SCHEMA_MIGRATION_REQUIRED");
      expect(source).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE INDEX/i);
    }
  });

  test("controlled migration owns the exact Drive table definitions", () => {
    const migration = read(
      "database/migrations/e2e006/001_drive_ingestion_tables_up.sql"
    );

    expect(migration).toContain("CREATE TABLE public.drive_ingestion_log");
    expect(migration).toContain("file_id varchar(255) PRIMARY KEY");
    expect(migration).toContain("CREATE TABLE public.drive_ingested_intelligence");
    expect(migration).toContain(
      "REFERENCES public.drive_ingestion_log(file_id)"
    );
    expect(migration).toContain("ON DELETE CASCADE");
  });
});
