import { Pool } from "pg";

let poolInstance: Pool | null = null;
let schemaEnsured = false;

async function ensureSchema(pool: Pool) {
  try {
    // 1. Asegurar columnas necesarias en la tabla users
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB;
    `);
    
    // 2. Seeding del usuario admin si la tabla está vacía o no existe el admin
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      ["admin"]
    );
    
    if (rows.length === 0) {
      const bcrypt = require("bcryptjs");
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("Admin2026!", salt);
      
      await pool.query(`
        INSERT INTO users (username, password_hash, role, name)
        VALUES ($1, $2, $3, $4)
      `, ["admin", hash, "ADMIN", "Administrador Unificado"]);
      
      console.log("PostgreSQL auto-migration: Seeded default admin user successfully.");
    }
  } catch (err: any) {
    console.error("PostgreSQL auto-migration error:", err.message);
  }
}

/**
 * Devuelve el pool de PostgreSQL. Solo lanza si se usa sin DATABASE_URL.
 * Así el build de Vercel no falla al importar este módulo.
 */
export function getPool(): Pool {
  // Inyectado temporalmente para Vercel usando la IP pública de Namecheap
  const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Cocipe2009@159.198.64.191:5432/ceipol_perfilador";
  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL para conectar a PostgreSQL."
    );
  }
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString,
      max: 10,
    });
  }
  
  if (!schemaEnsured) {
    schemaEnsured = true;
    ensureSchema(poolInstance).catch((err) => {
      console.error("PostgreSQL background schema alignment failed:", err);
    });
  }
  
  return poolInstance;
}

