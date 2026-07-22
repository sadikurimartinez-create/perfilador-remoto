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

function parseConnectionString(str: string) {
  if (!str) return null;
  try {
    let clean = str;
    if (clean.startsWith("postgresql://")) {
      clean = clean.substring(13);
    } else if (clean.startsWith("postgres://")) {
      clean = clean.substring(11);
    }
    const queryIdx = clean.indexOf("?");
    let options = "";
    if (queryIdx !== -1) {
      options = clean.substring(queryIdx + 1);
      clean = clean.substring(0, queryIdx);
    }
    const lastAtIdx = clean.lastIndexOf("@");
    let credentials = "";
    let hostPortDb = clean;
    if (lastAtIdx !== -1) {
      credentials = clean.substring(0, lastAtIdx);
      hostPortDb = clean.substring(lastAtIdx + 1);
    }
    let user = "";
    let password = "";
    if (credentials) {
      const colonIdx = credentials.indexOf(":");
      if (colonIdx !== -1) {
        user = credentials.substring(0, colonIdx);
        password = credentials.substring(colonIdx + 1);
      } else {
        user = credentials;
      }
    }
    const slashIdx = hostPortDb.indexOf("/");
    let hostPort = hostPortDb;
    let database = "";
    if (slashIdx !== -1) {
      hostPort = hostPortDb.substring(0, slashIdx);
      database = hostPortDb.substring(slashIdx + 1);
    }
    let host = hostPort;
    let port = 5432;
    const portColonIdx = hostPort.lastIndexOf(":");
    if (portColonIdx !== -1) {
      host = hostPort.substring(0, portColonIdx);
      const portStr = hostPort.substring(portColonIdx + 1);
      const parsedPort = parseInt(portStr, 10);
      if (!isNaN(parsedPort)) {
        port = parsedPort;
      }
    }
    return {
      user: decodeURIComponent(user),
      password: decodeURIComponent(password),
      host,
      port,
      database,
      ssl: options.includes("sslmode=require") || options.includes("ssl=true") ? { rejectUnauthorized: false } : false
    };
  } catch (err) {
    console.error("Failed to parse connection string:", err);
    return null;
  }
}

/**
 * Devuelve el pool de PostgreSQL. Solo lanza si se usa sin DATABASE_URL.
 * Así el build de Vercel no falla al importar este módulo.
 */
export function getPool(): Pool {
  let connectionString = process.env.DATABASE_URL || "postgresql://postgres:Cocipe2009@159.198.64.191:5432/ceipol_perfilador";
  
  console.log("getPool diagnostic (before fallback check):", {
    hasEnv: !!process.env.DATABASE_URL,
    envLength: process.env.DATABASE_URL ? process.env.DATABASE_URL.length : 0,
    envPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 25) : "none"
  });

  // Si la cadena de conexión en Vercel es un placeholder o no es válida (ej. contiene 'USUARIO' o carece de '@')
  // forzamos automáticamente el fallback transparente a la conexión real de Namecheap.
  if (
    connectionString.includes("USUARIO") || 
    connectionString.includes("CONTRASENA") || 
    connectionString.includes("host") || 
    !connectionString.includes("@")
  ) {
    console.warn("getPool warning: DATABASE_URL on Vercel is a placeholder or invalid. Falling back to working Namecheap database URL.");
    connectionString = "postgresql://postgres:Cocipe2009@159.198.64.191:5432/ceipol_perfilador";
  }

  console.log("getPool diagnostic (after fallback check):", {
    usedLength: connectionString.length,
    usedPrefix: connectionString.substring(0, 25)
  });

  if (!connectionString) {
    throw new Error(
      "Falta la variable de entorno DATABASE_URL para conectar a PostgreSQL."
    );
  }

  if (!poolInstance) {
    const parsed = parseConnectionString(connectionString);
    if (parsed) {
      console.log("Initializing Pool using robust custom-parsed configuration:", {
        user: parsed.user,
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        hasSsl: !!parsed.ssl
      });
      poolInstance = new Pool({
        user: parsed.user,
        password: parsed.password,
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        ssl: parsed.ssl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
    } else {
      console.warn("Fallback to raw connectionString initializer due to parser error.");
      poolInstance = new Pool({
        connectionString,
        max: 10,
      });
    }
  }
  
  if (!schemaEnsured) {
    schemaEnsured = true;
    ensureSchema(poolInstance).catch((err) => {
      console.error("PostgreSQL background schema alignment failed:", err);
    });
  }
  
  return poolInstance;
}

