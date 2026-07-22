import { Pool } from "pg";

let poolInstance: Pool | null = null;
let schemaEnsured = false;

async function ensureSchema(pool: Pool) {
  try {
    // 1. Crear la tabla users si no existe (robusto para bases de datos nuevas/vacías)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'USER',
        name VARCHAR(255) NOT NULL,
        profile JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Asegurar columnas adicionales por si la tabla ya existía
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb;
    `);
    
    // 3. Seeding del usuario admin si la tabla está vacía o no existe el admin
    const { rows } = await pool.query(
      "SELECT id FROM users WHERE username = $1 LIMIT 1",
      ["admin"]
    );
    
    const bcrypt = require("bcryptjs");
    if (rows.length === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync("Admin2026!", salt);
      
      await pool.query(`
        INSERT INTO users (username, password_hash, role, name)
        VALUES ($1, $2, $3, $4)
      `, ["admin", hash, "ADMIN", "Administrador Unificado"]);
      
      console.log("PostgreSQL auto-migration: Seeded default admin user successfully.");
    }

    // 4. Migración transparente de contraseñas de texto plano a hashes de Bcrypt
    const { rows: allUsers } = await pool.query(
      "SELECT id, username, password_hash FROM users"
    );
    
    for (const u of allUsers) {
      if (
        u.password_hash && 
        !u.password_hash.startsWith("$2a$") && 
        !u.password_hash.startsWith("$2b$") && 
        !u.password_hash.startsWith("$2y$")
      ) {
        console.log(`[Migration] Encriptando contraseña de texto plano para el usuario: ${u.username}`);
        const salt = bcrypt.genSaltSync(10);
        const hashed = bcrypt.hashSync(u.password_hash, salt);
        await pool.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [hashed, u.id]
        );
      }
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

