import { Pool } from "pg";

let poolInstance: Pool | null = null;

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
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_CONFIGURATION_ERROR: DATABASE_URL is required."
    );
  }

  if (
    !connectionString.startsWith("postgresql://") &&
    !connectionString.startsWith("postgres://")
  ) {
    throw new Error(
      "DATABASE_CONFIGURATION_ERROR: DATABASE_URL must use the PostgreSQL protocol."
    );
  }

  if (!connectionString.includes("@")) {
    throw new Error(
      "DATABASE_CONFIGURATION_ERROR: DATABASE_URL is structurally invalid."
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
  return poolInstance;
}

