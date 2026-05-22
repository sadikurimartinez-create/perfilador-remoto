import { Pool } from "pg";

let poolInstance: Pool | null = null;

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
  return poolInstance;
}
