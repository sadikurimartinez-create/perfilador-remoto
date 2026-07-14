import { runMigrationTests } from "../tests/reportEngineIICMigration.test";

(async () => {
  try {
    await runMigrationTests();
    process.exit(0);
  } catch (error) {
    console.error("❌ ERROR CRÍTICO AL EJECUTAR PRUEBAS DE MIGRACIÓN REPORT ENGINE (ADR-007.3):", error);
    process.exit(1);
  }
})();
